import { z } from 'zod';

export const SessionStatusSchema = z.enum([
  'PARKING',
  'EXIT_PENDING',
  'PAID',
  'CLOSED',
  'ERROR',
]);

export const PaymentStatusSchema = z.enum([
  'NONE',
  'PENDING',
  'PAID',
  'FAILED',
  'CANCELLED',
]);

export const CloseReasonSchema = z.enum([
  'NORMAL_EXIT',
  'MANUAL_EXIT',
  'FORCE_CLOSE',
  'SYSTEM_CLOSE',
  'ERROR_RECOVERY',
]);

/** 세션 목록 필터 스키마 */
export const SessionListFilterSchema = z.object({
  status: SessionStatusSchema.optional(),
  plateNo: z.string().optional(),
  laneId: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/** 세션 정정 스키마 */
export const SessionCorrectRequestSchema = z.object({
  plateNoCorrected: z.string().min(1).max(20).optional(),
  entryAt: z.string().datetime({ offset: true }).optional(),
  exitAt: z.string().datetime({ offset: true }).optional(),
  reason: z.string().min(1).max(500),
}).refine(
  (data) => data.plateNoCorrected || data.entryAt || data.exitAt,
  { message: '최소 하나의 정정 항목이 필요합니다' }
);

/** 세션 재계산 스키마 */
export const SessionRecalcRequestSchema = z.object({
  ratePlanId: z.string().optional(),
  reason: z.string().min(1).max(500),
});

/** 세션 강제 종료 스키마 */
export const SessionForceCloseRequestSchema = z.object({
  reason: z.string().min(1).max(500),
  note: z.string().max(1000).optional(),
});
