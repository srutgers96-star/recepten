// '#/share/:id' — the WhatsApp message for one recipe (docs/phase-3-spec.md §4 Share):
//   - an own/received recipe travels as `#r=` (buildRecipeEnvelope: line overrides folded in,
//     the user-ingredient entries it references as the dict delta);
//   - an ADJUSTED classic travels as `#p=` (buildPatchEnvelope: the override patch, never a
//     duplicate recipe); message line 1 says "<name> (aangepast)";
//   - a classic with only "Koppel ingrediënt" line links travels as `#p=` with an EMPTY patch
//     plus the line overrides (the receiver has the classic: an `#r=` would be "Heb je al"
//     and the links would never arrive; merge.ts writes the line overrides only);
//   - a classic without an override travels as `#r=` like before.
// "Deel via WhatsApp" (navigator.share({text}) ONLY inside the tap handler, exactly one field;
// wa.me fallback), "Kopieer", and "Deel als tekst": the readable full recipe in NL / EN / both.
// A recipe too big for one message (> 3.5 KB) becomes a .json file instead (planMessages):
// "Deel het bestand" first, "Download" second; a download reports "Opgeslagen als … in Downloads".
// '#/share' without an id is "Stuur nieuwe naar …" (DeltaShareScreen; no router change).
import { useEffect, useMemo, useState } from 'preact/hooks';
import { checkNewBadges } from '@/badges';
import { appInfo } from '@/components/AppInfo';
import { Header } from '@/components/Header';
import { QrCode } from '@/components/QrCode';
import { Segmented } from '@/components/Segmented';
import { bumpSharedRecipes, getOverride, getRecipe, getSetting, isBuiltinId, listLineOverrides, listUserIngredients } from '@/db/repo';
import { dictionary } from '@/dictionary';
import type { Ingredient } from '@/domain/dictionary';
import { pickText, type Lang, type Recipe } from '@/domain/model';
import { applyLineOverrides, type LineOverride, type RecipeOverride } from '@/domain/overrides';
import { buildReadableRecipe, countIngredientLines, recipeHasLang } from '@/domain/message';
import { buildPatchEnvelope, buildRecipeEnvelope, planMessages, type MessagePlan } from '@/domain/share';
import { buildShareUrl, encodeToken, type Envelope } from '@/domain/token';
import { lang, t } from '@/i18n';
import { activeProfile } from '@/profile';
import { navigate } from '@/router';
import { copyText, downloadBlob, shareJsonFile, shareText } from '@/share-actions';
import { DeltaShareScreen } from './DeltaShareScreen';

type TextLangs = 'nl' | 'en' | 'both';
const TEXT_LANGS: Record<TextLangs, Lang[]> = { nl: ['nl'], en: ['en'], both: ['nl', 'en'] };

interface Loaded {
  /** As stored: override patch applied for a classic, line overrides NOT yet folded in. */
  base: Recipe;
  /** What the reader sees: line overrides folded in. */
  effective: Recipe;
  lineOverrides: LineOverride[];
  userIngredients: Ingredient[];
  /** The override when the recipe is an adjusted classic (then the patch travels). */
  override: RecipeOverride | undefined;
  /** A classic with line links but no override: an empty patch carries the links. */
  linksOnly: boolean;
}

/** The `#p=` payload for a classic that only has "Koppel ingrediënt" links: no patch fields. */
function linksOnlyOverride(baseId: string, lineOverrides: LineOverride[]): RecipeOverride {
  const updatedAt = lineOverrides.reduce((max, o) => (o.updatedAt > max ? o.updatedAt : max), '');
  return { baseId, rev: 1, patch: {}, updatedAt };
}

interface Built {
  env: Envelope;
  plan: MessagePlan;
  url: string;
}

/**
 * Phase 5 block C (badge rule 'shared'): one recipe left this phone through the share sheet.
 * Fire-and-forget: bump the counter, then re-check badges for the active profile.
 */
function countRecipeShared() {
  void bumpSharedRecipes(1)
    .then(() => {
      const pid = activeProfile.value?.id;
      return pid ? checkNewBadges(pid) : undefined;
    })
    .catch((e: unknown) => console.error('bumpSharedRecipes', e));
}

