import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizeJobStatusRequest, buildWorkOrderStatus, getJobStatusConfig } from '../lib/job-status.ts';

const mapping = { customerId: 'customer-a', cmmsInstanceId: 'cmms-a', consumerInstanceId: 'loto-a', consumerApp: 'loto', consumerSiteId: 'site-cmms' };
const env = {
  OPS_CMMS_JOB_STATUS_ENABLED: '1', OPS_CMMS_JOB_STATUS_TOKEN: 's'.repeat(40),
  OPS_CMMS_JOB_STATUS_MAPPING: JSON.stringify(mapping),
};
const config = getJobStatusConfig(env);
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const params = { ...mapping, workOrderId: 'WO-1', requestId };
const call = (search = params, token = config.token) =>
  new Request(`https://cmms.invalid/api/integrations/work-order-status?${new URLSearchParams(search)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
const row = { id: 'WO-1', title: 'Replace seal', status: 'in_progress', asset_id: 'asset-a', assigned_to: 'Acme', site_id: 'site-cmms' };

test('the work-order status endpoint is opt-in and needs a credential', () => {
  assert.throws(() => getJobStatusConfig({}));
  assert.throws(() => getJobStatusConfig({ ...env, OPS_CMMS_JOB_STATUS_TOKEN: 'short' }));
  assert.equal(getJobStatusConfig(env).mapping.customerId, 'customer-a');
});

test('service authentication rejects a wrong token before anything else', () => {
  assert.throws(() => authorizeJobStatusRequest(call(params, 'x'.repeat(40)), config), /Unauthorized/);
  assert.throws(() => authorizeJobStatusRequest(new Request(`https://cmms.invalid/api/integrations/work-order-status?${new URLSearchParams(params)}`), config), /Unauthorized/);
});

test('duplicate, extra or mismatched scope is refused', () => {
  for (const key of Object.keys(mapping)) {
    const wrong = { ...params, [key]: key === 'consumerApp' ? 'ehs' : 'wrong' };
    assert.throws(() => authorizeJobStatusRequest(call(wrong), config));
    const duplicated = { ...params };
    assert.throws(() => authorizeJobStatusRequest(
      new Request(`https://cmms.invalid/api/integrations/work-order-status?${new URLSearchParams(duplicated)}&customerId=extra`, { headers: { authorization: `Bearer ${config.token}` } }),
      config,
    ));
  }
  assert.throws(() => authorizeJobStatusRequest(
    new Request(`https://cmms.invalid/api/integrations/work-order-status?${new URLSearchParams({ ...params, unexpected: 'x' })}`, { headers: { authorization: `Bearer ${config.token}` } }),
    config,
  ), /Exact work-order scope/);
});

test('the payload is minimal, scoped and refuses a work order outside the site', () => {
  const scope = authorizeJobStatusRequest(call(), config);
  const payload = buildWorkOrderStatus(row, scope, new Date('2026-01-01T00:00:00.000Z'));
  assert.equal(payload.workOrderId, 'WO-1');
  assert.equal(payload.status, 'in_progress');
  assert.equal(payload.requestId, requestId);
  // No cost, notes or description leave CMMS.
  for (const leaked of ['partsCost', 'laborHours', 'resolution', 'description']) assert.ok(!(leaked in payload));
  assert.throws(() => buildWorkOrderStatus({ ...row, site_id: 'site-other' }, scope), /outside the configured site/);
  assert.throws(() => buildWorkOrderStatus(undefined, scope), /not found/);
});
