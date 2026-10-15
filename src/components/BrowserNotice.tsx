// Phase 6 (docs/phase-6-spec.md 13B): "Je gebruikt Rutgers' Recepten in de browser." — one notice at
// the top of the shell whenever the app runs in a browser tab on a phone (not standalone). It says,
// per phone and without promising anything the phone cannot do (CLAUDE.md invariants 5 and 13):
//   Android  install through Chrome (menu ⋮ → App installeren) and make Chrome the default browser;
//            in any other browser (Stijn's Opera, Samsung Internet, Firefox, Edge, a WebView) also an
//            "Open in Chrome" button (intent URL, src/pwa.ts chromeIntentUrl) plus the honest
//            fallback "copy the link and paste it in Chrome", because not every browser honours
//            intent: links and the WebAPK taking over is up to Android (ADR-0001).
//   iPhone   Share → Add to Home Screen; links always open Safari, so copy the code and paste it in
//            the app. No "open the app" promise anywhere.
// "Toch in de browser" hides it for 7 days on this device (localStorage, try/catch; a per-device
// convenience, never state) — except on Android outside Chrome, where it hides it for this page
// load only: a link that opens Opera or a WebView must find the warning and "Open in Chrome" above
// the import preview every time, or "Importeer" writes the recipe into that browser's storage and
// it never reaches the app (13B's very bug). <InstallCard/> reads `browserNoticeOpen` and stays
// away while the notice is on screen, so Home never explains installing twice. Desktop browsers get
// no notice (the small install card is enough there): the two phones are what this is about.
import { signal } from '@preact/signals';
import { useState } from 'preact/hooks';
import { t } from '@/i18n';
import { browserName, chromeIntentUrl, isAndroid, isStandalone, urlForChrome, type BrowserName } from '@/pwa';
import { copyText } from '@/share-actions';
import { isIOS } from './AppInfo';

/** When "Toch in de browser" was tapped (epoch ms as a string); absent or older than a week = show. */
const DISMISSED_AT_KEY = 'recepten.browsernotice.dismissedAt';
const SHOW_AGAIN_MS = 7 * 24 * 60 * 60 * 1000;

function dismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISSED_AT_KEY);
    const at = raw === null ? NaN : Number(raw);
    return Number.isFinite(at) && Date.now() - at < SHOW_AGAIN_MS;
  } catch {
    return false;
  }
}

/** Android in anything but Chrome: Stijn's Opera case — what is saved here lands in that browser's storage. */
function needsChrome(): boolean {
  return !isIOS() && browserName() !== 'chrome';
}

/** Phone, browser tab, not dismissed this week (another browser than Chrome: never snoozed across starts). Evaluated once at module load (the shell renders it). */
function shouldShow(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (isStandalone()) return false;
  if (!isAndroid() && !isIOS()) return false;
  if (needsChrome()) return true;
  return !dismissedRecently();
}

/** Whether the notice is on screen; InstallCard reads it to avoid a second explanation. */
export const browserNoticeOpen = signal<boolean>(shouldShow());

export function dismissBrowserNotice() {
  try {
    localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
  } catch {
    /* private mode: it simply shows again next start */
  }
  browserNoticeOpen.value = false;
}

/** The browser's name as people know it; the Chromium forks and a WebView read as "another browser". */
export function browserLabel(name: BrowserName): string {
  switch (name) {
    case 'opera':
      return 'Opera';
    case 'samsung':
      return 'Samsung Internet';
    case 'firefox':
      return 'Firefox';
    case 'edge':
      return 'Edge';
    case 'chrome':
      return 'Chrome';
    case 'safari':
      return 'Safari';
    default:
      return t('browser.otherBrowser');
  }
}

/**
 * The "Open in Chrome" pair: the intent link and the copy fallback, with one status line under it.
 * Shared by the notice, the install card and the "Links openen in de app" sheet (MoreScreen), so
 * the three never drift apart. `url` defaults to the launch URL (keeps a share token, src/pwa.ts).
 */
export function OpenInChrome(props: { url?: string; compact?: boolean }) {
  const [status, setStatus] = useState('');
  const target = props.url ?? urlForChrome();

  function copy() {
    void copyText(target).then((r) => setStatus(t(r.ok ? 'browser.copied' : 'browser.copyFailed')));
  }

  return (
    <div class={'open-in-chrome' + (props.compact ? ' compact' : '')}>
      <div class="open-in-chrome-actions">
        {/* A plain anchor: that is what Android browsers hand to Intent.parseUri. Same tab. */}
        <a class="btn btn-primary" href={chromeIntentUrl(target)}>
          {t('browser.openChrome')}
        </a>
        <button type="button" class="btn" onClick={copy}>
          {t('browser.copyLink')}
        </button>
      </div>
      <p class="muted small open-in-chrome-hint" role="status">
        {status || t('browser.copyHint')}
      </p>
    </div>
  );
}

export function BrowserNotice() {
  if (!browserNoticeOpen.value) return null;
  const ios = isIOS();
  const browser = browserName();
  const other = needsChrome();

  return (
    <aside class="browser-notice" role="note" aria-label={t('browser.title')}>
      <p class="browser-notice-title">{t('browser.title')}</p>
      {ios ? (
        <p>
          {t('browser.ios.install')} {t('browser.ios.links')}
        </p>
      ) : other ? (
        <p>
          {t('browser.android.install')} {t('browser.android.default')} {t('browser.android.other', { browser: browserLabel(browser) })}
        </p>
      ) : (
        // Chrome itself (a tab or a Custom Tab from WhatsApp): the app may well be installed already
        // and shares this storage, so no "install" order — just where the app is and how to get it.
        <p>{t('browser.android.chrome')}</p>
      )}
      {other && <OpenInChrome />}
      <div class="browser-notice-foot">
        {/* Visible text, not a title attribute: a title can become the button's accessible name. */}
        <span class="muted small">{t(other ? 'browser.dismissHintOnce' : 'browser.dismissHint')}</span>
        <button type="button" class="btn btn-small" onClick={dismissBrowserNotice}>
          {t('browser.dismiss')}
        </button>
      </div>
    </aside>
  );
}
