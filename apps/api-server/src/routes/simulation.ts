/**
 * 시뮬레이션 API
 *
 * 하드웨어 없이 시스템을 테스트할 수 있는 엔드포인트입니다.
 * 개발/테스트 환경에서만 사용하세요.
 */

import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import {
  generateId,
  ID_PREFIX,
  normalizePlateNo,
  nowIso,
  DEFAULT_SITE_ID,
  type ApiResponse,
} from '@parkflow/shared';
import { broadcast } from '../ws/handler.js';
import { getHardwareManager } from '../services/hardware.js';

// 샘플 차량 번호 목록
const SAMPLE_PLATES = [
  '12가3456', '34나5678', '56다7890', '78라1234', '90마5678',
  '11거1111', '22너2222', '33더3333', '44러4444', '55머5555',
  '서울12가3456', '경기34나5678', '인천56다7890',
];

// 랜덤 차량번호 생성
function generateRandomPlate(): string {
  const regions = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', ''];
  const chars = '가나다라마바사아자차카타파하거너더러머버서어저처커터퍼허고노도로모보소오조초코토포호구누두루무부수우주추쿠투푸후';

  const region = regions[Math.floor(Math.random() * regions.length)];
  const num1 = Math.floor(Math.random() * 90) + 10;
  const char = chars[Math.floor(Math.random() * chars.length)];
  const num2 = Math.floor(Math.random() * 9000) + 1000;

  return `${region}${num1}${char}${num2}`;
}

