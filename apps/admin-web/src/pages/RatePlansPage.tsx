import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

interface TimeBasedRate {
  baseMinutes: number;
  baseFee: number;
  additionalMinutes: number;
  additionalFee: number;
  dailyMax: number;
}

interface RateRules {
  freeMinutes: number;
  baseFee: number;
  baseMinutes: number;
  additionalFee: number;
  additionalMinutes: number;
  dailyMax: number;
  graceMinutes?: number;
  timeBasedEnabled?: boolean;
  nightRateEnabled?: boolean;
  nightStart?: string;
  nightEnd?: string;
  nightRate?: TimeBasedRate;
  weekendRateEnabled?: boolean;
  weekendRate?: TimeBasedRate;
  weekendNightRateEnabled?: boolean;
  weekendNightRate?: TimeBasedRate;
}

interface RatePlan {
  id: string;
  name: string;
  isActive: boolean;
  rules: RateRules;
}

const defaultTimeBasedRate: TimeBasedRate = {
  baseMinutes: 30,
  baseFee: 1000,
  additionalMinutes: 10,
  additionalFee: 500,
  dailyMax: 20000,
};

const defaultForm = {
  name: '',
  freeMinutes: 10,
  baseFee: 1000,
  baseMinutes: 30,
  additionalFee: 500,
  additionalMinutes: 10,
  dailyMax: 20000,
  graceMinutes: 15,
  timeBasedEnabled: false,
  nightRateEnabled: false,
  nightStart: '22:00',
  nightEnd: '06:00',
  nightRate: { ...defaultTimeBasedRate },
  weekendRateEnabled: false,
  weekendRate: { ...defaultTimeBasedRate },
  weekendNightRateEnabled: false,
  weekendNightRate: { ...defaultTimeBasedRate },
};

type FormState = typeof defaultForm;

