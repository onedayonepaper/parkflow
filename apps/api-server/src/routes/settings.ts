import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { generateId, ID_PREFIX, nowIso, DEFAULT_SITE_ID } from '@parkflow/shared';

interface UserSettings {
  notification_entry: boolean;
  notification_exit: boolean;
  notification_payment: boolean;
  notification_error: boolean;
  notification_membership: boolean;
  sound_enabled: boolean;
  desktop_enabled: boolean;
}

const DEFAULT_SETTINGS: UserSettings = {
  notification_entry: true,
  notification_exit: true,
  notification_payment: true,
  notification_error: true,
  notification_membership: true,
  sound_enabled: true,
  desktop_enabled: false,
};

export async function settingsRoutes(app: FastifyInstance) {
  // GET /api/settings - 사용자 설정 조회
  app.get('/', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Settings'],
      summary: '사용자 설정 조회',
      description: '현재 사용자의 알림 및 시스템 설정을 조회합니다.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                notificationEntry: { type: 'boolean' },
                notificationExit: { type: 'boolean' },
                notificationPayment: { type: 'boolean' },
                notificationError: { type: 'boolean' },
                notificationMembership: { type: 'boolean' },
                soundEnabled: { type: 'boolean' },
                desktopEnabled: { type: 'boolean' },
              },
            },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const user = request.user as any;
    const db = getDb();

    const settings = db.prepare(`
      SELECT * FROM user_settings WHERE user_id = ?
    `).get(user.sub) as any;

    if (!settings) {
      // 기본 설정 반환
      return reply.send({
        ok: true,
        data: {
          notificationEntry: DEFAULT_SETTINGS.notification_entry,
          notificationExit: DEFAULT_SETTINGS.notification_exit,
          notificationPayment: DEFAULT_SETTINGS.notification_payment,
          notificationError: DEFAULT_SETTINGS.notification_error,
          notificationMembership: DEFAULT_SETTINGS.notification_membership,
          soundEnabled: DEFAULT_SETTINGS.sound_enabled,
          desktopEnabled: DEFAULT_SETTINGS.desktop_enabled,
        },
        error: null,
      });
    }

    return reply.send({
      ok: true,
      data: {
        notificationEntry: !!settings.notification_entry,
        notificationExit: !!settings.notification_exit,
        notificationPayment: !!settings.notification_payment,
        notificationError: !!settings.notification_error,
        notificationMembership: !!settings.notification_membership,
        soundEnabled: !!settings.sound_enabled,
        desktopEnabled: !!settings.desktop_enabled,
      },
      error: null,
    });
  });

  // PUT /api/settings - 사용자 설정 저장
  app.put<{
    Body: Partial<{
      notificationEntry: boolean;
      notificationExit: boolean;
      notificationPayment: boolean;
      notificationError: boolean;
      notificationMembership: boolean;
      soundEnabled: boolean;
      desktopEnabled: boolean;
    }>;
  }>('/', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Settings'],
      summary: '사용자 설정 저장',
      description: '사용자의 알림 및 시스템 설정을 저장합니다.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          notificationEntry: { type: 'boolean' },
          notificationExit: { type: 'boolean' },
          notificationPayment: { type: 'boolean' },
          notificationError: { type: 'boolean' },
          notificationMembership: { type: 'boolean' },
          soundEnabled: { type: 'boolean' },
          desktopEnabled: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const user = request.user as any;
    const db = getDb();
    const now = nowIso();

    const {
      notificationEntry,
      notificationExit,
      notificationPayment,
      notificationError,
      notificationMembership,
      soundEnabled,
      desktopEnabled,
    } = request.body;

    // Upsert
    const existing = db.prepare(`
      SELECT id FROM user_settings WHERE user_id = ?
    `).get(user.sub) as any;

    if (existing) {
      const updates: string[] = [];
      const params: any[] = [];

      if (notificationEntry !== undefined) {
        updates.push('notification_entry = ?');
        params.push(notificationEntry ? 1 : 0);
      }
      if (notificationExit !== undefined) {
        updates.push('notification_exit = ?');
        params.push(notificationExit ? 1 : 0);
      }
      if (notificationPayment !== undefined) {
        updates.push('notification_payment = ?');
        params.push(notificationPayment ? 1 : 0);
      }
      if (notificationError !== undefined) {
        updates.push('notification_error = ?');
        params.push(notificationError ? 1 : 0);
      }
      if (notificationMembership !== undefined) {
        updates.push('notification_membership = ?');
        params.push(notificationMembership ? 1 : 0);
      }
      if (soundEnabled !== undefined) {
        updates.push('sound_enabled = ?');
        params.push(soundEnabled ? 1 : 0);
      }
      if (desktopEnabled !== undefined) {
        updates.push('desktop_enabled = ?');
        params.push(desktopEnabled ? 1 : 0);
      }

      if (updates.length > 0) {
        updates.push('updated_at = ?');
        params.push(now);
        params.push(user.sub);

        db.prepare(`
          UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?
        `).run(...params);
      }
    } else {
      // Insert
      db.prepare(`
        INSERT INTO user_settings (
          id, user_id, notification_entry, notification_exit, notification_payment,
          notification_error, notification_membership, sound_enabled, desktop_enabled,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        generateId('uset'),
        user.sub,
        notificationEntry ?? DEFAULT_SETTINGS.notification_entry ? 1 : 0,
        notificationExit ?? DEFAULT_SETTINGS.notification_exit ? 1 : 0,
        notificationPayment ?? DEFAULT_SETTINGS.notification_payment ? 1 : 0,
        notificationError ?? DEFAULT_SETTINGS.notification_error ? 1 : 0,
        notificationMembership ?? DEFAULT_SETTINGS.notification_membership ? 1 : 0,
        soundEnabled ?? DEFAULT_SETTINGS.sound_enabled ? 1 : 0,
        desktopEnabled ?? DEFAULT_SETTINGS.desktop_enabled ? 1 : 0,
        now,
        now
      );
    }

    return reply.send({
      ok: true,
      data: { saved: true },
      error: null,
    });
  });

  // GET /api/settings/system - 시스템 설정 조회 (관리자 전용)
  app.get('/system', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Settings'],
      summary: '시스템 설정 조회',
      description: '시스템 전체 설정을 조회합니다.',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const db = getDb();

    const settings = db.prepare(`
      SELECT key, value FROM system_settings WHERE site_id = ?
    `).all(DEFAULT_SITE_ID) as { key: string; value: string }[];

    const settingsMap: Record<string, any> = {};
    settings.forEach(({ key, value }) => {
      try {
        settingsMap[key] = JSON.parse(value);
      } catch {
        settingsMap[key] = value;
      }
    });

    return reply.send({
      ok: true,
      data: settingsMap,
      error: null,
    });
  });

  // PUT /api/settings/system - 시스템 설정 저장 (관리자 전용)
  app.put<{
    Body: Record<string, any>;
  }>('/system', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Settings'],
      summary: '시스템 설정 저장',
      description: '시스템 전체 설정을 저장합니다.',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const user = request.user as any;

    // 관리자 권한 확인
    if (user.role !== 'ADMIN') {
      return reply.code(403).send({
        ok: false,
        data: null,
        error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다' },
      });
    }

    const db = getDb();
    const now = nowIso();
    const settings = request.body;

    for (const [key, value] of Object.entries(settings)) {
      const valueStr = typeof value === 'string' ? value : JSON.stringify(value);

      const existing = db.prepare(`
        SELECT id FROM system_settings WHERE site_id = ? AND key = ?
      `).get(DEFAULT_SITE_ID, key) as any;

      if (existing) {
        db.prepare(`
          UPDATE system_settings SET value = ?, updated_at = ? WHERE id = ?
        `).run(valueStr, now, existing.id);
      } else {
        db.prepare(`
          INSERT INTO system_settings (id, site_id, key, value, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(generateId('sset'), DEFAULT_SITE_ID, key, valueStr, now, now);
      }
    }

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'SYSTEM_SETTINGS_UPDATE', 'system_settings', ?, ?, ?)
    `).run(generateId(ID_PREFIX.AUDIT), DEFAULT_SITE_ID, user.sub, DEFAULT_SITE_ID, JSON.stringify(settings), now);

    return reply.send({
      ok: true,
      data: { saved: true },
      error: null,
    });
  });
}
