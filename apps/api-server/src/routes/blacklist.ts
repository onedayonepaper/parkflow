import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { generateId, ID_PREFIX, nowIso, DEFAULT_SITE_ID } from '@parkflow/shared';

export async function blacklistRoutes(app: FastifyInstance) {
  // GET /api/blacklist - 블랙리스트 목록 조회
  app.get<{
    Querystring: { page?: string; limit?: string; search?: string; isActive?: string };
  }>('/', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Blacklist'],
      summary: '블랙리스트 목록 조회',
      description: '등록된 블랙리스트 차량 목록을 조회합니다.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string' },
          limit: { type: 'string' },
          search: { type: 'string', description: '차량번호 검색' },
          isActive: { type: 'string', description: '활성 상태 필터' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const page = Math.max(1, parseInt(request.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '20', 10)));
    const offset = (page - 1) * limit;
    const search = request.query.search?.trim();
    const isActive = request.query.isActive;

    let whereClause = 'WHERE b.site_id = ?';
    const params: any[] = [DEFAULT_SITE_ID];

    if (search) {
      whereClause += ' AND b.plate_no LIKE ?';
      params.push(`%${search}%`);
    }

    if (isActive !== undefined) {
      whereClause += ' AND b.is_active = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as count FROM blacklist b ${whereClause}
    `).get(...params) as { count: number };

    const items = db.prepare(`
      SELECT
        b.*,
        u.username as created_by_name
      FROM blacklist b
      LEFT JOIN users u ON b.created_by = u.id
      ${whereClause}
      ORDER BY b.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as any[];

    return reply.send({
      ok: true,
      data: {
        items: items.map((item) => ({
          id: item.id,
          siteId: item.site_id,
          plateNo: item.plate_no,
          reason: item.reason,
          isActive: Boolean(item.is_active),
          blockedUntil: item.blocked_until,
          createdBy: item.created_by,
          createdByName: item.created_by_name,
          createdAt: item.created_at,
          updatedAt: item.updated_at,
        })),
        total: countResult.count,
        page,
        limit,
        totalPages: Math.ceil(countResult.count / limit),
      },
      error: null,
    });
  });

  // POST /api/blacklist - 블랙리스트 등록
  app.post<{
    Body: {
      plateNo: string;
      reason: string;
      blockedUntil?: string;
    };
  }>('/', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Blacklist'],
      summary: '블랙리스트 등록',
      description: '차량을 블랙리스트에 등록합니다.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['plateNo', 'reason'],
        properties: {
          plateNo: { type: 'string', minLength: 4 },
          reason: { type: 'string', minLength: 1 },
          blockedUntil: { type: 'string', format: 'date-time', description: '차단 종료일 (없으면 무기한)' },
        },
      },
    },
  }, async (request, reply) => {
    const user = (request as any).user;
    const { plateNo, reason, blockedUntil } = request.body;
    const db = getDb();
    const now = nowIso();

    // 이미 등록된 차량인지 확인
    const existing = db.prepare(`
      SELECT id FROM blacklist
      WHERE site_id = ? AND plate_no = ? AND is_active = 1
    `).get(DEFAULT_SITE_ID, plateNo.trim());

    if (existing) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'ALREADY_BLACKLISTED', message: '이미 블랙리스트에 등록된 차량입니다.' },
      });
    }

    const id = generateId(ID_PREFIX.BLACKLIST || 'bl');

    db.prepare(`
      INSERT INTO blacklist (id, site_id, plate_no, reason, is_active, blocked_until, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
    `).run(id, DEFAULT_SITE_ID, plateNo.trim(), reason, blockedUntil || null, user.id, now, now);

    // 감사 로그
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'CREATE', 'blacklist', ?, ?, ?)
    `).run(generateId(ID_PREFIX.AUDIT), DEFAULT_SITE_ID, user.id, id, JSON.stringify({ plateNo, reason }), now);

    app.log.info({ blacklistId: id, plateNo, reason }, 'Vehicle added to blacklist');

    return reply.code(201).send({
      ok: true,
      data: { id, plateNo, reason },
      error: null,
    });
  });

  // PUT /api/blacklist/:id - 블랙리스트 수정
  app.put<{
    Params: { id: string };
    Body: {
      reason?: string;
      isActive?: boolean;
      blockedUntil?: string | null;
    };
  }>('/:id', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Blacklist'],
      summary: '블랙리스트 수정',
      description: '블랙리스트 항목을 수정합니다.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string' },
          isActive: { type: 'boolean' },
          blockedUntil: { type: ['string', 'null'] },
        },
      },
    },
  }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params;
    const { reason, isActive, blockedUntil } = request.body;
    const db = getDb();
    const now = nowIso();

    const existing = db.prepare('SELECT * FROM blacklist WHERE id = ?').get(id) as any;
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'NOT_FOUND', message: '블랙리스트 항목을 찾을 수 없습니다.' },
      });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (reason !== undefined) {
      updates.push('reason = ?');
      values.push(reason);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(isActive ? 1 : 0);
    }
    if (blockedUntil !== undefined) {
      updates.push('blocked_until = ?');
      values.push(blockedUntil);
    }

    if (updates.length === 0) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'NO_CHANGES', message: '변경할 내용이 없습니다.' },
      });
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE blacklist SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // 감사 로그
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'UPDATE', 'blacklist', ?, ?, ?)
    `).run(
      generateId(ID_PREFIX.AUDIT),
      DEFAULT_SITE_ID,
      user.id,
      id,
      JSON.stringify({ plateNo: existing.plate_no, reason, isActive }),
      now
    );

    return reply.send({
      ok: true,
      data: { message: '블랙리스트가 수정되었습니다.' },
      error: null,
    });
  });

  // DELETE /api/blacklist/:id - 블랙리스트 삭제
  app.delete<{
    Params: { id: string };
  }>('/:id', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Blacklist'],
      summary: '블랙리스트 삭제',
      description: '블랙리스트에서 차량을 삭제합니다.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const user = (request as any).user;
    const { id } = request.params;
    const db = getDb();
    const now = nowIso();

    const existing = db.prepare('SELECT * FROM blacklist WHERE id = ?').get(id) as any;
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'NOT_FOUND', message: '블랙리스트 항목을 찾을 수 없습니다.' },
      });
    }

    db.prepare('DELETE FROM blacklist WHERE id = ?').run(id);

    // 감사 로그
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'DELETE', 'blacklist', ?, ?, ?)
    `).run(
      generateId(ID_PREFIX.AUDIT),
      DEFAULT_SITE_ID,
      user.id,
      id,
      JSON.stringify({ plateNo: existing.plate_no }),
      now
    );

    return reply.send({
      ok: true,
      data: { message: '블랙리스트에서 삭제되었습니다.' },
      error: null,
    });
  });

  // GET /api/blacklist/check/:plateNo - 블랙리스트 확인
  app.get<{
    Params: { plateNo: string };
  }>('/check/:plateNo', {
    schema: {
      tags: ['Blacklist'],
      summary: '블랙리스트 확인',
      description: '차량번호가 블랙리스트에 있는지 확인합니다.',
      params: {
        type: 'object',
        required: ['plateNo'],
        properties: {
          plateNo: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { plateNo } = request.params;
    const db = getDb();
    const now = new Date().toISOString();

    const blacklisted = db.prepare(`
      SELECT * FROM blacklist
      WHERE site_id = ?
        AND plate_no = ?
        AND is_active = 1
        AND (blocked_until IS NULL OR blocked_until > ?)
    `).get(DEFAULT_SITE_ID, plateNo.trim(), now) as any;

    return reply.send({
      ok: true,
      data: {
        isBlacklisted: Boolean(blacklisted),
        reason: blacklisted?.reason || null,
        blockedUntil: blacklisted?.blocked_until || null,
      },
      error: null,
    });
  });
}
