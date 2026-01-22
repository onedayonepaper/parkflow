import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDb } from '../db/index.js';
import {
  generateId,
  ID_PREFIX,
  nowIso,
  DEFAULT_SITE_ID,
  normalizePlateNo,
  type ApiResponse,
} from '@parkflow/shared';
import { broadcast } from '../ws/handler.js';
import { getHardwareManager, type BarrierState } from '../services/hardware.js';

// Fastify 인스턴스 타입 확장
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

interface BarrierInfo {
  deviceId: string;
  name: string;
  laneId: string;
  laneName: string;
  direction: 'ENTRY' | 'EXIT';
  state: BarrierState;
  connected: boolean;
}

interface BarrierControlResult {
  deviceId: string;
  success: boolean;
  previousState: BarrierState | null;
  newState: BarrierState | null;
  error?: string;
}

export async function operationsRoutes(app: FastifyInstance) {
  // ========================================================================
  // GET /api/operations/barriers - 모든 차단기 상태 조회
  // ========================================================================
  app.get<{
    Reply: ApiResponse<{ barriers: BarrierInfo[] }>;
  }>('/barriers', {
    preHandler: app.authenticate,
    schema: {
      tags: ['Operations'],
      summary: '차단기 목록 및 상태 조회',
      description: '운영자가 제어 가능한 모든 차단기의 현재 상태를 조회합니다.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                barriers: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      deviceId: { type: 'string' },
                      name: { type: 'string' },
                      laneId: { type: 'string' },
                      laneName: { type: 'string' },
                      direction: { type: 'string', enum: ['ENTRY', 'EXIT'] },
                      state: { type: 'string', enum: ['OPEN', 'CLOSED', 'OPENING', 'CLOSING', 'ERROR', 'UNKNOWN'] },
                      connected: { type: 'boolean' },
                    },
                  },
                },
              },
            },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const hardwareManager = getHardwareManager();

    // DB에서 차단기 디바이스 정보 조회
    const devices = db.prepare(`
      SELECT d.id, d.name, d.lane_id, l.name as lane_name, l.direction
      FROM devices d
      JOIN lanes l ON d.lane_id = l.id
      WHERE d.type = 'BARRIER'
      ORDER BY l.direction DESC, l.name ASC
    `).all() as any[];

    // 하드웨어 매니저에서 상태 조회
    const hwStatuses = hardwareManager.getDeviceStatuses();

    const barriers: BarrierInfo[] = await Promise.all(
      devices.map(async (d) => {
        const hwStatus = hwStatuses.find(s => s.deviceId === d.id);
        const state = await hardwareManager.getBarrierState(d.id);

        return {
          deviceId: d.id,
          name: d.name,
          laneId: d.lane_id,
          laneName: d.lane_name,
          direction: d.direction,
          state: state || 'UNKNOWN',
          connected: hwStatus?.connected ?? false,
        };
      })
    );

    return reply.send({
      ok: true,
      data: { barriers },
      error: null,
    });
  });

  // ========================================================================
  // POST /api/operations/barriers/:deviceId/open - 차단기 열기
  // ========================================================================
  app.post<{
    Params: { deviceId: string };
    Body: { reason?: string };
    Reply: ApiResponse<BarrierControlResult>;
  }>('/barriers/:deviceId/open', {
    preHandler: app.authenticate,
    schema: {
      tags: ['Operations'],
      summary: '차단기 열기',
      description: '지정된 차단기를 수동으로 엽니다. 운영자 권한이 필요합니다.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', description: '차단기 디바이스 ID' },
        },
        required: ['deviceId'],
      },
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: '수동 제어 사유' },
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
                deviceId: { type: 'string' },
                success: { type: 'boolean' },
                previousState: { type: 'string', nullable: true },
                newState: { type: 'string', nullable: true },
                error: { type: 'string' },
              },
            },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { deviceId } = request.params;
    const { reason } = request.body || {};
    const user = (request as any).user;
    const db = getDb();
    const hardwareManager = getHardwareManager();
    const now = nowIso();

    // 디바이스 존재 확인
    const device = db.prepare(`
      SELECT d.*, l.name as lane_name FROM devices d
      LEFT JOIN lanes l ON d.lane_id = l.id
      WHERE d.id = ? AND d.type = 'BARRIER'
    `).get(deviceId) as any;

    if (!device) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'DEVICE_NOT_FOUND', message: '차단기를 찾을 수 없습니다' },
      });
    }

    // 이전 상태 조회
    const previousState = await hardwareManager.getBarrierState(deviceId);

    // 차단기 열기 명령
    const commandId = generateId(ID_PREFIX.BARRIER_CMD);
    const controlReason = reason || 'MANUAL_OPEN_BY_OPERATOR';

    // DB에 명령 저장
    db.prepare(`
      INSERT INTO barrier_commands (
        id, device_id, lane_id, action, reason, correlation_id, status, created_at
      ) VALUES (?, ?, ?, 'OPEN', ?, ?, 'PENDING', ?)
    `).run(commandId, deviceId, device.lane_id, controlReason, `op_${user?.id || 'unknown'}`, now);

    // 실제 차단기 제어
    const result = await hardwareManager.openBarrier(deviceId, commandId);

    // 명령 상태 업데이트
    db.prepare(`
      UPDATE barrier_commands SET status = ?, executed_at = ? WHERE id = ?
    `).run(result.success ? 'EXECUTED' : 'FAILED', now, commandId);

    // 새 상태 조회
    const newState = result.success ? await hardwareManager.getBarrierState(deviceId) : previousState;

    // 감사 로그 기록
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'BARRIER_MANUAL_OPEN', 'device', ?, ?, ?)
    `).run(
      generateId('audit'),
      DEFAULT_SITE_ID,
      user?.id || null,
      deviceId,
      JSON.stringify({ reason: controlReason, previousState, newState: newState, success: result.success, operator: user?.username }),
      now
    );

    // WebSocket 브로드캐스트
    broadcast({
      type: 'BARRIER_COMMAND',
      data: {
        commandId,
        deviceId,
        laneId: device.lane_id,
        action: 'OPEN',
        reason: controlReason,
        executed: result.success,
        operator: user?.username || 'unknown',
      },
    });

    return reply.send({
      ok: true,
      data: {
        deviceId,
        success: result.success,
        previousState,
        newState: newState || null,
        error: result.error,
      },
      error: null,
    });
  });

  // ========================================================================
  // POST /api/operations/barriers/:deviceId/close - 차단기 닫기
  // ========================================================================
  app.post<{
    Params: { deviceId: string };
    Body: { reason?: string };
    Reply: ApiResponse<BarrierControlResult>;
  }>('/barriers/:deviceId/close', {
    preHandler: app.authenticate,
    schema: {
      tags: ['Operations'],
      summary: '차단기 닫기',
      description: '지정된 차단기를 수동으로 닫습니다. 운영자 권한이 필요합니다.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', description: '차단기 디바이스 ID' },
        },
        required: ['deviceId'],
      },
      body: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: '수동 제어 사유' },
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
                deviceId: { type: 'string' },
                success: { type: 'boolean' },
                previousState: { type: 'string', nullable: true },
                newState: { type: 'string', nullable: true },
                error: { type: 'string' },
              },
            },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { deviceId } = request.params;
    const { reason } = request.body || {};
    const user = (request as any).user;
    const db = getDb();
    const hardwareManager = getHardwareManager();
    const now = nowIso();

    // 디바이스 존재 확인
    const device = db.prepare(`
      SELECT d.*, l.name as lane_name FROM devices d
      LEFT JOIN lanes l ON d.lane_id = l.id
      WHERE d.id = ? AND d.type = 'BARRIER'
    `).get(deviceId) as any;

    if (!device) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'DEVICE_NOT_FOUND', message: '차단기를 찾을 수 없습니다' },
      });
    }

    // 이전 상태 조회
    const previousState = await hardwareManager.getBarrierState(deviceId);

    // 차단기 닫기 명령
    const commandId = generateId(ID_PREFIX.BARRIER_CMD);
    const controlReason = reason || 'MANUAL_CLOSE_BY_OPERATOR';

    // DB에 명령 저장
    db.prepare(`
      INSERT INTO barrier_commands (
        id, device_id, lane_id, action, reason, correlation_id, status, created_at
      ) VALUES (?, ?, ?, 'CLOSE', ?, ?, 'PENDING', ?)
    `).run(commandId, deviceId, device.lane_id, controlReason, `op_${user?.id || 'unknown'}`, now);

    // 실제 차단기 제어
    const result = await hardwareManager.closeBarrier(deviceId, commandId);

    // 명령 상태 업데이트
    db.prepare(`
      UPDATE barrier_commands SET status = ?, executed_at = ? WHERE id = ?
    `).run(result.success ? 'EXECUTED' : 'FAILED', now, commandId);

    // 새 상태 조회
    const newState = result.success ? await hardwareManager.getBarrierState(deviceId) : previousState;

    // 감사 로그 기록
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'BARRIER_MANUAL_CLOSE', 'device', ?, ?, ?)
    `).run(
      generateId('audit'),
      DEFAULT_SITE_ID,
      user?.id || null,
      deviceId,
      JSON.stringify({ reason: controlReason, previousState, newState: newState, success: result.success, operator: user?.username }),
      now
    );

    // WebSocket 브로드캐스트
    broadcast({
      type: 'BARRIER_COMMAND',
      data: {
        commandId,
        deviceId,
        laneId: device.lane_id,
        action: 'CLOSE',
        reason: controlReason,
        executed: result.success,
        operator: user?.username || 'unknown',
      },
    });

    return reply.send({
      ok: true,
      data: {
        deviceId,
        success: result.success,
        previousState,
        newState: newState || null,
        error: result.error,
      },
      error: null,
    });
  });

  // ========================================================================
  // GET /api/operations/barriers/:deviceId/state - 특정 차단기 상태 조회
  // ========================================================================
  app.get<{
    Params: { deviceId: string };
  }>('/barriers/:deviceId/state', {
    preHandler: app.authenticate,
    schema: {
      tags: ['Operations'],
      summary: '차단기 상태 조회',
      description: '특정 차단기의 현재 상태를 조회합니다.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          deviceId: { type: 'string', description: '차단기 디바이스 ID' },
        },
        required: ['deviceId'],
      },
    },
  }, async (request, reply) => {
    const { deviceId } = request.params;
    const hardwareManager = getHardwareManager();
    const db = getDb();

    // 디바이스 정보 조회
    const device = db.prepare(`
      SELECT d.*, l.name as lane_name, l.direction FROM devices d
      LEFT JOIN lanes l ON d.lane_id = l.id
      WHERE d.id = ? AND d.type = 'BARRIER'
    `).get(deviceId) as any;

    if (!device) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'DEVICE_NOT_FOUND', message: '차단기를 찾을 수 없습니다' },
      });
    }

    const state = await hardwareManager.getBarrierState(deviceId);
    const hwStatuses = hardwareManager.getDeviceStatuses();
    const hwStatus = hwStatuses.find(s => s.deviceId === deviceId);

    return reply.send({
      ok: true,
      data: {
        deviceId,
        name: device.name,
        laneId: device.lane_id,
        laneName: device.lane_name,
        direction: device.direction,
        state: state || 'UNKNOWN',
        connected: hwStatus?.connected ?? false,
      },
      error: null,
    });
  });

  // ========================================================================
  // GET /api/operations/barriers/commands/recent - 최근 차단기 명령 이력
  // ========================================================================
  app.get<{
    Querystring: { limit?: number };
  }>('/barriers/commands/recent', {
    preHandler: app.authenticate,
    schema: {
      tags: ['Operations'],
      summary: '최근 차단기 명령 이력',
      description: '최근 실행된 차단기 명령 이력을 조회합니다.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 20 },
        },
      },
    },
  }, async (request, reply) => {
    const { limit = 20 } = request.query;
    const db = getDb();

    const commands = db.prepare(`
      SELECT bc.*, d.name as device_name, l.name as lane_name, l.direction
      FROM barrier_commands bc
      JOIN devices d ON bc.device_id = d.id
      LEFT JOIN lanes l ON bc.lane_id = l.id
      ORDER BY bc.created_at DESC
      LIMIT ?
    `).all(Math.min(limit, 100)) as any[];

    return reply.send({
      ok: true,
      data: {
        commands: commands.map(c => ({
          id: c.id,
          deviceId: c.device_id,
          deviceName: c.device_name,
          laneId: c.lane_id,
          laneName: c.lane_name,
          direction: c.direction,
          action: c.action,
          reason: c.reason,
          status: c.status,
          createdAt: c.created_at,
          executedAt: c.executed_at,
        })),
      },
      error: null,
    });
  });

  // ========================================================================
  // POST /api/operations/barriers/emergency-open - 긴급 전체 개방
  // ========================================================================
  app.post<{
    Body: { reason: string };
  }>('/barriers/emergency-open', {
    preHandler: app.authenticate,
    schema: {
      tags: ['Operations'],
      summary: '긴급 전체 개방',
      description: '모든 차단기를 긴급 개방합니다. 화재, 정전 등 비상 상황에서 사용합니다.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['reason'],
        properties: {
          reason: { type: 'string', description: '긴급 개방 사유' },
        },
      },
    },
  }, async (request, reply) => {
    const { reason } = request.body;
    const user = (request as any).user;
    const db = getDb();
    const hardwareManager = getHardwareManager();
    const now = nowIso();

    // 모든 차단기 조회
    const barriers = db.prepare(`
      SELECT id, name, lane_id FROM devices WHERE type = 'BARRIER'
    `).all() as any[];

    const results: { deviceId: string; name: string; success: boolean; error?: string }[] = [];

    // 모든 차단기 열기
    for (const barrier of barriers) {
      const commandId = generateId(ID_PREFIX.BARRIER_CMD);

      db.prepare(`
        INSERT INTO barrier_commands (
          id, device_id, lane_id, action, reason, correlation_id, status, created_at
        ) VALUES (?, ?, ?, 'OPEN', ?, ?, 'PENDING', ?)
      `).run(commandId, barrier.id, barrier.lane_id, `EMERGENCY: ${reason}`, `emergency_${now}`, now);

      const result = await hardwareManager.openBarrier(barrier.id, commandId);

      db.prepare(`
        UPDATE barrier_commands SET status = ?, executed_at = ? WHERE id = ?
      `).run(result.success ? 'EXECUTED' : 'FAILED', now, commandId);

      results.push({
        deviceId: barrier.id,
        name: barrier.name,
        success: result.success,
        error: result.error,
      });

      // WebSocket 브로드캐스트
      broadcast({
        type: 'BARRIER_COMMAND',
        data: {
          commandId,
          deviceId: barrier.id,
          laneId: barrier.lane_id,
          action: 'OPEN',
          reason: `EMERGENCY: ${reason}`,
          executed: result.success,
          operator: user?.username || 'unknown',
        },
      });
    }

    // 감사 로그 기록
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'EMERGENCY_OPEN_ALL', 'system', 'all_barriers', ?, ?)
    `).run(
      generateId('audit'),
      DEFAULT_SITE_ID,
      user?.id || null,
      JSON.stringify({ reason, results, operator: user?.username }),
      now
    );

    // 긴급 상황 알림 브로드캐스트
    broadcast({
      type: 'EMERGENCY_ALERT',
      data: {
        action: 'OPEN_ALL_BARRIERS',
        reason,
        operator: user?.username || 'unknown',
        timestamp: now,
        results,
      },
    });

    const successCount = results.filter(r => r.success).length;

    return reply.send({
      ok: true,
      data: {
        total: barriers.length,
        success: successCount,
        failed: barriers.length - successCount,
        results,
      },
      error: null,
    });
  });

  // ========================================================================
  // POST /api/operations/manual-entry - 수동 입차 처리
  // ========================================================================
  app.post<{
    Body: { plateNo: string; laneId?: string; note?: string };
  }>('/manual-entry', {
    preHandler: app.authenticate,
    schema: {
      tags: ['Operations'],
      summary: '수동 입차 처리',
      description: 'LPR 인식 실패 시 수동으로 입차를 등록합니다.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['plateNo'],
        properties: {
          plateNo: { type: 'string', description: '차량 번호' },
          laneId: { type: 'string', description: '입차 차로 ID (선택)' },
          note: { type: 'string', description: '비고' },
        },
      },
    },
  }, async (request, reply) => {
    const { plateNo, laneId, note } = request.body;
    const user = (request as any).user;
    const db = getDb();
    const now = nowIso();

    const plateNoNorm = normalizePlateNo(plateNo);

    // 이미 주차중인지 확인
    const existingSession = db.prepare(`
      SELECT id FROM parking_sessions
      WHERE plate_no = ? AND status = 'PARKING'
    `).get(plateNoNorm) as any;

    if (existingSession) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'ALREADY_PARKING', message: '이미 주차 중인 차량입니다' },
      });
    }

    // 활성 요금제 조회
    const ratePlan = db.prepare(`
      SELECT id FROM rate_plans
      WHERE site_id = ? AND is_active = 1
      LIMIT 1
    `).get(DEFAULT_SITE_ID) as any;

    // 세션 생성
    const sessionId = generateId(ID_PREFIX.SESSION);

    db.prepare(`
      INSERT INTO parking_sessions (
        id, site_id, entry_lane_id, plate_no, status, entry_at,
        rate_plan_id, raw_fee, discount_total, final_fee, fee_breakdown_json,
        payment_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'PARKING', ?, ?, 0, 0, 0, '{}', 'NONE', ?, ?)
    `).run(
      sessionId,
      DEFAULT_SITE_ID,
      laneId || null,
      plateNoNorm,
      now,
      ratePlan?.id || null,
      now,
      now
    );

    // 감사 로그 기록
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'MANUAL_ENTRY', 'session', ?, ?, ?)
    `).run(
      generateId('audit'),
      DEFAULT_SITE_ID,
      user?.id || null,
      sessionId,
      JSON.stringify({ plateNo: plateNoNorm, laneId, note, operator: user?.username }),
      now
    );

    // 세션 업데이트 브로드캐스트
    broadcast({
      type: 'SESSION_UPDATED',
      data: {
        sessionId,
        status: 'PARKING',
        plateNo: plateNoNorm,
        entryAt: now,
        manualEntry: true,
        operator: user?.username,
      },
    });

    return reply.send({
      ok: true,
      data: {
        sessionId,
        plateNo: plateNoNorm,
        entryAt: now,
      },
      error: null,
    });
  });

  // ========================================================================
  // POST /api/operations/manual-exit - 수동 출차 처리 (결제 오버라이드)
  // ========================================================================
  app.post<{
    Body: {
      sessionId?: string;
      plateNo?: string;
      overridePayment: boolean;
      reason: string;
      note?: string;
    };
  }>('/manual-exit', {
    preHandler: app.authenticate,
    schema: {
      tags: ['Operations'],
      summary: '수동 출차 처리',
      description: '수동으로 출차를 처리합니다. 결제 오버라이드 옵션으로 미결제 출차도 가능합니다.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['overridePayment', 'reason'],
        properties: {
          sessionId: { type: 'string', description: '세션 ID (sessionId 또는 plateNo 중 하나 필수)' },
          plateNo: { type: 'string', description: '차량 번호 (sessionId 또는 plateNo 중 하나 필수)' },
          overridePayment: { type: 'boolean', description: '결제 없이 출차 허용' },
          reason: { type: 'string', description: '수동 출차 사유' },
          note: { type: 'string', description: '비고' },
        },
      },
    },
  }, async (request, reply) => {
    const { sessionId, plateNo, overridePayment, reason, note } = request.body;
    const user = (request as any).user;
    const db = getDb();
    const hardwareManager = getHardwareManager();
    const now = nowIso();

    if (!sessionId && !plateNo) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'MISSING_PARAM', message: 'sessionId 또는 plateNo가 필요합니다' },
      });
    }

    // 세션 조회
    let session: any;
    if (sessionId) {
      session = db.prepare(`
        SELECT * FROM parking_sessions WHERE id = ? AND status IN ('PARKING', 'EXIT_PENDING')
      `).get(sessionId);
    } else {
      const plateNoNorm = normalizePlateNo(plateNo!);
      session = db.prepare(`
        SELECT * FROM parking_sessions
        WHERE plate_no = ? AND status IN ('PARKING', 'EXIT_PENDING')
        ORDER BY entry_at DESC LIMIT 1
      `).get(plateNoNorm);
    }

    if (!session) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'SESSION_NOT_FOUND', message: '활성 세션을 찾을 수 없습니다' },
      });
    }

    // 결제 오버라이드 여부에 따른 처리
    const closeReason = overridePayment ? `MANUAL_EXIT_OVERRIDE: ${reason}` : `MANUAL_EXIT: ${reason}`;
    const paymentStatus = overridePayment ? 'NONE' : session.payment_status;

    // 세션 종료
    db.prepare(`
      UPDATE parking_sessions
      SET status = 'CLOSED', exit_at = ?, close_reason = ?, payment_status = ?, updated_at = ?
      WHERE id = ?
    `).run(now, closeReason, paymentStatus, now, session.id);

    // 출차 차로의 차단기 열기
    const exitBarrier = db.prepare(`
      SELECT d.id, d.lane_id FROM devices d
      JOIN lanes l ON d.lane_id = l.id
      WHERE d.type = 'BARRIER' AND l.direction = 'EXIT'
      LIMIT 1
    `).get() as any;

    let barrierOpened = false;
    if (exitBarrier) {
      const result = await hardwareManager.openBarrier(exitBarrier.id, session.id);
      barrierOpened = result.success;

      if (result.success) {
        const commandId = generateId(ID_PREFIX.BARRIER_CMD);
        db.prepare(`
          INSERT INTO barrier_commands (
            id, device_id, lane_id, action, reason, correlation_id, status, created_at, executed_at
          ) VALUES (?, ?, ?, 'OPEN', ?, ?, 'EXECUTED', ?, ?)
        `).run(commandId, exitBarrier.id, exitBarrier.lane_id, closeReason, session.id, now, now);

        broadcast({
          type: 'BARRIER_COMMAND',
          data: {
            commandId,
            deviceId: exitBarrier.id,
            laneId: exitBarrier.lane_id,
            action: 'OPEN',
            reason: closeReason,
            executed: true,
            operator: user?.username || 'unknown',
          },
        });
      }
    }

    // 감사 로그 기록
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'MANUAL_EXIT', 'session', ?, ?, ?)
    `).run(
      generateId('audit'),
      DEFAULT_SITE_ID,
      user?.id || null,
      session.id,
      JSON.stringify({
        plateNo: session.plate_no,
        overridePayment,
        reason,
        note,
        finalFee: session.final_fee,
        operator: user?.username,
        barrierOpened,
      }),
      now
    );

    // 세션 업데이트 브로드캐스트
    broadcast({
      type: 'SESSION_UPDATED',
      data: {
        sessionId: session.id,
        status: 'CLOSED',
        plateNo: session.plate_no,
        exitAt: now,
        manualExit: true,
        overridePayment,
        operator: user?.username,
      },
    });

    return reply.send({
      ok: true,
      data: {
        sessionId: session.id,
        plateNo: session.plate_no,
        exitAt: now,
        overridePayment,
        barrierOpened,
        finalFee: session.final_fee,
      },
      error: null,
    });
  });

  // ========================================================================
  // GET /api/operations/active-sessions - 현재 활성 세션 조회 (운영자용)
  // ========================================================================
  app.get<{
    Querystring: { status?: string; limit?: number };
  }>('/active-sessions', {
    preHandler: app.authenticate,
    schema: {
      tags: ['Operations'],
      summary: '활성 세션 조회',
      description: '현재 주차 중이거나 출차 대기 중인 세션 목록을 조회합니다.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['PARKING', 'EXIT_PENDING', 'all'], default: 'all' },
          limit: { type: 'number', default: 50 },
        },
      },
    },
  }, async (request, reply) => {
    const { status = 'all', limit = 50 } = request.query;
    const db = getDb();

    let query = `
      SELECT id, plate_no, status, entry_at, exit_at, entry_lane_id, exit_lane_id,
             raw_fee, discount_total, final_fee, payment_status
      FROM parking_sessions
    `;

    if (status === 'all') {
      query += ` WHERE status IN ('PARKING', 'EXIT_PENDING')`;
    } else {
      query += ` WHERE status = ?`;
    }

    query += ` ORDER BY entry_at DESC LIMIT ?`;

    const sessions = status === 'all'
      ? db.prepare(query).all(Math.min(limit, 200)) as any[]
      : db.prepare(query).all(status, Math.min(limit, 200)) as any[];

    return reply.send({
      ok: true,
      data: {
        sessions: sessions.map(s => ({
          id: s.id,
          plateNo: s.plate_no,
          status: s.status,
          entryAt: s.entry_at,
          exitAt: s.exit_at,
          rawFee: s.raw_fee,
          discountTotal: s.discount_total,
          finalFee: s.final_fee,
          paymentStatus: s.payment_status,
        })),
        total: sessions.length,
      },
      error: null,
    });
  });
}
