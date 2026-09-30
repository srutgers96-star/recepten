// '#/more/check-recipes' — "Controleer mijn recepten" (docs/phase-5-spec.md block A.6): every own
// and received recipe with its current category + diet/labels next to what the ingredients say
// (src/domain/diet.ts `suggestMeta`). Per recipe: Overnemen (the sure part of the suggestion),
// Sla over, or Zelf kiezen (the MetaRows inline); "Alles overnemen" for the rest. Writes go through
// repo.saveUserRecipe with `metaManual: true`, so the editor's auto-suggestion leaves them alone.
// Classics are not listed: their category/tags are changed on the recipe page or in override mode.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Header } from '@/components/Header';
import { MetaRows, applySuggestion, metaEqual, metaSummary, metaTagLabel, type MetaValue } from '@/components/MetaRows';
import { saveUserRecipe, userRecipes } from '@/db/repo';
import { dictionary } from '@/dictionary';
import { suggestMeta, type MetaSuggestion } from '@/domain/diet';
import { pickText, type Recipe } from '@/domain/model';
import { lang, t } from '@/i18n';
import { navigate } from '@/router';

interface Row {
  recipe: Recipe;
  suggestion: MetaSuggestion;
  current: MetaValue;
  /** `current` with the sure part of the suggestion applied. */
  proposed: MetaValue;
  /** True when adopting would change something. */
  differs: boolean;
  /** Probable diet tags the recipe does not carry (shown as "waarschijnlijk", never adopted by themselves). */
  probable: string[];
}

function metaOf(r: Recipe): MetaValue {
  return { category: r.category ?? null, tags: [...(r.tags ?? [])] };
}

function rowOf(recipe: Recipe): Row {
  const suggestion = suggestMeta(recipe, dictionary.value);
  const current = metaOf(recipe);
  const proposed = applySuggestion(current, suggestion);
  const probable = suggestion.unsure.filter((tag) => suggestion.tags.includes(tag) && !current.tags.includes(tag));
  return { recipe, suggestion, current, proposed, differs: !metaEqual(proposed, current), probable };
}

/** "Pasta · vegetarisch, snel, waarschijnlijk glutenvrij" — the suggestion as one line. */
function suggestedText(row: Row): string {
  const base = metaSummary(row.proposed);
  const more = row.probable.map((tag) => t('meta.probably', { tag: metaTagLabel(tag) })).join(', ');
  const text = [base, more].filter(Boolean).join(base && more ? ', ' : '');
  return text || t('checkRecipes.none');
}

