import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const directory = process.env.PROCEDURE_TEST_DIRECTORY || mkdtempSync(path.join(os.tmpdir(), 'ops-procedure-pilot-'));
if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith('ops-procedure-pilot-')) throw new Error('Pilot tests require a dedicated temporary directory');
process.env.PROCEDURE_TEST_DIRECTORY = directory;
const mapping = JSON.stringify({ customerId: 'synthetic-customer', ehsInstanceId: 'synthetic-ehs', cmmsInstanceId: 'synthetic-cmms', ehsSiteId: 'PILOT-EHS', cmmsSiteId: 'PILOT-CMMS' });
const common = {
  TURSO_AUTH_TOKEN: '', JWT_SECRET: 'synthetic-procedure-test-session-secret-only',
  OPS_PROCEDURE_PILOT_ENABLED: '1', OPS_PROCEDURE_DEDICATED_CUSTOMER_CONFIRMED: '1',
  OPS_PROCEDURE_PILOT_MAPPING: mapping, OPS_PROCEDURE_READ_TOKEN: 'synthetic-procedure-read-token-only-12345',
  OPS_EHS_DISABLE_AUTH: '', OPS_EHS_DEV_LOGIN: '', OPS_EHS_ALLOW_DEMO_PASSWORDS: '',
};

export default defineConfig({
  testDir: './tests/procedure-pilot', workers: 1, fullyParallel: false, timeout: 120000,
  reporter: [['list']], outputDir: 'test-results/procedure-pilot',
  use: { baseURL: 'http://127.0.0.1:3132', trace: 'retain-on-failure' },
  webServer: [
    {
      command: 'npm run dev -- --hostname 127.0.0.1 --port 3131', cwd: path.resolve(__dirname, '../ops-ehs-pro'),
      url: 'http://127.0.0.1:3131', reuseExistingServer: false, timeout: 120000,
      env: { ...common, TURSO_DATABASE_URL: `file:${path.join(directory, 'ehs.db').replace(/\\/g, '/')}` },
    },
    {
      command: 'npm run dev -- --hostname 127.0.0.1 --port 3132', cwd: __dirname,
      url: 'http://127.0.0.1:3132', reuseExistingServer: false, timeout: 120000,
      env: { ...common, TURSO_DATABASE_URL: `file:${path.join(directory, 'cmms.db').replace(/\\/g, '/')}`, OPS_EHS_PROCEDURE_ORIGIN: 'http://127.0.0.1:3131' },
    },
  ],
});