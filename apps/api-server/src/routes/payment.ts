import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import {
  MockPaymentRequestSchema,
  generateId,
  ID_PREFIX,
  nowIso,
  DEFAULT_SITE_ID,
  type ApiResponse,
} from '@parkflow/shared';
import { broadcast } from '../ws/handler.js';

export async function paymentRoutes(app: FastifyInstance) {
  // POST /api/payments/mock/approve - Mock 결제 승인
  app.post<{
    Body: { sessionId: string; amount: number; method?: string };
    Reply: ApiResponse<{ paymentId: string; status: string; approvedAt: string }>;
  }>('/mock/approve', async (request, reply) => {
    const parsed = MockPaymentRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    const { sessionId, amount, method } = parsed.data;
    const db = getDb();
    const now = nowIso();

    // 세션 확인
    const session = db.prepare(`
      SELECT * FROM parking_sessions WHERE id = ?
    `).get(sessionId) as any;

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
        error: { code: 'SESSION_CLOSED', message: '이미 종료된 세션입니다' },
      });
    }

    if (session.payment_status === 'PAID') {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'ALREADY_PAID', message: '이미 결제 완료된 세션입니다' },
      });
    }

    // 결제 생성
    const paymentId = generateId(ID_PREFIX.PAYMENT);
    const mockTxId = `MOCK_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    db.prepare(`
      INSERT INTO payments (id, session_id, amount, method, status, pg_tx_id, approved_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'PAID', ?, ?, ?, ?)
    `).run(paymentId, sessionId, amount, method || 'MOCK', mockTxId, now, now, now);

    // 세션 상태 업데이트
    db.prepare(`
      UPDATE parking_sessions
      SET status = 'PAID', payment_status = 'PAID', updated_at = ?
      WHERE id = ?
    `).run(now, sessionId);

    // 출구 차로의 차단기 오픈 명령
    if (session.exit_lane_id) {
      const barrier = db.prepare(`
        SELECT id FROM devices
        WHERE lane_id = ? AND type = 'BARRIER'
        LIMIT 1
      `).get(session.exit_lane_id) as any;

      if (barrier) {
        const commandId = generateId(ID_PREFIX.BARRIER_CMD);
        db.prepare(`
          INSERT INTO barrier_commands (id, device_id, lane_id, action, reason, correlation_id, status, created_at)
          VALUES (?, ?, ?, 'OPEN', 'PAYMENT_CONFIRMED', ?, 'PENDING', ?)
        `).run(commandId, barrier.id, session.exit_lane_id, paymentId, now);

        broadcast({
          type: 'BARRIER_COMMAND',
          data: { commandId, deviceId: barrier.id, laneId: session.exit_lane_id, action: 'OPEN', reason: 'PAYMENT_CONFIRMED' },
        });
      }
    }

    broadcast({
      type: 'PAYMENT_COMPLETED',
      data: { paymentId, sessionId, amount, status: 'PAID' },
    });

    broadcast({
      type: 'SESSION_UPDATED',
      data: { sessionId, status: 'PAID', paymentStatus: 'PAID' },
    });

    return reply.send({
      ok: true,
      data: { paymentId, status: 'PAID', approvedAt: now },
      error: null,
    });
  });

  // GET /api/payments/:id
  app.get<{
    Params: { id: string };
  }>('/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();

    const payment = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(id) as any;

    if (!payment) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'PAYMENT_NOT_FOUND', message: '결제를 찾을 수 없습니다' },
      });
    }

    return reply.send({
      ok: true,
      data: {
        id: payment.id,
        sessionId: payment.session_id,
        amount: payment.amount,
        method: payment.method,
        status: payment.status,
        pgTxId: payment.pg_tx_id,
        approvedAt: payment.approved_at,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at,
      },
      error: null,
    });
  });
}
