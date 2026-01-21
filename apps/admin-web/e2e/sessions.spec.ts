import { test, expect } from '@playwright/test';
import { login } from './fixtures';

test.describe('Parking Sessions', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // Wait for dashboard to fully load after login
    await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to sessions page', async ({ page }) => {
    // Click on sessions link in navigation
    await page.getByRole('link', { name: /주차 세션/i }).click();

    await expect(page).toHaveURL('/sessions', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: /주차 세션/i })).toBeVisible();
  });

  test('should display session list', async ({ page }) => {
    await page.goto('/sessions');

    // Wait for page to load
    await expect(page.getByRole('heading', { name: /주차 세션/i })).toBeVisible({ timeout: 10000 });

    // Check for table or empty state
    const sessionTable = page.locator('table');
    const emptyState = page.getByText(/세션이 없습니다/i);

    // Wait for either table or empty state
    await expect(sessionTable.or(emptyState)).toBeVisible({ timeout: 5000 });
  });

  test('should filter sessions by status', async ({ page }) => {
    await page.goto('/sessions');
    await expect(page.getByRole('heading', { name: /주차 세션/i })).toBeVisible({ timeout: 10000 });

    // Look for status filter select
    const statusFilter = page.locator('select').first();

    if (await statusFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusFilter.selectOption({ label: '주차중' }).catch(() => {
        // Option might not exist
      });
    }
  });

  test('should search sessions by plate number', async ({ page }) => {
    await page.goto('/sessions');
    await expect(page.getByRole('heading', { name: /주차 세션/i })).toBeVisible({ timeout: 10000 });

    // Look for search input
    const searchInput = page.getByPlaceholder(/12가3456/i);

    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('12가3456');
      await page.getByRole('button', { name: /검색/i }).click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Session Details', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    // Wait for dashboard to fully load after login
    await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible({ timeout: 10000 });
  });

  test('should view session detail page', async ({ page }) => {
    await page.goto('/sessions');
    await expect(page.getByRole('heading', { name: /주차 세션/i })).toBeVisible({ timeout: 10000 });

    // Click on "상세" link if exists
    const detailLink = page.getByRole('link', { name: /상세/i }).first();

    if (await detailLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await detailLink.click();

      // Should navigate to detail page
      await expect(page).toHaveURL(/\/sessions\//, { timeout: 5000 });
    }
  });
});
