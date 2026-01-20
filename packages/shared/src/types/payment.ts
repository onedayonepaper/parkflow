/** 결제 수단 */
export type PaymentMethod = 'CARD' | 'CASH' | 'MOBILE' | 'MOCK';

/** 결제 상태 (payment 테이블) */
export type PaymentRecordStatus =
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'CANCELLED';

/** 결제 레코드 */
export interface Payment {
  id: string;
  sessionId: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentRecordStatus;
  pgTxId: string | null;
  approvedAt: string | null;
  rawJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

/** Mock 결제 요청 */
export interface MockPaymentRequest {
  sessionId: string;
  amount: number;
  method?: PaymentMethod;
}

/** Mock 결제 응답 */
export interface MockPaymentResponse {
  paymentId: string;
  status: PaymentRecordStatus;
  approvedAt: string;
}

/** (DELUXE) 모바일 결제 초기화 요청 */
export interface MobilePaymentInitRequest {
  sessionId: string;
  returnUrl?: string;
}

/** (DELUXE) 모바일 결제 초기화 응답 */
export interface MobilePaymentInitResponse {
  paymentToken: string;
  paymentUrl: string;
  expiresAt: string;
}

/** (DELUXE) 모바일 결제 확인 요청 */
export interface MobilePaymentConfirmRequest {
  paymentToken: string;
  pgTxId: string;
}
