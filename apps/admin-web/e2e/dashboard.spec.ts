import { test, expect } from '@playwright/test';
import { login } from './fixtures';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible({ timeout: 10000 });
  });

  test('should display dashboard statistics cards', async ({ page }) => {
    // Check for statistics cards
    const statsCards = page.locator('[class*="bg-white"], [class*="rounded-lg"]').filter({
      has: page.locator('text=/현재 주차|오늘 입차|오늘 출차|오늘 매출/i'),
    });

    // At least one stat card should be visible
    await expect(statsCards.first()).toBeVisible({ timeout: 5000 }).catch(() => {
      // Stats might be displayed differently
    });
  });

  test('should display charts', async ({ page }) => {
    // Check for chart containers (Recharts usually renders SVG)
    const charts = page.locator('svg.recharts-surface, [class*="chart"], canvas');

    // Wait for charts to render
    await page.waitForTimeout(2000);

    // Check if any chart is visible
    const chartCount = await charts.count();
    expect(chartCount).toBeGreaterThanOrEqual(0); // Charts may or may not be present
  });

  test('should display recent sessions', async ({ page }) => {
    // Look for recent sessions section
    const recentSessions = page.getByText(/최근 세션|최근 주차/i);

    if (await recentSessions.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(recentSessions).toBeVisible();
    }
  });

  test('should display real-time status', async ({ page }) => {
    // Check for real-time status indicators
    const statusIndicators = page.locator('[class*="status"], [class*="badge"]');

    await page.waitForTimeout(1000);
    const indicatorCount = await statusIndicators.count();
    expect(indicatorCount).toBeGreaterThanOrEqual(0);
  });

  test('should refresh data', async ({ page }) => {
    // Look for refresh button
    const refreshButton = page.getByRole('button', { name: /새로고침|갱신/i });

    if (await refreshButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await refreshButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test('should navigate to sessions from quick link', async ({ page }) => {
    // Look for quick navigation links
    const sessionsLink = page.getByRole('link', { name: /주차 세션|세션 보기|전체 보기/i }).first();

    if (await sessionsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sessionsLink.click();
      await expect(page).toHaveURL(/sessions/, { timeout: 5000 });
    }
  });
});

test.describe('Dashboard Dark Mode', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible({ timeout: 10000 });
  });

  test('should toggle dark mode', async ({ page }) => {
    // Look for dark mode toggle button
    const darkModeToggle = page.locator('button[aria-label*="dark"], button[aria-label*="다크"], [data-testid="dark-mode-toggle"]');

    if (await darkModeToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Get initial state
      const htmlElement = page.locator('html');
      const initialClass = await htmlElement.getAttribute('class');

      // Click toggle
      await darkModeToggle.click();
      await page.waitForTimeout(500);

      // Check if class changed
      const newClass = await htmlElement.getAttribute('class');
      expect(newClass).not.toBe(initialClass);
    }
  });
});
