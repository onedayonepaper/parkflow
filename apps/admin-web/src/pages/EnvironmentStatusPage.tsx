import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { wsClient } from '../lib/ws';

interface HealthStatus {
  status: string;
  timestamp: string;
  uptime: number;
  version: string;
  database: {
    status: string;
    size?: string;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

interface SystemInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  cpuCount: number;
  hostname: string;
}

export default function EnvironmentStatusPage() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/health');
      if (!response.ok) throw new Error('Health check failed');

      const data = await response.json();
      setHealth(data);
      setLastChecked(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const checkSystemInfo = async () => {
    try {
      const response = await fetch('/api/system/info');
      if (response.ok) {
        const result = await response.json();
        if (result.ok) {
          setSystemInfo(result.data);
        }
      }
    } catch (err) {
      // System info endpoint might not exist, ignore error
    }
  };

  useEffect(() => {
    checkHealth();
    checkSystemInfo();

    // Check WebSocket status
    const checkWsStatus = () => {
      // @ts-ignore - accessing private property for status check
      const ws = wsClient['ws'];
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          setWsStatus('connected');
        } else if (ws.readyState === WebSocket.CONNECTING) {
          setWsStatus('connecting');
        } else {
          setWsStatus('disconnected');
        }
      } else {
        setWsStatus('disconnected');
      }
    };

    checkWsStatus();
    const wsInterval = setInterval(checkWsStatus, 2000);
    const healthInterval = setInterval(checkHealth, 30000);

    return () => {
      clearInterval(wsInterval);
      clearInterval(healthInterval);
    };
  }, []);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days}일`);
    if (hours > 0) parts.push(`${hours}시간`);
    if (minutes > 0) parts.push(`${minutes}분`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}초`);

    return parts.join(' ');
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ok':
      case 'healthy':
      case 'connected':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'warning':
      case 'connecting':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'error':
      case 'disconnected':
      case 'unhealthy':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'ok':
      case 'healthy':
      case 'connected':
        return '✅';
      case 'warning':
      case 'connecting':
        return '⚠️';
      case 'error':
      case 'disconnected':
      case 'unhealthy':
        return '❌';
      default:
        return '❓';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            🔍 환경 상태
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            시스템 구성 요소의 현재 상태를 확인합니다
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastChecked && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              마지막 확인: {lastChecked.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => { checkHealth(); checkSystemInfo(); }}
            disabled={loading}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <span>🔄</span>
            )}
            새로고침
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-800 dark:text-red-200">
          ❌ 오류: {error}
        </div>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* API Server */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">API 서버</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(health?.status || 'unknown')}`}>
              {getStatusIcon(health?.status || 'unknown')} {health?.status || '확인 중...'}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">버전</span>
              <span className="font-mono text-gray-900 dark:text-white">{health?.version || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">업타임</span>
              <span className="text-gray-900 dark:text-white">{health?.uptime ? formatUptime(health.uptime) : '-'}</span>
            </div>
          </div>
        </div>

        {/* Database */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">데이터베이스</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(health?.database?.status || 'unknown')}`}>
              {getStatusIcon(health?.database?.status || 'unknown')} {health?.database?.status || '확인 중...'}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">타입</span>
              <span className="font-mono text-gray-900 dark:text-white">SQLite</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">크기</span>
              <span className="text-gray-900 dark:text-white">{health?.database?.size || '-'}</span>
            </div>
          </div>
        </div>

        {/* WebSocket */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">WebSocket</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(wsStatus)}`}>
              {getStatusIcon(wsStatus)} {wsStatus === 'connected' ? '연결됨' : wsStatus === 'connecting' ? '연결 중...' : '연결 안됨'}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">프로토콜</span>
              <span className="font-mono text-gray-900 dark:text-white">WS</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">실시간 이벤트</span>
              <span className="text-gray-900 dark:text-white">{wsStatus === 'connected' ? '수신 중' : '대기'}</span>
            </div>
          </div>
        </div>

        {/* Memory */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">메모리</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              health?.memory?.percentage && health.memory.percentage > 90
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                : health?.memory?.percentage && health.memory.percentage > 70
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            }`}>
              {health?.memory?.percentage ? `${health.memory.percentage.toFixed(1)}%` : '-'}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">사용</span>
              <span className="text-gray-900 dark:text-white">{health?.memory?.used ? formatBytes(health.memory.used) : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">전체</span>
              <span className="text-gray-900 dark:text-white">{health?.memory?.total ? formatBytes(health.memory.total) : '-'}</span>
            </div>
            {health?.memory && (
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                <div
                  className={`h-2 rounded-full ${
                    health.memory.percentage > 90
                      ? 'bg-red-500'
                      : health.memory.percentage > 70
                      ? 'bg-yellow-500'
                      : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(health.memory.percentage, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          💻 시스템 정보
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="border dark:border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">Node.js 버전</div>
            <div className="font-mono text-gray-900 dark:text-white mt-1">
              {systemInfo?.nodeVersion || '-'}
            </div>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">플랫폼</div>
            <div className="font-mono text-gray-900 dark:text-white mt-1">
              {systemInfo?.platform || '-'}
            </div>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">아키텍처</div>
            <div className="font-mono text-gray-900 dark:text-white mt-1">
              {systemInfo?.arch || '-'}
            </div>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">CPU 코어</div>
            <div className="font-mono text-gray-900 dark:text-white mt-1">
              {systemInfo?.cpuCount || '-'}
            </div>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">호스트명</div>
            <div className="font-mono text-gray-900 dark:text-white mt-1">
              {systemInfo?.hostname || '-'}
            </div>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">환경</div>
            <div className="font-mono text-gray-900 dark:text-white mt-1">
              {import.meta.env.MODE || 'development'}
            </div>
          </div>
        </div>
      </div>

      {/* Service Endpoints */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          🌐 서비스 엔드포인트
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="py-2 text-left text-gray-900 dark:text-white">서비스</th>
                <th className="py-2 text-left text-gray-900 dark:text-white">URL</th>
                <th className="py-2 text-left text-gray-900 dark:text-white">설명</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b dark:border-gray-700">
                <td className="py-3 text-gray-600 dark:text-gray-400">관리자 웹</td>
                <td className="py-3">
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-blue-600 dark:text-blue-400">
                    {window.location.origin}
                  </code>
                </td>
                <td className="py-3 text-gray-500 dark:text-gray-400">현재 접속 중</td>
              </tr>
              <tr className="border-b dark:border-gray-700">
                <td className="py-3 text-gray-600 dark:text-gray-400">키오스크</td>
                <td className="py-3">
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-blue-600 dark:text-blue-400">
                    {window.location.origin}/kiosk
                  </code>
                </td>
                <td className="py-3 text-gray-500 dark:text-gray-400">무인 정산기</td>
              </tr>
              <tr className="border-b dark:border-gray-700">
                <td className="py-3 text-gray-600 dark:text-gray-400">API 서버</td>
                <td className="py-3">
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-blue-600 dark:text-blue-400">
                    /api
                  </code>
                </td>
                <td className="py-3 text-gray-500 dark:text-gray-400">REST API</td>
              </tr>
              <tr className="border-b dark:border-gray-700">
                <td className="py-3 text-gray-600 dark:text-gray-400">API 문서</td>
                <td className="py-3">
                  <a
                    href="/api/docs"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    /api/docs
                  </a>
                </td>
                <td className="py-3 text-gray-500 dark:text-gray-400">Swagger UI</td>
              </tr>
              <tr className="border-b dark:border-gray-700">
                <td className="py-3 text-gray-600 dark:text-gray-400">WebSocket</td>
                <td className="py-3">
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-blue-600 dark:text-blue-400">
                    /api/ws
                  </code>
                </td>
                <td className="py-3 text-gray-500 dark:text-gray-400">실시간 이벤트</td>
              </tr>
              <tr>
                <td className="py-3 text-gray-600 dark:text-gray-400">LPR 이벤트</td>
                <td className="py-3">
                  <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-blue-600 dark:text-blue-400">
                    /api/device/lpr/events
                  </code>
                </td>
                <td className="py-3 text-gray-500 dark:text-gray-400">LPR 카메라 연동</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Environment Variables (Safe to display) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          ⚙️ 환경 설정
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border dark:border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">API Base URL</div>
            <div className="font-mono text-gray-900 dark:text-white mt-1 break-all">
              {import.meta.env.VITE_API_URL || '/api'}
            </div>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">빌드 모드</div>
            <div className="font-mono text-gray-900 dark:text-white mt-1">
              {import.meta.env.MODE}
            </div>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">프로덕션 여부</div>
            <div className="font-mono text-gray-900 dark:text-white mt-1">
              {import.meta.env.PROD ? 'Yes' : 'No'}
            </div>
          </div>
          <div className="border dark:border-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">개발 모드</div>
            <div className="font-mono text-gray-900 dark:text-white mt-1">
              {import.meta.env.DEV ? 'Yes' : 'No'}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          🔗 빠른 링크
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a
            href="/api/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-4 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-2xl">📚</span>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">API 문서</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Swagger UI</div>
            </div>
          </a>
          <a
            href="/kiosk"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-4 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-2xl">🖥️</span>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">키오스크</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">무인 정산기</div>
            </div>
          </a>
          <a
            href="/guide"
            className="flex items-center gap-2 p-4 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-2xl">📖</span>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">사용 가이드</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">매뉴얼</div>
            </div>
          </a>
          <a
            href="/installation"
            className="flex items-center gap-2 p-4 border dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <span className="text-2xl">🛠️</span>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">설치 가이드</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">설치 매뉴얼</div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
