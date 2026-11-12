export async function initializeServiceWorker({ isNative, isPreview, isProduction }) {
  if (!('serviceWorker' in navigator)) return;

  if (isNative || isPreview) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
    if ('caches' in globalThis) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }
    return;
  }

  if (!isProduction) return;

  const register = () => {
    navigator.serviceWorker
      .register('/sw.js')
      // Check on launch, but never tell a waiting worker to replace an open match.
      .then((registration) => registration.update())
      .catch(() => {});
  };

  if (globalThis.document?.readyState === 'complete') {
    register();
  } else {
    globalThis.addEventListener('load', register, { once: true });
  }
}
