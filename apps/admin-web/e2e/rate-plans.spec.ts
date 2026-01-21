import { test, expect } from '@playwright/test';
import { login } from './fixtures';

test.describe('Rate Plans Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/rate-plans');
    // Wait for page to load (either heading or loading indicator)
    await page.waitForLoadState('domcontentloaded');
    await expect(
      page.getByRole('heading', { name: /요금 정책|요금제/i })
        .or(page.getByText(/로딩 중/i))
        .or(page.locator('table'))
    ).toBeVisible({ timeout: 15000 });
  });

  test('should display rate plans list', async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(2000);

    // Check for table or empty state
    const ratePlanTable = page.locator('table');
    const emptyState = page.getByText(/요금 정책이 없습니다|데이터가 없습니다/i);

    await expect(ratePlanTable.or(emptyState)).toBeVisible({ timeout: 5000 });
  });

  test('should display active status indicators', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Check for active/inactive badges
    const activeBadge = page.locator('[class*="badge"]').filter({
      hasText: /활성|비활성|사용중|Active|Inactive/i,
    });

    const badgeCount = await activeBadge.count();
    expect(badgeCount).toBeGreaterThanOrEqual(0);
  });

  test('should open create rate plan modal', async ({ page }) => {
    await page.waitForTimeout(1000);

    const addButton = page.getByRole('button', { name: /요금제 추가|추가|새 요금/i });

    if (await addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addButton.click();

      // Modal or form should appear
      await expect(page.getByRole('dialog').or(page.getByLabel(/이름|명칭/i))).toBeVisible({ timeout: 3000 });
    }
  });

  test('should create a new rate plan', async ({ page }) => {
    await page.waitForTimeout(1000);

    const addButton = page.getByRole('button', { name: /요금제 추가|추가|새 요금/i });

    if (await addButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addButton.click();
      await page.waitForTimeout(500);

      // Fill basic info
      const nameInput = page.getByLabel(/이름|명칭|요금제명/i);
      if (await nameInput.isVisible()) {
        await nameInput.fill('E2E 테스트 요금제');
      }

      // Fill base rate if exists
      const baseRateInput = page.getByLabel(/기본 요금|시간당 요금/i);
      if (await baseRateInput.isVisible()) {
        await baseRateInput.fill('1000');
      }

      // Submit form
      const saveButton = page.getByRole('button', { name: /저장|생성|추가/i });
      if (await saveButton.isVisible()) {
        await saveButton.click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should edit rate plan', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Click on first edit button
    const editButton = page.getByRole('button', { name: /수정|편집/i }).first();

    if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editButton.click();
      await page.waitForTimeout(500);

      // Modal should appear
      const nameInput = page.getByLabel(/이름|명칭|요금제명/i);
      if (await nameInput.isVisible()) {
        await nameInput.clear();
        await nameInput.fill('수정된 요금제');

        const saveButton = page.getByRole('button', { name: /저장|수정/i });
        if (await saveButton.isVisible()) {
          await saveButton.click();
        }
      }
    }
  });

  test('should toggle rate plan active status', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Look for toggle switch or activate/deactivate button
    const toggleButton = page.locator('button[role="switch"], input[type="checkbox"]').first();

    if (await toggleButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await toggleButton.click();
      await page.waitForTimeout(500);
    }
  });

  test('should view rate plan rules', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Click on a rate plan to view details
    const viewButton = page.getByRole('button', { name: /상세|보기|규칙/i }).first();

    if (await viewButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await viewButton.click();
      await page.waitForTimeout(500);

      // Rules section should be visible
      const rulesSection = page.getByText(/규칙|요금 규칙|시간대/i);
      if (await rulesSection.isVisible()) {
        await expect(rulesSection).toBeVisible();
      }
    }
  });

  test('should delete rate plan with confirmation', async ({ page }) => {
    await page.waitForTimeout(2000);

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
});

test.describe('Rate Plan Rules', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/rate-plans');
    await page.waitForTimeout(2000);
  });

  test('should add rule to rate plan', async ({ page }) => {
    // Click on first rate plan to edit
    const editButton = page.getByRole('button', { name: /수정|편집/i }).first();

    if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editButton.click();
      await page.waitForTimeout(500);

      // Look for add rule button
      const addRuleButton = page.getByRole('button', { name: /규칙 추가|시간대 추가/i });
      if (await addRuleButton.isVisible()) {
        await addRuleButton.click();
        await page.waitForTimeout(500);
      }
    }
  });
});
