/** 사용자 역할 */
export type UserRole = 'SUPER_ADMIN' | 'OPERATOR' | 'AUDITOR';

/** 사용자 */
export interface User {
  id: string;
  siteId: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 로그인 요청 */
export interface LoginRequest {
  username: string;
  password: string;
}

/** 로그인 응답 */
export interface LoginResponse {
  token: string;
  user: Omit<User, 'createdAt' | 'updatedAt'>;
}

/** JWT 페이로드 */
export interface JwtPayload {
  sub: string;       // user.id
  username: string;
  role: UserRole;
  siteId: string;
  iat: number;
  exp: number;
}

/** 감사 로그 액션 */
export type AuditAction =
  | 'SESSION_CORRECT'
  | 'SESSION_RECALC'
  | 'SESSION_FORCE_CLOSE'
  | 'DISCOUNT_APPLY'
  | 'DISCOUNT_REVOKE'
  | 'BARRIER_MANUAL_OPEN'
  | 'RATE_PLAN_CREATE'
  | 'RATE_PLAN_UPDATE'
  | 'RATE_PLAN_ACTIVATE'
  | 'MEMBERSHIP_CREATE'
  | 'MEMBERSHIP_UPDATE'
  | 'MEMBERSHIP_DELETE'
  | 'USER_LOGIN'
  | 'USER_LOGOUT';

/** 감사 로그 */
export interface AuditLog {
  id: string;
  siteId: string;
  userId: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}