export function CheckRecipesScreen() {
  const l = lang.value;
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [done, setDone] = useState<Set<string>>(new Set());
  const [showSkipped, setShowSkipped] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<MetaValue>({ category: null, tags: [] });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  useEffect(() => {
    let cancelled = false;
    userRecipes().then(
      (list) => {
        if (cancelled) return;
        list.sort((a, b) => pickText(a.name, l).localeCompare(pickText(b.name, l), l === 'nl' ? 'nl' : 'en'));
        setRecipes(list);
      },
      (e: unknown) => {
        console.error('check-recipes', e);
        if (!cancelled) setRecipes([]);
      },
    );
    return () => {
      cancelled = true;
    };
    // The sort language is fixed at load; a toggle mid-screen keeps the order.
  }, []);

  const dict = dictionary.value;
  const rows = useMemo(() => (recipes ?? []).map(rowOf), [recipes, dict]);
  const differing = rows.filter((r) => r.differs);
  // A recipe whose category/labels were chosen by hand before (`metaManual`, in the editor, on
  // the recipe page or here) is never part of "Alles overnemen": it sits in its own collapsed
  // block with per-row Overnemen only, so one tap cannot undo earlier manual choices.
  const isManual = (r: Row) => r.recipe.metaManual === true && !done.has(r.recipe.id);
  const pending = differing.filter((r) => !isManual(r) && !skipped.has(r.recipe.id) && !done.has(r.recipe.id));
  const manualRows = differing.filter((r) => isManual(r) && !skipped.has(r.recipe.id));
  const skippedRows = differing.filter((r) => skipped.has(r.recipe.id));
  const doneRows = rows.filter((r) => done.has(r.recipe.id));

  /** Writes `value` on the recipe (metaManual) and updates the local copy so the row re-renders. */
  async function write(row: Row, value: MetaValue): Promise<boolean> {
    const next: Recipe = { ...row.recipe, category: value.category, tags: [...value.tags], metaManual: true };
    try {
      await saveUserRecipe(next);
    } catch (e) {
      setStatus(`${t('common.error')}: ${String(e)}`);
      return false;
    }
    setRecipes((list) => (list ? list.map((r) => (r.id === next.id ? next : r)) : list));
    return true;
  }

  async function adopt(row: Row) {
    if (busy) return;
    setBusy(true);
    setStatus('');
    const ok = await write(row, row.proposed);
    if (ok) {
      setDone((s) => new Set(s).add(row.recipe.id));
      setSkipped((s) => {
        if (!s.has(row.recipe.id)) return s;
        const n = new Set(s);
        n.delete(row.recipe.id);
        return n;
      });
      setStatus(t('checkRecipes.done', { n: 1 }));
    }
    setBusy(false);
  }

  async function adoptAll() {
    if (busy || !pending.length) return;
    setBusy(true);
    setStatus('');
    let n = 0;
    const ids = new Set<string>();
    for (const row of pending) {
      if (await write(row, row.proposed)) {
        n++;
        ids.add(row.recipe.id);
      }
    }
    setDone((s) => new Set([...s, ...ids]));
    setStatus(t('checkRecipes.done', { n }));
    setBusy(false);
  }

  function skip(row: Row) {
    setSkipped((s) => new Set(s).add(row.recipe.id));
    if (editing === row.recipe.id) setEditing(null);
  }

  function startEdit(row: Row) {
    setEditing(row.recipe.id);
    setEditValue(row.proposed);
  }

  async function saveEdit(row: Row) {
    if (busy) return;
    setBusy(true);
    setStatus('');
    const ok = await write(row, editValue);
    if (ok) {
      setDone((s) => new Set(s).add(row.recipe.id));
      setEditing(null);
      setStatus(t('checkRecipes.done', { n: 1 }));
    }
    setBusy(false);
  }

  function originBadge(r: Recipe) {
    if (r.origin.kind === 'received') {
      return <span class="badge badge-green">{r.origin.receivedFrom ? t('list.from', { name: r.origin.receivedFrom }) : t('list.received')}</span>;
    }
    return <span class="badge">{t('list.own')}</span>;
  }

  function card(row: Row, kind: 'pending' | 'skipped' | 'manual') {
    const r = row.recipe;
    const isEditing = editing === r.id;
    return (
      <div class={'card cr-card' + (kind === 'skipped' ? ' cr-skipped' : '')} key={r.id}>
        <div class="cr-head">
          <button type="button" class="cr-name" onClick={() => navigate('/recipe/' + r.id)} aria-label={t('checkRecipes.open')}>
            {pickText(r.name, l)}
          </button>
          <span class="cr-badges">
            {originBadge(r)}
            {r.metaManual === true && <span class="badge badge-muted">{t('checkRecipes.manual')}</span>}
          </span>
        </div>
        <dl class="cr-compare">
          <dt>{t('checkRecipes.current')}</dt>
          <dd>{metaSummary(row.current) || t('checkRecipes.none')}</dd>
          <dt>{t('checkRecipes.suggested')}</dt>
          <dd class="cr-suggested">{suggestedText(row)}</dd>
        </dl>
        {isEditing ? (
          <div class="cr-edit">
            <MetaRows name={'cr-' + r.id} value={editValue} suggestion={row.suggestion} onChange={setEditValue} disabled={busy} />
            <div class="actions cr-actions">
              <button type="button" class="btn btn-primary" disabled={busy} onClick={() => void saveEdit(row)}>
                {t('checkRecipes.save')}
              </button>
              <button type="button" class="btn" disabled={busy} onClick={() => setEditing(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div class="actions cr-actions">
            <button type="button" class="btn btn-primary" disabled={busy} onClick={() => void adopt(row)}>
              {t('checkRecipes.adopt')}
            </button>
            <button type="button" class="btn" disabled={busy} onClick={() => startEdit(row)}>
              {t('checkRecipes.edit')}
            </button>
            {kind !== 'skipped' && (
              <button type="button" class="btn" disabled={busy} onClick={() => skip(row)}>
                {t('checkRecipes.skip')}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Header title={t('checkRecipes.title')} back backLabel={t('common.back')} />
      <div class="screen check-recipes">
        <p class="muted small cr-intro">{t('checkRecipes.intro')}</p>

        {recipes === null && <div class="empty">{t('common.loading')}</div>}
        {recipes !== null && recipes.length === 0 && <div class="empty">{t('checkRecipes.empty')}</div>}

        {recipes !== null && recipes.length > 0 && (
          <>
            {differing.length === 0 ? (
              <div class="empty">{t('checkRecipes.allGood', { n: recipes.length })}</div>
            ) : (
              <div class="cr-summary">
                <span class="cr-count">{t('checkRecipes.count', { n: differing.length, m: recipes.length })}</span>
                {pending.length > 1 && (
                  <button type="button" class="btn btn-secondary" disabled={busy} onClick={() => void adoptAll()}>
                    {t('checkRecipes.adoptAll', { n: pending.length })}
                  </button>
                )}
              </div>
            )}

            {pending.map((row) => card(row, 'pending'))}

            {differing.length > 0 && pending.length === 0 && manualRows.length === 0 && <p class="muted cr-finished">{t('checkRecipes.finished')}</p>}

            {manualRows.length > 0 && (
              <div class="cr-skipped-block cr-manual-block">
                <button type="button" class="btn btn-small" onClick={() => setShowManual(!showManual)}>
                  {showManual ? t('inbox.hide') : t('checkRecipes.showManual')} · {t('checkRecipes.manualCount', { n: manualRows.length })}
                </button>
                {showManual && (
                  <>
                    <p class="muted small cr-manual-hint">{t('checkRecipes.manualHint')}</p>
                    {manualRows.map((row) => card(row, 'manual'))}
                  </>
                )}
              </div>
            )}

            {doneRows.length > 0 && (
              <ul class="cr-done">
                {doneRows.map((row) => (
                  <li key={row.recipe.id}>
                    <span class="cr-tick" aria-hidden="true">
                      ✓
                    </span>
                    <span class="cr-done-name">{pickText(row.recipe.name, l)}</span>
                    <span class="muted small">{metaSummary(row.current) || t('checkRecipes.none')}</span>
                  </li>
                ))}
              </ul>
            )}

            {skippedRows.length > 0 && (
              <div class="cr-skipped-block">
                <button type="button" class="btn btn-small" onClick={() => setShowSkipped(!showSkipped)}>
                  {showSkipped ? t('inbox.hide') : t('checkRecipes.showSkipped')} · {t('checkRecipes.skipped', { n: skippedRows.length })}
                </button>
                {showSkipped && skippedRows.map((row) => card(row, 'skipped'))}
              </div>
            )}
          </>
        )}

        <div class="status" role="status">
          {status}
        </div>
      </div>
    </>
  );
}
