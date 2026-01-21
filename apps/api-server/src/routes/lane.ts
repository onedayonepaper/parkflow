import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { generateId, ID_PREFIX, nowIso, DEFAULT_SITE_ID } from '@parkflow/shared';

export async function laneRoutes(app: FastifyInstance) {
  // GET /api/lanes - 차로 목록 조회
  app.get('/', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Lane'],
      summary: '차로 목록 조회',
      description: '등록된 차로 목록을 조회합니다.',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const db = getDb();

    const lanes = db.prepare(`
      SELECT * FROM lanes
      WHERE site_id = ?
      ORDER BY direction, name
    `).all(DEFAULT_SITE_ID) as any[];

    return reply.send({
      ok: true,
      data: {
        items: lanes.map((lane) => ({
          id: lane.id,
          name: lane.name,
          direction: lane.direction,
          createdAt: lane.created_at,
          updatedAt: lane.updated_at,
        })),
      },
      error: null,
    });
  });

  // POST /api/lanes - 차로 생성
  app.post<{
    Body: {
      name: string;
      direction: 'ENTRY' | 'EXIT';
    };
  }>('/', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Lane'],
      summary: '차로 생성',
      description: '새로운 차로를 생성합니다.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'direction'],
        properties: {
          name: { type: 'string', description: '차로 이름' },
          direction: { type: 'string', enum: ['ENTRY', 'EXIT'], description: '방향' },
        },
      },
    },
  }, async (request, reply) => {
    const { name, direction } = request.body;
    const db = getDb();
    const now = nowIso();

    const id = generateId(ID_PREFIX.LANE || 'lane');

    db.prepare(`
      INSERT INTO lanes (id, site_id, name, direction, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, DEFAULT_SITE_ID, name, direction, now, now);

    return reply.code(201).send({
      ok: true,
      data: { id, name, direction },
      error: null,
    });
  });

  // PUT /api/lanes/:id - 차로 수정
  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      direction?: 'ENTRY' | 'EXIT';
    };
  }>('/:id', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Lane'],
      summary: '차로 수정',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { name, direction } = request.body;
    const db = getDb();
    const now = nowIso();

    const existing = db.prepare('SELECT * FROM lanes WHERE id = ?').get(id);
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'NOT_FOUND', message: '차로를 찾을 수 없습니다.' },
      });
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (direction !== undefined) {
      updates.push('direction = ?');
      values.push(direction);
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

    db.prepare(`UPDATE lanes SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return reply.send({
      ok: true,
      data: { message: '차로가 수정되었습니다.' },
      error: null,
    });
  });

  // DELETE /api/lanes/:id - 차로 삭제
  app.delete<{
    Params: { id: string };
  }>('/:id', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Lane'],
      summary: '차로 삭제',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();

    // 연결된 장비가 있는지 확인
    const connectedDevices = db.prepare('SELECT COUNT(*) as count FROM devices WHERE lane_id = ?').get(id) as { count: number };
    if (connectedDevices.count > 0) {
      return reply.code(400).send({
        ok: false,
        data: null,
        error: { code: 'HAS_DEVICES', message: '연결된 장비가 있어 삭제할 수 없습니다.' },
      });
    }

    const result = db.prepare('DELETE FROM lanes WHERE id = ?').run(id);

    if (result.changes === 0) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'NOT_FOUND', message: '차로를 찾을 수 없습니다.' },
      });
    }

    return reply.send({
      ok: true,
      data: { message: '차로가 삭제되었습니다.' },
      error: null,
    });
  });
}
