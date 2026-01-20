import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import {
  RatePlanRequestSchema,
  generateId,
  ID_PREFIX,
  nowIso,
  DEFAULT_SITE_ID,
  type ApiResponse,
  type RatePlan,
} from '@parkflow/shared';

export async function ratePlanRoutes(app: FastifyInstance) {
  // GET /api/rate-plans
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const db = getDb();

    const plans = db.prepare(`
      SELECT * FROM rate_plans WHERE site_id = ? ORDER BY created_at DESC
    `).all(DEFAULT_SITE_ID) as any[];

    const items = plans.map((p) => ({
      id: p.id,
      siteId: p.site_id,
      name: p.name,
      isActive: Boolean(p.is_active),
      rules: JSON.parse(p.rules_json),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

    return reply.send({
      ok: true,
      data: { items },
      error: null,
    });
  });

  // GET /api/rate-plans/:id
  app.get<{
    Params: { id: string };
  }>('/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();

    const plan = db.prepare(`SELECT * FROM rate_plans WHERE id = ?`).get(id) as any;

    if (!plan) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'RATE_PLAN_NOT_FOUND', message: '요금제를 찾을 수 없습니다' },
      });
    }

    return reply.send({
      ok: true,
      data: {
        id: plan.id,
        siteId: plan.site_id,
        name: plan.name,
        isActive: Boolean(plan.is_active),
        rules: JSON.parse(plan.rules_json),
        createdAt: plan.created_at,
        updatedAt: plan.updated_at,
      },
      error: null,
    });
  });

  // POST /api/rate-plans
  app.post<{
    Body: { name: string; rules: any; isActive?: boolean };
  }>('/', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const parsed = RatePlanRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    const { name, rules, isActive } = parsed.data;
    const db = getDb();
    const now = nowIso();
    const id = generateId(ID_PREFIX.RATE_PLAN);

    // 활성화 시 기존 활성 요금제 비활성화
    if (isActive) {
      db.prepare(`UPDATE rate_plans SET is_active = 0, updated_at = ? WHERE site_id = ?`).run(now, DEFAULT_SITE_ID);
    }

    db.prepare(`
      INSERT INTO rate_plans (id, site_id, name, is_active, rules_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, DEFAULT_SITE_ID, name, isActive ? 1 : 0, JSON.stringify(rules), now, now);

    // Audit
    const user = request.user as any;
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'RATE_PLAN_CREATE', 'rate_plans', ?, ?, ?)
    `).run(generateId(ID_PREFIX.AUDIT), DEFAULT_SITE_ID, user.sub, id, JSON.stringify({ name }), now);

    return reply.code(201).send({
      ok: true,
      data: { id, name, isActive: Boolean(isActive) },
      error: null,
    });
  });

  // PUT /api/rate-plans/:id
  app.put<{
    Params: { id: string };
    Body: { name: string; rules: any; isActive?: boolean };
  }>('/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const parsed = RatePlanRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    const { name, rules, isActive } = parsed.data;
    const db = getDb();
    const now = nowIso();

    const existing = db.prepare(`SELECT id FROM rate_plans WHERE id = ?`).get(id);
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'RATE_PLAN_NOT_FOUND', message: '요금제를 찾을 수 없습니다' },
      });
    }

    // 활성화 시 기존 활성 요금제 비활성화
    if (isActive) {
      db.prepare(`UPDATE rate_plans SET is_active = 0, updated_at = ? WHERE site_id = ? AND id != ?`).run(now, DEFAULT_SITE_ID, id);
    }

    db.prepare(`
      UPDATE rate_plans SET name = ?, is_active = ?, rules_json = ?, updated_at = ?
      WHERE id = ?
    `).run(name, isActive ? 1 : 0, JSON.stringify(rules), now, id);

    // Audit
    const user = request.user as any;
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'RATE_PLAN_UPDATE', 'rate_plans', ?, ?, ?)
    `).run(generateId(ID_PREFIX.AUDIT), DEFAULT_SITE_ID, user.sub, id, JSON.stringify({ name, isActive }), now);

    return reply.send({
      ok: true,
      data: { id, name, isActive: Boolean(isActive) },
      error: null,
    });
  });

  // POST /api/rate-plans/:id/activate
  app.post<{
    Params: { id: string };
  }>('/:id/activate', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();
    const now = nowIso();

    const existing = db.prepare(`SELECT id FROM rate_plans WHERE id = ?`).get(id);
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'RATE_PLAN_NOT_FOUND', message: '요금제를 찾을 수 없습니다' },
      });
    }

    // 기존 활성 요금제 비활성화
    db.prepare(`UPDATE rate_plans SET is_active = 0, updated_at = ? WHERE site_id = ?`).run(now, DEFAULT_SITE_ID);

    // 해당 요금제 활성화
    db.prepare(`UPDATE rate_plans SET is_active = 1, updated_at = ? WHERE id = ?`).run(now, id);

    // Audit
    const user = request.user as any;
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'RATE_PLAN_ACTIVATE', 'rate_plans', ?, '{}', ?)
    `).run(generateId(ID_PREFIX.AUDIT), DEFAULT_SITE_ID, user.sub, id, now);

    return reply.send({
      ok: true,
      data: { activated: true },
      error: null,
    });
  });
}
