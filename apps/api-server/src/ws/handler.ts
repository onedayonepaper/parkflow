import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { WebSocket, RawData } from 'ws';
import { WS_EVENT_TYPE } from '@parkflow/shared';

// 연결된 클라이언트 관리 (WebSocket과 사용자 정보)
interface AuthenticatedClient {
  socket: WebSocket;
  userId: string;
  username: string;
  role: string;
  siteId: string;
}

const clients = new Map<WebSocket, AuthenticatedClient>();

export interface WsMessage {
  type: keyof typeof WS_EVENT_TYPE;
  data: unknown;
}

export interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  siteId: string;
}

/**
 * WebSocket 인증 핸들러 생성
 * @param app Fastify 인스턴스 (JWT 검증용)
 */
export function createWsHandler(app: FastifyInstance) {
  return function wsHandler(socket: WebSocket, request: FastifyRequest) {
    // 쿼리 파라미터에서 토큰 추출
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      console.log('[WS] Connection rejected: No token provided');
      socket.close(4001, 'Authentication required');
      return;
    }

    // JWT 검증
    let payload: JwtPayload;
    try {
      payload = app.jwt.verify<JwtPayload>(token);
    } catch (err) {
      console.log('[WS] Connection rejected: Invalid token');
      socket.close(4002, 'Invalid token');
      return;
    }

    // 인증된 클라이언트 등록
    const client: AuthenticatedClient = {
      socket,
      userId: payload.sub,
      username: payload.username,
      role: payload.role,
      siteId: payload.siteId,
    };
    clients.set(socket, client);

    console.log(`[WS] Client connected: ${payload.username} (${payload.role}). Total: ${clients.size}`);

    // 연결 확인 메시지
    socket.send(JSON.stringify({
      type: 'CONNECTED',
      data: {
        message: 'ParkFlow WebSocket connected',
        timestamp: new Date().toISOString(),
        user: { username: payload.username, role: payload.role },
      },
    }));

    // 메시지 수신 (클라이언트 → 서버)
    socket.on('message', (raw: RawData) => {
      try {
        const message = JSON.parse(raw.toString());
        console.log(`[WS] Received from ${payload.username}:`, message);

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
      console.log(`[WS] Client disconnected: ${payload.username}. Total: ${clients.size}`);
    });

    // 에러 처리
    socket.on('error', (err: Error) => {
      console.error('[WS] Socket error:', err);
      clients.delete(socket);
    });
  };
}

/**
 * 모든 클라이언트에게 메시지 브로드캐스트
 */
export function broadcast(message: WsMessage) {
  const payload = JSON.stringify(message);

  for (const [socket] of clients) {
    try {
      if (socket.readyState === 1) { // OPEN
        socket.send(payload);
      }
    } catch (err) {
      console.error('[WS] Broadcast error:', err);
    }
  }
}

/**
 * 특정 사이트의 클라이언트에게만 전송
 */
export function broadcastToSite(message: WsMessage, siteId: string) {
  const payload = JSON.stringify(message);

  for (const [socket, client] of clients) {
    try {
      if (socket.readyState === 1 && client.siteId === siteId) {
        socket.send(payload);
      }
    } catch (err) {
      console.error('[WS] Site broadcast error:', err);
    }
  }
}

/**
 * 특정 조건의 클라이언트에게만 전송 (확장용)
 */
export function broadcastTo(
  message: WsMessage,
  filter: (client: AuthenticatedClient) => boolean
) {
  const payload = JSON.stringify(message);

  for (const [socket, client] of clients) {
    try {
      if (socket.readyState === 1 && filter(client)) {
        socket.send(payload);
      }
    } catch (err) {
      console.error('[WS] Targeted broadcast error:', err);
    }
  }
}

/**
 * 연결된 클라이언트 수 반환
 */
export function getClientCount(): number {
  return clients.size;
}