export async function simulationRoutes(app: FastifyInstance) {

  // POST /api/simulation/entry - 입차 시뮬레이션
  app.post<{
    Body: {
      plateNo?: string;
      laneId?: string;
      random?: boolean;
    };
    Reply: ApiResponse<{
      eventId: string;
      sessionId: string | null;
      plateNo: string;
      message: string;
    }>;
  }>('/entry', {
    schema: {
      tags: ['Simulation'],
      summary: '입차 시뮬레이션',
      description: '가상의 차량 입차 이벤트를 생성합니다.',
      body: {
        type: 'object',
        properties: {
          plateNo: { type: 'string', description: '차량 번호 (미입력시 랜덤)' },
          laneId: { type: 'string', description: '차로 ID (미입력시 기본 입차 차로)' },
          random: { type: 'boolean', description: '랜덤 차량번호 사용', default: false },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { plateNo: inputPlate, laneId: inputLane, random } = request.body;

    // 차로 결정
    let laneId: string = inputLane || '';
    if (!laneId) {
      const entryLane = db.prepare(`
        SELECT id FROM lanes WHERE direction = 'ENTRY' LIMIT 1
      `).get() as any;
      laneId = entryLane?.id || 'lane_entry';
    }

    // 차량번호 결정
    let plateNo: string;
    if (random || !inputPlate) {
      plateNo = generateRandomPlate();
    } else {
      plateNo = inputPlate;
    }

    const plateNoNorm = normalizePlateNo(plateNo);
    const now = nowIso();
    const eventId = generateId(ID_PREFIX.PLATE_EVENT);

    // LPR 디바이스 찾기
    const lprDevice = db.prepare(`
      SELECT id FROM devices WHERE lane_id = ? AND type = 'LPR' LIMIT 1
    `).get(laneId) as any;
    const deviceId = lprDevice?.id || 'lpr_sim';

    // 블랙리스트 확인
    const blacklisted = db.prepare(`
      SELECT id, reason FROM blacklist
      WHERE plate_no = ? AND is_active = 1 AND (blocked_until IS NULL OR blocked_until > ?)
    `).get(plateNoNorm, now) as any;

    if (blacklisted) {
      // 이벤트 기록
      db.prepare(`
        INSERT INTO plate_events (
          id, site_id, device_id, lane_id, direction,
          plate_no_raw, plate_no_norm, confidence, captured_at, received_at, session_id, created_at
        ) VALUES (?, ?, ?, ?, 'ENTRY', ?, ?, 0.95, ?, ?, NULL, ?)
      `).run(eventId, DEFAULT_SITE_ID, deviceId, laneId, plateNo, plateNoNorm, now, now, now);

      broadcast({
        type: 'BLACKLIST_ALERT',
        data: { plateNo: plateNoNorm, reason: blacklisted.reason, laneId },
      });

      return reply.send({
        ok: true,
        data: {
          eventId,
          sessionId: null,
          plateNo: plateNoNorm,
          message: `⛔ 블랙리스트 차량 - ${blacklisted.reason}`,
        },
        error: null,
      });
    }

    // VIP 확인
    const vipEntry = db.prepare(`
      SELECT id, name FROM vip_whitelist WHERE plate_no = ? AND is_active = 1
    `).get(plateNoNorm) as any;

    // 정기권 확인
    const membership = db.prepare(`
      SELECT id, member_name FROM memberships
      WHERE plate_no = ? AND valid_from <= ? AND valid_to >= ?
    `).get(plateNoNorm, now, now) as any;

    // 세션 생성
    const sessionId = generateId(ID_PREFIX.SESSION);
    const ratePlan = db.prepare(`
      SELECT id FROM rate_plans WHERE site_id = ? AND is_active = 1 LIMIT 1
    `).get(DEFAULT_SITE_ID) as any;

    db.prepare(`
      INSERT INTO parking_sessions (
        id, site_id, entry_lane_id, plate_no, status, entry_at,
        rate_plan_id, raw_fee, discount_total, final_fee, fee_breakdown_json,
        payment_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'PARKING', ?, ?, 0, 0, 0, '{}', 'NONE', ?, ?)
    `).run(sessionId, DEFAULT_SITE_ID, laneId, plateNoNorm, now, ratePlan?.id || null, now, now);

    // 이벤트 기록
    db.prepare(`
      INSERT INTO plate_events (
        id, site_id, device_id, lane_id, direction,
        plate_no_raw, plate_no_norm, confidence, captured_at, received_at, session_id, created_at
      ) VALUES (?, ?, ?, ?, 'ENTRY', ?, ?, 0.95, ?, ?, ?, ?)
    `).run(eventId, DEFAULT_SITE_ID, deviceId, laneId, plateNo, plateNoNorm, now, now, sessionId, now);

    // 차단기 열기 (VIP 또는 정기권)
    let message = `🚗 입차 완료: ${plateNoNorm}`;
    if (vipEntry) {
      message = `👑 VIP 입차: ${plateNoNorm} (${vipEntry.name || 'VIP'})`;
      await openBarrierForLane(db, laneId, 'VIP_ENTRY', sessionId);
    } else if (membership) {
      message = `🎟️ 정기권 입차: ${plateNoNorm} (${membership.member_name || '정기권'})`;
      await openBarrierForLane(db, laneId, 'MEMBERSHIP_ENTRY', sessionId);
    }

    broadcast({
      type: 'SESSION_UPDATED',
      data: {
        sessionId,
        status: 'PARKING',
        plateNo: plateNoNorm,
        entryAt: now,
        isVip: !!vipEntry,
        isMember: !!membership,
      },
    });

    broadcast({
      type: 'PLATE_EVENT',
      data: { eventId, direction: 'ENTRY', plateNo: plateNoNorm, laneId, sessionId },
    });

    return reply.send({
      ok: true,
      data: { eventId, sessionId, plateNo: plateNoNorm, message },
      error: null,
    });
  });

  // POST /api/simulation/exit - 출차 시뮬레이션
  app.post<{
    Body: {
      plateNo?: string;
      sessionId?: string;
      laneId?: string;
    };
    Reply: ApiResponse<{
      eventId: string;
      sessionId: string | null;
      plateNo: string;
      fee: number;
      status: string;
      message: string;
    }>;
  }>('/exit', {
    schema: {
      tags: ['Simulation'],
      summary: '출차 시뮬레이션',
      description: '가상의 차량 출차 이벤트를 생성합니다.',
      body: {
        type: 'object',
        properties: {
          plateNo: { type: 'string', description: '차량 번호' },
          sessionId: { type: 'string', description: '세션 ID (차량번호 대신 사용 가능)' },
          laneId: { type: 'string', description: '차로 ID' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { plateNo: inputPlate, sessionId: inputSession, laneId: inputLane } = request.body;
    const now = nowIso();

    // 차로 결정
    let laneId: string = inputLane || '';
    if (!laneId) {
      const exitLane = db.prepare(`
        SELECT id FROM lanes WHERE direction = 'EXIT' LIMIT 1
      `).get() as any;
      laneId = exitLane?.id || 'lane_exit';
    }

    // 세션 찾기
    let session: any;
    if (inputSession) {
      session = db.prepare(`
        SELECT ps.*, rp.rules_json as rate_rules, rp.name as rate_plan_name
        FROM parking_sessions ps
        LEFT JOIN rate_plans rp ON ps.rate_plan_id = rp.id
        WHERE ps.id = ? AND ps.status IN ('PARKING', 'PAID')
      `).get(inputSession);
    } else if (inputPlate) {
      const plateNoNorm = normalizePlateNo(inputPlate);
      session = db.prepare(`
        SELECT ps.*, rp.rules_json as rate_rules, rp.name as rate_plan_name
        FROM parking_sessions ps
        LEFT JOIN rate_plans rp ON ps.rate_plan_id = rp.id
        WHERE ps.plate_no = ? AND ps.status IN ('PARKING', 'PAID')
        ORDER BY ps.entry_at DESC LIMIT 1
      `).get(plateNoNorm);
    } else {
      // 가장 오래된 주차 중인 세션
      session = db.prepare(`
        SELECT ps.*, rp.rules_json as rate_rules, rp.name as rate_plan_name
        FROM parking_sessions ps
        LEFT JOIN rate_plans rp ON ps.rate_plan_id = rp.id
        WHERE ps.status = 'PARKING'
        ORDER BY ps.entry_at ASC LIMIT 1
      `).get();
    }

    if (!session) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'SESSION_NOT_FOUND', message: '주차 중인 세션을 찾을 수 없습니다.' },
      });
    }

    const plateNoNorm = session.plate_no;
    const sessionId = session.id;
    const eventId = generateId(ID_PREFIX.PLATE_EVENT);

    // LPR 디바이스 찾기
    const lprDevice = db.prepare(`
      SELECT id FROM devices WHERE lane_id = ? AND type = 'LPR' LIMIT 1
    `).get(laneId) as any;
    const deviceId = lprDevice?.id || 'lpr_sim';

    // VIP 확인
    const vipEntry = db.prepare(`
      SELECT id, name FROM vip_whitelist WHERE plate_no = ? AND is_active = 1
    `).get(plateNoNorm) as any;

    // 정기권 확인
    const membership = db.prepare(`
      SELECT id FROM memberships WHERE plate_no = ? AND valid_from <= ? AND valid_to >= ?
    `).get(plateNoNorm, now, now) as any;

    let finalFee = 0;
    let status = 'CLOSED';
    let message = '';
    let closeReason = '';

    if (vipEntry) {
      // VIP: 무료 출차
      closeReason = 'VIP_FREE_EXIT';
      message = `👑 VIP 무료 출차: ${plateNoNorm}`;
      await openBarrierForLane(db, laneId, 'VIP_FREE_EXIT', sessionId);
    } else if (membership) {
      // 정기권: 무료 출차
      closeReason = 'MEMBERSHIP_VALID';
      message = `🎟️ 정기권 무료 출차: ${plateNoNorm}`;
      await openBarrierForLane(db, laneId, 'MEMBERSHIP_VALID', sessionId);
    } else if (session.status === 'PAID') {
      // 결제 완료 상태
      closeReason = 'NORMAL_EXIT';
      finalFee = session.final_fee;
      message = `✅ 결제 완료 출차: ${plateNoNorm} (${finalFee.toLocaleString()}원)`;
      await openBarrierForLane(db, laneId, 'PAYMENT_CONFIRMED', sessionId);
    } else {
      // 요금 계산
      const { calculateWithDiscounts } = await import('@parkflow/pricing-engine');

      if (session.rate_plan_id && session.rate_rules) {
        const rules = JSON.parse(session.rate_rules);
        const calcResult = calculateWithDiscounts({
          entryAt: session.entry_at,
          exitAt: now,
          ratePlan: { id: session.rate_plan_id, name: session.rate_plan_name || '기본', rules },
        });
        finalFee = calcResult.finalFee;
      }

      if (finalFee === 0) {
        // 무료 (grace period 등)
        closeReason = 'FREE_EXIT';
        message = `🆓 무료 출차: ${plateNoNorm}`;
        await openBarrierForLane(db, laneId, 'FREE_EXIT', sessionId);
      } else {
        // 결제 대기
        status = 'EXIT_PENDING';
        closeReason = '';
        message = `💰 결제 대기: ${plateNoNorm} (${finalFee.toLocaleString()}원)`;
      }
    }

    // 세션 업데이트
    if (status === 'CLOSED') {
      db.prepare(`
        UPDATE parking_sessions
        SET status = 'CLOSED', exit_at = ?, exit_lane_id = ?, final_fee = ?, close_reason = ?, updated_at = ?
        WHERE id = ?
      `).run(now, laneId, finalFee, closeReason, now, sessionId);
    } else {
      db.prepare(`
        UPDATE parking_sessions
        SET status = 'EXIT_PENDING', exit_at = ?, exit_lane_id = ?, final_fee = ?, updated_at = ?
        WHERE id = ?
      `).run(now, laneId, finalFee, now, sessionId);
    }

    // 이벤트 기록
    db.prepare(`
      INSERT INTO plate_events (
        id, site_id, device_id, lane_id, direction,
        plate_no_raw, plate_no_norm, confidence, captured_at, received_at, session_id, created_at
      ) VALUES (?, ?, ?, ?, 'EXIT', ?, ?, 0.95, ?, ?, ?, ?)
    `).run(eventId, DEFAULT_SITE_ID, deviceId, laneId, plateNoNorm, plateNoNorm, now, now, sessionId, now);

    broadcast({
      type: 'SESSION_UPDATED',
      data: { sessionId, status, plateNo: plateNoNorm, finalFee },
    });

    broadcast({
      type: 'PLATE_EVENT',
      data: { eventId, direction: 'EXIT', plateNo: plateNoNorm, laneId, sessionId },
    });

    return reply.send({
      ok: true,
      data: { eventId, sessionId, plateNo: plateNoNorm, fee: finalFee, status, message },
      error: null,
    });
  });

  // POST /api/simulation/barrier - 차단기 수동 제어
  app.post<{
    Body: {
      laneId?: string;
      deviceId?: string;
      action: 'OPEN' | 'CLOSE';
    };
    Reply: ApiResponse<{ success: boolean; message: string }>;
  }>('/barrier', {
    schema: {
      tags: ['Simulation'],
      summary: '차단기 수동 제어',
      description: '차단기를 수동으로 열거나 닫습니다.',
    },
  }, async (request, reply) => {
    const db = getDb();
    const { laneId, deviceId, action } = request.body;

    let barrierDeviceId = deviceId;
    if (!barrierDeviceId && laneId) {
      const barrier = db.prepare(`
        SELECT id FROM devices WHERE lane_id = ? AND type = 'BARRIER' LIMIT 1
      `).get(laneId) as any;
      barrierDeviceId = barrier?.id;
    }

    if (!barrierDeviceId) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'DEVICE_NOT_FOUND', message: '차단기를 찾을 수 없습니다.' },
      });
    }

    const hardwareManager = getHardwareManager();
    let result;

    if (action === 'OPEN') {
      result = await hardwareManager.openBarrier(barrierDeviceId, `manual_${Date.now()}`);
    } else {
      result = await hardwareManager.closeBarrier(barrierDeviceId, `manual_${Date.now()}`);
    }

    return reply.send({
      ok: true,
      data: {
        success: result.success,
        message: result.success
          ? `차단기 ${action === 'OPEN' ? '열림' : '닫힘'} 완료`
          : result.error || '차단기 제어 실패',
      },
      error: null,
    });
  });

  // GET /api/simulation/parking - 현재 주차 중인 차량 목록
  app.get<{
    Reply: ApiResponse<{
      items: Array<{
        sessionId: string;
        plateNo: string;
        entryAt: string;
        duration: number;
        isVip: boolean;
        isMember: boolean;
      }>;
      total: number;
    }>;
  }>('/parking', {
    schema: {
      tags: ['Simulation'],
      summary: '주차 중인 차량 목록',
      description: '현재 주차 중인 차량 목록을 조회합니다.',
    },
  }, async (request, reply) => {
    const db = getDb();
    const now = new Date();

    const sessions = db.prepare(`
      SELECT id, plate_no, entry_at FROM parking_sessions
      WHERE status = 'PARKING'
      ORDER BY entry_at DESC
    `).all() as any[];

    const items = await Promise.all(sessions.map(async (s) => {
      const entryAt = new Date(s.entry_at);
      const duration = Math.floor((now.getTime() - entryAt.getTime()) / 60000); // minutes

      const vip = db.prepare(`
        SELECT id FROM vip_whitelist WHERE plate_no = ? AND is_active = 1
      `).get(s.plate_no) as any;

      const member = db.prepare(`
        SELECT id FROM memberships WHERE plate_no = ? AND valid_from <= ? AND valid_to >= ?
      `).get(s.plate_no, nowIso(), nowIso()) as any;

      return {
        sessionId: s.id,
        plateNo: s.plate_no,
        entryAt: s.entry_at,
        duration,
        isVip: !!vip,
        isMember: !!member,
      };
    }));

    return reply.send({
      ok: true,
      data: { items, total: items.length },
      error: null,
    });
  });

  // POST /api/simulation/bulk-entry - 대량 입차 시뮬레이션
  app.post<{
    Body: { count: number };
    Reply: ApiResponse<{ created: number; plates: string[] }>;
  }>('/bulk-entry', {
    schema: {
      tags: ['Simulation'],
      summary: '대량 입차 시뮬레이션',
      description: '여러 대의 차량을 한 번에 입차시킵니다.',
    },
  }, async (request, reply) => {
    const { count } = request.body;
    const maxCount = Math.min(count || 5, 50);
    const plates: string[] = [];

    for (let i = 0; i < maxCount; i++) {
      const plateNo = generateRandomPlate();

      // 내부적으로 입차 처리
      const result = await app.inject({
        method: 'POST',
        url: '/api/simulation/entry',
        payload: { plateNo },
      });

      if (result.statusCode === 200) {
        plates.push(plateNo);
      }
    }

    return reply.send({
      ok: true,
      data: { created: plates.length, plates },
      error: null,
    });
  });
}

// Helper: 차로 ID로 차단기 열기
async function openBarrierForLane(
  db: ReturnType<typeof getDb>,
  laneId: string,
  reason: string,
  correlationId: string
) {
  const barrier = db.prepare(`
    SELECT id FROM devices WHERE lane_id = ? AND type = 'BARRIER' LIMIT 1
  `).get(laneId) as any;

  if (barrier) {
    const hardwareManager = getHardwareManager();
    await hardwareManager.openBarrier(barrier.id, correlationId);

    broadcast({
      type: 'BARRIER_COMMAND',
      data: { deviceId: barrier.id, laneId, action: 'OPEN', reason },
    });
  }
}
