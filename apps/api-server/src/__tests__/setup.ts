import Fastify, { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import { initDb, getDb } from '../db/index.js';
import { authRoutes } from '../routes/auth.js';
import { deviceRoutes } from '../routes/device.js';
import { sessionRoutes } from '../routes/session.js';
import { paymentRoutes } from '../routes/payment.js';
import { ratePlanRoutes } from '../routes/rate-plan.js';
import { discountRoutes } from '../routes/discount.js';
import { membershipRoutes } from '../routes/membership.js';

const JWT_SECRET = 'test-secret-key-for-integration-testing';

export async function buildApp(): Promise<FastifyInstance> {
  // Initialize test database
  initDb(':memory:');

  const app = Fastify({ logger: false });

  await app.register(jwt, { secret: JWT_SECRET });

  // Auth decorator
  app.decorate('authenticate', async function (request: any, reply: any) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.code(401).send({ ok: false, data: null, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
    }
  });

  // Register routes
  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(deviceRoutes, { prefix: '/api/device' });
  app.register(sessionRoutes, { prefix: '/api/sessions' });
  app.register(paymentRoutes, { prefix: '/api/payments' });
  app.register(ratePlanRoutes, { prefix: '/api/rate-plans' });
  app.register(discountRoutes, { prefix: '/api/discount-rules' });
  app.register(membershipRoutes, { prefix: '/api/memberships' });

  await app.ready();
  return app;
}

export function getTestToken(app: FastifyInstance): string {
  return app.jwt.sign({
    sub: 'user_test1',
    username: 'admin',
    role: 'SUPER_ADMIN',
    siteId: 'site_default',
  }, { expiresIn: '1h' });
}

export function seedTestData() {
  const db = getDb();
  const now = new Date().toISOString();

  // Create test site first (required for foreign keys)
  db.prepare(`
    INSERT OR REPLACE INTO sites (id, name, timezone, created_at, updated_at)
    VALUES ('site_default', '테스트 주차장', 'Asia/Seoul', ?, ?)
  `).run(now, now);

  // Create test user (role must be SUPER_ADMIN, OPERATOR, or AUDITOR)
  // Use INSERT OR REPLACE to handle existing user from db:seed
  db.prepare(`
    INSERT OR REPLACE INTO users (id, site_id, username, password_hash, role, is_active, created_at, updated_at)
    VALUES ('user_test1', 'site_default', 'admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'SUPER_ADMIN', 1, ?, ?)
  `).run(now, now);

  // Create test rate plan
  db.prepare(`
    INSERT OR REPLACE INTO rate_plans (id, site_id, name, is_active, rules_json, created_at, updated_at)
    VALUES ('rp_test1', 'site_default', '기본 요금제', 1, '{"baseFee":1000,"baseMinutes":30,"additionalFee":500,"additionalMinutes":10}', ?, ?)
  `).run(now, now);

  // Create test discount rule (type must be AMOUNT, PERCENT, FREE_MINUTES, or FREE_ALL)
  db.prepare(`
    INSERT OR REPLACE INTO discount_rules (id, site_id, name, type, value, is_stackable, created_at, updated_at)
    VALUES ('dr_test1', 'site_default', '테스트 할인', 'AMOUNT', 1000, 0, ?, ?)
  `).run(now, now);

  // Create test lane
  db.prepare(`
    INSERT OR REPLACE INTO lanes (id, site_id, name, direction, created_at, updated_at)
    VALUES ('lane_test1', 'site_default', '입구 1', 'ENTRY', ?, ?)
  `).run(now, now);

  db.prepare(`
    INSERT OR REPLACE INTO lanes (id, site_id, name, direction, created_at, updated_at)
    VALUES ('lane_test2', 'site_default', '출구 1', 'EXIT', ?, ?)
  `).run(now, now);

  // Create test device
  db.prepare(`
    INSERT OR REPLACE INTO devices (id, site_id, lane_id, type, name, status, created_at, updated_at)
    VALUES ('dev_test1', 'site_default', 'lane_test1', 'LPR', 'LPR 입구', 'ONLINE', ?, ?)
  `).run(now, now);
}
