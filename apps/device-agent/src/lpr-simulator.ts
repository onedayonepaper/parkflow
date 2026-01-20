import { generateRandomPlate, normalizePlateNo, nowIso, type LaneDirection } from '@parkflow/shared';
import { EventQueue } from './queue.js';

interface ApiResponse {
  ok: boolean;
  data: { eventId: string; sessionId?: string } | null;
  error: { code: string; message: string } | null;
}

export interface LprSimulatorConfig {
  deviceId: string;
  laneId: string;
  direction: LaneDirection;
  apiBase: string;
  queue: EventQueue;
}

export class LprSimulator {
  private config: LprSimulatorConfig;

  constructor(config: LprSimulatorConfig) {
    this.config = config;
  }

  /**
   * LPR 이벤트 전송
   * @param plateNo 차량번호 (없으면 랜덤 생성)
   */
  async sendEvent(plateNo?: string): Promise<void> {
    const plate = plateNo ? normalizePlateNo(plateNo) : generateRandomPlate();
    const event = {
      deviceId: this.config.deviceId,
      laneId: this.config.laneId,
      direction: this.config.direction,
      plateNo: plate,
      capturedAt: nowIso(),
      confidence: 0.85 + Math.random() * 0.15, // 0.85 ~ 1.0
    };

    console.log(`[LPR] ${this.config.direction === 'ENTRY' ? '🟢 입차' : '🔴 출차'} ${plate}`);

    try {
      const response = await fetch(`${this.config.apiBase}/api/device/lpr/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json() as ApiResponse;
      console.log(`[LPR] ✅ 전송 완료 - eventId: ${result.data?.eventId}, sessionId: ${result.data?.sessionId || 'N/A'}`);
    } catch (err) {
      console.error(`[LPR] ❌ 전송 실패:`, err);
      // 큐에 추가 (재전송용)
      this.config.queue.enqueue(event);
    }
  }

  /**
   * Heartbeat 전송
   */
  async sendHeartbeat(): Promise<void> {
    try {
      await fetch(`${this.config.apiBase}/api/device/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: this.config.deviceId,
          status: 'ONLINE',
          ts: nowIso(),
        }),
      });
    } catch (err) {
      console.error(`[LPR] Heartbeat 실패:`, err);
    }
  }
}
