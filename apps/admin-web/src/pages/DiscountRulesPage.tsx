import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

interface DiscountRule {
  id: string;
  name: string;
  type: string;
  value: number;
  isStackable: boolean;
  maxApplyCount: number | null;
}

const typeLabels: Record<string, string> = {
  AMOUNT: '정액 할인',
  PERCENT: '정률 할인',
  FREE_MINUTES: '시간 무료',
  FREE_ALL: '전액 무료',
};

const typeDescriptions: Record<string, string> = {
  AMOUNT: '고정 금액을 할인합니다 (예: 1000원 할인)',
  PERCENT: '요금의 일정 비율을 할인합니다 (예: 10% 할인)',
  FREE_MINUTES: '일정 시간을 무료로 처리합니다 (예: 30분 무료)',
  FREE_ALL: '전액 무료로 처리합니다',
};

export default function DiscountRulesPage() {
  const { addToast } = useToast();
  const [rules, setRules] = useState<DiscountRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<DiscountRule | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'AMOUNT',
    value: 0,
    isStackable: true,
    maxApplyCount: '',
  });

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

  const handleOpenCreate = () => {
    setEditingRule(null);
    setForm({
      name: '',
      type: 'AMOUNT',
      value: 0,
      isStackable: true,
      maxApplyCount: '',
    });
    setShowForm(true);
  };

  const handleOpenEdit = (rule: DiscountRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      type: rule.type,
      value: rule.value,
      isStackable: rule.isStackable,
      maxApplyCount: rule.maxApplyCount?.toString() || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      name: form.name,
      type: form.type,
      value: form.type === 'FREE_ALL' ? 0 : Number(form.value),
      isStackable: form.isStackable,
      maxApplyCount: form.maxApplyCount ? Number(form.maxApplyCount) : null,
    };

    let result;
    if (editingRule) {
      result = await api.updateDiscountRule(editingRule.id, data);
    } else {
      result = await api.createDiscountRule(data);
    }

    if (result.ok) {
      addToast({
        type: 'success',
        title: editingRule ? '수정 완료' : '등록 완료',
        message: editingRule ? '할인 규칙이 수정되었습니다.' : '할인 규칙이 등록되었습니다.',
      });
      setShowForm(false);
      setEditingRule(null);
      loadRules();
    } else {
      addToast({
        type: 'error',
        title: editingRule ? '수정 실패' : '등록 실패',
        message: result.error?.message || '처리에 실패했습니다.',
      });
    }
  };

  const handleDelete = async (rule: DiscountRule) => {
    if (!confirm(`"${rule.name}" 할인 규칙을 삭제하시겠습니까?`)) return;

    const result = await api.deleteDiscountRule(rule.id);
    if (result.ok) {
      addToast({ type: 'success', title: '삭제 완료', message: '할인 규칙이 삭제되었습니다.' });
      loadRules();
    } else {
      addToast({
        type: 'error',
        title: '삭제 실패',
        message: result.error?.message || '삭제에 실패했습니다.',
      });
    }
  };

  const handleExportCSV = () => {
    const headers = ['이름', '유형', '값', '중복적용', '최대적용횟수'];
    const rows = rules.map((r) => [
      r.name,
      typeLabels[r.type] || r.type,
      formatValue(r.type, r.value),
      r.isStackable ? '가능' : '불가',
      r.maxApplyCount?.toString() || '무제한',
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `discount_rules_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    addToast({ type: 'success', title: '내보내기 완료', message: 'CSV 파일이 다운로드됩니다.' });
  };

  if (loading) {
    return <div className="text-center py-8 dark:text-gray-300">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">할인 규칙</h2>
        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            CSV 내보내기
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
          >
            + 규칙 추가
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">전체 규칙</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{rules.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">정액 할인</p>
          <p className="text-2xl font-bold text-blue-600">{rules.filter((r) => r.type === 'AMOUNT').length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">정률 할인</p>
          <p className="text-2xl font-bold text-green-600">{rules.filter((r) => r.type === 'PERCENT').length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">무료 처리</p>
          <p className="text-2xl font-bold text-purple-600">
            {rules.filter((r) => r.type === 'FREE_MINUTES' || r.type === 'FREE_ALL').length}
          </p>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-white">
            {editingRule ? '할인 규칙 수정' : '할인 규칙 추가'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">규칙 이름 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="VIP 할인"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">할인 유형 *</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{typeDescriptions[form.type]}</p>
              </div>
              {form.type !== 'FREE_ALL' && (
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                    값 *{' '}
                    {form.type === 'AMOUNT' ? '(원)' : form.type === 'PERCENT' ? '(%)' : '(분)'}
                  </label>
                  <input
                    type="number"
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: Number(e.target.value) }))}
                    min={0}
                    max={form.type === 'PERCENT' ? 100 : undefined}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">최대 적용 횟수</label>
                <input
                  type="number"
                  value={form.maxApplyCount}
                  onChange={(e) => setForm((f) => ({ ...f, maxApplyCount: e.target.value }))}
                  placeholder="비워두면 무제한"
                  min={1}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isStackable"
                  checked={form.isStackable}
                  onChange={(e) => setForm((f) => ({ ...f, isStackable: e.target.checked }))}
                  className="w-4 h-4"
                />
                <label htmlFor="isStackable" className="text-sm text-gray-600 dark:text-gray-400">
                  다른 할인과 중복 적용 가능
                </label>
              </div>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                {editingRule ? '수정' : '등록'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingRule(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rules Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {rules.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">등록된 할인 규칙이 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr className="text-left text-sm text-gray-600 dark:text-gray-300">
                  <th className="px-4 py-3">이름</th>
                  <th className="px-4 py-3">유형</th>
                  <th className="px-4 py-3">값</th>
                  <th className="px-4 py-3">중복적용</th>
                  <th className="px-4 py-3">최대횟수</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="dark:text-gray-200">
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 font-medium">{rule.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-xs">
                        {typeLabels[rule.type] || rule.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">{formatValue(rule.type, rule.value)}</td>
                    <td className="px-4 py-3">
                      {rule.isStackable ? (
                        <span className="text-green-600 dark:text-green-400">가능</span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400">불가</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{rule.maxApplyCount || '무제한'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenEdit(rule)}
                          className="text-primary-600 hover:text-primary-800 dark:text-primary-400 text-sm"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(rule)}
                          className="text-red-600 hover:text-red-800 dark:text-red-400 text-sm"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
