import { signal } from '@preact/signals';

/** True when a new version has been downloaded and is waiting for the user's "Vernieuwen" tap. */
export const updateReady = signal(false);
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // `virtual:pwa-register` is loaded here, not at the top: this module also holds the pure browser
  // facts (browserName, chromeIntentUrl) that tests/pwa.test.ts imports in Node, where the plugin's
  // virtual module does not exist. The registration itself is unchanged (immediate, prompt-style).
  void import('virtual:pwa-register').then(({ registerSW }) => {
    applyUpdate = registerSW({
      immediate: true,
      onNeedRefresh() {
        // Never reload on our own — the user may be mid-recipe. The UI shows a "Nieuwe versie" bar.
        updateReady.value = true;
      },
    });
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

// --- Platform and browser facts (phase 6, docs/phase-6-spec.md 13B) ------------------------------
// Stijn's default browser was Opera: a share link opened Opera, the recipe was saved in Opera's OWN
// storage and never showed up in the app (installed via Chrome, which shares Chrome's storage).
// These helpers let the UI say so and offer "Open in Chrome". Pure functions of the user agent,
// so tests/pwa.test.ts can pin them in Node.

export type BrowserName = 'chrome' | 'samsung' | 'firefox' | 'opera' | 'edge' | 'safari' | 'other';

/** Android phone or tablet, also inside a WebView. */
export function isAndroid(ua: string = navigator.userAgent): boolean {
  return /Android/i.test(ua);
}

/**
 * The browser the app runs in. Order matters: Samsung Internet, Opera (OPR), Edge (EdgA) and Chrome
 * on iOS (CriOS) all also say "Chrome" and "Safari"; Firefox says neither. An Android WebView
 * ("; wv)", the in-app browser of another app) and the smaller Chromium forks (Vivaldi, Yandex,
 * DuckDuckGo, UC, Mi, Huawei) each have their own storage too, so they count as 'other' and get the
 * "Open in Chrome" button as well. Brave hides itself in the user agent and reads as 'chrome'.
 */
export function browserName(ua: string = navigator.userAgent): BrowserName {
  if (/SamsungBrowser\//.test(ua)) return 'samsung';
  if (/(?:Firefox|FxiOS)\//.test(ua)) return 'firefox';
  if (/(?:OPR|OPT|OPiOS|Opera)\//.test(ua)) return 'opera';
  if (/(?:EdgA|EdgiOS|Edge|Edg)\//.test(ua)) return 'edge';
  if (/;\s*wv\)/.test(ua) || /(?:Vivaldi|YaBrowser|DuckDuckGo|UCBrowser|MiuiBrowser|HuaweiBrowser)\//.test(ua)) return 'other';
  if (/(?:Chrome|CriOS)\//.test(ua)) return 'chrome';
  if (/Version\/\S+.*Safari\//.test(ua)) return 'safari';
  return 'other';
}

/**
 * An Android intent URL that opens `url` in Chrome (package com.android.chrome) from any other
 * browser. Our share links live in the URL FRAGMENT (#r=…); in an intent URL that fragment goes
 * BEFORE "#Intent;": Android's Intent.parseUri takes the text after the LAST '#' as the intent spec
 * and everything before it as the data URL, so the token travels along and Chrome (and so, usually,
 * the installed app) lands straight on the import preview. `scheme` is the URL's own (https on the
 * site, http on the dev server). `S.browser_fallback_url` is what Chrome itself opens when the
 * package is missing; other browsers ignore it, and some ignore intent: links altogether, which is
 * why the UI always offers "copy the link and paste it in Chrome" next to this button.
 *
 * Whether the WebAPK then takes over is up to Android (ADR-0001: link capture is not guaranteed),
 * and whether Opera / Samsung Internet / Firefox honour the intent at all has to be confirmed on a
 * real phone: a DEVICE-TEST row, not a promise in the UI.
 */
export function chromeIntentUrl(url: string): string {
  const u = new URL(url);
  const scheme = u.protocol.replace(/:$/, '');
  return `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}

/**
 * The URL the app was opened with, captured while this module loads: the router moves a share token
 * (#r=…) out of the hash the moment it starts (src/router.ts), so by the time a screen renders
 * `location.href` has lost it. Module evaluation happens before app.tsx calls startRouter().
 */
const LAUNCH_URL = typeof location === 'undefined' ? '' : location.href;

/** What "Open in Chrome" hands over: the launch URL while it still carries a share token, else the current one. */
export function urlForChrome(): string {
  const i = LAUNCH_URL.indexOf('#');
  return i >= 0 && /^#[rpwbfx]=/.test(LAUNCH_URL.slice(i)) ? LAUNCH_URL : location.href;
}
