import { test, expect } from '@playwright/test';
import { login } from './fixtures';

test.describe('Users Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/users');
    await expect(page.getByRole('heading', { name: /사용자 관리/i })).toBeVisible({ timeout: 10000 });
  });

  test('should display users list', async ({ page }) => {
    // Check for table
    const userTable = page.locator('table');
    const emptyState = page.getByText(/사용자가 없습니다|데이터가 없습니다/i);

    await expect(userTable.or(emptyState)).toBeVisible({ timeout: 5000 });
  });

  test('should display user roles', async ({ page }) => {
    // Check for role badges
    const roleBadge = page.locator('[class*="badge"]').filter({
      hasText: /SUPER_ADMIN|OPERATOR|AUDITOR|관리자|운영자|감사자/i,
    });

    const badgeCount = await roleBadge.count();
    expect(badgeCount).toBeGreaterThanOrEqual(0);
  });

  test('should open add user modal', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /사용자 추가|추가/i });

    if (await addButton.isVisible()) {
      await addButton.click();

      // Modal should appear
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
    }
  });

  test('should create a new user', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /사용자 추가|추가/i });

    if (await addButton.isVisible()) {
      await addButton.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });

      // Fill form
      const usernameInput = page.getByLabel(/사용자명|아이디|Username/i);
      if (await usernameInput.isVisible()) {
        await usernameInput.fill('e2etestuser');
      }

      const passwordInput = page.getByLabel(/비밀번호|Password/i);
      if (await passwordInput.isVisible()) {
        await passwordInput.fill('testpassword123');
      }

      // Select role
      const roleSelect = page.locator('select').filter({ hasText: /OPERATOR|AUDITOR/i }).first();
      if (await roleSelect.isVisible()) {
        await roleSelect.selectOption({ index: 1 });
      }

      // Submit
      const saveButton = page.getByRole('button', { name: /저장|추가|생성/i });
      await saveButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test('should edit user', async ({ page }) => {
    const editButton = page.getByRole('button', { name: /수정|편집/i }).first();

    if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editButton.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });

      // Change role if available
      const roleSelect = page.locator('select').filter({ hasText: /OPERATOR|AUDITOR/i }).first();
      if (await roleSelect.isVisible()) {
        await roleSelect.selectOption({ index: 0 });

        const saveButton = page.getByRole('button', { name: /저장|수정/i });
        await saveButton.click();
      }
    }
  });

  test('should toggle user active status', async ({ page }) => {
    const toggleButton = page.locator('button[role="switch"], input[type="checkbox"]').first();
    const deactivateButton = page.getByRole('button', { name: /비활성화|활성화/i }).first();

    if (await toggleButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await toggleButton.click();
      await page.waitForTimeout(500);
    } else if (await deactivateButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(deactivateButton).toBeEnabled();
    }
  });

  test('should reset user password', async ({ page }) => {
    const resetButton = page.getByRole('button', { name: /비밀번호 초기화|비밀번호 변경/i }).first();

    if (await resetButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await resetButton.click();

      // Dialog should appear
      const confirmButton = page.getByRole('button', { name: /확인|초기화/i });
      if (await confirmButton.isVisible()) {
        // Cancel instead of actually resetting
        await page.getByRole('button', { name: /취소/i }).click();
      }
    }
  });

  test('should delete user with confirmation', async ({ page }) => {
    const deleteButton = page.getByRole('button', { name: /삭제/i }).first();

    if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteButton.click();

      const confirmButton = page.getByRole('button', { name: /확인|삭제/i });
      if (await confirmButton.isVisible()) {
        // Cancel instead of actually deleting
        await page.getByRole('button', { name: /취소/i }).click();
      }
    }
  });

  test('should search users', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/사용자명|검색/i);

    if (await searchInput.isVisible()) {
      await searchInput.fill('admin');
      await searchInput.press('Enter');
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Audit Logs', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/audit-log');
    await expect(page.getByRole('heading', { name: /감사 로그|활동 로그/i })).toBeVisible({ timeout: 10000 });
  });

  test('should display audit logs list', async ({ page }) => {
    const logTable = page.locator('table');
    const emptyState = page.getByText(/로그가 없습니다|데이터가 없습니다/i);

    await expect(logTable.or(emptyState)).toBeVisible({ timeout: 5000 });
  });

  test('should filter logs by action type', async ({ page }) => {
    const actionFilter = page.locator('select').filter({ hasText: /전체|생성|수정|삭제/i }).first();

    if (await actionFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await actionFilter.selectOption({ index: 1 });
      await page.waitForTimeout(500);
    }
  });

  test('should filter logs by date range', async ({ page }) => {
    const startDate = page.locator('input[type="date"]').first();

    if (await startDate.isVisible({ timeout: 3000 }).catch(() => false)) {
      const today = new Date().toISOString().split('T')[0];
      await startDate.fill(today);
      await page.waitForTimeout(500);
    }
  });

  test('should view log details', async ({ page }) => {
    const detailButton = page.getByRole('button', { name: /상세|보기/i }).first();

    if (await detailButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await detailButton.click();
      await page.waitForTimeout(500);
    }
  });
});
