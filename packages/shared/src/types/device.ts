/** 장비 타입 */
export type DeviceType = 'LPR' | 'BARRIER' | 'KIOSK';

/** 장비 상태 */
export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';

/** 차로 방향 */
export type LaneDirection = 'ENTRY' | 'EXIT';

/** 차단기 명령 */
export type BarrierAction = 'OPEN' | 'CLOSE';

/** 차단기 명령 사유 */
export type BarrierReason =
  | 'PAYMENT_CONFIRMED'
  | 'MEMBERSHIP_VALID'
  | 'FREE_EXIT'
  | 'MANUAL_OPEN'
  | 'EMERGENCY';

/** Site (주차장) */
export interface Site {
  id: string;
  name: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

/** Lane (차로) */
export interface Lane {
  id: string;
  siteId: string;
  name: string;
  direction: LaneDirection;
  createdAt: string;
  updatedAt: string;
}

/** Device (장비) */
export interface Device {
  id: string;
  siteId: string;
  laneId: string | null;
  type: DeviceType;
  name: string;
  status: DeviceStatus;
  lastSeenAt: string | null;
  configJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/** LPR 이벤트 (원본) */
export interface PlateEvent {
  id: string;
  siteId: string;
  deviceId: string;
  laneId: string;
  direction: LaneDirection;
  plateNoRaw: string;
  plateNoNorm: string;
  confidence: number | null;
  imageUrl: string | null;
  capturedAt: string;
  receivedAt: string;
  sessionId: string | null;
  createdAt: string;
}

/** LPR 이벤트 수신 요청 */
export interface LprEventRequest {
  deviceId: string;
  laneId: string;
  direction: LaneDirection;
  plateNo: string;
  capturedAt: string;
  confidence?: number;
  imageUrl?: string;
}

/** Heartbeat 요청 */
export interface HeartbeatRequest {
  deviceId: string;
  status: DeviceStatus;
  ts: string;
}

/** Barrier 명령 요청 */
export interface BarrierCommandRequest {
  deviceId: string;
  laneId: string;
  action: BarrierAction;
  reason: BarrierReason;
  correlationId?: string;
}

/** Barrier 명령 응답 */
export interface BarrierCommand {
  id: string;
  deviceId: string;
  laneId: string;
  action: BarrierAction;
  reason: BarrierReason;
  correlationId: string | null;
  executedAt: string | null;
  status: 'PENDING' | 'EXECUTED' | 'FAILED';
  createdAt: string;
}
