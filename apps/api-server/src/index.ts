import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { validateEnv, apiServerEnvSchema } from '@parkflow/shared';
import { initDb } from './db/index.js';
import { authRoutes } from './routes/auth.js';
import { deviceRoutes } from './routes/device.js';
import { sessionRoutes } from './routes/session.js';
import { paymentRoutes } from './routes/payment.js';
import { ratePlanRoutes } from './routes/rate-plan.js';
import { discountRoutes } from './routes/discount.js';
import { membershipRoutes } from './routes/membership.js';
import { statsRoutes } from './routes/stats.js';
import { auditRoutes } from './routes/audit.js';
import { kioskRoutes } from './routes/kiosk.js';
import { userRoutes } from './routes/user.js';
import { blacklistRoutes } from './routes/blacklist.js';
import { siteRoutes } from './routes/site.js';
import { notificationRoutes } from './routes/notification.js';
import { settingsRoutes } from './routes/settings.js';
import { laneRoutes } from './routes/lane.js';
import { deviceManagementRoutes } from './routes/device-management.js';
import { whitelistRoutes } from './routes/whitelist.js';
import { simulationRoutes } from './routes/simulation.js';
import { createWsHandler } from './ws/handler.js';
import { initializeHardware, shutdownHardware } from './services/hardware.js';
import { initializeLpr, shutdownLpr } from './services/lpr.js';
import { initializeBackup, shutdownBackup } from './services/backup.js';
import { backupRoutes } from './routes/backup.js';
import { metricsRoutes } from './routes/metrics.js';
import { webhookRoutes } from './routes/webhook.js';
import { operationsRoutes } from './routes/operations.js';
import { recordHttpMetric } from './services/metrics.js';

// Validate environment variables
const env = validateEnv(apiServerEnvSchema);

const {
  PORT, HOST, JWT_SECRET, LOG_LEVEL, NODE_ENV, CORS_ORIGIN,
  RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS,
  DEVICE_API_KEY, KIOSK_API_KEY, REQUEST_BODY_LIMIT, KIOSK_RATE_LIMIT,
  BACKUP_ENABLED, BACKUP_DIR, BACKUP_SCHEDULE, BACKUP_RETENTION_DAYS, BACKUP_MAX_FILES, BACKUP_COMPRESS,
} = env;

// Parse CORS origins
function parseCorsOrigins(corsOrigin: string): string[] | boolean {
  if (corsOrigin === '*') {
    // In development, allow all origins
    return NODE_ENV === 'development' ? true : false;
  }
  return corsOrigin.split(',').map(o => o.trim()).filter(Boolean);
}

