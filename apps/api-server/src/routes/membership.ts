import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import {
  MembershipRequestSchema,
  generateId,
  ID_PREFIX,
  nowIso,
  normalizePlateNo,
  DEFAULT_SITE_ID,
  type ApiResponse,
} from '@parkflow/shared';

export async function membershipRoutes(app: FastifyInstance) {
  // GET /api/memberships
  app.get<{
    Querystring: { plateNo?: string; active?: string };
  }>('/', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { plateNo, active } = request.query;
    const db = getDb();
    const now = nowIso();

    let sql = `SELECT * FROM memberships WHERE site_id = ?`;
    const params: any[] = [DEFAULT_SITE_ID];

    if (plateNo) {
      sql += ` AND plate_no LIKE ?`;
      params.push(`%${plateNo}%`);
    }

    if (active === 'true') {
      sql += ` AND valid_from <= ? AND valid_to >= ?`;
      params.push(now, now);
    }

    sql += ` ORDER BY created_at DESC`;

    const memberships = db.prepare(sql).all(...params) as any[];

    const items = memberships.map((m) => ({
      id: m.id,
      siteId: m.site_id,
      plateNo: m.plate_no,
      memberName: m.member_name,
      validFrom: m.valid_from,
      validTo: m.valid_to,
      note: m.note,
      createdAt: m.created_at,
      updatedAt: m.updated_at,
    }));

    return reply.send({
      ok: true,
      data: { items },
      error: null,
    });
  });

  // GET /api/memberships/:id
  app.get<{
    Params: { id: string };
  }>('/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();

    const membership = db.prepare(`SELECT * FROM memberships WHERE id = ?`).get(id) as any;

    if (!membership) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'MEMBERSHIP_NOT_FOUND', message: '정기권을 찾을 수 없습니다' },
      });
    }

    return reply.send({
      ok: true,
      data: {
        id: membership.id,
        siteId: membership.site_id,
        plateNo: membership.plate_no,
        memberName: membership.member_name,
        validFrom: membership.valid_from,
        validTo: membership.valid_to,
        note: membership.note,
        createdAt: membership.created_at,
        updatedAt: membership.updated_at,
      },
      error: null,
    });
  });

  // POST /api/memberships
  app.post<{
    Body: { plateNo: string; memberName?: string; validFrom: string; validTo: string; note?: string };
  }>('/', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const parsed = MembershipRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    const { plateNo, memberName, validFrom, validTo, note } = parsed.data;
    const db = getDb();
    const now = nowIso();
    const id = generateId(ID_PREFIX.MEMBERSHIP);
    const normalizedPlate = normalizePlateNo(plateNo);

    db.prepare(`
      INSERT INTO memberships (id, site_id, plate_no, member_name, valid_from, valid_to, note, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, DEFAULT_SITE_ID, normalizedPlate, memberName ?? null, validFrom, validTo, note ?? null, now, now);

    // Audit
    const user = request.user as any;
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'MEMBERSHIP_CREATE', 'memberships', ?, ?, ?)
    `).run(generateId(ID_PREFIX.AUDIT), DEFAULT_SITE_ID, user.sub, id, JSON.stringify({ plateNo: normalizedPlate }), now);

    return reply.code(201).send({
      ok: true,
      data: { id, plateNo: normalizedPlate },
      error: null,
    });
  });

  // PUT /api/memberships/:id
  app.put<{
    Params: { id: string };
    Body: { plateNo: string; memberName?: string; validFrom: string; validTo: string; note?: string };
  }>('/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const parsed = MembershipRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    const { plateNo, memberName, validFrom, validTo, note } = parsed.data;
    const db = getDb();
    const now = nowIso();
    const normalizedPlate = normalizePlateNo(plateNo);

    const existing = db.prepare(`SELECT id FROM memberships WHERE id = ?`).get(id);
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'MEMBERSHIP_NOT_FOUND', message: '정기권을 찾을 수 없습니다' },
      });
    }

    db.prepare(`
      UPDATE memberships SET plate_no = ?, member_name = ?, valid_from = ?, valid_to = ?, note = ?, updated_at = ?
      WHERE id = ?
    `).run(normalizedPlate, memberName ?? null, validFrom, validTo, note ?? null, now, id);

    // Audit
    const user = request.user as any;
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'MEMBERSHIP_UPDATE', 'memberships', ?, ?, ?)
    `).run(generateId(ID_PREFIX.AUDIT), DEFAULT_SITE_ID, user.sub, id, JSON.stringify({ plateNo: normalizedPlate }), now);

    return reply.send({
      ok: true,
      data: { id, plateNo: normalizedPlate },
      error: null,
    });
  });

  // DELETE /api/memberships/:id
  app.delete<{
    Params: { id: string };
  }>('/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();
    const now = nowIso();

    const existing = db.prepare(`SELECT id FROM memberships WHERE id = ?`).get(id);
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'MEMBERSHIP_NOT_FOUND', message: '정기권을 찾을 수 없습니다' },
      });
    }

    db.prepare(`DELETE FROM memberships WHERE id = ?`).run(id);

    // Audit
    const user = request.user as any;
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'MEMBERSHIP_DELETE', 'memberships', ?, '{}', ?)
    `).run(generateId(ID_PREFIX.AUDIT), DEFAULT_SITE_ID, user.sub, id, now);

    return reply.send({
      ok: true,
      data: { deleted: true },
      error: null,
    });
  });

  // GET /api/memberships/check/:plateNo
  app.get<{
    Params: { plateNo: string };
  }>('/check/:plateNo', async (request, reply) => {
    const { plateNo } = request.params;
    const db = getDb();
    const now = nowIso();
    const normalizedPlate = normalizePlateNo(plateNo);

    const membership = db.prepare(`
      SELECT * FROM memberships
      WHERE plate_no = ? AND valid_from <= ? AND valid_to >= ?
      LIMIT 1
    `).get(normalizedPlate, now, now) as any;

    return reply.send({
      ok: true,
      data: {
        isValid: Boolean(membership),
        membership: membership ? {
          id: membership.id,
          plateNo: membership.plate_no,
          memberName: membership.member_name,
          validFrom: membership.valid_from,
          validTo: membership.valid_to,
        } : null,
      },
      error: null,
    });
  });
}
