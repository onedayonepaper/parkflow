import { test as base, expect } from '@playwright/test';

// Test credentials
export const TEST_USER = {
  username: 'admin',
  password: 'admin123',
};

// Extended test with authenticated state
export const test = base.extend<{ authenticatedPage: typeof base }>({
  authenticatedPage: async ({ page }, use) => {
    // Login before test
    await page.goto('/login');
    await page.getByPlaceholder('admin').fill(TEST_USER.username);
    await page.getByPlaceholder('••••••••').fill(TEST_USER.password);
    await page.getByRole('button', { name: '로그인' }).click();

    // Wait for redirect to dashboard
    await expect(page).toHaveURL('/', { timeout: 10000 });

    await use(base);
  },
});

export { expect };

// Helper function to login with retry
export async function login(page: any, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      await page.getByPlaceholder('admin').fill(TEST_USER.username);
      await page.getByPlaceholder('••••••••').fill(TEST_USER.password);
      await page.getByRole('button', { name: '로그인' }).click();

      // Wait for successful navigation to dashboard
      await expect(page).toHaveURL('/', { timeout: 15000 });
      return; // Success
    } catch (error) {
      if (attempt === retries) throw error;
      // Wait before retry
      await page.waitForTimeout(1000);
    }
  }
}
