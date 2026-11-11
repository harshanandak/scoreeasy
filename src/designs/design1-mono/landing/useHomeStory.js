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
  const [held, setHeld] = useState(false);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(document.hidden);
  const clock = useRef({ index: 0, elapsed: 0, step: -1 });
  const pointer = useRef(null);
  const holdTimer = useRef(null);
  const playing = !reduced && !paused && !held && !ctaHeld && visible && !hidden;

  const navigate = useCallback((direction) => {
    const index = (clock.current.index + direction + STORIES.length) % STORIES.length;
    clock.current = { index, elapsed: 0, step: -1 };
    setPosition({ index, step: -1 });
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
      clearTimeout(holdTimer.current);
    };
  }, [stageRef]);

  useEffect(() => {
    if (!playing) return undefined;
    let last = performance.now();
    let frameId;
    const tick = (now) => {
      const current = clock.current;
      current.elapsed += (now - last) / 1000;
      last = now;
      if (current.elapsed >= STORIES[current.index].duration) navigate(1);
      else {
        const { step } = storyFrame(current.index, current.elapsed);
        if (step !== current.step) {
          current.step = step;
          setPosition({ index: current.index, step });
        }
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playing, navigate]);

  const cancelPointer = () => {
    clearTimeout(holdTimer.current);
    pointer.current = null;
    setHeld(false);
  };
  const handlers = {
    onPointerDown(event) {
      if (event.target.closest('button') || (event.button != null && event.button !== 0)) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      pointer.current = { x: event.clientX, y: event.clientY, held: false, moved: false };
      holdTimer.current = setTimeout(() => {
        if (pointer.current) { pointer.current.held = true; setHeld(true); }
      }, 220);
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
      else if (!down.held && !down.moved && Math.hypot(dx, dy) <= 12) {
        const rect = event.currentTarget.getBoundingClientRect();
        navigate(event.clientX - rect.left < rect.width / 3 ? -1 : 1);
      }
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
