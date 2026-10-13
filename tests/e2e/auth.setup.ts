import { expect, test as setup } from '@playwright/test';

// The login route rate-limits to 5 attempts per 15 minutes per IP, so the suite
// authenticates exactly once here and every test reuses the saved session.
const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/app');
  const username = page.getByPlaceholder('Enter username');
  await username.waitFor({ state: 'visible', timeout: 30_000 });
  const password = page.getByPlaceholder('Enter password');
  const signIn = page.getByRole('button', { name: 'Sign In' });

  // The form is client-rendered: a fill that lands before React attaches its
  // listeners is dropped and the button stays disabled, so re-fill until it
  // reports enabled.
  await expect(async () => {
    await username.fill(process.env.E2E_USERNAME || 'admin');
    await password.fill(process.env.E2E_PASSWORD || 'Admin2025!CMMS');
    await expect(signIn).toBeEnabled({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });

  await signIn.click();
  await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.context().storageState({ path: authFile });
});
