// '#/share/:id' — the WhatsApp message with the #r= token for one recipe (buildShareMessage),
// "Deel via WhatsApp" (navigator.share({text}) ONLY inside the tap handler, exactly one field;
// wa.me fallback), "Kopieer", and "Deel als tekst": the readable recipe in NL / EN / both.
// Sender name = the active profile.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { appInfo } from '@/components/AppInfo';
import { Header } from '@/components/Header';
import { Segmented } from '@/components/Segmented';
import { getRecipe, listLineOverrides } from '@/db/repo';
import { dictionary } from '@/dictionary';
import { pickText, type Lang, type Recipe } from '@/domain/model';
import { applyLineOverrides } from '@/domain/overrides';
import { buildReadableRecipe, buildShareMessageFor, countIngredientLines, recipeHasLang } from '@/domain/message';
import { recipeToShareEnvelope } from '@/domain/recipe-io';
import { buildShareUrl, encodeToken } from '@/domain/token';
import { lang, t } from '@/i18n';
import { activeProfile } from '@/profile';
import { navigate } from '@/router';

type TextLangs = 'nl' | 'en' | 'both';
const TEXT_LANGS: Record<TextLangs, Lang[]> = { nl: ['nl'], en: ['en'], both: ['nl', 'en'] };

/** Share plain text: the share sheet when there is one, else WhatsApp's web intent. */
function shareText(text: string, setStatus: (s: string) => void) {
  setStatus('');
  if (typeof navigator.share === 'function') {
    navigator.share({ text }).catch((e: unknown) => {
      const name = (e as { name?: string })?.name;
      if (name !== 'AbortError') setStatus(`${t('share.error')}: ${String(e)}`);
    });
  } else {
    setStatus(t('share.noShareApi'));
    location.href = 'https://wa.me/?text=' + encodeURIComponent(text);
  }
}

function copyText(text: string, setStatus: (s: string) => void) {
  navigator.clipboard
    .writeText(text)
    .then(() => setStatus(t('share.copied')))
    .catch((e: unknown) => setStatus(`${t('share.copyError')}: ${String(e)}`));
}

export function ShareScreen(props: { id: string }) {
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [textStatus, setTextStatus] = useState('');
  const [textLangs, setTextLangs] = useState<TextLangs>('nl');
  const by = activeProfile.value?.name ?? '';
  const ui = lang.value;

  useEffect(() => {
    let cancelled = false;
    setRecipe(undefined);
    setStatus('');
    setTextStatus('');
    // The effective recipe travels: override patch applied (getRecipe) AND the "Koppel" line
    // overrides folded into the lines, so a linked ingredient reaches the other phone.
    Promise.all([getRecipe(props.id), listLineOverrides(props.id)]).then(([base, overrides]) => {
      if (cancelled) return;
      const r = base ? { ...base, lines: applyLineOverrides(base.lines, overrides) } : undefined;
      setRecipe(r ?? null);
      if (r) {
        // Default text language: the UI language when the recipe has it, else the other one.
        const has = (l: Lang) => recipeHasLang(r, l);
        setTextLangs(has(ui) ? ui : has('nl') ? 'nl' : 'en');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [props.id]);

  // The token carries the full schema-2 recipe; recomputed when the sender name changes.
  useEffect(() => {
    if (!recipe) return;
    let cancelled = false;
    setToken(null);
    setError(null);
    encodeToken(recipeToShareEnvelope(recipe, by))
      .then((tok) => {
        if (!cancelled) setToken(tok);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [recipe, by]);

  const url = token ? buildShareUrl(appInfo.appUrl, 'r', token) : '';
  const message = recipe && url ? buildShareMessageFor(recipe, { by, url, lang: ui }) : '';
  // Ingredient lines through the dictionary in each language (same text as the landing page).
  const dict = dictionary.value;
  const readable = useMemo(() => (recipe && url ? buildReadableRecipe(recipe, TEXT_LANGS[textLangs], url, dict) : ''), [recipe, url, textLangs, dict]);

  const langOptions = useMemo(() => {
    if (!recipe) return [];
    const nl = recipeHasLang(recipe, 'nl');
    const en = recipeHasLang(recipe, 'en');
    const opts: Array<{ value: TextLangs; label: string }> = [];
    if (nl) opts.push({ value: 'nl', label: t('edit.lang.nl') });
    if (en) opts.push({ value: 'en', label: t('edit.lang.en') });
    if (nl && en) opts.push({ value: 'both', label: t('edit.lang.both') });
    return opts;
  }, [recipe, ui]);

  const name = recipe ? pickText(recipe.name, ui) : '';

  return (
    <>
      <Header title={t('share.title')} back backLabel={t('common.back')} />
      <div class="screen share">
        {recipe === null && (
          <>
            <div class="empty">{t('share.notFound')}</div>
            <button type="button" class="btn btn-block" onClick={() => navigate('/recipes', { replace: true })}>
              {t('nav.recipes')}
            </button>
          </>
        )}
        {recipe === undefined && <div class="empty">{t('common.loading')}</div>}
        {recipe && (
          <>
            <h2 class="share-name">{name}</h2>
            <p class="muted">
              {t('inbox.ingredients', { n: countIngredientLines(recipe) })}
              {by ? ` · ${t('common.from', { name: by })}` : ''}
            </p>
            {!by && <p class="warn small">{t('share.noProfile')}</p>}
            <p class="muted small">{t('share.intro')}</p>

            <pre class="report share-preview">{message || error || t('share.encoding')}</pre>
            <div class="actions">
              <button type="button" class="btn btn-primary btn-block" disabled={!message} onClick={() => shareText(message, setStatus)}>
                {t('share.whatsapp')}
              </button>
              <button type="button" class="btn" disabled={!message} onClick={() => copyText(message, setStatus)}>
                {t('share.copy')}
              </button>
            </div>
            <div class="status" role="status">
              {status || (message ? t('share.length', { n: message.length }) : '')}
            </div>

            <section class="section share-text">
              <h2>{t('share.asText')}</h2>
              <p class="muted small">{t('share.asTextHint')}</p>
              {langOptions.length > 1 && (
                <div class="share-lang">
                  <span class="muted small">{t('share.textLang')}</span>
                  <Segmented name="share-text-lang" options={langOptions} selected={[textLangs]} onChange={(next) => next[0] && setTextLangs(next[0])} />
                </div>
              )}
              <pre class="report share-preview share-readable">{readable || t('share.encoding')}</pre>
              <div class="actions">
                <button type="button" class="btn btn-primary btn-block" disabled={!readable} onClick={() => shareText(readable, setTextStatus)}>
                  {t('share.asText')}
                </button>
                <button type="button" class="btn" disabled={!readable} onClick={() => copyText(readable, setTextStatus)}>
                  {t('share.copyText')}
                </button>
              </div>
              <div class="status" role="status">
                {textStatus || (readable ? t('share.length', { n: readable.length }) : '')}
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}
