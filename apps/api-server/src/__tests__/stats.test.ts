import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, seedTestData, getTestToken } from './setup.js';

describe('Stats Routes', () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildApp();
    seedTestData();
    token = getTestToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/stats/dashboard', () => {
    it('should return dashboard statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/stats/dashboard',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data).toBeDefined();
      expect(typeof body.data.currentParking).toBe('number');
      expect(typeof body.data.exitPending).toBe('number');
      expect(typeof body.data.todayRevenue).toBe('number');
      expect(typeof body.data.todayEntries).toBe('number');
      expect(typeof body.data.todayExits).toBe('number');
      expect(typeof body.data.avgDurationMinutes).toBe('number');
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/stats/dashboard',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/stats/hourly', () => {
    it('should return hourly statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/stats/hourly',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.hourly).toBeDefined();
      expect(Array.isArray(body.data.hourly)).toBe(true);
      expect(body.data.hourly.length).toBe(24); // 0-23 hours

      // Check structure of each hour
      body.data.hourly.forEach((h: any) => {
        expect(typeof h.hour).toBe('number');
        expect(typeof h.entries).toBe('number');
        expect(typeof h.exits).toBe('number');
        expect(h.hour).toBeGreaterThanOrEqual(0);
        expect(h.hour).toBeLessThanOrEqual(23);
      });
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/stats/hourly',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/stats/weekly', () => {
    it('should return weekly statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/stats/weekly',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.daily).toBeDefined();
      expect(Array.isArray(body.data.daily)).toBe(true);
      expect(body.data.daily.length).toBe(7); // 7 days

      // Check structure of each day
      body.data.daily.forEach((d: any) => {
        expect(typeof d.date).toBe('string');
        expect(typeof d.revenue).toBe('number');
        expect(typeof d.sessions).toBe('number');
        expect(d.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
      });
    });

    it('should return 401 without token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/stats/weekly',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
