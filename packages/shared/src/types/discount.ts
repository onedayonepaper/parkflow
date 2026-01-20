/** 할인 타입 */
export type DiscountType =
  | 'AMOUNT'       // 정액 할인
  | 'PERCENT'      // 정률 할인
  | 'FREE_MINUTES' // 시간 무료
  | 'FREE_ALL';    // 전액 무료

/** 할인 규칙 */
export interface DiscountRule {
  id: string;
  siteId: string;
  name: string;
  type: DiscountType;
  /** AMOUNT=원, PERCENT=0-100, FREE_MINUTES=분 */
  value: number;
  /** 중복 적용 가능 여부 */
  isStackable: boolean;
  /** 최대 적용 횟수 (null=무제한) */
  maxApplyCount: number | null;
  createdAt: string;
  updatedAt: string;
}

/** 할인 규칙 생성/수정 요청 */
export interface DiscountRuleRequest {
  name: string;
  type: DiscountType;
  value: number;
  isStackable?: boolean;
  maxApplyCount?: number | null;
}

/** 할인 적용 이력 */
export interface DiscountApplication {
  id: string;
  sessionId: string;
  discountRuleId: string;
  appliedValue: number;
  appliedByUserId: string | null;
  appliedAt: string;
  reason: string | null;
}

/** 할인 적용 요청 */
export interface ApplyDiscountRequest {
  discountRuleId: string;
  valueOverride?: number | null;
  reason?: string;
}

/** 정기권/멤버십 */
export interface Membership {
  id: string;
  siteId: string;
  plateNo: string;
  memberName: string | null;
  validFrom: string;
  validTo: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 정기권 생성/수정 요청 */
export interface MembershipRequest {
  plateNo: string;
  memberName?: string;
  validFrom: string;
  validTo: string;
  note?: string;
}
