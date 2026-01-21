import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { wsClient } from '../lib/ws';
import { BarChart, LineChart } from '../components/charts';
import { useToast } from '../components/Toast';

interface HourlyData {
  hour: number;
  entries: number;
  exits: number;
}

interface DailyData {
  date: string;
  revenue: number;
  sessions: number;
}

interface Event {
  id: string;
  type: string;
  plateNo?: string;
  sessionId?: string;
  status?: string;
  finalFee?: number;
  timestamp: string;
}

export default function DashboardPage() {
  const { addToast } = useToast();
  const [stats, setStats] = useState({
    parking: 0,
    exitPending: 0,
    todayRevenue: 0,
    todayEntries: 0,
    todayExits: 0,
    avgDurationMinutes: 0,
  });
  const [recentEvents, setRecentEvents] = useState<Event[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyData[]>([]);
  const [weeklyData, setWeeklyData] = useState<DailyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();

    // WebSocket 이벤트 구독
    const unsubPlate = wsClient.on('PLATE_EVENT', (data) => {
      const isEntry = data.direction === 'ENTRY';
      addEvent({
        id: data.eventId,
        type: isEntry ? '입차' : '출차',
        plateNo: data.plateNo,
        sessionId: data.sessionId,
        timestamp: new Date().toISOString(),
      });
      addToast({
        type: isEntry ? 'success' : 'info',
        title: isEntry ? '차량 입차' : '차량 출차',
        message: `${data.plateNo} 차량이 ${isEntry ? '입차' : '출차'}했습니다.`,
        duration: 4000,
      });
      loadStats();
    });

    const unsubSession = wsClient.on('SESSION_UPDATED', (data) => {
      addEvent({
        id: `sess_${Date.now()}`,
        type: '세션 업데이트',
        sessionId: data.sessionId,
        status: data.status,
        finalFee: data.finalFee,
        timestamp: new Date().toISOString(),
      });
      if (data.status === 'PAID') {
        addToast({
          type: 'success',
          title: '결제 완료',
          message: `세션 ${data.sessionId.slice(0, 8)}... 결제가 완료되었습니다.`,
          duration: 4000,
        });
      } else if (data.status === 'ERROR') {
        addToast({
          type: 'error',
          title: '세션 오류',
          message: `세션 ${data.sessionId.slice(0, 8)}...에 오류가 발생했습니다.`,
          duration: 6000,
        });
      }
      loadStats();
    });

    const unsubPayment = wsClient.on('PAYMENT_COMPLETED', (data) => {
      addEvent({
        id: data.paymentId,
        type: '결제 완료',
        sessionId: data.sessionId,
        finalFee: data.amount,
        timestamp: new Date().toISOString(),
      });
      addToast({
        type: 'success',
        title: '💳 결제 완료',
        message: `${data.amount.toLocaleString()}원 결제가 완료되었습니다.`,
        duration: 5000,
      });
      loadStats();
    });

    return () => {
      unsubPlate();
      unsubSession();
      unsubPayment();
    };
  }, [addToast]);

  const loadStats = async () => {
    const [dashRes, hourlyRes, weeklyRes] = await Promise.all([
      api.getDashboardStats(),
      api.getHourlyStats(),
      api.getWeeklyStats(),
    ]);

    if (dashRes.ok && dashRes.data) {
      setStats({
        parking: dashRes.data.currentParking,
        exitPending: dashRes.data.exitPending,
        todayRevenue: dashRes.data.todayRevenue,
        todayEntries: dashRes.data.todayEntries,
        todayExits: dashRes.data.todayExits,
        avgDurationMinutes: dashRes.data.avgDurationMinutes,
      });
    }

    if (hourlyRes.ok && hourlyRes.data) {
      setHourlyData(hourlyRes.data.hourly);
    }

    if (weeklyRes.ok && weeklyRes.data) {
      setWeeklyData(weeklyRes.data.daily);
    }

    setLoading(false);
  };

  const addEvent = (event: Event) => {
    setRecentEvents((prev) => [event, ...prev.slice(0, 49)]);
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('ko-KR');
  };

  if (loading) {
    return <div className="text-center py-8">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">대시보드</h2>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="현재 주차중"
          value={stats.parking}
          unit="대"
          icon="🚗"
          color="blue"
        />
        <StatCard
          title="출차 대기"
          value={stats.exitPending}
          unit="대"
          icon="⏳"
          color="yellow"
        />
        <StatCard
          title="금일 매출"
          value={stats.todayRevenue.toLocaleString()}
          unit="원"
          icon="💰"
          color="green"
        />
        <StatCard
          title="금일 입차"
          value={stats.todayEntries}
          unit="건"
          icon="🚙"
          color="blue"
        />
        <StatCard
          title="금일 출차"
          value={stats.todayExits}
          unit="건"
          icon="🚕"
          color="yellow"
        />
        <StatCard
          title="평균 주차"
          value={stats.avgDurationMinutes}
          unit="분"
          icon="⏱️"
          color="green"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">시간대별 입/출차</h3>
          <div className="flex items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span className="text-gray-600">입차</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span className="text-gray-600">출차</span>
            </div>
          </div>
          {hourlyData.length > 0 ? (
            <BarChart
              data={hourlyData.map(h => ({
                label: `${h.hour}시`,
                value: h.entries,
                secondaryValue: h.exits,
              }))}
              height={180}
              primaryColor="#3B82F6"
              secondaryColor="#10B981"
              showLabels={false}
            />
          ) : (
            <div className="h-[180px] flex items-center justify-center text-gray-400">
              데이터 없음
            </div>
          )}
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>0시</span>
            <span>6시</span>
            <span>12시</span>
            <span>18시</span>
            <span>23시</span>
          </div>
        </div>

        {/* Weekly Revenue Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">주간 매출 추이</h3>
          {weeklyData.length > 0 ? (
            <LineChart
              data={weeklyData.map(d => ({
                label: d.date.slice(5), // MM-DD
                value: d.revenue,
              }))}
              height={200}
              color="#10B981"
              fillColor="rgba(16, 185, 129, 0.1)"
              unit="원"
              formatValue={(v) => `${(v / 1000).toFixed(0)}K`}
            />
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400">
              데이터 없음
            </div>
          )}
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">실시간 이벤트</h3>

        {recentEvents.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            이벤트 대기 중... (Device Agent를 실행하세요)
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-2">시간</th>
                  <th className="pb-2">유형</th>
                  <th className="pb-2">차량번호</th>
                  <th className="pb-2">세션 ID</th>
                  <th className="pb-2">상태/금액</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.slice(0, 20).map((event) => (
                  <tr key={event.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 text-sm">{formatTime(event.timestamp)}</td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          event.type === '입차'
                            ? 'bg-green-100 text-green-800'
                            : event.type === '출차'
                            ? 'bg-red-100 text-red-800'
                            : event.type === '결제 완료'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {event.type}
                      </span>
                    </td>
                    <td className="py-2 font-mono text-sm">{event.plateNo || '-'}</td>
                    <td className="py-2 text-sm text-gray-500">
                      {event.sessionId?.slice(0, 12) || '-'}
                    </td>
                    <td className="py-2 text-sm">
                      {event.status || (event.finalFee !== undefined ? `${event.finalFee.toLocaleString()}원` : '-')}
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

function StatCard({
  title,
  value,
  unit,
  icon,
  color,
}: {
  title: string;
  value: number | string;
  unit: string;
  icon: string;
  color: 'blue' | 'yellow' | 'green';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    green: 'bg-green-50 border-green-200',
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">{title}</p>
          <p className="text-3xl font-bold mt-1">
            {value}
            <span className="text-lg text-gray-500 ml-1">{unit}</span>
          </p>
        </div>
        <span className="text-4xl">{icon}</span>
      </div>
    </div>
  );
}
