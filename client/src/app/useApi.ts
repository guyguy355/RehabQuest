import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';

type State<T> = { data: T | null; error: ApiError | null; loading: boolean };

/** Loads `path` on mount (and when it changes). `reload()` refetches without clearing the data. */
export function useApi<T>(path: string | null) {
  const [state, setState] = useState<State<T>>({ data: null, error: null, loading: Boolean(path) });
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!path) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState((current) => ({ ...current, loading: true, error: null }));

    try {
      const data = await api<T>(path, { signal: controller.signal });
      if (!controller.signal.aborted) setState({ data, error: null, loading: false });
    } catch (error) {
      if (controller.signal.aborted) return;
      setState((current) => ({
        data: current.data,
        error: error instanceof ApiError ? error : new ApiError(0, 'Something went wrong. Please try again.'),
        loading: false,
      }));
    }
  }, [path]);

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
  }, [load]);

  return { ...state, reload: load, setData: (data: T) => setState((current) => ({ ...current, data })) };
}
