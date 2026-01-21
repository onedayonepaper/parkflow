import { create } from 'zustand';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  autoClose?: boolean;
}

interface NotificationState {
  notifications: Notification[];
  toasts: Notification[];
  unreadCount: number;
  soundEnabled: boolean;
  desktopEnabled: boolean;

  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  addToast: (toast: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  removeToast: (id: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  setDesktopEnabled: (enabled: boolean) => void;
}

// 알림 소리 재생
function playNotificationSound(type: NotificationType) {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // 타입별 다른 소리
    switch (type) {
      case 'error':
        oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
        break;
      case 'warning':
        oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
        break;
      case 'success':
        oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
        break;
      default:
        oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
    }

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    // 소리 재생 실패 무시
  }
}

// 데스크톱 알림 표시
function showDesktopNotification(title: string, message: string, type: NotificationType) {
  if (Notification.permission === 'granted') {
    const iconMap: Record<NotificationType, string> = {
      info: '📋',
      success: '✅',
      warning: '⚠️',
      error: '🚨',
    };

    new Notification(`${iconMap[type]} ${title}`, {
      body: message,
      icon: '/favicon.ico',
      tag: 'parkflow-notification',
    });
  }
}

let notificationIdCounter = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  toasts: [],
  unreadCount: 0,
  soundEnabled: localStorage.getItem('notification_sound') !== 'false',
  desktopEnabled: localStorage.getItem('notification_desktop') === 'true',

  addNotification: (notification) => {
    const id = `notif_${Date.now()}_${++notificationIdCounter}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: new Date(),
      read: false,
    };

    set((state) => ({
      notifications: [newNotification, ...state.notifications].slice(0, 100), // 최대 100개
      unreadCount: state.unreadCount + 1,
    }));

    const { soundEnabled, desktopEnabled } = get();

    if (soundEnabled) {
      playNotificationSound(notification.type);
    }

    if (desktopEnabled) {
      showDesktopNotification(notification.title, notification.message, notification.type);
    }
  },

  addToast: (toast) => {
    const id = `toast_${Date.now()}_${++notificationIdCounter}`;
    const newToast: Notification = {
      ...toast,
      id,
      timestamp: new Date(),
      read: false,
      autoClose: toast.autoClose !== false,
    };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    // 자동 닫기 (5초)
    if (newToast.autoClose) {
      setTimeout(() => {
        get().removeToast(id);
      }, 5000);
    }

    const { soundEnabled } = get();
    if (soundEnabled) {
      playNotificationSound(toast.type);
    }
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  markAsRead: (id) => {
    set((state) => {
      const notification = state.notifications.find((n) => n.id === id);
      if (notification && !notification.read) {
        return {
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          ),
          unreadCount: Math.max(0, state.unreadCount - 1),
        };
      }
      return state;
    });
  },

  markAllAsRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  clearAll: () => {
    set({ notifications: [], unreadCount: 0 });
  },

  setSoundEnabled: (enabled) => {
    localStorage.setItem('notification_sound', String(enabled));
    set({ soundEnabled: enabled });
  },

  setDesktopEnabled: (enabled) => {
    localStorage.setItem('notification_desktop', String(enabled));
    set({ desktopEnabled: enabled });
  },
}));
