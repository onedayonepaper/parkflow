import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

interface RatePlan {
  id: string;
  name: string;
  isActive: boolean;
  rules: {
    freeMinutes: number;
    baseFee: number;
    baseMinutes: number;
    additionalFee: number;
    additionalMinutes: number;
    dailyMax: number;
  };
}

const defaultForm = {
  name: '',
  freeMinutes: 10,
  baseFee: 1000,
  baseMinutes: 30,
  additionalFee: 500,
  additionalMinutes: 10,
  dailyMax: 20000,
};

export default function RatePlansPage() {
  const { addToast } = useToast();
  const [plans, setPlans] = useState<RatePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<RatePlan | null>(null);
  const [form, setForm] = useState(defaultForm);

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await api.createRatePlan({
      name: form.name,
      rules: {
        freeMinutes: form.freeMinutes,
        baseFee: form.baseFee,
        baseMinutes: form.baseMinutes,
        additionalFee: form.additionalFee,
        additionalMinutes: form.additionalMinutes,
        dailyMax: form.dailyMax,
      },
    });
    if (result.ok) {
      addToast({ type: 'success', title: '생성 완료', message: '요금제가 생성되었습니다.' });
      setShowForm(false);
      setForm(defaultForm);
      loadPlans();
    } else {
      addToast({ type: 'error', title: '생성 실패', message: result.error?.message || '생성에 실패했습니다.' });
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    const result = await api.updateRatePlan(editingPlan.id, {
      name: form.name,
      rules: {
        freeMinutes: form.freeMinutes,
        baseFee: form.baseFee,
        baseMinutes: form.baseMinutes,
        additionalFee: form.additionalFee,
        additionalMinutes: form.additionalMinutes,
        dailyMax: form.dailyMax,
      },
    });
    if (result.ok) {
      addToast({ type: 'success', title: '수정 완료', message: '요금제가 수정되었습니다.' });
      setEditingPlan(null);
      setForm(defaultForm);
      loadPlans();
    } else {
      addToast({ type: 'error', title: '수정 실패', message: result.error?.message || '수정에 실패했습니다.' });
    }
  };

  const handleActivate = async (id: string) => {
    const result = await api.activateRatePlan(id);
    if (result.ok) {
      addToast({ type: 'success', title: '활성화 완료', message: '요금제가 활성화되었습니다.' });
      loadPlans();
    } else {
      addToast({ type: 'error', title: '활성화 실패', message: result.error?.message || '활성화에 실패했습니다.' });
    }
  };

  const startEdit = (plan: RatePlan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      freeMinutes: plan.rules.freeMinutes,
      baseFee: plan.rules.baseFee,
      baseMinutes: plan.rules.baseMinutes,
      additionalFee: plan.rules.additionalFee,
      additionalMinutes: plan.rules.additionalMinutes,
      dailyMax: plan.rules.dailyMax,
    });
    setShowForm(false);
  };

  const cancelEdit = () => {
    setEditingPlan(null);
    setForm(defaultForm);
  };

  const handleExport = () => {
    const headers = ['이름', '상태', '무료시간', '기본요금', '기본시간', '추가요금', '추가시간', '일최대'];
    const rows = plans.map(p => [
      p.name,
      p.isActive ? '활성' : '비활성',
      p.rules.freeMinutes.toString(),
      p.rules.baseFee.toString(),
      p.rules.baseMinutes.toString(),
      p.rules.additionalFee.toString(),
      p.rules.additionalMinutes.toString(),
      p.rules.dailyMax.toString(),
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rate_plans_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    addToast({ type: 'success', title: '내보내기 완료', message: 'CSV 파일이 다운로드됩니다.' });
  };

  if (loading) {
    return <div className="text-center py-8 dark:text-gray-300">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">요금 정책</h2>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
          >
            📥 내보내기
          </button>
          <button
            onClick={() => { setShowForm(true); setEditingPlan(null); setForm(defaultForm); }}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
          >
            + 요금제 추가
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {(showForm || editingPlan) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-white">
            {editingPlan ? '요금제 수정' : '요금제 추가'}
          </h3>
          <form onSubmit={editingPlan ? handleUpdate : handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">요금제 이름 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="기본 요금제"
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">무료 시간 (분)</label>
                <input
                  type="number"
                  value={form.freeMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, freeMinutes: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">기본 요금 (원)</label>
                <input
                  type="number"
                  value={form.baseFee}
                  onChange={(e) => setForm((f) => ({ ...f, baseFee: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  min="0"
                  step="100"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">기본 시간 (분)</label>
                <input
                  type="number"
                  value={form.baseMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, baseMinutes: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">추가 요금 (원)</label>
                <input
                  type="number"
                  value={form.additionalFee}
                  onChange={(e) => setForm((f) => ({ ...f, additionalFee: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  min="0"
                  step="100"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">추가 시간 (분)</label>
                <input
                  type="number"
                  value={form.additionalMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, additionalMinutes: parseInt(e.target.value) || 1 }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  min="1"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">일 최대 요금 (원)</label>
                <input
                  type="number"
                  value={form.dailyMax}
                  onChange={(e) => setForm((f) => ({ ...f, dailyMax: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  min="0"
                  step="1000"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {editingPlan ? '수정' : '추가'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); cancelEdit(); }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Plans List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {plans.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">등록된 요금제가 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr className="text-left text-sm text-gray-600 dark:text-gray-300">
                  <th className="px-4 py-3">이름</th>
                  <th className="px-4 py-3">무료시간</th>
                  <th className="px-4 py-3">기본요금</th>
                  <th className="px-4 py-3">추가요금</th>
                  <th className="px-4 py-3">일최대</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="dark:text-gray-200">
                {plans.map((plan) => (
                  <tr key={plan.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
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
                        <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded text-xs">
                          활성
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-300 rounded text-xs">
                          비활성
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(plan)}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm"
                        >
                          수정
                        </button>
                        {!plan.isActive && (
                          <button
                            onClick={() => handleActivate(plan.id)}
                            className="text-primary-600 hover:text-primary-800 dark:text-primary-400 text-sm"
                          >
                            활성화
                          </button>
                        )}
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
