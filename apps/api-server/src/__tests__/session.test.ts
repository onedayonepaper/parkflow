import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, seedTestData, getTestToken } from './setup.js';
import { getDb } from '../db/index.js';

describe('Session Routes', () => {
  let app: FastifyInstance;
  let token: string;
  let testSessionId: string;

  beforeAll(async () => {
    app = await buildApp();
    seedTestData();
    token = getTestToken(app);

    // Create a test session
    const db = getDb();
    const now = new Date().toISOString();
    testSessionId = 'psess_test123';

    db.prepare(`
      INSERT INTO parking_sessions (
        id, site_id, entry_lane_id, plate_no, status, entry_at,
        rate_plan_id, raw_fee, discount_total, final_fee, fee_breakdown_json,
        payment_status, created_at, updated_at
      ) VALUES (?, 'site_default', 'lane_test1', '12가3456', 'EXIT_PENDING', ?, 'rp_test1', 2000, 0, 2000, '{}', 'NONE', ?, ?)
    `).run(testSessionId, new Date(Date.now() - 3600000).toISOString(), now, now);

    // Update session with exit info
    db.prepare(`
      UPDATE parking_sessions SET exit_at = ?, exit_lane_id = 'lane_test2' WHERE id = ?
    `).run(now, testSessionId);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/sessions', () => {
    it('should return session list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.items).toBeDefined();
      expect(Array.isArray(body.data.items)).toBe(true);
      expect(body.data.total).toBeGreaterThanOrEqual(0);
    });

    it('should filter by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions?status=EXIT_PENDING',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      body.data.items.forEach((item: any) => {
        expect(item.status).toBe('EXIT_PENDING');
      });
    });

    it('should filter by plateNo', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions?plateNo=12가',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('should return session detail', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/${testSessionId}`,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.id).toBe(testSessionId);
      expect(body.data.plateNo).toBe('12가3456');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions/nonexistent_session',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('SESSION_NOT_FOUND');
    });
  });

  describe('POST /api/sessions/:id/recalc', () => {
    it('should recalculate fee', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/sessions/${testSessionId}/recalc`,
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          reason: 'Test recalculation',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.rawFee).toBeDefined();
      expect(body.data.finalFee).toBeDefined();
    });
  });

  describe('POST /api/sessions/:id/correct', () => {
    it('should correct session data', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/sessions/${testSessionId}/correct`,
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          plateNoCorrected: '12가3456',
          reason: 'Test correction',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.corrected).toBe(true);
    });
  });

  describe('POST /api/sessions/:id/apply-discount', () => {
    it('should apply discount to session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/sessions/${testSessionId}/apply-discount`,
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          discountRuleId: 'dr_test1',
          reason: 'Test discount',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.applicationId).toBeDefined();
      expect(body.data.discountTotal).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent discount rule', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/sessions/${testSessionId}/apply-discount`,
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          discountRuleId: 'nonexistent_rule',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/sessions/:id/force-close', () => {
    it('should force close session', async () => {
      // Create a new session for this test
      const db = getDb();
      const now = new Date().toISOString();
      const closeTestSessionId = 'psess_close_test';

      db.prepare(`
        INSERT INTO parking_sessions (
          id, site_id, entry_lane_id, plate_no, status, entry_at,
          rate_plan_id, raw_fee, discount_total, final_fee, fee_breakdown_json,
          payment_status, created_at, updated_at
        ) VALUES (?, 'site_default', 'lane_test1', '99가9999', 'PARKING', ?, 'rp_test1', 0, 0, 0, '{}', 'NONE', ?, ?)
      `).run(closeTestSessionId, now, now, now);

      const response = await app.inject({
        method: 'POST',
        url: `/api/sessions/${closeTestSessionId}/force-close`,
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          reason: 'Test force close',
          note: 'Test note',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.closed).toBe(true);
    });
  });
});
