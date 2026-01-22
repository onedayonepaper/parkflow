import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, seedTestData, getTestToken } from './setup.js';

describe('Metrics Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    seedTestData();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /metrics', () => {
    it('should return Prometheus format metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');

      const body = response.body;
      // Prometheus format should contain metric names
      expect(body).toContain('# HELP');
      expect(body).toContain('# TYPE');
    });

    it('should include standard metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
      });

      expect(response.statusCode).toBe(200);
      const body = response.body;

      // Check for expected metric types
      expect(body).toContain('process_uptime_seconds');
      expect(body).toContain('process_heap_bytes');
    });
  });

  describe('GET /metrics/json', () => {
    it('should return JSON format metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics/json',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');

      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data).toBeDefined();
      expect(body.data.timestamp).toBeDefined();
      expect(body.data.uptime).toBeDefined();
      expect(body.data.memory).toBeDefined();
    });

    it('should include memory metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics/json',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.data.memory.heapUsed).toBeDefined();
      expect(body.data.memory.heapTotal).toBeDefined();
      expect(body.data.memory.rss).toBeDefined();
      expect(typeof body.data.memory.heapUsedMB).toBe('number');
    });
  });
});
