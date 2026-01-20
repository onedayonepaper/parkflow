import { z } from 'zod';

/** 요금 규칙 스키마 */
export const RateRulesSchema = z.object({
  freeMinutes: z.number().int().min(0).default(30),
  baseMinutes: z.number().int().min(1).default(30),
  baseFee: z.number().int().min(0).default(1000),
  additionalMinutes: z.number().int().min(1).default(10),
  additionalFee: z.number().int().min(0).default(500),
  dailyMax: z.number().int().min(0).default(15000),
  graceMinutes: z.number().int().min(0).default(15),
  nightDiscountEnabled: z.boolean().default(false),
  nightStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  nightEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  nightDiscountPercent: z.number().int().min(0).max(100).optional(),
});

/** 요금표 생성/수정 스키마 */
export const RatePlanRequestSchema = z.object({
  name: z.string().min(1).max(100),
  rules: RateRulesSchema,
  isActive: z.boolean().default(false),
});
