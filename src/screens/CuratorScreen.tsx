// '#/more/curator' — the curator screen for Gabi (docs/phase-5-spec.md block D.4): the 196
// classics with the state of their English edition — "ontbreekt" (no English name), "machine"
// (effective `text.en` is 'llm' or unknown) or "gecontroleerd" (`text.en` 'human', with the
// reviewer's name as credit) — behind filter chips, and per recipe a language-pair panel:
// Dutch read-only as the reference, English editable next to it (name, description, every raw
// ingredient line, every step). Saving stores an EN-only RecipeOverride patch (invariant 3: an
// incoming `en` only touches `en`; invariant 2: raw lines are never removed — only `raw.en` is
// written) plus `text: { en: 'human', reviewedBy }`, the same marker EditScreen sets.
// "Stuur correcties" shares the reviewed overrides as `#p=` patch messages via buildPatchEnvelope
// + planMessages, exactly like DeltaShareScreen (no new token format, invariant 4; photos never
// travel in tokens).
//
// Phase 6 (docs/phase-6-spec.md 6A.2): an ingredient line the dictionary recognises (`ing` set and
// known) is rendered in English FROM the dictionary (src/domain/render.ts: names, units, scaling);
// `raw.en` is never read for it. The panel therefore shows that effective English in grey,
// read-only, and offers the free English box only for headers and lines the dictionary does not
// know. A line linked to an OWN dictionary entry gets "Verbeter in het woordenboek" (one correction
// then applies to every recipe); a built-in entry cannot be edited in the Woordenboek (a user entry
// never overrides a built-in id, src/domain/dictionary.ts withUserEntries), so such a line honestly
// says "ingebouwd" and the hint points to Feedback voor Stijn instead of to a dead end. Leaving for
// the dictionary unmounts this screen, so a draft with unsaved English asks first.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { appInfo } from '@/components/AppInfo';
import { Header } from '@/components/Header';
import { allRecipes, getBaseRecipe, getOverride, getRecipe, isBuiltinId, listLineOverrides, listOverrides, saveOverride } from '@/db/repo';
import { dictionary, isUserIngredientId, userIngredients, type Dictionary } from '@/dictionary';
import { hasLang, pickText, type Line, type Recipe, type Step, type Text } from '@/domain/model';
import { applyOverride, mergeText, type LineOverride, type RecipePatch } from '@/domain/overrides';
import { renderLine } from '@/domain/render';
import { buildPatchEnvelope, planMessages, type MessagePlan, type ShareContext } from '@/domain/share';
import { lang, t } from '@/i18n';
import { effectiveLines } from '@/lines';
import { activeProfile } from '@/profile';
import { navigate } from '@/router';
import { shareJsonFile, shareText } from '@/share-actions';

// --- Status + the EN-only patch (pure; pinned in tests/curator.test.ts) --------------------------

export type CuratorStatus = 'missing' | 'machine' | 'reviewed';

/** D.4: no English name wins over everything; then the `text.en` marker ('human' = reviewed). */
export function curatorStatus(r: Pick<Recipe, 'name' | 'text'>): CuratorStatus {
  if (!hasLang(r.name, 'en')) return 'missing';
  return r.text?.en === 'human' ? 'reviewed' : 'machine';
}

/** The English side of the effective recipe, as the panel edits it (one entry per line/step). */
export interface CuratorDraft {
  nameEn: string;
  descriptionEn: string;
  linesEn: string[];
  stepsEn: string[];
}

function enOf(x: Text | null | undefined): string {
  return (x?.en ?? '').trim();
}

/**
 * 6A.2: true when the app shows this line's English through the dictionary, so `raw.en` has no
 * effect on it. Mirrors render.ts: a header prints its raw text; a line whose `ing` this
 * dictionary does not know (or has none) prints `raw.en` with `raw.nl` as fallback; everything
 * else is built from the dictionary names (name, unit, prep, note) and scaled.
 */
