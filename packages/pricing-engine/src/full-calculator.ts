import type { RateRules, DiscountType, FeeBreakdown } from '@parkflow/shared';
import { nowIso } from '@parkflow/shared';
import { calculateFee, type FeeCalculationResult } from './calculator.js';
import { applyDiscount, calculateTotalDiscount, type DiscountResult } from './discount.js';

export interface FullCalculationInput {
  entryAt: string;
  exitAt: string;
  ratePlan: {
    id: string;
    name: string;
    rules: RateRules;
  };
  discounts?: Array<{
    id: string;
    name: string;
    type: DiscountType;
    value: number;
    valueOverride?: number | null;
  }>;
}

export interface FullCalculationResult {
  feeCalculation: FeeCalculationResult;
  discounts: DiscountResult[];
  discountTotal: number;
  finalFee: number;
  breakdown: FeeBreakdown;
}

/**
 * 요금 계산 + 할인 적용 통합 함수
 */
export function calculateWithDiscounts(input: FullCalculationInput): FullCalculationResult {
  const { entryAt, exitAt, ratePlan, discounts = [] } = input;

  // 1. 기본 요금 계산
  const feeCalc = calculateFee({ entryAt, exitAt, ratePlan });

  // 2. 할인 적용
  const discountResults: DiscountResult[] = [];

  for (const discount of discounts) {
    const result = applyDiscount({
      rawFee: feeCalc.rawFee,
      freeMinutesUsed: feeCalc.freeMinutesApplied,
      totalParkingMinutes: feeCalc.parkingMinutes,
      discountRule: discount,
      valueOverride: discount.valueOverride,
    });
    discountResults.push(result);
  }

  // 3. 총 할인 및 최종 요금
  const { discountTotal, finalFee } = calculateTotalDiscount(feeCalc.rawFee, discountResults);

  // 4. Breakdown 생성
  const breakdown: FeeBreakdown = {
    parkingMinutes: feeCalc.parkingMinutes,
    freeMinutesApplied: feeCalc.freeMinutesApplied,
    chargeableMinutes: feeCalc.chargeableMinutes,
    baseMinutes: feeCalc.baseMinutes,
    baseFee: feeCalc.baseFee,
    additionalMinutes: feeCalc.additionalMinutes,
    additionalFee: feeCalc.additionalFee,
    subtotal: feeCalc.subtotal,
    dailyMaxApplied: feeCalc.dailyMaxApplied,
    dailyMaxCap: feeCalc.dailyMaxCap,
    rawFee: feeCalc.rawFee,
    discounts: discountResults.map((d) => ({
      ruleId: d.ruleId,
      ruleName: d.ruleName,
      type: d.type,
      appliedValue: d.appliedValue,
    })),
    discountTotal,
    finalFee,
    calculatedAt: nowIso(),
    ratePlanId: ratePlan.id,
    ratePlanName: ratePlan.name,
    appliedRateType: feeCalc.appliedRateType,
  };

  return {
    feeCalculation: feeCalc,
    discounts: discountResults,
    discountTotal,
    finalFee,
    breakdown,
  };
}
