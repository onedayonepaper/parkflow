import type { FastifyRequest } from 'fastify';
import type { WebSocket, RawData } from 'ws';
import { WS_EVENT_TYPE } from '@parkflow/shared';

// 연결된 클라이언트 관리 (WebSocket 직접 저장)
const clients = new Set<WebSocket>();

export interface WsMessage {
  type: keyof typeof WS_EVENT_TYPE;
  data: unknown;
}

/**
 * WebSocket 연결 핸들러
 * @fastify/websocket v10에서는 socket이 직접 전달됨
 */
export function wsHandler(socket: WebSocket, request: FastifyRequest) {
  clients.add(socket);

  console.log(`[WS] Client connected. Total: ${clients.size}`);

  // 연결 확인 메시지
  socket.send(JSON.stringify({
    type: 'CONNECTED',
    data: { message: 'ParkFlow WebSocket connected', timestamp: new Date().toISOString() },
  }));

  // 메시지 수신 (클라이언트 → 서버)
  socket.on('message', (raw: RawData) => {
    try {
      const message = JSON.parse(raw.toString());
      console.log(`[WS] Received:`, message);

      // 필요 시 클라이언트 메시지 처리
      if (message.type === 'PING') {
        socket.send(JSON.stringify({ type: 'PONG', data: { timestamp: new Date().toISOString() } }));
      }
    } catch (err) {
      console.error('[WS] Failed to parse message:', err);
    }
  });

  // 연결 종료
  socket.on('close', () => {
    clients.delete(socket);
    console.log(`[WS] Client disconnected. Total: ${clients.size}`);
  });

  // 에러 처리
  socket.on('error', (err: Error) => {
    console.error('[WS] Socket error:', err);
    clients.delete(socket);
  });
}

/**
 * 모든 클라이언트에게 메시지 브로드캐스트
 */
export function broadcast(message: WsMessage) {
  const payload = JSON.stringify(message);

  for (const client of clients) {
    try {
      if (client.readyState === 1) { // OPEN
        client.send(payload);
      }
    } catch (err) {
      console.error('[WS] Broadcast error:', err);
    }
  }
}

/**
 * 특정 조건의 클라이언트에게만 전송 (확장용)
 */
export function broadcastTo(
  message: WsMessage,
  filter: (client: WebSocket) => boolean
) {
  const payload = JSON.stringify(message);

  for (const client of clients) {
    try {
      if (client.readyState === 1 && filter(client)) {
        client.send(payload);
      }
    } catch (err) {
      console.error('[WS] Targeted broadcast error:', err);
    }
  }
}
