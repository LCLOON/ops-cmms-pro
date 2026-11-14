import { expect, test, type Page } from '@playwright/test';

const tabs = [
  'Dashboard', 'Assets', 'Criticality', 'Root Cause Analysis', 'Work Orders', 'PM Schedule', 'Procedures',
  'Inventory', 'Vendors', 'Purchase Orders', 'Compliance', 'Documents',
  'Safety', 'Inspections', 'Reports', 'Testing', 'Oil Analysis', 'AI Advisor', 'Help', 'Admin',
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
  let submittedWorkOrder: Record<string, unknown> | undefined;
  await page.route('**/api/assets', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{ id: 'TEST-ASSET-M', name: 'Test Pump', siteId: 'SITE-TEST' }]),
  }));
  await page.route('**/api/config*', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ sites: [{ id: 'SITE-TEST', name: 'Test Site' }] }),
  }));
  await page.route('**/api/work-orders', async route => {
    if (route.request().method() === 'POST') {
      submittedWorkOrder = route.request().postDataJSON();
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'WO-TEST-1' }) });
    } else {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
    }
  });
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
  await expect(modal.getByLabel('Site')).toHaveValue('SITE-TEST');
  await expect(modal.getByLabel('Priority')).toHaveValue('high');
  await expect(modal.locator('textarea').first()).toHaveValue(/High axial vibration/);
  await modal.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => submittedWorkOrder).toBeDefined();
  expect(submittedWorkOrder?.sourceTestingRecordId).toBe('TEST-FAILED-1');
  expect(submittedWorkOrder?.siteId).toBe('SITE-TEST');
});

test('work-order safety permits inherit the asset and keep editable links', async ({ page }) => {
  const asset = { id: 'SAFETY-ASSET', name: 'Safety Test Pump', siteId: 'SITE-SAFETY' };
  const workOrder = {
    id: 'WO-SAFETY-1', assetId: asset.id, siteId: asset.siteId, title: 'Pump seal repair',
    description: '', pmScheduleId: '', sourceTestingRecordId: '', sourceInspectionId: '',
    sourceOilAnalysisId: '', type: 'corrective', priority: 'high', status: 'open',
    assignedTo: '', requestedBy: '', dueDate: '', completedDate: '', laborHours: 0,
    partsCost: 0, resolution: '', createdAt: '', updatedAt: '',
  };
  let submittedPermit: Record<string, unknown> | undefined;
  await page.route('**/api/assets', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify([asset]),
  }));
  await page.route('**/api/config*', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ sites: [{ id: asset.siteId, name: 'Safety Site' }] }),
  }));
  await page.route('**/api/criticality', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ rows: [] }),
  }));
  await page.route('**/api/work-orders', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify([workOrder]),
  }));
  await page.route('**/api/safety', async route => {
    if (route.request().method() === 'POST') {
      submittedPermit = route.request().postDataJSON();
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(submittedPermit) });
    } else {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
    }
  });

  await openApp(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Work Orders', exact: true }).click();
  await page.locator('[data-row-id="WO-SAFETY-1"]').locator('td').last().getByRole('button').first().click();
  const workOrderModal = page.locator('div.fixed.inset-0.z-50');
  await workOrderModal.getByRole('button', { name: 'Manage Safety Permits' }).click();

  await expect(page.getByText(/Permits for WO-SAFETY-1/)).toBeVisible();
  await page.getByRole('button', { name: 'Add New' }).click();
  const permitModal = page.locator('div.fixed.inset-0.z-50');
  await expect(permitModal.getByLabel('Work order')).toHaveValue('WO-SAFETY-1');
  await expect(permitModal.getByLabel('Asset')).toHaveValue(asset.id);
  await expect(permitModal.getByLabel('Asset')).toBeDisabled();
  await permitModal.getByLabel('Permit #').fill('PERMIT-SAFETY-1');
  await permitModal.getByRole('button', { name: 'Save' }).click();
  await expect.poll(() => submittedPermit).toBeDefined();
  expect(submittedPermit?.workOrderId).toBe(workOrder.id);
  expect(submittedPermit?.assetId).toBe(asset.id);
});

