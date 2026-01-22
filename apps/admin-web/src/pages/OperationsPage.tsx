import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import { useToast } from '../components/Toast';

type BarrierState = 'OPEN' | 'CLOSED' | 'OPENING' | 'CLOSING' | 'ERROR' | 'UNKNOWN';

interface Barrier {
  deviceId: string;
  name: string;
  laneId: string;
  laneName: string;
  direction: 'ENTRY' | 'EXIT';
  state: BarrierState;
  connected: boolean;
}

interface BarrierCommand {
  id: string;
  deviceId: string;
  deviceName: string;
  laneId: string;
  laneName: string;
  direction: string;
  action: 'OPEN' | 'CLOSE';
  reason: string;
  status: string;
  createdAt: string;
  executedAt: string | null;
}

interface ActiveSession {
  id: string;
  plateNo: string;
  status: string;
  entryAt: string;
  exitAt: string | null;
  rawFee: number;
  discountTotal: number;
  finalFee: number;
  paymentStatus: string;
}

const stateStyles: Record<BarrierState, { label: string; bgColor: string; textColor: string; icon: string }> = {
  OPEN: { label: '열림', bgColor: 'bg-green-100 dark:bg-green-900', textColor: 'text-green-800 dark:text-green-200', icon: '🟢' },
  CLOSED: { label: '닫힘', bgColor: 'bg-red-100 dark:bg-red-900', textColor: 'text-red-800 dark:text-red-200', icon: '🔴' },
  OPENING: { label: '열리는중', bgColor: 'bg-yellow-100 dark:bg-yellow-900', textColor: 'text-yellow-800 dark:text-yellow-200', icon: '🟡' },
  CLOSING: { label: '닫히는중', bgColor: 'bg-yellow-100 dark:bg-yellow-900', textColor: 'text-yellow-800 dark:text-yellow-200', icon: '🟡' },
  ERROR: { label: '오류', bgColor: 'bg-red-100 dark:bg-red-900', textColor: 'text-red-800 dark:text-red-200', icon: '🔴' },
  UNKNOWN: { label: '알수없음', bgColor: 'bg-gray-100 dark:bg-gray-700', textColor: 'text-gray-800 dark:text-gray-200', icon: '⚪' },
};

