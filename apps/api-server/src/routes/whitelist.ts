import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import {
  generateId,
  ID_PREFIX,
  normalizePlateNo,
  nowIso,
  DEFAULT_SITE_ID,
  type ApiResponse,
} from '@parkflow/shared';

interface VipWhitelistEntry {
  id: string;
  siteId: string;
  plateNo: string;
  name: string | null;
  reason: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function whitelistRoutes(app: FastifyInstance) {
  // GET /api/whitelist - 화이트리스트 목록 조회
  app.get<{
    Querystring: {
      search?: string;
      active?: string;
    };
    Reply: ApiResponse<{ items: VipWhitelistEntry[]; total: number }>;
  }>('/', {
    schema: {
      tags: ['Whitelist'],
      summary: 'VIP 화이트리스트 목록 조회',
      description: '무료 자동출차 차량 목록을 조회합니다.',
      querystring: {
        type: 'object',
        properties: {
          search: { type: 'string', description: '차량번호 또는 이름 검색' },
          active: { type: 'string', enum: ['true', 'false', 'all'], description: '활성 상태 필터' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { search, active } = request.query;

    let sql = `
      SELECT w.*, u.username as created_by_name
      FROM vip_whitelist w
      LEFT JOIN users u ON w.created_by = u.id
      WHERE w.site_id = ?
    `;
    const params: any[] = [DEFAULT_SITE_ID];

    if (active !== 'all') {
      sql += ` AND w.is_active = ?`;
      params.push(active === 'false' ? 0 : 1);
    }

    if (search) {
      sql += ` AND (w.plate_no LIKE ? OR w.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY w.created_at DESC`;

    const rows = db.prepare(sql).all(...params) as any[];

    const items: VipWhitelistEntry[] = rows.map(row => ({
      id: row.id,
      siteId: row.site_id,
      plateNo: row.plate_no,
      name: row.name,
      reason: row.reason,
      isActive: row.is_active === 1,
      createdBy: row.created_by_name || row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return reply.send({
      ok: true,
      data: { items, total: items.length },
      error: null,
    });
  });

  // POST /api/whitelist - 화이트리스트 추가
  app.post<{
    Body: {
      plateNo: string;
      name?: string;
      reason?: string;
    };
    Reply: ApiResponse<VipWhitelistEntry>;
  }>('/', {
    schema: {
      tags: ['Whitelist'],
      summary: 'VIP 화이트리스트 추가',
      description: '무료 자동출차 차량을 추가합니다.',
      body: {
        type: 'object',
        required: ['plateNo'],
        properties: {
          plateNo: { type: 'string', description: '차량 번호' },
          name: { type: 'string', description: '차량 소유자/명칭' },
          reason: { type: 'string', description: '등록 사유' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { plateNo, name, reason } = request.body;
    const plateNoNorm = normalizePlateNo(plateNo);
    const now = nowIso();

    // 중복 체크
    const existing = db.prepare(`
      SELECT id FROM vip_whitelist
      WHERE site_id = ? AND plate_no = ? AND is_active = 1
    `).get(DEFAULT_SITE_ID, plateNoNorm) as any;

    if (existing) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'DUPLICATE', message: '이미 등록된 차량입니다.' },
      });
    }

    const id = generateId(ID_PREFIX.DISCOUNT_RULE); // VIP_ prefix 없으므로 임시로 사용
    const userId = (request as any).user?.id || null;

    db.prepare(`
      INSERT INTO vip_whitelist (
        id, site_id, plate_no, name, reason, is_active, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
    `).run(id, DEFAULT_SITE_ID, plateNoNorm, name || null, reason || null, userId, now, now);

    return reply.send({
      ok: true,
      data: {
        id,
        siteId: DEFAULT_SITE_ID,
        plateNo: plateNoNorm,
        name: name || null,
        reason: reason || null,
        isActive: true,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
      },
      error: null,
    });
  });

  // PUT /api/whitelist/:id - 화이트리스트 수정
  app.put<{
    Params: { id: string };
    Body: {
      plateNo?: string;
      name?: string;
      reason?: string;
      isActive?: boolean;
    };
    Reply: ApiResponse<VipWhitelistEntry>;
  }>('/:id', {
    schema: {
      tags: ['Whitelist'],
      summary: 'VIP 화이트리스트 수정',
      description: '화이트리스트 항목을 수정합니다.',
    },
  }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params;
    const { plateNo, name, reason, isActive } = request.body;
    const now = nowIso();

    const existing = db.prepare(`
      SELECT * FROM vip_whitelist WHERE id = ?
    `).get(id) as any;

    if (!existing) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'NOT_FOUND', message: '항목을 찾을 수 없습니다.' },
      });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (plateNo !== undefined) {
      updates.push('plate_no = ?');
      params.push(normalizePlateNo(plateNo));
    }
    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (reason !== undefined) {
      updates.push('reason = ?');
      params.push(reason);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(now);
      params.push(id);

      db.prepare(`
        UPDATE vip_whitelist SET ${updates.join(', ')} WHERE id = ?
      `).run(...params);
    }

    const updated = db.prepare(`SELECT * FROM vip_whitelist WHERE id = ?`).get(id) as any;

    return reply.send({
      ok: true,
      data: {
        id: updated.id,
        siteId: updated.site_id,
        plateNo: updated.plate_no,
        name: updated.name,
        reason: updated.reason,
        isActive: updated.is_active === 1,
        createdBy: updated.created_by,
        createdAt: updated.created_at,
        updatedAt: updated.updated_at,
      },
      error: null,
    });
  });

  // DELETE /api/whitelist/:id - 화이트리스트 삭제
  app.delete<{
    Params: { id: string };
    Reply: ApiResponse<{ deleted: boolean }>;
  }>('/:id', {
    schema: {
      tags: ['Whitelist'],
      summary: 'VIP 화이트리스트 삭제',
      description: '화이트리스트 항목을 삭제합니다.',
    },
  }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const result = db.prepare(`DELETE FROM vip_whitelist WHERE id = ?`).run(id);

    if (result.changes === 0) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'NOT_FOUND', message: '항목을 찾을 수 없습니다.' },
      });
    }

    return reply.send({
      ok: true,
      data: { deleted: true },
      error: null,
    });
  });

  // GET /api/whitelist/check/:plateNo - 화이트리스트 확인 (내부용)
  app.get<{
    Params: { plateNo: string };
    Reply: ApiResponse<{ isWhitelisted: boolean; entry?: VipWhitelistEntry }>;
  }>('/check/:plateNo', {
    schema: {
      tags: ['Whitelist'],
      summary: '차량 화이트리스트 확인',
      description: '특정 차량이 화이트리스트에 등록되어 있는지 확인합니다.',
    },
  }, async (request, reply) => {
    const db = getDb();
    const plateNoNorm = normalizePlateNo(request.params.plateNo);

    const entry = db.prepare(`
      SELECT * FROM vip_whitelist
      WHERE site_id = ? AND plate_no = ? AND is_active = 1
    `).get(DEFAULT_SITE_ID, plateNoNorm) as any;

    if (entry) {
      return reply.send({
        ok: true,
        data: {
          isWhitelisted: true,
          entry: {
            id: entry.id,
            siteId: entry.site_id,
            plateNo: entry.plate_no,
            name: entry.name,
            reason: entry.reason,
            isActive: true,
            createdBy: entry.created_by,
            createdAt: entry.created_at,
            updatedAt: entry.updated_at,
          },
        },
        error: null,
      });
    }

    return reply.send({
      ok: true,
      data: { isWhitelisted: false },
      error: null,
    });
  });
}
