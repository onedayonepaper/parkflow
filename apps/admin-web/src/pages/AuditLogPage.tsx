import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

interface AuditLog {
  id: string;
  userId: string | null;
  username: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  detail: Record<string, any>;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: '생성',
  UPDATE: '수정',
  DELETE: '삭제',
  LOGIN: '로그인',
  LOGOUT: '로그아웃',
  PAYMENT_APPROVE: '결제 승인',
  PAYMENT_CANCEL: '결제 취소',
  SESSION_RECALC: '요금 재계산',
  SESSION_CORRECT: '세션 수정',
  SESSION_FORCE_CLOSE: '강제 종료',
  DISCOUNT_APPLY: '할인 적용',
  BARRIER_OPEN: '차단기 열림',
  BARRIER_CLOSE: '차단기 닫힘',
};

const ENTITY_TYPE_LABELS: Record<string, string> = {
  user: '사용자',
  session: '주차 세션',
  payment: '결제',
  rate_plan: '요금제',
  discount_rule: '할인 규칙',
  membership: '정기권',
  device: '장비',
  barrier: '차단기',
};

export default function AuditLogPage() {
  const { addToast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [filter, setFilter] = useState({
    action: '',
    entityType: '',
    userId: '',
    from: '',
    to: '',
  });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  useEffect(() => {
    loadFilters();
  }, []);

  useEffect(() => {
    loadLogs();
  }, [pagination.page]);

  const loadFilters = async () => {
    const [actionsResult, entityTypesResult] = await Promise.all([
      api.getAuditActions(),
      api.getAuditEntityTypes(),
    ]);
    if (actionsResult.ok && actionsResult.data) {
      setActions(actionsResult.data.actions);
    }
    if (entityTypesResult.ok && entityTypesResult.data) {
      setEntityTypes(entityTypesResult.data.entityTypes);
    }
  };

  const loadLogs = async () => {
    setLoading(true);
    const params: Record<string, string> = {
      page: String(pagination.page),
      limit: '30',
    };
    if (filter.action) params.action = filter.action;
    if (filter.entityType) params.entityType = filter.entityType;
    if (filter.userId) params.userId = filter.userId;
    if (filter.from) params.from = filter.from;
    if (filter.to) params.to = filter.to;

    const result = await api.getAuditLogs(params);
    if (result.ok && result.data) {
      setLogs(result.data.items);
      setPagination((p) => ({
        ...p,
        totalPages: result.data!.totalPages,
        total: result.data!.total,
      }));
    }
    setLoading(false);
  };

  const handleSearch = () => {
    setPagination((p) => ({ ...p, page: 1 }));
    loadLogs();
  };

  const handleReset = () => {
    setFilter({
      action: '',
      entityType: '',
      userId: '',
      from: '',
      to: '',
    });
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const handleExportCSV = () => {
    const headers = ['시간', '사용자', '액션', '대상 유형', '대상 ID', '상세'];
    const rows = logs.map((log) => [
      new Date(log.createdAt).toLocaleString('ko-KR'),
      log.username || log.userId || 'System',
      ACTION_LABELS[log.action] || log.action,
      ENTITY_TYPE_LABELS[log.entityType] || log.entityType,
      log.entityId || '-',
      JSON.stringify(log.detail),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    addToast({ type: 'success', title: '내보내기 완료', message: 'CSV 파일이 다운로드됩니다.' });
  };

  const formatDateTime = (iso: string) => {
    return new Date(iso).toLocaleString('ko-KR');
  };

  const setPresetRange = (preset: string) => {
    const now = new Date();
    let from: Date;
    const to = now;

    switch (preset) {
      case 'today':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case 'month':
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        return;
    }

    setFilter((f) => ({
      ...f,
      from: from.toISOString(),
      to: to.toISOString(),
    }));
  };

  const getActionColor = (action: string) => {
    if (action.includes('DELETE') || action.includes('CANCEL')) {
      return 'text-red-600 dark:text-red-400';
    }
    if (action.includes('CREATE') || action.includes('APPROVE')) {
      return 'text-green-600 dark:text-green-400';
    }
    if (action.includes('UPDATE') || action.includes('RECALC')) {
      return 'text-blue-600 dark:text-blue-400';
    }
    return 'text-gray-600 dark:text-gray-400';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">감사 로그</h2>
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
        >
          CSV 내보내기
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">액션</label>
            <select
              value={filter.action}
              onChange={(e) => setFilter((f) => ({ ...f, action: e.target.value }))}
              className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">전체</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {ACTION_LABELS[action] || action}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">대상 유형</label>
            <select
              value={filter.entityType}
              onChange={(e) => setFilter((f) => ({ ...f, entityType: e.target.value }))}
              className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">전체</option>
              {entityTypes.map((type) => (
                <option key={type} value={type}>
                  {ENTITY_TYPE_LABELS[type] || type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">기간</label>
            <div className="flex gap-2 items-center">
              <input
                type="date"
                value={filter.from ? filter.from.slice(0, 10) : ''}
                onChange={(e) =>
                  setFilter((f) => ({ ...f, from: e.target.value ? new Date(e.target.value).toISOString() : '' }))
                }
                className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
              <span className="dark:text-gray-400">~</span>
              <input
                type="date"
                value={filter.to ? filter.to.slice(0, 10) : ''}
                onChange={(e) =>
                  setFilter((f) => ({ ...f, to: e.target.value ? new Date(e.target.value).toISOString() : '' }))
                }
                className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPresetRange('today')}
              className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              오늘
            </button>
            <button
              onClick={() => setPresetRange('week')}
              className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              최근 7일
            </button>
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            검색
          </button>
          <button
            onClick={handleReset}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            초기화
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-8 dark:text-gray-300">로딩 중...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">로그가 없습니다</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr className="text-left text-sm text-gray-600 dark:text-gray-300">
                    <th className="px-4 py-3">시간</th>
                    <th className="px-4 py-3">사용자</th>
                    <th className="px-4 py-3">액션</th>
                    <th className="px-4 py-3">대상</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="dark:text-gray-200">
                  {logs.map((log) => (
                    <>
                      <tr
                        key={log.id}
                        className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                        onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                      >
                        <td className="px-4 py-3 text-sm">{formatDateTime(log.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className="text-sm">{log.username || log.userId || 'System'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${getActionColor(log.action)}`}>
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className="text-gray-500 dark:text-gray-400">
                            {ENTITY_TYPE_LABELS[log.entityType] || log.entityType}
                          </span>
                          {log.entityId && (
                            <span className="ml-2 font-mono text-xs">{log.entityId}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-gray-400">{expandedLog === log.id ? '▲' : '▼'}</span>
                        </td>
                      </tr>
                      {expandedLog === log.id && (
                        <tr key={`${log.id}-detail`} className="bg-gray-50 dark:bg-gray-700/50">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="text-sm">
                              <p className="text-gray-600 dark:text-gray-400 mb-2">상세 정보:</p>
                              <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto text-xs">
                                {JSON.stringify(log.detail, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t dark:border-gray-700 flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">총 {pagination.total}건</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 border rounded disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
                >
                  이전
                </button>
                <span className="px-3 py-1 dark:text-gray-300">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1 border rounded disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
                >
                  다음
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
