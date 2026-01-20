import { describe, it, expect } from 'vitest';
import { calculateFee } from './calculator.js';
import type { RateRules } from '@parkflow/shared';

const defaultRules: RateRules = {
  freeMinutes: 30,
  baseMinutes: 30,
  baseFee: 1000,
  additionalMinutes: 10,
  additionalFee: 500,
  dailyMax: 15000,
  graceMinutes: 15,
};

const ratePlan = {
  id: 'test_rp',
  name: 'Test Rate Plan',
  rules: defaultRules,
};

describe('calculateFee', () => {
  it('무료 시간 내 출차 시 0원', () => {
    const result = calculateFee({
      entryAt: '2026-01-20T10:00:00+09:00',
      exitAt: '2026-01-20T10:25:00+09:00', // 25분
      ratePlan,
    });

    expect(result.parkingMinutes).toBe(25);
    expect(result.rawFee).toBe(0);
    expect(result.chargeableMinutes).toBe(0);
  });

  it('무료 시간 정확히 30분 출차 시 0원', () => {
    const result = calculateFee({
      entryAt: '2026-01-20T10:00:00+09:00',
      exitAt: '2026-01-20T10:30:00+09:00', // 30분
      ratePlan,
    });

    expect(result.parkingMinutes).toBe(30);
    expect(result.rawFee).toBe(0);
  });

  it('무료 시간 초과 시 기본 요금 적용', () => {
    const result = calculateFee({
      entryAt: '2026-01-20T10:00:00+09:00',
      exitAt: '2026-01-20T10:31:00+09:00', // 31분
      ratePlan,
    });

    expect(result.parkingMinutes).toBe(31);
    expect(result.chargeableMinutes).toBe(1);
    expect(result.baseFee).toBe(1000);
    expect(result.rawFee).toBe(1000);
  });

  it('기본 시간 내 요금', () => {
    const result = calculateFee({
      entryAt: '2026-01-20T10:00:00+09:00',
      exitAt: '2026-01-20T11:00:00+09:00', // 60분 (무료30 + 기본30)
      ratePlan,
    });

    expect(result.parkingMinutes).toBe(60);
    expect(result.chargeableMinutes).toBe(30);
    expect(result.rawFee).toBe(1000); // 기본요금만
  });

  it('추가 시간 요금 (올림 처리)', () => {
    const result = calculateFee({
      entryAt: '2026-01-20T10:00:00+09:00',
      exitAt: '2026-01-20T11:05:00+09:00', // 65분 (무료30 + 기본30 + 추가5)
      ratePlan,
    });

    expect(result.parkingMinutes).toBe(65);
    expect(result.chargeableMinutes).toBe(35);
    expect(result.additionalMinutes).toBe(10); // 5분이지만 10분 단위 올림
    expect(result.additionalFee).toBe(500);
    expect(result.rawFee).toBe(1500); // 기본1000 + 추가500
  });

  it('추가 시간 여러 단위', () => {
    const result = calculateFee({
      entryAt: '2026-01-20T10:00:00+09:00',
      exitAt: '2026-01-20T11:30:00+09:00', // 90분 (무료30 + 기본30 + 추가30)
      ratePlan,
    });

    expect(result.parkingMinutes).toBe(90);
    expect(result.chargeableMinutes).toBe(60);
    expect(result.additionalMinutes).toBe(30); // 30분 = 3단위
    expect(result.additionalFee).toBe(1500); // 3 * 500
    expect(result.rawFee).toBe(2500); // 1000 + 1500
  });

  it('일 최대 요금 캡 적용', () => {
    const result = calculateFee({
      entryAt: '2026-01-20T10:00:00+09:00',
      exitAt: '2026-01-20T20:00:00+09:00', // 10시간 = 600분
      ratePlan,
    });

    expect(result.parkingMinutes).toBe(600);
    expect(result.dailyMaxApplied).toBe(true);
    expect(result.rawFee).toBe(15000); // 일 최대
  });

  it('음수 시간 처리 (비정상 케이스)', () => {
    const result = calculateFee({
      entryAt: '2026-01-20T11:00:00+09:00',
      exitAt: '2026-01-20T10:00:00+09:00', // 출차가 입차보다 빠름
      ratePlan,
    });

    expect(result.parkingMinutes).toBe(0);
    expect(result.rawFee).toBe(0);
  });
});
