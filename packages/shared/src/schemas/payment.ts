import { z } from 'zod';

export const PaymentMethodSchema = z.enum(['CARD', 'CASH', 'MOBILE', 'MOCK']);
export const PaymentRecordStatusSchema = z.enum([
  'PENDING',
  'PAID',
  'FAILED',
  'CANCELLED',
]);

/** Mock 결제 스키마 */
export const MockPaymentRequestSchema = z.object({
  sessionId: z.string().min(1),
  amount: z.number().int().min(0),
  method: PaymentMethodSchema.default('MOCK'),
});

/** (DELUXE) 모바일 결제 초기화 스키마 */
export const MobilePaymentInitRequestSchema = z.object({
  sessionId: z.string().min(1),
  returnUrl: z.string().url().optional(),
});

/** (DELUXE) 모바일 결제 확인 스키마 */
export const MobilePaymentConfirmRequestSchema = z.object({
  paymentToken: z.string().min(1),
  pgTxId: z.string().min(1),
});