export function lineUsesDictionary(line: Pick<Line, 'kind' | 'ing'>, dict: Pick<Dictionary, 'get'>): boolean {
  return line.kind !== 'header' && !!line.ing && !!dict.get(line.ing);
}

/** The dictionary route that opens one entry: the DictionaryScreen reads `?q=` (ingredient id or search text). */
export function dictionaryRouteFor(ingredientId: string): string {
  return '/more/dictionary?q=' + encodeURIComponent(ingredientId);
}

/**
 * The override patch of a curator save: the previous patch (repo.saveOverride REPLACES the stored
 * one) with only the English side updated, plus `text: { en: 'human', reviewedBy }` — the review
 * marker — when the draft has a non-empty English name. Dutch is
 * never written here: a Text field merges `{ en }` into the previous patch value (keeping its
 * `nl`, if any), and steps/lines stay arrays of the effective length whose entries only carry
 * `text.en` / `raw.en` — applyOverride's per-index merge resolves the rest against the shipped
 * recipe. Fields whose English is unchanged keep whatever the previous patch had.
 */
export function buildCuratorPatch(base: Recipe, effective: Recipe, prev: RecipePatch | undefined, draft: CuratorDraft, by: string | null): RecipePatch {
  const patch: RecipePatch = { ...(prev ?? {}) };

  const putText = (key: 'name' | 'description', current: Text | null | undefined, value: string) => {
    const en = value.trim();
    if (en === enOf(current)) return; // unchanged: keep what the previous patch carries
    const prevText = prev && prev[key] !== undefined && prev[key] !== null ? (prev[key] as Text) : null;
    patch[key] = mergeText(prevText, { en }) ?? { en };
  };
  putText('name', effective.name, draft.nameEn);
  putText('description', effective.description, draft.descriptionEn);

  // Steps: `effective.steps` always has the same length as `prev.steps` when that exists
  // (applyOverride merged with or replaced by it), else as `base.steps`. Only `text.en` changes.
  const prevSteps = Array.isArray(prev?.steps) ? (prev?.steps as Step[]) : null;
  const stepChanged = effective.steps.map((s, i) => (draft.stepsEn[i] ?? '').trim() !== enOf(s.text));
  if (stepChanged.some(Boolean)) {
    patch.steps = effective.steps.map((_, i) => {
      const p = prevSteps?.[i];
      if (!stepChanged[i]) return p ?? { text: {} };
      const en = (draft.stepsEn[i] ?? '').trim();
      return p ? { ...p, text: { ...(p.text ?? {}), en } } : { text: { en } };
    });
  }

  // Lines: same-length arrays and only `raw.en` is written, so a raw line is never deleted
  // (invariant 2) and the Dutch raw text is untouched (invariant 3).
  const prevLines = Array.isArray(prev?.lines) ? (prev?.lines as Line[]) : null;
  const lineChanged = effective.lines.map((l, i) => (draft.linesEn[i] ?? '').trim() !== enOf(l.raw));
  if (lineChanged.some(Boolean)) {
    patch.lines = effective.lines.map((_, i) => {
      const p = prevLines?.[i];
      if (!lineChanged[i]) return p ?? { raw: {} };
      const en = (draft.linesEn[i] ?? '').trim();
      return p ? { ...p, raw: { ...(p.raw ?? {}), en } } : { raw: { en } };
    });
  }

  // The review marker EditScreen also writes: turns the "Machine translation" badge off and makes
  // this classic count as reviewed (status chip, counter, "Stuur correcties"). Only with a
  // non-empty English name: without one curatorStatus stays 'missing', so the marker would
  // contradict the chip and counter and sneak an unreviewed classic into "Stuur correcties".
  // Clearing the name drops a marker an earlier save set (the shipped marker applies again).
  if (draft.nameEn.trim() !== '') {
    const text: NonNullable<Recipe['text']> = { ...(base.text ?? {}), en: 'human' };
    if (by) text.reviewedBy = by;
    patch.text = text;
  } else {
    delete patch.text;
  }
  return patch;
}

