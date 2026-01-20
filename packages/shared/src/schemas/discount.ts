import { z } from 'zod';

export const DiscountTypeSchema = z.enum([
  'AMOUNT',
  'PERCENT',
  'FREE_MINUTES',
  'FREE_ALL',
]);

/** 할인 규칙 생성/수정 스키마 */
export const DiscountRuleRequestSchema = z.object({
  name: z.string().min(1).max(100),
  type: DiscountTypeSchema,
  value: z.number().int().min(0),
  isStackable: z.boolean().default(true),
  maxApplyCount: z.number().int().min(1).nullable().optional(),
});

/** 할인 적용 스키마 */
export const ApplyDiscountRequestSchema = z.object({
  discountRuleId: z.string().min(1),
  valueOverride: z.number().int().min(0).nullable().optional(),
  reason: z.string().max(500).optional(),
});

/** 정기권 생성/수정 스키마 */
export const MembershipRequestSchema = z.object({
  plateNo: z.string().min(1).max(20),
  memberName: z.string().max(100).optional(),
  validFrom: z.string().datetime({ offset: true }),
  validTo: z.string().datetime({ offset: true }),
  note: z.string().max(500).optional(),
});
