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
  // GET /api/payments - 결제 목록 조회
  app.get<{
    Querystring: { page?: string; limit?: string; status?: string; method?: string; from?: string; to?: string };
  }>('/', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Payment'],
      summary: '결제 목록 조회',
      description: '결제 내역을 조회합니다. 필터링 및 페이징을 지원합니다.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', description: '페이지 번호', default: '1' },
          limit: { type: 'string', description: '페이지당 항목 수', default: '20' },
          status: { type: 'string', description: '결제 상태 필터 (PAID, CANCELLED)' },
          method: { type: 'string', description: '결제 방법 필터' },
          from: { type: 'string', description: '시작일 (ISO 8601)' },
          to: { type: 'string', description: '종료일 (ISO 8601)' },
        },
      },
    },
  }, async (request, reply) => {
    const { page = '1', limit = '20', status, method, from, to } = request.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;
    const db = getDb();

    let whereClause = '1=1';
    const params: any[] = [];

    if (status) {
      whereClause += ' AND p.status = ?';
      params.push(status);
    }
    if (method) {
      whereClause += ' AND p.method = ?';
      params.push(method);
    }
    if (from) {
      whereClause += ' AND p.created_at >= ?';
      params.push(from);
    }
    if (to) {
      whereClause += ' AND p.created_at <= ?';
      params.push(to);
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as total FROM payments p WHERE ${whereClause}
    `).get(...params) as any;
    const total = countResult?.total || 0;

    const items = db.prepare(`
      SELECT p.*, s.plate_no as plateNo
      FROM payments p
      LEFT JOIN parking_sessions s ON p.session_id = s.id
      WHERE ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offset) as any[];

    return reply.send({
      ok: true,
      data: {
        items: items.map(p => ({
          id: p.id,
          sessionId: p.session_id,
          plateNo: p.plateNo,
          amount: p.amount,
          method: p.method,
          status: p.status,
          pgTxId: p.pg_tx_id,
          approvedAt: p.approved_at,
          cancelledAt: p.cancelled_at,
          createdAt: p.created_at,
        })),
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
      error: null,
    });
  });

  // POST /api/payments/:id/cancel - 결제 취소
  app.post<{
    Params: { id: string };
    Body: { reason: string };
  }>('/:id/cancel', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Payment'],
      summary: '결제 취소',
      description: '결제를 취소합니다.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string', description: '결제 ID' } },
      },
      body: {
        type: 'object',
        required: ['reason'],
        properties: {
          reason: { type: 'string', description: '취소 사유' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { reason } = request.body;
    const db = getDb();
    const now = nowIso();

    const payment = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(id) as any;

    if (!payment) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'PAYMENT_NOT_FOUND', message: '결제를 찾을 수 없습니다' },
      });
    }

    if (payment.status === 'CANCELLED') {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'ALREADY_CANCELLED', message: '이미 취소된 결제입니다' },
      });
    }

    db.prepare(`
      UPDATE payments
      SET status = 'CANCELLED', cancel_reason = ?, cancelled_at = ?, updated_at = ?
      WHERE id = ?
    `).run(reason, now, now, id);

    // 세션 상태도 업데이트
    db.prepare(`
      UPDATE parking_sessions
      SET payment_status = 'CANCELLED', updated_at = ?
      WHERE id = ?
    `).run(now, payment.session_id);

    broadcast({
      type: 'PAYMENT_CANCELLED',
      data: { paymentId: id, sessionId: payment.session_id, reason },
    });

    return reply.send({
      ok: true,
      data: { id, status: 'CANCELLED', cancelledAt: now },
      error: null,
    });
  });

  // POST /api/payments/mock/approve - Mock 결제 승인
  app.post<{
    Body: { sessionId: string; amount: number; method?: string };
    Reply: ApiResponse<{ paymentId: string; status: string; approvedAt: string }>;
  }>('/mock/approve', {
    schema: {
      tags: ['Payment'],
      summary: 'Mock 결제 승인',
      description: '테스트용 Mock 결제를 승인합니다. 세션 상태가 PAID로 변경됩니다.',
      body: {
        type: 'object',
        required: ['sessionId', 'amount'],
        properties: {
          sessionId: { type: 'string', description: '세션 ID' },
          amount: { type: 'number', description: '결제 금액' },
          method: { type: 'string', description: '결제 방법', default: 'MOCK' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                paymentId: { type: 'string' },
                status: { type: 'string' },
                approvedAt: { type: 'string', format: 'date-time' },
              },
            },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
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
    schema: {
      tags: ['Payment'],
      summary: '결제 상세 조회',
      description: '결제 ID로 결제 상세 정보를 조회합니다.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { id: { type: 'string', description: '결제 ID' } },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                sessionId: { type: 'string' },
                amount: { type: 'number' },
                method: { type: 'string' },
                status: { type: 'string' },
                pgTxId: { type: 'string' },
                approvedAt: { type: 'string', format: 'date-time' },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
              },
            },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
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
