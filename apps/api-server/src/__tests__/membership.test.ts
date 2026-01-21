import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, seedTestData, getTestToken } from './setup.js';

describe('Membership Routes', () => {
  let app: FastifyInstance;
  let token: string;
  let createdMembershipId: string;
  const testPlateNo = '88가8888';

  beforeAll(async () => {
    app = await buildApp();
    seedTestData();
    token = getTestToken(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/memberships', () => {
    it('should return membership list', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/memberships',
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

  describe('POST /api/memberships', () => {
    it('should create new membership', async () => {
      const validFrom = new Date().toISOString();
      const validTo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days later

      const response = await app.inject({
        method: 'POST',
        url: '/api/memberships',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          plateNo: testPlateNo,
          memberName: '테스트 회원',
          validFrom,
          validTo,
          note: '테스트 정기권',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.id).toBeDefined();
      expect(body.data.plateNo).toBe(testPlateNo);
      createdMembershipId = body.data.id;
    });

    it('should return 400 with missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/memberships',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          plateNo: '00가0000',
          // missing validFrom and validTo
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/memberships/:id', () => {
    it('should return membership detail', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/memberships/${createdMembershipId}`,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.id).toBe(createdMembershipId);
    });

    it('should return 404 for non-existent membership', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/memberships/nonexistent_membership',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/memberships/check/:plateNo', () => {
    it('should return valid for active membership', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/memberships/check/${testPlateNo}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.isValid).toBe(true);
      expect(body.data.membership).toBeDefined();
    });

    it('should return invalid for non-existent membership', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/memberships/check/00가0000',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.isValid).toBe(false);
      expect(body.data.membership).toBeNull();
    });
  });

  describe('PUT /api/memberships/:id', () => {
    it('should update membership', async () => {
      const validFrom = new Date().toISOString();
      const validTo = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days later

      const response = await app.inject({
        method: 'PUT',
        url: `/api/memberships/${createdMembershipId}`,
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          plateNo: testPlateNo,
          memberName: '수정된 회원',
          validFrom,
          validTo,
          note: '수정된 정기권',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
    });
  });

  describe('DELETE /api/memberships/:id', () => {
    it('should delete membership', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/memberships/${createdMembershipId}`,
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.deleted).toBe(true);
    });

    it('should return 404 when deleting non-existent membership', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/memberships/nonexistent_membership',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