// --- Screen ---------------------------------------------------------------------------------------

type Filter = 'all' | CuratorStatus;

const FILTERS: readonly Filter[] = ['all', 'machine', 'reviewed', 'missing'];

interface EditState {
  base: Recipe;
  effective: Recipe;
  prev: RecipePatch | undefined;
  /** "Koppel ingrediënt" corrections of this classic: decide per line whether the dictionary renders it. */
  lineOverrides: LineOverride[];
  draft: CuratorDraft;
}

function draftFrom(effective: Recipe): CuratorDraft {
  return {
    nameEn: effective.name.en ?? '',
    descriptionEn: effective.description?.en ?? '',
    linesEn: effective.lines.map((l) => l.raw?.en ?? ''),
    stepsEn: effective.steps.map((s) => s.text?.en ?? ''),
  };
}

/** True when the English draft differs from what is saved (the effective recipe). */
function draftDirty(e: EditState): boolean {
  const saved = draftFrom(e.effective);
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);
  return e.draft.nameEn !== saved.nameEn || e.draft.descriptionEn !== saved.descriptionEn || !same(e.draft.linesEn, saved.linesEn) || !same(e.draft.stepsEn, saved.stepsEn);
}

function badgeClass(s: CuratorStatus): string {
  return 'badge' + (s === 'reviewed' ? ' badge-green' : s === 'missing' ? ' badge-next' : '');
}

/** One language pair: the Dutch reference (read-only) next to / above the English input. */
function Pair(props: { label: string; index?: number; nl: string; value: string; multiline?: boolean; header?: boolean; onInput: (v: string) => void }) {
  const aria = t('curator.enOf', { what: props.index === undefined ? props.label : `${props.label} ${props.index}` });
  return (
    <div class={'curator-pair' + (props.header ? ' is-header' : '')}>
      <div class="pair-nl">
        {props.index !== undefined && <span class="pair-index">{props.index}.</span>}
        <span class="pair-text">{props.nl || '—'}</span>
      </div>
      <div class="pair-en">
        {props.multiline ? (
          <textarea class="input" rows={2} value={props.value} aria-label={aria} onInput={(e) => props.onInput((e.currentTarget as HTMLTextAreaElement).value)} />
        ) : (
          <input class="input" type="text" autocomplete="off" value={props.value} aria-label={aria} placeholder="EN" onInput={(e) => props.onInput((e.currentTarget as HTMLInputElement).value)} />
        )}
      </div>
    </div>
  );
}

/**
 * 6A.2: a line the dictionary renders. The Dutch raw text stays the reference; the English side
 * is the EFFECTIVE rendering (what the recipe screen shows in EN), grey and read-only. No input,
 * because `raw.en` would be ignored. An own entry (`own`) gets the button to the dictionary, the
 * one place to improve it; a built-in entry is read-only there too, so it only says so.
 */
function DictionaryPair(props: { index: number; nl: string; en: string; own: boolean; onImprove: () => void }) {
  const en = props.en || '—';
  return (
    <div class="curator-pair is-dict">
      <div class="pair-nl">
        <span class="pair-index">{props.index}.</span>
        <span class="pair-text">{props.nl || '—'}</span>
      </div>
      <div class="pair-en pair-en-dict">
        <span class="pair-dict-text muted" title={t('curator.fromDictionary')}>
          {en}
        </span>
        {props.own ? (
          <button type="button" class="btn btn-small pair-dict-link" aria-label={`${t('curator.improveInDictionary')}: ${en}`} onClick={props.onImprove}>
            {t('curator.improveInDictionary')}
          </button>
        ) : (
          <span class="badge badge-muted">{t('dict.builtin')}</span>
        )}
      </div>
    </div>
  );
}

