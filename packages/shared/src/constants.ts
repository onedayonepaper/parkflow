/** 세션 상태 */
export const SESSION_STATUS = {
  PARKING: 'PARKING',
  EXIT_PENDING: 'EXIT_PENDING',
  PAID: 'PAID',
  CLOSED: 'CLOSED',
  ERROR: 'ERROR',
} as const;

/** 차로 방향 */
export const LANE_DIRECTION = {
  ENTRY: 'ENTRY',
  EXIT: 'EXIT',
} as const;

/** 장비 타입 */
export const DEVICE_TYPE = {
  LPR: 'LPR',
  BARRIER: 'BARRIER',
  KIOSK: 'KIOSK',
} as const;

/** 장비 상태 */
export const DEVICE_STATUS = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  UNKNOWN: 'UNKNOWN',
} as const;

/** 결제 수단 */
export const PAYMENT_METHOD = {
  CARD: 'CARD',
  CASH: 'CASH',
  MOBILE: 'MOBILE',
  MOCK: 'MOCK',
} as const;

/** 결제 상태 */
export const PAYMENT_STATUS = {
  NONE: 'NONE',
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

/** 할인 타입 */
export const DISCOUNT_TYPE = {
  AMOUNT: 'AMOUNT',
  PERCENT: 'PERCENT',
  FREE_MINUTES: 'FREE_MINUTES',
  FREE_ALL: 'FREE_ALL',
} as const;

/** 사용자 역할 */
export const USER_ROLE = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  OPERATOR: 'OPERATOR',
  AUDITOR: 'AUDITOR',
} as const;

/** WebSocket 이벤트 타입 */
export const WS_EVENT_TYPE = {
  PLATE_EVENT: 'PLATE_EVENT',
  SESSION_UPDATED: 'SESSION_UPDATED',
  DEVICE_STATUS: 'DEVICE_STATUS',
  PAYMENT_COMPLETED: 'PAYMENT_COMPLETED',
  BARRIER_COMMAND: 'BARRIER_COMMAND',
} as const;

/** 기본 사이트 ID (싱글 테넌트 MVP) */
export const DEFAULT_SITE_ID = 'site_default';

/** 기본 타임존 */
export const DEFAULT_TIMEZONE = 'Asia/Seoul';
