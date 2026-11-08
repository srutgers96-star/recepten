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
// A recipe too big for one message (> 20 KB since V2) becomes a .json file instead (planMessages):
// "Deel het bestand" first, "Download" second; a download reports "Opgeslagen als … in Downloads".
// After "Deel het bestand" (shared or downloaded) a second button "Stuur ook de uitleg" sends
// buildFileHintMessage as its own share (docs/specs/verbeterronde-2.md §1b; invariant 9).
// '#/share' without an id is "Stuur nieuwe naar …" (DeltaShareScreen; no router change).
// 13D block 4 (docs/specs/varianten-tabs.md §1g): when the active profile has a private note on
// this recipe, a switch "Mijn notitie meesturen als tip van de maker" (default off) puts the note
// in THIS envelope as the maker's tip (`r.tip` on a copy of the recipe, `p.patch.tip` on a copy of
// the patch) and in the readable text; the notes table and the stored recipe are never touched.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { checkNewBadges, recheckActiveBadges } from '@/badges';
import { appInfo } from '@/components/AppInfo';
import { Header } from '@/components/Header';
import { QrPanel, QrToggle } from '@/components/QrPanel';
import { Segmented } from '@/components/Segmented';
import { bumpSharedRecipes, getNote, getOverride, getRecipe, isBuiltinId, listLineOverrides, listUserIngredients, logShareEvent } from '@/db/repo';
import { dictionary } from '@/dictionary';
import type { Ingredient } from '@/domain/dictionary';
import { nowIso, pickText, type Lang, type Recipe, type Text } from '@/domain/model';
import { applyLineOverrides, type LineOverride, type RecipeOverride } from '@/domain/overrides';
import { buildFileHintMessage, buildReadableRecipe, countIngredientLines, recipeHasLang } from '@/domain/message';
import { buildPatchEnvelope, buildRecipeEnvelope, planMessages, type MessagePlan } from '@/domain/share';
import { buildShareUrl, encodeToken, type Envelope } from '@/domain/token';
import { lang, t } from '@/i18n';
import { activeProfile } from '@/profile';
import { navigate } from '@/router';
import { copyText, downloadBlob, shareJsonFile, shareText } from '@/share-actions';
import { DeltaShareScreen } from './DeltaShareScreen';

type TextLangs = 'nl' | 'en' | 'both';
const TEXT_LANGS: Record<TextLangs, Lang[]> = { nl: ['nl'], en: ['en'], both: ['nl', 'en'] };

export interface Loaded {
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

/**
 * 13D §1g: the maker's tip with the private note added in language `l`: the note alone, or after the
 * existing tip in that language with an empty line between. The other language stays as it was.
 * A blank note gives null (nothing to send). Pure; never writes anything.
 */
export function withNoteTip(existing: Text | null | undefined, note: string, l: Lang): Text | null {
  const text = note.trim();
  if (text === '') return null;
  const out: Text = { ...(existing ?? {}) };
  const prev = (out[l] ?? '').trim();
  out[l] = prev ? `${prev}\n\n${text}` : text;
  return out;
}

/**
 * The envelope this screen sends. `noteTip` (from `withNoteTip`, only when the switch is on) goes on
 * a COPY: `{ ...loaded.base, tip }` for `#r=`, `{ ...patch, tip }` for `#p=`; `loaded` itself is
 * left untouched. Without `noteTip` the envelope is exactly what it was before 13D block 4.
 */
export function buildShareEnvelope(loaded: Loaded, by: string, noteTip: Text | null, byId?: string): Envelope {
  const ctx = { by, byId, userIngredients: loaded.userIngredients, lineOverrides: loaded.lineOverrides };
  // A classic always sends its tip as a patch (§1g): an unadjusted classic is 'present' at the
  // receiver, so a `#r=` with `r.tip` would never arrive. An empty override carries it then.
  const tipOnClassic = !!noteTip && isBuiltinId(loaded.base.id);
  const override = loaded.override ?? (loaded.linksOnly || tipOnClassic ? linksOnlyOverride(loaded.base.id, loaded.lineOverrides) : undefined);
  if (override) {
    const patch = noteTip ? { ...override, patch: { ...override.patch, tip: noteTip } } : override;
    return buildPatchEnvelope(patch, { ...ctx, name: loaded.base.name });
  }
  return buildRecipeEnvelope(noteTip ? { ...loaded.base, tip: noteTip } : loaded.base, ctx);
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

/**
 * Phase 6 (13A-2): this recipe left the phone (share sheet, readable text, file or download) —
 * one 'out' row in the "In & uit" log; an adjusted classic is a 'patches' row with the classic's
 * id. No partner is named on this screen (who = null). Fire-and-forget.
 */
function logRecipeShared(id: string, asPatch: boolean) {
  void logShareEvent({ at: nowIso(), direction: 'out', kind: asPatch ? 'patches' : 'recipes', who: null, count: 1, recipeIds: [id] }).then(() => recheckActiveBadges()).catch((e: unknown) => console.error('logShareEvent', e));
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
  /** V2: "Deel het bestand" went out (or downloaded): offer "Stuur ook de uitleg". */
  const [fileSent, setFileSent] = useState(false);
  const [textStatus, setTextStatus] = useState('');
  const [textLangs, setTextLangs] = useState<TextLangs>('nl');
  // 13Q (docs/specs/qr-link.md §1a): "Toon QR" next to Deel and Kopieer, no Experimenten flag any more.
  const [showQr, setShowQr] = useState(false);
  // 13D §1g: the active profile's private note on this recipe ('' = none, no switch) and the switch.
  const [note, setNote] = useState('');
  const [noteAsTip, setNoteAsTip] = useState(false);
  const by = activeProfile.value?.name ?? '';
  const pid = activeProfile.value?.id ?? '';
  const ui = lang.value;

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

  // 13D §1g: read (never write) the active profile's note; the switch starts off for every recipe.
  useEffect(() => {
    let cancelled = false;
    setNote('');
    setNoteAsTip(false);
    if (!pid) return;
    getNote(props.id, pid)
      .then((text) => {
        if (!cancelled) setNote(text);
      })
      .catch((e: unknown) => console.error('getNote', e));
    return () => {
      cancelled = true;
    };
  }, [props.id, pid]);

  // The tip this link carries when the switch is on (UI language; added to an existing tip).
  const noteTip = useMemo(() => (loaded && noteAsTip ? withNoteTip(loaded.base.tip, note, ui) : null), [loaded, noteAsTip, note, ui]);

  // The envelope + message; recomputed when the sender name, the UI language or the note switch changes.
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    setBuilt(null);
    setError(null);
    (async () => {
      const env = buildShareEnvelope(loaded, by, noteTip, pid || undefined);
      const [plan, token] = await Promise.all([planMessages([env], appInfo.appUrl, { lang: ui, by }), encodeToken(env)]);
      if (cancelled) return;
      setBuilt({ env, plan, url: buildShareUrl(appInfo.appUrl, env.t, token) });
    })().catch((e: unknown) => {
      if (!cancelled) setError(String(e));
    });
    return () => {
      cancelled = true;
    };
  }, [loaded, by, pid, ui, noteTip]);

