import { useEffect, useRef, useState } from 'react';

/**
 * Session countdown (SRS FR6).
 *
 * The server is the only clock that matters, but polling it every second would
 * be wasteful and would stutter on a slow connection. Instead we take one
 * server reading, measure the offset against the local clock, then tick
 * locally and re-sync every `syncEveryMs`. Every screen watching the same
 * session therefore shows the same number regardless of how wrong the
 * individual machines' clocks are.
 */
export function useCountdown(sessionId, { active, syncEveryMs = 10000, onFetch }) {
  const [remainingMs, setRemainingMs] = useState(0);
  const [status, setStatus] = useState('idle');
  const endsAtRef = useRef(null);
  const offsetRef = useRef(0);

  useEffect(() => {
    if (!sessionId || !active) {
      setRemainingMs(0);
      return undefined;
    }

    const controller = new AbortController();
    let syncTimer;
    let tickTimer;
    let cancelled = false;

    async function sync() {
      try {
        const data = await onFetch(sessionId, controller.signal);
        if (cancelled) return;
        offsetRef.current = new Date(data.serverTime).getTime() - Date.now();
        endsAtRef.current = data.endsAt ? new Date(data.endsAt).getTime() : null;
        setStatus(data.status);
      } catch (error) {
        if (error.name !== 'AbortError') setStatus('offline');
      }
    }

    function tick() {
      if (!endsAtRef.current) return;
      const serverNow = Date.now() + offsetRef.current;
      setRemainingMs(Math.max(0, endsAtRef.current - serverNow));
    }

    sync().then(tick);
    tickTimer = setInterval(tick, 250);
    syncTimer = setInterval(sync, syncEveryMs);

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(tickTimer);
      clearInterval(syncTimer);
    };
  }, [sessionId, active, syncEveryMs, onFetch]);

  return { remainingMs, status };
}

export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}
