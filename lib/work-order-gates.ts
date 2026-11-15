/**
 * The status gates for a work order, in one place because they were not.
 *
 * They used to live inside the work-order route while `/api/work-orders/transition`
 * changed status with no check at all — the same action, two doors, only one guarded.
 * A safety control that a second endpoint can walk around is not a control, so every
 * writer of `status` calls this module instead of re-deriving the rules.
 *
 * Two decisions shape the design:
 *
 * - **Before, not after.** The completion gate documents work that already happened.
 *   The start gate is the one that can still prevent harm, so it runs on the
 *   transition into `in_progress`.
 * - **Never a network call.** A job must be startable while EHS is unreachable, and an
 *   outage must not read as approval. The start gate proves what it can from local
 *   records alone.
 */

import { getDb } from './db';
import { ehsStartBlocker } from './ehs-procedures';
import { getCompletionBlockers } from './operations';

export interface GateRefusal {
  error: string;
  status: number;
}

/**
 * @param nextStatus   the status being written
 * @param currentStatus the status already stored, before this write
 * @returns the refusal to return to the caller, or null when the write may proceed
 */
export async function workOrderGate(
  id: string,
  nextStatus: string,
  currentStatus: string,
): Promise<GateRefusal | null> {
  // Completing requires the checklist to be clear. Re-saving an already-completed
  // record is not a new completion and stays allowed.
  if (nextStatus === 'completed' && currentStatus !== 'completed') {
    const blockers = await getCompletionBlockers(id);
    if (blockers.length > 0) {
      return { error: `Cannot complete: ${blockers.join('; ')}`, status: 400 };
    }
  }

  // Starting requires the pinned evidence to still match this job. Editing a job that
  // is already running must not be locked out, so only the transition into
  // `in_progress` is gated.
  if (nextStatus === 'in_progress' && currentStatus !== 'in_progress') {
    const refusal = await ehsStartBlocker(await getDb(), id);
    if (refusal) return { error: refusal, status: 409 };
  }

  return null;
}
