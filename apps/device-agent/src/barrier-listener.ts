import WebSocket from 'ws';

export interface BarrierListenerConfig {
  deviceId: string;
  laneId: string;
  wsUrl: string;
}

export class BarrierListener {
  private config: BarrierListenerConfig;
  private ws: WebSocket | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(config: BarrierListenerConfig) {
    this.config = config;
  }

  connect(): void {
    try {
      this.ws = new WebSocket(this.config.wsUrl);

      this.ws.on('open', () => {
        console.log(`[BARRIER] ${this.config.deviceId} WebSocket 연결됨`);
      });

      this.ws.on('message', (data: WebSocket.RawData) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (err) {
          console.error('[BARRIER] 메시지 파싱 실패:', err);
        }
      });

      this.ws.on('close', () => {
        console.log(`[BARRIER] ${this.config.deviceId} 연결 종료, 재연결 예정...`);
        this.scheduleReconnect();
      });

      this.ws.on('error', (err: Error) => {
        console.error(`[BARRIER] ${this.config.deviceId} 에러:`, err.message);
      });
    } catch (err) {
      console.error('[BARRIER] 연결 실패:', err);
      this.scheduleReconnect();
    }
  }

  private handleMessage(message: { type: string; data: any }): void {
    if (message.type === 'BARRIER_COMMAND') {
      const { deviceId, laneId, action, reason, commandId } = message.data;

      // 이 차단기에 대한 명령인지 확인
      if (deviceId === this.config.deviceId || laneId === this.config.laneId) {
        console.log(`[BARRIER] 🚧 명령 수신 - ${action} (${reason})`);

        if (action === 'OPEN') {
          this.openBarrier(commandId);
        } else if (action === 'CLOSE') {
          this.closeBarrier(commandId);
        }
      }
    }
  }

  private openBarrier(commandId: string): void {
    console.log(`[BARRIER] ⬆️  차단기 열림 (commandId: ${commandId})`);
    // 실제 하드웨어 제어 로직이 들어갈 자리
    // 예: Modbus TCP 릴레이 ON

    // 3초 후 자동 닫힘 시뮬레이션
    setTimeout(() => {
      console.log(`[BARRIER] ⬇️  차단기 닫힘`);
    }, 3000);
  }

  private closeBarrier(commandId: string): void {
    console.log(`[BARRIER] ⬇️  차단기 닫힘 (commandId: ${commandId})`);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      console.log(`[BARRIER] ${this.config.deviceId} 재연결 시도...`);
      this.connect();
    }, 5000);
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
