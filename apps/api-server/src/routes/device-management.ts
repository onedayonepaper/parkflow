import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { generateId, ID_PREFIX, nowIso, DEFAULT_SITE_ID } from '@parkflow/shared';

export async function deviceManagementRoutes(app: FastifyInstance) {
  // GET /api/devices - 장비 목록 조회
  app.get('/', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['DeviceManagement'],
      summary: '장비 목록 조회',
      description: '등록된 장비 목록을 조회합니다.',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const db = getDb();

    const devices = db.prepare(`
      SELECT d.*, l.name as lane_name, l.direction
      FROM devices d
      LEFT JOIN lanes l ON d.lane_id = l.id
      WHERE d.site_id = ?
      ORDER BY d.type, d.name
    `).all(DEFAULT_SITE_ID) as any[];

    return reply.send({
      ok: true,
      data: {
        items: devices.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          status: d.status,
          laneId: d.lane_id,
          laneName: d.lane_name,
          direction: d.direction,
          lastSeenAt: d.last_seen_at,
          configJson: d.config_json ? JSON.parse(d.config_json) : null,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        })),
      },
      error: null,
    });
  });

  // POST /api/devices - 장비 생성
  app.post<{
    Body: {
      name: string;
      type: 'LPR' | 'BARRIER' | 'KIOSK';
      laneId?: string | null;
      configJson?: Record<string, any>;
    };
  }>('/', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['DeviceManagement'],
      summary: '장비 등록',
      description: '새로운 장비를 등록합니다.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'type'],
        properties: {
          name: { type: 'string', description: '장비 이름' },
          type: { type: 'string', enum: ['LPR', 'BARRIER', 'KIOSK'], description: '장비 유형' },
          laneId: { type: 'string', nullable: true, description: '연결 차로 ID' },
          configJson: { type: 'object', description: '장비 설정 (JSON)' },
        },
      },
    },
  }, async (request, reply) => {
    const { name, type, laneId, configJson } = request.body;
    const db = getDb();
    const now = nowIso();

    // 차로 존재 확인
    if (laneId) {
      const lane = db.prepare('SELECT id FROM lanes WHERE id = ?').get(laneId);
      if (!lane) {
        return reply.code(400).send({
          ok: false,
          data: null,
          error: { code: 'INVALID_LANE', message: '존재하지 않는 차로입니다.' },
        });
      }
    }

    const id = generateId(ID_PREFIX.DEVICE || 'dev');

    db.prepare(`
      INSERT INTO devices (id, site_id, lane_id, type, name, status, config_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'UNKNOWN', ?, ?, ?)
    `).run(
      id,
      DEFAULT_SITE_ID,
      laneId || null,
      type,
      name,
      configJson ? JSON.stringify(configJson) : null,
      now,
      now
    );

    return reply.code(201).send({
      ok: true,
      data: { id, name, type },
      error: null,
    });
  });

  // PUT /api/devices/:id - 장비 수정
  app.put<{
    Params: { id: string };
    Body: {
      name?: string;
      laneId?: string | null;
      configJson?: Record<string, any>;
    };
  }>('/:id', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['DeviceManagement'],
      summary: '장비 수정',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const { name, laneId, configJson } = request.body;
    const db = getDb();
    const now = nowIso();

    const existing = db.prepare('SELECT * FROM devices WHERE id = ?').get(id);
    if (!existing) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'NOT_FOUND', message: '장비를 찾을 수 없습니다.' },
      });
    }

    // 차로 존재 확인
    if (laneId) {
      const lane = db.prepare('SELECT id FROM lanes WHERE id = ?').get(laneId);
      if (!lane) {
        return reply.code(400).send({
          ok: false,
          data: null,
          error: { code: 'INVALID_LANE', message: '존재하지 않는 차로입니다.' },
        });
      }
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (laneId !== undefined) {
      updates.push('lane_id = ?');
      values.push(laneId || null);
    }
    if (configJson !== undefined) {
      updates.push('config_json = ?');
      values.push(JSON.stringify(configJson));
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

    db.prepare(`UPDATE devices SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    return reply.send({
      ok: true,
      data: { message: '장비가 수정되었습니다.' },
      error: null,
    });
  });

  // DELETE /api/devices/:id - 장비 삭제
  app.delete<{
    Params: { id: string };
  }>('/:id', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['DeviceManagement'],
      summary: '장비 삭제',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const db = getDb();

    const result = db.prepare('DELETE FROM devices WHERE id = ?').run(id);

    if (result.changes === 0) {
      return reply.code(404).send({
        ok: false,
        data: null,
        error: { code: 'NOT_FOUND', message: '장비를 찾을 수 없습니다.' },
      });
    }

    return reply.send({
      ok: true,
      data: { message: '장비가 삭제되었습니다.' },
      error: null,
    });
  });
}
