import type { FastifyInstance, FastifyRequest, FastifyBaseLogger } from 'fastify';
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

// 로거 참조 (createWsHandler에서 설정)
let logger: FastifyBaseLogger | null = null;

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

// Device Agent API 키 (환경변수 또는 기본값)
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || 'parkflow-device-key-2024';

/**
 * WebSocket 인증 핸들러 생성
 * @param app Fastify 인스턴스 (JWT 검증용)
 */
export function createWsHandler(app: FastifyInstance) {
  // 로거 참조 저장
  logger = app.log;

  return function wsHandler(socket: WebSocket, request: FastifyRequest) {
    // 쿼리 파라미터에서 토큰 추출
    const url = new URL(request.url, `http://${request.headers.host}`);
    const token = url.searchParams.get('token');
    const apiKey = url.searchParams.get('apiKey');
    const deviceId = url.searchParams.get('deviceId');

    // Device Agent 인증 (API 키 방식)
    if (apiKey && deviceId) {
      if (apiKey !== DEVICE_API_KEY) {
        app.log.warn('[WS] Device connection rejected: Invalid API key');
        socket.close(4003, 'Invalid API key');
        return;
      }

      // 디바이스 클라이언트 등록
      const client: AuthenticatedClient = {
        socket,
        userId: deviceId,
        username: `device:${deviceId}`,
        role: 'DEVICE',
        siteId: 'site_default',
      };
      clients.set(socket, client);

      app.log.info({ deviceId, total: clients.size }, '[WS] Device connected');

      socket.send(JSON.stringify({
        type: 'CONNECTED',
        data: {
          message: 'ParkFlow Device WebSocket connected',
          timestamp: new Date().toISOString(),
          device: { id: deviceId },
        },
      }));

      // 메시지 수신
      socket.on('message', (raw: RawData) => {
        try {
          const message = JSON.parse(raw.toString());
          app.log.debug({ deviceId, message }, '[WS] Device message received');
        } catch (err) {
          app.log.error({ err }, '[WS] Failed to parse device message');
        }
      });

      socket.on('close', () => {
        clients.delete(socket);
        app.log.info({ deviceId, total: clients.size }, '[WS] Device disconnected');
      });

      socket.on('error', (err: Error) => {
        app.log.error({ err, deviceId }, '[WS] Device socket error');
        clients.delete(socket);
      });

      return;
    }

    // 사용자 인증 (JWT 방식)
    if (!token) {
      app.log.warn('[WS] Connection rejected: No token provided');
      socket.close(4001, 'Authentication required');
      return;
    }

    // JWT 검증
    let payload: JwtPayload;
    try {
      payload = app.jwt.verify<JwtPayload>(token);
    } catch (err) {
      app.log.warn('[WS] Connection rejected: Invalid token');
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

    app.log.info({ username: payload.username, role: payload.role, total: clients.size }, '[WS] Client connected');

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
        app.log.debug({ username: payload.username, message }, '[WS] Message received');

        // 필요 시 클라이언트 메시지 처리
        if (message.type === 'PING') {
          socket.send(JSON.stringify({ type: 'PONG', data: { timestamp: new Date().toISOString() } }));
        }
      } catch (err) {
        app.log.error({ err }, '[WS] Failed to parse message');
      }
    });

    // 연결 종료
    socket.on('close', () => {
      clients.delete(socket);
      app.log.info({ username: payload.username, total: clients.size }, '[WS] Client disconnected');
    });

    // 에러 처리
    socket.on('error', (err: Error) => {
      app.log.error({ err }, '[WS] Socket error');
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
      logger?.error({ err }, '[WS] Broadcast error');
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
      logger?.error({ err, siteId }, '[WS] Site broadcast error');
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
      logger?.error({ err }, '[WS] Targeted broadcast error');
    }
  }
}

/**
 * 연결된 클라이언트 수 반환
 */
export function getClientCount(): number {
  return clients.size;
}
