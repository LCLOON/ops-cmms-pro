// Cross-module navigation. A page can send the user to another tab while
// carrying the record they were looking at, so "this asset's work orders" is a
// link rather than a manual re-search.
//
// Implemented as a window event because the shell already listened for one; it
// keeps every page from having to thread navigation props through the tree.

export type NavPage =
  | 'dashboard' | 'assets' | 'work-orders' | 'pm-schedule' | 'procedures'
  | 'inventory' | 'vendors' | 'purchase-orders' | 'compliance' | 'documents'
  | 'safety' | 'inspections' | 'reports' | 'electrical' | 'advisor' | 'help' | 'admin';

export interface NavParams {
  /** Open/highlight this specific record. */
  focusId?: string;
  /** Pre-filter a list to this asset. */
  assetId?: string;
  /** Pre-fill a list's search box (e.g. a free-text supplier name). */
  search?: string;
}

export interface NavIntent extends NavParams {
  page: NavPage;
}

export function navigate(page: NavPage, params: NavParams = {}): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('nav', { detail: { page, ...params } satisfies NavIntent }));
}