  // The readable text is built from `effective` (not from the envelope): the same tip on a copy.
  const recipe = useMemo(() => (loaded ? (noteTip ? { ...loaded.effective, tip: noteTip } : loaded.effective) : undefined), [loaded, noteTip]);
  // One envelope is always one part (V2: only several envelopes are split over several messages).
  const message = built && 'parts' in built.plan ? (built.plan.parts[0] ?? '') : '';
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
  // 13A-2: what the log calls this share — an adjusted (or link-only) classic travels as a patch.
  const asPatch = !!loaded && (!!loaded.override || loaded.linksOnly || (!!noteTip && isBuiltinId(loaded.base.id)));

  /** The share sheet reported 'shared': count it for the badge and write the "In & uit" row. */
  function onRecipeShared() {
    countRecipeShared();
    logRecipeShared(props.id, asPatch);
  }

  /** A-bis.9: "Deel het bestand" first (share sheet, download as the fallback), "Download" second. */
  function shareFile() {
    if (!file) return;
    setStatus('');
    void shareJsonFile(file.name, file.json).then((r) => {
      if (r.outcome === 'shared') {
        setFileSent(true);
        setStatus(t('share.fileShared'));
        onRecipeShared();
      } else if (r.outcome === 'downloaded') {
        setFileSent(true);
        setStatus(t('share.fileDownloaded', { name: r.name }));
        logRecipeShared(props.id, asPatch);
      } else if (r.outcome === 'failed') setStatus(`${t('share.fileFailed')}: ${r.error ?? ''}`);
    });
  }

  /** V2: the explanation that goes with the file, as its own share (invariant 9: one field). */
  function shareFileHint() {
    doShareText(buildFileHintMessage(ui), setStatus);
  }

  function downloadFile() {
    if (!file) return;
    setStatus('');
    try {
      downloadBlob(file.name, new Blob([file.json], { type: 'application/json' }));
      setStatus(t('share.fileDownloaded', { name: file.name }));
      logRecipeShared(props.id, asPatch);
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
            {note.trim() !== '' && (
              <label class="setting share-note-tip">
                <div class="label">
                  {t('share.noteAsTip')}
                  <small>{t('share.noteAsTipHint')}</small>
                </div>
                <span class="switch">
                  <input type="checkbox" checked={noteAsTip} onChange={(e) => setNoteAsTip((e.currentTarget as HTMLInputElement).checked)} />
                  <span class="track" />
                </span>
              </label>
            )}

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
                  {fileSent && (
                    <button type="button" class="btn" onClick={shareFileHint}>
                      {t('share.fileHint')}
                    </button>
                  )}
                </div>
                <div class="status" role="status">
                  {status || file.name}
                </div>
              </>
            ) : (
              <>
                <pre class="report share-preview">{message || error || t('share.encoding')}</pre>
                <div class="actions">
                  <button type="button" class="btn btn-primary btn-block" disabled={!message} onClick={() => doShareText(message, setStatus, onRecipeShared)}>
                    {t('share.whatsapp')}
                  </button>
                  <button type="button" class="btn" disabled={!message} onClick={() => doCopy(message, setStatus)}>
                    {t('share.copy')}
                  </button>
                  <QrToggle open={showQr} disabled={!url} onToggle={() => setShowQr((v) => !v)} />
                </div>
                {/* 13Q §1a/§1b (ADR-0007): QR of exactly the URL in the message above, or the too-big line. */}
                <QrPanel url={url} open={showQr} onToggle={() => setShowQr(false)} />
                <div class="status" role="status">
                  {status || (message ? t('share.length', { n: message.length }) : '')}
                </div>
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
                <button type="button" class="btn btn-primary btn-block" disabled={!readable} onClick={() => doShareText(readable, setTextStatus, onRecipeShared)}>
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
