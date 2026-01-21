/**
 * 하드웨어 추상화 서비스
 *
 * 차단기, LPR 카메라 등 주차장 하드웨어 장비와의 통신을 담당합니다.
 * 실제 하드웨어 연동 시 각 프로토콜에 맞게 구현을 추가합니다.
 */

import { getDb } from '../db/index.js';
import { nowIso, generateId, ID_PREFIX } from '@parkflow/shared';
import { broadcast } from '../ws/handler.js';

// ============ 타입 정의 ============

export type DeviceProtocol = 'HTTP' | 'TCP' | 'SERIAL' | 'MODBUS' | 'MOCK';
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'ERROR';
export type BarrierState = 'OPEN' | 'CLOSED' | 'OPENING' | 'CLOSING' | 'ERROR' | 'UNKNOWN';

export interface DeviceConfig {
  id: string;
  type: 'LPR' | 'BARRIER' | 'KIOSK';
  protocol: DeviceProtocol;
  host?: string;
  port?: number;
  serialPath?: string;
  baudRate?: number;
  timeout?: number;
  retryCount?: number;
  retryDelay?: number;
}

export interface BarrierCommandResult {
  success: boolean;
  commandId: string;
  executedAt?: string;
  error?: string;
  state?: BarrierState;
}

export interface LPRConfig extends DeviceConfig {
  type: 'LPR';
  recognitionMode?: 'AUTO' | 'MANUAL';
  minConfidence?: number;
}

export interface BarrierConfig extends DeviceConfig {
  type: 'BARRIER';
  openDuration?: number; // ms
  closeDelay?: number;   // ms
  safetyTimeout?: number; // ms
}

// ============ 기본 하드웨어 인터페이스 ============

export interface IBarrierController {
  open(correlationId?: string): Promise<BarrierCommandResult>;
  close(correlationId?: string): Promise<BarrierCommandResult>;
  getState(): Promise<BarrierState>;
  isConnected(): boolean;
}

export interface ILPRController {
  startRecognition(): Promise<void>;
  stopRecognition(): Promise<void>;
  isConnected(): boolean;
  getLastCapture(): Promise<{ plateNo: string; confidence: number; imageUrl?: string } | null>;
}

// ============ Mock 구현 (개발/테스트용) ============

export class MockBarrierController implements IBarrierController {
  private deviceId: string;
  private laneId: string;
  private state: BarrierState = 'CLOSED';
  private connected: boolean = true;

  constructor(deviceId: string, laneId: string) {
    this.deviceId = deviceId;
    this.laneId = laneId;
    console.log(`[MockBarrier] 초기화: ${deviceId} (차로: ${laneId})`);
  }

  async open(correlationId?: string): Promise<BarrierCommandResult> {
    const commandId = generateId(ID_PREFIX.BARRIER_CMD);
    const now = nowIso();

    console.log(`[MockBarrier] ${this.deviceId} 열림 명령 실행`);

    // 시뮬레이션 딜레이
    this.state = 'OPENING';
    await this.simulateDelay(500);
    this.state = 'OPEN';

    // DB 업데이트
    const db = getDb();
    db.prepare(`
      UPDATE barrier_commands
      SET status = 'EXECUTED', executed_at = ?
      WHERE correlation_id = ? AND status = 'PENDING'
    `).run(now, correlationId);

    // 자동 닫힘 (5초 후)
    setTimeout(() => {
      this.autoClose();
    }, 5000);

    broadcast({
      type: 'BARRIER_STATE',
      data: { deviceId: this.deviceId, laneId: this.laneId, state: this.state },
    });

    return {
      success: true,
      commandId,
      executedAt: now,
      state: this.state,
    };
  }

  async close(correlationId?: string): Promise<BarrierCommandResult> {
    const commandId = generateId(ID_PREFIX.BARRIER_CMD);
    const now = nowIso();

    console.log(`[MockBarrier] ${this.deviceId} 닫힘 명령 실행`);

    this.state = 'CLOSING';
    await this.simulateDelay(500);
    this.state = 'CLOSED';

    broadcast({
      type: 'BARRIER_STATE',
      data: { deviceId: this.deviceId, laneId: this.laneId, state: this.state },
    });

    return {
      success: true,
      commandId,
      executedAt: now,
      state: this.state,
    };
  }

