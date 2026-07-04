// ---------------------------------------------------------------------------
// Shared lazy-load helper — replaces the duplicated load() pattern across
// all web route files. Caches the import promise so each module loads once.
// ---------------------------------------------------------------------------

/** Creates a lazy loader for an async import. Calls the import once, caches the result. */
export function createLoader<T>(importFn: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;
  return () => {
    if (!promise) promise = importFn();
    return promise;
  };
}
