import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/');
    expect(await page.locator('body').isVisible()).toBe(true);
  });

  test('plans page loads successfully', async ({ page }) => {
    await page.goto('/plans');
    await expect(page).toHaveURL('/plans');
    expect(await page.locator('body').isVisible()).toBe(true);
  });

  test('chat redirects to age gate when no cookie', async ({ page }) => {
    // Clear any existing cookies
    await page.context().clearCookies();
    
    // Try to access chat - should redirect to age gate
    const response = await page.goto('/chat');
    
    // Should redirect to / with age=required param
    await expect(page).toHaveURL('/?age=required');
    expect(response?.status()).toBe(200); // Final response after redirect
  });

  test('chat allows access after age verification', async ({ page }) => {
    // First set the age verification cookie by calling the API
    await page.goto('/');
    await page.evaluate(async () => {
      await fetch('/api/age/allow', { method: 'POST' });
    });
    
    // Now chat should be accessible
    await page.goto('/chat');
    await expect(page).toHaveURL('/chat');
    expect(await page.locator('body').isVisible()).toBe(true);
  });
});