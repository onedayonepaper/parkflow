import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { LoginRequestSchema, type LoginResponse, type ApiResponse } from '@parkflow/shared';
import { createHash } from 'crypto';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login
  app.post<{
    Body: { username: string; password: string };
    Reply: ApiResponse<LoginResponse>;
  }>('/login', async (request, reply) => {
    const parsed = LoginRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    const { username, password } = parsed.data;
    const db = getDb();

    const user = db.prepare(`
      SELECT id, site_id, username, password_hash, role, is_active
      FROM users
      WHERE username = ? AND is_active = 1
    `).get(username) as any;

    if (!user || user.password_hash !== hashPassword(password)) {
      return reply.code(401).send({
        ok: false,
        data: null,
        error: { code: 'INVALID_CREDENTIALS', message: '아이디 또는 비밀번호가 올바르지 않습니다' },
      });
    }

    const token = app.jwt.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
      siteId: user.site_id,
    }, { expiresIn: '8h' });

    return reply.send({
      ok: true,
      data: {
        token,
        user: {
          id: user.id,
          siteId: user.site_id,
          username: user.username,
          role: user.role,
          isActive: true,
        },
      },
      error: null,
    });
  });

  // GET /api/auth/me
  app.get('/me', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const payload = request.user as any;
    const db = getDb();

    const user = db.prepare(`
      SELECT id, site_id, username, role, is_active, created_at, updated_at
      FROM users WHERE id = ?
    `).get(payload.sub) as any;

    if (!user) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다' },
      });
    }

    return reply.send({
      ok: true,
      data: {
        id: user.id,
        siteId: user.site_id,
        username: user.username,
        role: user.role,
        isActive: Boolean(user.is_active),
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
      error: null,
    });
  });
}
