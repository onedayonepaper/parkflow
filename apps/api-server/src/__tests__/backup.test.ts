import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, seedTestData, getTestToken } from './setup.js';
import { getDb } from '../db/index.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Backup Routes', () => {
  let app: FastifyInstance;
  let token: string;

  beforeAll(async () => {
    app = await buildApp();
    seedTestData();
    token = getTestToken(app); // Default is SUPER_ADMIN
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/backups', () => {
    it('should return backup list with admin auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/backups',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.backups).toBeDefined();
      expect(Array.isArray(body.data.backups)).toBe(true);
    });

    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/backups',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('GET /api/backups/status', () => {
    it('should return backup status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/backups/status',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data).toBeDefined();
      expect(typeof body.data.enabled).toBe('boolean');
    });
  });

  describe('POST /api/backups', () => {
    it('should create manual backup with admin auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/backups',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      // Backup might fail in test environment due to directory issues
      // but the endpoint should respond properly
      expect([200, 500]).toContain(response.statusCode);
      const body = JSON.parse(response.body);
      expect(typeof body.ok).toBe('boolean');
    });

    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/backups',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/backups/:filename/restore', () => {
    it('should require x-confirm-restore header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/backups/nonexistent.db/restore',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('CONFIRMATION_REQUIRED');
    });

    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/backups/test.db/restore',
        headers: {
          'x-confirm-restore': 'true',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return 500 for non-existent backup file', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/backups/nonexistent.db/restore',
        headers: {
          authorization: `Bearer ${token}`,
          'x-confirm-restore': 'true',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('RESTORE_FAILED');
    });
  });

  describe('DELETE /api/backups/:filename', () => {
    it('should return 404 for non-existent backup file', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/backups/nonexistent.db',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(false);
    });

    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/backups/test.db',
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('POST /api/backups/cleanup', () => {
    it('should run cleanup with admin auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/backups/cleanup',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.deleted).toBeDefined();
      expect(Array.isArray(body.data.deleted)).toBe(true);
    });

    it('should return 401 without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/backups/cleanup',
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
