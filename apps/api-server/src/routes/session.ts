import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import {
  SessionListFilterSchema,
  SessionCorrectRequestSchema,
  SessionRecalcRequestSchema,
  SessionForceCloseRequestSchema,
  ApplyDiscountRequestSchema,
  generateId,
  ID_PREFIX,
  nowIso,
  DEFAULT_SITE_ID,
  type ApiResponse,
  type ParkingSession,
  type SessionDetail,
} from '@parkflow/shared';
import { calculateWithDiscounts } from '@parkflow/pricing-engine';
import { broadcast } from '../ws/handler.js';

export async function sessionRoutes(app: FastifyInstance) {
  // GET /api/sessions - 세션 목록
  app.get<{
    Querystring: {
      status?: string;
      plateNo?: string;
      laneId?: string;
      from?: string;
      to?: string;
      page?: string;
      limit?: string;
    };
  }>('/', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const parsed = SessionListFilterSchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    const { status, plateNo, laneId, from, to, page, limit } = parsed.data;
    const db = getDb();

    let sql = `
      SELECT ps.*, rp.name as rate_plan_name
      FROM parking_sessions ps
      LEFT JOIN rate_plans rp ON ps.rate_plan_id = rp.id
      WHERE ps.site_id = ?
    `;
    const params: any[] = [DEFAULT_SITE_ID];

    if (status) {
      sql += ` AND ps.status = ?`;
      params.push(status);
    }
    if (plateNo) {
      sql += ` AND ps.plate_no LIKE ?`;
      params.push(`%${plateNo}%`);
    }
    if (laneId) {
      sql += ` AND (ps.entry_lane_id = ? OR ps.exit_lane_id = ?)`;
      params.push(laneId, laneId);
    }
    if (from) {
      sql += ` AND ps.entry_at >= ?`;
      params.push(from);
    }
    if (to) {
      sql += ` AND ps.entry_at <= ?`;
      params.push(to);
    }

    // Count
    const countSql = sql.replace('SELECT ps.*, rp.name as rate_plan_name', 'SELECT COUNT(*) as total');
    const countResult = db.prepare(countSql).get(...params) as any;
    const total = countResult?.total || 0;

    // Pagination
    const offset = (page - 1) * limit;
    sql += ` ORDER BY ps.entry_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const sessions = db.prepare(sql).all(...params) as any[];

    const items = sessions.map((s) => ({
      id: s.id,
      siteId: s.site_id,
      entryLaneId: s.entry_lane_id,
      exitLaneId: s.exit_lane_id,
      plateNo: s.plate_no,
      status: s.status,
      entryAt: s.entry_at,
      exitAt: s.exit_at,
      ratePlanId: s.rate_plan_id,
      ratePlanName: s.rate_plan_name,
      rawFee: s.raw_fee,
      discountTotal: s.discount_total,
      finalFee: s.final_fee,
      paymentStatus: s.payment_status,
      closeReason: s.close_reason,
      createdAt: s.created_at,
      updatedAt: s.updated_at,
    }));

    return reply.send({
      ok: true,
      data: {
        items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      error: null,
    });
  });

  // GET /api/sessions/:id - 세션 상세
  app.get<{
    Params: { id: string };
  }>('/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();

    const session = db.prepare(`
      SELECT ps.*, rp.name as rate_plan_name, rp.rules_json as rate_rules
      FROM parking_sessions ps
      LEFT JOIN rate_plans rp ON ps.rate_plan_id = rp.id
      WHERE ps.id = ?
    `).get(id) as any;

    if (!session) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'SESSION_NOT_FOUND', message: '세션을 찾을 수 없습니다' },
      });
    }

    // 관련 이벤트
    const events = db.prepare(`
      SELECT * FROM plate_events WHERE session_id = ? ORDER BY captured_at
    `).all(id) as any[];

    // 할인 적용 내역
    const discounts = db.prepare(`
      SELECT da.*, dr.name as rule_name, dr.type as rule_type
      FROM discount_applications da
      JOIN discount_rules dr ON da.discount_rule_id = dr.id
      WHERE da.session_id = ?
    `).all(id) as any[];

    // 결제 내역
    const payments = db.prepare(`
      SELECT * FROM payments WHERE session_id = ?
    `).all(id) as any[];

    const entryEvent = events.find((e: any) => e.direction === 'ENTRY');
    const exitEvent = events.find((e: any) => e.direction === 'EXIT');

    return reply.send({
      ok: true,
      data: {
        id: session.id,
        siteId: session.site_id,
        entryLaneId: session.entry_lane_id,
        exitLaneId: session.exit_lane_id,
        plateNo: session.plate_no,
        status: session.status,
        entryAt: session.entry_at,
        exitAt: session.exit_at,
        ratePlanId: session.rate_plan_id,
        ratePlanName: session.rate_plan_name,
        rawFee: session.raw_fee,
        discountTotal: session.discount_total,
        finalFee: session.final_fee,
        feeBreakdown: JSON.parse(session.fee_breakdown_json || '{}'),
        paymentStatus: session.payment_status,
        closeReason: session.close_reason,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
        entryEvent: entryEvent ? mapEvent(entryEvent) : null,
        exitEvent: exitEvent ? mapEvent(exitEvent) : null,
        discountApplications: discounts.map(mapDiscount),
        payments: payments.map(mapPayment),
      },
      error: null,
    });
  });

  // POST /api/sessions/:id/recalc - 요금 재계산
  app.post<{
    Params: { id: string };
    Body: { ratePlanId?: string; reason: string };
  }>('/:id/recalc', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const parsed = SessionRecalcRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    const { ratePlanId, reason } = parsed.data;
    const db = getDb();
    const now = nowIso();

    const session = db.prepare(`SELECT * FROM parking_sessions WHERE id = ?`).get(id) as any;
    if (!session) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'SESSION_NOT_FOUND', message: '세션을 찾을 수 없습니다' },
      });
    }

    if (!session.exit_at) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'NO_EXIT_TIME', message: '출차 시간이 없어 재계산할 수 없습니다' },
      });
    }

    const targetRatePlanId = ratePlanId || session.rate_plan_id;
    const ratePlan = db.prepare(`
      SELECT * FROM rate_plans WHERE id = ?
    `).get(targetRatePlanId) as any;

    if (!ratePlan) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'RATE_PLAN_NOT_FOUND', message: '요금제를 찾을 수 없습니다' },
      });
    }

    // 기존 할인 가져오기
    const discounts = db.prepare(`
      SELECT da.*, dr.name, dr.type, dr.value
      FROM discount_applications da
      JOIN discount_rules dr ON da.discount_rule_id = dr.id
      WHERE da.session_id = ?
    `).all(id) as any[];

    const calcResult = calculateWithDiscounts({
      entryAt: session.entry_at,
      exitAt: session.exit_at,
      ratePlan: {
        id: ratePlan.id,
        name: ratePlan.name,
        rules: JSON.parse(ratePlan.rules_json),
      },
      discounts: discounts.map((d: any) => ({
        id: d.discount_rule_id,
        name: d.name,
        type: d.type,
        value: d.value,
      })),
    });

    db.prepare(`
      UPDATE parking_sessions
      SET rate_plan_id = ?, raw_fee = ?, discount_total = ?, final_fee = ?,
          fee_breakdown_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      targetRatePlanId,
      calcResult.feeCalculation.rawFee,
      calcResult.discountTotal,
      calcResult.finalFee,
      JSON.stringify(calcResult.breakdown),
      now,
      id
    );

    // Audit log
    const user = request.user as any;
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'SESSION_RECALC', 'parking_sessions', ?, ?, ?)
    `).run(generateId(ID_PREFIX.AUDIT), DEFAULT_SITE_ID, user.sub, id, JSON.stringify({ reason, ratePlanId: targetRatePlanId }), now);

    return reply.send({
      ok: true,
      data: {
        rawFee: calcResult.feeCalculation.rawFee,
        discountTotal: calcResult.discountTotal,
        finalFee: calcResult.finalFee,
        breakdown: calcResult.breakdown,
      },
      error: null,
    });
  });

  // POST /api/sessions/:id/correct - 정정
  app.post<{
    Params: { id: string };
    Body: { plateNoCorrected?: string; entryAt?: string; exitAt?: string; reason: string };
  }>('/:id/correct', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const parsed = SessionCorrectRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    const { plateNoCorrected, entryAt, exitAt, reason } = parsed.data;
    const db = getDb();
    const now = nowIso();

    const session = db.prepare(`SELECT * FROM parking_sessions WHERE id = ?`).get(id) as any;
    if (!session) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'SESSION_NOT_FOUND', message: '세션을 찾을 수 없습니다' },
      });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (plateNoCorrected) {
      updates.push('plate_no = ?');
      params.push(plateNoCorrected);
    }
    if (entryAt) {
      updates.push('entry_at = ?');
      params.push(entryAt);
    }
    if (exitAt) {
      updates.push('exit_at = ?');
      params.push(exitAt);
    }

    updates.push('updated_at = ?');
    params.push(now);
    params.push(id);

    db.prepare(`UPDATE parking_sessions SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // Audit log
    const user = request.user as any;
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'SESSION_CORRECT', 'parking_sessions', ?, ?, ?)
    `).run(generateId(ID_PREFIX.AUDIT), DEFAULT_SITE_ID, user.sub, id, JSON.stringify({ plateNoCorrected, entryAt, exitAt, reason }), now);

    return reply.send({
      ok: true,
      data: { corrected: true },
      error: null,
    });
  });

  // POST /api/sessions/:id/apply-discount - 할인 적용
  app.post<{
    Params: { id: string };
    Body: { discountRuleId: string; valueOverride?: number | null; reason?: string };
  }>('/:id/apply-discount', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const parsed = ApplyDiscountRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    const { discountRuleId, valueOverride, reason } = parsed.data;
    const db = getDb();
    const now = nowIso();

    const session = db.prepare(`SELECT * FROM parking_sessions WHERE id = ?`).get(id) as any;
    if (!session) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'SESSION_NOT_FOUND', message: '세션을 찾을 수 없습니다' },
      });
    }

    const rule = db.prepare(`SELECT * FROM discount_rules WHERE id = ?`).get(discountRuleId) as any;
    if (!rule) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'DISCOUNT_RULE_NOT_FOUND', message: '할인 규칙을 찾을 수 없습니다' },
      });
    }

    const user = request.user as any;
    const applicationId = generateId(ID_PREFIX.DISCOUNT_APP);
    const appliedValue = valueOverride ?? rule.value;

    db.prepare(`
      INSERT INTO discount_applications (id, session_id, discount_rule_id, applied_value, applied_by_user_id, applied_at, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(applicationId, id, discountRuleId, appliedValue, user.sub, now, reason ?? null);

    // 할인 총액 업데이트
    const totalDiscount = db.prepare(`
      SELECT SUM(applied_value) as total FROM discount_applications WHERE session_id = ?
    `).get(id) as any;

    const newDiscountTotal = totalDiscount?.total || 0;
    const newFinalFee = Math.max(0, session.raw_fee - newDiscountTotal);

    db.prepare(`
      UPDATE parking_sessions SET discount_total = ?, final_fee = ?, updated_at = ?
      WHERE id = ?
    `).run(newDiscountTotal, newFinalFee, now, id);

    // Audit
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'DISCOUNT_APPLY', 'parking_sessions', ?, ?, ?)
    `).run(generateId(ID_PREFIX.AUDIT), DEFAULT_SITE_ID, user.sub, id, JSON.stringify({ discountRuleId, appliedValue, reason }), now);

    broadcast({
      type: 'SESSION_UPDATED',
      data: { sessionId: id, discountTotal: newDiscountTotal, finalFee: newFinalFee },
    });

    return reply.send({
      ok: true,
      data: { applicationId, discountTotal: newDiscountTotal, finalFee: newFinalFee },
      error: null,
    });
  });

  // POST /api/sessions/:id/force-close - 강제 종료
  app.post<{
    Params: { id: string };
    Body: { reason: string; note?: string };
  }>('/:id/force-close', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const parsed = SessionForceCloseRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    const { reason, note } = parsed.data;
    const db = getDb();
    const now = nowIso();

    const session = db.prepare(`SELECT * FROM parking_sessions WHERE id = ?`).get(id) as any;
    if (!session) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'SESSION_NOT_FOUND', message: '세션을 찾을 수 없습니다' },
      });
    }

    if (session.status === 'CLOSED') {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'ALREADY_CLOSED', message: '이미 종료된 세션입니다' },
      });
    }

    db.prepare(`
      UPDATE parking_sessions
      SET status = 'CLOSED', close_reason = 'FORCE_CLOSE', updated_at = ?
      WHERE id = ?
    `).run(now, id);

    const user = request.user as any;
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'SESSION_FORCE_CLOSE', 'parking_sessions', ?, ?, ?)
    `).run(generateId(ID_PREFIX.AUDIT), DEFAULT_SITE_ID, user.sub, id, JSON.stringify({ reason, note }), now);

    broadcast({
      type: 'SESSION_UPDATED',
      data: { sessionId: id, status: 'CLOSED', closeReason: 'FORCE_CLOSE' },
    });

    return reply.send({
      ok: true,
      data: { closed: true },
      error: null,
    });
  });
}

function mapEvent(e: any) {
  return {
    id: e.id,
    siteId: e.site_id,
    deviceId: e.device_id,
    laneId: e.lane_id,
    direction: e.direction,
    plateNoRaw: e.plate_no_raw,
    plateNoNorm: e.plate_no_norm,
    confidence: e.confidence,
    imageUrl: e.image_url,
    capturedAt: e.captured_at,
    receivedAt: e.received_at,
    sessionId: e.session_id,
    createdAt: e.created_at,
  };
}

function mapDiscount(d: any) {
  return {
    id: d.id,
    sessionId: d.session_id,
    discountRuleId: d.discount_rule_id,
    ruleName: d.rule_name,
    ruleType: d.rule_type,
    appliedValue: d.applied_value,
    appliedByUserId: d.applied_by_user_id,
    appliedAt: d.applied_at,
    reason: d.reason,
  };
}

function mapPayment(p: any) {
  return {
    id: p.id,
    sessionId: p.session_id,
    amount: p.amount,
    method: p.method,
    status: p.status,
    pgTxId: p.pg_tx_id,
    approvedAt: p.approved_at,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}
