/**
 * TossPayments PG 연동 서비스
 *
 * 결제 흐름:
 * 1. 클라이언트에서 결제창 호출 (SDK 또는 API)
 * 2. 결제 완료 후 successUrl로 리다이렉트 (paymentKey, orderId, amount 전달)
 * 3. 서버에서 결제 승인 API 호출
 * 4. 결제 완료 처리
 *
 * 환경 설정:
 * - PAYMENT_MODE: 'live' | 'test' | 'mock'
 * - TOSS_SECRET_KEY: 토스페이먼츠 시크릿 키
 * - TOSS_CLIENT_KEY: 토스페이먼츠 클라이언트 키
 * - TOSS_WEBHOOK_SECRET: Webhook 서명 검증용 시크릿
 */

import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

interface TossPaymentsConfig {
  secretKey: string;
  clientKey: string;
  apiUrl: string;
  webhookSecret?: string;
}

interface PaymentConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

interface PaymentCancelRequest {
  paymentKey: string;
  cancelReason: string;
  cancelAmount?: number;
}

interface TossPaymentResponse {
  mId: string;
  version: string;
  paymentKey: string;
  status: 'READY' | 'IN_PROGRESS' | 'WAITING_FOR_DEPOSIT' | 'DONE' | 'CANCELED' | 'PARTIAL_CANCELED' | 'ABORTED' | 'EXPIRED';
  lastTransactionKey: string;
  orderId: string;
  orderName: string;
  requestedAt: string;
  approvedAt: string;
  useEscrow: boolean;
  cultureExpense: boolean;
  card?: {
    issuerCode: string;
    acquirerCode: string;
    number: string;
    installmentPlanMonths: number;
    isInterestFree: boolean;
    interestPayer: string | null;
    approveNo: string;
    useCardPoint: boolean;
    cardType: string;
    ownerType: string;
    acquireStatus: string;
    amount: number;
  };
  virtualAccount?: {
    accountNumber: string;
    accountType: string;
    bankCode: string;
    customerName: string;
    dueDate: string;
    expired: boolean;
    settlementStatus: string;
    refundStatus: string;
  };
  transfer?: {
    bankCode: string;
    settlementStatus: string;
  };
  easyPay?: {
    provider: string;
    amount: number;
    discountAmount: number;
  };
  country: string;
  failure?: {
    code: string;
    message: string;
  };
  totalAmount: number;
  balanceAmount: number;
  suppliedAmount: number;
  vat: number;
  taxFreeAmount: number;
  method: string;
  receipt?: {
    url: string;
  };
  cancels?: Array<{
    cancelReason: string;
    canceledAt: string;
    cancelAmount: number;
    taxFreeAmount: number;
    refundableAmount: number;
    transactionKey: string;
    receiptKey: string;
    cancelStatus: string;
  }>;
}

interface TossErrorResponse {
  code: string;
  message: string;
}

interface PaymentServiceResult<T = TossPaymentResponse> {
  success: boolean;
  data?: T;
  error?: TossErrorResponse;
}

// Webhook 이벤트 타입
interface TossWebhookPayload {
  eventType: 'PAYMENT_STATUS_CHANGED' | 'DEPOSIT_CALLBACK' | 'PAYOUT_STATUS_CHANGED';
  createdAt: string;
  data: TossPaymentResponse;
}

// ============================================================================
// Payment Service Interface
// ============================================================================

export interface IPaymentService {
  confirmPayment(data: PaymentConfirmRequest): Promise<PaymentServiceResult>;
  getPayment(paymentKey: string): Promise<PaymentServiceResult>;
  cancelPayment(data: PaymentCancelRequest, originalAmount?: number): Promise<PaymentServiceResult>;
  getClientKey(): string;
  verifyWebhookSignature(payload: string, signature: string): boolean;
}

// ============================================================================
// TossPayments Service (실제 결제)
// ============================================================================

export class TossPaymentsService implements IPaymentService {
  private config: TossPaymentsConfig;

  constructor(config: TossPaymentsConfig) {
    this.config = config;
  }

  /**
   * Basic 인증 헤더 생성
   */
  private getAuthHeader(): string {
    const encoded = Buffer.from(`${this.config.secretKey}:`).toString('base64');
    return `Basic ${encoded}`;
  }

