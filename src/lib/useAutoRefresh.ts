import { useEffect, useRef } from 'react';

/**
 * Periodically re-calls `fn` every `ms` milliseconds.
 * Also re-calls when the browser tab becomes visible again.
 */
export function useAutoRefresh(fn: () => void, ms = 30_000) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const tick = () => ref.current();
    const id = setInterval(tick, ms);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [ms]);
}
