import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp, seedTestData } from './setup.js';

describe('Device Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    seedTestData();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/device/lpr/events', () => {
    it('should create entry event and session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/device/lpr/events',
        payload: {
          deviceId: 'dev_test1',
          laneId: 'lane_test1',
          direction: 'ENTRY',
          plateNo: '12가3456',
          capturedAt: new Date().toISOString(),
          confidence: 0.95,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.eventId).toBeDefined();
      expect(body.data.sessionId).toBeDefined();
    });

    it('should handle duplicate entry gracefully', async () => {
      // First entry
      await app.inject({
        method: 'POST',
        url: '/api/device/lpr/events',
        payload: {
          deviceId: 'dev_test1',
          laneId: 'lane_test1',
          direction: 'ENTRY',
          plateNo: '34나5678',
          capturedAt: new Date().toISOString(),
        },
      });

      // Duplicate entry
      const response = await app.inject({
        method: 'POST',
        url: '/api/device/lpr/events',
        payload: {
          deviceId: 'dev_test1',
          laneId: 'lane_test1',
          direction: 'ENTRY',
          plateNo: '34나5678',
          capturedAt: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      // sessionId should be null for duplicate entry
      expect(body.data.sessionId).toBeNull();
    });

    it('should return 400 with invalid direction', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/device/lpr/events',
        payload: {
          deviceId: 'dev_test1',
          laneId: 'lane_test1',
          direction: 'INVALID',
          plateNo: '12가3456',
          capturedAt: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle exit event', async () => {
      const plateNo = '56다7890';

      // Create entry first
      await app.inject({
        method: 'POST',
        url: '/api/device/lpr/events',
        payload: {
          deviceId: 'dev_test1',
          laneId: 'lane_test1',
          direction: 'ENTRY',
          plateNo,
          capturedAt: new Date(Date.now() - 60000).toISOString(),
        },
      });

      // Create exit
      const exitResponse = await app.inject({
        method: 'POST',
        url: '/api/device/lpr/events',
        payload: {
          deviceId: 'dev_test1',
          laneId: 'lane_test2',
          direction: 'EXIT',
          plateNo,
          capturedAt: new Date().toISOString(),
        },
      });

      expect(exitResponse.statusCode).toBe(200);
      const body = JSON.parse(exitResponse.body);
      expect(body.ok).toBe(true);
      expect(body.data.sessionId).toBeDefined();
    });
  });

  describe('POST /api/device/heartbeat', () => {
    it('should update device status', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/device/heartbeat',
        payload: {
          deviceId: 'dev_test1',
          status: 'ONLINE',
          ts: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.received).toBe(true);
    });

    it('should return 400 with invalid status', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/device/heartbeat',
        payload: {
          deviceId: 'dev_test1',
          status: 'INVALID_STATUS',
          ts: new Date().toISOString(),
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/device/barrier/command', () => {
    it('should create barrier command', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/device/barrier/command',
        payload: {
          deviceId: 'dev_test1',
          laneId: 'lane_test1',
          action: 'OPEN',
          reason: 'MANUAL_OPEN',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ok).toBe(true);
      expect(body.data.commandId).toBeDefined();
    });
  });
});