  /**
   * Webhook 서명 검증
   * 토스페이먼츠에서 전송하는 Webhook의 서명을 검증합니다.
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      console.warn('[TossPayments] Webhook secret not configured, skipping signature verification');
      return true; // 개발 환경에서는 skip
    }

    try {
      const expectedSignature = crypto
        .createHmac('sha256', this.config.webhookSecret)
        .update(payload)
        .digest('base64');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('[TossPayments] Webhook signature verification failed:', error);
      return false;
    }
  }

  /**
   * 결제 승인 API
   */
  async confirmPayment(data: PaymentConfirmRequest): Promise<PaymentServiceResult> {
    try {
      // 금액 검증
      if (data.amount <= 0) {
        return {
          success: false,
          error: { code: 'INVALID_AMOUNT', message: '결제 금액은 0보다 커야 합니다.' },
        };
      }

      const response = await fetch(`${this.config.apiUrl}/v1/payments/confirm`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentKey: data.paymentKey,
          orderId: data.orderId,
          amount: data.amount,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('[TossPayments] Confirm payment failed:', result);
        return {
          success: false,
          error: result as TossErrorResponse,
        };
      }

      console.log('[TossPayments] Payment confirmed:', {
        paymentKey: data.paymentKey,
        orderId: data.orderId,
        amount: data.amount,
      });

      return {
        success: true,
        data: result as TossPaymentResponse,
      };
    } catch (error) {
      console.error('[TossPayments] Confirm payment error:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: '결제 승인 요청 중 오류가 발생했습니다.',
        },
      };
    }
  }

  /**
   * 결제 조회 API
   */
  async getPayment(paymentKey: string): Promise<PaymentServiceResult> {
    try {
      const response = await fetch(`${this.config.apiUrl}/v1/payments/${paymentKey}`, {
        method: 'GET',
        headers: {
          'Authorization': this.getAuthHeader(),
        },
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result as TossErrorResponse,
        };
      }

      return {
        success: true,
        data: result as TossPaymentResponse,
      };
    } catch (error) {
      console.error('[TossPayments] Get payment error:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: '결제 조회 요청 중 오류가 발생했습니다.',
        },
      };
    }
  }

  /**
   * 결제 취소 API
   * @param data 취소 요청 데이터
   * @param originalAmount 원래 결제 금액 (부분 취소 시 검증용)
   */
  async cancelPayment(
    data: PaymentCancelRequest,
    originalAmount?: number
  ): Promise<PaymentServiceResult> {
    try {
      // 부분 취소 금액 검증
      if (data.cancelAmount !== undefined) {
        if (data.cancelAmount <= 0) {
          return {
            success: false,
            error: { code: 'INVALID_CANCEL_AMOUNT', message: '취소 금액은 0보다 커야 합니다.' },
          };
        }

        if (originalAmount !== undefined && data.cancelAmount > originalAmount) {
          return {
            success: false,
            error: { code: 'EXCEED_CANCEL_AMOUNT', message: '취소 금액이 원래 결제 금액을 초과합니다.' },
          };
        }
      }

      const response = await fetch(`${this.config.apiUrl}/v1/payments/${data.paymentKey}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cancelReason: data.cancelReason,
          ...(data.cancelAmount ? { cancelAmount: data.cancelAmount } : {}),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('[TossPayments] Cancel payment failed:', result);
        return {
          success: false,
          error: result as TossErrorResponse,
        };
      }

      console.log('[TossPayments] Payment canceled:', {
        paymentKey: data.paymentKey,
        cancelReason: data.cancelReason,
        cancelAmount: data.cancelAmount,
      });

      return {
        success: true,
        data: result as TossPaymentResponse,
      };
    } catch (error) {
      console.error('[TossPayments] Cancel payment error:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: '결제 취소 요청 중 오류가 발생했습니다.',
        },
      };
    }
  }

  /**
   * 클라이언트 키 반환
   */
  getClientKey(): string {
    return this.config.clientKey;
  }

  /**
   * 결제 요청 URL 생성 (키오스크용)
   */
  generatePaymentUrl(params: {
    orderId: string;
    orderName: string;
    amount: number;
    customerName?: string;
    customerEmail?: string;
    successUrl: string;
    failUrl: string;
  }): string {
    const queryParams = new URLSearchParams({
      clientKey: this.config.clientKey,
      orderId: params.orderId,
      orderName: params.orderName,
      amount: params.amount.toString(),
      successUrl: params.successUrl,
      failUrl: params.failUrl,
      ...(params.customerName ? { customerName: params.customerName } : {}),
      ...(params.customerEmail ? { customerEmail: params.customerEmail } : {}),
    });

    return `https://pay.tosspayments.com/v1/payments?${queryParams.toString()}`;
  }
}

// ============================================================================
// Mock Payment Service (개발/테스트용)
// ============================================================================

export class MockPaymentService implements IPaymentService {
  private clientKey = 'mock_ck_test_client_key';
  private mockPayments: Map<string, TossPaymentResponse> = new Map();

  async confirmPayment(data: PaymentConfirmRequest): Promise<PaymentServiceResult> {
    console.log('[MOCK Payment] Confirming payment:', data);

    // 금액 검증
    if (data.amount <= 0) {
      return {
        success: false,
        error: { code: 'INVALID_AMOUNT', message: '결제 금액은 0보다 커야 합니다.' },
      };
    }

    // 시뮬레이션 딜레이
    await new Promise(resolve => setTimeout(resolve, 300));

    const payment: TossPaymentResponse = {
      mId: 'mock_mid',
      version: '2022-06-08',
      paymentKey: data.paymentKey,
      orderId: data.orderId,
      orderName: '주차 요금',
      status: 'DONE',
      method: 'CARD',
      totalAmount: data.amount,
      balanceAmount: data.amount,
      suppliedAmount: Math.floor(data.amount / 1.1),
      vat: Math.floor(data.amount / 11),
      taxFreeAmount: 0,
      country: 'KR',
      lastTransactionKey: `txn_${Date.now()}`,
      requestedAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
      useEscrow: false,
      cultureExpense: false,
      card: {
        issuerCode: '11',
        acquirerCode: '11',
        number: '****-****-****-1234',
        installmentPlanMonths: 0,
        isInterestFree: false,
        interestPayer: null,
        approveNo: Math.random().toString().slice(2, 10),
        useCardPoint: false,
        cardType: 'CREDIT',
        ownerType: 'PERSONAL',
        acquireStatus: 'READY',
        amount: data.amount,
      },
    };

    this.mockPayments.set(data.paymentKey, payment);

    return {
      success: true,
      data: payment,
    };
  }

  async getPayment(paymentKey: string): Promise<PaymentServiceResult> {
    console.log('[MOCK Payment] Getting payment:', paymentKey);

    const payment = this.mockPayments.get(paymentKey);
    if (!payment) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: '결제 정보를 찾을 수 없습니다.' },
      };
    }

    return {
      success: true,
      data: payment,
    };
  }

  async cancelPayment(data: PaymentCancelRequest, originalAmount?: number): Promise<PaymentServiceResult> {
    console.log('[MOCK Payment] Canceling payment:', data);

    const payment = this.mockPayments.get(data.paymentKey);
    if (!payment) {
      return {
        success: false,
        error: { code: 'NOT_FOUND', message: '결제 정보를 찾을 수 없습니다.' },
      };
    }

    if (payment.status === 'CANCELED') {
      return {
        success: false,
        error: { code: 'ALREADY_CANCELED', message: '이미 취소된 결제입니다.' },
      };
    }

    // 부분 취소 금액 검증
    if (data.cancelAmount !== undefined) {
      if (data.cancelAmount <= 0) {
        return {
          success: false,
          error: { code: 'INVALID_CANCEL_AMOUNT', message: '취소 금액은 0보다 커야 합니다.' },
        };
      }
      // originalAmount가 전달되면 그것과 비교, 아니면 저장된 payment의 balanceAmount와 비교
      const maxCancelAmount = originalAmount ?? payment.balanceAmount;
      if (data.cancelAmount > maxCancelAmount) {
        return {
          success: false,
          error: { code: 'EXCEED_CANCEL_AMOUNT', message: '취소 금액이 잔여 금액을 초과합니다.' },
        };
      }
    }

    await new Promise(resolve => setTimeout(resolve, 200));

    const cancelAmount = data.cancelAmount || payment.balanceAmount;
    const isFull = cancelAmount === payment.totalAmount;

    const updatedPayment: TossPaymentResponse = {
      ...payment,
      status: isFull ? 'CANCELED' : 'PARTIAL_CANCELED',
      balanceAmount: payment.balanceAmount - cancelAmount,
      cancels: [
        ...(payment.cancels || []),
        {
          cancelReason: data.cancelReason,
          canceledAt: new Date().toISOString(),
          cancelAmount,
          taxFreeAmount: 0,
          refundableAmount: payment.balanceAmount - cancelAmount,
          transactionKey: `txn_cancel_${Date.now()}`,
          receiptKey: `receipt_${Date.now()}`,
          cancelStatus: 'DONE',
        },
      ],
    };

    this.mockPayments.set(data.paymentKey, updatedPayment);

    return {
      success: true,
      data: updatedPayment,
    };
  }

  getClientKey(): string {
    return this.clientKey;
  }

  verifyWebhookSignature(_payload: string, _signature: string): boolean {
    console.log('[MOCK Payment] Webhook signature verification (always true in mock)');
    return true;
  }
}

