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
}

export async function reloadToNewVersion() {
  if (applyUpdate) await applyUpdate(true);
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
