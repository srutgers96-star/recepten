import { t } from '@/i18n';
import { reloadToNewVersion, updateReady } from '@/pwa';

export function UpdateBar() {
  if (!updateReady.value) return null;
  return (
    <div class="updatebar" role="status">
      <span>{t('update.new')}</span>
      <button type="button" class="btn btn-small" onClick={() => void reloadToNewVersion()}>
        {t('update.reload')}
      </button>
    </div>
  );
}
