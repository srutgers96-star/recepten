// '#/recipes' — all recipes (classics + own + received) grouped by initial in the active language,
// sticky letter headers, A-Z rail, bilingual search and filter chips (docs/phase-2-spec.md §5).
// The rail/scroll logic is the one that passed the phone test in phase 0; the data comes from the
// repository (schema 2). Unfiltered: letter groups + rail. Filtering (chips): a plain sorted list.
// Searching: `searchRecipes` groups (name → ingredient → category → tag) with a small header each,
// so typing "onion" finds the recipes that contain `ui`. '#/recipes?cat=<id>' opens the list
// pre-filtered on that category (Home shelf); the query is then dropped from the hash.
// Phase 4: the "+" in the header opens a small menu: Nieuw recept ('/add') or Kies bestand (A-bis.9:
// a recipe/bundle/backup file goes to the Inbox, plain text to the Add screen's import box); the chips
// are the generic `PickChips` (every tag in the data + the categories, spec §0).
// Phase 5 (docs/phase-5-spec.md A-bis.8): select mode. "Selecteer" in the header, a long-press on
// a row, or '#/recipes?select=1[&id=<id>]' (Home) turns the rows into checkboxes and shows the
// `SelectBar` above the nav: Deel (one message with one token per recipe, or a bundle file when
// too long — navigator.share with ONE field, prepared in advance so the share runs inside the
// tap), + Deze week, Categorie/labels (own recipes in the recipe, classics as an override patch),
// Verwijder (own and received only, confirm) and Exporteer (a bundle file). Escape or "Klaar"
// leaves select mode.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { checkNewBadges } from '@/badges';
import { appInfo } from '@/components/AppInfo';
import { Header } from '@/components/Header';
import { PickChips, applyPickFilter, loadPickFilter, pickFilterActive, savePickFilter, tagIdsIn, type PickFilter } from '@/components/PickSheet';
import { RecipeRow } from '@/components/RecipeRow';
import { SelectBar, type MetaChange } from '@/components/SelectBar';
import { TimerBar } from '@/components/TimerBar';
import { useLive } from '@/db/live';
import { addToPlan, allRecipes, bumpSharedRecipes, deleteUserRecipe, getOverride, isBuiltinId, listFavorites, listLineOverrides, listUserIngredients, saveOverride, saveUserRecipe } from '@/db/repo';
import { dictionary } from '@/dictionary';
import { nowIso, pickText, type Lang, type Recipe, type Text } from '@/domain/model';
import { type LineOverride, type RecipeOverride } from '@/domain/overrides';
import { initialOf } from '@/domain/recipe-source';
import { searchRecipes, type SearchGroup } from '@/domain/search';
import { buildBundleEnvelope, buildPatchEnvelope, buildRecipeEnvelope, bundleFileName, planMessages, type MessagePlan } from '@/domain/share';
import type { Envelope } from '@/domain/token';
import { lang, t } from '@/i18n';
import { activeProfile } from '@/profile';
import { fileHasRecipes } from '@/file-import';
import { navigate, pendingImport, pendingImportText, route } from '@/router';
import { shareJsonFile, shareText } from '@/share-actions';

interface Group {
  letter: string;
  items: Recipe[];
}

/** localStorage key of the list's chip selection (spec §5). */
export const LIST_FILTERS_KEY = 'recepten.filters';

// Scroll position and query survive a trip to a detail screen (feels like an app, not a page).
let savedScroll = 0;
let savedQuery = '';

function sortByName(list: readonly Recipe[], l: Lang): Recipe[] {
  const locale = l === 'nl' ? 'nl' : 'en';
  return [...list].sort((a, b) => pickText(a.name, l).localeCompare(pickText(b.name, l), locale, { sensitivity: 'base' }));
}

function groupRecipes(list: Recipe[], l: Lang): Group[] {
  const map = new Map<string, Recipe[]>();
  for (const r of list) {
    const k = initialOf(pickText(r.name, l));
    const arr = map.get(k);
    if (arr) arr.push(r);
    else map.set(k, [r]);
  }
  const letters = [...map.keys()].sort((a, b) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)));
  return letters.map((letter) => ({ letter, items: sortByName(map.get(letter) ?? [], l) }));
}

/** The `#p=` payload for a classic that only has "Koppel ingrediënt" links: no patch fields (as ShareScreen). */
function linksOnlyOverride(baseId: string, lineOverrides: LineOverride[]): RecipeOverride {
  const updatedAt = lineOverrides.reduce((max, o) => (o.updatedAt > max ? o.updatedAt : max), '');
  return { baseId, rev: 1, patch: {}, updatedAt };
}

