import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import {
  LprEventRequestSchema,
  HeartbeatRequestSchema,
  BarrierCommandRequestSchema,
  generateId,
  ID_PREFIX,
  normalizePlateNo,
  nowIso,
  DEFAULT_SITE_ID,
  type ApiResponse,
  type PlateEvent,
  type BarrierCommand,
} from '@parkflow/shared';
import { calculateWithDiscounts } from '@parkflow/pricing-engine';
import { broadcast } from '../ws/handler.js';

export async function deviceRoutes(app: FastifyInstance) {
  // POST /api/device/lpr/events - LPR 이벤트 수신
  app.post<{
    Body: {
      deviceId: string;
      laneId: string;
      direction: 'ENTRY' | 'EXIT';
      plateNo: string;
      capturedAt: string;
      confidence?: number;
      imageUrl?: string;
    };
    Reply: ApiResponse<{ eventId: string; sessionId: string | null }>;
  }>('/lpr/events', {
    schema: {
      tags: ['Device'],
      summary: 'LPR 이벤트 수신',
      description: '차량 번호판 인식 이벤트를 수신합니다. 입차 시 세션 생성, 출차 시 요금 계산을 수행합니다.',
      body: {
        type: 'object',
        required: ['deviceId', 'laneId', 'direction', 'plateNo', 'capturedAt'],
        properties: {
          deviceId: { type: 'string', description: 'LPR 디바이스 ID' },
          laneId: { type: 'string', description: '차로 ID' },
          direction: { type: 'string', enum: ['ENTRY', 'EXIT'], description: '방향 (입차/출차)' },
          plateNo: { type: 'string', description: '차량 번호' },
          capturedAt: { type: 'string', format: 'date-time', description: '촬영 시간' },
          confidence: { type: 'number', description: '인식 신뢰도 (0~1)' },
          imageUrl: { type: 'string', description: '이미지 URL' },
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
                eventId: { type: 'string' },
                sessionId: { type: 'string', nullable: true },
              },
            },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const parsed = LprEventRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    const { deviceId, laneId, direction, plateNo, capturedAt, confidence, imageUrl } = parsed.data;
    const db = getDb();
    const now = nowIso();

    const plateNoNorm = normalizePlateNo(plateNo);
    const eventId = generateId(ID_PREFIX.PLATE_EVENT);

    // 1. 이벤트 저장 (항상)
    let sessionId: string | null = null;

    if (direction === 'ENTRY') {
      // 입차 처리
      // 활성 세션 확인 (PARKING 상태)
      const existingSession = db.prepare(`
        SELECT id FROM parking_sessions
        WHERE plate_no = ? AND status = 'PARKING'
      `).get(plateNoNorm) as any;

      if (!existingSession) {
        // 새 세션 생성
        sessionId = generateId(ID_PREFIX.SESSION);

        // 활성 요금제 조회
        const ratePlan = db.prepare(`
          SELECT id FROM rate_plans
          WHERE site_id = ? AND is_active = 1
          LIMIT 1
        `).get(DEFAULT_SITE_ID) as any;

        db.prepare(`
          INSERT INTO parking_sessions (
            id, site_id, entry_lane_id, plate_no, status, entry_at,
            rate_plan_id, raw_fee, discount_total, final_fee, fee_breakdown_json,
            payment_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'PARKING', ?, ?, 0, 0, 0, '{}', 'NONE', ?, ?)
        `).run(
          sessionId,
          DEFAULT_SITE_ID,
          laneId,
          plateNoNorm,
          capturedAt,
          ratePlan?.id || null,
          now,
          now
        );

        // 세션 업데이트 브로드캐스트
        broadcast({
          type: 'SESSION_UPDATED',
          data: { sessionId, status: 'PARKING', plateNo: plateNoNorm, entryAt: capturedAt },
        });
      }
      // 중복 입차인 경우 sessionId는 null로 유지 (이벤트만 기록)
    } else {
      // 출차 처리
      const session = db.prepare(`
        SELECT ps.*, rp.rules_json as rate_rules, rp.name as rate_plan_name
        FROM parking_sessions ps
        LEFT JOIN rate_plans rp ON ps.rate_plan_id = rp.id
        WHERE ps.plate_no = ? AND ps.status IN ('PARKING', 'PAID')
        ORDER BY ps.entry_at DESC
        LIMIT 1
      `).get(plateNoNorm) as any;

      if (session) {
        sessionId = session.id as string;

        // 정기권 확인
        const membership = db.prepare(`
          SELECT id FROM memberships
          WHERE plate_no = ? AND valid_from <= ? AND valid_to >= ?
        `).get(plateNoNorm, now, now) as any;

        if (membership) {
          // 정기권 차량: 바로 CLOSED 처리
          db.prepare(`
            UPDATE parking_sessions
            SET status = 'CLOSED', exit_at = ?, exit_lane_id = ?,
                final_fee = 0, close_reason = 'MEMBERSHIP_VALID', updated_at = ?
            WHERE id = ?
          `).run(capturedAt, laneId, now, sessionId);

          // 차단기 오픈 명령
          await issueBarrierOpen(db, laneId, 'MEMBERSHIP_VALID', sessionId);

          broadcast({
            type: 'SESSION_UPDATED',
            data: { sessionId, status: 'CLOSED', plateNo: plateNoNorm, finalFee: 0 },
          });
        } else if (session.status === 'PAID') {
          // 결제 완료 상태: 출차 처리
          db.prepare(`
            UPDATE parking_sessions
            SET status = 'CLOSED', exit_at = ?, exit_lane_id = ?,
                close_reason = 'NORMAL_EXIT', updated_at = ?
            WHERE id = ?
          `).run(capturedAt, laneId, now, sessionId);

          // 차단기 오픈
          await issueBarrierOpen(db, laneId, 'PAYMENT_CONFIRMED', sessionId);

          broadcast({
            type: 'SESSION_UPDATED',
            data: { sessionId, status: 'CLOSED', plateNo: plateNoNorm },
          });
        } else {
          // PARKING 상태: 요금 계산 후 EXIT_PENDING
          let rawFee = 0;
          let finalFee = 0;
          let feeBreakdown = {};

          if (session.rate_plan_id && session.rate_rules) {
            const rules = JSON.parse(session.rate_rules);
            const calcResult = calculateWithDiscounts({
              entryAt: session.entry_at,
              exitAt: capturedAt,
              ratePlan: {
                id: session.rate_plan_id,
                name: session.rate_plan_name || '기본',
                rules,
              },
            });

            rawFee = calcResult.feeCalculation.rawFee;
            finalFee = calcResult.finalFee;
            feeBreakdown = calcResult.breakdown;
          }

          // 무료 출차 확인
          if (finalFee === 0) {
            db.prepare(`
              UPDATE parking_sessions
              SET status = 'CLOSED', exit_at = ?, exit_lane_id = ?,
                  raw_fee = ?, final_fee = ?, fee_breakdown_json = ?,
                  close_reason = 'FREE_EXIT', updated_at = ?
              WHERE id = ?
            `).run(capturedAt, laneId, rawFee, finalFee, JSON.stringify(feeBreakdown), now, sessionId);

            await issueBarrierOpen(db, laneId, 'FREE_EXIT', sessionId);

            broadcast({
              type: 'SESSION_UPDATED',
              data: { sessionId, status: 'CLOSED', plateNo: plateNoNorm, finalFee: 0 },
            });
          } else {
            db.prepare(`
              UPDATE parking_sessions
              SET status = 'EXIT_PENDING', exit_at = ?, exit_lane_id = ?,
                  raw_fee = ?, final_fee = ?, fee_breakdown_json = ?, updated_at = ?
              WHERE id = ?
            `).run(capturedAt, laneId, rawFee, finalFee, JSON.stringify(feeBreakdown), now, sessionId);

            broadcast({
              type: 'SESSION_UPDATED',
              data: { sessionId, status: 'EXIT_PENDING', plateNo: plateNoNorm, finalFee },
            });
          }
        }
      }
      // 세션 없는 출차: 고아 이벤트로 기록 (sessionId = null)
    }

    // 이벤트 저장
    db.prepare(`
      INSERT INTO plate_events (
        id, site_id, device_id, lane_id, direction,
        plate_no_raw, plate_no_norm, confidence, image_url,
        captured_at, received_at, session_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      DEFAULT_SITE_ID,
      deviceId,
      laneId,
      direction,
      plateNo,
      plateNoNorm,
      confidence ?? null,
      imageUrl ?? null,
      capturedAt,
      now,
      sessionId,
      now
    );

    // 이벤트 브로드캐스트
    broadcast({
      type: 'PLATE_EVENT',
      data: { eventId, direction, plateNo: plateNoNorm, laneId, sessionId },
    });

    return reply.send({
      ok: true,
      data: { eventId, sessionId },
      error: null,
    });
  });

  // POST /api/device/heartbeat
  app.post<{
    Body: { deviceId: string; status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN'; ts: string };
    Reply: ApiResponse<{ received: boolean }>;
  }>('/heartbeat', {
    schema: {
      tags: ['Device'],
      summary: '디바이스 Heartbeat',
      description: '디바이스 상태를 업데이트합니다.',
    },
  }, async (request, reply) => {
    const parsed = HeartbeatRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    const { deviceId, status, ts } = parsed.data;
    const db = getDb();

    const result = db.prepare(`
      UPDATE devices SET status = ?, last_seen_at = ?, updated_at = ?
      WHERE id = ?
    `).run(status, ts, nowIso(), deviceId);

    if (result.changes > 0) {
      broadcast({
        type: 'DEVICE_STATUS',
        data: { deviceId, status },
      });
    }

    return reply.send({
      ok: true,
      data: { received: true },
      error: null,
    });
  });

  // POST /api/device/barrier/command
  app.post<{
    Body: {
      deviceId: string;
      laneId: string;
      action: 'OPEN' | 'CLOSE';
      reason: string;
      correlationId?: string;
    };
    Reply: ApiResponse<{ commandId: string }>;
  }>('/barrier/command', {
    schema: {
      tags: ['Device'],
      summary: '차단기 명령',
      description: '차단기를 열거나 닫는 명령을 전송합니다.',
    },
  }, async (request, reply) => {
    const parsed = BarrierCommandRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    const { deviceId, laneId, action, reason, correlationId } = parsed.data;
    const db = getDb();

    const commandId = generateId(ID_PREFIX.BARRIER_CMD);
    const now = nowIso();

    db.prepare(`
      INSERT INTO barrier_commands (
        id, device_id, lane_id, action, reason, correlation_id, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)
    `).run(commandId, deviceId, laneId, action, reason, correlationId ?? null, now);

    broadcast({
      type: 'BARRIER_COMMAND',
      data: { commandId, deviceId, laneId, action, reason },
    });

    return reply.send({
      ok: true,
      data: { commandId },
      error: null,
    });
  });
}

// Helper: 차단기 오픈 명령 발행
async function issueBarrierOpen(
  db: ReturnType<typeof getDb>,
  laneId: string,
  reason: string,
  correlationId: string
) {
  // 해당 차로의 차단기 찾기
  const barrier = db.prepare(`
    SELECT id FROM devices
    WHERE lane_id = ? AND type = 'BARRIER'
    LIMIT 1
  `).get(laneId) as any;

  if (barrier) {
    const commandId = generateId(ID_PREFIX.BARRIER_CMD);
    const now = nowIso();

    db.prepare(`
      INSERT INTO barrier_commands (
        id, device_id, lane_id, action, reason, correlation_id, status, created_at
      ) VALUES (?, ?, ?, 'OPEN', ?, ?, 'PENDING', ?)
    `).run(commandId, barrier.id, laneId, reason, correlationId, now);

    broadcast({
      type: 'BARRIER_COMMAND',
      data: { commandId, deviceId: barrier.id, laneId, action: 'OPEN', reason },
    });
  }
}
