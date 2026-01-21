import { useSearchParams, useNavigate } from 'react-router-dom';

export default function KioskPaymentFailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const errorCode = searchParams.get('code') || 'UNKNOWN_ERROR';
  const errorMessage = searchParams.get('message') || '결제가 취소되었거나 실패했습니다.';

  const defaultError = { icon: '❓', title: '결제 실패', description: '알 수 없는 오류가 발생했습니다.' };

  const getErrorInfo = (code: string): { icon: string; title: string; description: string } => {
    const errors: Record<string, { icon: string; title: string; description: string }> = {
      USER_CANCEL: {
        icon: '🚫',
        title: '결제 취소',
        description: '결제가 취소되었습니다.',
      },
      PAY_PROCESS_CANCELED: {
        icon: '🚫',
        title: '결제 취소',
        description: '결제 과정이 취소되었습니다.',
      },
      INVALID_CARD_COMPANY: {
        icon: '💳',
        title: '카드 오류',
        description: '사용할 수 없는 카드입니다. 다른 카드를 사용해 주세요.',
      },
      EXCEED_MAX_AMOUNT: {
        icon: '💰',
        title: '한도 초과',
        description: '카드 결제 한도를 초과했습니다.',
      },
      INVALID_CARD_NUMBER: {
        icon: '💳',
        title: '카드 번호 오류',
        description: '카드 번호가 올바르지 않습니다.',
      },
      CARD_EXPIRATION_DATE_PASSED: {
        icon: '⏰',
        title: '카드 만료',
        description: '만료된 카드입니다. 다른 카드를 사용해 주세요.',
      },
      INSUFFICIENT_BALANCE: {
        icon: '💸',
        title: '잔액 부족',
        description: '카드 잔액이 부족합니다.',
      },
      UNKNOWN_ERROR: defaultError,
    };

    return errors[code] ?? defaultError;
  };

  const errorInfo = getErrorInfo(errorCode);

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-600 to-red-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-5xl">{errorInfo.icon}</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{errorInfo.title}</h2>
          <p className="text-gray-600">{errorInfo.description}</p>
        </div>

        {errorCode !== 'USER_CANCEL' && errorCode !== 'PAY_PROCESS_CANCELED' && (
          <div className="bg-gray-50 rounded-xl p-4 mb-6">
            <p className="text-sm text-gray-500 text-center">
              오류 코드: {errorCode}
            </p>
            {errorMessage && (
              <p className="text-sm text-gray-500 text-center mt-1">
                {decodeURIComponent(errorMessage)}
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={() => navigate('/kiosk')}
            className="w-full py-4 bg-blue-600 text-white text-xl font-bold rounded-xl hover:bg-blue-700 transition-colors"
          >
            다시 시도
          </button>

          <div className="text-center text-sm text-gray-500">
            문제가 계속되면 관리실에 문의해 주세요.
          </div>
        </div>
      </div>
    </div>
  );
}
