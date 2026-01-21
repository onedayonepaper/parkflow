import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { wsClient } from '../lib/ws';

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
  const [stats, setStats] = useState({
    parking: 0,
    exitPending: 0,
    todayRevenue: 0,
    todayEntries: 0,
    todayExits: 0,
    avgDurationMinutes: 0,
  });
  const [recentEvents, setRecentEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();

    // WebSocket 이벤트 구독
    const unsubPlate = wsClient.on('PLATE_EVENT', (data) => {
      addEvent({
        id: data.eventId,
        type: data.direction === 'ENTRY' ? '입차' : '출차',
        plateNo: data.plateNo,
        sessionId: data.sessionId,
        timestamp: new Date().toISOString(),
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
      loadStats();
    });

    return () => {
      unsubPlate();
      unsubSession();
      unsubPayment();
    };
  }, []);

  const loadStats = async () => {
    const res = await api.getDashboardStats();

    if (res.ok && res.data) {
      setStats({
        parking: res.data.currentParking,
        exitPending: res.data.exitPending,
        todayRevenue: res.data.todayRevenue,
        todayEntries: res.data.todayEntries,
        todayExits: res.data.todayExits,
        avgDurationMinutes: res.data.avgDurationMinutes,
      });
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
