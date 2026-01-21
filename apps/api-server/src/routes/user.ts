import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { generateId, ID_PREFIX, nowIso, DEFAULT_SITE_ID } from '@parkflow/shared';
import { hashPassword, verifyPassword } from './auth.js';

interface User {
  id: string;
  siteId: string;
  username: string;
  role: 'SUPER_ADMIN' | 'OPERATOR' | 'AUDITOR';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function userRoutes(app: FastifyInstance) {
  // GET /api/users - 사용자 목록 조회
  app.get('/', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['User'],
      summary: '사용자 목록 조회',
      description: '등록된 모든 사용자 목록을 조회합니다. SUPER_ADMIN만 접근 가능합니다.',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({
        ok: false,
        data: null,
        error: { code: 'FORBIDDEN', message: '권한이 없습니다.' },
      });
    }

    const db = getDb();
    const users = db.prepare(`
      SELECT id, site_id, username, role, is_active, created_at, updated_at
      FROM users
      WHERE site_id = ?
      ORDER BY created_at DESC
    `).all(DEFAULT_SITE_ID) as any[];

    return reply.send({
      ok: true,
      data: {
        items: users.map((u) => ({
          id: u.id,
          siteId: u.site_id,
          username: u.username,
          role: u.role,
          isActive: Boolean(u.is_active),
          createdAt: u.created_at,
          updatedAt: u.updated_at,
        })),
      },
      error: null,
    });
  });

  // POST /api/users - 사용자 생성
  app.post<{
    Body: {
      username: string;
      password: string;
      role: 'SUPER_ADMIN' | 'OPERATOR' | 'AUDITOR';
    };
  }>('/', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['User'],
      summary: '사용자 생성',
      description: '새로운 사용자를 생성합니다. SUPER_ADMIN만 접근 가능합니다.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['username', 'password', 'role'],
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 50 },
          password: { type: 'string', minLength: 4 },
          role: { type: 'string', enum: ['SUPER_ADMIN', 'OPERATOR', 'AUDITOR'] },
        },
      },
    },
  }, async (request, reply) => {
    const user = (request as any).user;
    if (user.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({
        ok: false,
        data: null,
        error: { code: 'FORBIDDEN', message: '권한이 없습니다.' },
      });
    }

    const { username, password, role } = request.body;
    const db = getDb();
    const now = nowIso();

    // 중복 체크
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'DUPLICATE_USERNAME', message: '이미 존재하는 사용자명입니다.' },
      });
    }

    const id = generateId(ID_PREFIX.USER);
    const passwordHash = await hashPassword(password);

    db.prepare(`
      INSERT INTO users (id, site_id, username, password_hash, role, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(id, DEFAULT_SITE_ID, username, passwordHash, role, now, now);

    // 감사 로그
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'CREATE', 'user', ?, ?, ?)
    `).run(generateId(ID_PREFIX.AUDIT), DEFAULT_SITE_ID, user.id, id, JSON.stringify({ username, role }), now);

    return reply.code(201).send({
      ok: true,
      data: { id, username, role },
      error: null,
    });
  });

  // PUT /api/users/:id - 사용자 수정
  app.put<{
    Params: { id: string };
    Body: {
      username?: string;
      password?: string;
      role?: 'SUPER_ADMIN' | 'OPERATOR' | 'AUDITOR';
      isActive?: boolean;
    };
  }>('/:id', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['User'],
      summary: '사용자 수정',
      description: '사용자 정보를 수정합니다. SUPER_ADMIN만 접근 가능합니다.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 50 },
          password: { type: 'string', minLength: 4 },
          role: { type: 'string', enum: ['SUPER_ADMIN', 'OPERATOR', 'AUDITOR'] },
          isActive: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const currentUser = (request as any).user;
    if (currentUser.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({
        ok: false,
        data: null,
        error: { code: 'FORBIDDEN', message: '권한이 없습니다.' },
      });
    }

    const { id } = request.params;
    const { username, password, role, isActive } = request.body;
    const db = getDb();
    const now = nowIso();

    const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!existingUser) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다.' },
      });
    }

    // 중복 체크 (자기 자신 제외)
    if (username && username !== existingUser.username) {
      const duplicate = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, id);
      if (duplicate) {
        return reply.code(400).send({
          ok: false,
          data: null,
          error: { code: 'DUPLICATE_USERNAME', message: '이미 존재하는 사용자명입니다.' },
        });
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (username !== undefined) {
      updates.push('username = ?');
      values.push(username);
    }
    if (password !== undefined) {
      updates.push('password_hash = ?');
      values.push(await hashPassword(password));
    }
    if (role !== undefined) {
      updates.push('role = ?');
      values.push(role);
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

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    // 감사 로그
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'UPDATE', 'user', ?, ?, ?)
    `).run(
      generateId(ID_PREFIX.AUDIT),
      DEFAULT_SITE_ID,
      currentUser.id,
      id,
      JSON.stringify({ username, role, isActive }),
      now
    );

    return reply.send({
      ok: true,
      data: { id, message: '사용자가 수정되었습니다.' },
      error: null,
    });
  });

  // DELETE /api/users/:id - 사용자 삭제
  app.delete<{
    Params: { id: string };
  }>('/:id', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['User'],
      summary: '사용자 삭제',
      description: '사용자를 삭제합니다. SUPER_ADMIN만 접근 가능합니다.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const currentUser = (request as any).user;
    if (currentUser.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({
        ok: false,
        data: null,
        error: { code: 'FORBIDDEN', message: '권한이 없습니다.' },
      });
    }

    const { id } = request.params;
    const db = getDb();
    const now = nowIso();

    // 자기 자신 삭제 방지
    if (id === currentUser.id) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'CANNOT_DELETE_SELF', message: '자기 자신을 삭제할 수 없습니다.' },
      });
    }

    const existingUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!existingUser) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다.' },
      });
    }

    // 소프트 삭제 (is_active = 0)
    db.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?').run(now, id);

    // 감사 로그
    db.prepare(`
      INSERT INTO audit_logs (id, site_id, user_id, action, entity_type, entity_id, detail_json, created_at)
      VALUES (?, ?, ?, 'DELETE', 'user', ?, ?, ?)
    `).run(
      generateId(ID_PREFIX.AUDIT),
      DEFAULT_SITE_ID,
      currentUser.id,
      id,
      JSON.stringify({ username: existingUser.username }),
      now
    );

    return reply.send({
      ok: true,
      data: { message: '사용자가 삭제되었습니다.' },
      error: null,
    });
  });

  // PUT /api/users/:id/password - 비밀번호 변경 (본인)
  app.put<{
    Params: { id: string };
    Body: { currentPassword: string; newPassword: string };
  }>('/:id/password', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['User'],
      summary: '비밀번호 변경',
      description: '본인의 비밀번호를 변경합니다.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 4 },
        },
      },
    },
  }, async (request, reply) => {
    const currentUser = (request as any).user;
    const { id } = request.params;
    const { currentPassword, newPassword } = request.body;

    // 본인만 변경 가능 (SUPER_ADMIN은 예외)
    if (id !== currentUser.id && currentUser.role !== 'SUPER_ADMIN') {
      return reply.code(403).send({
        ok: false,
        data: null,
        error: { code: 'FORBIDDEN', message: '권한이 없습니다.' },
      });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;

    if (!user) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다.' },
      });
    }

    // 현재 비밀번호 확인 (본인인 경우만)
    if (id === currentUser.id) {
      const isValid = await verifyPassword(currentPassword, user.password_hash);
      if (!isValid) {
        return reply.code(400).send({
          ok: false,
          data: null,
          error: { code: 'INVALID_PASSWORD', message: '현재 비밀번호가 일치하지 않습니다.' },
        });
      }
    }

    const now = nowIso();
    const newHash = await hashPassword(newPassword);

    db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, now, id);

    return reply.send({
      ok: true,
      data: { message: '비밀번호가 변경되었습니다.' },
      error: null,
    });
  });
}
