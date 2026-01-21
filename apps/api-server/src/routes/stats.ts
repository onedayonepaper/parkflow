import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/index.js';
import { DEFAULT_SITE_ID } from '@parkflow/shared';

/**
 * 오늘 날짜의 시작/종료 ISO 문자열 반환
 */
function getTodayRange(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function statsRoutes(app: FastifyInstance) {
  // GET /api/stats/dashboard - 대시보드 통계
  app.get('/dashboard', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Stats'],
      summary: '대시보드 통계 조회',
      description: '대시보드에 표시할 실시간 통계 정보를 조회합니다.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                currentParking: { type: 'number', description: '현재 주차중 대수' },
                exitPending: { type: 'number', description: '출차 대기 대수' },
                todayRevenue: { type: 'number', description: '금일 매출 (원)' },
                todayEntries: { type: 'number', description: '금일 입차 건수' },
                todayExits: { type: 'number', description: '금일 출차 건수' },
                avgDurationMinutes: { type: 'number', description: '평균 주차 시간 (분)' },
              },
            },
            error: { type: 'object', nullable: true },
          },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { start, end } = getTodayRange();

    // 현재 주차중 대수
    const parkingResult = db.prepare(`
      SELECT COUNT(*) as count FROM parking_sessions
      WHERE site_id = ? AND status = 'PARKING'
    `).get(DEFAULT_SITE_ID) as { count: number };

    // 출차 대기 대수
    const exitPendingResult = db.prepare(`
      SELECT COUNT(*) as count FROM parking_sessions
      WHERE site_id = ? AND status = 'EXIT_PENDING'
    `).get(DEFAULT_SITE_ID) as { count: number };

    // 금일 매출 (결제 완료된 금액 합계)
    const revenueResult = db.prepare(`
      SELECT COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN parking_sessions ps ON p.session_id = ps.id
      WHERE ps.site_id = ? AND p.status = 'PAID'
        AND p.approved_at >= ? AND p.approved_at < ?
    `).get(DEFAULT_SITE_ID, start, end) as { total: number };

    // 금일 입차 건수
    const entriesResult = db.prepare(`
      SELECT COUNT(*) as count FROM parking_sessions
      WHERE site_id = ? AND entry_at >= ? AND entry_at < ?
    `).get(DEFAULT_SITE_ID, start, end) as { count: number };

    // 금일 출차 건수
    const exitsResult = db.prepare(`
      SELECT COUNT(*) as count FROM parking_sessions
      WHERE site_id = ? AND exit_at >= ? AND exit_at < ?
    `).get(DEFAULT_SITE_ID, start, end) as { count: number };

    // 금일 평균 주차 시간 (분)
    const avgDurationResult = db.prepare(`
      SELECT AVG(
        (julianday(exit_at) - julianday(entry_at)) * 24 * 60
      ) as avg_minutes
      FROM parking_sessions
      WHERE site_id = ? AND exit_at IS NOT NULL
        AND exit_at >= ? AND exit_at < ?
    `).get(DEFAULT_SITE_ID, start, end) as { avg_minutes: number | null };

    return reply.send({
      ok: true,
      data: {
        currentParking: parkingResult.count,
        exitPending: exitPendingResult.count,
        todayRevenue: revenueResult.total,
        todayEntries: entriesResult.count,
        todayExits: exitsResult.count,
        avgDurationMinutes: Math.round(avgDurationResult.avg_minutes || 0),
      },
      error: null,
    });
  });

  // GET /api/stats/hourly - 시간대별 통계
  app.get('/hourly', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Stats'],
      summary: '시간대별 통계 조회',
      description: '금일 시간대별 입/출차 통계를 조회합니다.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                hourly: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      hour: { type: 'number' },
                      entries: { type: 'number' },
                      exits: { type: 'number' },
                    },
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
    const db = getDb();
    const { start, end } = getTodayRange();

    // 시간대별 입차
    const entriesByHour = db.prepare(`
      SELECT strftime('%H', entry_at) as hour, COUNT(*) as count
      FROM parking_sessions
      WHERE site_id = ? AND entry_at >= ? AND entry_at < ?
      GROUP BY hour
      ORDER BY hour
    `).all(DEFAULT_SITE_ID, start, end) as { hour: string; count: number }[];

    // 시간대별 출차
    const exitsByHour = db.prepare(`
      SELECT strftime('%H', exit_at) as hour, COUNT(*) as count
      FROM parking_sessions
      WHERE site_id = ? AND exit_at >= ? AND exit_at < ?
      GROUP BY hour
      ORDER BY hour
    `).all(DEFAULT_SITE_ID, start, end) as { hour: string; count: number }[];

    // 0-23시 데이터 생성
    const hourlyMap = new Map<number, { entries: number; exits: number }>();
    for (let h = 0; h < 24; h++) {
      hourlyMap.set(h, { entries: 0, exits: 0 });
    }

    entriesByHour.forEach(({ hour, count }) => {
      const h = parseInt(hour, 10);
      const existing = hourlyMap.get(h)!;
      existing.entries = count;
    });

    exitsByHour.forEach(({ hour, count }) => {
      const h = parseInt(hour, 10);
      const existing = hourlyMap.get(h)!;
      existing.exits = count;
    });

    const hourly = Array.from(hourlyMap.entries()).map(([hour, data]) => ({
      hour,
      entries: data.entries,
      exits: data.exits,
    }));

    return reply.send({
      ok: true,
      data: { hourly },
      error: null,
    });
  });

  // GET /api/stats/weekly - 주간 통계
  app.get('/weekly', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Stats'],
      summary: '주간 통계 조회',
      description: '최근 7일간 일별 매출 및 이용 통계를 조회합니다.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                daily: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      date: { type: 'string' },
                      revenue: { type: 'number' },
                      sessions: { type: 'number' },
                    },
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
    const db = getDb();

    // 7일 전 날짜
    const now = new Date();
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
    const weekAgoStr = weekAgo.toISOString().slice(0, 10);

    // 일별 매출
    const revenueByDay = db.prepare(`
      SELECT date(p.approved_at) as day, SUM(p.amount) as revenue
      FROM payments p
      JOIN parking_sessions ps ON p.session_id = ps.id
      WHERE ps.site_id = ? AND p.status = 'PAID'
        AND date(p.approved_at) >= ?
      GROUP BY day
      ORDER BY day
    `).all(DEFAULT_SITE_ID, weekAgoStr) as { day: string; revenue: number }[];

    // 일별 세션 수
    const sessionsByDay = db.prepare(`
      SELECT date(entry_at) as day, COUNT(*) as count
      FROM parking_sessions
      WHERE site_id = ? AND date(entry_at) >= ?
      GROUP BY day
      ORDER BY day
    `).all(DEFAULT_SITE_ID, weekAgoStr) as { day: string; count: number }[];

    // 7일 데이터 생성
    const dailyMap = new Map<string, { revenue: number; sessions: number }>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      dailyMap.set(dateStr, { revenue: 0, sessions: 0 });
    }

    revenueByDay.forEach(({ day, revenue }) => {
      if (dailyMap.has(day)) {
        dailyMap.get(day)!.revenue = revenue;
      }
    });

    sessionsByDay.forEach(({ day, count }) => {
      if (dailyMap.has(day)) {
        dailyMap.get(day)!.sessions = count;
      }
    });

    const daily = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      revenue: data.revenue,
      sessions: data.sessions,
    }));

    return reply.send({
      ok: true,
      data: { daily },
      error: null,
    });
  });
}
