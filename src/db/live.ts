// Small Dexie liveQuery -> Preact hook bridge.
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';

/** Re-runs `query` whenever the tables it touched change; `initial` until the first result. */
export function useLiveQuery<T>(query: () => Promise<T>, deps: unknown[], initial: T): T {
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: (v) => setValue(v),
      error: (e) => console.error('liveQuery', e),
    });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

/** Contract name (docs/phase-1-spec.md §3): `undefined` until the first result. */
export function useLive<T>(querier: () => Promise<T>, deps: unknown[]): T | undefined {
  return useLiveQuery<T | undefined>(querier, deps, undefined);
}