  async getState(): Promise<BarrierState> {
    return this.state;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private async autoClose(): Promise<void> {
    if (this.state === 'OPEN') {
      console.log(`[MockBarrier] ${this.deviceId} 자동 닫힘`);
      this.state = 'CLOSING';
      await this.simulateDelay(500);
      this.state = 'CLOSED';

      broadcast({
        type: 'BARRIER_STATE',
        data: { deviceId: this.deviceId, laneId: this.laneId, state: this.state },
      });
    }
  }

  private simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============ HTTP 기반 차단기 컨트롤러 ============

export class HttpBarrierController implements IBarrierController {
  private config: BarrierConfig;
  private connected: boolean = false;
  private state: BarrierState = 'UNKNOWN';

  constructor(config: BarrierConfig) {
    this.config = {
      timeout: 5000,
      retryCount: 3,
      retryDelay: 1000,
      openDuration: 5000,
      closeDelay: 1000,
      ...config,
    };
    this.checkConnection();
  }

  private async checkConnection(): Promise<void> {
    try {
      const response = await fetch(`http://${this.config.host}:${this.config.port}/status`, {
        method: 'GET',
        signal: AbortSignal.timeout(this.config.timeout!),
      });
      this.connected = response.ok;
      if (response.ok) {
        const data = await response.json();
        this.state = data.state || 'UNKNOWN';
      }
    } catch (error) {
      this.connected = false;
      console.error(`[HttpBarrier] ${this.config.id} 연결 실패:`, error);
    }
  }

  async open(correlationId?: string): Promise<BarrierCommandResult> {
    const commandId = generateId(ID_PREFIX.BARRIER_CMD);

    for (let attempt = 1; attempt <= (this.config.retryCount || 3); attempt++) {
      try {
        const response = await fetch(`http://${this.config.host}:${this.config.port}/control/open`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ commandId, correlationId }),
          signal: AbortSignal.timeout(this.config.timeout!),
        });

        if (response.ok) {
          const data = await response.json();
          this.state = 'OPEN';
          this.connected = true;

          // DB 업데이트
          const db = getDb();
          const now = nowIso();
          db.prepare(`
            UPDATE barrier_commands
            SET status = 'EXECUTED', executed_at = ?
            WHERE correlation_id = ? AND status = 'PENDING'
          `).run(now, correlationId);

          broadcast({
            type: 'BARRIER_STATE',
            data: { deviceId: this.config.id, state: this.state },
          });

          return {
            success: true,
            commandId,
            executedAt: now,
            state: this.state,
          };
        }
      } catch (error) {
        console.error(`[HttpBarrier] ${this.config.id} 열림 명령 실패 (시도 ${attempt}):`, error);
        if (attempt < (this.config.retryCount || 3)) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }

    // 실패 처리
    const db = getDb();
    const now = nowIso();
    db.prepare(`
      UPDATE barrier_commands
      SET status = 'FAILED', executed_at = ?
      WHERE correlation_id = ? AND status = 'PENDING'
    `).run(now, correlationId);

    return {
      success: false,
      commandId,
      error: '차단기 열림 명령 실패',
    };
  }

