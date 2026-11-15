/**
 * Guard against the regression this module exists to prevent.
 *
 * `/api/work-orders/transition` changed status with no gate at all while the
 * work-order route enforced the checklist — one action, two doors, one guarded.
 * A source-level check is the cheapest way to stop a second unguarded door
 * reappearing, because a runtime test of one route cannot see the others.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const writers = [
  '../app/api/work-orders/route.ts',
  '../app/api/work-orders/transition/route.ts',
];

for (const file of writers) {
  test(`${file} gates every status write`, async () => {
    const source = await readFile(new URL(file, import.meta.url), 'utf8');

    assert.match(source, /from '@\/lib\/work-order-gates'/, 'must use the shared gate module');

    const gates = (source.match(/workOrderGate\(/g) ?? []).length;
    const mutations = (source.match(/upsertWorkOrder\(|transitionWorkOrderStatus\(/g) ?? []).length;
    assert.ok(mutations > 0, 'expected this file to write work-order status');
    assert.ok(
      gates >= mutations,
      `each status write needs a gate call: ${gates} gate(s) for ${mutations} write(s)`,
    );

    // The rules must not be re-derived here; duplicated copies drift.
    assert.doesNotMatch(source, /function completionBlocker/);
    assert.doesNotMatch(source, /function startBlocker/);
  });
}
