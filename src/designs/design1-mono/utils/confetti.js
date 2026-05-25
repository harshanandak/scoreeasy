let fallbackSeed = Date.now() >>> 0;

function randomUnit() {
  if (globalThis.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0] / 0x100000000;
  }

  fallbackSeed = (Math.imul(fallbackSeed, 1664525) + 1013904223) >>> 0;
  return fallbackSeed / 0x100000000;
}

function prefersReducedMotion() {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function triggerConfetti({
  colors = ['#0066ff', '#00cc88', '#ff6b6b', '#ffd93d', '#a569bd'],
  count = 50,
  includeDuration = true,
} = {}) {
  if (typeof document === 'undefined') return;
  if (prefersReducedMotion()) return;

  const overlay = document.createElement('div');
  overlay.className = 'mono-confetti-overlay';
  document.body.appendChild(overlay);

  for (let index = 0; index < count; index += 1) {
    const confetti = document.createElement('div');
    confetti.className = 'mono-confetti mono-confetti-animate';
    confetti.style.left = `${randomUnit() * 100}%`;
    confetti.style.backgroundColor = colors[Math.floor(randomUnit() * colors.length)];
    confetti.style.animationDelay = `${randomUnit() * 0.5}s`;
    if (includeDuration) {
      confetti.style.animationDuration = `${2 + randomUnit()}s`;
    }
    overlay.appendChild(confetti);
  }

  setTimeout(() => overlay.remove(), 3500);
}