  async close(correlationId?: string): Promise<BarrierCommandResult> {
    const commandId = generateId(ID_PREFIX.BARRIER_CMD);

    try {
      const response = await fetch(`http://${this.config.host}:${this.config.port}/control/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandId, correlationId }),
        signal: AbortSignal.timeout(this.config.timeout!),
      });

      if (response.ok) {
        this.state = 'CLOSED';
        return {
          success: true,
          commandId,
          executedAt: nowIso(),
          state: this.state,
        };
      }
    } catch (error) {
      console.error(`[HttpBarrier] ${this.config.id} 닫힘 명령 실패:`, error);
    }

    return {
      success: false,
      commandId,
      error: '차단기 닫힘 명령 실패',
    };
  }

  async getState(): Promise<BarrierState> {
    await this.checkConnection();
    return this.state;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

// ============ 하드웨어 매니저 ============

class HardwareManager {
  private barriers: Map<string, IBarrierController> = new Map();
  private deviceConfigs: Map<string, DeviceConfig> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;

  /**
   * 디바이스 초기화
   */
  async initialize(): Promise<void> {
    console.log('[HardwareManager] 초기화 시작...');

    const db = getDb();
    const devices = db.prepare(`
      SELECT d.*, l.name as lane_name, l.direction
      FROM devices d
      LEFT JOIN lanes l ON d.lane_id = l.id
      WHERE d.type IN ('BARRIER', 'LPR')
    `).all() as any[];

    for (const device of devices) {
      try {
        const config = device.config_json ? JSON.parse(device.config_json) : {};

        if (device.type === 'BARRIER') {
          const barrierConfig: BarrierConfig = {
            id: device.id,
            type: 'BARRIER',
            protocol: config.protocol || 'MOCK',
            host: config.host,
            port: config.port,
            timeout: config.timeout || 5000,
            openDuration: config.openDuration || 5000,
            ...config,
          };

          this.registerBarrier(device.id, device.lane_id, barrierConfig);
        }

        this.deviceConfigs.set(device.id, {
          id: device.id,
          type: device.type,
          protocol: config.protocol || 'MOCK',
          ...config,
        });
      } catch (error) {
        console.error(`[HardwareManager] 디바이스 ${device.id} 초기화 실패:`, error);
      }
    }

    // 상태 모니터링 시작
    this.startMonitoring();

    console.log(`[HardwareManager] 초기화 완료: ${this.barriers.size}개 차단기 등록`);
  }

  /**
   * 차단기 등록
   */
  registerBarrier(deviceId: string, laneId: string, config: BarrierConfig): void {
    let controller: IBarrierController;

    switch (config.protocol) {
      case 'HTTP':
        controller = new HttpBarrierController(config);
        break;
      case 'MOCK':
      default:
        controller = new MockBarrierController(deviceId, laneId);
        break;
    }

    this.barriers.set(deviceId, controller);
    console.log(`[HardwareManager] 차단기 등록: ${deviceId} (${config.protocol})`);
  }

  /**
   * 차단기 열기
   */
  async openBarrier(deviceId: string, correlationId?: string): Promise<BarrierCommandResult> {
    const controller = this.barriers.get(deviceId);

    if (!controller) {
      console.warn(`[HardwareManager] 차단기를 찾을 수 없음: ${deviceId}`);
      return {
        success: false,
        commandId: '',
        error: '차단기를 찾을 수 없습니다',
      };
    }

    return controller.open(correlationId);
  }

  /**
   * 차단기 닫기
   */
  async closeBarrier(deviceId: string, correlationId?: string): Promise<BarrierCommandResult> {
    const controller = this.barriers.get(deviceId);

    if (!controller) {
      return {
        success: false,
        commandId: '',
        error: '차단기를 찾을 수 없습니다',
      };
    }

    return controller.close(correlationId);
  }

  /**
   * 차로 ID로 차단기 열기
   */
  async openBarrierByLane(laneId: string, correlationId?: string): Promise<BarrierCommandResult> {
    const db = getDb();
    const barrier = db.prepare(`
      SELECT id FROM devices WHERE lane_id = ? AND type = 'BARRIER' LIMIT 1
    `).get(laneId) as any;

    if (!barrier) {
      return {
        success: false,
        commandId: '',
        error: '해당 차로의 차단기를 찾을 수 없습니다',
      };
    }

    return this.openBarrier(barrier.id, correlationId);
  }

  /**
   * 차단기 상태 조회
   */
  async getBarrierState(deviceId: string): Promise<BarrierState | null> {
    const controller = this.barriers.get(deviceId);
    if (!controller) return null;
    return controller.getState();
  }

  /**
   * 모든 디바이스 상태 조회
   */
  getDeviceStatuses(): Array<{ deviceId: string; connected: boolean; type: string }> {
    const statuses: Array<{ deviceId: string; connected: boolean; type: string }> = [];

    this.barriers.forEach((controller, deviceId) => {
      statuses.push({
        deviceId,
        connected: controller.isConnected(),
        type: 'BARRIER',
      });
    });

    return statuses;
  }

  /**
   * 상태 모니터링 시작
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(async () => {
      const db = getDb();
      const now = nowIso();

      for (const [deviceId, controller] of this.barriers) {
        const connected = controller.isConnected();
        const status = connected ? 'ONLINE' : 'OFFLINE';

        db.prepare(`
          UPDATE devices SET status = ?, last_seen_at = ?, updated_at = ?
          WHERE id = ?
        `).run(status, now, now, deviceId);
      }
    }, 30000); // 30초마다 체크
  }

  /**
   * 종료
   */
  shutdown(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.barriers.clear();
    console.log('[HardwareManager] 종료');
  }
}

// 싱글톤 인스턴스
let hardwareManager: HardwareManager | null = null;

export function getHardwareManager(): HardwareManager {
  if (!hardwareManager) {
    hardwareManager = new HardwareManager();
  }
  return hardwareManager;
}

export async function initializeHardware(): Promise<void> {
  const manager = getHardwareManager();
  await manager.initialize();
}

export function shutdownHardware(): void {
  if (hardwareManager) {
    hardwareManager.shutdown();
    hardwareManager = null;
  }
}
