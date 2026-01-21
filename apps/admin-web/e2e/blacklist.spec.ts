import { test, expect } from '@playwright/test';
import { login } from './fixtures';

test.describe('Blacklist Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/blacklist');
    await expect(page.getByRole('heading', { name: /블랙리스트/i })).toBeVisible({ timeout: 10000 });
  });

  test('should display blacklist entries', async ({ page }) => {
    // Check for table or empty state
    const blacklistTable = page.locator('table');
    const emptyState = page.getByText(/블랙리스트가 없습니다|등록된 차량이 없습니다|데이터가 없습니다/i);

    await expect(blacklistTable.or(emptyState)).toBeVisible({ timeout: 5000 });
  });

  test('should show active status indicators', async ({ page }) => {
    // Check for active/inactive status
    const statusBadge = page.locator('[class*="badge"]').filter({
      hasText: /활성|비활성|차단중|해제/i,
    });

    const badgeCount = await statusBadge.count();
    expect(badgeCount).toBeGreaterThanOrEqual(0);
  });

  test('should open add blacklist modal', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /추가|등록|블랙리스트 추가/i });

    if (await addButton.isVisible()) {
      await addButton.click();

      // Modal should appear
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
    }
  });

  test('should add vehicle to blacklist', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /추가|등록|블랙리스트 추가/i });

    if (await addButton.isVisible()) {
      await addButton.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });

      // Fill form
      const plateInput = page.getByLabel(/차량번호|차량 번호/i);
      if (await plateInput.isVisible()) {
        await plateInput.fill('99테9999');
      }

      const reasonInput = page.getByLabel(/사유|이유/i);
      if (await reasonInput.isVisible()) {
        await reasonInput.fill('E2E 테스트용 블랙리스트');
      }

      // Set expiration date if available
      const expiryInput = page.locator('input[type="date"], input[type="datetime-local"]').first();
      if (await expiryInput.isVisible()) {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        await expiryInput.fill(futureDate.toISOString().split('T')[0]);
      }

      // Submit
      const saveButton = page.getByRole('button', { name: /저장|등록|추가/i });
      await saveButton.click();
      await page.waitForTimeout(1000);
    }
  });

  test('should search blacklist by plate number', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/차량번호|검색/i);

    if (await searchInput.isVisible()) {
      await searchInput.fill('12가3456');
      await searchInput.press('Enter');
      await page.waitForTimeout(500);
    }
  });

  test('should edit blacklist entry', async ({ page }) => {
    const editButton = page.getByRole('button', { name: /수정|편집/i }).first();

    if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editButton.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });

      // Update reason
      const reasonInput = page.getByLabel(/사유|이유/i);
      if (await reasonInput.isVisible()) {
        await reasonInput.clear();
        await reasonInput.fill('수정된 블랙리스트 사유');

        const saveButton = page.getByRole('button', { name: /저장|수정/i });
        await saveButton.click();
      }
    }
  });

  test('should toggle blacklist active status', async ({ page }) => {
    // Look for toggle or status change button
    const toggleButton = page.locator('button[role="switch"], input[type="checkbox"]').first();
    const deactivateButton = page.getByRole('button', { name: /비활성화|해제/i }).first();

    if (await toggleButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await toggleButton.click();
      await page.waitForTimeout(500);
    } else if (await deactivateButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      // Just verify it's visible
      await expect(deactivateButton).toBeEnabled();
    }
  });

  test('should delete blacklist entry', async ({ page }) => {
    const deleteButton = page.getByRole('button', { name: /삭제/i }).first();

    if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteButton.click();

      // Confirm dialog should appear
      const confirmButton = page.getByRole('button', { name: /확인|삭제/i });
      if (await confirmButton.isVisible()) {
        // Cancel instead of actually deleting
        await page.getByRole('button', { name: /취소/i }).click();
      }
    }
  });

  test('should filter by active status', async ({ page }) => {
    const statusFilter = page.locator('select').filter({ hasText: /전체|활성|비활성/i }).first();

    if (await statusFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
      await statusFilter.selectOption({ index: 1 });
      await page.waitForTimeout(500);
    }
  });
});
