import { z } from 'zod';
import * as fs from 'fs';

/**
 * Docker Secret 또는 환경변수에서 값을 읽습니다.
 * XXX_FILE 환경변수가 설정된 경우 해당 파일에서 값을 읽고,
 * 그렇지 않으면 XXX 환경변수 값을 사용합니다.
 *
 * @param name 환경변수 이름 (예: 'JWT_SECRET')
 * @param env 환경변수 객체
 * @returns 시크릿 값 또는 undefined
 */
export function resolveSecret(
  name: string,
  env: Record<string, string | undefined> = process.env
): string | undefined {
  const fileEnvName = `${name}_FILE`;
  const filePath = env[fileEnvName];

  if (filePath) {
    try {
      // Docker secret 파일에서 값 읽기
      const value = fs.readFileSync(filePath, 'utf8').trim();
      return value;
    } catch (err) {
      console.warn(`Warning: Failed to read secret from ${filePath}: ${err}`);
      // 파일 읽기 실패 시 일반 환경변수 사용
    }
  }

  return env[name];
}

/**
 * 환경변수 객체에서 시크릿들을 해결합니다.
 * XXX_FILE이 있으면 파일에서 읽어서 XXX로 설정합니다.
 */
export function resolveSecrets(
  env: Record<string, string | undefined>,
  secretNames: string[]
): Record<string, string | undefined> {
  const resolved = { ...env };

  for (const name of secretNames) {
    const value = resolveSecret(name, env);
    if (value !== undefined) {
      resolved[name] = value;
    }
  }

  return resolved;
}

// Docker Secret 지원 환경변수 목록
const SECRET_ENV_NAMES = [
  'JWT_SECRET',
  'DEVICE_API_KEY',
  'KIOSK_API_KEY',
  'TOSS_SECRET_KEY',
  'TOSS_CLIENT_KEY',
  'TOSS_WEBHOOK_SECRET',
  'SMTP_PASS',
  'AWS_SES_SECRET_ACCESS_KEY',
  'NHN_SMS_SECRET_KEY',
  'TWILIO_AUTH_TOKEN',
  'KAKAO_API_KEY',
];

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

  // TossPayments (프로덕션 환경에서 필수)
  TOSS_SECRET_KEY: z.string().optional(),
  TOSS_CLIENT_KEY: z.string().optional(),
  TOSS_WEBHOOK_SECRET: z.string().optional(),

  // Payment mode: 'live' (실제 결제), 'test' (토스 테스트), 'mock' (로컬 Mock)
  PAYMENT_MODE: z.enum(['live', 'test', 'mock']).default('mock'),

  // ============================================================================
  // Notification Settings (알림 서비스)
  // ============================================================================

  // Notification mode: 'live' (실제 발송), 'mock' (콘솔 로그만)
  NOTIFICATION_MODE: z.enum(['live', 'mock']).default('mock'),

  // Email - SMTP 설정
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
  SMTP_SECURE: z.string().transform(v => v === 'true').optional(),

  // Email - AWS SES 설정 (SMTP 대신 사용 가능)
  AWS_SES_REGION: z.string().optional(),
  AWS_SES_ACCESS_KEY_ID: z.string().optional(),
  AWS_SES_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_SES_FROM: z.string().email().optional(),

  // SMS - NHN Cloud 설정 (한국)
  NHN_SMS_APP_KEY: z.string().optional(),
  NHN_SMS_SECRET_KEY: z.string().optional(),
  NHN_SMS_SENDER: z.string().optional(),

  // SMS - Twilio 설정 (글로벌)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),

  // 카카오 알림톡 설정
  KAKAO_API_KEY: z.string().optional(),
  KAKAO_SENDER_KEY: z.string().optional(),
  KAKAO_CHANNEL_ID: z.string().optional(),

  // 선호 알림 채널 설정 (email: smtp|ses, sms: nhn|twilio)
  EMAIL_PROVIDER: z.enum(['smtp', 'ses']).default('smtp'),
  SMS_PROVIDER: z.enum(['nhn', 'twilio']).default('nhn'),

  // ============================================================================
  // Security Settings (보안 설정)
  // ============================================================================

  // 디바이스 API 인증 키 (LPR, 차단기 등 하드웨어 디바이스용)
  // 프로덕션에서는 반드시 강력한 랜덤 문자열로 설정
  DEVICE_API_KEY: z.string().min(16, 'DEVICE_API_KEY must be at least 16 characters').optional(),

  // 키오스크 API 인증 키 (무인 결제 키오스크용)
  KIOSK_API_KEY: z.string().min(16, 'KIOSK_API_KEY must be at least 16 characters').optional(),

  // 요청 본문 크기 제한 (바이트 단위, 기본 1MB)
  REQUEST_BODY_LIMIT: z.string().transform(Number).pipe(z.number().min(1024)).default('1048576'),

  // 키오스크 Rate Limit (분당 요청 수)
  KIOSK_RATE_LIMIT: z.string().transform(Number).pipe(z.number().min(1)).default('30'),

  // ============================================================================
  // Backup Settings (백업 설정)
  // ============================================================================

  // 백업 활성화 여부
  BACKUP_ENABLED: z.string().transform(v => v === 'true').default('true'),

  // 백업 저장 디렉토리 (기본: ./data/backups)
  BACKUP_DIR: z.string().default('./data/backups'),

  // 백업 스케줄 (cron 표현식, 기본: 매일 새벽 3시)
  // '0 3 * * *' = 매일 03:00
  // '0 */6 * * *' = 6시간마다
  // '0 * * * *' = 매시간
  BACKUP_SCHEDULE: z.string().default('0 3 * * *'),

  // 백업 보존 기간 (일 단위, 기본: 30일)
  BACKUP_RETENTION_DAYS: z.string().transform(Number).pipe(z.number().min(1)).default('30'),

  // 최대 백업 파일 수 (기본: 100개)
  BACKUP_MAX_FILES: z.string().transform(Number).pipe(z.number().min(1)).default('100'),

  // 백업 압축 사용 여부
  BACKUP_COMPRESS: z.string().transform(v => v === 'true').default('true'),
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
 * Docker Secret 파일도 자동으로 지원합니다 (XXX_FILE 환경변수).
 *
 * @param schema Zod 스키마
 * @param env 환경변수 객체 (기본값: process.env)
 * @returns 검증된 환경변수 객체
 * @throws 검증 실패 시 상세 에러 메시지와 함께 종료
 */
export function validateEnv<T extends z.ZodTypeAny>(
  schema: T,
  env: Record<string, string | undefined> = process.env
): z.infer<T> {
  // Docker Secrets 해결 (XXX_FILE → XXX)
  const resolvedEnv = resolveSecrets(env, SECRET_ENV_NAMES);

  const result = schema.safeParse(resolvedEnv);

  if (!result.success) {
    console.error('\n❌ Environment validation failed:\n');

    const errors = result.error.flatten().fieldErrors;
    for (const [field, messages] of Object.entries(errors)) {
      console.error(`  ${field}:`);
      messages?.forEach(msg => console.error(`    - ${msg}`));
    }

    console.error('\n💡 Please check your .env file or environment variables.');
    console.error('💡 For Docker secrets, ensure XXX_FILE points to a readable file.\n');
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
