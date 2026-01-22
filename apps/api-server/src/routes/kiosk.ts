import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '../db/index.js';
import {
  generateId,
  ID_PREFIX,
  nowIso,
  DEFAULT_SITE_ID,
} from '@parkflow/shared';

// Fastify 인스턴스 타입 확장
declare module 'fastify' {
  interface FastifyInstance {
    authenticateKiosk: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

/**
 * 키오스크용 API
 * - API 키 인증 필요 (x-kiosk-api-key 또는 x-api-key 헤더)
 * - Rate Limiting 적용
 * - 차량번호로 세션 조회
 * - 결제 처리
 */
export async function kioskRoutes(app: FastifyInstance) {
  // 키오스크 전용 Rate Limiting 설정
  const kioskRateLimit = {
    max: parseInt(process.env.KIOSK_RATE_LIMIT || '30', 10),
    timeWindow: 60000, // 1분
    errorResponseBuilder: () => ({
      ok: false,
      data: null,
      error: { code: 'RATE_LIMIT_EXCEEDED', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
    }),
  };

  // GET /api/kiosk/lookup?plateNo=12가3456
  app.get<{
    Querystring: { plateNo: string };
  }>('/lookup', {
    preHandler: app.authenticateKiosk,
    config: { rateLimit: kioskRateLimit },
    schema: {
      tags: ['Kiosk'],
      summary: '차량번호로 세션 조회',
      description: '차량번호로 현재 주차 세션을 조회합니다. 인증 없이 접근 가능합니다.',
      querystring: {
        type: 'object',
        required: ['plateNo'],
        properties: {
          plateNo: { type: 'string', description: '차량번호' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            data: {
              type: 'object',
              nullable: true,
              properties: {
                id: { type: 'string' },
                plateNo: { type: 'string' },
                status: { type: 'string' },
                entryAt: { type: 'string' },
                exitAt: { type: 'string', nullable: true },
                rawFee: { type: 'number' },
                discountTotal: { type: 'number' },
                finalFee: { type: 'number' },
                paymentStatus: { type: 'string' },
                durationMinutes: { type: 'number' },
              },
            },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { plateNo } = request.query;

    if (!plateNo || plateNo.trim().length < 4) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'INVALID_PLATE', message: '올바른 차량번호를 입력해주세요.' },
      });
    }

    const db = getDb();

    // 최근 세션 중 PARKING, EXIT_PENDING, PAID 상태인 것을 찾음
    const session = db.prepare(`
      SELECT
        ps.*,
        COALESCE((SELECT SUM(da.applied_value) FROM discount_applications da WHERE da.session_id = ps.id), 0) as discount_total
      FROM parking_sessions ps
      WHERE ps.plate_no = ?
        AND ps.status IN ('PARKING', 'EXIT_PENDING', 'PAID')
        AND ps.site_id = ?
      ORDER BY ps.entry_at DESC
      LIMIT 1
    `).get(plateNo.trim(), DEFAULT_SITE_ID) as any;

    if (!session) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'SESSION_NOT_FOUND', message: '해당 차량의 주차 정보를 찾을 수 없습니다.' },
      });
    }

    // 주차 시간 계산
    const entryTime = new Date(session.entry_at).getTime();
    const exitTime = session.exit_at ? new Date(session.exit_at).getTime() : Date.now();
    const durationMinutes = Math.floor((exitTime - entryTime) / 1000 / 60);

    return reply.send({
      ok: true,
      data: {
        id: session.id,
        plateNo: session.plate_no,
        status: session.status,
        entryAt: session.entry_at,
        exitAt: session.exit_at,
        rawFee: session.raw_fee || 0,
        discountTotal: session.discount_total || 0,
        finalFee: session.final_fee || 0,
        paymentStatus: session.payment_status,
        durationMinutes,
      },
      error: null,
    });
  });

  // POST /api/kiosk/pay
  app.post<{
    Body: { sessionId: string; amount: number };
  }>('/pay', {
    preHandler: app.authenticateKiosk,
    config: { rateLimit: kioskRateLimit },
    schema: {
      tags: ['Kiosk'],
      summary: '키오스크 결제 처리',
      description: '키오스크에서 주차 요금을 결제합니다. API 키 인증 필요.',
      body: {
        type: 'object',
        required: ['sessionId', 'amount'],
        properties: {
          sessionId: { type: 'string', description: '세션 ID' },
          amount: { type: 'number', description: '결제 금액' },
        },
      },
    },
  }, async (request, reply) => {
    const { sessionId, amount } = request.body;
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
        error: { code: 'SESSION_NOT_FOUND', message: '세션을 찾을 수 없습니다.' },
      });
    }

    if (session.payment_status === 'PAID') {
      return reply.send({
        ok: true,
        data: { alreadyPaid: true, message: '이미 결제가 완료되었습니다.' },
        error: null,
      });
    }

    // 결제 레코드 생성
    const paymentId = generateId(ID_PREFIX.PAYMENT);

    db.prepare(`
      INSERT INTO payments (id, site_id, session_id, amount, method, status, pg_response_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'KIOSK', 'PAID', '{"mock": true, "method": "KIOSK"}', ?, ?)
    `).run(paymentId, DEFAULT_SITE_ID, sessionId, amount, now, now);

    // 세션 상태 업데이트
    db.prepare(`
      UPDATE parking_sessions
      SET payment_status = 'PAID', paid_at = ?, status = 'PAID', updated_at = ?
      WHERE id = ?
    `).run(now, now, sessionId);

    // 감사 로그
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, 'kiosk', 'KIOSK_PAYMENT', 'payments', ?, ?, ?)
    `).run(
      generateId(ID_PREFIX.AUDIT),
      DEFAULT_SITE_ID,
      paymentId,
      JSON.stringify({ sessionId, amount, plateNo: session.plate_no }),
      now
    );

    app.log.info({ paymentId, sessionId, amount, plateNo: session.plate_no }, 'Kiosk payment completed');

    return reply.send({
      ok: true,
      data: {
        paymentId,
        amount,
        paidAt: now,
        message: '결제가 완료되었습니다. 15분 이내에 출차해 주세요.',
      },
      error: null,
    });
  });
}
