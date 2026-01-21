import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { generateId, ID_PREFIX, nowIso, DEFAULT_SITE_ID } from '@parkflow/shared';

export async function auditRoutes(app: FastifyInstance) {
  // GET /api/audit - 감사 로그 목록 조회
  app.get<{
    Querystring: {
      page?: string;
      limit?: string;
      action?: string;
      entityType?: string;
      userId?: string;
      from?: string;
      to?: string;
    };
  }>('/', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Audit'],
      summary: '감사 로그 목록 조회',
      description: '관리자 작업 이력을 조회합니다.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: '페이지 번호', default: '1' },
          limit: { type: 'string', description: '페이지당 항목 수', default: '50' },
          action: { type: 'string', description: '액션 필터' },
          entityType: { type: 'string', description: '엔티티 유형 필터' },
          userId: { type: 'string', description: '사용자 ID 필터' },
          from: { type: 'string', description: '시작일' },
          to: { type: 'string', description: '종료일' },
        },
      },
    },
  }, async (request, reply) => {
    const { page = '1', limit = '50', action, entityType, userId, from, to } = request.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;
    const db = getDb();

    let whereClause = 'a.site_id = ?';
    const params: any[] = [DEFAULT_SITE_ID];

    if (action) {
      whereClause += ' AND a.action = ?';
      params.push(action);
    }
    if (entityType) {
      whereClause += ' AND a.entity_type = ?';
      params.push(entityType);
    }
    if (userId) {
      whereClause += ' AND a.user_id = ?';
      params.push(userId);
    }
    if (from) {
      whereClause += ' AND a.created_at >= ?';
      params.push(from);
    }
    if (to) {
      whereClause += ' AND a.created_at <= ?';
      params.push(to);
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM audit_logs a WHERE ${whereClause}
    `).get(...params) as any;
    const total = countResult?.total || 0;

    const items = db.prepare(`
      SELECT a.*, u.username
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset) as any[];

    return reply.send({
      ok: true,
      data: {
        items: items.map(item => ({
          id: item.id,
          userId: item.user_id,
          username: item.username,
          action: item.action,
          entityType: item.entity_type,
          entityId: item.entity_id,
          detail: JSON.parse(item.detail_json || '{}'),
          createdAt: item.created_at,
        })),
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      error: null,
    });
  });

  // GET /api/audit/actions - 사용 가능한 액션 목록
  app.get('/actions', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Audit'],
      summary: '액션 목록 조회',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const db = getDb();
    const actions = db.prepare(`
      SELECT DISTINCT action FROM audit_logs ORDER BY action
    `).all() as any[];

    return reply.send({
      ok: true,
      data: { actions: actions.map(a => a.action) },
      error: null,
    });
  });

  // GET /api/audit/entity-types - 엔티티 유형 목록
  app.get('/entity-types', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Audit'],
      summary: '엔티티 유형 목록 조회',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const db = getDb();
    const types = db.prepare(`
      SELECT DISTINCT entity_type FROM audit_logs ORDER BY entity_type
    `).all() as any[];

    return reply.send({
      ok: true,
      data: { entityTypes: types.map(t => t.entity_type) },
      error: null,
    });
  });
}

// 감사 로그 기록 헬퍼 함수
export function logAudit(
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  detail: Record<string, any> = {}
) {
  const db = getDb();
  const id = generateId(ID_PREFIX.AUDIT);
  const now = nowIso();

  db.prepare(`
    INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, DEFAULT_SITE_ID, userId, action, entityType, entityId, JSON.stringify(detail), now);

  return id;
}