test('oil analysis can raise a corrective work order with lab evidence linked', async ({ page }) => {
  let submittedWorkOrder: Record<string, unknown> | undefined;
  const asset = { id: 'OIL-ASSET', name: 'Generator Bearing', siteId: 'SITE-OIL' };
  await page.route('**/api/assets', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify([asset]),
  }));
  await page.route('**/api/oil-analysis', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{
      id: 'OIL-ACTION-1', assetId: asset.id, sampleType: 'bearing', sampleDate: '2026-11-13',
      samplePoint: 'Drive-end bearing', sampleId: 'LAB-001', sampledBy: 'Technician',
      labName: 'Independent Lab', reportNumber: 'RPT-001', oilBrand: 'ISO VG', oilGrade: '68',
      hoursOnOil: '1400', assessment: 'action_required', assessmentNotes: 'Wear metals elevated',
      recommendations: 'Inspect bearing and verify lubrication', nextSampleDue: '',
      notes: 'Trend against prior sample', measurements: { ironPpm: '42', waterPpm: '110' },
      followUpWorkOrderId: '', createdAt: '', updatedAt: '',
    }]),
  }));
  await page.route('**/api/work-orders', async route => {
    if (route.request().method() === 'POST') {
      submittedWorkOrder = route.request().postDataJSON();
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'WO-OIL-1' }) });
    } else {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
    }
  });
  await page.route('**/api/config*', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ sites: [{ id: asset.siteId, name: 'Oil Site' }] }),
  }));
  await page.route('**/api/criticality', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ rows: [] }),
  }));

  await openApp(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Oil Analysis', exact: true }).click();
  await page.getByRole('button', { name: 'Raise corrective WO' }).click();
  const workOrderModal = page.locator('div.fixed.inset-0.z-50');
  await expect(workOrderModal.getByLabel('Asset')).toHaveValue(asset.id);
  await expect(workOrderModal.getByLabel('Title')).toHaveValue(/Review bearing oil analysis/);
  await expect(workOrderModal.locator('textarea').first()).toHaveValue(/Iron \(Fe\): 42 ppm/);
  await expect(workOrderModal.locator('textarea').first()).toHaveValue(/Inspect bearing and verify lubrication/);
  await workOrderModal.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => submittedWorkOrder).toBeDefined();
  expect(submittedWorkOrder?.sourceOilAnalysisId).toBe('OIL-ACTION-1');
  expect(submittedWorkOrder?.siteId).toBe(asset.siteId);
});

test('asset QR tags deep-link to field actions for inspections and oil analysis', async ({ page }) => {
  const asset = {
    id: 'QR-FIELD-ASSET', name: 'QR Field Pump', siteId: 'SITE-QR', category: 'mechanical',
    location: 'North building', department: 'Maintenance', manufacturer: '', model: '',
    serialNumber: '', installDate: '', warrantyExpiry: '', status: 'operational',
    criticality: 'medium', notes: '', parentId: '',
  };
  await page.route('**/api/assets', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify([asset]),
  }));
  await page.route('**/api/work-orders', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify([]),
  }));
  await page.route('**/api/config*', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ sites: [{ id: asset.siteId, name: 'QR Site' }] }),
  }));
  await page.route('**/api/oil-analysis', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify([]),
  }));
  await page.route('**/api/inspections', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify([]),
  }));
  await page.route('**/api/compliance', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify([]),
  }));

  await page.goto(`/app?assetId=${asset.id}`);
  await expect(page.getByRole('navigation').getByRole('button', { name: 'Dashboard', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: asset.name })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'QR tag', exact: true }).click();
  const qr = page.getByRole('img', { name: `QR code for ${asset.name}` });
  await expect(qr).toBeVisible();
  await expect(qr).toHaveAttribute('src', /^data:image\/png;base64,/);

  await page.locator('main').getByRole('button', { name: 'Oil Analysis', exact: true }).click();
  await expect(page.locator('main h2', { hasText: 'Oil Analysis' })).toBeVisible();
  await expect(page.getByLabel('Trend asset')).toHaveValue(asset.id);

  await page.evaluate(id => window.dispatchEvent(new CustomEvent('nav', { detail: { page: 'assets', focusId: id } })), asset.id);
  await expect(page.getByRole('heading', { name: asset.name })).toBeVisible();
  await page.locator('main').getByRole('button', { name: 'Inspections', exact: true }).click();
  await page.getByRole('button', { name: 'Add New' }).click();
  const inspectionModal = page.locator('div.fixed.inset-0.z-50');
  await expect(inspectionModal.locator('select').nth(2)).toHaveValue(asset.id);
});

