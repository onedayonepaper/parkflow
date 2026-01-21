import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, seedTestData, getTestToken } from './setup.js';

describe('RatePlan Routes', () => {
  let app: FastifyInstance;
  let token: string;
  let createdPlanId: string;

  beforeAll(async () => {
    app = await buildApp();
    seedTestData();
    token = getTestToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/rate-plans', () => {
    it('should return rate plan list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/rate-plans',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.items).toBeDefined();
      expect(Array.isArray(body.data.items)).toBe(true);
    });
  });

  describe('POST /api/rate-plans', () => {
    it('should create new rate plan', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/rate-plans',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: '테스트 요금제',
          rules: {
            baseFee: 2000,
            baseMinutes: 60,
            additionalFee: 1000,
            additionalMinutes: 30,
          },
          isActive: false,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.name).toBe('테스트 요금제');
      createdPlanId = body.data.id;
    });
  });

  describe('GET /api/rate-plans/:id', () => {
    it('should return rate plan detail', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/rate-plans/${createdPlanId}`,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.id).toBe(createdPlanId);
    });

    it('should return 404 for non-existent plan', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/rate-plans/nonexistent_plan',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/rate-plans/:id', () => {
    it('should update rate plan', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/rate-plans/${createdPlanId}`,
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: '수정된 요금제',
          rules: {
            baseFee: 3000,
            baseMinutes: 60,
            additionalFee: 1500,
            additionalMinutes: 30,
          },
          isActive: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.name).toBe('수정된 요금제');
    });
  });

  describe('POST /api/rate-plans/:id/activate', () => {
    it('should activate rate plan', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/rate-plans/${createdPlanId}/activate`,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.activated).toBe(true);
    });
  });
});
