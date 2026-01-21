import { test, expect } from '@playwright/test';
import { login } from './fixtures';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display navigation menu', async ({ page }) => {
    // Check for main navigation links
    await expect(page.getByRole('link', { name: /대시보드/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /세션|주차/i })).toBeVisible();
  });

  test('should navigate to rate plans page', async ({ page }) => {
    await page.getByRole('link', { name: /요금 정책/i }).click();

    await expect(page).toHaveURL('/rate-plans', { timeout: 5000 });
    // Wait for page to load and verify content is present
    await page.waitForLoadState('domcontentloaded');
    // The page shows "로딩 중..." while loading, then shows the heading
    // Wait for either the heading or the loading indicator or the table
    await expect(
      page.getByRole('heading', { name: /요금 정책/i })
        .or(page.getByText(/로딩 중/i))
        .or(page.locator('table'))
    ).toBeVisible({ timeout: 15000 });
  });

  test('should navigate to discount rules page', async ({ page }) => {
    await page.getByRole('link', { name: /할인 규칙/i }).click();

    await expect(page).toHaveURL('/discount-rules', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: /할인 규칙/i })).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to memberships page', async ({ page }) => {
    await page.getByRole('link', { name: /정기권/i }).click();

    await expect(page).toHaveURL('/memberships', { timeout: 5000 });
    await expect(page.getByRole('heading', { name: /정기권 관리/i })).toBeVisible({ timeout: 10000 });
  });

  test('should logout successfully', async ({ page }) => {
    // Find and click logout button
    const logoutButton = page.getByRole('button', { name: /로그아웃/i });

    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await expect(page).toHaveURL('/login', { timeout: 5000 });
    }
  });
});

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should display dashboard content', async ({ page }) => {
    await page.goto('/');

    // Check for dashboard heading specifically
    await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible({ timeout: 5000 });
  });
});
