type WsEventHandler = (data: any) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<WsEventHandler>> = new Map();
  private reconnectTimeout: number | null = null;
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.baseUrl = `${protocol}//${window.location.host}/api/ws`;
  }

  setToken(token: string | null): void {
    this.token = token;
    // 토큰이 설정되면 재연결
    if (token && (!this.ws || this.ws.readyState !== WebSocket.OPEN)) {
      this.connect();
    } else if (!token && this.ws) {
      this.disconnect();
    }
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    if (!this.token) {
      console.log('[WS] No token, skipping connection');
      return;
    }

    try {
      const url = `${this.baseUrl}?token=${encodeURIComponent(this.token)}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.emit(message.type, message.data);
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };
    } catch (e) {
      console.error('[WS] Connection error:', e);
      this.scheduleReconnect();
    }
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

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;
    if (!this.token) return; // 토큰 없으면 재연결 안함
    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 3000);
  }

  on(event: string, handler: WsEventHandler): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    this.handlers.get(event)!.add(handler);

    return () => {
      this.handlers.get(event)?.delete(handler);
    };
  }

  private emit(event: string, data: any): void {
    this.handlers.get(event)?.forEach((handler) => handler(data));
  }
}

export const wsClient = new WebSocketClient();
