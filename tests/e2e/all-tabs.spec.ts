import { expect, test, type Page } from '@playwright/test';

const tabs = [
  'Dashboard', 'Assets', 'Criticality', 'Root Cause Analysis', 'Work Orders', 'PM Schedule', 'Procedures',
  'Inventory', 'Vendors', 'Purchase Orders', 'Compliance', 'Documents',
  'Safety', 'Inspections', 'Reports', 'Testing', 'AI Advisor', 'Help', 'Admin',
];

async function exerciseVisibleInputs(page: Page) {
  // Scoped to <main> so the sidebar and header controls are not touched; the
  // modal is rendered inside main, so this also covers an open form.
  const inputs = page.locator('main input:visible, main textarea:visible, main select:visible');
  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    const input = inputs.nth(i);
    if (await input.isDisabled() || (await input.getAttribute('readonly')) !== null) continue;
    const tag = await input.evaluate(el => el.tagName.toLowerCase());
    const type = await input.getAttribute('type');
    if (tag === 'select') {
      const options = input.locator('option:not([disabled])');
      if (await options.count()) {
        const original = await input.inputValue();
        const value = await options.first().getAttribute('value');
        if (value !== null) await input.selectOption(value);
        await input.selectOption(original).catch(() => {});
      }
      continue;
    }
    if (type === 'checkbox' || type === 'radio') {
      const checked = await input.isChecked();
      await input.setChecked(!checked);
      await input.setChecked(checked);
      continue;
    }
    if (['button', 'submit', 'hidden', 'file'].includes(type || '')) continue;
    // Type a value, prove the field holds it, then clear and restore.
    const original = await input.inputValue();
    const isNumber = type === 'number';
    const sample = isNumber ? '1' : type === 'date' ? '2026-10-13' : 'playwright-input-check';
    await input.fill(sample);
    await expect(input).toHaveValue(sample);
    // Number fields are bound inconsistently in this app: some coerce an empty
    // string to 0, others keep ''. Accept either — the point is that the field
    // clears without losing its binding.
    await input.fill('');
    await expect(input).toHaveValue(isNumber ? /^(0)?$/ : '');
    await input.fill(original);
    if (!isNumber) await expect(input).toHaveValue(original);
  }
}

// Open the page's "Add New" dialog, exercise its fields, then close without
// saving so no test data is written.
async function exerciseAddModal(page: Page) {
  const add = page.getByRole('button', { name: 'Add New' });
  if (await add.count() === 0) return;
  const modal = page.locator('div.fixed.inset-0.z-50');
  await add.first().click();
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await exerciseVisibleInputs(page);
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden({ timeout: 10_000 });
}

async function openApp(page: Page) {
  // The session cookie is restored from storageState by the auth setup project.
  await page.goto('/app');
  await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 30_000 });
}

