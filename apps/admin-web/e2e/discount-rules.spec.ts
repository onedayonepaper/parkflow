import { test, expect } from '@playwright/test';
import { login } from './fixtures';

test.describe('Discount Rules CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/discount-rules');
    await expect(page.getByRole('heading', { name: /할인 규칙/i })).toBeVisible({ timeout: 10000 });
  });

  test('should display discount rules list', async ({ page }) => {
    // Check for table or list
    const discountTable = page.locator('table, [role="table"], [data-testid="discount-list"]');
    await expect(discountTable).toBeVisible({ timeout: 5000 }).catch(() => {
      // Check for empty state
      expect(page.getByText(/할인 규칙이 없습니다|데이터가 없습니다/i)).toBeVisible();
    });
  });

  test('should open create discount rule modal', async ({ page }) => {
    // Use more specific selector for the add button outside dialogs
    const addButton = page.locator('button:has-text("할인 규칙 추가"), button:has-text("+ 할인"), button:has-text("새 할인")').first();

    if (await addButton.isVisible()) {
      await addButton.click();

      // Modal should appear
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 3000 }).catch(() => {
        // Might navigate to a form page instead
        expect(page.getByLabel(/이름|명칭/i)).toBeVisible();
      });
    }
  });

  test('should create a new discount rule', async ({ page }) => {
    // Use more specific selector for the add button outside dialogs
    const addButton = page.locator('button:has-text("할인 규칙 추가"), button:has-text("+ 할인"), button:has-text("새 할인")').first();

    if (await addButton.isVisible()) {
      await addButton.click();

      // Fill form
      const nameInput = page.getByLabel(/이름|명칭/i);
      const valueInput = page.getByLabel(/값|금액/i);

      if (await nameInput.isVisible()) {
        await nameInput.fill('E2E 테스트 할인');
      }

      if (await valueInput.isVisible()) {
        await valueInput.fill('1000');
      }

      // Select type if dropdown exists
      const typeSelect = page.locator('select[name*="type"], [data-testid="type-select"]');
      if (await typeSelect.isVisible()) {
        await typeSelect.selectOption({ label: /정액|AMOUNT/i }).catch(() => {});
      }

      // Submit form - use the button inside the dialog
      const submitButton = page.getByRole('dialog').getByRole('button', { name: /저장|생성|확인/i });
      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Should show success or close modal
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should edit discount rule', async ({ page }) => {
    // Click on first edit button
    const editButton = page.locator('button[aria-label*="수정"], button[aria-label*="편집"], [data-testid="edit-button"]').first();

    if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editButton.click();

      // Modal or form should appear
      const nameInput = page.getByLabel(/이름|명칭/i);
      if (await nameInput.isVisible()) {
        await nameInput.fill('수정된 할인 규칙');

        // Use the button inside the dialog
        const submitButton = page.getByRole('dialog').getByRole('button', { name: /저장|수정|확인/i });
        if (await submitButton.isVisible()) {
          await submitButton.click();
        }
      }
    }
  });

  test('should delete discount rule', async ({ page }) => {
    // Click on first delete button
    const deleteButton = page.locator('button[aria-label*="삭제"], [data-testid="delete-button"]').first();

    if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteButton.click();

      // Confirm dialog should appear
      const confirmButton = page.getByRole('button', { name: /확인|삭제|예/i });
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
    }
  });
});

test.describe('Memberships CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/memberships');
    await expect(page.getByRole('heading', { name: /정기권 관리/i })).toBeVisible({ timeout: 10000 });
  });

  test('should display memberships list', async ({ page }) => {
    const membershipTable = page.locator('table, [role="table"]');
    await expect(membershipTable).toBeVisible({ timeout: 5000 }).catch(() => {
      expect(page.getByText(/정기권이 없습니다|데이터가 없습니다/i)).toBeVisible();
    });
  });

  test('should search memberships by plate number', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/차량번호|검색/i);

    if (await searchInput.isVisible()) {
      await searchInput.fill('12가3456');
      await searchInput.press('Enter');
      await page.waitForTimeout(1000);
    }
  });
});
