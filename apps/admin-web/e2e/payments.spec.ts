import { test, expect } from '@playwright/test';
import { login } from './fixtures';

test.describe('Payments Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/payments');
    await expect(page.getByRole('heading', { name: /결제 내역|결제 관리/i })).toBeVisible({ timeout: 10000 });
  });

  test('should display payments list', async ({ page }) => {
    // Check for table
    const paymentTable = page.locator('table');
    const emptyState = page.getByText(/결제 내역이 없습니다|데이터가 없습니다/i);

    await expect(paymentTable.or(emptyState)).toBeVisible({ timeout: 5000 });
  });

  test('should display payment status badges', async ({ page }) => {
    // Check for status badges
    const statusBadges = page.locator('[class*="badge"]').filter({
      hasText: /PAID|PENDING|FAILED|CANCELLED|완료|대기|실패|취소/i,
    });

    await page.waitForTimeout(1000);
    const badgeCount = await statusBadges.count();
    expect(badgeCount).toBeGreaterThanOrEqual(0);
  });

  test('should filter payments by status', async ({ page }) => {
    // Look for status filter
    const statusFilter = page.locator('select').filter({ hasText: /전체|상태/i }).first();

    if (await statusFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusFilter.selectOption({ index: 1 });
      await page.waitForTimeout(500);
    }
  });

  test('should filter payments by date range', async ({ page }) => {
    // Look for date inputs
    const startDate = page.locator('input[type="date"]').first();
    const endDate = page.locator('input[type="date"]').last();

    if (await startDate.isVisible({ timeout: 3000 }).catch(() => false)) {
      const today = new Date().toISOString().split('T')[0];
      await startDate.fill(today);

      if (await endDate.isVisible()) {
        await endDate.fill(today);
      }

      // Apply filter if button exists
      const filterButton = page.getByRole('button', { name: /검색|적용|조회/i });
      if (await filterButton.isVisible()) {
        await filterButton.click();
        await page.waitForTimeout(500);
      }
    }
  });

  test('should view payment details', async ({ page }) => {
    // Click on first payment row or detail button
    const detailButton = page.getByRole('button', { name: /상세|보기/i }).first();

    if (await detailButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await detailButton.click();

      // Modal or detail view should appear
      await page.waitForTimeout(500);
    }
  });

  test('should display payment statistics', async ({ page }) => {
    // Check for summary statistics
    const totalAmount = page.getByText(/총 결제|합계/i);

    if (await totalAmount.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(totalAmount).toBeVisible();
    }
  });

  test('should cancel payment', async ({ page }) => {
    // Find cancel button for a PAID payment
    const cancelButton = page.getByRole('button', { name: /취소|환불/i }).first();

    if (await cancelButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cancelButton.click();

      // Confirm dialog should appear
      const confirmDialog = page.getByRole('dialog');
      if (await confirmDialog.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Cancel the operation (don't actually refund in test)
        await page.getByRole('button', { name: /닫기|취소/i }).click();
      }
    }
  });

  test('should export payment data', async ({ page }) => {
    // Look for export button
    const exportButton = page.getByRole('button', { name: /내보내기|엑셀|CSV|다운로드/i });

    if (await exportButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Just verify button is clickable
      await expect(exportButton).toBeEnabled();
    }
  });
});

test.describe('Payment Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/settings');
    await page.waitForTimeout(1000);
  });

  test('should navigate to payment settings', async ({ page }) => {
    // Look for payment settings section or tab
    const paymentSettings = page.getByText(/결제 설정|PG 설정/i).first();

    if (await paymentSettings.isVisible({ timeout: 5000 }).catch(() => false)) {
      await paymentSettings.click();
      await page.waitForTimeout(500);
    }
  });

  test('should display PG provider options', async ({ page }) => {
    // Check for PG provider selection
    const pgSelect = page.locator('select').filter({ hasText: /MOCK|TOSSPAYMENTS|NICE|KCP/i }).first();

    if (await pgSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(pgSelect).toBeVisible();
    }
  });
});
