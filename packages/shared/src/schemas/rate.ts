import { z } from 'zod';

/** 시간 형식 (HH:mm) */
const TimeStringSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** 시간대별 요금 스키마 */
export const TimeBasedRateSchema = z.object({
  baseMinutes: z.number().int().min(1).default(30),
  baseFee: z.number().int().min(0).default(1000),
  additionalMinutes: z.number().int().min(1).default(10),
  additionalFee: z.number().int().min(0).default(500),
  dailyMax: z.number().int().min(0).default(15000),
});

/** 요금 규칙 스키마 */
export const RateRulesSchema = z.object({
  // 기본 요금 설정
  freeMinutes: z.number().int().min(0).default(30),
  baseMinutes: z.number().int().min(1).default(30),
  baseFee: z.number().int().min(0).default(1000),
  additionalMinutes: z.number().int().min(1).default(10),
  additionalFee: z.number().int().min(0).default(500),
  dailyMax: z.number().int().min(0).default(15000),
  graceMinutes: z.number().int().min(0).default(15),

  // 시간대별 요금 설정
  timeBasedEnabled: z.boolean().default(false),

  // 야간 요금
  nightRateEnabled: z.boolean().default(false),
  nightStart: TimeStringSchema.default('22:00'),
  nightEnd: TimeStringSchema.default('06:00'),
  nightRate: TimeBasedRateSchema.optional(),

  // 주말 요금
  weekendRateEnabled: z.boolean().default(false),
  weekendRate: TimeBasedRateSchema.optional(),

  // 주말+야간 요금
  weekendNightRateEnabled: z.boolean().default(false),
  weekendNightRate: TimeBasedRateSchema.optional(),

  // (deprecated) 기존 필드 호환성 유지
  nightDiscountEnabled: z.boolean().default(false),
  nightDiscountPercent: z.number().int().min(0).max(100).optional(),
});

/** 요금표 생성/수정 스키마 */
export const RatePlanRequestSchema = z.object({
  name: z.string().min(1).max(100),
  rules: RateRulesSchema,
  isActive: z.boolean().default(false),
});
