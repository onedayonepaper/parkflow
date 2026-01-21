import { randomBytes } from 'crypto';

/**
 * 접두사 기반 고유 ID 생성
 * @param prefix 접두사 (예: 'psess', 'pevt', 'pay')
 * @returns 고유 ID (예: 'psess_a1b2c3d4e5f6')
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(6).toString('hex');
  return `${prefix}_${timestamp}${random}`;
}

/** ID 프리픽스 */
export const ID_PREFIX = {
  SITE: 'site',
  LANE: 'lane',
  DEVICE: 'dev',
  PLATE_EVENT: 'pevt',
  SESSION: 'psess',
  RATE_PLAN: 'rp',
  DISCOUNT_RULE: 'dr',
  DISCOUNT_APP: 'da',
  MEMBERSHIP: 'mem',
  PAYMENT: 'pay',
  BARRIER_CMD: 'bcmd',
  USER: 'usr',
  AUDIT: 'aud',
  BLACKLIST: 'bl',
  NOTIFICATION: 'noti',
  PAYMENT_SETTING: 'pset',
} as const;