test('Safety permit links and oil analysis source links persist through the API', async ({ page }) => {
  const assetsResponse = await page.request.get('/api/assets');
  expect(assetsResponse.ok()).toBeTruthy();
  const assets: { id: string }[] = await assetsResponse.json();
  const asset = assets[0];
  expect(asset, 'a seeded asset is required for relationship checks').toBeDefined();
  if (!asset) return;

  const suffix = Date.now().toString(36).toUpperCase();
  const safetyWorkOrderId = `WO-E2E-SAFETY-${suffix}`;
  const oilWorkOrderId = `WO-E2E-OIL-${suffix}`;
  const permitId = `SP-E2E-${suffix}`;
  const oilId = `OIL-E2E-${suffix}`;

  try {
    const safetyWorkOrderResponse = await page.request.post('/api/work-orders', {
      data: { id: safetyWorkOrderId, assetId: asset.id, title: 'E2E permit relationship', type: 'corrective' },
    });
    expect(safetyWorkOrderResponse.ok()).toBeTruthy();

    const mismatchResponse = await page.request.post('/api/safety', {
      data: { id: permitId, workOrderId: safetyWorkOrderId, assetId: 'WRONG-ASSET', permitType: 'loto', permitNumber: 'MISMATCH' },
    });
    expect(mismatchResponse.status()).toBe(400);

    const permitResponse = await page.request.post('/api/safety', {
      data: { id: permitId, workOrderId: safetyWorkOrderId, assetId: '', permitType: 'loto', permitNumber: 'PERMIT-E2E' },
    });
    expect(permitResponse.ok()).toBeTruthy();
    expect((await permitResponse.json()).assetId).toBe(asset.id);

    const permitUpdate = await page.request.post('/api/safety', {
      data: { id: permitId, workOrderId: '', assetId: '', permitType: 'hot_work', permitNumber: 'PERMIT-E2E-UPDATED' },
    });
    expect(permitUpdate.ok()).toBeTruthy();
    const permits: { id: string; workOrderId: string; assetId: string; permitNumber: string }[] = await (await page.request.get('/api/safety')).json();
    const savedPermit = permits.find(item => item.id === permitId);
    expect(savedPermit).toMatchObject({ workOrderId: '', assetId: '', permitNumber: 'PERMIT-E2E-UPDATED' });

    const invalidOilResponse = await page.request.post('/api/oil-analysis', {
      data: {
        id: oilId, assetId: asset.id, sampleType: 'transformer', sampleDate: '2026-11-13',
        measurements: { viscosity40: '46' },
      },
    });
    expect(invalidOilResponse.status()).toBe(400);

    const oilResponse = await page.request.post('/api/oil-analysis', {
      data: {
        id: oilId, assetId: asset.id, sampleType: 'transformer', sampleDate: '2026-11-13',
        samplePoint: 'Main tank', sampleId: 'LAB-E2E-1', labName: 'E2E lab',
        assessment: 'action_required', assessmentNotes: 'Lab flagged this sample',
        measurements: { hydrogenPpm: '12', acetylenePpm: '0' },
      },
    });
    expect(oilResponse.ok()).toBeTruthy();

    const oilWorkOrderResponse = await page.request.post('/api/work-orders', {
      data: {
        id: oilWorkOrderId, assetId: asset.id, title: 'E2E oil follow-up',
        type: 'corrective', sourceOilAnalysisId: oilId,
      },
    });
    expect(oilWorkOrderResponse.ok()).toBeTruthy();

    const oilRecords: { id: string; followUpWorkOrderId?: string; measurements: Record<string, string> }[] = await (await page.request.get('/api/oil-analysis')).json();
    expect(oilRecords.find(item => item.id === oilId)).toMatchObject({
      followUpWorkOrderId: oilWorkOrderId,
      measurements: { hydrogenPpm: '12', acetylenePpm: '0' },
    });
  } finally {
    await page.request.delete('/api/safety', { data: { id: permitId } });
    await page.request.delete('/api/work-orders', { data: { id: oilWorkOrderId } });
    await page.request.delete('/api/work-orders', { data: { id: safetyWorkOrderId } });
    await page.request.delete('/api/oil-analysis', { data: { id: oilId } });
  }
});

