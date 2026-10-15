// Shown when the app runs in a browser tab instead of as an installed app. On iOS it is
// persistent (Safari's storage is not durable; PLAN.md §4) but — phase 6, docs/phase-6-spec.md
// 6A.4 — folds to one line ("Zet me op je beginscherm ▸"; the state is remembered per device);
// on Android it can be dismissed.
// Phase 6 (13B): the big explanation moved to <BrowserNotice/> at the top of the shell; this card is
// the small reminder that stays once "Toch in de browser" was tapped there. It returns null while
// the notice is on screen (one explanation at a time) and uses the notice's own install lines, so
// the two can never say different things. On Android in another browser than Chrome it carries the
// same "Open in Chrome" pair.
import { useState } from 'preact/hooks';
import { t } from '@/i18n';
import { browserName, isAndroid, isStandalone } from '@/pwa';
import { isIOS } from './AppInfo';
import { browserNoticeOpen, OpenInChrome } from './BrowserNotice';

const DISMISS_KEY = 'recepten.installcard.dismissed';
/** iOS: '0' = folded to the one-line title; anything else (also no value) = the steps are shown. */
const IOS_OPEN_KEY = 'recepten.installcard.ios.open';

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

function writeFlag(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function InstallCard() {
  const [dismissed, setDismissed] = useState<boolean>(() => readFlag(DISMISS_KEY, false));
  const [iosOpen, setIosOpen] = useState<boolean>(() => readFlag(IOS_OPEN_KEY, true));
  if (isStandalone()) return null;
  // The notice at the top already explains it; two explanations on one screen help nobody.
  if (browserNoticeOpen.value) return null;
  const ios = isIOS();
  if (!ios && dismissed) return null;

  if (ios) {
    const toggle = () => {
      setIosOpen(!iosOpen);
      writeFlag(IOS_OPEN_KEY, !iosOpen);
    };
    return (
      <aside class={'installcard installcard-ios' + (iosOpen ? ' open' : '')} role="note">
        {/* The h3 wraps the button (a heading inside a button is dropped from VoiceOver's headings
            list); aria-expanded tells a screen reader open/closed; the title is the desktop tooltip. */}
        <h3 class="installcard-toggle">
          <button type="button" aria-expanded={iosOpen} aria-controls={iosOpen ? 'installcard-ios-steps' : undefined} title={t(iosOpen ? 'install.ios.hide' : 'install.ios.show')} onClick={toggle}>
            <span class="installcard-title">{t('install.ios.title')}</span>
            <svg class="chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </h3>
        {iosOpen && (
          <div id="installcard-ios-steps">
            <ol>
              <li>{t('install.ios.step1')}</li>
              <li>{t('install.ios.step2')}</li>
              <li>{t('install.ios.step3')}</li>
            </ol>
            <div class="muted small">
              {t('install.ios.why')} {t('install.ios.space')} {t('browser.ios.links')}
            </div>
          </div>
        )}
      </aside>
    );
  }
  // Android (and desktop): the same lines as the notice. Only a real Android phone in another
  // browser gets the Chrome pair; desktop Firefox/Edge have no Chrome intent to speak of. Android
  // Chrome itself gets the notice's Chrome line (the app may be installed and shares this storage).
  const android = isAndroid();
  const needsChrome = android && browserName() !== 'chrome';
  return (
    <aside class="installcard" role="note">
      <h3>{t('install.android.title')}</h3>
      <div>
        {android && !needsChrome ? (
          t('browser.android.chrome')
        ) : (
          <>
            {t('browser.android.install')} {t('browser.android.default')}
          </>
        )}
      </div>
      {needsChrome && <OpenInChrome compact />}
      <button
        type="button"
        class="btn btn-small"
        onClick={() => {
          setDismissed(true);
          writeFlag(DISMISS_KEY, true);
        }}
      >
        {t('install.dismiss')}
      </button>
    </aside>
  );
}
