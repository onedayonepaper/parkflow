import { z } from 'zod';

export const UserRoleSchema = z.enum(['SUPER_ADMIN', 'OPERATOR', 'AUDITOR']);

/** 로그인 스키마 (기존 사용자 호환성 유지) */
export const LoginRequestSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(100),
});

/**
 * 비밀번호 생성/변경용 스키마 (강화된 정책)
 * - 최소 8자 이상
 * - 최대 100자
 * - 대문자, 소문자, 숫자 중 2가지 이상 포함 권장
 */
export const PasswordSchema = z.string()
  .min(8, '비밀번호는 최소 8자 이상이어야 합니다')
  .max(100, '비밀번호는 최대 100자까지 가능합니다')
  .refine(
    (password) => {
      // 대문자, 소문자, 숫자 중 2가지 이상 포함 여부 체크
      const hasUpper = /[A-Z]/.test(password);
      const hasLower = /[a-z]/.test(password);
      const hasNumber = /[0-9]/.test(password);
      const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

      const complexity = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
      return complexity >= 2;
    },
    { message: '비밀번호는 대문자, 소문자, 숫자, 특수문자 중 2가지 이상을 포함해야 합니다' }
  );

/** 간단한 비밀번호 검증 (개발/테스트 환경용) */
export const SimplePasswordSchema = z.string()
  .min(8, '비밀번호는 최소 8자 이상이어야 합니다')
  .max(100, '비밀번호는 최대 100자까지 가능합니다');
