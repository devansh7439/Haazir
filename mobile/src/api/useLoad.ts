import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads data once, and again on `reload` (pull to refresh) or when `deps` change. Only the newest request may set
 * the result, so a slow older answer can't replace a newer one.
 */
export function useLoad<T>(load: () => Promise<T>, deps: ReadonlyArray<unknown>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const seq = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const run = useCallback(async (pull: boolean) => {
    const mine = ++seq.current;
    if (pull) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await loadRef.current();
      if (mine !== seq.current) return;
      setData(next);
      setError(null);
    } catch (err) {
      if (mine !== seq.current) return;
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      if (mine === seq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void run(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, refreshing, reload: useCallback(() => run(true), [run]) };
}
