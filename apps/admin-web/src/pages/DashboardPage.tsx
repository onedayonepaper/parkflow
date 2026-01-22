import { useState, useEffect, useCallback } from 'react';
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

type EventType = '입차' | '출차' | '결제 완료' | '결제 취소' | '세션 업데이트' | '블랙리스트' | '장치 상태' | '차단기';

interface Event {
  id: string;
  type: EventType | string;
  plateNo?: string;
  sessionId?: string;
  status?: string;
  finalFee?: number;
  timestamp: string;
  severity?: 'info' | 'warning' | 'error';
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

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
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>('disconnected');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const addEvent = useCallback((event: Event) => {
    setRecentEvents((prev) => [event, ...prev.slice(0, 49)]);
    setLastUpdate(new Date());
  }, []);

  const loadStats = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadStats();

    // WebSocket 연결 상태 구독
    const unsubStatus = wsClient.onStatusChange(setWsStatus);

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

    // 결제 취소 이벤트
    const unsubPaymentCancelled = wsClient.on('PAYMENT_CANCELLED', (data) => {
      addEvent({
        id: data.paymentId,
        type: '결제 취소',
        sessionId: data.sessionId,
        status: data.reason,
        timestamp: new Date().toISOString(),
        severity: 'warning',
      });
      addToast({
        type: 'warning',
        title: '결제 취소',
        message: `결제가 취소되었습니다: ${data.reason || '사유 없음'}`,
        duration: 5000,
      });
      loadStats();
    });

    // 블랙리스트 알림 (중요!)
    const unsubBlacklist = wsClient.on('BLACKLIST_ALERT', (data) => {
      addEvent({
        id: `bl_${Date.now()}`,
        type: '블랙리스트',
        plateNo: data.plateNo,
        status: data.reason,
        timestamp: new Date().toISOString(),
        severity: 'error',
      });
      addToast({
        type: 'error',
        title: '⚠️ 블랙리스트 차량',
        message: `${data.plateNo} - ${data.reason || '블랙리스트 등록 차량'}`,
        duration: 10000,
      });
    });

    // 장치 상태 이벤트
    const unsubDevice = wsClient.on('DEVICE_STATUS', (data) => {
      addEvent({
        id: `dev_${Date.now()}`,
        type: '장치 상태',
        status: `${data.deviceId}: ${data.status}`,
        timestamp: new Date().toISOString(),
        severity: data.status === 'ERROR' ? 'error' : 'info',
      });
      if (data.status === 'ERROR' || data.status === 'OFFLINE') {
        addToast({
          type: 'error',
          title: '장치 오류',
          message: `${data.deviceId} 장치가 ${data.status} 상태입니다.`,
          duration: 8000,
        });
      }
    });

    // 차단기 상태 이벤트
    const unsubBarrier = wsClient.on('BARRIER_STATE', (data) => {
      addEvent({
        id: `bar_${Date.now()}`,
        type: '차단기',
        status: `${data.laneId || data.deviceId}: ${data.state}`,
        timestamp: new Date().toISOString(),
      });
    });