test('every tab renders and every visible input accepts and clears data', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', error => pageErrors.push(error.message));

  await openApp(page);
  for (const tab of tabs) {
    await test.step(tab, async () => {
      // Scope to the sidebar: some pages render their own button that shares a
      // nav label (e.g. the Admin page has an "Admin" tab).
      await page.getByRole('navigation').getByRole('button', { name: tab, exact: true }).click();
      await expect(page.locator('main h2').first()).toBeVisible({ timeout: 15_000 });
      await exerciseVisibleInputs(page);
      await exerciseAddModal(page);
    });
  }

  expect(pageErrors, `Unhandled page errors:\n${pageErrors.join('\n')}`).toEqual([]);
  expect(consoleErrors.filter(e => !e.includes('favicon')), `Console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
});

test('AI Advisor answers from live data without requiring an API key', async ({ page }) => {
  await openApp(page);
  await page.getByRole('navigation').getByRole('button', { name: 'AI Advisor', exact: true }).click();
  const input = page.getByPlaceholder('Ask about any module, metric or workflow...');
  await input.fill('How many overdue PMs do we have?');
  await input.press('Enter');
  await expect(page.getByText(/PM schedules:|Current site status:/).last()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Sources:/).last()).toBeVisible();
});

test('assessed asset suggests work-order priority but the user can override it', async ({ page }) => {
  await page.route('**/api/assets', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{ id: 'TEST-ASSET-A', name: 'Critical test asset' }]),
  }));
  await page.route('**/api/criticality', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ rows: [{ assetId: 'TEST-ASSET-A', assessed: true, result: { band: 'A' } }] }),
  }));

  await openApp(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Work Orders', exact: true }).click();
  await page.getByRole('button', { name: 'Add New' }).click();
  const modal = page.locator('div.fixed.inset-0.z-50');
  await expect(modal).toBeVisible();
  await modal.getByLabel('Asset').selectOption('TEST-ASSET-A');
  const priority = modal.getByLabel('Priority');
  await expect(priority).toHaveValue('critical');
  await expect(modal.getByText(/Suggested priority; assessed risk is Band A/)).toBeVisible();

  await priority.selectOption('low');
  await expect(priority).toHaveValue('low');
  await expect(modal.getByText(/Manual priority; assessed risk is Band A/)).toBeVisible();
  await modal.getByLabel('Asset').selectOption('');
  await modal.getByLabel('Asset').selectOption('TEST-ASSET-A');
  await expect(priority).toHaveValue('low');
  await modal.getByRole('button', { name: 'Use Critical recommendation' }).click();
  await expect(priority).toHaveValue('critical');
});

test('failed mechanical test carries its evidence into a corrective work order', async ({ page }) => {
  await page.route('**/api/assets', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{ id: 'TEST-ASSET-M', name: 'Test Pump' }]),
  }));
  await page.route('**/api/electrical-tests', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{
      id: 'TEST-FAILED-1', assetId: 'TEST-ASSET-M', discipline: 'mechanical',
      testType: 'vibration_analysis', testDate: '2026-11-13', results: 'High axial vibration',
      nextDue: '', testedBy: 'Technician', status: 'failed', notes: 'Bearing temperature elevated',
    }]),
  }));
  await page.route('**/api/criticality', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ rows: [{ assetId: 'TEST-ASSET-M', assessed: true, result: { band: 'B' } }] }),
  }));

  await openApp(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Testing', exact: true }).click();
  await page.getByRole('button', { name: 'Raise corrective WO' }).click();

  const modal = page.locator('div.fixed.inset-0.z-50');
  await expect(modal.getByRole('heading', { name: 'New Work Order' })).toBeVisible();
  await expect(modal.getByLabel('Asset')).toHaveValue('TEST-ASSET-M');
  await expect(modal.getByLabel('Title')).toHaveValue('Investigate vibration analysis test failed');
  await expect(modal.getByLabel('Priority')).toHaveValue('high');
  await expect(modal.locator('textarea').first()).toHaveValue(/High axial vibration/);
});

test('root cause analysis opens pre-linked from a work order', async ({ page }) => {
  await page.route('**/api/root-cause-analyses', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify([]),
  }));
  await page.route('**/api/assets', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{ id: 'RCA-ASSET', name: 'RCA Test Asset' }]),
  }));
  await page.route('**/api/work-orders', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{ id: 'WO-RCA-1', assetId: 'RCA-ASSET', title: 'Bearing repair', status: 'in_progress' }]),
  }));

  await openApp(page);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('nav', {
    detail: { page: 'root-cause-analysis', assetId: 'RCA-ASSET', workOrderId: 'WO-RCA-1' },
  })));
  const modal = page.locator('div.fixed.inset-0.z-50');
  await expect(modal.getByRole('heading', { name: 'New Root Cause Analysis' })).toBeVisible();
  const selects = modal.locator('select');
  await expect(selects.nth(0)).toHaveValue('RCA-ASSET');
  await expect(selects.nth(1)).toHaveValue('WO-RCA-1');
});
