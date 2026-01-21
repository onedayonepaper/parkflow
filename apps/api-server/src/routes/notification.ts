import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { generateId, ID_PREFIX, nowIso, DEFAULT_SITE_ID } from '@parkflow/shared';

// 알림 발송 서비스 인터페이스
interface NotificationService {
  sendEmail(to: string, subject: string, body: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
  sendSMS(to: string, body: string): Promise<{ success: boolean; messageId?: string; error?: string }>;
}

// Mock 알림 서비스 (실제 구현 시 외부 서비스 연동)
const mockNotificationService: NotificationService = {
  async sendEmail(to: string, subject: string, body: string) {
    console.log(`[MOCK EMAIL] To: ${to}, Subject: ${subject}, Body: ${body.substring(0, 100)}...`);
    return { success: true, messageId: `mock_email_${Date.now()}` };
  },
  async sendSMS(to: string, body: string) {
    console.log(`[MOCK SMS] To: ${to}, Body: ${body}`);
    return { success: true, messageId: `mock_sms_${Date.now()}` };
  },
};

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
      type: 'EMAIL' | 'SMS';
      recipient: string;
      subject?: string;
      body: string;
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
          type: { type: 'string', enum: ['EMAIL', 'SMS'] },
          recipient: { type: 'string', description: '이메일 주소 또는 전화번호' },
          subject: { type: 'string', description: '이메일 제목' },
          body: { type: 'string', description: '메시지 내용' },
        },
      },
    },
  }, async (request, reply) => {
    const { type, recipient, subject, body } = request.body;
    const db = getDb();
    const now = nowIso();

    const logId = generateId(ID_PREFIX.NOTIFICATION || 'noti');

    let result: { success: boolean; messageId?: string; error?: string };

    if (type === 'EMAIL') {
      if (!subject) {
        return reply.code(400).send({
          ok: false,
          data: null,
          error: { code: 'MISSING_SUBJECT', message: '이메일 제목이 필요합니다.' },
        });
      }
      result = await mockNotificationService.sendEmail(recipient, subject, body);
    } else {
      result = await mockNotificationService.sendSMS(recipient, body);
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
      result.error || null,
      result.success ? now : null,
      now
    );

    if (!result.success) {
      return reply.code(500).send({
        ok: false,
        data: null,
        error: { code: 'SEND_FAILED', message: result.error || '발송에 실패했습니다.' },
      });
    }

    return reply.send({
      ok: true,
      data: {
        logId,
        messageId: result.messageId,
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
      type: 'EMAIL' | 'SMS';
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
          type: { type: 'string', enum: ['EMAIL', 'SMS'] },
          recipient: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const { type, recipient } = request.body;

    let result: { success: boolean; messageId?: string; error?: string };

    if (type === 'EMAIL') {
      result = await mockNotificationService.sendEmail(
        recipient,
        '[ParkFlow] 테스트 알림',
        '이 메시지는 ParkFlow 알림 테스트입니다. 정상적으로 수신되었다면 알림 설정이 완료되었습니다.'
      );
    } else {
      result = await mockNotificationService.sendSMS(
        recipient,
        '[ParkFlow] 테스트 알림입니다. 알림 설정이 완료되었습니다.'
      );
    }

    return reply.send({
      ok: result.success,
      data: result.success ? { message: '테스트 알림이 발송되었습니다.' } : null,
      error: result.success ? null : { code: 'SEND_FAILED', message: result.error || '발송 실패' },
    });
  });
}
