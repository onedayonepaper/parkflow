import { useEffect, useCallback } from 'react';
import { wsClient } from '../lib/ws';
import { useToast } from './Toast';

interface SessionUpdatedData {
  sessionId: string;
  status?: string;
  plateNo?: string;
  entryAt?: string;
  exitAt?: string;
  finalFee?: number;
  isMember?: boolean;
  closeReason?: string;
}

interface PlateEventData {
  eventId: string;
  direction: 'ENTRY' | 'EXIT';
  plateNo: string;
  laneId: string;
  sessionId: string | null;
}

interface BlacklistAlertData {
  plateNo: string;
  reason: string;
  laneId: string;
  capturedAt: string;
}

interface BarrierCommandData {
  commandId: string;
  deviceId: string;
  laneId: string;
  action: 'OPEN' | 'CLOSE';
  reason: string;
}

/**
 * 전역 실시간 이벤트 핸들러
 * 앱 전체에서 WebSocket 이벤트를 감지하고 알림을 표시합니다.
 */
export function RealtimeHandler() {
  const { addToast } = useToast();

  // 세션 업데이트 핸들러
  const handleSessionUpdated = useCallback(
    (data: SessionUpdatedData) => {
      const { plateNo, status, isMember, finalFee } = data;

      if (status === 'PARKING') {
        addToast({
          type: isMember ? 'info' : 'success',
          title: '차량 입차',
          message: isMember
            ? `🎫 정기권 차량 ${plateNo} 입차`
            : `${plateNo} 입차 완료`,
        });
      } else if (status === 'EXIT_PENDING') {
        addToast({
          type: 'warning',
          title: '결제 대기',
          message: `${plateNo} - ${finalFee?.toLocaleString()}원 결제 필요`,
        });
      } else if (status === 'CLOSED') {
        addToast({
          type: 'success',
          title: '출차 완료',
          message: `${plateNo} 출차`,
        });
      }
    },
    [addToast]
  );

  // 블랙리스트 경고 핸들러
  const handleBlacklistAlert = useCallback(
    (data: BlacklistAlertData) => {
      addToast({
        type: 'error',
        title: '🚫 블랙리스트 차량',
        message: `${data.plateNo} - ${data.reason}`,
        duration: 10000, // 10초
      });

      // 데스크톱 알림
      if (Notification.permission === 'granted') {
        new Notification('🚫 블랙리스트 차량 감지', {
          body: `${data.plateNo}\n사유: ${data.reason}`,
          icon: '/favicon.ico',
          requireInteraction: true,
        });
      }
    },
    [addToast]
  );

  // 차단기 명령 핸들러
  const handleBarrierCommand = useCallback(
    (data: BarrierCommandData) => {
      if (data.action === 'OPEN') {
        addToast({
          type: 'info',
          title: '차단기 열림',
          message: `${data.laneId} 차로 - ${data.reason}`,
          duration: 3000,
        });
      }
    },
    [addToast]
  );

  // 결제 업데이트 핸들러
  const handlePaymentUpdated = useCallback(
    (data: { sessionId: string; status: string; amount?: number }) => {
      if (data.status === 'PAID') {
        addToast({
          type: 'success',
          title: '결제 완료',
          message: data.amount
            ? `${data.amount.toLocaleString()}원 결제 완료`
            : '결제가 완료되었습니다',
        });
      } else if (data.status === 'CANCELLED') {
        addToast({
          type: 'warning',
          title: '결제 취소',
          message: '결제가 취소되었습니다',
        });
      }
    },
    [addToast]
  );

  useEffect(() => {
    const unsubscribers = [
      wsClient.on('SESSION_UPDATED', handleSessionUpdated),
      wsClient.on('BLACKLIST_ALERT', handleBlacklistAlert),
      wsClient.on('BARRIER_COMMAND', handleBarrierCommand),
      wsClient.on('PAYMENT_UPDATED', handlePaymentUpdated),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [
    handleSessionUpdated,
    handleBlacklistAlert,
    handleBarrierCommand,
    handlePaymentUpdated,
  ]);

  // 렌더링 없음 - 이벤트 핸들링만 담당
  return null;
}
