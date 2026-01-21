import { useState, useEffect } from 'react';
import { api } from '../lib/api';

interface ReportData {
  period: { from: string; to: string };
  summary: {
    totalRevenue: number;
    totalSessions: number;
    avgDuration: number;
    avgFee: number;
    cancelledCount: number;
    cancelledAmount: number;
    membershipUsage: number;
  };
  paymentMethods: { method: string; count: number; total: number }[];
  dailyRevenue: { date: string; revenue: number; payments: number }[];
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CARD: '카드',
  CASH: '현금',
  MOBILE: '모바일',
  MOCK: '테스트',
};

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<ReportData | null>(null);
  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const to = now.toISOString().slice(0, 10);
    return { from, to };
  });

  useEffect(() => {
    loadReport();
  }, [dateRange]);

  const loadReport = async () => {
    setLoading(true);
    const result = await api.getReportStats({
      from: dateRange.from,
      to: dateRange.to,
    });
    if (result.ok && result.data) {
      setReport(result.data);
    }
    setLoading(false);
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  };

  const handleExportCSV = () => {
    if (!report) return;

    const headers = ['날짜', '매출', '결제 건수'];
    const rows = report.dailyRevenue.map((d) => [
      d.date,
      d.revenue.toString(),
      d.payments.toString(),
    ]);

    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `report_${dateRange.from}_${dateRange.to}.csv`;
    link.click();
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
      case '3months':
        from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      default:
        return;
    }

    setDateRange({
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    });
  };

  if (loading) {
    return <div className="text-center py-8 dark:text-gray-300">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">통계 리포트</h2>
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
        >
          CSV 내보내기
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex gap-2">
            <button
              onClick={() => setPresetRange('today')}
              className="px-3 py-1 text-sm rounded-lg border dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300"
            >
              오늘
            </button>
            <button
              onClick={() => setPresetRange('week')}
              className="px-3 py-1 text-sm rounded-lg border dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300"
            >
              최근 7일
            </button>
            <button
              onClick={() => setPresetRange('month')}
              className="px-3 py-1 text-sm rounded-lg border dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300"
            >
              이번 달
            </button>
            <button
              onClick={() => setPresetRange('3months')}
              className="px-3 py-1 text-sm rounded-lg border dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-300"
            >
              최근 3개월
            </button>
          </div>
          <div className="flex gap-2 items-center">
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange((r) => ({ ...r, from: e.target.value }))}
              className="px-3 py-1 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
            <span className="dark:text-gray-400">~</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange((r) => ({ ...r, to: e.target.value }))}
              className="px-3 py-1 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
        </div>
      </div>

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">총 매출</p>
              <p className="text-2xl font-bold text-blue-600">{formatMoney(report.summary.totalRevenue)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">총 이용 건수</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{report.summary.totalSessions}건</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">평균 주차 시간</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{report.summary.avgDuration}분</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">평균 요금</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatMoney(report.summary.avgFee)}</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Payment Methods */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-4 dark:text-white">결제 수단별 통계</h3>
              {report.paymentMethods.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">데이터가 없습니다</p>
              ) : (
                <div className="space-y-3">
                  {report.paymentMethods.map((pm) => (
                    <div key={pm.method} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                        <span className="dark:text-gray-300">{PAYMENT_METHOD_LABELS[pm.method] || pm.method}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold dark:text-white">{formatMoney(pm.total)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{pm.count}건</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Additional Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold mb-4 dark:text-white">추가 통계</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="dark:text-gray-300">취소 건수</span>
                  <span className="font-semibold text-red-600">{report.summary.cancelledCount}건</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="dark:text-gray-300">취소 금액</span>
                  <span className="font-semibold text-red-600">{formatMoney(report.summary.cancelledAmount)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <span className="dark:text-gray-300">정기권 이용</span>
                  <span className="font-semibold text-green-600">{report.summary.membershipUsage}건</span>
                </div>
              </div>
            </div>
          </div>

          {/* Daily Revenue Chart (Table) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">일별 매출 추이</h3>
            {report.dailyRevenue.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">데이터가 없습니다</p>
            ) : (
              <>
                {/* Simple Bar Chart */}
                <div className="mb-4 h-48 flex items-end gap-1 overflow-x-auto pb-2">
                  {report.dailyRevenue.map((d) => {
                    const maxRevenue = Math.max(...report.dailyRevenue.map((x) => x.revenue));
                    const height = maxRevenue > 0 ? (d.revenue / maxRevenue) * 100 : 0;
                    return (
                      <div key={d.date} className="flex flex-col items-center min-w-[40px]">
                        <div
                          className="w-8 bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                          style={{ height: `${Math.max(height, 2)}%` }}
                          title={`${d.date}: ${formatMoney(d.revenue)}`}
                        />
                        <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {formatDate(d.date)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Data Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr className="text-left text-gray-600 dark:text-gray-300">
                        <th className="px-4 py-2">날짜</th>
                        <th className="px-4 py-2 text-right">매출</th>
                        <th className="px-4 py-2 text-right">결제 건수</th>
                      </tr>
                    </thead>
                    <tbody className="dark:text-gray-200">
                      {report.dailyRevenue.map((d) => (
                        <tr key={d.date} className="border-t dark:border-gray-700">
                          <td className="px-4 py-2">{d.date}</td>
                          <td className="px-4 py-2 text-right font-mono">{formatMoney(d.revenue)}</td>
                          <td className="px-4 py-2 text-right">{d.payments}건</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
