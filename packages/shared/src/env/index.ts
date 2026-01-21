import { z } from 'zod';

// API Server 환경변수 스키마
export const apiServerEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3000'),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DB_PATH: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // CORS - comma-separated list of allowed origins (e.g., "http://localhost:5173,https://admin.example.com")
  // Use "*" for development only
  CORS_ORIGIN: z.string().default('*'),

  // Rate limiting
  RATE_LIMIT_MAX: z.string().transform(Number).pipe(z.number().min(1)).default('100'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).pipe(z.number().min(1000)).default('60000'),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

// Device Agent 환경변수 스키마
export const deviceAgentEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_BASE: z.string().url().default('http://localhost:3000'),

  // Retry settings
  RETRY_INTERVAL_MS: z.string().transform(Number).pipe(z.number().min(1000)).default('5000'),
  MAX_RETRY_COUNT: z.string().transform(Number).pipe(z.number().min(1)).default('10'),
});

// Admin Web 환경변수 스키마 (Vite용 - VITE_ prefix)
export const adminWebEnvSchema = z.object({
  VITE_API_BASE: z.string().url().default('http://localhost:3000'),
  VITE_WS_BASE: z.string().url().default('ws://localhost:3000'),
});

export type ApiServerEnv = z.infer<typeof apiServerEnvSchema>;
export type DeviceAgentEnv = z.infer<typeof deviceAgentEnvSchema>;
export type AdminWebEnv = z.infer<typeof adminWebEnvSchema>;

/**
 * 환경변수 검증 및 파싱
 * @param schema Zod 스키마
 * @param env 환경변수 객체 (기본값: process.env)
 * @returns 검증된 환경변수 객체
 * @throws 검증 실패 시 상세 에러 메시지와 함께 종료
 */
export function validateEnv<T extends z.ZodTypeAny>(
  schema: T,
  env: Record<string, string | undefined> = process.env
): z.infer<T> {
  const result = schema.safeParse(env);

  if (!result.success) {
    console.error('\n❌ Environment validation failed:\n');

    const errors = result.error.flatten().fieldErrors;
    for (const [field, messages] of Object.entries(errors)) {
      console.error(`  ${field}:`);
      messages?.forEach(msg => console.error(`    - ${msg}`));
    }

    console.error('\n💡 Please check your .env file or environment variables.\n');
    process.exit(1);
  }

  return result.data;
}

/**
 * 개발 환경용 기본값 생성 (테스트/개발 시에만 사용)
 */
export function getDevDefaults(): Partial<ApiServerEnv> {
  return {
    NODE_ENV: 'development',
    PORT: 3000,
    HOST: '0.0.0.0',
    JWT_SECRET: 'dev-secret-at-least-32-characters-long!',
    JWT_EXPIRES_IN: '7d',
    LOG_LEVEL: 'info',
  };
}
