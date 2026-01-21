import { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';

interface NotificationSettings {
  entryAlert: boolean;
  exitAlert: boolean;
  paymentAlert: boolean;
  errorAlert: boolean;
  membershipExpiry: boolean;
  soundEnabled: boolean;
  desktopNotification: boolean;
}

const defaultSettings: NotificationSettings = {
  entryAlert: true,
  exitAlert: true,
  paymentAlert: true,
  errorAlert: true,
  membershipExpiry: true,
  soundEnabled: true,
  desktopNotification: false,
};

export default function SettingsPage() {
  const { addToast } = useToast();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');

  useEffect(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem('notificationSettings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch {
        // Use defaults
      }
    }

    // Check notification permission
    if ('Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, []);

  const handleToggle = (key: keyof NotificationSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = () => {
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
    addToast({ type: 'success', title: '저장 완료', message: '알림 설정이 저장되었습니다.' });
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      addToast({ type: 'error', title: '지원 안됨', message: '이 브라우저는 알림을 지원하지 않습니다.' });
      return;
    }

    const permission = await Notification.requestPermission();
    setPermissionStatus(permission);

    if (permission === 'granted') {
      setSettings((prev) => ({ ...prev, desktopNotification: true }));
      addToast({ type: 'success', title: '권한 허용', message: '데스크톱 알림이 활성화되었습니다.' });

      // Test notification
      new Notification('ParkFlow 알림 테스트', {
        body: '알림이 정상적으로 작동합니다.',
        icon: '/favicon.ico',
      });
    } else {
      addToast({ type: 'error', title: '권한 거부', message: '알림 권한이 거부되었습니다.' });
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    addToast({ type: 'info', title: '초기화', message: '기본 설정으로 초기화되었습니다.' });
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">설정</h2>

      {/* Notification Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold dark:text-white">알림 설정</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">실시간 알림 수신 여부를 설정합니다</p>
        </div>
        <div className="p-6 space-y-4">
          <SettingToggle
            label="입차 알림"
            description="차량 입차 시 알림을 받습니다"
            checked={settings.entryAlert}
            onChange={() => handleToggle('entryAlert')}
          />
          <SettingToggle
            label="출차 알림"
            description="차량 출차 시 알림을 받습니다"
            checked={settings.exitAlert}
            onChange={() => handleToggle('exitAlert')}
          />
          <SettingToggle
            label="결제 알림"
            description="결제 완료/취소 시 알림을 받습니다"
            checked={settings.paymentAlert}
            onChange={() => handleToggle('paymentAlert')}
          />
          <SettingToggle
            label="오류 알림"
            description="시스템 오류 발생 시 알림을 받습니다"
            checked={settings.errorAlert}
            onChange={() => handleToggle('errorAlert')}
          />
          <SettingToggle
            label="정기권 만료 알림"
            description="정기권 만료 7일 전 알림을 받습니다"
            checked={settings.membershipExpiry}
            onChange={() => handleToggle('membershipExpiry')}
          />
        </div>
      </div>

      {/* Sound Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold dark:text-white">소리 설정</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">알림 소리 설정</p>
        </div>
        <div className="p-6 space-y-4">
          <SettingToggle
            label="알림 소리"
            description="알림 수신 시 소리를 재생합니다"
            checked={settings.soundEnabled}
            onChange={() => handleToggle('soundEnabled')}
          />
        </div>
      </div>

      {/* Desktop Notification Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold dark:text-white">데스크톱 알림</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">브라우저 데스크톱 알림 설정</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium dark:text-white">알림 권한</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                현재 상태:{' '}
                <span
                  className={
                    permissionStatus === 'granted'
                      ? 'text-green-600 dark:text-green-400'
                      : permissionStatus === 'denied'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-yellow-600 dark:text-yellow-400'
                  }
                >
                  {permissionStatus === 'granted' ? '허용됨' : permissionStatus === 'denied' ? '거부됨' : '미설정'}
                </span>
              </p>
            </div>
            {permissionStatus !== 'granted' && (
              <button
                onClick={requestNotificationPermission}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
              >
                권한 요청
              </button>
            )}
          </div>
          {permissionStatus === 'granted' && (
            <SettingToggle
              label="데스크톱 알림 활성화"
              description="브라우저가 백그라운드에 있어도 알림을 표시합니다"
              checked={settings.desktopNotification}
              onChange={() => handleToggle('desktopNotification')}
            />
          )}
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h3 className="text-lg font-semibold dark:text-white">시스템 정보</h3>
        </div>
        <div className="p-6 space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">버전</span>
            <span className="dark:text-white">1.0.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">환경</span>
            <span className="dark:text-white">{(import.meta as any).env?.MODE || 'production'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">브라우저</span>
            <span className="dark:text-white text-sm">{navigator.userAgent.split(' ').slice(-2).join(' ')}</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleSave}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          설정 저장
        </button>
        <button
          onClick={handleReset}
          className="px-6 py-2 border rounded-lg hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          기본값으로 초기화
        </button>
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium dark:text-white">{label}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
