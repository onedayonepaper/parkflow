import { useEffect, useCallback } from 'react';
import { wsClient } from '../lib/ws';

export type WsEventType =
  | 'SESSION_UPDATED'
  | 'PLATE_EVENT'
  | 'BARRIER_COMMAND'
  | 'DEVICE_STATUS'
  | 'BLACKLIST_ALERT'
  | 'PAYMENT_UPDATED'
  | 'NOTIFICATION';

export interface SessionUpdatedData {
  sessionId: string;
  status?: string;
  plateNo?: string;
  entryAt?: string;
  exitAt?: string;
  finalFee?: number;
  discountTotal?: number;
  closeReason?: string;
  isMember?: boolean;
  membershipType?: string | null;
}

export interface PlateEventData {
  eventId: string;
  direction: 'ENTRY' | 'EXIT';
  plateNo: string;
  laneId: string;
  sessionId: string | null;
}

export interface BlacklistAlertData {
  plateNo: string;
  reason: string;
  laneId: string;
  capturedAt: string;
}

export interface BarrierCommandData {
  commandId: string;
  deviceId: string;
  laneId: string;
  action: 'OPEN' | 'CLOSE';
  reason: string;
}

export interface DeviceStatusData {
  deviceId: string;
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
}

export interface PaymentUpdatedData {
  paymentId: string;
  sessionId: string;
  status: string;
  amount?: number;
}

type WsEventData = {
  SESSION_UPDATED: SessionUpdatedData;
  PLATE_EVENT: PlateEventData;
  BLACKLIST_ALERT: BlacklistAlertData;
  BARRIER_COMMAND: BarrierCommandData;
  DEVICE_STATUS: DeviceStatusData;
  PAYMENT_UPDATED: PaymentUpdatedData;
  NOTIFICATION: { title: string; message: string; type: 'info' | 'warning' | 'error' | 'success' };
};

/**
 * WebSocket 이벤트를 구독하는 훅
 * @param event 이벤트 타입
 * @param handler 이벤트 핸들러
 */
export function useWebSocket<T extends WsEventType>(
  event: T,
  handler: (data: WsEventData[T]) => void
): void {
  useEffect(() => {
    const unsubscribe = wsClient.on(event, handler);
    return unsubscribe;
  }, [event, handler]);
}

/**
 * 여러 WebSocket 이벤트를 한 번에 구독하는 훅
 */
export function useWebSocketEvents(
  handlers: Partial<{ [K in WsEventType]: (data: WsEventData[K]) => void }>
): void {
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    for (const [event, handler] of Object.entries(handlers)) {
      if (handler) {
        unsubscribers.push(wsClient.on(event, handler));
      }
    }

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [handlers]);
}

/**
 * 실시간 세션 업데이트를 구독하고 데이터를 자동 갱신하는 훅
 */
export function useRealtimeRefresh(refreshFn: () => void): void {
  const handleSessionUpdate = useCallback(() => {
    refreshFn();
  }, [refreshFn]);

  const handlePlateEvent = useCallback(() => {
    refreshFn();
  }, [refreshFn]);

  const handlePaymentUpdate = useCallback(() => {
    refreshFn();
  }, [refreshFn]);

  useWebSocket('SESSION_UPDATED', handleSessionUpdate);
  useWebSocket('PLATE_EVENT', handlePlateEvent);
  useWebSocket('PAYMENT_UPDATED', handlePaymentUpdate);
}
