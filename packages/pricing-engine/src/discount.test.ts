import { describe, it, expect } from 'vitest';
import { applyDiscount, calculateTotalDiscount } from './discount.js';

describe('applyDiscount', () => {
  const baseInput = {
    rawFee: 5000,
    freeMinutesUsed: 30,
    totalParkingMinutes: 90,
  };

  it('AMOUNT: 정액 할인', () => {
    const result = applyDiscount({
      ...baseInput,
      discountRule: {
        id: 'dr_1',
        name: '1000원 할인',
        type: 'AMOUNT',
        value: 1000,
      },
    });

    expect(result.appliedValue).toBe(1000);
    expect(result.type).toBe('AMOUNT');
  });

  it('AMOUNT: 요금보다 큰 할인은 요금까지만', () => {
    const result = applyDiscount({
      ...baseInput,
      rawFee: 500,
      discountRule: {
        id: 'dr_1',
        name: '1000원 할인',
        type: 'AMOUNT',
        value: 1000,
      },
    });

    expect(result.appliedValue).toBe(500);
  });

  it('PERCENT: 정률 할인', () => {
    const result = applyDiscount({
      ...baseInput,
      discountRule: {
        id: 'dr_2',
        name: '50% 할인',
        type: 'PERCENT',
        value: 50,
      },
    });

    expect(result.appliedValue).toBe(2500); // 5000 * 50%
    expect(result.type).toBe('PERCENT');
  });

  it('PERCENT: 100% 초과는 100%로 처리', () => {
    const result = applyDiscount({
      ...baseInput,
      discountRule: {
        id: 'dr_2',
        name: '200% 할인',
        type: 'PERCENT',
        value: 200,
      },
    });

    expect(result.appliedValue).toBe(5000); // 100%만 적용
  });

  it('FREE_MINUTES: 시간 무료', () => {
    const result = applyDiscount({
      ...baseInput,
      discountRule: {
        id: 'dr_3',
        name: '1시간 무료',
        type: 'FREE_MINUTES',
        value: 60,
      },
    });

    // 60분 / (90-30)분 * 5000 = 5000원 (전액)
    expect(result.appliedValue).toBeLessThanOrEqual(baseInput.rawFee);
    expect(result.type).toBe('FREE_MINUTES');
  });

  it('FREE_ALL: 전액 무료', () => {
    const result = applyDiscount({
      ...baseInput,
      discountRule: {
        id: 'dr_4',
        name: '전액 무료',
        type: 'FREE_ALL',
        value: 0,
      },
    });

    expect(result.appliedValue).toBe(5000);
    expect(result.type).toBe('FREE_ALL');
  });

  it('valueOverride로 할인값 재정의', () => {
    const result = applyDiscount({
      ...baseInput,
      discountRule: {
        id: 'dr_1',
        name: '1000원 할인',
        type: 'AMOUNT',
        value: 1000,
      },
      valueOverride: 2000,
    });

    expect(result.appliedValue).toBe(2000);
  });
});

describe('calculateTotalDiscount', () => {
  it('여러 할인 합산', () => {
    const discounts = [
      { ruleId: 'dr_1', ruleName: 'A', type: 'AMOUNT' as const, appliedValue: 1000, description: '' },
      { ruleId: 'dr_2', ruleName: 'B', type: 'PERCENT' as const, appliedValue: 500, description: '' },
    ];

    const result = calculateTotalDiscount(5000, discounts);

    expect(result.discountTotal).toBe(1500);
    expect(result.finalFee).toBe(3500);
  });

  it('할인이 요금을 초과하면 0원', () => {
    const discounts = [
      { ruleId: 'dr_1', ruleName: 'A', type: 'AMOUNT' as const, appliedValue: 3000, description: '' },
      { ruleId: 'dr_2', ruleName: 'B', type: 'AMOUNT' as const, appliedValue: 3000, description: '' },
    ];

    const result = calculateTotalDiscount(5000, discounts);

    expect(result.discountTotal).toBe(6000);
    expect(result.finalFee).toBe(0); // 음수 방지
  });
});
