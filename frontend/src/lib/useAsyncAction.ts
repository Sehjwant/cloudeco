import { useCallback, useState } from 'react';

interface AsyncState<T> {
  loading: boolean;
  error: string | null;
  result: T | null;
}

/**
 * Small helper to drive the loading / error / result lifecycle of an async
 * action (an API call) without repeating boilerplate in every feature panel.
 */
export function useAsyncAction<T>(fn: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({
    loading: false,
    error: null,
    result: null,
  });

  const run = useCallback(async () => {
    setState({ loading: true, error: null, result: null });
    try {
      const result = await fn();
      setState({ loading: false, error: null, result });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ loading: false, error: message, result: null });
      return undefined;
    }
  }, [fn]);

  const reset = useCallback(() => setState({ loading: false, error: null, result: null }), []);

  return { ...state, run, reset };
}