// ============================================================================
// Service Factory
// ============================================================================

let paymentServiceInstance: IPaymentService | null = null;

/**
 * 결제 서비스 인스턴스 가져오기
 *
 * PAYMENT_MODE 환경변수에 따라 적절한 서비스를 반환합니다:
 * - 'live': 실제 토스페이먼츠 API (TOSS_SECRET_KEY, TOSS_CLIENT_KEY 필수)
 * - 'test': 토스페이먼츠 테스트 API (테스트 키 필수)
 * - 'mock': 로컬 Mock 서비스 (기본값, 개발용)
 */
export function getPaymentService(): IPaymentService {
  if (paymentServiceInstance) {
    return paymentServiceInstance;
  }

  const mode = process.env.PAYMENT_MODE || 'mock';
  const nodeEnv = process.env.NODE_ENV || 'development';

  console.log(`[Payment] Initializing payment service (mode: ${mode}, env: ${nodeEnv})`);

  if (mode === 'mock') {
    console.log('[Payment] Using Mock payment service');
    paymentServiceInstance = new MockPaymentService();
    return paymentServiceInstance;
  }

  // live 또는 test 모드에서는 토스페이먼츠 키 필수
  const secretKey = process.env.TOSS_SECRET_KEY;
  const clientKey = process.env.TOSS_CLIENT_KEY;
  const webhookSecret = process.env.TOSS_WEBHOOK_SECRET;

  if (!secretKey || !clientKey) {
    if (nodeEnv === 'production') {
      console.error('[Payment] CRITICAL: TOSS_SECRET_KEY and TOSS_CLIENT_KEY are required in production!');
      console.error('[Payment] Please set these environment variables.');
      process.exit(1);
    }

    console.warn('[Payment] TossPayments keys not configured, falling back to Mock service');
    paymentServiceInstance = new MockPaymentService();
    return paymentServiceInstance;
  }

  // 프로덕션 환경에서 테스트 키 사용 방지
  if (nodeEnv === 'production' && mode === 'live') {
    if (secretKey.startsWith('test_') || clientKey.startsWith('test_')) {
      console.error('[Payment] CRITICAL: Test keys detected in production with live mode!');
      console.error('[Payment] Please use production keys or change PAYMENT_MODE to "test".');
      process.exit(1);
    }
  }

  console.log(`[Payment] Using TossPayments service (mode: ${mode})`);
  paymentServiceInstance = new TossPaymentsService({
    secretKey,
    clientKey,
    webhookSecret,
    apiUrl: 'https://api.tosspayments.com',
  });

  return paymentServiceInstance;
}

/**
 * 결제 서비스 리셋 (테스트용)
 */
export function resetPaymentService(): void {
  paymentServiceInstance = null;
}

// ============================================================================
// Legacy exports (하위 호환성)
// ============================================================================

/** @deprecated Use getPaymentService() instead */
export function getTossPaymentsService(): IPaymentService {
  return getPaymentService();
}
