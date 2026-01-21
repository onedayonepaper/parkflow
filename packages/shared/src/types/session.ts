import type { PlateEvent } from './device.js';
import type { DiscountApplication } from './discount.js';
import type { Payment } from './payment.js';

/** 세션 상태 */
export type SessionStatus =
  | 'PARKING'       // 입차 후 주차중
  | 'EXIT_PENDING'  // 출차 감지, 요금 산정됨
  | 'PAID'          // 결제 완료, 출차 허용 준비
  | 'CLOSED'        // 출차 완료/세션 종료
  | 'ERROR';        // 예외 처리 필요

/** 결제 상태 */
export type PaymentStatus =
  | 'NONE'
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED';

/** 세션 종료 사유 */
export type CloseReason =
  | 'NORMAL_EXIT'
  | 'MANUAL_EXIT'
  | 'FORCE_CLOSE'
  | 'SYSTEM_CLOSE'
  | 'ERROR_RECOVERY';

/** 적용된 요금 유형 */
export type AppliedRateType = 'default' | 'night' | 'weekend' | 'weekendNight';

/** 요금 계산 내역 */
export interface FeeBreakdown {
  parkingMinutes: number;
  freeMinutesApplied: number;
  chargeableMinutes: number;
  baseMinutes: number;
  baseFee: number;
  additionalMinutes: number;
  additionalFee: number;
  subtotal: number;
  dailyMaxApplied: boolean;
  dailyMaxCap: number;
  rawFee: number;
  discounts: Array<{
    ruleId: string;
    ruleName: string;
    type: string;
    appliedValue: number;
  }>;
  discountTotal: number;
  finalFee: number;
  calculatedAt: string;
  ratePlanId: string;
  ratePlanName: string;
  /** 적용된 요금 유형 (평일주간/야간/주말/주말야간) */
  appliedRateType?: AppliedRateType;
}

/** 주차 세션 */
export interface ParkingSession {
  id: string;
  siteId: string;
  entryLaneId: string | null;
  exitLaneId: string | null;
  plateNo: string;
  status: SessionStatus;
  entryAt: string;
  exitAt: string | null;
  ratePlanId: string | null;
  rawFee: number;
  discountTotal: number;
  finalFee: number;
  feeBreakdown: FeeBreakdown | null;
  paymentStatus: PaymentStatus;
  closeReason: CloseReason | null;
  createdAt: string;
  updatedAt: string;
}

/** 세션 상세 (관계 포함) */
export interface SessionDetail extends ParkingSession {
  entryEvent: PlateEvent | null;
  exitEvent: PlateEvent | null;
  discountApplications: DiscountApplication[];
  payments: Payment[];
}

/** 세션 목록 필터 */
export interface SessionListFilter {
  status?: SessionStatus;
  plateNo?: string;
  laneId?: string;
  from?: string;
  to?: string;
}

/** 세션 정정 요청 */
export interface SessionCorrectRequest {
  plateNoCorrected?: string;
  entryAt?: string;
  exitAt?: string;
  reason: string;
}

/** 세션 재계산 요청 */
export interface SessionRecalcRequest {
  ratePlanId?: string;
  reason: string;
}

/** 세션 강제 종료 요청 */
export interface SessionForceCloseRequest {
  reason: string;
  note?: string;
}
