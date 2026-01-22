/**
 * Metrics Service
 *
 * Prometheus 호환 메트릭 수집 서비스
 * - HTTP 요청 메트릭 (요청 수, 응답 시간, 에러율)
 * - 비즈니스 메트릭 (세션, 결제, 매출)
 * - 시스템 메트릭 (메모리, CPU, DB 크기)
 */

import { getDb } from '../db/index.js';

// ============================================================================
// Types
// ============================================================================

interface HttpMetric {
  method: string;
  path: string;
  statusCode: number;
  duration: number;
  timestamp: number;
}

interface CounterMetric {
  name: string;
  value: number;
  labels: Record<string, string>;
}

interface GaugeMetric {
  name: string;
  value: number;
  labels: Record<string, string>;
}

interface HistogramBucket {
  le: number;
  count: number;
}

interface HistogramMetric {
  name: string;
  sum: number;
  count: number;
  buckets: HistogramBucket[];
  labels: Record<string, string>;
}

// ============================================================================
// Metrics Collector
// ============================================================================

class MetricsCollector {
  private httpRequests: HttpMetric[] = [];
  private counters: Map<string, CounterMetric> = new Map();
  private gauges: Map<string, GaugeMetric> = new Map();
  private histogramBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
  private maxHttpMetrics = 10000; // 메모리 제한

  // 서버 시작 시간
  private startTime = Date.now();

  /**
   * HTTP 요청 기록
   */
  recordHttpRequest(method: string, path: string, statusCode: number, duration: number): void {
    // 경로 정규화 (동적 파라미터 제거)
    const normalizedPath = this.normalizePath(path);

    this.httpRequests.push({
      method,
      path: normalizedPath,
      statusCode,
      duration,
      timestamp: Date.now(),
    });

    // 메모리 제한
    if (this.httpRequests.length > this.maxHttpMetrics) {
      this.httpRequests = this.httpRequests.slice(-this.maxHttpMetrics / 2);
    }
  }

