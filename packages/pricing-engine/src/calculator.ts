import type { RateRules, TimeBasedRate } from '@parkflow/shared';
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
  /** 적용된 요금 유형 */
  appliedRateType: 'default' | 'night' | 'weekend' | 'weekendNight';
}

/**
 * 시간 문자열(HH:mm)을 분으로 변환
 */
function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  const hours = parts[0] ?? 0;
  const minutes = parts[1] ?? 0;
  return hours * 60 + minutes;
}

/**
 * 주어진 날짜가 주말인지 확인 (토요일=6, 일요일=0)
 */
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * 주어진 날짜의 시간이 야간 시간대인지 확인
 */
function isNightTime(date: Date, nightStart: string, nightEnd: string): boolean {
  const currentMinutes = date.getHours() * 60 + date.getMinutes();
  const nightStartMinutes = timeToMinutes(nightStart);
  const nightEndMinutes = timeToMinutes(nightEnd);

  // 야간이 자정을 넘어가는 경우 (예: 22:00 ~ 06:00)
  if (nightStartMinutes > nightEndMinutes) {
    return currentMinutes >= nightStartMinutes || currentMinutes < nightEndMinutes;
  }
  // 같은 날 안에 있는 경우 (예: 00:00 ~ 06:00)
  return currentMinutes >= nightStartMinutes && currentMinutes < nightEndMinutes;
}

/**
 * 주차 시작 시간 기준으로 적용할 요금 유형 결정
 */
export function determineRateType(
  entryAt: string,
  rules: RateRules
): 'default' | 'night' | 'weekend' | 'weekendNight' {
  if (!rules.timeBasedEnabled) {
    return 'default';
  }

  const entryDate = new Date(entryAt);
  const weekend = isWeekend(entryDate);
  const nightTime = rules.nightRateEnabled && rules.nightStart && rules.nightEnd
    ? isNightTime(entryDate, rules.nightStart, rules.nightEnd)
    : false;

  // 주말 + 야간
  if (rules.weekendNightRateEnabled && rules.weekendNightRate && weekend && nightTime) {
    return 'weekendNight';
  }

  // 주말 (낮)
  if (rules.weekendRateEnabled && rules.weekendRate && weekend && !nightTime) {
    return 'weekend';
  }

  // 평일 야간
  if (rules.nightRateEnabled && rules.nightRate && nightTime && !weekend) {
    return 'night';
  }

  // 평일 야간이지만 주말이면 주말 요금 적용 (야간 주말 설정이 없는 경우)
  if (rules.weekendRateEnabled && rules.weekendRate && weekend) {
    return 'weekend';
  }

  // 주중 야간이지만 주말이면 기본 요금 (주말 설정이 없는 경우)
  if (rules.nightRateEnabled && rules.nightRate && nightTime) {
    return 'night';
  }

  return 'default';
}

/**
 * 요금 유형에 따른 요금 설정 반환
 */
function getRateConfig(
  rules: RateRules,
  rateType: 'default' | 'night' | 'weekend' | 'weekendNight'
): { baseMinutes: number; baseFee: number; additionalMinutes: number; additionalFee: number; dailyMax: number } {
  switch (rateType) {
    case 'night':
      return rules.nightRate || rules;
    case 'weekend':
      return rules.weekendRate || rules;
    case 'weekendNight':
      return rules.weekendNightRate || rules.weekendRate || rules;
    default:
      return rules;
  }
}

/**
 * 주차 요금 계산 (순수 함수)
 *
 * 계산 로직:
 * 1. 총 주차 시간 계산
 * 2. 시간대별 요금 유형 결정 (평일/주말, 주간/야간)
 * 3. 무료 시간 차감
 * 4. 기본 시간 요금 적용
 * 5. 추가 시간 요금 계산 (올림 처리)
 * 6. 일 최대 요금 캡 적용
 */
export function calculateFee(input: FeeCalculationInput): FeeCalculationResult {
  const { entryAt, exitAt, ratePlan } = input;
  const { rules } = ratePlan;

  // 1. 총 주차 시간 (분)
  const parkingMinutes = Math.max(0, diffMinutes(entryAt, exitAt));

  // 2. 시간대별 요금 유형 결정
  const appliedRateType = determineRateType(entryAt, rules);
  const rateConfig = getRateConfig(rules, appliedRateType);

  // 3. 무료 시간 내 출차
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
      dailyMaxCap: rateConfig.dailyMax,
      rawFee: 0,
      calculatedAt: nowIso(),
      ratePlanId: ratePlan.id,
      ratePlanName: ratePlan.name,
      appliedRateType,
    };
  }

  // 4. 과금 대상 시간
  const chargeableMinutes = parkingMinutes - rules.freeMinutes;

  // 5. 기본 시간 요금
  let fee = 0;
  let remainingMinutes = chargeableMinutes;
  let baseMinutesUsed = 0;
  let additionalMinutesUsed = 0;

  if (remainingMinutes > 0) {
    baseMinutesUsed = Math.min(remainingMinutes, rateConfig.baseMinutes);
    fee += rateConfig.baseFee;
    remainingMinutes -= baseMinutesUsed;
  }

  // 6. 추가 시간 요금 (올림 처리)
  let additionalFeeTotal = 0;
  if (remainingMinutes > 0) {
    const additionalUnits = Math.ceil(remainingMinutes / rateConfig.additionalMinutes);
    additionalMinutesUsed = additionalUnits * rateConfig.additionalMinutes;
    additionalFeeTotal = additionalUnits * rateConfig.additionalFee;
    fee += additionalFeeTotal;
  }

  // 7. 일 최대 요금 캡 적용
  const dailyMaxApplied = fee > rateConfig.dailyMax;
  const rawFee = dailyMaxApplied ? rateConfig.dailyMax : fee;

  return {
    parkingMinutes,
    freeMinutesApplied: rules.freeMinutes,
    chargeableMinutes,
    baseMinutes: baseMinutesUsed,
    baseFee: rateConfig.baseFee,
    additionalMinutes: additionalMinutesUsed,
    additionalFee: additionalFeeTotal,
    subtotal: fee,
    dailyMaxApplied,
    dailyMaxCap: rateConfig.dailyMax,
    rawFee,
    calculatedAt: nowIso(),
    ratePlanId: ratePlan.id,
    ratePlanName: ratePlan.name,
    appliedRateType,
  };
}
