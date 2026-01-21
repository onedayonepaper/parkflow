import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, seedTestData, getTestToken } from './setup.js';

describe('Discount Routes', () => {
  let app: FastifyInstance;
  let token: string;
  let createdRuleId: string;

  beforeAll(async () => {
    app = await buildApp();
    seedTestData();
    token = getTestToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/discount-rules', () => {
    it('should return discount rule list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/discount-rules',
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

  describe('POST /api/discount-rules', () => {
    it('should create new discount rule', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/discount-rules',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: '신규 할인',
          type: 'PERCENT',  // Valid types: AMOUNT, PERCENT, FREE_MINUTES, FREE_ALL
          value: 10,
          isStackable: true,
          maxApplyCount: 3,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.name).toBe('신규 할인');
      createdRuleId = body.data.id;
    });

    it('should return 400 with invalid type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/discount-rules',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: '잘못된 할인',
          type: 'INVALID_TYPE',
          value: 10,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/discount-rules/:id', () => {
    it('should return discount rule detail', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/discount-rules/${createdRuleId}`,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.id).toBe(createdRuleId);
    });

    it('should return 404 for non-existent rule', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/discount-rules/nonexistent_rule',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PUT /api/discount-rules/:id', () => {
    it('should update discount rule', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/discount-rules/${createdRuleId}`,
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          name: '수정된 할인',
          type: 'AMOUNT',  // Valid types: AMOUNT, PERCENT, FREE_MINUTES, FREE_ALL
          value: 2000,
          isStackable: false,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.name).toBe('수정된 할인');
    });
  });

  describe('DELETE /api/discount-rules/:id', () => {
    it('should delete discount rule', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/discount-rules/${createdRuleId}`,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.deleted).toBe(true);
    });

    it('should return 404 when deleting non-existent rule', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/discount-rules/nonexistent_rule',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
