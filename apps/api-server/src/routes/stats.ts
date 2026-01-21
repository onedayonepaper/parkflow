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

  // GET /api/stats/monthly - 월별 통계
  app.get<{
    Querystring: { months?: string };
  }>('/monthly', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Stats'],
      summary: '월별 통계 조회',
      description: '최근 N개월간 월별 매출, 이용, 평균 주차 시간 통계를 조회합니다.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          months: { type: 'string', description: '조회할 개월 수', default: '6' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const monthsCount = Math.min(12, Math.max(1, parseInt(request.query.months || '6', 10)));

    // N개월 전 첫째 날
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - monthsCount + 1, 1);
    const startStr = startDate.toISOString().slice(0, 10);

    // 월별 매출
    const revenueByMonth = db.prepare(`
      SELECT strftime('%Y-%m', p.approved_at) as month, SUM(p.amount) as revenue
      FROM payments p
      JOIN parking_sessions ps ON p.session_id = ps.id
      WHERE ps.site_id = ? AND p.status = 'PAID'
        AND date(p.approved_at) >= ?
      GROUP BY month
      ORDER BY month
    `).all(DEFAULT_SITE_ID, startStr) as { month: string; revenue: number }[];

    // 월별 세션 수
    const sessionsByMonth = db.prepare(`
      SELECT strftime('%Y-%m', entry_at) as month, COUNT(*) as count
      FROM parking_sessions
      WHERE site_id = ? AND date(entry_at) >= ?
      GROUP BY month
      ORDER BY month
    `).all(DEFAULT_SITE_ID, startStr) as { month: string; count: number }[];

    // 월별 평균 주차 시간
    const avgDurationByMonth = db.prepare(`
      SELECT strftime('%Y-%m', exit_at) as month,
        AVG((julianday(exit_at) - julianday(entry_at)) * 24 * 60) as avg_minutes
      FROM parking_sessions
      WHERE site_id = ? AND exit_at IS NOT NULL AND date(exit_at) >= ?
      GROUP BY month
      ORDER BY month
    `).all(DEFAULT_SITE_ID, startStr) as { month: string; avg_minutes: number }[];

    // N개월 데이터 맵 생성
    const monthlyMap = new Map<string, { revenue: number; sessions: number; avgDuration: number }>();
    for (let i = 0; i < monthsCount; i++) {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + i);
      const monthStr = d.toISOString().slice(0, 7);
      monthlyMap.set(monthStr, { revenue: 0, sessions: 0, avgDuration: 0 });
    }

    revenueByMonth.forEach(({ month, revenue }) => {
      if (monthlyMap.has(month)) {
        monthlyMap.get(month)!.revenue = revenue;
      }
    });

    sessionsByMonth.forEach(({ month, count }) => {
      if (monthlyMap.has(month)) {
        monthlyMap.get(month)!.sessions = count;
      }
    });

    avgDurationByMonth.forEach(({ month, avg_minutes }) => {
      if (monthlyMap.has(month)) {
        monthlyMap.get(month)!.avgDuration = Math.round(avg_minutes || 0);
      }
    });

    const monthly = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      revenue: data.revenue,
      sessions: data.sessions,
      avgDuration: data.avgDuration,
    }));

    return reply.send({
      ok: true,
      data: { monthly },
      error: null,
    });
  });

  // GET /api/stats/report - 상세 리포트
  app.get<{
    Querystring: { from?: string; to?: string };
  }>('/report', {
    preHandler: [app.authenticate],
    schema: {
      tags: ['Stats'],
      summary: '상세 리포트 조회',
      description: '기간별 상세 통계 리포트를 조회합니다.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          from: { type: 'string', description: '시작일 (YYYY-MM-DD)' },
          to: { type: 'string', description: '종료일 (YYYY-MM-DD)' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const defaultTo = now.toISOString().slice(0, 10);

    const from = request.query.from || defaultFrom;
    const to = request.query.to || defaultTo;

    // 총 매출
    const totalRevenue = db.prepare(`
      SELECT COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN parking_sessions ps ON p.session_id = ps.id
      WHERE ps.site_id = ? AND p.status = 'PAID'
        AND date(p.approved_at) >= ? AND date(p.approved_at) <= ?
    `).get(DEFAULT_SITE_ID, from, to) as { total: number };

    // 총 세션 수
    const totalSessions = db.prepare(`
      SELECT COUNT(*) as count FROM parking_sessions
      WHERE site_id = ? AND date(entry_at) >= ? AND date(entry_at) <= ?
    `).get(DEFAULT_SITE_ID, from, to) as { count: number };

    // 결제 방법별 통계
    const paymentMethodStats = db.prepare(`
      SELECT p.method, COUNT(*) as count, SUM(p.amount) as total
      FROM payments p
      JOIN parking_sessions ps ON p.session_id = ps.id
      WHERE ps.site_id = ? AND p.status = 'PAID'
        AND date(p.approved_at) >= ? AND date(p.approved_at) <= ?
      GROUP BY p.method
    `).all(DEFAULT_SITE_ID, from, to) as { method: string; count: number; total: number }[];

    // 일별 매출 추이
    const dailyRevenue = db.prepare(`
      SELECT date(p.approved_at) as date, SUM(p.amount) as revenue, COUNT(*) as payments
      FROM payments p
      JOIN parking_sessions ps ON p.session_id = ps.id
      WHERE ps.site_id = ? AND p.status = 'PAID'
        AND date(p.approved_at) >= ? AND date(p.approved_at) <= ?
      GROUP BY date
      ORDER BY date
    `).all(DEFAULT_SITE_ID, from, to) as { date: string; revenue: number; payments: number }[];

    // 취소 통계 (cancelled_at 컬럼이 없으므로 updated_at 사용)
    const cancelStats = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(p.amount), 0) as total
      FROM payments p
      JOIN parking_sessions ps ON p.session_id = ps.id
      WHERE ps.site_id = ? AND p.status = 'CANCELLED'
        AND date(p.updated_at) >= ? AND date(p.updated_at) <= ?
    `).get(DEFAULT_SITE_ID, from, to) as { count: number; total: number };

    // 평균 통계
    const avgStats = db.prepare(`
      SELECT
        AVG((julianday(exit_at) - julianday(entry_at)) * 24 * 60) as avg_duration,
        AVG(final_fee) as avg_fee
      FROM parking_sessions
      WHERE site_id = ? AND exit_at IS NOT NULL
        AND date(exit_at) >= ? AND date(exit_at) <= ?
    `).get(DEFAULT_SITE_ID, from, to) as { avg_duration: number; avg_fee: number };

    // 정기권 이용 통계
    const membershipStats = db.prepare(`
      SELECT COUNT(*) as count
      FROM parking_sessions ps
      WHERE ps.site_id = ? AND ps.final_fee = 0
        AND date(ps.entry_at) >= ? AND date(ps.entry_at) <= ?
        AND EXISTS (
          SELECT 1 FROM memberships m
          WHERE m.plate_no = ps.plate_no
            AND m.valid_from <= ps.entry_at
            AND m.valid_to >= ps.entry_at
        )
    `).get(DEFAULT_SITE_ID, from, to) as { count: number };

    return reply.send({
      ok: true,
      data: {
        period: { from, to },
        summary: {
          totalRevenue: totalRevenue.total,
          totalSessions: totalSessions.count,
          avgDuration: Math.round(avgStats.avg_duration || 0),
          avgFee: Math.round(avgStats.avg_fee || 0),
          cancelledCount: cancelStats.count,
          cancelledAmount: cancelStats.total,
          membershipUsage: membershipStats.count,
        },
        paymentMethods: paymentMethodStats,
        dailyRevenue,
      },
      error: null,
    });
  });
}
