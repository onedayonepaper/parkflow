import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

const statusLabels: Record<string, { label: string; color: string }> = {
  PARKING: { label: '주차중', color: 'bg-blue-100 text-blue-800' },
  EXIT_PENDING: { label: '출차대기', color: 'bg-yellow-100 text-yellow-800' },
  PAID: { label: '결제완료', color: 'bg-green-100 text-green-800' },
  CLOSED: { label: '종료', color: 'bg-gray-100 text-gray-800' },
  ERROR: { label: '오류', color: 'bg-red-100 text-red-800' },
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', plateNo: '' });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

  useEffect(() => {
    loadSessions();
  }, [filter.status, pagination.page]);

  const loadSessions = async () => {
    setLoading(true);
    const params: Record<string, string> = {
      page: String(pagination.page),
      limit: '20',
    };
    if (filter.status) params.status = filter.status;
    if (filter.plateNo) params.plateNo = filter.plateNo;

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

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('ko-KR');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">주차 세션</h2>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 flex gap-4 items-end">
        <div>
          <label className="block text-sm text-gray-600 mb-1">상태</label>
          <select
            value={filter.status}
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 border rounded-lg"
          >
            <option value="">전체</option>
            <option value="PARKING">주차중</option>
            <option value="EXIT_PENDING">출차대기</option>
            <option value="PAID">결제완료</option>
            <option value="CLOSED">종료</option>
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">차량번호</label>
          <input
            type="text"
            value={filter.plateNo}
            onChange={(e) => setFilter((f) => ({ ...f, plateNo: e.target.value }))}
            placeholder="12가3456"
            className="px-3 py-2 border rounded-lg"
          />
        </div>
        <button
          onClick={handleSearch}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          검색
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-8">로딩 중...</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">세션이 없습니다</div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-600">
                  <th className="px-4 py-3">차량번호</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">입차 시간</th>
                  <th className="px-4 py-3">출차 시간</th>
                  <th className="px-4 py-3 text-right">요금</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => {
                  const status = statusLabels[session.status] || { label: session.status, color: 'bg-gray-100' };
                  return (
                    <tr key={session.id} className="border-t hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono">{session.plateNo}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${status.color}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">{formatDateTime(session.entryAt)}</td>
                      <td className="px-4 py-3 text-sm">{formatDateTime(session.exitAt)}</td>
                      <td className="px-4 py-3 text-right">
                        {session.finalFee > 0 ? `${session.finalFee.toLocaleString()}원` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/sessions/${session.id}`}
                          className="text-primary-600 hover:text-primary-800 text-sm"
                        >
                          상세
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-4 py-3 border-t flex justify-between items-center">
              <span className="text-sm text-gray-600">
                총 {pagination.total}건
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 border rounded disabled:opacity-50"
                >
                  이전
                </button>
                <span className="px-3 py-1">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1 border rounded disabled:opacity-50"
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
