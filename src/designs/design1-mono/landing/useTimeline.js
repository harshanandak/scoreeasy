import { useEffect, useRef, useState } from 'react';

/* The one clock behind Home's animation cards and the rail that carries them.

   useTimeline(timeline, running, { loop, onEnd, resetKey }) returns the index of the frame to show.
   The index moves at each `times` entry while `running`. Pausing keeps the elapsed time, so play
   resumes where it stopped; a new `resetKey` starts again from the top. When the loop is over it
   either starts again (`loop`) or calls `onEnd` once and holds the last frame.
   Time is counted from Date.now(), so a throttled or hidden tab cannot slow it down: it catches up
   when its timers next run. */
export function useTimeline(timeline, running, { loop = false, onEnd, resetKey = 0 } = {}) {
  const [frame, setFrame] = useState({ key: resetKey, index: 0 });
  const [cycle, setCycle] = useState(0);
  const elapsed = useRef(0);
  const reached = useRef(0);
  const reported = useRef(false);
  const endRef = useRef(onEnd);

  useEffect(() => { endRef.current = onEnd; });
  useEffect(() => {
    elapsed.current = 0;
    reached.current = 0;
    reported.current = false;
    setFrame({ key: resetKey, index: 0 });
  }, [resetKey]);

  useEffect(() => {
    if (!running) return undefined;
    if (elapsed.current >= timeline.loopMs) {
      if (!loop) {
        if (!reported.current) { reported.current = true; endRef.current?.(); }
        return undefined;
      }
      elapsed.current = 0;
      reached.current = 0;
      setFrame({ key: resetKey, index: 0 });
    }
    const from = elapsed.current;
    const startedAt = Date.now() - from;
    const timers = [];
    let finished = false;
    timeline.times.forEach((time, index) => {
      if (index <= reached.current) return;
      timers.push(window.setTimeout(() => { reached.current = index; setFrame({ key: resetKey, index }); }, Math.max(0, time - from)));
    });
    timers.push(window.setTimeout(() => {
      finished = true;
      elapsed.current = timeline.loopMs;
      if (loop) setCycle((c) => c + 1);
      else { reported.current = true; endRef.current?.(); }
    }, Math.max(0, timeline.loopMs - from)));
    return () => {
      if (!finished) elapsed.current = Math.max(elapsed.current, Date.now() - startedAt);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [running, timeline, loop, resetKey, cycle]);

  return frame.key === resetKey ? frame.index : 0;
}

/* The same running-time counting for something that is not a card: calls `onDone` once `ms` of
   running time has passed, and retries on a 500 ms check once 1.5 s overdue. The second path is the
   safety net: if the end timer was throttled, lost or its callback did nothing, the next 500 ms check
   sees the deadline has passed (by the wall clock) and calls `onDone` again, so a rail can never sit
   on one card for good. Not counted while `running` is false. */
export const OVERDUE_RETRY_MS = 1500;

export function useDeadline(ms, running, onDone, resetKey = 0) {
  const elapsed = useRef(0);
  const doneRef = useRef(onDone);

  useEffect(() => { doneRef.current = onDone; });
  useEffect(() => { elapsed.current = 0; }, [resetKey]);

  useEffect(() => {
    if (!running) return undefined;
    const base = elapsed.current;
    const startedAt = Date.now();
    const end = window.setTimeout(() => doneRef.current?.(), Math.max(0, ms - base));
    const watch = window.setInterval(() => {
      if (base + (Date.now() - startedAt) >= ms + OVERDUE_RETRY_MS) doneRef.current?.();
    }, 500);
    return () => {
      elapsed.current = base + (Date.now() - startedAt);
      window.clearTimeout(end);
      window.clearInterval(watch);
    };
  }, [ms, running, resetKey]);
}
