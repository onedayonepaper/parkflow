import type { DiscountType } from '@parkflow/shared';

export interface DiscountInput {
  rawFee: number;
  freeMinutesUsed: number;
  totalParkingMinutes: number;
  discountRule: {
    id: string;
    name: string;
    type: DiscountType;
    value: number;
  };
  valueOverride?: number | null;
}

export interface DiscountResult {
  ruleId: string;
  ruleName: string;
  type: DiscountType;
  appliedValue: number;
  description: string;
}

/**
 * 할인 적용 (순수 함수)
 *
 * 할인 타입별 처리:
 * - AMOUNT: 정액 할인 (원)
 * - PERCENT: 정률 할인 (%)
 * - FREE_MINUTES: 추가 무료 시간 (분) - 이미 계산된 요금에서 감액
 * - FREE_ALL: 전액 무료
 */
export function applyDiscount(input: DiscountInput): DiscountResult {
  const { rawFee, discountRule, valueOverride } = input;
  const value = valueOverride ?? discountRule.value;

  let appliedValue: number;
  let description: string;

  switch (discountRule.type) {
    case 'AMOUNT':
      // 정액 할인: 최대 rawFee까지만 할인
      appliedValue = Math.min(value, rawFee);
      description = `정액 할인 ${value.toLocaleString()}원`;
      break;

    case 'PERCENT':
      // 정률 할인: 0~100%
      const percent = Math.min(Math.max(value, 0), 100);
      appliedValue = Math.floor(rawFee * (percent / 100));
      description = `${percent}% 할인`;
      break;

    case 'FREE_MINUTES':
      // 시간 무료: 추가 시간에 대한 요금 감면 (단순화: 분당 요금 추정)
      // 실제로는 더 정교한 계산 필요, MVP에서는 비율로 처리
      const minuteRate = rawFee / Math.max(input.totalParkingMinutes - input.freeMinutesUsed, 1);
      appliedValue = Math.min(Math.floor(minuteRate * value), rawFee);
      description = `${value}분 무료 (약 ${appliedValue.toLocaleString()}원 할인)`;
      break;

    case 'FREE_ALL':
      // 전액 무료
      appliedValue = rawFee;
      description = '전액 무료';
      break;

    default:
      appliedValue = 0;
      description = '알 수 없는 할인 타입';
  }

  return {
    ruleId: discountRule.id,
    ruleName: discountRule.name,
    type: discountRule.type,
    appliedValue,
    description,
  };
}

/**
 * 여러 할인 적용 시 총 할인액 계산
 * (중복 할인 가능 여부는 호출 측에서 검증)
 */
export function calculateTotalDiscount(
  rawFee: number,
  discounts: DiscountResult[]
): { discountTotal: number; finalFee: number } {
  const discountTotal = discounts.reduce((sum, d) => sum + d.appliedValue, 0);
  const finalFee = Math.max(0, rawFee - discountTotal);

  return { discountTotal, finalFee };
}
