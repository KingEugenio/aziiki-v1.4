import { useEffect, useRef, useState } from "react";

/**
 * Clamps a real loading flag to a minimum visible duration so a skeleton
 * never flashes for a handful of milliseconds on a fast connection or a warm
 * cache. This does not add delay that wasn't already implied by minMs - if
 * the real operation already took longer than minMs, the returned value
 * flips to false the instant isLoading does. The wait, when there is one, is
 * always `minMs - elapsed`, computed from the real timestamp loading
 * started at, never a blind fixed sleep.
 */
export function useMinimumLoadingTime(isLoading: boolean, minMs = 600): boolean {
  const [shouldShow, setShouldShow] = useState(isLoading);
  const startedAtRef = useRef<number | null>(isLoading ? Date.now() : null);

  useEffect(() => {
    if (isLoading) {
      startedAtRef.current = Date.now();
      setShouldShow(true);
      return;
    }

    const startedAt = startedAtRef.current;
    if (startedAt === null) {
      setShouldShow(false);
      return;
    }

    const remaining = minMs - (Date.now() - startedAt);
    if (remaining <= 0) {
      startedAtRef.current = null;
      setShouldShow(false);
      return;
    }

    const timer = setTimeout(() => {
      startedAtRef.current = null;
      setShouldShow(false);
    }, remaining);

    return () => clearTimeout(timer);
  }, [isLoading, minMs]);

  return shouldShow;
}
