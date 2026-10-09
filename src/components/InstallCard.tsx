// Shown when the app runs in a browser tab instead of as an installed app. On iOS it is
// persistent (Safari's storage is not durable; PLAN.md §4) but — phase 6, docs/phase-6-spec.md
// 6A.4 — folds to one line ("Zet me op je beginscherm ▸"; the state is remembered per device);
// on Android it can be dismissed.
import { useState } from 'preact/hooks';
import { t } from '@/i18n';
import { isStandalone } from '@/pwa';
import { isIOS } from './AppInfo';

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
              {t('install.ios.why')} {t('install.ios.space')}
            </div>
          </div>
        )}
      </aside>
    );
  }
  return (
    <aside class="installcard" role="note">
      <h3>{t('install.android.title')}</h3>
      <div>{t('install.android.body')}</div>
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
