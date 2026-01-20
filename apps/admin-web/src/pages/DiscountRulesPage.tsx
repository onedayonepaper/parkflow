import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const typeLabels: Record<string, string> = {
  AMOUNT: '정액',
  PERCENT: '정률',
  FREE_MINUTES: '시간무료',
  FREE_ALL: '전액무료',
};

export default function DiscountRulesPage() {
  const [rules, setRules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    const result = await api.getDiscountRules();
    if (result.ok && result.data) {
      setRules(result.data.items);
    }
    setLoading(false);
  };

  const formatValue = (type: string, value: number) => {
    switch (type) {
      case 'AMOUNT':
        return `${value.toLocaleString()}원`;
      case 'PERCENT':
        return `${value}%`;
      case 'FREE_MINUTES':
        return `${value}분`;
      case 'FREE_ALL':
        return '-';
      default:
        return value;
    }
  };

  if (loading) {
    return <div className="text-center py-8">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">할인 규칙</h2>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr className="text-left text-sm text-gray-600">
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">유형</th>
              <th className="px-4 py-3">값</th>
              <th className="px-4 py-3">중복적용</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{rule.name}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                    {typeLabels[rule.type] || rule.type}
                  </span>
                </td>
                <td className="px-4 py-3">{formatValue(rule.type, rule.value)}</td>
                <td className="px-4 py-3">
                  {rule.isStackable ? (
                    <span className="text-green-600">가능</span>
                  ) : (
                    <span className="text-red-600">불가</span>
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