test('deficient inspection hands off its site and evidence to a corrective work order', async ({ page }) => {
  let submittedWorkOrder: Record<string, unknown> | undefined;
  await page.route('**/api/assets', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{ id: 'INSPECT-ASSET', name: 'Intake Gate', siteId: 'SITE-INSPECT' }]),
  }));
  await page.route('**/api/config*', route => route.fulfill({
    contentType: 'application/json', body: JSON.stringify({ sites: [{ id: 'SITE-INSPECT', name: 'Intake Site' }] }),
  }));
  await page.route('**/api/compliance', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{ id: 'COMP-INSPECT', siteId: 'SITE-INSPECT', title: 'Annual gate inspection' }]),
  }));
  await page.route('**/api/inspections', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{
      id: 'INSP-DEFICIENT', siteId: 'SITE-INSPECT', assetId: 'INSPECT-ASSET',
      complianceObligationId: 'COMP-INSPECT', workOrderId: '', inspectionType: 'detailed',
      title: 'Intake gate inspection', description: '', scheduledDate: '2026-11-13',
      completedDate: '2026-11-13', inspector: 'Technician', findings: 'Gate binding during travel',
      recommendations: 'Inspect actuator and guides', correctiveActions: 'Repair required',
      readings: '', photos: '', status: 'deficient', priority: 'high',
    }]),
  }));
  await page.route('**/api/work-orders', async route => {
    if (route.request().method() === 'POST') {
      submittedWorkOrder = route.request().postDataJSON();
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'WO-INSPECT-1' }) });
    } else {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) });
    }
  });

  await openApp(page);
  await page.getByRole('navigation').getByRole('button', { name: 'Inspections', exact: true }).click();
  await expect(page.getByText('Intake Site')).toBeVisible();
  await expect(page.getByText('Annual gate inspection')).toBeVisible();
  await page.getByRole('button', { name: 'Raise corrective WO' }).click();

  const modal = page.locator('div.fixed.inset-0.z-50');
  await expect(modal.getByRole('heading', { name: 'New Work Order' })).toBeVisible();
  await expect(modal.getByLabel('Asset')).toHaveValue('INSPECT-ASSET');
  await expect(modal.getByLabel('Site')).toHaveValue('SITE-INSPECT');
  await expect(modal.locator('textarea').first()).toHaveValue(/Gate binding during travel/);
  await modal.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => submittedWorkOrder).toBeDefined();
  expect(submittedWorkOrder?.sourceInspectionId).toBe('INSP-DEFICIENT');
  expect(submittedWorkOrder?.siteId).toBe('SITE-INSPECT');
});

test('global search opens testing and root-cause records by their IDs', async ({ page }) => {
  await page.route('**/api/assets', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/api/work-orders', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/api/pm-tasks', route => route.fulfill({ contentType: 'application/json', body: '[]' }));
  await page.route('**/api/electrical-tests', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{
      id: 'TEST-SEARCH-1', assetId: '', discipline: 'mechanical', testType: 'vibration_analysis',
      testDate: '2026-11-13', results: 'Elevated vibration', nextDue: '', testedBy: 'Technician',
      status: 'failed', notes: '',
    }]),
  }));
  await page.route('**/api/root-cause-analyses', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify([{
      id: 'RCA-SEARCH-1', assetId: '', workOrderId: '', failureDate: '2026-11-13',
      failureMode: 'Bearing wear', symptoms: 'Rising vibration', causeCategory: 'maintenance',
      rootCause: 'Lubrication breakdown', contributingFactors: '', correctiveAction: '',
      preventiveAction: '', actionOwner: '', dueDate: '', status: 'open',
      createdBy: 'Technician', createdAt: '', updatedAt: '',
    }]),
  }));

  await openApp(page);
  await page.getByRole('button', { name: /Search/ }).first().click();
  const search = page.getByPlaceholder(/Search assets, work orders, PMs, tests, RCAs/);
  await search.fill('vibration');
  await page.getByRole('button', { name: /Testing.*vibration_analysis/ }).click();
  await expect(page.locator('[data-row-id="TEST-SEARCH-1"]')).toBeVisible();

  await page.getByRole('button', { name: /Search/ }).first().click();
  await page.getByPlaceholder(/Search assets, work orders, PMs, tests, RCAs/).fill('Bearing wear');
  await page.getByRole('button', { name: /RCA.*Bearing wear/ }).click();
  await expect(page.locator('[data-row-id="RCA-SEARCH-1"]')).toBeVisible();
});

