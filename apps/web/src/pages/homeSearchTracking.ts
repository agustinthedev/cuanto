export type PendingHomepageSearch = { query: string; categoryId: string };

export function clearPendingHomepageSearch(ref: { current: PendingHomepageSearch | null }) {
  ref.current = null;
}
