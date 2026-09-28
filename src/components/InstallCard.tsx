// Shown when the app runs in a browser tab instead of as an installed app. On iOS it is
// persistent (Safari's storage is not durable; PLAN.md §4), on Android it can be dismissed.
import { useState } from 'preact/hooks';
import { t } from '@/i18n';
import { isStandalone } from '@/pwa';
import { isIOS } from './AppInfo';

const DISMISS_KEY = 'recepten.installcard.dismissed';

export function InstallCard() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (isStandalone()) return null;
  const ios = isIOS();
  if (!ios && dismissed) return null;

  if (ios) {
    return (
      <aside class="installcard" role="note">
        <h3>{t('install.ios.title')}</h3>
        <ol>
          <li>{t('install.ios.step1')}</li>
          <li>{t('install.ios.step2')}</li>
          <li>{t('install.ios.step3')}</li>
        </ol>
        <div class="muted small">{t('install.ios.why')}</div>
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
          try {
            localStorage.setItem(DISMISS_KEY, '1');
          } catch {
            /* ignore */
          }
        }}
      >
        {t('install.dismiss')}
      </button>
    </aside>
  );
}
