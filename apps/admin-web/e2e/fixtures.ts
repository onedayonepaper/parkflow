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

// Helper function to login
export async function login(page: any) {
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill(TEST_USER.username);
  await page.getByPlaceholder('••••••••').fill(TEST_USER.password);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page).toHaveURL('/', { timeout: 10000 });
}
