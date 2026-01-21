import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { generateId, ID_PREFIX, nowIso } from '@parkflow/shared';

export async function siteRoutes(app: FastifyInstance) {
  // GET /api/sites - 사이트 목록 조회
  app.get('/', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Site'],
      summary: '사이트 목록 조회',
      description: '등록된 모든 주차장 사이트 목록을 조회합니다.',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const db = getDb();

    const sites = db.prepare(`
      SELECT
        s.*,
        (SELECT COUNT(*) FROM parking_sessions ps WHERE ps.site_id = s.id AND ps.status = 'PARKING') as current_parking,
        (SELECT COUNT(*) FROM lanes l WHERE l.site_id = s.id) as lane_count,
        (SELECT COUNT(*) FROM devices d WHERE d.site_id = s.id) as device_count
      FROM sites s
      ORDER BY s.created_at DESC
    `).all() as any[];

    return reply.send({
      ok: true,
      data: {
        items: sites.map((site) => ({
          id: site.id,
          name: site.name,
          timezone: site.timezone,
          currentParking: site.current_parking,
          laneCount: site.lane_count,
          deviceCount: site.device_count,
          createdAt: site.created_at,
          updatedAt: site.updated_at,
        })),
      },
      error: null,
    });
  });

  // GET /api/sites/:id - 사이트 상세 조회
  app.get<{
    Params: { id: string };
  }>('/:id', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Site'],
      summary: '사이트 상세 조회',
      description: '특정 사이트의 상세 정보를 조회합니다.',
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
    const { id } = request.params;
    const db = getDb();

    const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(id) as any;
    if (!site) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'NOT_FOUND', message: '사이트를 찾을 수 없습니다.' },
      });
    }

    // 연결된 레인 조회
    const lanes = db.prepare('SELECT * FROM lanes WHERE site_id = ? ORDER BY direction, name').all(id) as any[];

    // 연결된 장비 조회
    const devices = db.prepare('SELECT * FROM devices WHERE site_id = ? ORDER BY type, name').all(id) as any[];

    // 통계
    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM parking_sessions WHERE site_id = ? AND status = 'PARKING') as current_parking,
        (SELECT COUNT(*) FROM parking_sessions WHERE site_id = ? AND date(entry_at) = date('now', 'localtime')) as today_entries,
        (SELECT COALESCE(SUM(p.amount), 0) FROM payments p
         JOIN parking_sessions ps ON p.session_id = ps.id
         WHERE ps.site_id = ? AND p.status = 'PAID' AND date(p.approved_at) = date('now', 'localtime')) as today_revenue
    `).get(id, id, id) as any;

    return reply.send({
      ok: true,
      data: {
        id: site.id,
        name: site.name,
        timezone: site.timezone,
        createdAt: site.created_at,
        updatedAt: site.updated_at,
        lanes: lanes.map((lane) => ({
          id: lane.id,
          name: lane.name,
          direction: lane.direction,
        })),
        devices: devices.map((device) => ({
          id: device.id,
          name: device.name,
          type: device.type,
          status: device.status,
          lastSeenAt: device.last_seen_at,
        })),
        stats: {
          currentParking: stats.current_parking,
          todayEntries: stats.today_entries,
          todayRevenue: stats.today_revenue,
        },
      },
      error: null,
    });
  });

  // POST /api/sites - 사이트 생성
  app.post<{
    Body: {
      name: string;
      timezone?: string;
    };
  }>('/', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Site'],
      summary: '사이트 생성',
      description: '새로운 주차장 사이트를 생성합니다. SUPER_ADMIN만 접근 가능합니다.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          timezone: { type: 'string', default: 'Asia/Seoul' },
        },
      },
    },
  }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({
        ok: false,
        data: null,
        error: { code: 'FORBIDDEN', message: '권한이 없습니다.' },
      });
    }

    const { name, timezone = 'Asia/Seoul' } = request.body;
    const db = getDb();
    const now = nowIso();

    const id = generateId(ID_PREFIX.SITE);

    db.prepare(`
      INSERT INTO sites (id, name, timezone, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, name, timezone, now, now);

    // 기본 레인 생성
    const entryLaneId = generateId(ID_PREFIX.LANE);
    const exitLaneId = generateId(ID_PREFIX.LANE);

    db.prepare(`
      INSERT INTO lanes (id, site_id, name, direction, created_at, updated_at)
      VALUES (?, ?, '입구 1', 'ENTRY', ?, ?), (?, ?, '출구 1', 'EXIT', ?, ?)
    `).run(entryLaneId, id, now, now, exitLaneId, id, now, now);

    // 기본 요금제 생성
    const ratePlanId = generateId(ID_PREFIX.RATE_PLAN);
    const defaultRules = {
      baseFee: 1000,
      baseMinutes: 30,
      additionalFee: 500,
      additionalMinutes: 10,
      maxDailyFee: 50000,
    };

    db.prepare(`
      INSERT INTO rate_plans (id, site_id, name, is_active, rules_json, created_at, updated_at)
      VALUES (?, ?, '기본 요금제', 1, ?, ?, ?)
    `).run(ratePlanId, id, JSON.stringify(defaultRules), now, now);

    // 감사 로그
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'CREATE', 'site', ?, ?, ?)
    `).run(generateId(ID_PREFIX.AUDIT), id, user.id, id, JSON.stringify({ name, timezone }), now);

    app.log.info({ siteId: id, name }, 'New site created');

    return reply.code(201).send({
      ok: true,
      data: {
        id,
        name,
        timezone,
        entryLaneId,
        exitLaneId,
        ratePlanId,
      },
      error: null,
    });
  });

  // PUT /api/sites/:id - 사이트 수정
  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      timezone?: string;
    };
  }>('/:id', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Site'],
      summary: '사이트 수정',
      description: '사이트 정보를 수정합니다. SUPER_ADMIN만 접근 가능합니다.',
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
          name: { type: 'string', minLength: 1, maxLength: 100 },
          timezone: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({
        ok: false,
        data: null,
        error: { code: 'FORBIDDEN', message: '권한이 없습니다.' },
      });
    }

    const { id } = request.params;
    const { name, timezone } = request.body;
    const db = getDb();
    const now = nowIso();

    const existing = db.prepare('SELECT * FROM sites WHERE id = ?').get(id);
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'NOT_FOUND', message: '사이트를 찾을 수 없습니다.' },
      });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (timezone !== undefined) {
      updates.push('timezone = ?');
      values.push(timezone);
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

    db.prepare(`UPDATE sites SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // 감사 로그
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'UPDATE', 'site', ?, ?, ?)
    `).run(generateId(ID_PREFIX.AUDIT), id, user.id, id, JSON.stringify({ name, timezone }), now);

    return reply.send({
      ok: true,
      data: { message: '사이트가 수정되었습니다.' },
      error: null,
    });
  });

  // DELETE /api/sites/:id - 사이트 삭제
  app.delete<{
    Params: { id: string };
  }>('/:id', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Site'],
      summary: '사이트 삭제',
      description: '사이트를 삭제합니다. 연결된 데이터가 있으면 삭제할 수 없습니다. SUPER_ADMIN만 접근 가능합니다.',
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
    if (user.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({
        ok: false,
        data: null,
        error: { code: 'FORBIDDEN', message: '권한이 없습니다.' },
      });
    }

    const { id } = request.params;
    const db = getDb();
    const now = nowIso();

    const existing = db.prepare('SELECT * FROM sites WHERE id = ?').get(id) as any;
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'NOT_FOUND', message: '사이트를 찾을 수 없습니다.' },
      });
    }

    // 연결된 세션이 있는지 확인
    const sessionCount = db.prepare('SELECT COUNT(*) as count FROM parking_sessions WHERE site_id = ?').get(id) as { count: number };
    if (sessionCount.count > 0) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'HAS_SESSIONS', message: `연결된 주차 세션이 ${sessionCount.count}건 있어 삭제할 수 없습니다.` },
      });
    }

    // 관련 데이터 삭제 (순서 중요)
    db.prepare('DELETE FROM rate_plans WHERE site_id = ?').run(id);
    db.prepare('DELETE FROM discount_rules WHERE site_id = ?').run(id);
    db.prepare('DELETE FROM devices WHERE site_id = ?').run(id);
    db.prepare('DELETE FROM lanes WHERE site_id = ?').run(id);
    db.prepare('DELETE FROM sites WHERE id = ?').run(id);

    // 감사 로그
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'DELETE', 'site', ?, ?, ?)
    `).run(generateId(ID_PREFIX.AUDIT), id, user.id, id, JSON.stringify({ name: existing.name }), now);

    return reply.send({
      ok: true,
      data: { message: '사이트가 삭제되었습니다.' },
      error: null,
    });
  });
}
