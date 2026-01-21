import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

const API_BASE = '/api';

interface ReceiptData {
  paymentId: string;
  sessionId: string;
  plateNo: string;
  entryAt: string;
  exitAt: string;
  amount: number;
  method: string;
  approvedAt: string;
}

export default function KioskPaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => {
    const confirmPayment = async () => {
      const paymentKey = searchParams.get('paymentKey');
      const orderId = searchParams.get('orderId');
      const amount = searchParams.get('amount');
      const sessionId = searchParams.get('sessionId');

      if (!paymentKey || !orderId || !amount || !sessionId) {
        setError('결제 정보가 올바르지 않습니다.');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API_BASE}/payments/toss/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount: parseInt(amount, 10),
            sessionId,
          }),
        });

        const result = await response.json();

        if (result.ok) {
          // 세션 정보 조회
          const sessionResponse = await fetch(
            `${API_BASE}/kiosk/lookup?plateNo=${encodeURIComponent(orderId.split('_')[1] || '')}`
          );
          const sessionResult = await sessionResponse.json();

          setReceipt({
            paymentId: result.data.paymentId,
            sessionId,
            plateNo: sessionResult.data?.plateNo || orderId.split('_')[1] || '',
            entryAt: sessionResult.data?.entryAt || '',
            exitAt: sessionResult.data?.exitAt || new Date().toISOString(),
            amount: parseInt(amount, 10),
            method: result.data.method || '카드',
            approvedAt: result.data.approvedAt,
          });
        } else {
          setError(result.error?.message || '결제 승인에 실패했습니다.');
        }
      } catch {
        setError('결제 처리 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    confirmPayment();
  }, [searchParams]);

  const formatTime = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-800 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin w-16 h-16 border-4 border-white border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-xl">결제 처리 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-600 to-red-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-4xl">❌</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">결제 실패</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/kiosk')}
            className="w-full py-4 bg-blue-600 text-white text-xl font-bold rounded-xl hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-600 to-green-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-5xl">✅</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">결제 완료</h2>
          <p className="text-gray-600">결제가 성공적으로 완료되었습니다.</p>
        </div>

        {receipt && (
          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <div className="text-center mb-4">
              <span className="text-2xl font-bold text-gray-800">{receipt.plateNo}</span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">결제 금액</span>
                <span className="font-bold text-green-600">
                  {receipt.amount.toLocaleString()}원
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">결제 방법</span>
                <span className="font-medium">{receipt.method}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">결제 일시</span>
                <span className="font-medium">{formatTime(receipt.approvedAt)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 text-center">
          <p className="text-green-700 font-bold text-lg mb-1">출차하실 수 있습니다!</p>
          <p className="text-green-600 text-sm">15분 이내에 출차해 주세요.</p>
        </div>

        <button
          onClick={() => navigate('/kiosk')}
          className="w-full py-4 bg-blue-600 text-white text-xl font-bold rounded-xl hover:bg-blue-700 transition-colors"
        >
          처음으로
        </button>
      </div>
    </div>
  );
}
