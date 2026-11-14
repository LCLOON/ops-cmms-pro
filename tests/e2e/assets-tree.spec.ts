import { expect, test } from '@playwright/test';

// Assets open on the hierarchy by default, and the tree is the primary way to
// enter data: click a node to open it, add equipment beneath it without hunting
// for a parent picker.
test('assets start in tree view and a child can be added from a node', async ({ page }) => {
  await page.goto('/app');
  await page.getByRole('button', { name: 'Assets', exact: true }).click();

  // Tree is the default view: the hierarchy is present and the table's search
  // box (only rendered by DataTable) is not.
  await expect(page.getByRole('heading', { name: 'Asset Hierarchy' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByPlaceholder('Search assets...')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Pick an asset to work on' })).toBeVisible();

  // Select a top-level facility from the tree.
  const treeRows = page.locator('div[role="button"]').filter({ hasNot: page.locator('input') });
  const firstRow = treeRows.first();
  await expect(firstRow).toBeVisible();
  const parentName = (await firstRow.innerText()).split('\n')[0].trim();
  await firstRow.click();

  await expect(page.getByRole('button', { name: 'Edit this asset' })).toBeVisible();
  await expect(page.getByRole('heading', { name: parentName, exact: true })).toBeVisible();

  // Adding a child pre-fills the parent, so the user only types a name.
  const uniqueName = `E2E Child ${Date.now().toString(36).toUpperCase()}`;
  await page.getByRole('button', { name: 'Add child asset', exact: true }).click();
  const modal = page.locator('div.fixed.inset-0.z-50');
  await expect(modal).toBeVisible({ timeout: 10_000 });
  await expect(modal).toContainText('Adding under:');

  await page.locator('#asset-name').fill(uniqueName);
  await page.getByRole('button', { name: 'Save asset' }).click();
  await expect(modal).toBeHidden({ timeout: 15_000 });

  // The new asset is created under the parent and selected straight away.
  await expect(page.getByRole('heading', { name: uniqueName, exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('div[role="button"]', { hasText: uniqueName }).first()).toBeVisible();

  // Delete it again so the suite leaves no residue.
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pick an asset to work on' })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(uniqueName)).toHaveCount(0);
});
