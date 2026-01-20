/** 요금 규칙 */
export interface RateRules {
  /** 무료 시간 (분) */
  freeMinutes: number;
  /** 기본 시간 (분) */
  baseMinutes: number;
  /** 기본 요금 (원) */
  baseFee: number;
  /** 추가 단위 시간 (분) */
  additionalMinutes: number;
  /** 추가 요금 (원) */
  additionalFee: number;
  /** 일 최대 요금 (원) */
  dailyMax: number;
  /** 결제 후 유예 시간 (분) */
  graceMinutes: number;
  /** 야간 할인 여부 */
  nightDiscountEnabled?: boolean;
  /** 야간 시작 (HH:mm) */
  nightStart?: string;
  /** 야간 종료 (HH:mm) */
  nightEnd?: string;
  /** 야간 할인율 (0-100) */
  nightDiscountPercent?: number;
}

/** 요금표 */
export interface RatePlan {
  id: string;
  siteId: string;
  name: string;
  isActive: boolean;
  rules: RateRules;
  createdAt: string;
  updatedAt: string;
}

/** 요금표 생성/수정 요청 */
export interface RatePlanRequest {
  name: string;
  rules: RateRules;
  isActive?: boolean;
}

/** 기본 요금 규칙 */
export const DEFAULT_RATE_RULES: RateRules = {
  freeMinutes: 30,
  baseMinutes: 30,
  baseFee: 1000,
  additionalMinutes: 10,
  additionalFee: 500,
  dailyMax: 15000,
  graceMinutes: 15,
};