export function CuratorScreen() {
  const ui = lang.value;
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [edit, setEdit] = useState<EditState | null>(null);
  const [plan, setPlan] = useState<MessagePlan | null>(null);
  const [sendCount, setSendCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  // The classics with their overrides applied (allRecipes); sort language fixed at load.
  useEffect(() => {
    let cancelled = false;
    allRecipes().then(
      (list) => {
        if (cancelled) return;
        const classics = list.filter((r) => r.origin.kind === 'builtin');
        classics.sort((a, b) => pickText(a.name, ui).localeCompare(pickText(b.name, ui), ui === 'nl' ? 'nl' : 'en'));
        setRecipes(classics);
      },
      (e: unknown) => {
        console.error('curator', e);
        if (!cancelled) setRecipes([]);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  // "Stuur correcties" is pre-planned (like DeltaShareScreen) so the tap itself can call
  // navigator.share without losing the user activation. Rebuilt after every save.
  useEffect(() => {
    if (!recipes) return;
    let cancelled = false;
    setPlan(null);
    (async () => {
      const overrides = await listOverrides();
      const byId = new Map(recipes.map((r) => [r.id, r] as const));
      // The overrides of classics that count as reviewed — curatorStatus, not the bare marker,
      // so the plan can never disagree with the chips and the counter.
      const reviewed = overrides.filter((o) => {
        const r = byId.get(o.baseId);
        return isBuiltinId(o.baseId) && !!r && curatorStatus(r) === 'reviewed';
      });
      if (cancelled) return;
      setSendCount(reviewed.length);
      if (!reviewed.length) return;
      const by = activeProfile.value?.name ?? '';
      const envs: ReturnType<typeof buildPatchEnvelope>[] = [];
      for (const o of reviewed) {
        const ctx: ShareContext & { name?: Text } = { by, userIngredients: userIngredients.value, lineOverrides: await listLineOverrides(o.baseId) };
        const name = byId.get(o.baseId)?.name;
        if (name) ctx.name = name;
        envs.push(buildPatchEnvelope(o, ctx));
      }
      const p = await planMessages(envs, appInfo.appUrl, { lang: ui, by, name: 'curator' });
      if (!cancelled) setPlan(p);
    })().catch((e: unknown) => {
      if (!cancelled) setError(String(e));
    });
    return () => {
      cancelled = true;
    };
  }, [recipes]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, machine: 0, reviewed: 0, missing: 0 };
    for (const r of recipes ?? []) {
      c.all++;
      c[curatorStatus(r)]++;
    }
    return c;
  }, [recipes]);

  const shown = useMemo(() => (recipes ?? []).filter((r) => filter === 'all' || curatorStatus(r) === filter), [recipes, filter]);

  async function open(id: string) {
    setStatus('');
    try {
      const [base, override, lineOverrides] = await Promise.all([getBaseRecipe(id), getOverride(id), listLineOverrides(id)]);
      if (!base) return;
      const effective = applyOverride(base, override ?? null);
      setEdit({ base, effective, prev: override?.patch, lineOverrides, draft: draftFrom(effective) });
    } catch (e) {
      setError(String(e));
    }
  }

  function setDraft(mut: (d: CuratorDraft) => CuratorDraft) {
    setEdit((e) => (e ? { ...e, draft: mut(e.draft) } : e));
  }

  /**
   * 6A.2: to that entry in the Woordenboek. The route change unmounts this screen and its draft,
   * so unsaved English first asks (the same confirm() the delete buttons use).
   */
  function openDictionary(ingredientId: string) {
    if (edit && draftDirty(edit) && !confirm(t('curator.unsavedLeave'))) return;
    navigate(dictionaryRouteFor(ingredientId));
  }

  async function save() {
    if (!edit || busy) return;
    setBusy(true);
    setStatus('');
    try {
      const by = activeProfile.value?.name ?? null;
      const patch = buildCuratorPatch(edit.base, edit.effective, edit.prev, edit.draft, by);
      await saveOverride({ baseId: edit.base.id, patch, by });
      // The list row and the panel both follow the fresh override; the plan effect re-runs too.
      const fresh = await getRecipe(edit.base.id);
      if (fresh) setRecipes((list) => (list ? list.map((r) => (r.id === fresh.id ? fresh : r)) : list));
      const override = await getOverride(edit.base.id);
      const effective = applyOverride(edit.base, override ?? null);
      setEdit({ base: edit.base, effective, prev: override?.patch, lineOverrides: edit.lineOverrides, draft: draftFrom(effective) });
      // Honest about the marker: without an English name the save kept the edits but the classic
      // still counts as 'missing', not as reviewed (buildCuratorPatch sets no 'human' marker then).
      setStatus(t(edit.draft.nameEn.trim() !== '' ? 'curator.saved' : 'curator.savedNoName'));
    } catch (e) {
      setStatus(`${t('common.error')}: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  /** Within the tap: shareText/shareJsonFile call navigator.share before their first await. */
  function send() {
    if (!plan || busy) return;
    setBusy(true);
    setStatus('');
    if ('text' in plan) {
      void shareText(plan.text)
        .then((r) => {
          if (r.outcome === 'shared') setStatus(t('curator.sent'));
          else if (r.outcome === 'no-share-api') setStatus(t('share.noShareApi'));
          else if (r.outcome === 'failed') setStatus(`${t('share.error')}: ${r.error ?? ''}`);
        })
        .finally(() => setBusy(false));
    } else {
      void shareJsonFile(plan.file.name, plan.file.json)
        .then((r) => {
          if (r.outcome === 'shared') setStatus(t('curator.sent'));
          else if (r.outcome === 'downloaded') setStatus(t('share.fileDownloaded', { name: r.name }));
          else if (r.outcome === 'failed') setStatus(`${t('share.fileFailed')}: ${r.error ?? ''}`);
        })
        .finally(() => setBusy(false));
    }
  }

  // --- Edit panel (one classic) ---
  if (edit) {
    const s = curatorStatus(edit.effective);
    const reviewedBy = edit.effective.text?.reviewedBy;
    const desc = edit.effective.description;
    const hasDesc = !!desc && ((desc.nl ?? '').trim() !== '' || (desc.en ?? '').trim() !== '');
    // 6A.2: the lines as the recipe screen renders them (line overrides merged in, same index as
    // `effective.lines` and the draft), against the dictionary every screen renders with.
    const dict = dictionary.value;
    const shownLines = effectiveLines(edit.effective, edit.lineOverrides);
    const anyFromDictionary = shownLines.some((l) => lineUsesDictionary(l, dict));
    return (
      <>
        <Header title={t('curator.title')} back backLabel={t('common.back')} />
        <div class="screen curator">
          <section class="card curator-edit">
            <div class="curator-edit-head">
              <button type="button" class="btn btn-small" onClick={() => setEdit(null)}>
                ‹ {t('curator.backToList')}
              </button>
              <span class={badgeClass(s)}>{t('curator.status.' + s)}</span>
            </div>
            <h2>{edit.base.name.nl ?? ''}</h2>
            {s === 'reviewed' && reviewedBy && <p class="muted small">{t('curator.reviewedBy', { name: reviewedBy })}</p>}

            <h3>{t('curator.name')}</h3>
            <Pair label={t('curator.name')} nl={edit.effective.name.nl ?? ''} value={edit.draft.nameEn} onInput={(v) => setDraft((d) => ({ ...d, nameEn: v }))} />

            {hasDesc && (
              <>
                <h3>{t('curator.description')}</h3>
                <Pair label={t('curator.description')} multiline nl={desc?.nl ?? ''} value={edit.draft.descriptionEn} onInput={(v) => setDraft((d) => ({ ...d, descriptionEn: v }))} />
              </>
            )}

            <h3>{t('curator.ingredients')}</h3>
            {anyFromDictionary && <p class="muted small curator-dict-hint">{t('curator.dictionaryHint')}</p>}
            {shownLines.map((l, i) => {
              const ing = l.ing;
              if (ing && lineUsesDictionary(l, dict)) {
                return <DictionaryPair key={i} index={i + 1} nl={l.raw?.nl ?? ''} en={renderLine(l, dict, 'en')} own={isUserIngredientId(ing)} onImprove={() => openDictionary(ing)} />;
              }
              return (
                <Pair
                  key={i}
                  label={t('curator.ingredients')}
                  index={i + 1}
                  header={l.kind === 'header'}
                  nl={l.raw?.nl ?? ''}
                  value={edit.draft.linesEn[i] ?? ''}
                  onInput={(v) =>
                    setDraft((d) => {
                      const linesEn = [...d.linesEn];
                      linesEn[i] = v;
                      return { ...d, linesEn };
                    })
                  }
                />
              );
            })}

            <h3>{t('curator.steps')}</h3>
            {edit.effective.steps.map((st, i) => (
              <Pair
                key={i}
                label={t('curator.steps')}
                index={i + 1}
                multiline
                nl={st.text?.nl ?? ''}
                value={edit.draft.stepsEn[i] ?? ''}
                onInput={(v) =>
                  setDraft((d) => {
                    const stepsEn = [...d.stepsEn];
                    stepsEn[i] = v;
                    return { ...d, stepsEn };
                  })
                }
              />
            ))}

            <div class="actions">
              <button type="button" class="btn btn-primary btn-block" disabled={busy} onClick={() => void save()}>
                {t('curator.save')}
              </button>
              <button type="button" class="btn" onClick={() => setEdit(null)}>
                {t('curator.backToList')}
              </button>
            </div>
            <div class="status" role="status">
              {status}
            </div>
          </section>
        </div>
      </>
    );
  }

  // --- List view ---
  return (
    <>
      <Header title={t('curator.title')} back backLabel={t('common.back')} />
      <div class="screen curator">
        <p class="muted small" style="padding-top:12px">
          {t('curator.intro')}
        </p>
        {error && <p class="warn">{error}</p>}

        <section class="card">
          <p class="curator-count">
            <strong>{t('curator.progress', { n: counts.reviewed, total: counts.all })}</strong>
          </p>
          <button type="button" class="btn btn-primary btn-block" disabled={busy || sendCount === 0 || plan === null} onClick={send}>
            {t('curator.send')}
          </button>
          <p class="muted small curator-send-hint">
            {sendCount === 0 ? t('curator.sendNone') : plan === null ? t('share.encoding') : `${sendCount === 1 ? t('curator.sendOne') : t('curator.sendCount', { n: sendCount })} ${t('curator.sendHint')}`}
          </p>
          <div class="status" role="status">
            {status}
          </div>
        </section>

        <div class="curator-chips" role="group" aria-label={t('curator.filters')}>
          {FILTERS.map((f) => (
            <button key={f} type="button" class={'curator-chip' + (filter === f ? ' on' : '')} onClick={() => setFilter(f)}>
              {t('curator.filter.' + f)} · {counts[f]}
            </button>
          ))}
        </div>

        {recipes === null && <div class="muted">{t('common.loading')}</div>}
        {recipes !== null && shown.length === 0 && <div class="empty">{t('curator.empty')}</div>}
        <ul class="curator-list">
          {shown.map((r) => {
            const s = curatorStatus(r);
            return (
              <li key={r.id}>
                <button type="button" class="row curator-row" onClick={() => void open(r.id)}>
                  <span class="name">
                    <strong>{r.name.nl ?? ''}</strong>
                    <span class="row-sub">{hasLang(r.name, 'en') ? r.name.en : t('curator.noEn')}</span>
                    {s === 'reviewed' && r.text?.reviewedBy && <span class="row-sub">{t('curator.reviewedBy', { name: r.text.reviewedBy })}</span>}
                  </span>
                  <span class={badgeClass(s)}>{t('curator.status.' + s)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