    return () => {
      unsubStatus();
      unsubPlate();
      unsubSession();
      unsubPayment();
      unsubPaymentCancelled();
      unsubBlacklist();
      unsubDevice();
      unsubBarrier();
    };
  }, [addToast, addEvent, loadStats]);

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString('ko-KR');
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600 dark:text-gray-400">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">대시보드</h2>
        <div className="flex items-center gap-4 text-sm">
          {lastUpdate && (
            <span className="text-gray-500 dark:text-gray-400">
              마지막 업데이트: {formatTime(lastUpdate.toISOString())}
            </span>
          )}
          <ConnectionIndicator status={wsStatus} onReconnect={() => wsClient.reconnect()} />
        </div>
      </div>

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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-white">시간대별 입/출차</h3>
          <div className="flex items-center gap-4 mb-4 text-sm">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-blue-500" />
              <span className="text-gray-600 dark:text-gray-400">입차</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span className="text-gray-600 dark:text-gray-400">출차</span>
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
            <div className="h-[180px] flex items-center justify-center text-gray-400 dark:text-gray-500">
              데이터 없음
            </div>
          )}
          <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>0시</span>
            <span>6시</span>
            <span>12시</span>
            <span>18시</span>
            <span>23시</span>
          </div>
        </div>

        {/* Weekly Revenue Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-white">주간 매출 추이</h3>
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
            <div className="h-[200px] flex items-center justify-center text-gray-400 dark:text-gray-500">
              데이터 없음
            </div>
          )}
        </div>
      </div>

      {/* Recent Events */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold dark:text-white">실시간 이벤트</h3>
          {recentEvents.length > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              최근 {Math.min(recentEvents.length, 20)}건
            </span>
          )}
        </div>

        {recentEvents.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">📡</div>
            <p className="text-gray-500 dark:text-gray-400">
              이벤트 대기 중...
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {wsStatus === 'connected' ? 'Device Agent를 실행하세요' : 'WebSocket 연결 대기 중'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 dark:text-gray-400 border-b dark:border-gray-700">
                  <th className="pb-2">시간</th>
                  <th className="pb-2">유형</th>
                  <th className="pb-2">차량번호</th>
                  <th className="pb-2">세션 ID</th>
                  <th className="pb-2">상태/금액</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.slice(0, 20).map((event, idx) => (
                  <tr
                    key={event.id}
                    className={`border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 ${
                      idx === 0 ? 'animate-pulse bg-blue-50/50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <td className="py-2 text-sm dark:text-gray-300">{formatTime(event.timestamp)}</td>
                    <td className="py-2">
                      <EventTypeBadge type={event.type} severity={event.severity} />
                    </td>
                    <td className="py-2 font-mono text-sm dark:text-gray-300">{event.plateNo || '-'}</td>
                    <td className="py-2 text-sm text-gray-500 dark:text-gray-400">
                      {event.sessionId?.slice(0, 12) || '-'}
                    </td>
                    <td className="py-2 text-sm dark:text-gray-300">
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
    blue: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
    yellow: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
    green: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
  };

  return (
    <div className={`rounded-lg border-2 p-6 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 dark:text-gray-400">{title}</p>
          <p className="text-3xl font-bold mt-1 dark:text-white">
            {value}
            <span className="text-lg text-gray-500 dark:text-gray-400 ml-1">{unit}</span>
          </p>
        </div>
        <span className="text-4xl">{icon}</span>
      </div>
    </div>
  );
}

function ConnectionIndicator({
  status,
  onReconnect,
}: {
  status: ConnectionStatus;
  onReconnect: () => void;
}) {
  const statusConfig = {
    connected: {
      color: 'bg-green-500',
      text: '실시간 연결됨',
      pulse: true,
    },
    connecting: {
      color: 'bg-yellow-500',
      text: '연결 중...',
      pulse: true,
    },
    disconnected: {
      color: 'bg-red-500',
      text: '연결 끊김',
      pulse: false,
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center">
        <span className={`w-2.5 h-2.5 rounded-full ${config.color}`} />
        {config.pulse && (
          <span className={`absolute w-2.5 h-2.5 rounded-full ${config.color} animate-ping`} />
        )}
      </div>
      <span className="text-gray-600 dark:text-gray-400">{config.text}</span>
      {status === 'disconnected' && (
        <button
          onClick={onReconnect}
          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs underline"
        >
          재연결
        </button>
      )}
    </div>
  );
}

function EventTypeBadge({
  type,
  severity,
}: {
  type: string;
  severity?: 'info' | 'warning' | 'error';
}) {
  const getClasses = () => {
    // severity가 지정되면 우선 적용
    if (severity === 'error') {
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    }
    if (severity === 'warning') {
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
    }

    // 타입별 색상
    switch (type) {
      case '입차':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case '출차':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case '결제 완료':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
      case '결제 취소':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case '블랙리스트':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 font-bold';
      case '장치 상태':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      case '차단기':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${getClasses()}`}>
      {type}
    </span>
  );
}
