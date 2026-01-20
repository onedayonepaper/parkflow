import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import {
  DiscountRuleRequestSchema,
  generateId,
  ID_PREFIX,
  nowIso,
  DEFAULT_SITE_ID,
  type ApiResponse,
} from '@parkflow/shared';

export async function discountRoutes(app: FastifyInstance) {
  // GET /api/discount-rules
  app.get('/', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const db = getDb();

    const rules = db.prepare(`
      SELECT * FROM discount_rules WHERE site_id = ? ORDER BY created_at DESC
    `).all(DEFAULT_SITE_ID) as any[];

    const items = rules.map((r) => ({
      id: r.id,
      siteId: r.site_id,
      name: r.name,
      type: r.type,
      value: r.value,
      isStackable: Boolean(r.is_stackable),
      maxApplyCount: r.max_apply_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return reply.send({
      ok: true,
      data: { items },
      error: null,
    });
  });

  // GET /api/discount-rules/:id
  app.get<{
    Params: { id: string };
  }>('/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();

    const rule = db.prepare(`SELECT * FROM discount_rules WHERE id = ?`).get(id) as any;

    if (!rule) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'DISCOUNT_RULE_NOT_FOUND', message: '할인 규칙을 찾을 수 없습니다' },
      });
    }

    return reply.send({
      ok: true,
      data: {
        id: rule.id,
        siteId: rule.site_id,
        name: rule.name,
        type: rule.type,
        value: rule.value,
        isStackable: Boolean(rule.is_stackable),
        maxApplyCount: rule.max_apply_count,
        createdAt: rule.created_at,
        updatedAt: rule.updated_at,
      },
      error: null,
    });
  });

  // POST /api/discount-rules
  app.post<{
    Body: { name: string; type: string; value: number; isStackable?: boolean; maxApplyCount?: number | null };
  }>('/', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const parsed = DiscountRuleRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    const { name, type, value, isStackable, maxApplyCount } = parsed.data;
    const db = getDb();
    const now = nowIso();
    const id = generateId(ID_PREFIX.DISCOUNT_RULE);

    db.prepare(`
      INSERT INTO discount_rules (id, site_id, name, type, value, is_stackable, max_apply_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, DEFAULT_SITE_ID, name, type, value, isStackable ? 1 : 0, maxApplyCount ?? null, now, now);

    return reply.code(201).send({
      ok: true,
      data: { id, name, type, value },
      error: null,
    });
  });

  // PUT /api/discount-rules/:id
  app.put<{
    Params: { id: string };
    Body: { name: string; type: string; value: number; isStackable?: boolean; maxApplyCount?: number | null };
  }>('/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const parsed = DiscountRuleRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    const { name, type, value, isStackable, maxApplyCount } = parsed.data;
    const db = getDb();
    const now = nowIso();

    const existing = db.prepare(`SELECT id FROM discount_rules WHERE id = ?`).get(id);
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'DISCOUNT_RULE_NOT_FOUND', message: '할인 규칙을 찾을 수 없습니다' },
      });
    }

    db.prepare(`
      UPDATE discount_rules SET name = ?, type = ?, value = ?, is_stackable = ?, max_apply_count = ?, updated_at = ?
      WHERE id = ?
    `).run(name, type, value, isStackable ? 1 : 0, maxApplyCount ?? null, now, id);

    return reply.send({
      ok: true,
      data: { id, name, type, value },
      error: null,
    });
  });

  // DELETE /api/discount-rules/:id
  app.delete<{
    Params: { id: string };
  }>('/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();

    const existing = db.prepare(`SELECT id FROM discount_rules WHERE id = ?`).get(id);
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'DISCOUNT_RULE_NOT_FOUND', message: '할인 규칙을 찾을 수 없습니다' },
      });
    }

    db.prepare(`DELETE FROM discount_rules WHERE id = ?`).run(id);

    return reply.send({
      ok: true,
      data: { deleted: true },
      error: null,
    });
  });
}
