import type { RateRules } from '@parkflow/shared';
import { diffMinutes, nowIso } from '@parkflow/shared';

export interface FeeCalculationInput {
  entryAt: string;
  exitAt: string;
  ratePlan: {
    id: string;
    name: string;
    rules: RateRules;
  };
}

export interface FeeCalculationResult {
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
  calculatedAt: string;
  ratePlanId: string;
  ratePlanName: string;
}

/**
 * 주차 요금 계산 (순수 함수)
 *
 * 계산 로직:
 * 1. 총 주차 시간 계산
 * 2. 무료 시간 차감
 * 3. 기본 시간 요금 적용
 * 4. 추가 시간 요금 계산 (올림 처리)
 * 5. 일 최대 요금 캡 적용
 */
export function calculateFee(input: FeeCalculationInput): FeeCalculationResult {
  const { entryAt, exitAt, ratePlan } = input;
  const { rules } = ratePlan;

  // 1. 총 주차 시간 (분)
  const parkingMinutes = Math.max(0, diffMinutes(entryAt, exitAt));

  // 2. 무료 시간 내 출차
  if (parkingMinutes <= rules.freeMinutes) {
    return {
      parkingMinutes,
      freeMinutesApplied: parkingMinutes,
      chargeableMinutes: 0,
      baseMinutes: 0,
      baseFee: 0,
      additionalMinutes: 0,
      additionalFee: 0,
      subtotal: 0,
      dailyMaxApplied: false,
      dailyMaxCap: rules.dailyMax,
      rawFee: 0,
      calculatedAt: nowIso(),
      ratePlanId: ratePlan.id,
      ratePlanName: ratePlan.name,
    };
  }

  // 3. 과금 대상 시간
  const chargeableMinutes = parkingMinutes - rules.freeMinutes;

  // 4. 기본 시간 요금
  let fee = 0;
  let remainingMinutes = chargeableMinutes;
  let baseMinutesUsed = 0;
  let additionalMinutesUsed = 0;

  if (remainingMinutes > 0) {
    baseMinutesUsed = Math.min(remainingMinutes, rules.baseMinutes);
    fee += rules.baseFee;
    remainingMinutes -= baseMinutesUsed;
  }

  // 5. 추가 시간 요금 (올림 처리)
  let additionalFeeTotal = 0;
  if (remainingMinutes > 0) {
    const additionalUnits = Math.ceil(remainingMinutes / rules.additionalMinutes);
    additionalMinutesUsed = additionalUnits * rules.additionalMinutes;
    additionalFeeTotal = additionalUnits * rules.additionalFee;
    fee += additionalFeeTotal;
  }

  // 6. 일 최대 요금 캡 적용
  const dailyMaxApplied = fee > rules.dailyMax;
  const rawFee = dailyMaxApplied ? rules.dailyMax : fee;

  return {
    parkingMinutes,
    freeMinutesApplied: rules.freeMinutes,
    chargeableMinutes,
    baseMinutes: baseMinutesUsed,
    baseFee: rules.baseFee,
    additionalMinutes: additionalMinutesUsed,
    additionalFee: additionalFeeTotal,
    subtotal: fee,
    dailyMaxApplied,
    dailyMaxCap: rules.dailyMax,
    rawFee,
    calculatedAt: nowIso(),
    ratePlanId: ratePlan.id,
    ratePlanName: ratePlan.name,
  };
}