/** Share plain text: the share sheet when there is one, else WhatsApp's web intent. */
function doShareText(text: string, setStatus: (s: string) => void, onShared?: () => void) {
  setStatus('');
  void shareText(text).then((r) => {
    if (r.outcome === 'failed') setStatus(`${t('share.error')}: ${r.error ?? ''}`);
    else if (r.outcome === 'no-share-api') setStatus(t('share.noShareApi'));
    else if (r.outcome === 'shared' && onShared) onShared();
  });
}

function doCopy(text: string, setStatus: (s: string) => void) {
  void copyText(text).then((r) => setStatus(r.ok ? t('share.copied') : `${t('share.copyError')}: ${r.error ?? ''}`));
}

export function ShareScreen(props: { id: string }) {
  if (props.id === '') return <DeltaShareScreen />;
  return <RecipeShareScreen id={props.id} />;
}

function RecipeShareScreen(props: { id: string }) {
  const [loaded, setLoaded] = useState<Loaded | null | undefined>(undefined);
  const [built, setBuilt] = useState<Built | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [textStatus, setTextStatus] = useState('');
  const [textLangs, setTextLangs] = useState<TextLangs>('nl');
  // Phase 5 block D.5: "Toon QR" exists only while the Experimenten flag is on (flag off = no trace).
  const [experiments, setExperiments] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const by = activeProfile.value?.name ?? '';
  const ui = lang.value;

  useEffect(() => {
    let cancelled = false;
    getSetting<unknown>('experiments', false)
      .then((v) => {
        if (!cancelled) setExperiments(v === true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoaded(undefined);
    setStatus('');
    setTextStatus('');
    setShowQr(false);
    const id = props.id;
    // The effective recipe travels: override patch applied (getRecipe) AND the "Koppel" line
    // overrides folded into the lines, so a linked ingredient reaches the other phone.
    Promise.all([getRecipe(id), listLineOverrides(id), listUserIngredients(), isBuiltinId(id) ? getOverride(id) : Promise.resolve(undefined)])
      .then(([base, lineOverrides, userIngredients, override]) => {
        if (cancelled) return;
        if (!base) {
          setLoaded(null);
          return;
        }
        const effective = { ...base, lines: applyLineOverrides(base.lines, lineOverrides) };
        const linksOnly = isBuiltinId(id) && !override && lineOverrides.length > 0;
        setLoaded({ base, effective, lineOverrides, userIngredients, override, linksOnly });
        // Default text language: the UI language when the recipe has it, else the other one.
        const has = (l: Lang) => recipeHasLang(effective, l);
        setTextLangs(has(ui) ? ui : has('nl') ? 'nl' : 'en');
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(String(e));
      });
    return () => {
      cancelled = true;
    };
  }, [props.id]);

  // The envelope + message; recomputed when the sender name or the UI language changes.
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    setBuilt(null);
    setError(null);
    (async () => {
      const ctx = { by, userIngredients: loaded.userIngredients, lineOverrides: loaded.lineOverrides };
      const patch = loaded.override ?? (loaded.linksOnly ? linksOnlyOverride(loaded.base.id, loaded.lineOverrides) : undefined);
      const env = patch ? buildPatchEnvelope(patch, { ...ctx, name: loaded.base.name }) : buildRecipeEnvelope(loaded.base, ctx);
      const [plan, token] = await Promise.all([planMessages([env], appInfo.appUrl, { lang: ui, by }), encodeToken(env)]);
      if (cancelled) return;
      setBuilt({ env, plan, url: buildShareUrl(appInfo.appUrl, env.t, token) });
    })().catch((e: unknown) => {
      if (!cancelled) setError(String(e));
    });
    return () => {
      cancelled = true;
    };
  }, [loaded, by, ui]);

  const recipe = loaded?.effective;
  const message = built && 'text' in built.plan ? built.plan.text : '';
  const file = built && 'file' in built.plan ? built.plan.file : null;
  const dictCount = built && built.env.dict && Array.isArray((built.env.dict as { ing?: unknown[] }).ing) ? (built.env.dict as { ing: unknown[] }).ing.length : 0;
  // Ingredient lines through the dictionary in each language (same text as the landing page).
  const dict = dictionary.value;
  const url = built?.url ?? '';
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

  /** A-bis.9: "Deel het bestand" first (share sheet, download as the fallback), "Download" second. */
  function shareFile() {
    if (!file) return;
    setStatus('');
    void shareJsonFile(file.name, file.json).then((r) => {
      if (r.outcome === 'shared') {
        setStatus(t('share.fileShared'));
        countRecipeShared();
      } else if (r.outcome === 'downloaded') setStatus(t('share.fileDownloaded', { name: r.name }));
      else if (r.outcome === 'failed') setStatus(`${t('share.fileFailed')}: ${r.error ?? ''}`);
    });
  }

  function downloadFile() {
    if (!file) return;
    setStatus('');
    try {
      downloadBlob(file.name, new Blob([file.json], { type: 'application/json' }));
      setStatus(t('share.fileDownloaded', { name: file.name }));
    } catch (e) {
      setStatus(`${t('share.fileFailed')}: ${String(e)}`);
    }
  }

  return (
    <>
      <Header title={t('share.title')} back backLabel={t('common.back')} />
      <div class="screen share">
        {loaded === null && (
          <>
            <div class="empty">{t('share.notFound')}</div>
            <button type="button" class="btn btn-block" onClick={() => navigate('/recipes', { replace: true })}>
              {t('nav.recipes')}
            </button>
          </>
        )}
        {loaded === undefined && <div class="empty">{error ?? t('common.loading')}</div>}
        {loaded && recipe && (
          <>
            <h2 class="share-name">
              {name}
              {loaded.override && <span class="badge badge-muted share-badge">{t('delta.adjusted')}</span>}
            </h2>
            <p class="muted">
              {t('inbox.ingredients', { n: countIngredientLines(recipe) })}
              {by ? ` · ${t('common.from', { name: by })}` : ''}
            </p>
            {!by && <p class="warn small">{t('share.noProfile')}</p>}
            {loaded.override && <p class="muted small">{t('share.patchNote')}</p>}
            {loaded.linksOnly && <p class="muted small">{t('share.linksNote')}</p>}
            {dictCount > 0 && <p class="muted small">{dictCount === 1 ? t('share.dictNoteOne') : t('share.dictNote', { n: dictCount })}</p>}
            <p class="muted small">{t('share.intro')}</p>

            {file ? (
              <>
                <p class="warn">{t('share.tooLarge', { n: file.json.length })}</p>
                <div class="actions file-actions">
                  <button type="button" class="btn btn-primary" onClick={shareFile}>
                    {t('share.fileButton')}
                  </button>
                  <button type="button" class="btn" onClick={downloadFile}>
                    {t('share.download')}
                  </button>
                </div>
                <div class="status" role="status">
                  {status || file.name}
                </div>
              </>
            ) : (
              <>
                <pre class="report share-preview">{message || error || t('share.encoding')}</pre>
                <div class="actions">
                  <button type="button" class="btn btn-primary btn-block" disabled={!message} onClick={() => doShareText(message, setStatus, countRecipeShared)}>
                    {t('share.whatsapp')}
                  </button>
                  <button type="button" class="btn" disabled={!message} onClick={() => doCopy(message, setStatus)}>
                    {t('share.copy')}
                  </button>
                </div>
                <div class="status" role="status">
                  {status || (message ? t('share.length', { n: message.length }) : '')}
                </div>
                {experiments && (
                  // Block D.5 (ADR-0007, ADR-0006 flow D): QR of exactly the URL in the message
                  // above. Behind the Experimenten flag; tapping again hides it.
                  <div class="share-qr">
                    <button type="button" class="btn" disabled={!url} onClick={() => setShowQr((v) => !v)}>
                      {showQr ? t('share.qrHide') : t('share.qrShow')}
                    </button>
                    {showQr && url && (
                      <>
                        <QrCode text={url} />
                        <p class="muted small share-qr-hint">{t('share.qrHint')}</p>
                      </>
                    )}
                  </div>
                )}
              </>
            )}

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
                <button type="button" class="btn btn-primary btn-block" disabled={!readable} onClick={() => doShareText(readable, setTextStatus, countRecipeShared)}>
                  {t('share.asText')}
                </button>
                <button type="button" class="btn" disabled={!readable} onClick={() => doCopy(readable, setTextStatus)}>
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
