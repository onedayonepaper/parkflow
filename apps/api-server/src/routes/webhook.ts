/**
 * Webhook Routes
 *
 * 외부 서비스 웹훅 수신 엔드포인트
 * - Alertmanager 알림 수신
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { logAudit } from './audit.js';

// Alertmanager 알림 타입
interface AlertmanagerAlert {
  status: 'firing' | 'resolved';
  labels: {
    alertname: string;
    severity: 'critical' | 'warning' | 'info';
    [key: string]: string;
  };
  annotations: {
    summary?: string;
    description?: string;
    [key: string]: string | undefined;
  };
  startsAt: string;
  endsAt: string;
  generatorURL: string;
  fingerprint: string;
}

interface AlertmanagerPayload {
  version: string;
  groupKey: string;
  truncatedAlerts: number;
  status: 'firing' | 'resolved';
  receiver: string;
  groupLabels: Record<string, string>;
  commonLabels: Record<string, string>;
  commonAnnotations: Record<string, string>;
  externalURL: string;
  alerts: AlertmanagerAlert[];
}

export async function webhookRoutes(app: FastifyInstance) {
  // POST /api/webhooks/alert - Alertmanager 알림 수신
  app.post<{
    Body: AlertmanagerPayload;
  }>('/alert', {
    schema: {
      tags: ['Webhook'],
      summary: 'Alertmanager 알림 수신',
      description: 'Prometheus Alertmanager로부터 알림을 수신합니다.',
      body: {
        type: 'object',
        properties: {
          version: { type: 'string' },
          groupKey: { type: 'string' },
          status: { type: 'string', enum: ['firing', 'resolved'] },
          receiver: { type: 'string' },
          alerts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                labels: { type: 'object' },
                annotations: { type: 'object' },
                startsAt: { type: 'string' },
                endsAt: { type: 'string' },
                fingerprint: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const payload = request.body;

    // 알림 처리
    for (const alert of payload.alerts) {
      const severity = alert.labels.severity || 'info';
      const alertname = alert.labels.alertname;

      if (alert.status === 'firing') {
        // 알림 발생
        app.log.warn({
          alertname,
          severity,
          summary: alert.annotations.summary,
          description: alert.annotations.description,
          startsAt: alert.startsAt,
          labels: alert.labels,
        }, `[ALERT] ${alertname} - ${alert.annotations.summary || 'No summary'}`);

        // 감사 로그 기록
        try {
          logAudit(
            null,
            'ALERT_FIRED',
            'SYSTEM',
            alert.fingerprint,
            {
              alertname,
              severity,
              summary: alert.annotations.summary,
              description: alert.annotations.description,
              labels: alert.labels,
              startsAt: alert.startsAt,
            }
          );
        } catch (err) {
          app.log.error({ err }, 'Failed to log audit for alert');
        }

        // Critical 알림은 추가 처리 (예: 긴급 알림 발송)
        if (severity === 'critical') {
          app.log.error({
            alertname,
            description: alert.annotations.description,
          }, `[CRITICAL ALERT] ${alertname}`);

          // TODO: 추가 알림 채널 (SMS, 전화 등) 연동
        }
      } else if (alert.status === 'resolved') {
        // 알림 해결
        app.log.info({
          alertname,
          severity,
          endsAt: alert.endsAt,
        }, `[RESOLVED] ${alertname}`);

        try {
          logAudit(
            null,
            'ALERT_RESOLVED',
            'SYSTEM',
            alert.fingerprint,
            {
              alertname,
              severity,
              endsAt: alert.endsAt,
            }
          );
        } catch (err) {
          app.log.error({ err }, 'Failed to log audit for resolved alert');
        }
      }
    }

    return reply.send({
      ok: true,
      data: {
        received: payload.alerts.length,
        status: payload.status,
      },
      error: null,
    });
  });

  // GET /api/webhooks/health - 웹훅 헬스체크
  app.get('/health', {
    schema: {
      tags: ['Webhook'],
      summary: '웹훅 헬스체크',
    },
  }, async (request, reply) => {
    return reply.send({
      ok: true,
      data: { status: 'healthy' },
      error: null,
    });
  });
}