/** What "Deel" and "Exporteer" send for the current selection, built ahead of the tap. */
interface ShareData {
  plan: MessagePlan;
  bundle: Envelope;
}

/**
 * Phase 5 block C (badge rule 'shared'): n recipes left this phone through the share sheet.
 * Fire-and-forget: bump the counter, then re-check badges for the active profile.
 */
function countShared(n: number) {
  void bumpSharedRecipes(n)
    .then(() => {
      const pid = activeProfile.value?.id;
      return pid ? checkNewBadges(pid) : undefined;
    })
    .catch((e: unknown) => console.error('bumpSharedRecipes', e));
}

export function RecipesScreen() {
  const l = lang.value;
  const pid = activeProfile.value?.id ?? '';
  const by = activeProfile.value?.name ?? '';
  const all = useLive(allRecipes, []);
  const favs = useLive(() => (pid ? listFavorites(pid) : Promise.resolve(new Set<string>())), [pid]);
  const [query, setQuery] = useState(savedQuery);
  const [filters, setFilters] = useState<PickFilter>(() => loadPickFilter(LIST_FILTERS_KEY));
  const queryRef = useRef(query);
  queryRef.current = query;
  const scroller = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const [railLetter, setRailLetter] = useState<string | null>(null);
  const dict = dictionary.value;

  // Select mode (A-bis.8).
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [selectStatus, setSelectStatus] = useState('');
  const [selectBusy, setSelectBusy] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);
  const [building, setBuilding] = useState(false);
  const [addMenu, setAddMenu] = useState(false);
  const [addStatus, setAddStatus] = useState('');

  /** "Kies bestand" in the "+" menu: recipes go to the Inbox, plain text to the Add screen's import box. */
  function onAddFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    file.text().then(
      (text) => {
        if (!text.trim()) {
          setAddStatus(t('edit.fileEmpty'));
          return;
        }
        setAddMenu(false);
        if (fileHasRecipes(text)) {
          pendingImport.value = text;
          navigate('/inbox');
        } else {
          pendingImportText.value = text;
          navigate('/add');
        }
      },
      () => setAddStatus(t('edit.fileFailed')),
    );
  }

  // '#/recipes?cat=<id>' from the Home shelf: replace the selection, then drop the query from the
  // hash so a reload or a tab switch does not re-apply it. '?select=1[&id=<id>]' (Home "Selecteer"
  // / long-press) enters select mode the same way.
  const onList = route.value.path === '/recipes';
  const cat = onList ? route.value.query.get('cat') : null;
  const selectQuery = onList ? route.value.query.get('select') : null;
  const preselect = onList ? route.value.query.get('id') : null;
  useEffect(() => {
    if (!cat) return;
    changeFilters({ tags: [], cats: [cat], query: '' });
    setQuery('');
    navigate('/recipes', { replace: true });
  }, [cat]);
  useEffect(() => {
    if (!selectQuery) return;
    enterSelect(preselect);
    navigate('/recipes', { replace: true });
  }, [selectQuery, preselect]);

  function changeFilters(next: PickFilter) {
    setFilters(next);
    savePickFilter(LIST_FILTERS_KEY, next);
  }

  // The search box is the screen's own (grouped results); the chip filter carries no query.
  const filtering = pickFilterActive(filters);
  const q = query.trim();
  const searching = q !== '';

  const tags = useMemo(() => tagIdsIn(all ?? []), [all]);
  const base = useMemo(() => applyPickFilter(all ?? [], filters, dict, l), [all, filters, dict, l]);
  const searchGroups = useMemo<SearchGroup[]>(
    () => (searching ? searchRecipes(base, q, dict, l).map((g) => ({ kind: g.kind, recipes: sortByName(g.recipes, l) })) : []),
    [base, q, dict, l, searching],
  );
  const groups = useMemo(() => (searching || filtering ? [] : groupRecipes(base, l)), [base, l, searching, filtering]);
  const plain = useMemo(() => (!searching && filtering ? sortByName(base, l) : []), [base, l, searching, filtering]);
  const count = searching ? searchGroups.reduce((n, g) => n + g.recipes.length, 0) : base.length;

  // Remember the position on leave …
  useEffect(() => {
    const el = scroller.current;
    return () => {
      savedScroll = el?.scrollTop ?? 0;
      savedQuery = queryRef.current;
    };
  }, []);

  // … and restore it once the list has rendered (useLive delivers the data after the first paint,
  // so restoring in a mount effect would scroll an empty list).
  const loaded = all !== undefined;
  useEffect(() => {
    if (!loaded) return;
    const el = scroller.current;
    if (el && savedScroll > 0) el.scrollTop = savedScroll;
  }, [loaded]);

  function jumpTo(letter: string) {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-letter="${letter}"]`);
    if (el && scroller.current) scroller.current.scrollTop = el.offsetTop;
  }

  function pickFromPointer(clientY: number) {
    const el = rail.current;
    if (!el) return;
    let best: { letter: string; d: number } | null = null;
    for (const span of el.querySelectorAll<HTMLElement>('span[data-letter]')) {
      const r = span.getBoundingClientRect();
      const d = Math.abs(clientY - (r.top + r.height / 2));
      if (!best || d < best.d) best = { letter: span.dataset.letter ?? '', d };
    }
    if (best && best.letter !== railLetter) {
      setRailLetter(best.letter);
      jumpTo(best.letter);
    }
  }

  // --- Select mode -------------------------------------------------------------------------------

  function enterSelect(id: string | null) {
    setSelectMode(true);
    setSelectStatus('');
    if (id) setSelected((prev) => new Set(prev).add(id));
  }

  function leaveSelect() {
    setSelectMode(false);
    setSelected(new Set());
    setSelectStatus('');
    setShareData(null);
  }

  function toggleSelected(r: Recipe) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(r.id)) next.delete(r.id);
      else next.add(r.id);
      return next;
    });
    setSelectStatus('');
  }

  // Escape leaves select mode (keyboards on tablets / desktop; phones use "Klaar").
  useEffect(() => {
    if (!selectMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') leaveSelect();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectMode]);

  // The selected recipes in list order; ids that vanished (deleted) drop out by themselves.
  const selectedList = useMemo(() => (all ?? []).filter((r) => selected.has(r.id)), [all, selected]);
  const selectedKey = selectedList.map((r) => r.id).join('|');

  // Build the message plan and the export bundle ahead of the tap: navigator.share must run inside
  // the user activation, and encoding tokens is async (DeltaShareScreen does the same).
  useEffect(() => {
    if (!selectMode || selectedList.length === 0) {
      setShareData(null);
      setBuilding(false);
      return;
    }
    let cancelled = false;
    setBuilding(true);
    (async () => {
      const userIngredients = await listUserIngredients();
      const ctx = { by, userIngredients };
      const envs: Envelope[] = [];
      const recipes: Recipe[] = [];
      const patches: RecipeOverride[] = [];
      const lineOverrides: LineOverride[] = [];
      const names: Record<string, Text> = {};
      for (const r of selectedList) {
        const lo = await listLineOverrides(r.id);
        if (isBuiltinId(r.id)) {
          // An adjusted classic travels as a patch (never a duplicate); links-only as an empty patch.
          const override = await getOverride(r.id);
          const patch = override ?? (lo.length ? linksOnlyOverride(r.id, lo) : undefined);
          if (patch) {
            envs.push(buildPatchEnvelope(patch, { ...ctx, lineOverrides: lo, name: r.name }));
            patches.push(patch);
            lineOverrides.push(...lo);
            names[r.id] = r.name;
            continue;
          }
        }
        envs.push(buildRecipeEnvelope(r, { ...ctx, lineOverrides: lo }));
        recipes.push(r);
        lineOverrides.push(...lo);
      }
      const plan = await planMessages(envs, appInfo.appUrl, { lang: l, by, name: by });
      const title = by ? t('select.exportTitle', { name: by }) : undefined;
      const bundle = buildBundleEnvelope({ recipes, patches, lineOverrides, names }, ctx, title ? { title } : {});
      if (!cancelled) setShareData({ plan, bundle });
    })()
      .catch((e: unknown) => {
        console.error('select share', e);
        if (!cancelled) setSelectStatus(`${t('share.error')}: ${String(e)}`);
      })
      .finally(() => {
        if (!cancelled) setBuilding(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectMode, selectedKey, by, l]);

  /** "Deel": the text (one token per recipe) or, when too long, the bundle file. Inside the tap. */
  function shareSelected() {
    if (!shareData || selectBusy) return;
    setSelectBusy(true);
    setSelectStatus('');
    // Count what is in the share sheet now, not what is selected when the sheet closes.
    const shared = selectedList.length;
    const plan = shareData.plan;
    const done = 'text' in plan
      ? shareText(plan.text).then((r) => {
          if (r.outcome === 'shared') {
            setSelectStatus(t('select.shared'));
            countShared(shared);
          } else if (r.outcome === 'no-share-api') setSelectStatus(t('share.noShareApi'));
          else if (r.outcome === 'failed') setSelectStatus(`${t('share.error')}: ${r.error ?? ''}`);
        })
      : shareJsonFile(plan.file.name, plan.file.json).then((r) => {
          if (r.outcome === 'shared') {
            setSelectStatus(t('share.fileShared'));
            countShared(shared);
          } else if (r.outcome === 'downloaded') setSelectStatus(t('share.fileDownloaded', { name: r.name }));
          else if (r.outcome === 'failed') setSelectStatus(`${t('share.fileFailed')}: ${r.error ?? ''}`);
        });
    void done.finally(() => setSelectBusy(false));
  }

  /** "Exporteer": always a bundle file (share sheet first, download as the fallback). Inside the tap. */
  function exportSelected() {
    if (!shareData || selectBusy) return;
    setSelectBusy(true);
    setSelectStatus('');
    const fresh: Envelope = { ...shareData.bundle, at: nowIso() };
    void shareJsonFile(bundleFileName(by || 'selectie'), JSON.stringify(fresh, null, 2))
      .then((r) => {
        if (r.outcome === 'shared') setSelectStatus(t('share.fileShared'));
        else if (r.outcome === 'downloaded') setSelectStatus(t('share.fileDownloaded', { name: r.name }));
        else if (r.outcome === 'failed') setSelectStatus(`${t('share.fileFailed')}: ${r.error ?? ''}`);
      })
      .finally(() => setSelectBusy(false));
  }

  /** "+ Deze week": a slot per recipe (repo skips ones already in the plan). */
  async function weekSelected() {
    if (selectBusy || selectedList.length === 0) return;
    setSelectBusy(true);
    setSelectStatus('');
    try {
      for (const r of selectedList) await addToPlan(r.id);
      setSelectStatus(t('select.weekAdded', { n: selectedList.length }));
    } catch (e) {
      console.error('addToPlan', e);
      setSelectStatus(`${t('common.error')}: ${String(e)}`);
    } finally {
      setSelectBusy(false);
    }
  }

  /**
   * Category/labels for every selected recipe: own/received in the recipe, classics as an
   * override patch on top of the stored one (same shape as RecipeScreen.onCategory). Both carry
   * `metaManual: true` (phase-5 A.4): a choice by hand that the suggestions leave alone.
   */
  async function metaSelected(change: MetaChange) {
    if (selectBusy || selectedList.length === 0) return;
    if (change.category === undefined && change.tags.length === 0) return;
    setSelectBusy(true);
    setSelectStatus('');
    try {
      for (const r of selectedList) {
        const tags = r.tags.filter((x) => !change.tags.some((c) => c.id === x && !c.on));
        for (const c of change.tags) if (c.on && !tags.includes(c.id)) tags.push(c.id);
        const category = change.category === undefined ? (r.category ?? null) : change.category;
        if (isBuiltinId(r.id)) {
          const existing = await getOverride(r.id);
          await saveOverride({ baseId: r.id, patch: { ...(existing?.patch ?? {}), category, tags, metaManual: true }, by: by || null });
        } else {
          await saveUserRecipe({ ...r, category, tags, metaManual: true });
        }
      }
      setSelectStatus(t('select.metaApplied', { n: selectedList.length }));
    } catch (e) {
      console.error('meta', e);
      setSelectStatus(`${t('common.error')}: ${String(e)}`);
    } finally {
      setSelectBusy(false);
    }
  }

  /** "Verwijder" after the bar's confirm: own and received only (the bar filtered them). */
  async function deleteSelected(own: readonly Recipe[]) {
    if (selectBusy || own.length === 0) return;
    setSelectBusy(true);
    setSelectStatus('');
    try {
      for (const r of own) await deleteUserRecipe(r.id);
      setSelected((prev) => {
        const next = new Set(prev);
        for (const r of own) next.delete(r.id);
        return next;
      });
      setSelectStatus(t('select.deleted', { n: own.length }));
    } catch (e) {
      console.error('deleteUserRecipe', e);
      setSelectStatus(`${t('common.error')}: ${String(e)}`);
    } finally {
      setSelectBusy(false);
    }
  }

  // --- Render --------------------------------------------------------------------------------------

  const countLabel = !all
    ? t('common.loading')
    : searching || filtering
      ? t('list.filtered', { n: count, total: all.length })
      : t('list.count', { n: count });
  const empty = all && count === 0;

  function row(r: Recipe) {
    return (
      <RecipeRow
        recipe={r}
        favorite={favs?.has(r.id)}
        selectable={selectMode}
        selected={selected.has(r.id)}
        onToggle={toggleSelected}
        onLongPress={(x) => enterSelect(x.id)}
      />
    );
  }

  return (
    <>
      <Header
        title={selectMode ? t('select.count', { n: selectedList.length }) : t('list.title')}
        noLang={selectMode}
        action={
          selectMode ? (
            <button type="button" class="icon-btn list-select" onClick={leaveSelect}>
              {t('select.done')}
            </button>
          ) : (
            <>
              <button type="button" class="icon-btn list-select" onClick={() => enterSelect(null)}>
                {t('select.enter')}
              </button>
              <button type="button" class="icon-btn list-add" aria-label={t('list.add')} aria-haspopup="dialog" onClick={() => setAddMenu(true)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            </>
          )
        }
      >
        <input
          class="input"
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autocomplete="off"
          placeholder={t('list.search')}
          value={query}
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
        />
        <PickChips filter={filters} onChange={changeFilters} tags={tags} noQuery />
      </Header>
      <TimerBar />
      {/* The rail is positioned inside .az-area (list only), so it never overlays the header. */}
      <div class="az-area">
        <div class={'screen' + (groups.length > 1 ? ' has-az' : '') + (selectMode ? ' selecting' : '')} ref={scroller}>
          <div class="muted small list-count">{countLabel}</div>
          {empty && <div class="empty">{t('list.empty')}</div>}
          {searching &&
            searchGroups.map((g) => (
              <section key={g.kind}>
                <div class="group-head">{t('search.' + g.kind)}</div>
                <ul class="list">
                  {g.recipes.map((r) => (
                    <li key={r.id}>{row(r)}</li>
                  ))}
                </ul>
              </section>
            ))}
          {!searching && filtering && (
            <ul class="list">
              {plain.map((r) => (
                <li key={r.id}>{row(r)}</li>
              ))}
            </ul>
          )}
          {groups.map((g) => (
            <section key={g.letter}>
              <div class="letter" data-letter={g.letter}>
                {g.letter}
              </div>
              <ul class="list">
                {g.items.map((r) => (
                  <li key={r.id}>{row(r)}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {groups.length > 1 && (
          <div
            class={'az-rail' + (railLetter ? ' active' : '')}
            ref={rail}
            aria-hidden="true"
            onPointerDown={(e) => {
              try {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              } catch {
                /* synthetic or already-released pointer */
              }
              pickFromPointer(e.clientY);
            }}
            onPointerMove={(e) => {
              if (railLetter !== null) pickFromPointer(e.clientY);
            }}
            onPointerUp={() => setRailLetter(null)}
            onPointerCancel={() => setRailLetter(null)}
          >
            {groups.map((g) => (
              <span key={g.letter} data-letter={g.letter}>
                {g.letter}
              </span>
            ))}
          </div>
        )}
        {railLetter && <div class="az-bubble">{railLetter}</div>}
      </div>
      {addMenu && (
        <div class="sheet-backdrop" onClick={() => setAddMenu(false)}>
          <div class="sheet" role="dialog" aria-modal="true" aria-label={t('list.add')} onClick={(e) => e.stopPropagation()}>
            <div class="sheet-head">
              <h2>{t('list.add')}</h2>
              <button type="button" class="icon-btn" aria-label={t('common.close')} onClick={() => setAddMenu(false)}>
                ×
              </button>
            </div>
            <div class="sheet-body add-menu">
              <button type="button" class="add-menu-row" onClick={() => navigate('/add')}>
                <strong>{t('list.addNew')}</strong>
                <span class="muted small">{t('list.addNewHint')}</span>
              </button>
              <label class="add-menu-row">
                <strong>{t('list.addFile')}</strong>
                <span class="muted small">{t('list.addFileHint')}</span>
                <input type="file" accept=".json,.txt,application/json,text/plain" style="display:none" onChange={onAddFile} />
              </label>
              {addStatus && (
                <p class="muted small" role="status">
                  {addStatus}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      {selectMode && (
        <SelectBar
          selected={selectedList}
          busy={selectBusy}
          building={building || !shareData}
          status={selectStatus}
          onShare={shareSelected}
          onWeek={() => void weekSelected()}
          onMeta={(change) => void metaSelected(change)}
          onDelete={(own) => void deleteSelected(own)}
          onExport={exportSelected}
        />
      )}
    </>
  );
}
