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
};
