import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, seedTestData, getTestToken } from './setup.js';
import { getDb } from '../db/index.js';

describe('Audit Routes', () => {
  let app: FastifyInstance;
  let token: string;
  let auditorToken: string;

  beforeAll(async () => {
    app = await buildApp();
    seedTestData();
    token = getTestToken(app, 'SUPER_ADMIN');
    auditorToken = getTestToken(app, 'AUDITOR');

    // Create some audit log entries
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, 'site_default', 'user_test1', 'CREATE', 'SESSION', 'sess_test1', '{}', ?)
    `).run('audit_test1', now);

    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, 'site_default', 'user_test1', 'UPDATE', 'PAYMENT', 'pay_test1', '{"status": "PAID"}', ?)
    `).run('audit_test2', now);

    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, 'site_default', 'user_test1', 'DELETE', 'MEMBERSHIP', 'mem_test1', '{}', ?)
    `).run('audit_test3', now);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/audit', () => {
    it('should return audit logs with admin auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/audit',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.items).toBeDefined();
      expect(Array.isArray(body.data.items)).toBe(true);
      expect(body.data.items.length).toBeGreaterThanOrEqual(3);
    });

    it('should return audit logs with auditor role', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/audit',
        headers: {
          authorization: `Bearer ${auditorToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
    });

    it('should filter by action', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/audit?action=CREATE',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      body.data.items.forEach((log: any) => {
        expect(log.action).toBe('CREATE');
      });
    });

    it('should filter by entityType', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/audit?entityType=PAYMENT',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      body.data.items.forEach((log: any) => {
        expect(log.entityType).toBe('PAYMENT');
      });
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/audit?page=1&limit=2',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.items.length).toBeLessThanOrEqual(2);
      expect(body.data.total).toBeDefined();
      expect(body.data.page).toBeDefined();
      expect(body.data.totalPages).toBeDefined();
    });

    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/audit',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
