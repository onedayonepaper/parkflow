/**
 * TossPayments PG 연동 서비스
 *
 * 결제 흐름:
 * 1. 클라이언트에서 결제창 호출 (SDK 또는 API)
 * 2. 결제 완료 후 successUrl로 리다이렉트 (paymentKey, orderId, amount 전달)
 * 3. 서버에서 결제 승인 API 호출
 * 4. 결제 완료 처리
 */

interface TossPaymentsConfig {
  secretKey: string;
  clientKey: string;
  apiUrl: string;
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

export class TossPaymentsService {
  private config: TossPaymentsConfig;

  constructor(config: Partial<TossPaymentsConfig> = {}) {
    this.config = {
      secretKey: config.secretKey || process.env.TOSS_SECRET_KEY || 'test_sk_0RnYX2w532yM6YP9KxDVGJzNdWDo',
      clientKey: config.clientKey || process.env.TOSS_CLIENT_KEY || 'test_ck_D5GePWvyJnrK0W0k6q8gLzN97Eoq',
      apiUrl: config.apiUrl || 'https://api.tosspayments.com',
    };
  }

  /**
   * Basic 인증 헤더 생성
   */
  private getAuthHeader(): string {
    const encoded = Buffer.from(`${this.config.secretKey}:`).toString('base64');
    return `Basic ${encoded}`;
  }

  /**
   * 결제 승인 API
   * 결제창에서 인증이 완료된 후 실제 결제를 승인합니다.
   */
  async confirmPayment(data: PaymentConfirmRequest): Promise<{ success: boolean; data?: TossPaymentResponse; error?: TossErrorResponse }> {
    try {
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
  async getPayment(paymentKey: string): Promise<{ success: boolean; data?: TossPaymentResponse; error?: TossErrorResponse }> {
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
   */
  async cancelPayment(data: PaymentCancelRequest): Promise<{ success: boolean; data?: TossPaymentResponse; error?: TossErrorResponse }> {
    try {
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
   * 클라이언트 키 반환 (프론트엔드에서 사용)
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

// 싱글톤 인스턴스
let tossPaymentsInstance: TossPaymentsService | null = null;

export function getTossPaymentsService(config?: Partial<TossPaymentsConfig>): TossPaymentsService {
  if (!tossPaymentsInstance || config) {
    tossPaymentsInstance = new TossPaymentsService(config);
  }
  return tossPaymentsInstance;
}

// Mock 결제 서비스 (테스트용)
export class MockPaymentService {
  async confirmPayment(data: PaymentConfirmRequest): Promise<{ success: boolean; data?: any; error?: TossErrorResponse }> {
    console.log('[MOCK Payment] Confirming payment:', data);

    // 시뮬레이션 딜레이
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      success: true,
      data: {
        paymentKey: data.paymentKey,
        orderId: data.orderId,
        status: 'DONE',
        method: 'CARD',
        totalAmount: data.amount,
        approvedAt: new Date().toISOString(),
        card: {
          number: '****-****-****-1234',
          issuerCode: '11',
          approveNo: Math.random().toString().slice(2, 10),
        },
      },
    };
  }

  async cancelPayment(data: PaymentCancelRequest): Promise<{ success: boolean; data?: any; error?: TossErrorResponse }> {
    console.log('[MOCK Payment] Canceling payment:', data);

    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      success: true,
      data: {
        paymentKey: data.paymentKey,
        status: 'CANCELED',
        cancelReason: data.cancelReason,
        canceledAt: new Date().toISOString(),
      },
    };
  }
}
