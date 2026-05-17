import { useEffect, useRef } from 'react';

/**
 * Periodically re-calls `fn` every `ms` milliseconds.
 * Also re-calls when the browser tab becomes visible again, but throttled
 * so quickly switching tabs (or the OS firing `visibilitychange` for screen
 * locks, focus changes, devtools toggles, etc.) doesn't trigger a refetch
 * storm — which the user perceives as the page "looping" through refreshes.
 */
export function useAutoRefresh(fn: () => void, ms = 30_000) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    let lastTick = Date.now();
    const tick = () => { lastTick = Date.now(); ref.current(); };
    const id = setInterval(tick, ms);
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      // Throttle: only refire when at least `ms` has passed since the last call.
      if (Date.now() - lastTick < ms) return;
      tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [ms]);
}
