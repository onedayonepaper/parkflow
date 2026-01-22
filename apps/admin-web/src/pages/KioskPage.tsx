import { useState, useRef, useEffect } from 'react';

// 토스페이먼츠 SDK 타입
declare global {
  interface Window {
    TossPayments?: (clientKey: string) => {
      requestPayment: (
        method: string,
        options: {
          amount: number;
          orderId: string;
          orderName: string;
          customerName?: string;
          successUrl: string;
          failUrl: string;
        }
      ) => Promise<void>;
    };
  }
}

interface SessionInfo {
  id: string;
  plateNo: string;
  status: string;
  entryAt: string;
  exitAt: string | null;
  rawFee: number;
  discountTotal: number;
  finalFee: number;
  paymentStatus: string;
  durationMinutes: number;
}

interface ReceiptData {
  receiptNo: string;
  plateNo: string;
  entryAt: string;
  exitAt: string;
  durationMinutes: number;
  rawFee: number;
  discountTotal: number;
  finalFee: number;
  paidAt: string;
}

const API_BASE = '/api';
const KIOSK_API_KEY = 'dev-kiosk-key-2024'; // TODO: 환경변수로 이동

// 숫자 전용 키패드 컴포넌트 (대형 버튼)
function NumericKeypad({
  onKeyPress,
  onBackspace,
  onClear,
  disabled,
}: {
  onKeyPress: (key: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['C', '0', '←'],
  ];

  const handleKeyPress = (key: string) => {
    if (disabled) return;
    if (key === 'C') {
      onClear();
    } else if (key === '←') {
      onBackspace();
    } else {
      onKeyPress(key);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-3 p-4">
      {keys.flat().map((key) => (
        <button
          key={key}
          onClick={() => handleKeyPress(key)}
          disabled={disabled}
          className={`
            h-20 text-3xl font-bold rounded-2xl transition-all duration-150
            active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
            ${key === 'C'
              ? 'bg-red-100 text-red-600 hover:bg-red-200 active:bg-red-300'
              : key === '←'
                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 active:bg-yellow-300'
                : 'bg-white text-gray-800 hover:bg-gray-50 active:bg-gray-100 shadow-md'
            }
          `}
        >
          {key === '←' ? (
            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
            </svg>
          ) : key}
        </button>
      ))}
    </div>
  );
}

// Receipt Component for printing
function Receipt({ data, onClose }: { data: ReceiptData; onClose: () => void }) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      alert('팝업이 차단되었습니다. 팝업을 허용해주세요.');
      return;
    }

    const formatTime = (iso: string) => {
      return new Date(iso).toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const formatDuration = (minutes: number) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      if (hours > 0) return `${hours}시간 ${mins}분`;
      return `${mins}분`;
    };

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>주차 영수증</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Malgun Gothic', sans-serif;
            width: 80mm;
            padding: 5mm;
            font-size: 12px;
          }
          .receipt {
            text-align: center;
          }
          .header {
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 10px;
            padding-bottom: 10px;
            border-bottom: 2px dashed #333;
          }
          .logo {
            font-size: 24px;
            margin-bottom: 5px;
          }
          .receipt-no {
            font-size: 10px;
            color: #666;
            margin-bottom: 10px;
          }
          .section {
            text-align: left;
            margin: 10px 0;
            padding: 10px 0;
            border-bottom: 1px dashed #ccc;
          }
          .row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
          }
          .label {
            color: #666;
          }
          .value {
            font-weight: 500;
          }
          .plate-no {
            font-size: 20px;
            font-weight: bold;
            text-align: center;
            margin: 15px 0;
            padding: 10px;
            background: #f5f5f5;
            border-radius: 5px;
          }
          .total {
            font-size: 16px;
            font-weight: bold;
            margin: 15px 0;
            padding: 10px;
            background: #e8f5e9;
            border-radius: 5px;
          }
          .total .row {
            align-items: center;
          }
          .total .value {
            font-size: 20px;
            color: #2e7d32;
          }
          .discount {
            color: #e53935;
          }
          .footer {
            margin-top: 15px;
            padding-top: 10px;
            border-top: 2px dashed #333;
            font-size: 10px;
            color: #666;
          }
          .notice {
            margin-top: 10px;
            padding: 8px;
            background: #fff3e0;
            border-radius: 5px;
            font-size: 11px;
            color: #e65100;
          }
          @media print {
            body { width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <div class="logo">🅿️ ParkFlow</div>
            <div>주차요금 영수증</div>
          </div>
          <div class="receipt-no">영수증 번호: ${data.receiptNo}</div>

          <div class="plate-no">${data.plateNo}</div>

          <div class="section">
            <div class="row">
              <span class="label">입차 시간</span>
              <span class="value">${formatTime(data.entryAt)}</span>
            </div>
            <div class="row">
              <span class="label">출차 시간</span>
              <span class="value">${formatTime(data.exitAt)}</span>
            </div>
            <div class="row">
              <span class="label">주차 시간</span>
              <span class="value">${formatDuration(data.durationMinutes)}</span>
            </div>
          </div>

          <div class="section">
            <div class="row">
              <span class="label">주차 요금</span>
              <span class="value">${data.rawFee.toLocaleString()}원</span>
            </div>
            ${data.discountTotal > 0 ? `
            <div class="row discount">
              <span class="label">할인 금액</span>
              <span class="value">-${data.discountTotal.toLocaleString()}원</span>
            </div>
            ` : ''}
          </div>

          <div class="total">
            <div class="row">
              <span>결제 금액</span>
              <span class="value">${data.finalFee.toLocaleString()}원</span>
            </div>
          </div>

          <div class="section">
            <div class="row">
              <span class="label">결제 일시</span>
              <span class="value">${formatTime(data.paidAt)}</span>
            </div>
            <div class="row">
              <span class="label">결제 방법</span>
              <span class="value">카드결제</span>
            </div>
          </div>

          <div class="notice">
            ⚠️ 결제 후 15분 이내에 출차해 주세요.
          </div>

          <div class="footer">
            <p>이용해 주셔서 감사합니다.</p>
            <p>문의: 1588-0000</p>
            <p style="margin-top: 5px;">※ 본 영수증은 세금계산서가 아닙니다.</p>
          </div>
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) return `${hours}시간 ${mins}분`;
    return `${mins}분`;
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Receipt Preview */}
        <div ref={receiptRef} className="p-6 bg-white">
          {/* Header */}
          <div className="text-center border-b-2 border-dashed border-gray-300 pb-4 mb-4">
            <div className="text-3xl mb-1">🅿️</div>
            <h3 className="text-xl font-bold text-gray-800">ParkFlow</h3>
            <p className="text-gray-500 text-sm">주차요금 영수증</p>
            <p className="text-gray-400 text-xs mt-1">No. {data.receiptNo}</p>
          </div>

          {/* Plate Number */}
          <div className="text-center bg-gray-100 rounded-lg py-3 mb-4">
            <span className="text-2xl font-bold text-gray-800">{data.plateNo}</span>
          </div>

          {/* Details */}
          <div className="space-y-2 text-sm border-b border-dashed border-gray-200 pb-4 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-500">입차 시간</span>
              <span className="font-medium">{formatTime(data.entryAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">출차 시간</span>
              <span className="font-medium">{formatTime(data.exitAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">주차 시간</span>
              <span className="font-medium">{formatDuration(data.durationMinutes)}</span>
            </div>
          </div>

          {/* Fee Breakdown */}
          <div className="space-y-2 text-sm border-b border-dashed border-gray-200 pb-4 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-500">주차 요금</span>
              <span className="font-medium">{data.rawFee.toLocaleString()}원</span>
            </div>
            {data.discountTotal > 0 && (
              <div className="flex justify-between text-red-500">
                <span>할인 금액</span>
                <span>-{data.discountTotal.toLocaleString()}원</span>
              </div>
            )}
          </div>

          {/* Total */}
          <div className="bg-green-50 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center">
              <span className="font-bold text-gray-700">결제 금액</span>
              <span className="text-2xl font-bold text-green-600">
                {data.finalFee.toLocaleString()}원
              </span>
            </div>
          </div>

          {/* Payment Info */}
          <div className="space-y-1 text-xs text-gray-500 mb-4">
            <div className="flex justify-between">
              <span>결제 일시</span>
              <span>{formatTime(data.paidAt)}</span>
            </div>
            <div className="flex justify-between">
              <span>결제 방법</span>
              <span>카드결제</span>
            </div>
          </div>

          {/* Notice */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center text-sm text-orange-700">
            ⚠️ 결제 후 15분 이내에 출차해 주세요.
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-gray-50 border-t space-y-2">
          <button
            onClick={handlePrint}
            className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            영수증 출력
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-300 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KioskPage() {
  const [digits, setDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [error, setError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [step, setStep] = useState<'input' | 'select' | 'confirm' | 'payment-select' | 'complete'>('input');
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [tossClientKey, setTossClientKey] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'mock' | 'toss'>('mock');

  // 토스페이먼츠 클라이언트 키 로드
  useEffect(() => {
    const loadTossClientKey = async () => {
      try {
        const response = await fetch(`${API_BASE}/payments/toss/client-key`);
        const result = await response.json();
        if (result.ok && result.data?.clientKey) {
          setTossClientKey(result.data.clientKey);
          // 토스페이먼츠 SDK 로드
          if (!document.getElementById('toss-payments-sdk')) {
            const script = document.createElement('script');
            script.id = 'toss-payments-sdk';
            script.src = 'https://js.tosspayments.com/v1/payment';
            script.async = true;
            document.head.appendChild(script);
          }
        }
      } catch (err) {
        console.log('토스페이먼츠 클라이언트 키 로드 실패:', err);
      }
    };
    loadTossClientKey();
  }, []);

  // 4자리 입력 시 자동 검색
  const searchByDigits = async (searchDigits: string) => {
    if (searchDigits.length !== 4) return;

    setLoading(true);
    setError('');
    setSessions([]);
    setSession(null);
    setPaymentSuccess(false);

    try {
      const response = await fetch(`${API_BASE}/kiosk/search?digits=${searchDigits}`, {
        headers: { 'x-kiosk-api-key': KIOSK_API_KEY },
      });
      const result = await response.json();

      if (result.ok && result.data && result.data.length > 0) {
        if (result.data.length === 1) {
          // 단일 결과: 바로 확인 화면으로
          setSession(result.data[0]);
          setStep('confirm');
        } else {
          // 복수 결과: 선택 화면으로
          setSessions(result.data);
          setStep('select');
        }
      } else {
        setError(result.error?.message || '해당 번호로 주차 중인 차량을 찾을 수 없습니다.');
      }
    } catch {
      setError('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 숫자 키패드 핸들러
  const handleKeyPress = (key: string) => {
    if (digits.length >= 4) return;
    const newDigits = digits + key;
    setDigits(newDigits);
    setError('');

    // 4자리 입력 시 자동 검색
    if (newDigits.length === 4) {
      searchByDigits(newDigits);
    }
  };

  const handleBackspace = () => {
    setDigits((prev) => prev.slice(0, -1));
    setError('');
  };

  const handleClear = () => {
    setDigits('');
    setError('');
  };

  // 차량 선택
  const selectSession = (selectedSession: SessionInfo) => {
    setSession(selectedSession);
    setStep('confirm');
  };

  // 결제 수단 선택으로 이동
  const goToPaymentSelect = () => {
    setStep('payment-select');
  };

  // Mock 결제 처리
  const processMockPayment = async () => {
    if (!session) return;

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/kiosk/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-kiosk-api-key': KIOSK_API_KEY,
        },
        body: JSON.stringify({
          sessionId: session.id,
          amount: session.finalFee,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        const paidAt = new Date().toISOString();
        const receiptNo = `R${Date.now().toString(36).toUpperCase()}`;
        setReceiptData({
          receiptNo,
          plateNo: session.plateNo,
          entryAt: session.entryAt,
          exitAt: session.exitAt || paidAt,
          durationMinutes: session.durationMinutes,
          rawFee: session.rawFee,
          discountTotal: session.discountTotal,
          finalFee: session.finalFee,
          paidAt,
        });
        setPaymentSuccess(true);
        setStep('complete');
      } else {
        setError(result.error?.message || '결제에 실패했습니다.');
      }
    } catch {
      setError('결제 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 토스페이먼츠 결제 처리
  const processTossPayment = async () => {
    if (!session || !tossClientKey) {
      setError('결제 준비 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    try {
      const tossPayments = window.TossPayments?.(tossClientKey);
      if (!tossPayments) {
        setError('결제 모듈 로드에 실패했습니다.');
        return;
      }

      const orderId = `KIOSK_${session.id}_${Date.now()}`;
      const currentUrl = window.location.origin;

      await tossPayments.requestPayment('카드', {
        amount: session.finalFee,
        orderId,
        orderName: `주차요금 - ${session.plateNo}`,
        customerName: session.plateNo,
        successUrl: `${currentUrl}/kiosk/payment/success?sessionId=${session.id}`,
        failUrl: `${currentUrl}/kiosk/payment/fail?sessionId=${session.id}`,
      });
    } catch (err: any) {
      if (err.code === 'USER_CANCEL') {
        setError('결제가 취소되었습니다.');
      } else {
        setError(err.message || '결제 처리 중 오류가 발생했습니다.');
      }
    }
  };

  const processPayment = async () => {
    if (paymentMethod === 'toss') {
      await processTossPayment();
    } else {
      await processMockPayment();
    }
  };

  const reset = () => {
    setDigits('');
    setSessions([]);
    setSession(null);
    setError('');
    setPaymentSuccess(false);
    setStep('input');
    setReceiptData(null);
    setShowReceipt(false);
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleString('ko-KR', {
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}시간 ${mins}분`;
    }
    return `${mins}분`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">🅿️ ParkFlow</h1>
          <p className="text-blue-200">주차요금 정산 키오스크</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Step: Input - 숫자 4자리 입력 */}
          {step === 'input' && (
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
                차량번호 뒷자리 입력
              </h2>
              <p className="text-gray-500 text-center mb-6">
                차량번호 뒷 4자리를 입력하세요
              </p>

              {/* 4자리 디스플레이 */}
              <div className="flex justify-center gap-3 mb-4">
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className={`
                      w-16 h-20 flex items-center justify-center text-4xl font-bold rounded-xl border-3
                      transition-all duration-200
                      ${digits[index]
                        ? 'bg-blue-50 border-blue-500 text-blue-700'
                        : 'bg-gray-50 border-gray-300 text-gray-300'
                      }
                      ${index === digits.length && !loading ? 'border-blue-400 animate-pulse' : ''}
                    `}
                  >
                    {digits[index] || '_'}
                  </div>
                ))}
              </div>

              {/* 로딩 표시 */}
              {loading && (
                <div className="text-center py-4">
                  <div className="inline-flex items-center gap-2 text-blue-600">
                    <svg className="animate-spin w-6 h-6" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-lg font-medium">차량 검색 중...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="my-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-center">
                  {error}
                  <button
                    onClick={handleClear}
                    className="block mx-auto mt-2 text-sm text-red-500 underline"
                  >
                    다시 입력하기
                  </button>
                </div>
              )}

              {/* 숫자 키패드 */}
              <NumericKeypad
                onKeyPress={handleKeyPress}
                onBackspace={handleBackspace}
                onClear={handleClear}
                disabled={loading}
              />

              <p className="text-center text-gray-400 text-sm mt-4">
                예: 차량번호가 12가<strong className="text-blue-600">3456</strong>인 경우 → <strong className="text-blue-600">3456</strong> 입력
              </p>
            </div>
          )}

          {/* Step: Select - 복수 차량 선택 */}
          {step === 'select' && sessions.length > 0 && (
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-800 text-center mb-2">
                차량 선택
              </h2>
              <p className="text-gray-500 text-center mb-6">
                {sessions.length}대의 차량이 검색되었습니다
              </p>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => selectSession(s)}
                    className="w-full p-4 bg-gray-50 hover:bg-blue-50 border-2 border-gray-200 hover:border-blue-400 rounded-xl text-left transition-all"
                  >
                    <div className="flex justify-between items-center">
                      <span className="text-2xl font-bold text-gray-800">{s.plateNo}</span>
                      <span className="text-xl font-bold text-blue-600">
                        {s.finalFee.toLocaleString()}원
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2 text-sm text-gray-500">
                      <span>입차: {formatTime(s.entryAt)}</span>
                      <span>{formatDuration(s.durationMinutes)}</span>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={reset}
                className="w-full py-4 mt-4 bg-gray-200 text-gray-700 text-lg font-bold rounded-xl hover:bg-gray-300 transition-colors"
              >
                처음으로
              </button>
            </div>
          )}

          {/* Step: Confirm */}
          {step === 'confirm' && session && (
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">
                요금 확인
              </h2>

              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <div className="text-center mb-4">
                  <span className="text-3xl font-bold text-gray-800">{session.plateNo}</span>
                </div>

                <div className="space-y-3 text-gray-600">
                  <div className="flex justify-between">
                    <span>입차 시간</span>
                    <span className="font-medium">{formatTime(session.entryAt)}</span>
                  </div>
                  {session.exitAt && (
                    <div className="flex justify-between">
                      <span>출차 시간</span>
                      <span className="font-medium">{formatTime(session.exitAt)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>주차 시간</span>
                    <span className="font-medium">{formatDuration(session.durationMinutes)}</span>
                  </div>
                  <hr className="my-3" />
                  {session.discountTotal > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>기본 요금</span>
                        <span>{session.rawFee.toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between text-sm text-green-600">
                        <span>할인</span>
                        <span>-{session.discountTotal.toLocaleString()}원</span>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t-2 border-dashed">
                  <div className="flex justify-between items-center">
                    <span className="text-xl font-bold text-gray-800">결제 금액</span>
                    <span className="text-3xl font-bold text-blue-600">
                      {session.finalFee.toLocaleString()}원
                    </span>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-center">
                  {error}
                </div>
              )}

              {session.finalFee === 0 ? (
                <div className="space-y-3">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                    <span className="text-2xl">🎉</span>
                    <p className="text-green-700 font-bold mt-2">무료 출차 가능합니다!</p>
                  </div>
                  <button
                    onClick={reset}
                    className="w-full py-4 bg-gray-200 text-gray-700 text-xl font-bold rounded-xl hover:bg-gray-300 transition-colors"
                  >
                    처음으로
                  </button>
                </div>
              ) : session.paymentStatus === 'PAID' ? (
                <div className="space-y-3">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
                    <span className="text-2xl">✅</span>
                    <p className="text-green-700 font-bold mt-2">이미 결제가 완료되었습니다!</p>
                    <p className="text-green-600 text-sm mt-1">출차하실 수 있습니다.</p>
                  </div>
                  <button
                    onClick={reset}
                    className="w-full py-4 bg-gray-200 text-gray-700 text-xl font-bold rounded-xl hover:bg-gray-300 transition-colors"
                  >
                    처음으로
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={goToPaymentSelect}
                    disabled={loading}
                    className="w-full py-4 bg-green-600 text-white text-xl font-bold rounded-xl hover:bg-green-700 disabled:bg-gray-400 transition-colors"
                  >
                    {`${session.finalFee.toLocaleString()}원 결제하기`}
                  </button>
                  <button
                    onClick={reset}
                    disabled={loading}
                    className="w-full py-3 bg-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-300 transition-colors"
                  >
                    취소
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step: Payment Select */}
          {step === 'payment-select' && session && (
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">
                결제 수단 선택
              </h2>

              <div className="bg-gray-50 rounded-xl p-4 mb-6 text-center">
                <span className="text-lg text-gray-600">결제 금액</span>
                <div className="text-3xl font-bold text-blue-600 mt-1">
                  {session.finalFee.toLocaleString()}원
                </div>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-center">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                {/* 카드 결제 (토스페이먼츠) */}
                {tossClientKey && (
                  <button
                    onClick={() => {
                      setPaymentMethod('toss');
                      processTossPayment();
                    }}
                    disabled={loading}
                    className="w-full py-5 bg-blue-600 text-white text-xl font-bold rounded-xl hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-3"
                  >
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    신용/체크카드
                  </button>
                )}

                {/* 간편결제 (데모용 Mock) */}
                <button
                  onClick={() => {
                    setPaymentMethod('mock');
                    processMockPayment();
                  }}
                  disabled={loading}
                  className="w-full py-5 bg-purple-600 text-white text-xl font-bold rounded-xl hover:bg-purple-700 disabled:bg-gray-400 transition-colors flex items-center justify-center gap-3"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  {loading ? '처리 중...' : '간편결제 (데모)'}
                </button>

                {/* 현금 결제 안내 */}
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl text-center text-sm text-yellow-700">
                  💵 현금 결제는 관리실에서 가능합니다
                </div>

                <button
                  onClick={() => setStep('confirm')}
                  disabled={loading}
                  className="w-full py-3 bg-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-300 transition-colors"
                >
                  이전으로
                </button>
              </div>
            </div>
          )}

          {/* Step: Complete */}
          {step === 'complete' && paymentSuccess && (
            <div className="p-8 text-center">
              <div className="mb-6">
                <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-5xl">✅</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  결제 완료
                </h2>
                <p className="text-gray-600">
                  {session?.plateNo} 차량의 결제가 완료되었습니다.
                </p>
              </div>

              <div className="bg-green-50 rounded-xl p-6 mb-6">
                <p className="text-green-700 font-bold text-lg mb-2">
                  출차하실 수 있습니다!
                </p>
                <p className="text-green-600 text-sm">
                  15분 이내에 출차해 주세요.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setShowReceipt(true)}
                  className="w-full py-4 bg-gray-100 text-gray-700 text-lg font-bold rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  영수증 보기 / 출력
                </button>
                <button
                  onClick={reset}
                  className="w-full py-4 bg-blue-600 text-white text-xl font-bold rounded-xl hover:bg-blue-700 transition-colors"
                >
                  처음으로
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-blue-200 text-sm">
          문의: 1588-0000
        </div>
      </div>

      {/* Receipt Modal */}
      {showReceipt && receiptData && (
        <Receipt data={receiptData} onClose={() => setShowReceipt(false)} />
      )}
    </div>
  );
}
