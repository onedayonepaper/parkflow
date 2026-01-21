import { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';

interface ParkingSession {
  sessionId: string;
  plateNo: string;
  entryAt: string;
  duration: number;
  isVip: boolean;
  isMember: boolean;
}

interface SimulationResult {
  eventId: string;
  sessionId: string | null;
  plateNo: string;
  message: string;
  fee?: number;
  status?: string;
}

const API_BASE = '/api';

export default function SimulationPage() {
  const { addToast } = useToast();
  const [parking, setParking] = useState<ParkingSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [entryPlate, setEntryPlate] = useState('');
  const [exitPlate, setExitPlate] = useState('');
  const [lastResult, setLastResult] = useState<SimulationResult | null>(null);
  const [bulkCount, setBulkCount] = useState(5);

  useEffect(() => {
    loadParking();
    const interval = setInterval(loadParking, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadParking = async () => {
    try {
      const res = await fetch(`${API_BASE}/simulation/parking`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
      });
      const data = await res.json();
      if (data.ok) {
        setParking(data.data.items);
      }
    } catch (e) {
      console.error('Failed to load parking:', e);
    }
  };

  const simulateEntry = async (plateNo?: string, random = false) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/simulation/entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ plateNo, random }),
      });
      const data = await res.json();
      if (data.ok) {
        setLastResult(data.data);
        addToast({ type: 'success', title: '입차 완료', message: data.data.message });
        loadParking();
        setEntryPlate('');
      } else {
        addToast({ type: 'error', title: '입차 실패', message: data.error?.message });
      }
    } catch (e) {
      addToast({ type: 'error', title: '오류', message: '입차 시뮬레이션 실패' });
    }
    setLoading(false);
  };

  const simulateExit = async (plateNo?: string, sessionId?: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/simulation/exit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ plateNo, sessionId }),
      });
      const data = await res.json();
      if (data.ok) {
        setLastResult(data.data);
        addToast({
          type: data.data.status === 'EXIT_PENDING' ? 'warning' : 'success',
          title: data.data.status === 'EXIT_PENDING' ? '결제 대기' : '출차 완료',
          message: data.data.message,
        });
        loadParking();
        setExitPlate('');
      } else {
        addToast({ type: 'error', title: '출차 실패', message: data.error?.message });
      }
    } catch (e) {
      addToast({ type: 'error', title: '오류', message: '출차 시뮬레이션 실패' });
    }
    setLoading(false);
  };

  const simulateBulkEntry = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/simulation/bulk-entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ count: bulkCount }),
      });
      const data = await res.json();
      if (data.ok) {
        addToast({
          type: 'success',
          title: '대량 입차 완료',
          message: `${data.data.created}대 입차됨`,
        });
        loadParking();
      }
    } catch (e) {
      addToast({ type: 'error', title: '오류', message: '대량 입차 실패' });
    }
    setLoading(false);
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}시간 ${mins}분`;
    }
    return `${mins}분`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">시뮬레이션 테스트</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          하드웨어 없이 시스템을 테스트할 수 있습니다
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 입차 시뮬레이션 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-white flex items-center gap-2">
            <span className="text-2xl">🚗</span> 입차 시뮬레이션
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                차량번호
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={entryPlate}
                  onChange={(e) => setEntryPlate(e.target.value)}
                  placeholder="216고1234"
                  className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <button
                  onClick={() => simulateEntry(entryPlate || undefined)}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  입차
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => simulateEntry(undefined, true)}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                🎲 랜덤 입차
              </button>
            </div>

            <div className="border-t dark:border-gray-700 pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                대량 입차
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  value={bulkCount}
                  onChange={(e) => setBulkCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                  min={1}
                  max={50}
                  className="w-20 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">대</span>
                <button
                  onClick={simulateBulkEntry}
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  대량 입차
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 출차 시뮬레이션 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4 dark:text-white flex items-center gap-2">
            <span className="text-2xl">🚙</span> 출차 시뮬레이션
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                차량번호
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={exitPlate}
                  onChange={(e) => setExitPlate(e.target.value)}
                  placeholder="216고1234"
                  className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
                <button
                  onClick={() => simulateExit(exitPlate || undefined)}
                  disabled={loading || !exitPlate}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                >
                  출차
                </button>
              </div>
            </div>

            <button
              onClick={() => simulateExit()}
              disabled={loading || parking.length === 0}
              className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              🚪 가장 오래된 차량 출차
            </button>
          </div>
        </div>
      </div>

      {/* 마지막 결과 */}
      {lastResult && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg p-4">
          <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-2">마지막 이벤트</h4>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-gray-500 dark:text-gray-400">차량번호:</span>{' '}
              <span className="font-mono font-medium dark:text-white">{lastResult.plateNo}</span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">메시지:</span>{' '}
              <span className="dark:text-white">{lastResult.message}</span>
            </div>
            {lastResult.fee !== undefined && lastResult.fee > 0 && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">요금:</span>{' '}
                <span className="font-medium text-green-600 dark:text-green-400">
                  {lastResult.fee.toLocaleString()}원
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 현재 주차 중인 차량 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold dark:text-white">
            주차 중인 차량 ({parking.length}대)
          </h3>
          <button
            onClick={loadParking}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            새로고침
          </button>
        </div>

        {parking.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-4xl mb-2">🅿️</p>
            <p>주차 중인 차량이 없습니다</p>
            <p className="text-sm mt-1">입차 시뮬레이션을 실행해보세요</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr className="text-left text-sm text-gray-600 dark:text-gray-300">
                  <th className="px-4 py-3">차량번호</th>
                  <th className="px-4 py-3">입차시간</th>
                  <th className="px-4 py-3">주차시간</th>
                  <th className="px-4 py-3">구분</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="dark:text-gray-200">
                {parking.map((p) => (
                  <tr key={p.sessionId} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-3 font-mono">
                      {p.isVip && <span className="mr-1">👑</span>}
                      {p.isMember && <span className="mr-1">🎟️</span>}
                      {p.plateNo}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(p.entryAt).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        p.duration > 60
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : p.duration > 30
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      }`}>
                        {formatDuration(p.duration)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.isVip ? (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded text-xs">
                          VIP
                        </span>
                      ) : p.isMember ? (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-xs">
                          정기권
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded text-xs">
                          일반
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => simulateExit(undefined, p.sessionId)}
                        disabled={loading}
                        className="text-sm text-orange-600 hover:text-orange-800 dark:text-orange-400"
                      >
                        출차
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 테스트 시나리오 안내 */}
      <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">테스트 시나리오</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700 dark:text-blue-300">
          <div>
            <p className="font-medium mb-1">1. VIP 자동출차 테스트</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>VIP 자동출차 메뉴에서 차량 등록</li>
              <li>등록한 차량번호로 입차</li>
              <li>출차 시 무료 자동 출차 확인</li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-1">2. 정기권 테스트</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>정기권 메뉴에서 정기권 등록</li>
              <li>등록한 차량번호로 입차</li>
              <li>출차 시 무료 출차 확인</li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-1">3. 일반 차량 테스트</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>랜덤 입차 실행</li>
              <li>출차 시 요금 계산 확인</li>
              <li>결제 대기 상태 확인</li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-1">4. 블랙리스트 테스트</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>블랙리스트 메뉴에서 차량 등록</li>
              <li>등록한 차량번호로 입차 시도</li>
              <li>입차 거부 확인</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
