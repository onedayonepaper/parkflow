import { z } from 'zod';

export const UserRoleSchema = z.enum(['SUPER_ADMIN', 'OPERATOR', 'AUDITOR']);

/** 로그인 스키마 */
export const LoginRequestSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(100),
});
