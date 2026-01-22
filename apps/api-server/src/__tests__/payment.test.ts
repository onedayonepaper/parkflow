import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, seedTestData, getTestToken } from './setup.js';
import { getDb } from '../db/index.js';

describe('Payment Routes', () => {
  let app: FastifyInstance;
  let token: string;
  let paymentTestSessionId: string;

  beforeAll(async () => {
    app = await buildApp();
    seedTestData();
    token = getTestToken(app);

    // Create a test session for payment
    const db = getDb();
    const now = new Date().toISOString();
    paymentTestSessionId = 'psess_pay_test';

    db.prepare(`
      INSERT INTO parking_sessions (
        id, site_id, entry_lane_id, exit_lane_id, plate_no, status, entry_at, exit_at,
        rate_plan_id, raw_fee, discount_total, final_fee, fee_breakdown_json,
        payment_status, created_at, updated_at
      ) VALUES (?, 'site_default', 'lane_test1', 'lane_test2', '77가7777', 'EXIT_PENDING', ?, ?, 'rp_test1', 3000, 0, 3000, '{}', 'NONE', ?, ?)
    `).run(
      paymentTestSessionId,
      new Date(Date.now() - 3600000).toISOString(),
      now,
      now,
      now
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/payments/mock/approve', () => {
    it('should approve mock payment', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/mock/approve',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          sessionId: paymentTestSessionId,
          amount: 3000,
          method: 'CARD',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.paymentId).toBeDefined();
      expect(body.data.status).toBe('PAID');
      expect(body.data.approvedAt).toBeDefined();
    });

    it('should return 400 for already paid session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/mock/approve',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          sessionId: paymentTestSessionId,
          amount: 3000,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('ALREADY_PAID');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/mock/approve',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          sessionId: 'nonexistent_session',
          amount: 1000,
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 401 without authentication', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/payments/mock/approve',
        payload: {
          sessionId: 'any_session',
          amount: 1000,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/payments/:id', () => {
    it('should return payment detail', async () => {
      // First, get a payment ID from a successful payment
      const db = getDb();
      const payment = db.prepare(`
        SELECT id FROM payments WHERE session_id = ?
      `).get(paymentTestSessionId) as any;

      if (payment) {
        const response = await app.inject({
          method: 'GET',
          url: `/api/payments/${payment.id}`,
          headers: {
            authorization: `Bearer ${token}`,
          },
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.ok).toBe(true);
        expect(body.data.id).toBe(payment.id);
        expect(body.data.amount).toBe(3000);
      }
    });

    it('should return 404 for non-existent payment', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/nonexistent_payment',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
