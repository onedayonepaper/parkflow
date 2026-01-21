import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { LoginRequestSchema, type LoginResponse, type ApiResponse } from '@parkflow/shared';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): boolean {
  // Support both bcrypt and legacy SHA256 hashes for migration
  if (hash.startsWith('$2')) {
    return bcrypt.compareSync(password, hash);
  }
  // Legacy SHA256 fallback (for existing users)
  const { createHash } = require('crypto');
  const sha256Hash = createHash('sha256').update(password).digest('hex');
  return sha256Hash === hash;
}

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/login
  app.post<{
    Body: { username: string; password: string };
    Reply: ApiResponse<LoginResponse>;
  }>('/login', {
    schema: {
      tags: ['Auth'],
      summary: '로그인',
      description: '사용자 인증 후 JWT 토큰을 발급합니다.',
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', description: '사용자 ID' },
          password: { type: 'string', description: '비밀번호' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                token: { type: 'string' },
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    siteId: { type: 'string' },
                    username: { type: 'string' },
                    role: { type: 'string' },
                    isActive: { type: 'boolean' },
                  },
                },
              },
            },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
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

    if (!user || !verifyPassword(password, user.password_hash)) {
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
    schema: {
      tags: ['Auth'],
      summary: '현재 사용자 정보',
      description: '인증된 사용자의 정보를 반환합니다.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                siteId: { type: 'string' },
                username: { type: 'string' },
                role: { type: 'string' },
                isActive: { type: 'boolean' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
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