async function main() {
  // Initialize database
  initDb();

  // Initialize hardware manager
  await initializeHardware();

  // Initialize LPR camera connections
  await initializeLpr();

  // Initialize backup service
  initializeBackup({
    enabled: BACKUP_ENABLED,
    backupDir: BACKUP_DIR,
    schedule: BACKUP_SCHEDULE,
    retentionDays: BACKUP_RETENTION_DAYS,
    maxFiles: BACKUP_MAX_FILES,
    compress: BACKUP_COMPRESS,
  });

  const app = Fastify({
    logger: {
      level: LOG_LEVEL,
      transport: NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    // 요청 본문 크기 제한 (기본 1MB)
    bodyLimit: REQUEST_BODY_LIMIT,
    // Request ID 생성 (트레이싱용)
    genReqId: () => `req_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`,
  });

  // Plugins
  const corsOrigins = parseCorsOrigins(CORS_ORIGIN);
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  // 보안 헤더 설정 (Helmet)
  await app.register(helmet, {
    // CSP (Content Security Policy)
    contentSecurityPolicy: NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    } : false, // 개발 환경에서는 CSP 비활성화 (Swagger UI 등)
    // HSTS (HTTP Strict Transport Security)
    hsts: NODE_ENV === 'production' ? {
      maxAge: 31536000, // 1년
      includeSubDomains: true,
      preload: true,
    } : false,
    // X-Frame-Options
    frameguard: { action: 'deny' },
    // X-Content-Type-Options
    noSniff: true,
    // X-XSS-Protection (레거시 브라우저용)
    xssFilter: true,
    // Referrer-Policy
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // X-Permitted-Cross-Domain-Policies
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  });

  await app.register(jwt, { secret: JWT_SECRET });
  await app.register(websocket);

  // Rate limiting (skip in test environment)
  if (NODE_ENV !== 'test') {
    await app.register(rateLimit, {
      max: RATE_LIMIT_MAX,
      timeWindow: RATE_LIMIT_WINDOW_MS,
      errorResponseBuilder: () => ({
        ok: false,
        data: null,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
      }),
    });
  }

  // Swagger Documentation
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'ParkFlow API',
        description: `## 주차장 관리 시스템 API

ParkFlow는 LPR(번호판 인식) 기반 주차장 관리 시스템입니다.

### 주요 기능
- 🚗 **실시간 차량 입/출차 관리**
- 💰 **요금 자동 계산 및 결제**
- 📊 **통계 및 분석 대시보드**
- 🎫 **정기권 및 할인 관리**

### 인증
모든 API는 JWT 토큰 인증이 필요합니다. \`/api/auth/login\` 엔드포인트에서 토큰을 발급받으세요.

### 에러 응답
모든 에러 응답은 다음 형식을 따릅니다:
\`\`\`json
{
  "ok": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "에러 메시지"
  }
}
\`\`\`
`,
        version: '1.0.0',
        contact: {
          name: 'ParkFlow Support',
          email: 'support@parkflow.io',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      externalDocs: {
        description: 'GitHub Repository',
        url: 'https://github.com/onedayonepaper/parkflow',
      },
      servers: [
        { url: `http://localhost:${PORT}`, description: 'Development server' },
        { url: 'https://api.parkflow.io', description: 'Production server' },
      ],
      tags: [
        { name: 'Auth', description: '🔐 인증 및 사용자 관리 - 로그인, 토큰 갱신, 사용자 정보 조회' },
        { name: 'Device', description: '📷 디바이스 API - LPR 카메라 이벤트 수신, 차단기 제어' },
        { name: 'Session', description: '🚗 주차 세션 관리 - 세션 조회, 수정, 요금 재계산, 강제 종료' },
        { name: 'Payment', description: '💳 결제 처리 - 결제 승인, 취소, 내역 조회' },
        { name: 'RatePlan', description: '💰 요금 정책 - 요금제 CRUD, 활성화/비활성화' },
        { name: 'Discount', description: '🎫 할인 규칙 - 할인 정책 관리, 적용' },
        { name: 'Membership', description: '📇 정기권 관리 - 정기권 등록, 조회, 삭제' },
        { name: 'Stats', description: '📊 통계 및 분석 - 대시보드, 시간대별, 주간 통계' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT 토큰을 입력하세요. 예: `Bearer eyJhbGciOiJIUzI1NiIs...`',
          },
        },
        schemas: {
          ApiResponse: {
            type: 'object',
            description: '표준 API 응답 형식',
            properties: {
              ok: { type: 'boolean', description: '요청 성공 여부', example: true },
              data: { type: 'object', nullable: true, description: '응답 데이터' },
              error: {
                type: 'object',
                nullable: true,
                description: '에러 정보 (ok가 false일 때만 존재)',
                properties: {
                  code: { type: 'string', description: '에러 코드', example: 'VALIDATION_ERROR' },
                  message: { type: 'string', description: '에러 메시지', example: '필수 필드가 누락되었습니다' },
                },
              },
            },
          },
          Error: {
            type: 'object',
            description: '에러 객체',
            properties: {
              code: { type: 'string', description: '에러 코드' },
              message: { type: 'string', description: '에러 메시지' },
            },
          },
          ParkingSession: {
            type: 'object',
            description: '주차 세션 정보',
            properties: {
              id: { type: 'string', example: 'sess_abc123' },
              plateNo: { type: 'string', example: '12가3456' },
              status: { type: 'string', enum: ['PARKING', 'EXIT_PENDING', 'PAID', 'CLOSED', 'ERROR'] },
              entryAt: { type: 'string', format: 'date-time' },
              exitAt: { type: 'string', format: 'date-time', nullable: true },
              rawFee: { type: 'integer', example: 5000 },
              discountTotal: { type: 'integer', example: 1000 },
              finalFee: { type: 'integer', example: 4000 },
            },
          },
          RatePlan: {
            type: 'object',
            description: '요금 정책',
            properties: {
              id: { type: 'string', example: 'rp_abc123' },
              name: { type: 'string', example: '기본 요금제' },
              isActive: { type: 'boolean', example: true },
              rules: {
                type: 'object',
                properties: {
                  baseFee: { type: 'integer', example: 1000 },
                  baseMinutes: { type: 'integer', example: 30 },
                  additionalFee: { type: 'integer', example: 500 },
                  additionalMinutes: { type: 'integer', example: 10 },
                },
              },
            },
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Auth decorator (JWT 인증)
  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ ok: false, data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }
  });

  // Device API Key 인증 데코레이터 (LPR, 차단기 등 하드웨어용)
  app.decorate('authenticateDevice', async function (request: any, reply: any) {
    const apiKey = request.headers['x-device-api-key'] || request.headers['x-api-key'];

    // 프로덕션 환경에서는 반드시 API 키 필요
    if (NODE_ENV === 'production') {
      if (!DEVICE_API_KEY) {
        app.log.error('DEVICE_API_KEY is not configured in production');
        return reply.code(500).send({
          ok: false,
          data: null,
          error: { code: 'CONFIG_ERROR', message: 'Server configuration error' },
        });
      }

      if (!apiKey || apiKey !== DEVICE_API_KEY) {
        app.log.warn({ ip: request.ip }, 'Invalid device API key attempt');
        return reply.code(401).send({
          ok: false,
          data: null,
          error: { code: 'INVALID_API_KEY', message: 'Invalid or missing device API key' },
        });
      }
      return;
    }

    // 개발/테스트 환경: API 키가 설정된 경우에만 검증
    if (DEVICE_API_KEY && apiKey !== DEVICE_API_KEY) {
      app.log.warn({ ip: request.ip }, 'Invalid device API key attempt (dev mode)');
      return reply.code(401).send({
        ok: false,
        data: null,
        error: { code: 'INVALID_API_KEY', message: 'Invalid or missing device API key' },
      });
    }
  });

  // Kiosk API Key 인증 데코레이터 (무인 결제 키오스크용)
  app.decorate('authenticateKiosk', async function (request: any, reply: any) {
    const apiKey = request.headers['x-kiosk-api-key'] || request.headers['x-api-key'];

    // 프로덕션 환경에서는 반드시 API 키 필요
    if (NODE_ENV === 'production') {
      if (!KIOSK_API_KEY) {
        app.log.error('KIOSK_API_KEY is not configured in production');
        return reply.code(500).send({
          ok: false,
          data: null,
          error: { code: 'CONFIG_ERROR', message: 'Server configuration error' },
        });
      }

      if (!apiKey || apiKey !== KIOSK_API_KEY) {
        app.log.warn({ ip: request.ip }, 'Invalid kiosk API key attempt');
        return reply.code(401).send({
          ok: false,
          data: null,
          error: { code: 'INVALID_API_KEY', message: 'Invalid or missing kiosk API key' },
        });
      }
      return;
    }

    // 개발/테스트 환경: API 키가 설정된 경우에만 검증
    if (KIOSK_API_KEY && apiKey !== KIOSK_API_KEY) {
      app.log.warn({ ip: request.ip }, 'Invalid kiosk API key attempt (dev mode)');
      return reply.code(401).send({
        ok: false,
        data: null,
        error: { code: 'INVALID_API_KEY', message: 'Invalid or missing kiosk API key' },
      });
    }
  });

  // ========================================================================
  // Metrics Collection Hook
  // ========================================================================
  app.addHook('onResponse', (request, reply, done) => {
    // /metrics와 /health 요청은 제외 (노이즈 방지)
    const url = request.url;
    if (url.startsWith('/metrics') || url === '/health' || url === '/api/health') {
      return done();
    }

    const duration = reply.elapsedTime; // Fastify 내장 응답 시간 (ms)
    recordHttpMetric(
      request.method,
      url,
      reply.statusCode,
      duration
    );
    done();
  });

  // Health check - enhanced
  const startTime = Date.now();
  app.get('/api/health', async () => {
    const memUsage = process.memoryUsage();
    const uptime = (Date.now() - startTime) / 1000;

    // Check database status
    let dbStatus = 'ok';
    let dbSize = '-';
    try {
      const { getDb } = await import('./db/index.js');
      const db = getDb();
      db.prepare('SELECT 1').get();

      // Get database file size
      const fs = await import('fs');
      const path = await import('path');
      const dbPath = path.join(process.cwd(), 'data', 'parkflow.db');
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);
        dbSize = `${sizeInMB} MB`;
      }
    } catch (err) {
      dbStatus = 'error';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime,
      version: '1.0.0',
      database: {
        status: dbStatus,
        size: dbSize,
      },
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      },
    };
  });

  // Legacy health endpoint (for backward compatibility)
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // System info endpoint
  app.get('/api/system/info', async () => {
    const os = await import('os');
    return {
      ok: true,
      data: {
        nodeVersion: process.version,
        platform: os.platform(),
        arch: os.arch(),
        cpuCount: os.cpus().length,
        hostname: os.hostname(),
      },
      error: null,
    };
  });

  // API Routes
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(deviceRoutes, { prefix: '/api/device' });
  app.register(sessionRoutes, { prefix: '/api/sessions' });
  app.register(paymentRoutes, { prefix: '/api/payments' });
  app.register(ratePlanRoutes, { prefix: '/api/rate-plans' });
  app.register(discountRoutes, { prefix: '/api/discount-rules' });
  app.register(membershipRoutes, { prefix: '/api/memberships' });
  app.register(statsRoutes, { prefix: '/api/stats' });
  app.register(auditRoutes, { prefix: '/api/audit' });
  app.register(kioskRoutes, { prefix: '/api/kiosk' });
  app.register(userRoutes, { prefix: '/api/users' });
  app.register(blacklistRoutes, { prefix: '/api/blacklist' });
  app.register(siteRoutes, { prefix: '/api/sites' });
  app.register(notificationRoutes, { prefix: '/api/notifications' });
  app.register(settingsRoutes, { prefix: '/api/settings' });
  app.register(laneRoutes, { prefix: '/api/lanes' });
  app.register(deviceManagementRoutes, { prefix: '/api/devices' });
  app.register(whitelistRoutes, { prefix: '/api/whitelist' });
  app.register(simulationRoutes, { prefix: '/api/simulation' });
  app.register(backupRoutes, { prefix: '/api/backups' });
  app.register(metricsRoutes, { prefix: '/metrics' });
  app.register(webhookRoutes, { prefix: '/api/webhooks' });
  app.register(operationsRoutes, { prefix: '/api/operations' });

  // WebSocket (with JWT authentication)
  const wsHandler = createWsHandler(app);
  app.register(async function (fastify) {
    fastify.get('/api/ws', { websocket: true }, wsHandler);
  });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);
    reply.code(error.statusCode || 500).send({
      ok: false,
      data: null,
      error: {
        code: error.code || 'INTERNAL_ERROR',
        message: error.message,
      },
    });
  });

  // Start server
  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`🚀 ParkFlow API Server running on http://${HOST}:${PORT}`);
    console.log(`📚 API Documentation: http://${HOST}:${PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  // Graceful shutdown handling
  const gracefulShutdown = async (signal: string) => {
    console.log(`\n⏳ ${signal} received. Starting graceful shutdown...`);

    try {
      // Close the Fastify server (stops accepting new connections)
      await app.close();
      console.log('✅ Server closed successfully');

      // Close hardware connections
      shutdownHardware();
      console.log('✅ Hardware connections closed');

      // Close LPR camera connections
      shutdownLpr();
      console.log('✅ LPR camera connections closed');

      // Stop backup service
      shutdownBackup();
      console.log('✅ Backup service stopped');

      // Close database connection
      const { closeDb } = await import('./db/index.js');
      closeDb();
      console.log('✅ Database connection closed');

      console.log('👋 Graceful shutdown completed');
      process.exit(0);
    } catch (err) {
      console.error('❌ Error during shutdown:', err);
      process.exit(1);
    }
  };

  // Handle shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  });
}

main();
