import { test, expect } from '@playwright/test';
import { createClient } from '@libsql/client';
import { SignJWT } from 'jose';
import os from 'node:os';
import path from 'node:path';

const ehsOrigin = 'http://127.0.0.1:3131';
const cmmsOrigin = 'http://127.0.0.1:3132';
const mapping = { customerId: 'synthetic-customer', ehsInstanceId: 'synthetic-ehs', cmmsInstanceId: 'synthetic-cmms', ehsSiteId: 'PILOT-EHS', cmmsSiteId: 'PILOT-CMMS' };
const sourceToken = 'synthetic-procedure-read-token-only-12345';

async function token(role = 'manager', userId = 9901) {
  return new SignJWT({ userId, username: `pilot-${role}`, displayName: `Pilot ${role}`, role, tokenVersion: 0, forcePasswordChange: false })
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
    .sign(new TextEncoder().encode('synthetic-procedure-test-session-secret-only'));
}

test('real publication and attachment preserve A, surface B, reject scope violations, and preserve checklist rules', async ({ playwright, page }, testInfo) => {
  const directory = process.env.PROCEDURE_TEST_DIRECTORY;
  if (!directory || path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith('ops-procedure-pilot-')) throw new Error('Run only with playwright.procedure.config.ts');
  const plannerToken = await token();
  const ehs = await playwright.request.newContext({ baseURL: ehsOrigin, extraHTTPHeaders: { Origin: ehsOrigin, Cookie: `oeh_session=${plannerToken}` } });
  const cmms = await playwright.request.newContext({ baseURL: cmmsOrigin, extraHTTPHeaders: { Origin: cmmsOrigin, Cookie: `oc_session=${plannerToken}` } });
  const ehsDb = createClient({ url: `file:${path.join(directory, 'ehs.db').replace(/\\/g, '/')}` });
  const cmmsDb = createClient({ url: `file:${path.join(directory, 'cmms.db').replace(/\\/g, '/')}` });
  try {
    await ehs.get('/api/auth/session');
    await cmms.get('/api/auth/session');
    for (const db of [ehsDb, cmmsDb]) {
      await db.execute("INSERT INTO users(id,username,password_hash,display_name,role,active,force_password_change) VALUES(9901,'pilot-manager','synthetic-unused-hash','Pilot Manager','manager',1,0),(9902,'pilot-viewer','synthetic-unused-hash','Pilot Viewer','viewer',1,0)");
    }
    await ehsDb.execute("INSERT INTO sites(id,name) VALUES('PILOT-EHS','Synthetic EHS site')");
    await ehsDb.execute("INSERT INTO documents(id,number,kind,title,revision,status,content) VALUES('PILOT-SOP','PILOT-SOP','SOP','Synthetic procedure','A','Approved','Synthetic complete procedure A')");
    await cmmsDb.execute("INSERT INTO sites(id,name) VALUES('PILOT-CMMS','Synthetic CMMS site'),('PILOT-OTHER','Synthetic other site')");
    await cmmsDb.execute("INSERT INTO assets(id,name,site_id) VALUES('PILOT-ASSET','Synthetic asset','PILOT-CMMS')");
    await cmmsDb.execute("INSERT INTO work_orders(id,title,description,site_id,asset_id,status,assigned_to) VALUES('PILOT-WO','Synthetic maintenance','Synthetic scope','PILOT-CMMS','PILOT-ASSET','open','Synthetic crew'),('PILOT-WRONG','Other site work','Synthetic scope','PILOT-OTHER',NULL,'open','')");
    const publication = { documentId: 'PILOT-SOP', mapping, title: 'Synthetic procedure', revision: 'A', content: 'Synthetic complete procedure A', reviewedCompleteText: true };
    const first = await ehs.post('/api/documents/publish', { data: publication });
    expect(first.status(), await first.text()).toBe(201);
    const revisionA = (await first.json()).id;
    const sourcePath = `/api/integrations/procedure-revisions?${new URLSearchParams(mapping)}&revisionId=${revisionA}`;
    expect((await ehs.get(sourcePath)).status()).toBe(401);
    expect((await ehs.get(sourcePath, { headers: { Authorization: `Bearer ${sourceToken}` } })).status()).toBe(200);
    for (const key of Object.keys(mapping)) {
      const wrong = new URLSearchParams({ ...mapping, [key]: 'wrong' });
      expect((await ehs.get(`/api/integrations/procedure-revisions?${wrong}&revisionId=${revisionA}`, { headers: { Authorization: `Bearer ${sourceToken}` } })).status()).toBe(403);
    }
    expect((await cmms.get('/api/work-orders/ehs-procedure?workOrderId=PILOT-WRONG')).status()).toBe(403);
    const view = await (await cmms.get('/api/work-orders/ehs-procedure?workOrderId=PILOT-WO')).json();
    expect(view.options[0].revision.id).toBe(revisionA);
    const selection = { workOrderId: 'PILOT-WO', revisionId: revisionA, contextDigest: view.contextDigest };
    const viewerToken = await token('viewer', 9902);
    expect((await cmms.post('/api/work-orders/ehs-procedure', { data: selection, headers: { Cookie: `oc_session=${viewerToken}` } })).status()).toBe(403);
    expect((await cmms.post('/api/work-orders/ehs-procedure', { data: { ...selection, customerId: 'wrong' } })).status()).toBe(400);
    expect((await cmms.post('/api/work-orders/ehs-procedure', { data: selection, headers: { Origin: 'https://other.example.test' } })).status()).toBe(403);
    await page.context().addCookies([{ name: 'oc_session', value: plannerToken, url: cmmsOrigin }]);
    await page.goto('/app');
    await page.getByRole('button', { name: 'Work Orders', exact: true }).click();
    await page.getByPlaceholder('Search work orders...').fill('PILOT-WO');
    await page.getByRole('button', { name: 'View EHS procedure for PILOT-WO', exact: true }).click();
    await page.getByLabel('Approved procedure', { exact: true }).selectOption(revisionA);
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Attach revision', exact: true }).click();
    await expect(page.getByText('PILOT-SOP | Attached revision A', { exact: true })).toBeVisible();
    const before = await (await cmms.get('/api/work-orders/ehs-procedure?workOrderId=PILOT-WO')).json();
    const edited = await ehs.post('/api/documents', { data: { id: 'PILOT-SOP', title: publication.title, revision: 'B', status: 'Approved', owner: 'Pilot Manager', reviewDate: '', content: 'Synthetic complete procedure B', notes: 'Synthetic revision test' } });
    expect(edited.status()).toBe(200);
    const second = await ehs.post('/api/documents/publish', { data: { ...publication, revision: 'B', content: 'Synthetic complete procedure B' } });
    expect(second.status()).toBe(201);
    const after = await (await cmms.get('/api/work-orders/ehs-procedure?workOrderId=PILOT-WO')).json();
    expect(after.attachment).toEqual(before.attachment);
    expect(after.source.latest.revision).toBe('B');
    await page.getByRole('button', { name: 'Refresh procedure status' }).click();
    await expect(page.getByText(/Newer approved revision B available/)).toBeVisible();
    await expect(page.getByTestId('ehs-procedure-content')).toHaveText('Synthetic complete procedure A');
    await page.screenshot({ path: testInfo.outputPath('desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByTestId('ehs-procedure-content')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('mobile.png'), fullPage: true });
    await page.context().setOffline(true);
    await expect(page.getByRole('alert').filter({ hasText: 'Offline' })).toBeVisible();
    await expect(page.getByTestId('ehs-procedure-content')).toHaveText('Synthetic complete procedure A');
    await page.context().setOffline(false);
    await expect(page.getByText(/Newer approved revision B available/)).toBeVisible();
    await cmmsDb.execute("UPDATE work_orders SET assigned_to='Different synthetic crew' WHERE id='PILOT-WO'");
    expect((await (await cmms.get('/api/work-orders/ehs-procedure?workOrderId=PILOT-WO')).json()).attachment.contextChanged).toBe(true);
    await cmmsDb.execute("INSERT INTO wo_checklist_items(work_order_id,instruction) VALUES('PILOT-WO','Synthetic incomplete check')");
    expect((await cmms.post('/api/work-orders/transition', { data: { id: 'PILOT-WO', status: 'in_progress' } })).status()).toBe(200);
    expect((await cmms.post('/api/work-orders/transition', { data: { id: 'PILOT-WO', status: 'completed' } })).ok()).toBe(false);
    expect((await cmmsDb.execute("SELECT status FROM work_orders WHERE id='PILOT-WO'")).rows[0].status).toBe('in_progress');
    await cmmsDb.execute('UPDATE users SET active=0 WHERE id=9901');
    expect((await cmms.get('/api/work-orders/ehs-procedure?workOrderId=PILOT-WO')).status()).toBe(401);
  } finally { ehsDb.close(); cmmsDb.close(); await ehs.dispose(); await cmms.dispose(); }
});