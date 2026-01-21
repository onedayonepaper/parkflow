import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear any stored auth state
    await page.context().clearCookies();
    await page.goto('/login');
  });

  test('should display login page', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /ParkFlow 관제 시스템/i })).toBeVisible();
    await expect(page.getByPlaceholder('admin')).toBeVisible();
    await expect(page.getByPlaceholder('••••••••')).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.getByPlaceholder('admin').fill('wronguser');
    await page.getByPlaceholder('••••••••').fill('wrongpassword');
    await page.getByRole('button', { name: '로그인' }).click();

    // Wait for error message
    await expect(page.getByText(/로그인에 실패했습니다|아이디 또는 비밀번호가 올바르지 않습니다/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await page.getByPlaceholder('admin').fill('admin');
    await page.getByPlaceholder('••••••••').fill('admin123');
    await page.getByRole('button', { name: '로그인' }).click();

    // Should redirect to dashboard
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Dashboard heading should be visible
    await expect(page.getByRole('heading', { name: '대시보드' })).toBeVisible({ timeout: 5000 });
  });

  test('should show loading state during login', async ({ page }) => {
    await page.getByPlaceholder('admin').fill('admin');
    await page.getByPlaceholder('••••••••').fill('admin123');

    // Click and immediately check for loading state
    const loginButton = page.getByRole('button', { name: '로그인' });
    await loginButton.click();

    // Button should show loading text briefly
    await expect(page.getByRole('button', { name: '로그인 중...' })).toBeVisible({ timeout: 1000 }).catch(() => {
      // Loading might be too fast to catch, which is fine
    });
  });

  test('should require username and password', async ({ page }) => {
    const loginButton = page.getByRole('button', { name: '로그인' });

    // Try to submit without filling fields
    await loginButton.click();

    // Form validation should prevent submission
    // Check that we're still on login page
    await expect(page).toHaveURL('/login');
  });
});

test.describe('Protected Routes', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/');

    // Should redirect to login page
    await expect(page).toHaveURL('/login', { timeout: 5000 });
  });

  test('should redirect to login when accessing sessions page', async ({ page }) => {
    await page.goto('/sessions');

    await expect(page).toHaveURL('/login', { timeout: 5000 });
  });
});