export default function OperationsPage() {
  const { addToast } = useToast();
  const [barriers, setBarriers] = useState<Barrier[]>([]);
  const [commands, setCommands] = useState<BarrierCommand[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [controllingDevice, setControllingDevice] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Emergency open modal
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [emergencyLoading, setEmergencyLoading] = useState(false);

  // Manual entry form
  const [showManualEntryModal, setShowManualEntryModal] = useState(false);
  const [entryPlateNo, setEntryPlateNo] = useState('');
  const [entryNote, setEntryNote] = useState('');
  const [entryLoading, setEntryLoading] = useState(false);

  // Manual exit form
  const [showManualExitModal, setShowManualExitModal] = useState(false);
  const [exitPlateNo, setExitPlateNo] = useState('');
  const [exitSessionId, setExitSessionId] = useState('');
  const [exitOverridePayment, setExitOverridePayment] = useState(false);
  const [exitReason, setExitReason] = useState('');
  const [exitNote, setExitNote] = useState('');
  const [exitLoading, setExitLoading] = useState(false);

  const loadBarriers = useCallback(async () => {
    const result = await api.getBarriers();
    if (result.ok && result.data) {
      setBarriers(result.data.barriers);
    }
  }, []);

  const loadCommands = useCallback(async () => {
    const result = await api.getRecentBarrierCommands(10);
    if (result.ok && result.data) {
      setCommands(result.data.commands);
    }
  }, []);

  const loadActiveSessions = useCallback(async () => {
    const result = await api.getActiveSessions({ status: 'PARKING', limit: 50 });
    if (result.ok && result.data) {
      setActiveSessions(result.data.sessions);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadBarriers(), loadCommands(), loadActiveSessions()]);
    setLoading(false);
  }, [loadBarriers, loadCommands, loadActiveSessions]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadBarriers();
      loadActiveSessions();
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadBarriers, loadActiveSessions]);

  const handleOpenBarrier = async (deviceId: string, deviceName: string) => {
    setControllingDevice(deviceId);
    const result = await api.openBarrier(deviceId, 'MANUAL_OPEN_BY_OPERATOR');

    if (result.ok && result.data?.success) {
      addToast({
        type: 'success',
        title: '차단기 열림',
        message: `${deviceName} 차단기가 열렸습니다.`,
      });
      await loadAll();
    } else {
      addToast({
        type: 'error',
        title: '차단기 열기 실패',
        message: result.data?.error || result.error?.message || '알 수 없는 오류',
      });
    }
    setControllingDevice(null);
  };

  const handleCloseBarrier = async (deviceId: string, deviceName: string) => {
    setControllingDevice(deviceId);
    const result = await api.closeBarrier(deviceId, 'MANUAL_CLOSE_BY_OPERATOR');

    if (result.ok && result.data?.success) {
      addToast({
        type: 'success',
        title: '차단기 닫힘',
        message: `${deviceName} 차단기가 닫혔습니다.`,
      });
      await loadAll();
    } else {
      addToast({
        type: 'error',
        title: '차단기 닫기 실패',
        message: result.data?.error || result.error?.message || '알 수 없는 오류',
      });
    }
    setControllingDevice(null);
  };

  const handleEmergencyOpenAll = async () => {
    if (!emergencyReason.trim()) {
      addToast({
        type: 'error',
        title: '입력 오류',
        message: '긴급 개방 사유를 입력해주세요.',
      });
      return;
    }

    setEmergencyLoading(true);
    const result = await api.emergencyOpenAllBarriers(emergencyReason);

    if (result.ok && result.data) {
      const { total, success, failed } = result.data;
      addToast({
        type: failed > 0 ? 'warning' : 'success',
        title: '긴급 전체 개방 완료',
        message: `총 ${total}개 중 ${success}개 성공${failed > 0 ? `, ${failed}개 실패` : ''}`,
      });
      setShowEmergencyModal(false);
      setEmergencyReason('');
      await loadAll();
    } else {
      addToast({
        type: 'error',
        title: '긴급 개방 실패',
        message: result.error?.message || '알 수 없는 오류',
      });
    }
    setEmergencyLoading(false);
  };

  const handleManualEntry = async () => {
    if (!entryPlateNo.trim()) {
      addToast({
        type: 'error',
        title: '입력 오류',
        message: '차량 번호를 입력해주세요.',
      });
      return;
    }

    setEntryLoading(true);
    const result = await api.manualEntry({
      plateNo: entryPlateNo.toUpperCase().replace(/\s/g, ''),
      note: entryNote || undefined,
    });

    if (result.ok && result.data) {
      addToast({
        type: 'success',
        title: '수동 입차 완료',
        message: `${result.data.plateNo} 차량이 입차 처리되었습니다.`,
      });
      setShowManualEntryModal(false);
      setEntryPlateNo('');
      setEntryNote('');
      await loadAll();
    } else {
      addToast({
        type: 'error',
        title: '수동 입차 실패',
        message: result.error?.message || '알 수 없는 오류',
      });
    }
    setEntryLoading(false);
  };

  const handleManualExit = async () => {
    if (!exitPlateNo.trim() && !exitSessionId) {
      addToast({
        type: 'error',
        title: '입력 오류',
        message: '차량 번호 또는 세션을 선택해주세요.',
      });
      return;
    }

    if (!exitReason.trim()) {
      addToast({
        type: 'error',
        title: '입력 오류',
        message: '출차 사유를 입력해주세요.',
      });
      return;
    }

    setExitLoading(true);
    const result = await api.manualExit({
      sessionId: exitSessionId || undefined,
      plateNo: exitPlateNo.toUpperCase().replace(/\s/g, '') || undefined,
      overridePayment: exitOverridePayment,
      reason: exitReason,
      note: exitNote || undefined,
    });

    if (result.ok && result.data) {
      addToast({
        type: 'success',
        title: '수동 출차 완료',
        message: `${result.data.plateNo} 차량이 출차 처리되었습니다.${exitOverridePayment ? ' (결제 면제)' : ` (요금: ${result.data.finalFee.toLocaleString()}원)`}`,
      });
      setShowManualExitModal(false);
      setExitPlateNo('');
      setExitSessionId('');
      setExitOverridePayment(false);
      setExitReason('');
      setExitNote('');
      await loadAll();
    } else {
      addToast({
        type: 'error',
        title: '수동 출차 실패',
        message: result.error?.message || '알 수 없는 오류',
      });
    }
    setExitLoading(false);
  };

  const selectSessionForExit = (session: ActiveSession) => {
    setExitSessionId(session.id);
    setExitPlateNo(session.plateNo);
  };

  const entryBarriers = barriers.filter((b) => b.direction === 'ENTRY');
  const exitBarriers = barriers.filter((b) => b.direction === 'EXIT');

  const BarrierCard = ({ barrier }: { barrier: Barrier }) => {
    const stateStyle = stateStyles[barrier.state];
    const isControlling = controllingDevice === barrier.deviceId;

    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-2 ${
          barrier.connected ? 'border-transparent' : 'border-red-300 dark:border-red-700'
        }`}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{barrier.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{barrier.laneName}</p>
          </div>
          <div className="flex items-center gap-2">
            {!barrier.connected && (
              <span className="px-2 py-1 text-xs bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded">
                연결끊김
              </span>
            )}
            <span className={`px-2 py-1 text-xs rounded ${barrier.direction === 'ENTRY' ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200' : 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'}`}>
              {barrier.direction === 'ENTRY' ? '입차' : '출차'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{stateStyle.icon}</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${stateStyle.bgColor} ${stateStyle.textColor}`}>
            {stateStyle.label}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleOpenBarrier(barrier.deviceId, barrier.name)}
            disabled={isControlling || !barrier.connected || barrier.state === 'OPEN'}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isControlling ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                처리중...
              </span>
            ) : (
              '열기'
            )}
          </button>
          <button
            onClick={() => handleCloseBarrier(barrier.deviceId, barrier.name)}
            disabled={isControlling || !barrier.connected || barrier.state === 'CLOSED'}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {isControlling ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                처리중...
              </span>
            ) : (
              '닫기'
            )}
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">운영 관리</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">차단기 및 장비 수동 제어</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            자동 새로고침 (5초)
          </label>
          <button
            onClick={loadAll}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            새로고침
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => setShowEmergencyModal(true)}
          className="flex items-center justify-center gap-3 p-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-lg"
        >
          <span className="text-2xl">🚨</span>
          <span className="font-bold">긴급 전체 개방</span>
        </button>
        <button
          onClick={() => setShowManualEntryModal(true)}
          className="flex items-center justify-center gap-3 p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
        >
          <span className="text-2xl">🚙</span>
          <span className="font-bold">수동 입차 처리</span>
        </button>
        <button
          onClick={() => setShowManualExitModal(true)}
          className="flex items-center justify-center gap-3 p-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-lg"
        >
          <span className="text-2xl">🚗</span>
          <span className="font-bold">수동 출차 처리</span>
        </button>
      </div>

      {/* Barrier Control Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>🚧</span> 차단기 제어
        </h2>

        {barriers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            등록된 차단기가 없습니다.
          </div>
        ) : (
          <div className="space-y-6">
            {/* Entry Barriers */}
            {entryBarriers.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  입차 차단기
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {entryBarriers.map((barrier) => (
                    <BarrierCard key={barrier.deviceId} barrier={barrier} />
                  ))}
                </div>
              </div>
            )}

            {/* Exit Barriers */}
            {exitBarriers.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  출차 차단기
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {exitBarriers.map((barrier) => (
                    <BarrierCard key={barrier.deviceId} barrier={barrier} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Sessions Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>🚘</span> 현재 주차 차량 ({activeSessions.length}대)
        </h2>

        {activeSessions.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            현재 주차 중인 차량이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    차량번호
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    입차시간
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    주차시간
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    현재요금
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    결제상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {activeSessions.map((session) => {
                  const entryTime = new Date(session.entryAt);
                  const now = new Date();
                  const durationMinutes = Math.floor((now.getTime() - entryTime.getTime()) / 60000);
                  const hours = Math.floor(durationMinutes / 60);
                  const minutes = durationMinutes % 60;

                  return (
                    <tr key={session.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {session.plateNo}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {entryTime.toLocaleString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                        {session.finalFee.toLocaleString()}원
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            session.paymentStatus === 'PAID'
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                              : session.paymentStatus === 'PENDING'
                              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {session.paymentStatus === 'PAID' ? '결제완료' : session.paymentStatus === 'PENDING' ? '결제대기' : session.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => {
                            selectSessionForExit(session);
                            setShowManualExitModal(true);
                          }}
                          className="px-3 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors text-xs font-medium"
                        >
                          수동 출차
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Commands Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span>📋</span> 최근 제어 이력
        </h2>

        {commands.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            제어 이력이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    시간
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    차단기
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    동작
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    사유
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {commands.map((cmd) => (
                  <tr key={cmd.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {new Date(cmd.createdAt).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      <div>{cmd.deviceName}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{cmd.laneName}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          cmd.action === 'OPEN'
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                        }`}
                      >
                        {cmd.action === 'OPEN' ? '열기' : '닫기'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                      {cmd.reason}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          cmd.status === 'EXECUTED'
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : cmd.status === 'FAILED'
                            ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                            : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                        }`}
                      >
                        {cmd.status === 'EXECUTED' ? '완료' : cmd.status === 'FAILED' ? '실패' : '대기'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Emergency Open Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
              <span>🚨</span> 긴급 전체 개방
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              모든 차단기를 즉시 열림 상태로 전환합니다. 이 작업은 감사 로그에 기록됩니다.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                개방 사유 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={emergencyReason}
                onChange={(e) => setEmergencyReason(e.target.value)}
                placeholder="예: 화재 대피, 정전 등"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 dark:bg-gray-700 dark:text-white"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEmergencyModal(false);
                  setEmergencyReason('');
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleEmergencyOpenAll}
                disabled={emergencyLoading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
              >
                {emergencyLoading ? '처리중...' : '전체 개방'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualEntryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-blue-600 dark:text-blue-400 mb-4 flex items-center gap-2">
              <span>🚙</span> 수동 입차 처리
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              LPR 인식 없이 수동으로 차량 입차를 처리합니다.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  차량 번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={entryPlateNo}
                  onChange={(e) => setEntryPlateNo(e.target.value.toUpperCase())}
                  placeholder="예: 12가3456"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  비고
                </label>
                <textarea
                  value={entryNote}
                  onChange={(e) => setEntryNote(e.target.value)}
                  placeholder="예: 인식기 고장으로 수동 처리"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowManualEntryModal(false);
                  setEntryPlateNo('');
                  setEntryNote('');
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleManualEntry}
                disabled={entryLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
              >
                {entryLoading ? '처리중...' : '입차 처리'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Exit Modal */}
      {showManualExitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-purple-600 dark:text-purple-400 mb-4 flex items-center gap-2">
              <span>🚗</span> 수동 출차 처리
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              차량을 수동으로 출차 처리합니다. 결제를 면제할 수 있습니다.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  차량 번호 {!exitSessionId && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={exitPlateNo}
                  onChange={(e) => {
                    setExitPlateNo(e.target.value.toUpperCase());
                    setExitSessionId(''); // Clear session selection when typing
                  }}
                  placeholder="예: 12가3456"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                />
                {exitSessionId && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    선택된 세션: {exitSessionId.slice(0, 8)}...
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg">
                <input
                  type="checkbox"
                  id="overridePayment"
                  checked={exitOverridePayment}
                  onChange={(e) => setExitOverridePayment(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="overridePayment" className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  결제 면제 (요금 0원 처리)
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  출차 사유 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={exitReason}
                  onChange={(e) => setExitReason(e.target.value)}
                  placeholder="예: 장애인 차량, VIP 고객, 장비 고장 등"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  비고
                </label>
                <textarea
                  value={exitNote}
                  onChange={(e) => setExitNote(e.target.value)}
                  placeholder="추가 메모"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-gray-700 dark:text-white"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowManualExitModal(false);
                  setExitPlateNo('');
                  setExitSessionId('');
                  setExitOverridePayment(false);
                  setExitReason('');
                  setExitNote('');
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleManualExit}
                disabled={exitLoading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors font-medium"
              >
                {exitLoading ? '처리중...' : '출차 처리'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
