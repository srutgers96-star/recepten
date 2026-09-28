// '#/share' — build the #r= token + WhatsApp message; navigator.share only inside the tap handler.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { appInfo } from '@/components/AppInfo';
import { lang, t } from '@/i18n';
import { route } from '@/router';
import { getSetting, setSetting } from '@/db/db';
import { longestBuiltinIndex, toSharedRecipe, useAllRecipes } from '@/db/recipes';
import { buildShareUrl, encodeToken, type Envelope } from '@/domain/token';
import { buildShareMessage } from '@/domain/message';

const PROFILE_KEY = 'profileName';

export function ShareScreen() {
  const all = useAllRecipes();
  const preselect = route.value.query.get('r');
  const [selected, setSelected] = useState<string>(preselect ?? 'b' + longestBuiltinIndex);
  const [bilingual, setBilingual] = useState(false);
  // No default sender: either phone owner types their own name once (persisted in settings).
  const [by, setBy] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    getSetting<string>(PROFILE_KEY, '').then(setBy);
  }, []);

  const recipe = useMemo(() => all.find((r) => r.id === selected), [all, selected]);
  const sorted = useMemo(() => [...all].sort((a, b) => a.name.localeCompare(b.name, 'nl', { sensitivity: 'base' })), [all]);

  useEffect(() => {
    if (!recipe) return;
    let cancelled = false;
    setToken(null);
    setError(null);
    const env: Envelope = {
      v: 2,
      t: 'r',
      at: new Date().toISOString(),
      r: toSharedRecipe(recipe, bilingual),
    };
    if (by.trim()) env.by = by.trim();
    encodeToken(env)
      .then((tok) => {
        if (!cancelled) setToken(tok);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [recipe, bilingual, by]);

  const url = token ? buildShareUrl(appInfo.appUrl, 'r', token) : '';
  const hasName = by.trim().length > 0;
  // The message (and the share/copy buttons) wait for a sender name: "van …" is never guessed.
  const message =
    recipe && token && hasName
      ? buildShareMessage({
          nameNl: recipe.name,
          nameEn: bilingual ? (recipe.nameEn ?? recipe.name) : recipe.nameEn,
          servings: recipe.servings ?? 4,
          ingredientCount: recipe.ingredients.length,
          by: by.trim(),
          url,
          lang: lang.value,
        })
      : '';

  function share() {
    if (!message) return;
    setStatus('');
    if (typeof navigator.share === 'function') {
      navigator.share({ text: message }).catch((e: unknown) => {
        const name = (e as { name?: string })?.name;
        if (name !== 'AbortError') setStatus(`${t('share.error')}: ${String(e)}`);
      });
    } else {
      setStatus(t('share.noShareApi'));
      location.href = 'https://wa.me/?text=' + encodeURIComponent(message);
    }
  }

  function copy() {
    if (!message) return;
    navigator.clipboard
      .writeText(message)
      .then(() => setStatus(t('share.copied')))
      .catch((e: unknown) => setStatus(`${t('share.copyError')}: ${String(e)}`));
  }

  return (
    <>
      <Header title={t('share.title')} />
      <div class="screen form">
        <label class="field">
          <span>{t('share.recipe')}</span>
          <select class="input" value={selected} onChange={(e) => setSelected((e.currentTarget as HTMLSelectElement).value)}>
            {sorted.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.own ? ' *' : ''}
              </option>
            ))}
          </select>
        </label>

        <label class="field">
          <span>{t('share.from')}</span>
          <input
            class="input"
            type="text"
            value={by}
            placeholder={t('share.fromPlaceholder')}
            autocomplete="off"
            enterKeyHint="done"
            onInput={(e) => setBy((e.currentTarget as HTMLInputElement).value)}
            onChange={(e) => void setSetting(PROFILE_KEY, (e.currentTarget as HTMLInputElement).value.trim())}
          />
          {!hasName && <span class="bad small">{t('share.nameRequired')}</span>}
        </label>

        <label class="check">
          <input type="checkbox" checked={bilingual} onChange={(e) => setBilingual((e.currentTarget as HTMLInputElement).checked)} />
          <span>{t('share.bilingual')}</span>
        </label>

        <div class="card">
          <ul class="facts">
            <li>
              <span>{t('share.tokenLength')}</span>
              <span>{token ? `${token.length} ${t('share.chars')}` : error ?? t('share.encoding')}</span>
            </li>
            <li>
              <span>{t('share.urlLength')}</span>
              <span>{url ? `${url.length} ${t('share.chars')}` : '…'}</span>
            </li>
            <li>
              <span>{t('share.message')}</span>
              <span>{message ? `${message.length} ${t('share.chars')}` : hasName ? '…' : t('share.nameRequired')}</span>
            </li>
          </ul>
        </div>

        <div class="actions">
          <button type="button" class="btn btn-primary btn-block" disabled={!message} onClick={share}>
            {t('share.whatsapp')}
          </button>
          <button type="button" class="btn btn-block" disabled={!message} onClick={copy}>
            {t('share.copy')}
          </button>
        </div>
        <div class="status" role="status">
          {status}
        </div>

        {message && <pre class="report">{message}</pre>}
      </div>
    </>
  );
}
