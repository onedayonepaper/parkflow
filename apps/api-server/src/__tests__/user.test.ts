import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, seedTestData, getTestToken } from './setup.js';
import { getDb } from '../db/index.js';

describe('User Routes', () => {
  let app: FastifyInstance;
  let token: string;
  let operatorToken: string;

  beforeAll(async () => {
    app = await buildApp();
    seedTestData();
    token = getTestToken(app, 'SUPER_ADMIN');
    operatorToken = getTestToken(app, 'OPERATOR');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/users', () => {
    it('should return user list with admin auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/users',
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
    });

    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/users',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 403 for non-admin user', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/users',
        headers: {
          authorization: `Bearer ${operatorToken}`,
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /api/users', () => {
    it('should create new user with admin auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/users',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          username: 'newuser',
          password: 'securePassword123!',
          role: 'OPERATOR',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.id).toBeDefined();
      expect(body.data.username).toBe('newuser');
      expect(body.data.role).toBe('OPERATOR');
      // Password should not be returned
      expect(body.data.password).toBeUndefined();
      expect(body.data.password_hash).toBeUndefined();
    });

    it('should return 400 for duplicate username', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/users',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          username: 'admin', // Already exists
          password: 'password123',
          role: 'OPERATOR',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(false);
    });

    it('should return 403 for non-admin user', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/users',
        headers: {
          authorization: `Bearer ${operatorToken}`,
        },
        payload: {
          username: 'anotheruser',
          password: 'password123',
          role: 'OPERATOR',
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('PUT /api/users/:id', () => {
    it('should update user with admin auth', async () => {
      // First create a user to update
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT OR REPLACE INTO users (id, site_id, username, password_hash, role, is_active, created_at, updated_at)
        VALUES ('user_update_test', 'site_default', 'updateuser', 'hash', 'OPERATOR', 1, ?, ?)
      `).run(now, now);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/users/user_update_test',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          role: 'AUDITOR',
          isActive: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.id).toBe('user_update_test');
      expect(body.data.message).toBeDefined();
    });

    it('should return 404 for non-existent user', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: '/api/users/nonexistent',
        headers: {
          authorization: `Bearer ${token}`,
        },
        payload: {
          role: 'OPERATOR',
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('should delete user with admin auth', async () => {
      // First create a user to delete
      const db = getDb();
      const now = new Date().toISOString();
      db.prepare(`
        INSERT OR REPLACE INTO users (id, site_id, username, password_hash, role, is_active, created_at, updated_at)
        VALUES ('user_delete_test', 'site_default', 'deleteuser', 'hash', 'OPERATOR', 1, ?, ?)
      `).run(now, now);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/users/user_delete_test',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
    });

    it('should return 404 for non-existent user', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/users/nonexistent',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
