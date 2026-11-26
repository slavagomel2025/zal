// Wake Lock: не даём экрану погаснуть, пока идёт отдых.
// iOS 16.4+ поддерживает Screen Wake Lock в Safari.

let sentinel = null;

export async function keepAwake() {
  try {
    if (!('wakeLock' in navigator) || sentinel) return;
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      sentinel = null;
    });
  } catch (err) {
    // Отказ не критичен: приложение продолжает работать, экран может погаснуть.
    console.warn('wake lock unavailable:', err);
  }
}

export function releaseAwake() {
  try {
    if (sentinel) sentinel.release();
  } catch (err) {
    // ignore
  }
  sentinel = null;
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !sentinel) {
    keepAwake();
  }
});
