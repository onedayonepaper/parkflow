import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

const statusLabels: Record<string, { label: string; color: string; darkColor: string }> = {
  PARKING: { label: '주차중', color: 'bg-blue-100 text-blue-800', darkColor: 'dark:bg-blue-900 dark:text-blue-200' },
  EXIT_PENDING: { label: '출차대기', color: 'bg-yellow-100 text-yellow-800', darkColor: 'dark:bg-yellow-900 dark:text-yellow-200' },
  PAID: { label: '결제완료', color: 'bg-green-100 text-green-800', darkColor: 'dark:bg-green-900 dark:text-green-200' },
  CLOSED: { label: '종료', color: 'bg-gray-100 text-gray-800', darkColor: 'dark:bg-gray-700 dark:text-gray-200' },
  ERROR: { label: '오류', color: 'bg-red-100 text-red-800', darkColor: 'dark:bg-red-900 dark:text-red-200' },
};

const paymentStatusLabels: Record<string, string> = {
  NONE: '미결제',
  PENDING: '결제중',
  PAID: '결제완료',
  FAILED: '결제실패',
  CANCELLED: '취소됨',
};

export default function SessionsPage() {
  const { addToast } = useToast();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filter, setFilter] = useState({
    status: '',
    plateNo: '',
    paymentStatus: '',
    fromDate: '',
    toDate: '',
  });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  useEffect(() => {
    loadSessions();
  }, [pagination.page]);

  const loadSessions = async () => {
    setLoading(true);
    const params: Record<string, string> = {
      page: String(pagination.page),
      limit: '20',
    };
    if (filter.status) params.status = filter.status;
    if (filter.plateNo) params.plateNo = filter.plateNo;
    if (filter.paymentStatus) params.paymentStatus = filter.paymentStatus;
    if (filter.fromDate) params.fromDate = filter.fromDate;
    if (filter.toDate) params.toDate = filter.toDate;

    const result = await api.getSessions(params);
    if (result.ok && result.data) {
      setSessions(result.data.items);
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
    loadSessions();
  };

  const handleReset = () => {
    setFilter({
      status: '',
      plateNo: '',
      paymentStatus: '',
      fromDate: '',
      toDate: '',
    });
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const handleExportCSV = () => {
    const headers = ['차량번호', '상태', '결제상태', '입차시간', '출차시간', '원요금', '할인', '최종요금'];
    const rows = sessions.map((s) => [
      s.plateNo,
      statusLabels[s.status]?.label || s.status,
      paymentStatusLabels[s.paymentStatus] || s.paymentStatus,
      s.entryAt ? new Date(s.entryAt).toLocaleString('ko-KR') : '',
      s.exitAt ? new Date(s.exitAt).toLocaleString('ko-KR') : '',
      s.rawFee?.toString() || '0',
      s.discountTotal?.toString() || '0',
      s.finalFee?.toString() || '0',
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sessions_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    addToast({ type: 'success', title: '내보내기 완료', message: 'CSV 파일이 다운로드됩니다.' });
  };

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '-';
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
      fromDate: from.toISOString().slice(0, 10),
      toDate: to.toISOString().slice(0, 10),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">주차 세션</h2>
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
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">상태</label>
            <select
              value={filter.status}
              onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
              className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">전체</option>
              <option value="PARKING">주차중</option>
              <option value="EXIT_PENDING">출차대기</option>
              <option value="PAID">결제완료</option>
              <option value="CLOSED">종료</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">차량번호</label>
            <input
              type="text"
              value={filter.plateNo}
              onChange={(e) => setFilter((f) => ({ ...f, plateNo: e.target.value }))}
              placeholder="12가3456"
              className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            검색
          </button>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-4 py-2 border rounded-lg hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {showAdvanced ? '간단 검색' : '고급 검색'}
          </button>
        </div>

        {/* Advanced Filters */}
        {showAdvanced && (
          <div className="mt-4 pt-4 border-t dark:border-gray-700">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">결제 상태</label>
                <select
                  value={filter.paymentStatus}
                  onChange={(e) => setFilter((f) => ({ ...f, paymentStatus: e.target.value }))}
                  className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="">전체</option>
                  <option value="NONE">미결제</option>
                  <option value="PENDING">결제중</option>
                  <option value="PAID">결제완료</option>
                  <option value="FAILED">결제실패</option>
                  <option value="CANCELLED">취소됨</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">기간</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={filter.fromDate}
                    onChange={(e) => setFilter((f) => ({ ...f, fromDate: e.target.value }))}
                    className="px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  <span className="dark:text-gray-400">~</span>
                  <input
                    type="date"
                    value={filter.toDate}
                    onChange={(e) => setFilter((f) => ({ ...f, toDate: e.target.value }))}
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
                <button
                  onClick={() => setPresetRange('month')}
                  className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  이번 달
                </button>
              </div>
              <button
                onClick={handleReset}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                초기화
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-8 dark:text-gray-300">로딩 중...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">세션이 없습니다</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr className="text-left text-sm text-gray-600 dark:text-gray-300">
                    <th className="px-4 py-3">차량번호</th>
                    <th className="px-4 py-3">상태</th>
                    <th className="px-4 py-3">결제상태</th>
                    <th className="px-4 py-3">입차 시간</th>
                    <th className="px-4 py-3">출차 시간</th>
                    <th className="px-4 py-3 text-right">요금</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="dark:text-gray-200">
                  {sessions.map((session) => {
                    const status = statusLabels[session.status] || { label: session.status, color: 'bg-gray-100', darkColor: '' };
                    return (
                      <tr key={session.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 font-mono">{session.plateNo}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${status.color} ${status.darkColor}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {paymentStatusLabels[session.paymentStatus] || session.paymentStatus}
                        </td>
                        <td className="px-4 py-3 text-sm">{formatDateTime(session.entryAt)}</td>
                        <td className="px-4 py-3 text-sm">{formatDateTime(session.exitAt)}</td>
                        <td className="px-4 py-3 text-right font-mono">
                          {session.finalFee > 0 ? `${session.finalFee.toLocaleString()}원` : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            to={`/sessions/${session.id}`}
                            className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 text-sm"
                          >
                            상세
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
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
