import { useCallback, useEffect, useRef, useState } from 'react';
import { STORIES, storyFrame } from './storyTimelines';

export function useHomeMedia(query) {
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return undefined;
    const change = () => setMatches(media.matches);
    change();
    media.addEventListener?.('change', change);
    return () => media.removeEventListener?.('change', change);
  }, [query]);
  return matches;
}

export default function useHomeStory(stageRef, reduced, ctaHeld) {
  const [position, setPosition] = useState({ index: 0, step: -1 });
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(document.hidden);
  const clock = useRef({ index: 0, elapsed: 0, step: -1 });
  const pointer = useRef(null);
  const playing = !paused && !ctaHeld && visible && !hidden;

  const navigate = useCallback((direction) => {
    const index = (clock.current.index + direction + STORIES.length) % STORIES.length;
    clock.current = { index, elapsed: 0, step: -1 };
    setPosition({ index, step: -1 });
    setPaused(false);
  }, []);

  useEffect(() => {
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio >= 0.3),
      { threshold: [0, 0.3] },
    );
    if (stageRef.current) observer?.observe(stageRef.current);
    const visibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      observer?.disconnect();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [stageRef]);

  useEffect(() => {
    if (!playing) return undefined;
    let last = performance.now();
    let timer;
    const current = clock.current;
    const duration = (index) => reduced ? 6000 : STORIES[index].duration * 1000;
    const tick = () => {
      const now = performance.now();
      current.elapsed += now - last;
      last = now;
      while (current.elapsed >= duration(current.index)) {
        current.elapsed -= duration(current.index);
        current.index = (current.index + 1) % STORIES.length;
      }
      const step = reduced ? -1 : storyFrame(current.index, current.elapsed / 1000).step;
      if (current.index !== position.index || step !== current.step) {
        current.step = step;
        setPosition({ index: current.index, step });
      }
      const nextStep = !reduced && STORIES[current.index].steps.find(([at]) => at * 1000 > current.elapsed);
      const boundary = nextStep ? nextStep[0] * 1000 : duration(current.index);
      timer = setTimeout(tick, Math.max(1, boundary - current.elapsed));
    };
    tick();
    return () => {
      clearTimeout(timer);
      // Preserve the partial step when a hold or user pause interrupts a boundary timer.
      if (clock.current === current) current.elapsed += performance.now() - last;
    };
  }, [playing, position.index, reduced]);

  const cancelPointer = () => { pointer.current = null; };
  const handlers = {
    onPointerDown(event) {
      if (event.target.closest('button') || (event.button != null && event.button !== 0)) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      pointer.current = { x: event.clientX, y: event.clientY, moved: false };
    },
    onPointerMove(event) {
      if (pointer.current && Math.hypot(event.clientX - pointer.current.x, event.clientY - pointer.current.y) > 12) {
        pointer.current.moved = true;
      }
    },
    onPointerUp(event) {
      const down = pointer.current;
      cancelPointer();
      if (!down) return;
      const dx = event.clientX - down.x;
      const dy = event.clientY - down.y;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) navigate(dx < 0 ? 1 : -1);
      else if (!down.moved && Math.hypot(dx, dy) <= 12) setPaused((value) => !value);
    },
    onPointerCancel: cancelPointer,
    onLostPointerCapture: cancelPointer,
    onKeyDown(event) {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault(); navigate(event.key === 'ArrowRight' ? 1 : -1);
      } else if (event.key === ' ') { event.preventDefault(); setPaused((value) => !value); }
    },
  };
  const time = reduced ? STORIES[position.index].duration
    : position.step < 0 ? 0 : STORIES[position.index].steps[position.step][0];
  return {
    index: position.index, state: storyFrame(position.index, time), playing, paused,
    togglePaused: () => setPaused((value) => !value), handlers,
  };
}