// 시간대별 요금 입력 컴포넌트
function TimeBasedRateInput({
  label,
  enabled,
  onEnabledChange,
  rate,
  onRateChange,
}: {
  label: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  rate: TimeBasedRate;
  onRateChange: (rate: TimeBasedRate) => void;
}) {
  return (
    <div className="border dark:border-gray-600 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
          className="w-4 h-4 text-primary-600 rounded"
        />
        <span className="font-medium dark:text-white">{label}</span>
      </div>
      {enabled && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">기본요금 (원)</label>
            <input
              type="number"
              value={rate.baseFee}
              onChange={(e) => onRateChange({ ...rate, baseFee: parseInt(e.target.value) || 0 })}
              className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              min="0"
              step="100"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">기본시간 (분)</label>
            <input
              type="number"
              value={rate.baseMinutes}
              onChange={(e) => onRateChange({ ...rate, baseMinutes: parseInt(e.target.value) || 1 })}
              className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              min="1"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">추가요금 (원)</label>
            <input
              type="number"
              value={rate.additionalFee}
              onChange={(e) => onRateChange({ ...rate, additionalFee: parseInt(e.target.value) || 0 })}
              className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              min="0"
              step="100"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">추가시간 (분)</label>
            <input
              type="number"
              value={rate.additionalMinutes}
              onChange={(e) => onRateChange({ ...rate, additionalMinutes: parseInt(e.target.value) || 1 })}
              className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              min="1"
            />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">일 최대 (원)</label>
            <input
              type="number"
              value={rate.dailyMax}
              onChange={(e) => onRateChange({ ...rate, dailyMax: parseInt(e.target.value) || 0 })}
              className="w-full px-2 py-1 text-sm border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              min="0"
              step="1000"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function RatePlansPage() {
  const { addToast } = useToast();
  const [plans, setPlans] = useState<RatePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<RatePlan | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [activeTab, setActiveTab] = useState<'basic' | 'timeBased'>('basic');

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

  const buildRules = (): RateRules => {
    const rules: RateRules = {
      freeMinutes: form.freeMinutes,
      baseFee: form.baseFee,
      baseMinutes: form.baseMinutes,
      additionalFee: form.additionalFee,
      additionalMinutes: form.additionalMinutes,
      dailyMax: form.dailyMax,
      graceMinutes: form.graceMinutes,
      timeBasedEnabled: form.timeBasedEnabled,
    };

    if (form.timeBasedEnabled) {
      rules.nightRateEnabled = form.nightRateEnabled;
      if (form.nightRateEnabled) {
        rules.nightStart = form.nightStart;
        rules.nightEnd = form.nightEnd;
        rules.nightRate = form.nightRate;
      }
      rules.weekendRateEnabled = form.weekendRateEnabled;
      if (form.weekendRateEnabled) {
        rules.weekendRate = form.weekendRate;
      }
      rules.weekendNightRateEnabled = form.weekendNightRateEnabled;
      if (form.weekendNightRateEnabled) {
        rules.weekendNightRate = form.weekendNightRate;
      }
    }

    return rules;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = await api.createRatePlan({
      name: form.name,
      rules: buildRules(),
    });
    if (result.ok) {
      addToast({ type: 'success', title: '생성 완료', message: '요금제가 생성되었습니다.' });
      setShowForm(false);
      setForm(defaultForm);
      setActiveTab('basic');
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
      rules: buildRules(),
    });
    if (result.ok) {
      addToast({ type: 'success', title: '수정 완료', message: '요금제가 수정되었습니다.' });
      setEditingPlan(null);
      setForm(defaultForm);
      setActiveTab('basic');
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
    const rules = plan.rules || {};
    setForm({
      name: plan.name,
      freeMinutes: rules.freeMinutes ?? 10,
      baseFee: rules.baseFee ?? 1000,
      baseMinutes: rules.baseMinutes ?? 30,
      additionalFee: rules.additionalFee ?? 500,
      additionalMinutes: rules.additionalMinutes ?? 10,
      dailyMax: rules.dailyMax ?? 20000,
      graceMinutes: rules.graceMinutes ?? 15,
      timeBasedEnabled: rules.timeBasedEnabled ?? false,
      nightRateEnabled: rules.nightRateEnabled ?? false,
      nightStart: rules.nightStart ?? '22:00',
      nightEnd: rules.nightEnd ?? '06:00',
      nightRate: rules.nightRate ?? { ...defaultTimeBasedRate },
      weekendRateEnabled: rules.weekendRateEnabled ?? false,
      weekendRate: rules.weekendRate ?? { ...defaultTimeBasedRate },
      weekendNightRateEnabled: rules.weekendNightRateEnabled ?? false,
      weekendNightRate: rules.weekendNightRate ?? { ...defaultTimeBasedRate },
    });
    setShowForm(false);
    setActiveTab('basic');
  };

  const cancelEdit = () => {
    setEditingPlan(null);
    setForm(defaultForm);
    setActiveTab('basic');
  };

  const handleExport = () => {
    const headers = ['이름', '상태', '무료시간', '기본요금', '기본시간', '추가요금', '추가시간', '일최대', '시간대별요금'];
    const rows = plans.map(p => {
      const rules = p.rules || {};
      return [
        p.name,
        p.isActive ? '활성' : '비활성',
        (rules.freeMinutes ?? 0).toString(),
        (rules.baseFee ?? 0).toString(),
        (rules.baseMinutes ?? 0).toString(),
        (rules.additionalFee ?? 0).toString(),
        (rules.additionalMinutes ?? 0).toString(),
        (rules.dailyMax ?? 0).toString(),
        rules.timeBasedEnabled ? '사용' : '미사용',
      ];
    });

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
            onClick={() => { setShowForm(true); setEditingPlan(null); setForm(defaultForm); setActiveTab('basic'); }}
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

          {/* Tabs */}
          <div className="flex border-b dark:border-gray-700 mb-4">
            <button
              onClick={() => setActiveTab('basic')}
              className={`px-4 py-2 -mb-px text-sm font-medium ${
                activeTab === 'basic'
                  ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
            >
              기본 설정
            </button>
            <button
              onClick={() => setActiveTab('timeBased')}
              className={`px-4 py-2 -mb-px text-sm font-medium ${
                activeTab === 'timeBased'
                  ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              }`}
            >
              시간대별 요금
            </button>
          </div>

          <form onSubmit={editingPlan ? handleUpdate : handleCreate} className="space-y-4">
            {activeTab === 'basic' && (
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
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">결제 후 유예시간 (분)</label>
                  <input
                    type="number"
                    value={form.graceMinutes}
                    onChange={(e) => setForm((f) => ({ ...f, graceMinutes: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    min="0"
                  />
                </div>
              </div>
            )}

            {activeTab === 'timeBased' && (
              <div className="space-y-4">
                {/* Master Toggle */}
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <input
                    type="checkbox"
                    checked={form.timeBasedEnabled}
                    onChange={(e) => setForm((f) => ({ ...f, timeBasedEnabled: e.target.checked }))}
                    className="w-4 h-4 text-primary-600 rounded"
                  />
                  <span className="font-medium dark:text-white">시간대별 요금 사용</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    (평일/주말, 주간/야간 다른 요금 적용)
                  </span>
                </div>

                {form.timeBasedEnabled && (
                  <div className="space-y-4">
                    {/* Night Rate Settings */}
                    <div className="border dark:border-gray-600 rounded-lg p-4">
                      <h4 className="font-medium mb-3 dark:text-white">🌙 야간 요금 설정</h4>
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="checkbox"
                          checked={form.nightRateEnabled}
                          onChange={(e) => setForm((f) => ({ ...f, nightRateEnabled: e.target.checked }))}
                          className="w-4 h-4 text-primary-600 rounded"
                        />
                        <span className="dark:text-white">야간 요금 사용</span>
                      </div>
                      {form.nightRateEnabled && (
                        <>
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">야간 시작</label>
                              <input
                                type="time"
                                value={form.nightStart}
                                onChange={(e) => setForm((f) => ({ ...f, nightStart: e.target.value }))}
                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-500 dark:text-gray-400 mb-1">야간 종료</label>
                              <input
                                type="time"
                                value={form.nightEnd}
                                onChange={(e) => setForm((f) => ({ ...f, nightEnd: e.target.value }))}
                                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                              />
                            </div>
                          </div>
                          <TimeBasedRateInput
                            label="평일 야간 요금"
                            enabled={true}
                            onEnabledChange={() => {}}
                            rate={form.nightRate}
                            onRateChange={(rate) => setForm((f) => ({ ...f, nightRate: rate }))}
                          />
                        </>
                      )}
                    </div>

                    {/* Weekend Rate */}
                    <TimeBasedRateInput
                      label="📅 주말 요금 (토/일)"
                      enabled={form.weekendRateEnabled}
                      onEnabledChange={(enabled) => setForm((f) => ({ ...f, weekendRateEnabled: enabled }))}
                      rate={form.weekendRate}
                      onRateChange={(rate) => setForm((f) => ({ ...f, weekendRate: rate }))}
                    />

                    {/* Weekend Night Rate */}
                    {form.nightRateEnabled && form.weekendRateEnabled && (
                      <TimeBasedRateInput
                        label="🌙📅 주말 야간 요금"
                        enabled={form.weekendNightRateEnabled}
                        onEnabledChange={(enabled) => setForm((f) => ({ ...f, weekendNightRateEnabled: enabled }))}
                        rate={form.weekendNightRate}
                        onRateChange={(rate) => setForm((f) => ({ ...f, weekendNightRate: rate }))}
                      />
                    )}

                    {/* Preview Info */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-sm">
                      <h5 className="font-medium text-blue-800 dark:text-blue-300 mb-2">적용 규칙 안내</h5>
                      <ul className="space-y-1 text-blue-700 dark:text-blue-400">
                        <li>• 입차 시간 기준으로 해당 시간대 요금이 적용됩니다</li>
                        {form.nightRateEnabled && (
                          <li>• 평일 야간: {form.nightStart} ~ {form.nightEnd}</li>
                        )}
                        {form.weekendRateEnabled && (
                          <li>• 주말: 토요일, 일요일 전체</li>
                        )}
                        {form.weekendNightRateEnabled && (
                          <li>• 주말 야간: 토/일 {form.nightStart} ~ {form.nightEnd}</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 pt-4 border-t dark:border-gray-700">
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
                  <th className="px-4 py-3">시간대별</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="dark:text-gray-200">
                {plans.map((plan) => {
                  const rules = plan.rules || {};
                  return (
                  <tr key={plan.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 font-medium">{plan.name}</td>
                    <td className="px-4 py-3">{rules.freeMinutes ?? 0}분</td>
                    <td className="px-4 py-3">
                      {(rules.baseFee ?? 0).toLocaleString()}원 / {rules.baseMinutes ?? 0}분
                    </td>
                    <td className="px-4 py-3">
                      {(rules.additionalFee ?? 0).toLocaleString()}원 / {rules.additionalMinutes ?? 0}분
                    </td>
                    <td className="px-4 py-3">{(rules.dailyMax ?? 0).toLocaleString()}원</td>
                    <td className="px-4 py-3">
                      {rules.timeBasedEnabled ? (
                        <div className="flex flex-wrap gap-1">
                          {rules.nightRateEnabled && (
                            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded text-xs">
                              야간
                            </span>
                          )}
                          {rules.weekendRateEnabled && (
                            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 rounded text-xs">
                              주말
                            </span>
                          )}
                          {rules.weekendNightRateEnabled && (
                            <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300 rounded text-xs">
                              주말야간
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
