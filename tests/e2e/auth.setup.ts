import { expect, test as setup } from '@playwright/test';

// The login route rate-limits to 5 attempts per 15 minutes per IP, so the suite
// authenticates exactly once here and every test reuses the saved session.
const authFile = 'playwright/.auth/user.json';

// Seeded accounts ship with a published default password and are forced to
// change it on first sign-in, so the suite rotates it once and then reuses the
// new one. Both are configurable for environments that already rotated it.
const DEFAULT_PASSWORD = process.env.E2E_PASSWORD || 'Admin2025!CMMS';
const ROTATED_PASSWORD = process.env.E2E_PASSWORD_SET || 'E2eTest2026!CMMS';

async function fillLogin(page: import('@playwright/test').Page, password: string) {
  const username = page.getByPlaceholder('Enter username');
  const pw = page.getByPlaceholder('Enter password');
  const signIn = page.getByRole('button', { name: 'Sign In' });
  // The form is client-rendered: a fill that lands before React attaches its
  // listeners is dropped and the button stays disabled, so re-fill until it
  // reports enabled.
  await expect(async () => {
    await username.fill(process.env.E2E_USERNAME || 'admin');
    await pw.fill(password);
    await expect(signIn).toBeEnabled({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  await signIn.click();
}

// Completes the forced-password-change form if it is showing.
async function rotateIfRequired(page: import('@playwright/test').Page): Promise<void> {
  const heading = page.getByRole('heading', { name: 'Set a new password' });
  if (!(await heading.isVisible({ timeout: 5_000 }).catch(() => false))) return;
  await page.locator('#current-password').fill(DEFAULT_PASSWORD);
  await page.locator('#new-password').fill(ROTATED_PASSWORD);
  await page.locator('#confirm-password').fill(ROTATED_PASSWORD);
  await page.getByRole('button', { name: 'Update password' }).click();
}

setup('authenticate', async ({ page }) => {
  await page.goto('/app');
  await page.getByPlaceholder('Enter username').waitFor({ state: 'visible', timeout: 30_000 });

  const dashboard = page.getByRole('button', { name: 'Dashboard', exact: true });

  // A database that already rotated the password accepts the new one directly.
  await fillLogin(page, ROTATED_PASSWORD);
  await page.waitForTimeout(2_000);
  if (!(await dashboard.isVisible().catch(() => false))) {
    // Otherwise sign in with the seeded default, then clear the gate.
    if (await page.getByPlaceholder('Enter username').isVisible().catch(() => false)) {
      await fillLogin(page, DEFAULT_PASSWORD);
      await page.waitForTimeout(2_000);
    }
    await rotateIfRequired(page);
  }

  await expect(dashboard).toBeVisible({ timeout: 30_000 });
  await page.context().storageState({ path: authFile });
});

