import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';

import { initDb } from './db/index.js';
import { authRoutes } from './routes/auth.js';
import { deviceRoutes } from './routes/device.js';
import { sessionRoutes } from './routes/session.js';
import { paymentRoutes } from './routes/payment.js';
import { ratePlanRoutes } from './routes/rate-plan.js';
import { discountRoutes } from './routes/discount.js';
import { membershipRoutes } from './routes/membership.js';
import { wsHandler } from './ws/handler.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'parkflow-dev-secret-change-in-production';

async function main() {
  // Initialize database
  initDb();

  const app = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
  });

  // Plugins
  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: JWT_SECRET });
  await app.register(websocket);

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

  // WebSocket
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
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 ParkFlow API Server running on http://localhost:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
