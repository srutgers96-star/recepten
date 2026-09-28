import { registerSW } from 'virtual:pwa-register';
import { signal } from '@preact/signals';

/** True when a new version has been downloaded and is waiting for the user's "Vernieuwen" tap. */
export const updateReady = signal(false);
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Never reload on our own — the user may be mid-recipe. The UI shows a "Nieuwe versie" bar.
      updateReady.value = true;
    },
  });
  // A worker that was downloaded during an earlier visit and is still waiting (the app was reopened
  // before the user tapped "Vernieuwen") never triggers onNeedRefresh again — show the bar anyway.
  void navigator.serviceWorker.getRegistration().then((reg) => {
    if (reg?.waiting) updateReady.value = true;
  });
}

/**
 * Activate the waiting worker and reload. Belt and braces: the plugin's updateSW() messages the
 * worker it tracks, but a worker installed by another tab/visit can be invisible to it, so we also
 * message `registration.waiting` ourselves and reload on controllerchange (or after 3 s regardless —
 * a fully closed and reopened app gets the new worker anyway).
 */
export async function reloadToNewVersion() {
  let reloaded = false;
  const reload = () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  };
  navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
  try {
    if (applyUpdate) await applyUpdate(true);
  } catch {
    /* fall through to the manual path */
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  } catch {
    /* ignore */
  }
  setTimeout(reload, 3000);
}

/** Ask for durable storage on every launch (heuristically granted on installed apps). */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export function isStandalone(): boolean {
  return matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}
