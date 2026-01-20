import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [discountRules, setDiscountRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadSession();
    loadDiscountRules();
  }, [id]);

  const loadSession = async () => {
    if (!id) return;
    setLoading(true);
    const result = await api.getSession(id);
    if (result.ok && result.data) {
      setSession(result.data);
    }
    setLoading(false);
  };

  const loadDiscountRules = async () => {
    const result = await api.getDiscountRules();
    if (result.ok && result.data) {
      setDiscountRules(result.data.items);
    }
  };

  const handlePayment = async () => {
    if (!session || session.finalFee <= 0) return;
    setActionLoading(true);
    const result = await api.mockPayment({
      sessionId: session.id,
      amount: session.finalFee,
    });
    if (result.ok) {
      alert('결제가 완료되었습니다');
      loadSession();
    } else {
      alert(result.error?.message || '결제 실패');
    }
    setActionLoading(false);
  };

  const handleApplyDiscount = async (ruleId: string) => {
    if (!session) return;
    setActionLoading(true);
    const result = await api.applyDiscount(session.id, {
      discountRuleId: ruleId,
      reason: '운영자 적용',
    });
    if (result.ok) {
      alert('할인이 적용되었습니다');
      loadSession();
    } else {
      alert(result.error?.message || '할인 적용 실패');
    }
    setActionLoading(false);
  };

  const handleForceClose = async () => {
    if (!session) return;
    const reason = prompt('강제 종료 사유를 입력하세요:');
    if (!reason) return;

    setActionLoading(true);
    const result = await api.forceCloseSession(session.id, { reason });
    if (result.ok) {
      alert('세션이 종료되었습니다');
      loadSession();
    } else {
      alert(result.error?.message || '종료 실패');
    }
    setActionLoading(false);
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('ko-KR');
  };

  if (loading) {
    return <div className="text-center py-8">로딩 중...</div>;
  }

  if (!session) {
    return <div className="text-center py-8 text-red-600">세션을 찾을 수 없습니다</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">세션 상세</h2>
        <button
          onClick={() => navigate('/sessions')}
          className="text-gray-600 hover:text-gray-800"
        >
          ← 목록으로
        </button>
      </div>

      {/* Basic Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">기본 정보</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoItem label="세션 ID" value={session.id} />
          <InfoItem label="차량번호" value={session.plateNo} />
          <InfoItem label="상태" value={session.status} />
          <InfoItem label="결제상태" value={session.paymentStatus} />
          <InfoItem label="입차 시간" value={formatDateTime(session.entryAt)} />
          <InfoItem label="출차 시간" value={formatDateTime(session.exitAt)} />
          <InfoItem label="요금제" value={session.ratePlanName || '-'} />
          <InfoItem label="종료 사유" value={session.closeReason || '-'} />
        </div>
      </div>

      {/* Fee Breakdown */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">요금 내역</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <InfoItem label="주차 시간" value={`${session.feeBreakdown?.parkingMinutes || 0}분`} />
          <InfoItem label="무료 적용" value={`${session.feeBreakdown?.freeMinutesApplied || 0}분`} />
          <InfoItem label="과금 시간" value={`${session.feeBreakdown?.chargeableMinutes || 0}분`} />
          <InfoItem label="일최대 적용" value={session.feeBreakdown?.dailyMaxApplied ? 'Yes' : 'No'} />
        </div>
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between">
            <span>기본 요금</span>
            <span>{(session.rawFee || 0).toLocaleString()}원</span>
          </div>
          <div className="flex justify-between text-red-600">
            <span>할인 합계</span>
            <span>-{(session.discountTotal || 0).toLocaleString()}원</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-2">
            <span>최종 요금</span>
            <span>{(session.finalFee || 0).toLocaleString()}원</span>
          </div>
        </div>
      </div>

      {/* Discount Applications */}
      {session.discountApplications?.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">적용된 할인</h3>
          <ul className="space-y-2">
            {session.discountApplications.map((da: any) => (
              <li key={da.id} className="flex justify-between text-sm">
                <span>{da.ruleName}</span>
                <span className="text-red-600">-{da.appliedValue.toLocaleString()}원</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Payments */}
      {session.payments?.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">결제 내역</h3>
          <ul className="space-y-2">
            {session.payments.map((p: any) => (
              <li key={p.id} className="flex justify-between text-sm">
                <span>
                  {p.method} - {p.status}
                </span>
                <span>{p.amount.toLocaleString()}원</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {session.status !== 'CLOSED' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">운영 작업</h3>

          <div className="space-y-4">
            {/* Payment */}
            {session.status === 'EXIT_PENDING' && session.paymentStatus !== 'PAID' && (
              <div>
                <button
                  onClick={handlePayment}
                  disabled={actionLoading || session.finalFee <= 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  결제 처리 ({session.finalFee.toLocaleString()}원)
                </button>
              </div>
            )}

            {/* Apply Discount */}
            {session.status !== 'CLOSED' && (
              <div>
                <label className="block text-sm text-gray-600 mb-2">할인 적용</label>
                <div className="flex gap-2 flex-wrap">
                  {discountRules.map((rule) => (
                    <button
                      key={rule.id}
                      onClick={() => handleApplyDiscount(rule.id)}
                      disabled={actionLoading}
                      className="px-3 py-1 border rounded-lg hover:bg-gray-100 text-sm disabled:opacity-50"
                    >
                      {rule.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Force Close */}
            {session.status !== 'CLOSED' && (
              <div className="pt-4 border-t">
                <button
                  onClick={handleForceClose}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  강제 종료
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
