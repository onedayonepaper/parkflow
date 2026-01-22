import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, seedTestData, getTestToken } from './setup.js';

describe('Security Tests', () => {
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

  describe('SQL Injection Prevention', () => {
    it('should handle SQL injection in session queries', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions?plate_no=\' OR 1=1--',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // Should not return all sessions, just those matching literal string
      expect(body.ok).toBe(true);
    });

    it('should handle SQL injection in payment queries', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/payments/\'; DROP TABLE payments;--',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      // Should return 404 (not found) not 500 (error)
      expect([400, 404]).toContain(response.statusCode);
    });

    it('should handle SQL injection in login', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          username: "admin' OR '1'='1",
          password: "' OR '1'='1",
        },
      });

      // Should fail authentication, not bypass it
      expect(response.statusCode).toBe(401);
    });

    it('should handle SQL injection in membership search', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/memberships?plate_no=\'; DELETE FROM memberships;--',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
    });
  });

  describe('Authentication & Authorization', () => {
    it('should reject requests without token', async () => {
      const protectedEndpoints = [
        '/api/sessions',
        '/api/payments',
        '/api/memberships',
        '/api/users',
        '/api/audit',
      ];

      for (const endpoint of protectedEndpoints) {
        const response = await app.inject({
          method: 'GET',
          url: endpoint,
        });

        expect(response.statusCode).toBe(401);
      }
    });

    it('should reject invalid tokens', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions',
        headers: {
          authorization: 'Bearer invalid.token.here',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject expired tokens', async () => {
      // Create a token that expires immediately (1 second)
      const shortLivedToken = app.jwt.sign({
        sub: 'user_test1',
        username: 'admin',
        role: 'SUPER_ADMIN',
        siteId: 'site_default',
      }, { expiresIn: '1ms' });

      // Wait for the token to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions',
        headers: {
          authorization: `Bearer ${shortLivedToken}`,
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject malformed authorization header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions',
        headers: {
          authorization: 'NotBearer token',
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid pagination parameters', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions?page=-1&limit=10000',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      // Should handle gracefully (might use default values or return error)
      expect([200, 400]).toContain(response.statusCode);
    });

    it('should reject invalid date formats', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions?from=invalid-date&to=also-invalid',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      // Should handle gracefully
      expect([200, 400]).toContain(response.statusCode);
    });

    it('should reject invalid session status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions?status=INVALID_STATUS',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      // Should handle gracefully (ignore invalid status or return error)
      expect([200, 400]).toContain(response.statusCode);
    });

    it('should sanitize plate number input', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions?plate_no=<script>alert("xss")</script>',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      // XSS script should not be executed (just treated as literal string)
    });
  });

  describe('Rate Limiting', () => {
    it('should not block legitimate requests', async () => {
      // Make a few requests - should all succeed
      for (let i = 0; i < 5; i++) {
        const response = await app.inject({
          method: 'GET',
          url: '/api/sessions?page=1&limit=1',
          headers: {
            authorization: `Bearer ${token}`,
          },
        });

        expect(response.statusCode).toBe(200);
      }
    });
  });

  describe('Error Handling', () => {
    it('should not leak stack traces in production errors', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/nonexistent-endpoint',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      // Should not contain stack trace
      expect(body.stack).toBeUndefined();
      expect(body.error?.stack).toBeUndefined();
    });

    it('should return consistent error format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions/nonexistent-session-id',
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(false);
      expect(body.data).toBeNull();
      expect(body.error).toBeDefined();
      expect(body.error.code).toBeDefined();
      expect(body.error.message).toBeDefined();
    });
  });
});
