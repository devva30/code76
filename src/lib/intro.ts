/**
 * Coordinates the branded intro loader with page entrance animations.
 * The decision is made once at startup so components can pause their
 * entrances synchronously before first paint.
 */
const SEEN_KEY = 'c76.intro.seen';

function decide(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    return sessionStorage.getItem(SEEN_KEY) !== '1';
  } catch {
    return true;
  }
}

let pending = decide();
const listeners = new Set<() => void>();

export const isIntroPending = () => pending;

/** Runs `fn` when the intro finishes (immediately if none is playing). Returns an unsubscribe. */
export function onIntroDone(fn: () => void) {
  if (!pending) {
    fn();
    return () => {};
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function completeIntro() {
  if (!pending) return;
  pending = false;
  try {
    sessionStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* private mode — intro may replay, which is harmless */
  }
  listeners.forEach((fn) => fn());
  listeners.clear();
}
