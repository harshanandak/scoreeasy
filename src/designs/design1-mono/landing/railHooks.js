import { useEffect, useState } from 'react';

/* Small browser hooks for Home's rail and page. Each one is safe where the API is missing (jsdom,
   old webviews): no matchMedia reads as "no match" (the phone layout, full motion), no
   IntersectionObserver reads as "in view". */

const matches = (query) => (typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  ? window.matchMedia(query).matches
  : false);

/** True while the media query matches; follows changes. */
export function useMediaQuery(query) {
  const [on, setOn] = useState(() => matches(query));
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const list = window.matchMedia(query);
    const onChange = () => setOn(list.matches);
    onChange();
    list.addEventListener?.('change', onChange);
    return () => list.removeEventListener?.('change', onChange);
  }, [query]);
  return on;
}

export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');

/** 'phone' (< 768px), 'tablet' (768-1023px) or 'desktop' (1024px and up). */
export function useBreakpoint() {
  const tablet = useMediaQuery('(min-width: 768px)');
  const desktop = useMediaQuery('(min-width: 1024px)');
  if (desktop) return 'desktop';
  return tablet ? 'tablet' : 'phone';
}

/** True while the tab is hidden. */
export function useTabHidden() {
  const [hidden, setHidden] = useState(() => (typeof document !== 'undefined' ? document.hidden : false));
  useEffect(() => {
    const onChange = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return hidden;
}

/** True while at least `threshold` of the element is on screen (always true without IntersectionObserver). */
export function useInView(ref, threshold = 0) {
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => setInView(entry.isIntersecting && entry.intersectionRatio >= threshold)),
      { threshold: threshold > 0 ? [0, threshold, 1] : [0] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, threshold]);
  return inView;
}

/* Keyboard focus is a reason to hold the rail; the focus a tap or a click leaves behind is not (a tap
   on a dot or the Pause button, or a touch on the rail's own tab stop, would hold it for good). So
   focus only counts when the last thing the visitor did was press a key. */
let keyboardLast = false;
export const usingKeyboard = () => keyboardLast;

/* Holds the rail's reasons to stand still: a finger or the pointer on it, keyboard focus in it. */
export function useHold() {
  const [hold, setHold] = useState({ hover: false, focus: false, touch: false });
  useEffect(() => {
    keyboardLast = false;
    const key = () => { keyboardLast = true; };
    const pointer = () => { keyboardLast = false; };
    document.addEventListener('keydown', key, true);
    document.addEventListener('pointerdown', pointer, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      document.removeEventListener('pointerdown', pointer, true);
    };
  }, []);
  const set = (key, value) => setHold((h) => (h[key] === value ? h : { ...h, [key]: value }));
  return { set, held: Object.values(hold).some(Boolean) };
}
