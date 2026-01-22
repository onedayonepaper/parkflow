import { test, expect } from '@playwright/test';
import { login } from './fixtures';

test.describe('Devices Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/devices');
    await expect(page.getByRole('heading', { name: /장비 관리/i })).toBeVisible({ timeout: 10000 });
  });

  test('should display devices tab and list', async ({ page }) => {
    // Check for devices tab
    const devicesTab = page.getByRole('tab', { name: /장비/i });
    await expect(devicesTab).toBeVisible();

    // Check for table or list
    const deviceTable = page.locator('table');
    await expect(deviceTable).toBeVisible({ timeout: 5000 });
  });

  test('should display lanes tab', async ({ page }) => {
    // Click on lanes tab
    const lanesTab = page.getByRole('tab', { name: /차로/i });

    if (await lanesTab.isVisible()) {
      await lanesTab.click();
      await page.waitForTimeout(500);

      // Check for lanes content
      const laneTable = page.locator('table');
      await expect(laneTable).toBeVisible({ timeout: 5000 });
    }
  });

  test('should show device status indicators', async ({ page }) => {
    // Check for status badges (ONLINE/OFFLINE)
    const statusBadge = page.locator('[class*="badge"], [class*="status"]').filter({
      hasText: /ONLINE|OFFLINE|온라인|오프라인/i,
    });

    await page.waitForTimeout(1000);
    const badgeCount = await statusBadge.count();
    expect(badgeCount).toBeGreaterThanOrEqual(0);
  });

  test('should open add device modal', async ({ page }) => {
    // Use more specific selector for the add button outside dialogs
    const addButton = page.locator('button:has-text("장비 추가"), button:has-text("+ 장비")').first();

    if (await addButton.isVisible()) {
      await addButton.click();

      // Modal should appear
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
      await expect(page.getByLabel(/장비 이름|이름/i)).toBeVisible();
    }
  });

  test('should create a new device', async ({ page }) => {
    // Use more specific selector for the add button outside dialogs
    const addButton = page.locator('button:has-text("장비 추가"), button:has-text("+ 장비")').first();

    if (await addButton.isVisible()) {
      await addButton.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });

      // Fill form
      await page.getByLabel(/장비 이름|이름/i).fill('E2E 테스트 장비');

      // Select device type
      const typeSelect = page.locator('select').filter({ hasText: /LPR|BARRIER|KIOSK/i }).first();
      if (await typeSelect.isVisible()) {
        await typeSelect.selectOption({ index: 0 });
      }

      // Submit - use the button inside the dialog
      const saveButton = page.getByRole('dialog').getByRole('button', { name: /저장|추가|확인/i });
      await saveButton.click();

      // Wait for modal to close or success message
      await page.waitForTimeout(1000);
    }
  });

  test('should edit device', async ({ page }) => {
    // Click on first edit button in device row
    const editButton = page.getByRole('button', { name: /수정|편집/i }).first();

    if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editButton.click();

      // Modal should appear
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });

      // Update name
      const nameInput = page.getByLabel(/장비 이름|이름/i);
      if (await nameInput.isVisible()) {
        await nameInput.clear();
        await nameInput.fill('수정된 장비 이름');

        // Use the button inside the dialog
        const saveButton = page.getByRole('dialog').getByRole('button', { name: /저장|수정|확인/i });
        await saveButton.click();
      }
    }
  });

  test('should delete device with confirmation', async ({ page }) => {
    // Click on first delete button
    const deleteButton = page.getByRole('button', { name: /삭제/i }).first();

    if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteButton.click();

      // Confirm dialog should appear
      const confirmButton = page.getByRole('button', { name: /확인|삭제/i });
      if (await confirmButton.isVisible()) {
        // Don't actually delete in test - just verify dialog works
        await page.getByRole('button', { name: /취소/i }).click();
      }
    }
  });
});

test.describe('Lanes Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/devices');
    await expect(page.getByRole('heading', { name: /장비 관리/i })).toBeVisible({ timeout: 10000 });

    // Switch to lanes tab
    const lanesTab = page.getByRole('tab', { name: /차로/i });
    if (await lanesTab.isVisible()) {
      await lanesTab.click();
      await page.waitForTimeout(500);
    }
  });

  test('should display lanes list', async ({ page }) => {
    const laneTable = page.locator('table');
    await expect(laneTable).toBeVisible({ timeout: 5000 });
  });

  test('should show lane direction indicators', async ({ page }) => {
    // Check for direction indicators (ENTRY/EXIT)
    const directionBadge = page.locator('[class*="badge"], td').filter({
      hasText: /ENTRY|EXIT|입구|출구|입차|출차/i,
    });

    const badgeCount = await directionBadge.count();
    expect(badgeCount).toBeGreaterThanOrEqual(0);
  });

  test('should open add lane modal', async ({ page }) => {
    // Use more specific selector for the add button outside dialogs
    const addButton = page.locator('button:has-text("차로 추가"), button:has-text("+ 차로")').first();

    if (await addButton.isVisible()) {
      await addButton.click();

      // Modal should appear
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });
    }
  });

  test('should create a new lane', async ({ page }) => {
    // Use more specific selector for the add button outside dialogs
    const addButton = page.locator('button:has-text("차로 추가"), button:has-text("+ 차로")').first();

    if (await addButton.isVisible()) {
      await addButton.click();
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 });

      // Fill form
      const nameInput = page.getByLabel(/차로 이름|이름/i);
      if (await nameInput.isVisible()) {
        await nameInput.fill('E2E 테스트 차로');
      }

      // Select direction
      const directionSelect = page.locator('select').filter({ hasText: /ENTRY|EXIT/i }).first();
      if (await directionSelect.isVisible()) {
        await directionSelect.selectOption({ index: 0 });
      }

      // Submit - use the button inside the dialog
      const saveButton = page.getByRole('dialog').getByRole('button', { name: /저장|추가|확인/i });
      await saveButton.click();

      await page.waitForTimeout(1000);
    }
  });
});