  /**
   * 카운터 증가
   */
  incrementCounter(name: string, labels: Record<string, string> = {}, value = 1): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.counters.get(key);
    if (existing) {
      existing.value += value;
    } else {
      this.counters.set(key, { name, value, labels });
    }
  }

  /**
   * 게이지 설정
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.getMetricKey(name, labels);
    this.gauges.set(key, { name, value, labels });
  }

  /**
   * Prometheus 형식 출력
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];
    const now = Date.now();

    // ========================================================================
    // HTTP 메트릭
    // ========================================================================

    // 최근 5분 데이터만 사용
    const recentRequests = this.httpRequests.filter(r => now - r.timestamp < 5 * 60 * 1000);

    // http_requests_total
    lines.push('# HELP http_requests_total Total number of HTTP requests');
    lines.push('# TYPE http_requests_total counter');
    const requestCounts = this.aggregateHttpRequests(recentRequests);
    for (const [key, count] of requestCounts) {
      const [method, path, status] = key.split('|');
      lines.push(`http_requests_total{method="${method}",path="${path}",status="${status}"} ${count}`);
    }

    // http_request_duration_seconds
    lines.push('');
    lines.push('# HELP http_request_duration_seconds HTTP request duration in seconds');
    lines.push('# TYPE http_request_duration_seconds histogram');
    const durationHistograms = this.calculateHttpHistograms(recentRequests);
    for (const [key, histogram] of durationHistograms) {
      const [method, path] = key.split('|');
      for (const bucket of histogram.buckets) {
        lines.push(`http_request_duration_seconds_bucket{method="${method}",path="${path}",le="${bucket.le}"} ${bucket.count}`);
      }
      lines.push(`http_request_duration_seconds_bucket{method="${method}",path="${path}",le="+Inf"} ${histogram.count}`);
      lines.push(`http_request_duration_seconds_sum{method="${method}",path="${path}"} ${histogram.sum.toFixed(6)}`);
      lines.push(`http_request_duration_seconds_count{method="${method}",path="${path}"} ${histogram.count}`);
    }

    // ========================================================================
    // 커스텀 카운터
    // ========================================================================

    if (this.counters.size > 0) {
      lines.push('');
      const countersByName = this.groupByName(this.counters);
      for (const [name, metrics] of countersByName) {
        lines.push(`# HELP ${name} Custom counter metric`);
        lines.push(`# TYPE ${name} counter`);
        for (const metric of metrics) {
          const labels = this.formatLabels(metric.labels);
          lines.push(`${name}${labels} ${metric.value}`);
        }
      }
    }

    // ========================================================================
    // 게이지
    // ========================================================================

    if (this.gauges.size > 0) {
      lines.push('');
      const gaugesByName = this.groupByName(this.gauges);
      for (const [name, metrics] of gaugesByName) {
        lines.push(`# HELP ${name} Custom gauge metric`);
        lines.push(`# TYPE ${name} gauge`);
        for (const metric of metrics) {
          const labels = this.formatLabels(metric.labels);
          lines.push(`${name}${labels} ${metric.value}`);
        }
      }
    }

    // ========================================================================
    // 시스템 메트릭
    // ========================================================================

    lines.push('');
    lines.push('# HELP process_uptime_seconds Process uptime in seconds');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${((now - this.startTime) / 1000).toFixed(0)}`);

    const memUsage = process.memoryUsage();
    lines.push('');
    lines.push('# HELP process_heap_bytes Process heap memory in bytes');
    lines.push('# TYPE process_heap_bytes gauge');
    lines.push(`process_heap_bytes{type="used"} ${memUsage.heapUsed}`);
    lines.push(`process_heap_bytes{type="total"} ${memUsage.heapTotal}`);

    lines.push('');
    lines.push('# HELP process_rss_bytes Process RSS memory in bytes');
    lines.push('# TYPE process_rss_bytes gauge');
    lines.push(`process_rss_bytes ${memUsage.rss}`);

    // ========================================================================
    // 비즈니스 메트릭
    // ========================================================================

    try {
      const businessMetrics = this.collectBusinessMetrics();

      lines.push('');
      lines.push('# HELP parkflow_sessions_total Total parking sessions by status');
      lines.push('# TYPE parkflow_sessions_total gauge');
      for (const [status, count] of Object.entries(businessMetrics.sessions)) {
        lines.push(`parkflow_sessions_total{status="${status}"} ${count}`);
      }

      lines.push('');
      lines.push('# HELP parkflow_payments_total Total payments by status');
      lines.push('# TYPE parkflow_payments_total gauge');
      for (const [status, count] of Object.entries(businessMetrics.payments)) {
        lines.push(`parkflow_payments_total{status="${status}"} ${count}`);
      }

      lines.push('');
      lines.push('# HELP parkflow_revenue_total Total revenue in KRW');
      lines.push('# TYPE parkflow_revenue_total gauge');
      lines.push(`parkflow_revenue_total ${businessMetrics.totalRevenue}`);

      lines.push('');
      lines.push('# HELP parkflow_active_memberships Total active memberships');
      lines.push('# TYPE parkflow_active_memberships gauge');
      lines.push(`parkflow_active_memberships ${businessMetrics.activeMemberships}`);

      lines.push('');
      lines.push('# HELP parkflow_database_size_bytes Database file size in bytes');
      lines.push('# TYPE parkflow_database_size_bytes gauge');
      lines.push(`parkflow_database_size_bytes ${businessMetrics.dbSize}`);

    } catch (err) {
      // 비즈니스 메트릭 수집 실패 시 무시
    }

    return lines.join('\n');
  }

  /**
   * JSON 형식 메트릭 (대시보드용)
   */
  getJsonMetrics(): object {
    const now = Date.now();
    const recentRequests = this.httpRequests.filter(r => now - r.timestamp < 5 * 60 * 1000);

    // 요청 통계
    const totalRequests = recentRequests.length;
    const errorRequests = recentRequests.filter(r => r.statusCode >= 400).length;
    const avgDuration = totalRequests > 0
      ? recentRequests.reduce((sum, r) => sum + r.duration, 0) / totalRequests
      : 0;

    // P95, P99 계산
    const sortedDurations = recentRequests.map(r => r.duration).sort((a, b) => a - b);
    const p95 = sortedDurations[Math.floor(sortedDurations.length * 0.95)] || 0;
    const p99 = sortedDurations[Math.floor(sortedDurations.length * 0.99)] || 0;

    // 메모리
    const memUsage = process.memoryUsage();

    // 비즈니스 메트릭
    let businessMetrics = {};
    try {
      businessMetrics = this.collectBusinessMetrics();
    } catch (err) {
      // 무시
    }

    return {
      timestamp: new Date().toISOString(),
      uptime: Math.floor((now - this.startTime) / 1000),
      http: {
        requestsPerMinute: totalRequests / 5, // 5분 평균
        errorRate: totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0,
        avgResponseTime: avgDuration,
        p95ResponseTime: p95,
        p99ResponseTime: p99,
      },
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        rss: memUsage.rss,
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
      },
      business: businessMetrics,
    };
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private normalizePath(path: string): string {
    // API 경로 정규화 (동적 파라미터 -> :id)
    const normalized = path
      .replace(/\/[a-f0-9-]{36}/gi, '/:id') // UUID
      .replace(/\/\d+/g, '/:id') // 숫자 ID
      .replace(/\/sess_[a-z0-9]+/gi, '/:id') // 세션 ID
      .replace(/\/pay_[a-z0-9]+/gi, '/:id') // 결제 ID
      .replace(/\/mem_[a-z0-9]+/gi, '/:id') // 멤버십 ID
      .replace(/\/rp_[a-z0-9]+/gi, '/:id') // 요금제 ID
      .replace(/\/dr_[a-z0-9]+/gi, '/:id') // 할인규칙 ID
      .split('?')[0]; // 쿼리스트링 제거
    return normalized ?? path;
  }

  private getMetricKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return '';
    return '{' + entries.map(([k, v]) => `${k}="${v}"`).join(',') + '}';
  }

  private aggregateHttpRequests(requests: HttpMetric[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const req of requests) {
      const key = `${req.method}|${req.path}|${req.statusCode}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
  }

  private calculateHttpHistograms(requests: HttpMetric[]): Map<string, { sum: number; count: number; buckets: HistogramBucket[] }> {
    const histograms = new Map<string, { sum: number; count: number; buckets: HistogramBucket[] }>();

    for (const req of requests) {
      const key = `${req.method}|${req.path}`;
      let histogram = histograms.get(key);
      if (!histogram) {
        histogram = {
          sum: 0,
          count: 0,
          buckets: this.histogramBuckets.map(le => ({ le, count: 0 })),
        };
        histograms.set(key, histogram);
      }

      const durationSec = req.duration / 1000;
      histogram.sum += durationSec;
      histogram.count += 1;

      for (const bucket of histogram.buckets) {
        if (durationSec <= bucket.le) {
          bucket.count += 1;
        }
      }
    }

    return histograms;
  }

  private groupByName<T extends { name: string }>(metrics: Map<string, T>): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    for (const metric of metrics.values()) {
      const existing = groups.get(metric.name);
      if (existing) {
        existing.push(metric);
      } else {
        groups.set(metric.name, [metric]);
      }
    }
    return groups;
  }

  private collectBusinessMetrics(): {
    sessions: Record<string, number>;
    payments: Record<string, number>;
    totalRevenue: number;
    activeMemberships: number;
    dbSize: number;
  } {
    const db = getDb();

    // 세션 통계
    const sessionStats = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM parking_sessions
      GROUP BY status
    `).all() as { status: string; count: number }[];

    const sessions: Record<string, number> = {};
    for (const row of sessionStats) {
      sessions[row.status] = row.count;
    }

    // 결제 통계
    const paymentStats = db.prepare(`
      SELECT status, COUNT(*) as count
      FROM payments
      GROUP BY status
    `).all() as { status: string; count: number }[];

    const payments: Record<string, number> = {};
    for (const row of paymentStats) {
      payments[row.status] = row.count;
    }

    // 총 매출
    const revenueResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM payments
      WHERE status = 'APPROVED'
    `).get() as { total: number };

    // 활성 정기권
    const membershipResult = db.prepare(`
      SELECT COUNT(*) as count
      FROM memberships
      WHERE status = 'ACTIVE' AND end_date >= date('now')
    `).get() as { count: number };

    // DB 크기
    const dbSizeResult = db.prepare(`
      SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()
    `).get() as { size: number };

    return {
      sessions,
      payments,
      totalRevenue: revenueResult.total,
      activeMemberships: membershipResult.count,
      dbSize: dbSizeResult?.size || 0,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let metricsInstance: MetricsCollector | null = null;

export function getMetrics(): MetricsCollector {
  if (!metricsInstance) {
    metricsInstance = new MetricsCollector();
  }
  return metricsInstance;
}

export function recordHttpMetric(method: string, path: string, statusCode: number, duration: number): void {
  getMetrics().recordHttpRequest(method, path, statusCode, duration);
}

export function incrementCounter(name: string, labels?: Record<string, string>, value?: number): void {
  getMetrics().incrementCounter(name, labels, value);
}

export function setGauge(name: string, value: number, labels?: Record<string, string>): void {
  getMetrics().setGauge(name, value, labels);
}
