import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function RatePlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    const result = await api.getRatePlans();
    if (result.ok && result.data) {
      setPlans(result.data.items);
    }
    setLoading(false);
  };

  const handleActivate = async (id: string) => {
    const result = await api.activateRatePlan(id);
    if (result.ok) {
      loadPlans();
    } else {
      alert(result.error?.message || '활성화 실패');
    }
  };

  if (loading) {
    return <div className="text-center py-8">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">요금 정책</h2>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-sm text-gray-600">
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">무료시간</th>
              <th className="px-4 py-3">기본요금</th>
              <th className="px-4 py-3">추가요금</th>
              <th className="px-4 py-3">일최대</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan) => (
              <tr key={plan.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{plan.name}</td>
                <td className="px-4 py-3">{plan.rules.freeMinutes}분</td>
                <td className="px-4 py-3">
                  {plan.rules.baseFee.toLocaleString()}원 / {plan.rules.baseMinutes}분
                </td>
                <td className="px-4 py-3">
                  {plan.rules.additionalFee.toLocaleString()}원 / {plan.rules.additionalMinutes}분
                </td>
                <td className="px-4 py-3">{plan.rules.dailyMax.toLocaleString()}원</td>
                <td className="px-4 py-3">
                  {plan.isActive ? (
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">
                      활성
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                      비활성
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {!plan.isActive && (
                    <button
                      onClick={() => handleActivate(plan.id)}
                      className="text-primary-600 hover:text-primary-800 text-sm"
                    >
                      활성화
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
