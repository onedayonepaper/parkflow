/**
 * Metrics API Routes
 *
 * 모니터링 메트릭 엔드포인트
 * - Prometheus 형식 메트릭 (/metrics)
 * - JSON 형식 메트릭 (/api/metrics)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getMetrics } from '../services/metrics.js';

export async function metricsRoutes(app: FastifyInstance) {
  /**
   * GET /metrics - Prometheus 형식 메트릭
   *
   * Prometheus scraper용 엔드포인트
   * Content-Type: text/plain
   */
  app.get('/', {
    schema: {
      tags: ['Monitoring'],
      summary: 'Prometheus 메트릭',
      description: 'Prometheus scraper용 메트릭 엔드포인트. text/plain 형식으로 반환됩니다.',
      response: {
        200: {
          type: 'string',
          description: 'Prometheus 형식 메트릭',
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const metrics = getMetrics();
    const output = metrics.getPrometheusMetrics();

    return reply
      .header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
      .send(output);
  });

  /**
   * GET /json - JSON 형식 메트릭
   *
   * 대시보드/모니터링 UI용 JSON 메트릭
   */
  app.get('/json', {
    schema: {
      tags: ['Monitoring'],
      summary: 'JSON 메트릭',
      description: '대시보드용 JSON 형식 메트릭',
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                timestamp: { type: 'string' },
                uptime: { type: 'number' },
                http: {
                  type: 'object',
                  properties: {
                    requestsPerMinute: { type: 'number' },
                    errorRate: { type: 'number' },
                    avgResponseTime: { type: 'number' },
                    p95ResponseTime: { type: 'number' },
                    p99ResponseTime: { type: 'number' },
                  },
                },
                memory: {
                  type: 'object',
                  properties: {
                    heapUsed: { type: 'number' },
                    heapTotal: { type: 'number' },
                    heapUsedMB: { type: 'number' },
                    rss: { type: 'number' },
                    rssMB: { type: 'number' },
                  },
                },
                business: { type: 'object' },
              },
            },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const metrics = getMetrics();
    const data = metrics.getJsonMetrics();

    return reply.send({
      ok: true,
      data,
      error: null,
    });
  });
}
