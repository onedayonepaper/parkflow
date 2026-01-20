import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUEUE_FILE = resolve(__dirname, '../data/event-queue.json');

export interface QueuedEvent {
  id: string;
  event: any;
  attempts: number;
  createdAt: string;
  lastAttemptAt: string | null;
}

export class EventQueue {
  private apiBase: string;
  private queue: QueuedEvent[] = [];
  private retryInterval: NodeJS.Timeout | null = null;

  constructor(apiBase: string) {
    this.apiBase = apiBase;
    this.load();
  }

  /**
   * 이벤트를 큐에 추가
   */
  enqueue(event: any): void {
    const queuedEvent: QueuedEvent = {
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      event,
      attempts: 0,
      createdAt: new Date().toISOString(),
      lastAttemptAt: null,
    };

    this.queue.push(queuedEvent);
    this.save();
    console.log(`[QUEUE] ➕ 이벤트 추가됨 (총 ${this.queue.length}개)`);
  }

  /**
   * 재전송 시작
   */
  startRetry(intervalMs: number = 10000): void {
    if (this.retryInterval) return;

    this.retryInterval = setInterval(() => {
      this.processQueue();
    }, intervalMs);

    console.log(`[QUEUE] 🔄 재전송 시작 (${intervalMs / 1000}초 간격)`);
  }

  /**
   * 재전송 중지
   */
  stopRetry(): void {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
  }

  /**
   * 큐 처리
   */
  private async processQueue(): Promise<void> {
    if (this.queue.length === 0) return;

    console.log(`[QUEUE] 📤 재전송 시도 (${this.queue.length}개)`);

    const toRemove: string[] = [];

    for (const item of this.queue) {
      item.attempts++;
      item.lastAttemptAt = new Date().toISOString();

      try {
        const response = await fetch(`${this.apiBase}/api/device/lpr/events`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.event),
        });

        if (response.ok) {
          console.log(`[QUEUE] ✅ 재전송 성공: ${item.id}`);
          toRemove.push(item.id);
        } else if (item.attempts >= 5) {
          console.log(`[QUEUE] ❌ 최대 재시도 초과, 폐기: ${item.id}`);
          toRemove.push(item.id);
        }
      } catch (err) {
        if (item.attempts >= 5) {
          console.log(`[QUEUE] ❌ 최대 재시도 초과, 폐기: ${item.id}`);
          toRemove.push(item.id);
        }
      }
    }

    // 성공/폐기된 항목 제거
    this.queue = this.queue.filter((item) => !toRemove.includes(item.id));
    this.save();
  }

  /**
   * 파일에서 로드
   */
  private load(): void {
    try {
      if (existsSync(QUEUE_FILE)) {
        const data = readFileSync(QUEUE_FILE, 'utf-8');
        this.queue = JSON.parse(data);
        console.log(`[QUEUE] 📂 로드됨 (${this.queue.length}개)`);
      }
    } catch (err) {
      console.error('[QUEUE] 로드 실패:', err);
      this.queue = [];
    }
  }

  /**
   * 파일에 저장
   */
  private save(): void {
    try {
      const dir = dirname(QUEUE_FILE);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(QUEUE_FILE, JSON.stringify(this.queue, null, 2));
    } catch (err) {
      console.error('[QUEUE] 저장 실패:', err);
    }
  }
}
