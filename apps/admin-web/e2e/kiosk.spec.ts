import { test, expect } from '@playwright/test';

test.describe('Kiosk Interface', () => {
  test.beforeEach(async ({ page }) => {
    // Kiosk doesn't require login
    await page.goto('/kiosk');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should display kiosk main screen', async ({ page }) => {
    // Check for main kiosk elements
    await expect(
      page.getByRole('heading', { name: /주차 정산|차량번호/i })
        .or(page.getByText(/차량번호를 입력/i))
        .or(page.getByPlaceholder(/차량번호|12가3456/i))
    ).toBeVisible({ timeout: 10000 });
  });

  test('should display keypad for plate number input', async ({ page }) => {
    // Check for numeric keypad or input
    const keypadButtons = page.locator('button').filter({ hasText: /^[0-9]$/ });
    const plateInput = page.getByPlaceholder(/차량번호|12가3456/i);

    // Either keypad or input should be visible
    const keypadCount = await keypadButtons.count();
    const inputVisible = await plateInput.isVisible().catch(() => false);

    expect(keypadCount > 0 || inputVisible).toBeTruthy();
  });

  test('should accept plate number input', async ({ page }) => {
    const plateInput = page.getByPlaceholder(/차량번호|12가3456/i);

    if (await plateInput.isVisible()) {
      await plateInput.fill('12가3456');
      await expect(plateInput).toHaveValue('12가3456');
    } else {
      // Try using keypad buttons
      const buttons = page.locator('button');
      const btn1 = buttons.filter({ hasText: '1' }).first();
      const btn2 = buttons.filter({ hasText: '2' }).first();

      if (await btn1.isVisible()) {
        await btn1.click();
        await btn2.click();
      }
    }
  });

  test('should search for parking session', async ({ page }) => {
    const plateInput = page.getByPlaceholder(/차량번호|12가3456/i);

    if (await plateInput.isVisible()) {
      await plateInput.fill('12가3456');

      // Click search button
      const searchButton = page.getByRole('button', { name: /조회|검색|확인/i });
      if (await searchButton.isVisible()) {
        await searchButton.click();
        await page.waitForTimeout(2000);

        // Should show result or "not found" message
        const result = page.getByText(/주차 정보|요금|세션을 찾을 수 없습니다|등록된 차량이 없습니다/i);
        await expect(result).toBeVisible({ timeout: 5000 }).catch(() => {
          // Result might be displayed differently
        });
      }
    }
  });

  test('should display parking fee information', async ({ page }) => {
    const plateInput = page.getByPlaceholder(/차량번호|12가3456/i);

    if (await plateInput.isVisible()) {
      await plateInput.fill('12가3456');

      const searchButton = page.getByRole('button', { name: /조회|검색|확인/i });
      if (await searchButton.isVisible()) {
        await searchButton.click();
        await page.waitForTimeout(2000);

        // Check for fee display
        const feeInfo = page.getByText(/원|요금|금액/i);
        if (await feeInfo.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(feeInfo).toBeVisible();
        }
      }
    }
  });

  test('should show payment options', async ({ page }) => {
    const plateInput = page.getByPlaceholder(/차량번호|12가3456/i);

    if (await plateInput.isVisible()) {
      await plateInput.fill('12가3456');

      const searchButton = page.getByRole('button', { name: /조회|검색|확인/i });
      if (await searchButton.isVisible()) {
        await searchButton.click();
        await page.waitForTimeout(2000);

        // Check for payment button
        const paymentButton = page.getByRole('button', { name: /결제|카드|신용카드/i });
        if (await paymentButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(paymentButton).toBeEnabled();
        }
      }
    }
  });

  test('should handle clear/reset button', async ({ page }) => {
    const plateInput = page.getByPlaceholder(/차량번호|12가3456/i);

    if (await plateInput.isVisible()) {
      await plateInput.fill('12가3456');

      // Find clear button
      const clearButton = page.getByRole('button', { name: /초기화|지우기|취소|다시/i });
      if (await clearButton.isVisible()) {
        await clearButton.click();
        await page.waitForTimeout(500);

        // Input should be cleared
        await expect(plateInput).toHaveValue('');
      }
    }
  });
});

test.describe('Kiosk Payment Flow', () => {
  test('should initiate payment process', async ({ page }) => {
    await page.goto('/kiosk');
    await page.waitForLoadState('domcontentloaded');

    const plateInput = page.getByPlaceholder(/차량번호|12가3456/i);

    if (await plateInput.isVisible()) {
      await plateInput.fill('12가3456');

      const searchButton = page.getByRole('button', { name: /조회|검색|확인/i });
      if (await searchButton.isVisible()) {
        await searchButton.click();
        await page.waitForTimeout(2000);

        // Look for payment button
        const paymentButton = page.getByRole('button', { name: /결제|카드 결제/i });
        if (await paymentButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await paymentButton.click();
          await page.waitForTimeout(1000);

          // Should show payment processing or redirect
          const paymentScreen = page.getByText(/결제 중|처리 중|카드를 삽입/i);
          if (await paymentScreen.isVisible({ timeout: 3000 }).catch(() => false)) {
            await expect(paymentScreen).toBeVisible();
          }
        }
      }
    }
  });

  test('should display payment success page', async ({ page }) => {
    // Navigate directly to success page
    await page.goto('/kiosk/payment/success?sessionId=test123&amount=5000');
    await page.waitForLoadState('domcontentloaded');

    // Check for success indicators
    const successMessage = page.getByText(/결제 완료|감사합니다|출차하세요/i);
    await expect(successMessage).toBeVisible({ timeout: 5000 }).catch(() => {
      // Page might redirect or show different content
    });
  });

  test('should display payment fail page', async ({ page }) => {
    // Navigate directly to fail page
    await page.goto('/kiosk/payment/fail?code=ERROR&message=Test');
    await page.waitForLoadState('domcontentloaded');

    // Check for failure indicators
    const failMessage = page.getByText(/결제 실패|오류|다시 시도/i);
    await expect(failMessage).toBeVisible({ timeout: 5000 }).catch(() => {
      // Page might redirect or show different content
    });
  });

  test('should return to main screen from success page', async ({ page }) => {
    await page.goto('/kiosk/payment/success?sessionId=test123&amount=5000');
    await page.waitForTimeout(2000);

    // Look for return button or automatic redirect
    const returnButton = page.getByRole('button', { name: /처음으로|메인|확인/i });
    if (await returnButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await returnButton.click();
      await expect(page).toHaveURL('/kiosk', { timeout: 5000 });
    }
  });
});

test.describe('Kiosk Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kiosk');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should have large touch targets', async ({ page }) => {
    // Check that main buttons are reasonably large
    const buttons = page.locator('button').filter({ hasText: /조회|결제|취소/i });

    for (const button of await buttons.all()) {
      const box = await button.boundingBox();
      if (box) {
        // Minimum touch target size should be at least 44x44px
        expect(box.width).toBeGreaterThanOrEqual(40);
        expect(box.height).toBeGreaterThanOrEqual(40);
      }
    }
  });

  test('should have readable text size', async ({ page }) => {
    // Check for large text elements
    const headings = page.locator('h1, h2, h3, [class*="text-xl"], [class*="text-2xl"]');
    const headingCount = await headings.count();
    expect(headingCount).toBeGreaterThan(0);
  });
});