test('PM schedule advances only when its generated work order is completed', async ({ page }) => {
  await openApp(page);
  const assetsResponse = await page.request.get('/api/assets');
  expect(assetsResponse.ok()).toBeTruthy();
  const assets: { id: string; status: string }[] = await assetsResponse.json();
  const asset = assets.find(candidate => candidate.status === 'operational');
  expect(asset, 'an operational asset is required for this workflow test').toBeDefined();
  if (!asset) return;

  const pmId = `PM-E2E-${Date.now()}`;
  let workOrderId = '';
  try {
    const createResponse = await page.request.post('/api/pm-tasks', {
      data: {
        id: pmId, assetId: asset.id, title: 'E2E PM completion timing',
        frequencyType: 'monthly', frequencyValue: 1, nextDue: '2000-01-01', active: true,
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    const generateResponse = await page.request.post('/api/pm-tasks/generate', { data: { pmId } });
    expect(generateResponse.ok()).toBeTruthy();
    workOrderId = (await generateResponse.json()).workOrderId;
    expect(workOrderId).toBeTruthy();

    const pendingSchedules: { id: string; nextDue: string; lastCompleted: string }[] = await (await page.request.get('/api/pm-tasks')).json();
    const pendingSchedule = pendingSchedules.find(schedule => schedule.id === pmId);
    expect(pendingSchedule?.nextDue).toBe('2000-01-01');
    expect(pendingSchedule?.lastCompleted).toBe('');

    expect((await page.request.post('/api/work-orders/transition', { data: { id: workOrderId, status: 'in_progress' } })).ok()).toBeTruthy();
    expect((await page.request.post('/api/work-orders/transition', { data: { id: workOrderId, status: 'completed' } })).ok()).toBeTruthy();

    const completedSchedules: { id: string; nextDue: string; lastCompleted: string }[] = await (await page.request.get('/api/pm-tasks')).json();
    const completedSchedule = completedSchedules.find(schedule => schedule.id === pmId);
    expect(completedSchedule?.lastCompleted).not.toBe('');
    expect(completedSchedule?.nextDue).not.toBe('2000-01-01');
  } finally {
    if (workOrderId) await page.request.delete('/api/work-orders', { data: { id: workOrderId } });
    await page.request.delete('/api/pm-tasks', { data: { id: pmId } });
  }
});

test('admin backup contains the complete application table manifest', async ({ page }) => {
  await openApp(page);
  const response = await page.request.get('/api/backup');
  expect(response.ok()).toBeTruthy();
  const backup: { version: string; tables: string[]; data: Record<string, unknown[]> } = await response.json();
  const expectedTables = [
    'users', 'site_config', 'assets', 'work_orders', 'pm_schedules', 'inventory',
    'vendors', 'purchase_orders', 'po_items', 'wo_parts', 'wo_labor', 'meter_readings',
    'audit_log', 'sites', 'compliance_obligations', 'inspections', 'documents',
    'safety_permits', 'testing_records', 'oil_analysis_records', 'root_cause_analyses', 'procedures',
    'procedure_steps', 'procedure_revisions', 'wo_checklist_items', 'asset_downtime',
    'asset_criticality',
  ];
  expect(backup.version).toBe('2.0');
  expect(backup.tables).toEqual(expectedTables);
  expect(Object.keys(backup.data).sort()).toEqual([...expectedTables].sort());
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
