import { useAuthStore } from '../stores/auth';

const API_BASE = '/api';

interface ApiResponse<T> {
  ok: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = useAuthStore.getState().token;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok && response.status === 401) {
      useAuthStore.getState().logout();
    }

    return data;
  } catch (error) {
    return {
      ok: false,
      data: null,
      error: { code: 'NETWORK_ERROR', message: '네트워크 오류가 발생했습니다' },
    };
  }
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getMe: () => request<any>('/auth/me'),

  // Sessions
  getSessions: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ items: any[]; total: number; page: number; limit: number; totalPages: number }>(
      `/sessions${query}`
    );
  },

  getSession: (id: string) => request<any>(`/sessions/${id}`),

  recalcSession: (id: string, data: { ratePlanId?: string; reason: string }) =>
    request<any>(`/sessions/${id}/recalc`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  correctSession: (id: string, data: any) =>
    request<any>(`/sessions/${id}/correct`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  applyDiscount: (id: string, data: { discountRuleId: string; reason?: string }) =>
    request<any>(`/sessions/${id}/apply-discount`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  forceCloseSession: (id: string, data: { reason: string; note?: string }) =>
    request<any>(`/sessions/${id}/force-close`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Payments
  getPayments: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ items: any[]; total: number; page: number; limit: number; totalPages: number }>(
      `/payments${query}`
    );
  },

  cancelPayment: (id: string, reason: string) =>
    request<any>(`/payments/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  mockPayment: (data: { sessionId: string; amount: number }) =>
    request<any>('/payments/mock/approve', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Rate Plans
  getRatePlans: () => request<{ items: any[] }>('/rate-plans'),

  createRatePlan: (data: any) =>
    request<any>('/rate-plans', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateRatePlan: (id: string, data: any) =>
    request<any>(`/rate-plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  activateRatePlan: (id: string) =>
    request<any>(`/rate-plans/${id}/activate`, { method: 'POST' }),

  // Discount Rules
  getDiscountRules: () => request<{ items: any[] }>('/discount-rules'),

  createDiscountRule: (data: any) =>
    request<any>('/discount-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Memberships
  getMemberships: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ items: any[] }>(`/memberships${query}`);
  },

  createMembership: (data: any) =>
    request<any>('/memberships', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteMembership: (id: string) =>
    request<any>(`/memberships/${id}`, { method: 'DELETE' }),

  // Stats
  getDashboardStats: () =>
    request<{
      currentParking: number;
      exitPending: number;
      todayRevenue: number;
      todayEntries: number;
      todayExits: number;
      avgDurationMinutes: number;
    }>('/stats/dashboard'),

  getHourlyStats: () =>
    request<{
      hourly: { hour: number; entries: number; exits: number }[];
    }>('/stats/hourly'),

  getWeeklyStats: () =>
    request<{
      daily: { date: string; revenue: number; sessions: number }[];
    }>('/stats/weekly'),

  getMonthlyStats: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{
      monthly: { month: string; revenue: number; sessions: number; avgDuration: number }[];
    }>(`/stats/monthly${query}`);
  },

  getReportStats: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{
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
    }>(`/stats/report${query}`);
  },

  // Discount Rules - extended
  updateDiscountRule: (id: string, data: any) =>
    request<any>(`/discount-rules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteDiscountRule: (id: string) =>
    request<any>(`/discount-rules/${id}`, { method: 'DELETE' }),

  // Audit Logs
  getAuditLogs: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{
      items: any[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>(`/audit${query}`);
  },

  getAuditActions: () =>
    request<{ actions: string[] }>('/audit/actions'),

  getAuditEntityTypes: () =>
    request<{ entityTypes: string[] }>('/audit/entity-types'),

  // Users
  getUsers: () => request<{ items: any[] }>('/users'),

  createUser: (data: { username: string; password: string; role: string }) =>
    request<any>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (id: string, data: any) =>
    request<any>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteUser: (id: string) =>
    request<any>(`/users/${id}`, { method: 'DELETE' }),

  // Blacklist
  getBlacklist: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ items: any[]; total: number; page: number; limit: number; totalPages: number }>(
      `/blacklist${query}`
    );
  },

  createBlacklist: (data: { plateNo: string; reason: string; blockedUntil?: string }) =>
    request<any>('/blacklist', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateBlacklist: (id: string, data: any) =>
    request<any>(`/blacklist/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteBlacklist: (id: string) =>
    request<any>(`/blacklist/${id}`, { method: 'DELETE' }),

  checkBlacklist: (plateNo: string) =>
    request<{ isBlacklisted: boolean; reason: string | null }>(`/blacklist/check/${plateNo}`),

  // Sites
  getSites: () => request<{ items: any[] }>('/sites'),

  getSite: (id: string) => request<any>(`/sites/${id}`),

  createSite: (data: { name: string; timezone?: string }) =>
    request<any>('/sites', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSite: (id: string, data: any) =>
    request<any>(`/sites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteSite: (id: string) =>
    request<any>(`/sites/${id}`, { method: 'DELETE' }),

  // Notifications
  getNotificationTemplates: () => request<{ items: any[] }>('/notifications/templates'),

  createNotificationTemplate: (data: any) =>
    request<any>('/notifications/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateNotificationTemplate: (id: string, data: any) =>
    request<any>(`/notifications/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteNotificationTemplate: (id: string) =>
    request<any>(`/notifications/templates/${id}`, { method: 'DELETE' }),

  sendNotification: (data: { type: string; recipient: string; subject?: string; body: string }) =>
    request<any>('/notifications/send', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getNotificationLogs: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ items: any[]; total: number; page: number; totalPages: number }>(
      `/notifications/logs${query}`
    );
  },

  testNotification: (data: { type: string; recipient: string }) =>
    request<any>('/notifications/test', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // TossPayments
  getTossClientKey: () => request<{ clientKey: string }>('/payments/toss/client-key'),

  confirmTossPayment: (data: {
    paymentKey: string;
    orderId: string;
    amount: number;
    sessionId: string;
  }) =>
    request<any>('/payments/toss/confirm', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  cancelTossPayment: (paymentKey: string, data: { cancelReason: string; cancelAmount?: number }) =>
    request<any>(`/payments/toss/${paymentKey}/cancel`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Devices
  getDevices: () => request<{ devices: any[] }>('/device/status'),

  createDevice: (data: { name: string; type: string; laneId?: string | null }) =>
    request<any>('/devices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateDevice: (id: string, data: { name?: string; laneId?: string | null }) =>
    request<any>(`/devices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteDevice: (id: string) =>
    request<any>(`/devices/${id}`, { method: 'DELETE' }),

  // Lanes
  getLanes: () => request<{ items: any[] }>('/lanes'),

  createLane: (data: { name: string; direction: string }) =>
    request<any>('/lanes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateLane: (id: string, data: { name?: string; direction?: string }) =>
    request<any>(`/lanes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteLane: (id: string) =>
    request<any>(`/lanes/${id}`, { method: 'DELETE' }),

  // VIP Whitelist
  getWhitelist: (params?: Record<string, string>) => {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return request<{ items: any[]; total: number }>(`/whitelist${query}`);
  },

  createWhitelist: (data: { plateNo: string; name?: string; reason?: string }) =>
    request<any>('/whitelist', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateWhitelist: (id: string, data: { plateNo?: string; name?: string; reason?: string; isActive?: boolean }) =>
    request<any>(`/whitelist/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteWhitelist: (id: string) =>
    request<any>(`/whitelist/${id}`, { method: 'DELETE' }),

  checkWhitelist: (plateNo: string) =>
    request<{ isWhitelisted: boolean; entry?: any }>(`/whitelist/check/${plateNo}`),

  // Operations - Barrier Control
  getBarriers: () =>
    request<{
      barriers: {
        deviceId: string;
        name: string;
        laneId: string;
        laneName: string;
        direction: 'ENTRY' | 'EXIT';
        state: 'OPEN' | 'CLOSED' | 'OPENING' | 'CLOSING' | 'ERROR' | 'UNKNOWN';
        connected: boolean;
      }[];
    }>('/operations/barriers'),

  getBarrierState: (deviceId: string) =>
    request<{
      deviceId: string;
      name: string;
      laneId: string;
      laneName: string;
      direction: 'ENTRY' | 'EXIT';
      state: 'OPEN' | 'CLOSED' | 'OPENING' | 'CLOSING' | 'ERROR' | 'UNKNOWN';
      connected: boolean;
    }>(`/operations/barriers/${deviceId}/state`),

  openBarrier: (deviceId: string, reason?: string) =>
    request<{
      deviceId: string;
      success: boolean;
      previousState: string | null;
      newState: string | null;
      error?: string;
    }>(`/operations/barriers/${deviceId}/open`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  closeBarrier: (deviceId: string, reason?: string) =>
    request<{
      deviceId: string;
      success: boolean;
      previousState: string | null;
      newState: string | null;
      error?: string;
    }>(`/operations/barriers/${deviceId}/close`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  getRecentBarrierCommands: (limit?: number) =>
    request<{
      commands: {
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
      }[];
    }>(`/operations/barriers/commands/recent${limit ? `?limit=${limit}` : ''}`),

  emergencyOpenAllBarriers: (reason: string) =>
    request<{
      total: number;
      success: number;
      failed: number;
      results: { deviceId: string; name: string; success: boolean; error?: string }[];
    }>('/operations/barriers/emergency-open', {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  manualEntry: (data: { plateNo: string; laneId?: string; note?: string }) =>
    request<{
      sessionId: string;
      plateNo: string;
      entryAt: string;
    }>('/operations/manual-entry', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  manualExit: (data: {
    sessionId?: string;
    plateNo?: string;
    overridePayment: boolean;
    reason: string;
    note?: string;
  }) =>
    request<{
      sessionId: string;
      plateNo: string;
      exitAt: string;
      overridePayment: boolean;
      barrierOpened: boolean;
      finalFee: number;
    }>('/operations/manual-exit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getActiveSessions: (params?: { status?: string; limit?: number }) => {
    const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
    return request<{
      sessions: {
        id: string;
        plateNo: string;
        status: string;
        entryAt: string;
        exitAt: string | null;
        rawFee: number;
        discountTotal: number;
        finalFee: number;
        paymentStatus: string;
      }[];
      total: number;
    }>(`/operations/active-sessions${query}`);
  },
};
