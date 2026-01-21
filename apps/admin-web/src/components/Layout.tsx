import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useEffect, useState } from 'react';
import { wsClient } from '../lib/ws';
import { useTheme } from '../contexts/ThemeContext';

const navItems = [
  { path: '/', label: '대시보드', icon: '📊' },
  { path: '/sessions', label: '주차 세션', icon: '🚗' },
  { path: '/payments', label: '결제 내역', icon: '💳' },
  { path: '/rate-plans', label: '요금 정책', icon: '💰' },
  { path: '/discount-rules', label: '할인 규칙', icon: '🎫' },
  { path: '/memberships', label: '정기권', icon: '🎟️' },
  { path: '/blacklist', label: '블랙리스트', icon: '🚫' },
  { path: '/whitelist', label: 'VIP 자동출차', icon: '👑' },
  { path: '/devices', label: '장비 관리', icon: '📷' },
  { path: '/kiosk', label: '키오스크', icon: '🖥️' },
  { path: '/reports', label: '통계 리포트', icon: '📈' },
  { path: '/notifications', label: '알림 관리', icon: '🔔' },
  { path: '/audit', label: '감사 로그', icon: '📋' },
  { path: '/sites', label: '주차장 관리', icon: '🏢' },
  { path: '/users', label: '사용자 관리', icon: '👥' },
  { path: '/settings', label: '설정', icon: '⚙️' },
  { path: '/guide', label: '사용 가이드', icon: '📖' },
  { path: '/installation', label: '설치 가이드', icon: '🛠️' },
  { path: '/hardware', label: '하드웨어 가이드', icon: '🔌' },
  { path: '/simulation', label: '시뮬레이션', icon: '🎮' },
  { path: '/status', label: '환경 상태', icon: '🔍' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    wsClient.connect();
    return () => wsClient.disconnect();
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 transition-colors">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm sticky top-0 z-30 transition-colors">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <span className="text-xl">☰</span>
            </button>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              🅿️ ParkFlow
            </h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Theme Toggle */}
            <div className="relative">
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
                className="appearance-none bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2 pr-8 text-sm cursor-pointer dark:text-white"
              >
                <option value="light">☀️ 라이트</option>
                <option value="dark">🌙 다크</option>
                <option value="system">💻 시스템</option>
              </select>
            </div>
            <span className="hidden sm:inline text-sm text-gray-600 dark:text-gray-300">
              {user?.username}
            </span>
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-50
            w-64 bg-white dark:bg-gray-800 shadow-sm
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            lg:translate-x-0 lg:min-h-[calc(100vh-64px)]
          `}
        >
          <div className="flex items-center justify-between p-4 lg:hidden border-b dark:border-gray-700">
            <span className="font-semibold dark:text-white">메뉴</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white"
            >
              ✕
            </button>
          </div>
          <nav className="p-4">
            <ul className="space-y-2">
              {navItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                      location.pathname === item.path
                        ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}
