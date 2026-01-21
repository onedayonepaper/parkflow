import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

interface Payment {
  id: string;
  sessionId: string;
  plateNo: string;
  amount: number;
  method: string;
  status: string;
  pgTxId: string;
  approvedAt: string;
  cancelledAt?: string;
  createdAt: string;
}

export default function PaymentsPage() {
  const { addToast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    status: '',
    method: '',
    from: '',
    to: '',
  });

  useEffect(() => {
    loadPayments();
  }, [page, filters]);

  const loadPayments = async () => {
    setLoading(true);
    const params: Record<string, string> = { page: page.toString(), limit: '20' };
    if (filters.status) params.status = filters.status;
    if (filters.method) params.method = filters.method;
    if (filters.from) params.from = new Date(filters.from).toISOString();
    if (filters.to) params.to = new Date(filters.to + 'T23:59:59').toISOString();

    const result = await api.getPayments(params);
    if (result.ok && result.data) {
      setPayments(result.data.items);
      setTotalPages(result.data.totalPages);
      setTotal(result.data.total);
    }
    setLoading(false);
  };

  const handleCancel = async (payment: Payment) => {
    const reason = prompt('취소 사유를 입력하세요:');
    if (!reason) return;

    const result = await api.cancelPayment(payment.id, reason);
    if (result.ok) {
      addToast({ type: 'success', title: '취소 완료', message: '결제가 취소되었습니다.' });
      loadPayments();
    } else {
      addToast({ type: 'error', title: '취소 실패', message: result.error?.message || '취소에 실패했습니다.' });
    }
  };

  const handleExport = () => {
    const headers = ['ID', '차량번호', '금액', '결제방법', '상태', '승인일시', '취소일시'];
    const rows = payments.map(p => [
      p.id,
      p.plateNo || '-',
      p.amount.toString(),
      p.method,
      p.status,
      formatDateTime(p.approvedAt),
      p.cancelledAt ? formatDateTime(p.cancelledAt) : '-',
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `payments_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();

    addToast({ type: 'success', title: '내보내기 완료', message: 'CSV 파일이 다운로드됩니다.' });
  };

  const formatDateTime = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('ko-KR');
  };

  const formatDate = (iso: string) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('ko-KR');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">결제 내역</h2>
        <button
          onClick={handleExport}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          📥 CSV 내보내기
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">상태</label>
            <select
              value={filters.status}
              onChange={(e) => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">전체</option>
              <option value="PAID">결제완료</option>
              <option value="CANCELLED">취소</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">결제방법</label>
            <select
              value={filters.method}
              onChange={(e) => { setFilters(f => ({ ...f, method: e.target.value })); setPage(1); }}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="">전체</option>
              <option value="MOCK">Mock</option>
              <option value="CARD">카드</option>
              <option value="CASH">현금</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">시작일</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => { setFilters(f => ({ ...f, from: e.target.value })); setPage(1); }}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">종료일</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => { setFilters(f => ({ ...f, to: e.target.value })); setPage(1); }}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">총 건수</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{total}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">결제완료</p>
          <p className="text-2xl font-bold text-green-600">{payments.filter(p => p.status === 'PAID').length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">취소</p>
          <p className="text-2xl font-bold text-red-600">{payments.filter(p => p.status === 'CANCELLED').length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">합계</p>
          <p className="text-2xl font-bold text-blue-600">
            {payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + p.amount, 0).toLocaleString()}원
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">로딩 중...</div>
        ) : payments.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">결제 내역이 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr className="text-left text-sm text-gray-600 dark:text-gray-300">
                  <th className="px-4 py-3">결제일</th>
                  <th className="px-4 py-3">차량번호</th>
                  <th className="px-4 py-3">금액</th>
                  <th className="px-4 py-3">결제방법</th>
                  <th className="px-4 py-3">상태</th>
                  <th className="px-4 py-3">거래ID</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="dark:text-gray-200">
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 text-sm">{formatDate(payment.approvedAt)}</td>
                    <td className="px-4 py-3 font-mono">{payment.plateNo || '-'}</td>
                    <td className="px-4 py-3 font-semibold">{payment.amount.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-sm">{payment.method}</td>
                    <td className="px-4 py-3">
                      {payment.status === 'PAID' ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded text-xs">결제완료</span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded text-xs">취소</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 font-mono">{payment.pgTxId?.slice(0, 16)}...</td>
                    <td className="px-4 py-3">
                      {payment.status === 'PAID' && (
                        <button
                          onClick={() => handleCancel(payment)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          취소
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
          >
            이전
          </button>
          <span className="px-3 py-1 dark:text-gray-300">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50 dark:border-gray-600 dark:text-gray-300"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
