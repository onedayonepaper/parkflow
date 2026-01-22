import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { generateId, ID_PREFIX, nowIso, DEFAULT_SITE_ID } from '@parkflow/shared';
import {
  getNotificationService,
  renderTemplate,
  isValidEmail,
  isValidPhoneNumber,
  type NotificationResult,
} from '../services/notification.js';

export async function notificationRoutes(app: FastifyInstance) {
  // GET /api/notifications/templates - 알림 템플릿 목록
  app.get('/templates', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Notification'],
      summary: '알림 템플릿 목록 조회',
      description: '등록된 알림 템플릿 목록을 조회합니다.',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const db = getDb();

    const templates = db.prepare(`
      SELECT * FROM notification_templates
      WHERE site_id = ?
      ORDER BY event_type, type
    `).all(DEFAULT_SITE_ID) as any[];

    return reply.send({
      ok: true,
      data: {
        items: templates.map((t) => ({
          id: t.id,
          type: t.type,
          eventType: t.event_type,
          subject: t.subject,
          bodyTemplate: t.body_template,
          isActive: Boolean(t.is_active),
          createdAt: t.created_at,
          updatedAt: t.updated_at,
        })),
      },
      error: null,
    });
  });

  // POST /api/notifications/templates - 알림 템플릿 생성
  app.post<{
    Body: {
      type: 'EMAIL' | 'SMS' | 'PUSH';
      eventType: string;
      subject?: string;
      bodyTemplate: string;
    };
  }>('/templates', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Notification'],
      summary: '알림 템플릿 생성',
      description: '새로운 알림 템플릿을 생성합니다.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['type', 'eventType', 'bodyTemplate'],
        properties: {
          type: { type: 'string', enum: ['EMAIL', 'SMS', 'PUSH'] },
          eventType: {
            type: 'string',
            enum: ['ENTRY', 'EXIT', 'PAYMENT', 'MEMBERSHIP_EXPIRY', 'BLACKLIST_ALERT'],
          },
          subject: { type: 'string', description: '이메일 제목 (EMAIL 타입일 때 필수)' },
          bodyTemplate: {
            type: 'string',
            description: '메시지 템플릿. 변수: {{plateNo}}, {{amount}}, {{entryAt}}, {{exitAt}}, {{siteName}}',
          },
        },
      },
    },
  }, async (request, reply) => {
    const user = (request as any).user;
    const { type, eventType, subject, bodyTemplate } = request.body;
    const db = getDb();
    const now = nowIso();

    if (type === 'EMAIL' && !subject) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'MISSING_SUBJECT', message: '이메일 타입은 제목이 필수입니다.' },
      });
    }

    const id = generateId(ID_PREFIX.NOTIFICATION || 'noti');

    db.prepare(`
      INSERT INTO notification_templates (id, site_id, type, event_type, subject, body_template, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, DEFAULT_SITE_ID, type, eventType, subject || null, bodyTemplate, now, now);

    return reply.code(201).send({
      ok: true,
      data: { id, type, eventType },
      error: null,
    });
  });

  // PUT /api/notifications/templates/:id - 알림 템플릿 수정
  app.put<{
    Params: { id: string };
    Body: {
      subject?: string;
      bodyTemplate?: string;
      isActive?: boolean;
    };
  }>('/templates/:id', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Notification'],
      summary: '알림 템플릿 수정',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { subject, bodyTemplate, isActive } = request.body;
    const db = getDb();
    const now = nowIso();

    const existing = db.prepare('SELECT * FROM notification_templates WHERE id = ?').get(id);
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'NOT_FOUND', message: '템플릿을 찾을 수 없습니다.' },
      });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (subject !== undefined) {
      updates.push('subject = ?');
      values.push(subject);
    }
    if (bodyTemplate !== undefined) {
      updates.push('body_template = ?');
      values.push(bodyTemplate);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      values.push(isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'NO_CHANGES', message: '변경할 내용이 없습니다.' },
      });
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(id);

    db.prepare(`UPDATE notification_templates SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return reply.send({
      ok: true,
      data: { message: '템플릿이 수정되었습니다.' },
      error: null,
    });
  });

  // DELETE /api/notifications/templates/:id
  app.delete<{
    Params: { id: string };
  }>('/templates/:id', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Notification'],
      summary: '알림 템플릿 삭제',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();

    const result = db.prepare('DELETE FROM notification_templates WHERE id = ?').run(id);

    if (result.changes === 0) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'NOT_FOUND', message: '템플릿을 찾을 수 없습니다.' },
      });
    }

    return reply.send({
      ok: true,
      data: { message: '템플릿이 삭제되었습니다.' },
      error: null,
    });
  });

  // POST /api/notifications/send - 알림 발송
  app.post<{
    Body: {
      type: 'EMAIL' | 'SMS' | 'KAKAO';
      recipient: string;
      subject?: string;
      body: string;
      templateCode?: string;
      variables?: Record<string, string>;
    };
  }>('/send', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Notification'],
      summary: '알림 발송',
      description: '즉시 알림을 발송합니다.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['type', 'recipient', 'body'],
        properties: {
          type: { type: 'string', enum: ['EMAIL', 'SMS', 'KAKAO'] },
          recipient: { type: 'string', description: '이메일 주소 또는 전화번호' },
          subject: { type: 'string', description: '이메일 제목' },
          body: { type: 'string', description: '메시지 내용' },
          templateCode: { type: 'string', description: '카카오 알림톡 템플릿 코드' },
          variables: { type: 'object', description: '템플릿 변수' },
        },
      },
    },
  }, async (request, reply) => {
    const { type, recipient, subject, body, templateCode, variables } = request.body;
    const db = getDb();
    const now = nowIso();

    const logId = generateId(ID_PREFIX.NOTIFICATION || 'noti');
    const notificationService = getNotificationService();

    let result: NotificationResult;

    if (type === 'EMAIL') {
      if (!subject) {
        return reply.code(400).send({
          ok: false,
          data: null,
          error: { code: 'MISSING_SUBJECT', message: '이메일 제목이 필요합니다.' },
        });
      }
      if (!isValidEmail(recipient)) {
        return reply.code(400).send({
          ok: false,
          data: null,
          error: { code: 'INVALID_EMAIL', message: '유효하지 않은 이메일 주소입니다.' },
        });
      }
      result = await notificationService.email.send({
        to: recipient,
        subject,
        body,
      });
    } else if (type === 'SMS') {
      if (!isValidPhoneNumber(recipient)) {
        return reply.code(400).send({
          ok: false,
          data: null,
          error: { code: 'INVALID_PHONE', message: '유효하지 않은 전화번호입니다.' },
        });
      }
      result = await notificationService.sms.send({
        to: recipient,
        body,
      });
    } else if (type === 'KAKAO') {
      if (!templateCode) {
        return reply.code(400).send({
          ok: false,
          data: null,
          error: { code: 'MISSING_TEMPLATE', message: '카카오 알림톡은 템플릿 코드가 필요합니다.' },
        });
      }
      if (!isValidPhoneNumber(recipient)) {
        return reply.code(400).send({
          ok: false,
          data: null,
          error: { code: 'INVALID_PHONE', message: '유효하지 않은 전화번호입니다.' },
        });
      }
      result = await notificationService.kakao.send({
        to: recipient,
        templateCode,
        variables: variables || {},
      });
    } else {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'INVALID_TYPE', message: '지원하지 않는 알림 타입입니다.' },
      });
    }

    // 발송 로그 저장
    db.prepare(`
      INSERT INTO notification_logs (id, site_id, recipient, type, subject, body, status, error_message, sent_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      logId,
      DEFAULT_SITE_ID,
      recipient,
      type,
      subject || null,
      body,
      result.success ? 'SENT' : 'FAILED',
      result.error?.message || null,
      result.success ? now : null,
      now
    );

    if (!result.success) {
      return reply.code(500).send({
        ok: false,
        data: null,
        error: {
          code: result.error?.code || 'SEND_FAILED',
          message: result.error?.message || '발송에 실패했습니다.',
        },
      });
    }

    return reply.send({
      ok: true,
      data: {
        logId,
        messageId: result.messageId,
        provider: result.provider,
        message: '알림이 발송되었습니다.',
      },
      error: null,
    });
  });

  // GET /api/notifications/logs - 발송 로그 조회
  app.get<{
    Querystring: { page?: string; limit?: string; type?: string; status?: string };
  }>('/logs', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Notification'],
      summary: '발송 로그 조회',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string' },
          limit: { type: 'string' },
          type: { type: 'string', enum: ['EMAIL', 'SMS', 'PUSH'] },
          status: { type: 'string', enum: ['PENDING', 'SENT', 'FAILED'] },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const page = Math.max(1, parseInt(request.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(request.query.limit || '20', 10)));
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE site_id = ?';
    const params: any[] = [DEFAULT_SITE_ID];

    if (request.query.type) {
      whereClause += ' AND type = ?';
      params.push(request.query.type);
    }
    if (request.query.status) {
      whereClause += ' AND status = ?';
      params.push(request.query.status);
    }

    const countResult = db.prepare(`
      SELECT COUNT(*) as count FROM notification_logs ${whereClause}
    `).get(...params) as { count: number };

    const logs = db.prepare(`
      SELECT * FROM notification_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limit, offset) as any[];

    return reply.send({
      ok: true,
      data: {
        items: logs.map((log) => ({
          id: log.id,
          recipient: log.recipient,
          type: log.type,
          subject: log.subject,
          body: log.body,
          status: log.status,
          errorMessage: log.error_message,
          sentAt: log.sent_at,
          createdAt: log.created_at,
        })),
        total: countResult.count,
        page,
        limit,
        totalPages: Math.ceil(countResult.count / limit),
      },
      error: null,
    });
  });

  // POST /api/notifications/test - 테스트 알림 발송
  app.post<{
    Body: {
      type: 'EMAIL' | 'SMS' | 'KAKAO';
      recipient: string;
    };
  }>('/test', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Notification'],
      summary: '테스트 알림 발송',
      description: '테스트 알림을 발송합니다.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['type', 'recipient'],
        properties: {
          type: { type: 'string', enum: ['EMAIL', 'SMS', 'KAKAO'] },
          recipient: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { type, recipient } = request.body;
    const notificationService = getNotificationService();

    let result: NotificationResult;

    if (type === 'EMAIL') {
      if (!isValidEmail(recipient)) {
        return reply.code(400).send({
          ok: false,
          data: null,
          error: { code: 'INVALID_EMAIL', message: '유효하지 않은 이메일 주소입니다.' },
        });
      }
      result = await notificationService.email.send({
        to: recipient,
        subject: '[ParkFlow] 테스트 알림',
        body: '이 메시지는 ParkFlow 알림 테스트입니다. 정상적으로 수신되었다면 알림 설정이 완료되었습니다.',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">ParkFlow 테스트 알림</h2>
            <p>이 메시지는 ParkFlow 알림 테스트입니다.</p>
            <p>정상적으로 수신되었다면 알림 설정이 완료되었습니다.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">ParkFlow 주차 관리 시스템</p>
          </div>
        `,
      });
    } else if (type === 'SMS') {
      if (!isValidPhoneNumber(recipient)) {
        return reply.code(400).send({
          ok: false,
          data: null,
          error: { code: 'INVALID_PHONE', message: '유효하지 않은 전화번호입니다.' },
        });
      }
      result = await notificationService.sms.send({
        to: recipient,
        body: '[ParkFlow] 테스트 알림입니다. 알림 설정이 완료되었습니다.',
      });
    } else if (type === 'KAKAO') {
      if (!isValidPhoneNumber(recipient)) {
        return reply.code(400).send({
          ok: false,
          data: null,
          error: { code: 'INVALID_PHONE', message: '유효하지 않은 전화번호입니다.' },
        });
      }
      // 카카오 알림톡 테스트 (테스트용 기본 템플릿 사용)
      result = await notificationService.kakao.send({
        to: recipient,
        templateCode: 'PARKFLOW_TEST',
        variables: {
          siteName: 'ParkFlow',
          message: '테스트 알림입니다.',
        },
      });
    } else {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'INVALID_TYPE', message: '지원하지 않는 알림 타입입니다.' },
      });
    }

    return reply.send({
      ok: result.success,
      data: result.success
        ? {
            message: '테스트 알림이 발송되었습니다.',
            provider: result.provider,
            messageId: result.messageId,
          }
        : null,
      error: result.success
        ? null
        : {
            code: result.error?.code || 'SEND_FAILED',
            message: result.error?.message || '발송 실패',
          },
    });
  });

  // GET /api/notifications/status - 알림 서비스 상태 확인
  app.get('/status', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Notification'],
      summary: '알림 서비스 상태 확인',
      description: '각 알림 채널의 설정 상태를 확인합니다.',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const notificationService = getNotificationService();

    const [emailOk, smsOk, kakaoOk] = await Promise.all([
      notificationService.email.verify(),
      notificationService.sms.verify(),
      notificationService.kakao.verify(),
    ]);

    return reply.send({
      ok: true,
      data: {
        mode: process.env.NOTIFICATION_MODE || 'mock',
        channels: {
          email: {
            configured: emailOk,
            provider: process.env.EMAIL_PROVIDER || 'smtp',
          },
          sms: {
            configured: smsOk,
            provider: process.env.SMS_PROVIDER || 'nhn',
          },
          kakao: {
            configured: kakaoOk,
          },
        },
      },
      error: null,
    });
  });
}
