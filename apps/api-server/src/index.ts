import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
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
import { createWsHandler } from './ws/handler.js';

// Validate environment variables
const env = validateEnv(apiServerEnvSchema);

const { PORT, HOST, JWT_SECRET, LOG_LEVEL, NODE_ENV, CORS_ORIGIN, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } = env;

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

  const app = Fastify({
    logger: {
      level: LOG_LEVEL,
      transport: NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
  });

  // Plugins
  const corsOrigins = parseCorsOrigins(CORS_ORIGIN);
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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
        description: '주차장 관리 시스템 API 문서',
        version: '1.0.0',
      },
      servers: [
        { url: `http://localhost:${PORT}`, description: 'Development server' },
      ],
      tags: [
        { name: 'Auth', description: '인증 관련 API' },
        { name: 'Device', description: '디바이스 (LPR/Barrier) API' },
        { name: 'Session', description: '주차 세션 관리 API' },
        { name: 'Payment', description: '결제 API' },
        { name: 'RatePlan', description: '요금 정책 API' },
        { name: 'Discount', description: '할인 규칙 API' },
        { name: 'Membership', description: '정기권 API' },
        { name: 'Stats', description: '통계 API' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
        schemas: {
          ApiResponse: {
            type: 'object',
            properties: {
              ok: { type: 'boolean' },
              data: { type: 'object', nullable: true },
              error: {
                type: 'object',
                nullable: true,
                properties: {
                  code: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
          Error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
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

  // Auth decorator
  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ ok: false, data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }
  });

  // Health check
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // API Routes
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(deviceRoutes, { prefix: '/api/device' });
  app.register(sessionRoutes, { prefix: '/api/sessions' });
  app.register(paymentRoutes, { prefix: '/api/payments' });
  app.register(ratePlanRoutes, { prefix: '/api/rate-plans' });
  app.register(discountRoutes, { prefix: '/api/discount-rules' });
  app.register(membershipRoutes, { prefix: '/api/memberships' });
  app.register(statsRoutes, { prefix: '/api/stats' });

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
