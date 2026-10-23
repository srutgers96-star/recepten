// '#/recipes' — all recipes (classics + own + received) grouped by initial in the active language,
// sticky letter headers, A-Z rail, bilingual search and filter chips (docs/phase-2-spec.md §5).
// The rail/scroll logic is the one that passed the phone test in phase 0; the data comes from the
// repository (schema 2). Unfiltered: letter groups + rail. Filtering (chips): a plain sorted list.
// Searching: `searchRecipes` groups (name → ingredient → category → tag) with a small header each,
// so typing "onion" finds the recipes that contain `ui`. '#/recipes?cat=<id>' opens the list
// pre-filtered on that category (Home shelf); '#/recipes?sort=<ListSort>' (Home row "Mijn recepten",
// docs/specs/home-a-plus.md §1e) picks that sort mode exactly as a tap on its pill would (and
// remembers it); either query is then dropped from the hash.
// The "+" in the header opens `AddMenu` (src/components/AddMenu.tsx, Home A+ §1b: the same sheet as
// the "+" on Home): Plak een recept · Zelf schrijven · Met AI · Kies een bestand, each with one line
// of explanation. The chips are the generic `PickChips` (every tag in the data + the categories,
// spec §0).
// Phase 5 (docs/phase-5-spec.md A-bis.8): select mode. "Selecteer" in the header, a long-press on
// a row, or '#/recipes?select=1[&id=<id>]' (Home) turns the rows into checkboxes and shows the
// `SelectBar` above the nav: Deel (one message with one token per recipe, or a bundle file when
// too long — navigator.share with ONE field, prepared in advance so the share runs inside the
// tap), + Deze week, Categorie/labels (own recipes in the recipe, classics as an override patch),
// Verwijder (own and received only, confirm) and Exporteer (a bundle file). Escape or "Klaar"
// leaves select mode.
// Phase 6 (docs/phase-6-spec.md 13A-2): a sort row above the list — A–Z (groups + rail, the
// default) · Recent bekeken (src/recent.ts, newest viewed first) · Eigen · Eigen & ontvangen (newest
// change first). The choice is remembered per phone ('recepten.recipes.sort'); the chips keep
// working inside the chosen mode, a search always looks through every recipe (the mode only orders
// and filters the unsearched list: "Eigen" remembered a week ago must not hide the classic soups
// from a search for "soep"), and the letter rail exists only in A–Z. A share or export from select
// mode is logged in the "In & uit" log (repo.logShareEvent).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { checkNewBadges } from '@/badges';
import { AddMenu } from '@/components/AddMenu';
import { appInfo } from '@/components/AppInfo';
import { Header } from '@/components/Header';
import { PickChips, applyPickFilter, loadPickFilter, pickFilterActive, savePickFilter, tagIdsIn, type PickFilter } from '@/components/PickSheet';
import { RecipeRow } from '@/components/RecipeRow';
import { SelectBar, type MetaChange } from '@/components/SelectBar';
import { TimerBar } from '@/components/TimerBar';
import { useLive } from '@/db/live';
import { addToPlan, allRecipes, bumpSharedRecipes, deleteUserRecipe, getOverride, isBuiltinId, listFavorites, listLineOverrides, listUserIngredients, logShareEvent, saveOverride, saveUserRecipe } from '@/db/repo';
import { dictionary } from '@/dictionary';
import { nowIso, pickText, type Lang, type Recipe, type Text } from '@/domain/model';
import { type LineOverride, type RecipeOverride } from '@/domain/overrides';
import { initialOf } from '@/domain/recipe-source';
import { searchRecipes, type SearchGroup } from '@/domain/search';
import { buildBundleEnvelope, buildPatchEnvelope, buildRecipeEnvelope, bundleFileName, planMessages, type MessagePlan } from '@/domain/share';
import type { Envelope } from '@/domain/token';
import { lang, t } from '@/i18n';
import { activeProfile } from '@/profile';
import { LIST_SORTS, isListSort, loadListSort, orderRecipes, recentIds, saveListSort, type ListSort } from '@/recent';
import { navigate, route } from '@/router';
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
  /** Ids of the selected recipes (patched classics by their own id) for the "In & uit" log. */
  ids: string[];
}

/** The i18n key of each sort mode's label (browse.ts). */
const SORT_LABEL: Record<ListSort, string> = { az: 'list.sortAz', recent: 'list.sortRecent', own: 'list.sortOwn', ownReceived: 'list.sortOwnReceived' };

/** The empty-state text of a non-A–Z mode that has nothing to show (no search, no chips). */
const SORT_EMPTY: Record<ListSort, string> = { az: 'list.empty', recent: 'list.emptyRecent', own: 'list.emptyOwn', ownReceived: 'list.emptyOwnReceived' };

/**
 * 13A-2: a share or export from select mode went out (share sheet 'shared', or a file landed in
 * Downloads). Fire-and-forget; the log never blocks the status line.
 */
function logSelectionShared(kind: 'recipes' | 'bundle', ids: readonly string[]) {
  void logShareEvent({ at: nowIso(), direction: 'out', kind, who: null, count: ids.length, recipeIds: [...ids] }).catch((e: unknown) => console.error('logShareEvent', e));
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
  // 13A-2: the sort mode (remembered per phone) and, for "Recent bekeken", the viewed ids — read
  // when the mode is chosen and again when the list data changes (a return from a recipe page
  // remounts the screen, so the id just viewed is at the front).
  const [sortMode, setSortMode] = useState<ListSort>(() => loadListSort());
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

  // '#/recipes?cat=<id>' from the Home shelf: replace the selection, then drop the query from the
  // hash so a reload or a tab switch does not re-apply it. '?select=1[&id=<id>]' (Home "Selecteer"
  // / long-press) enters select mode the same way. '?sort=<ListSort>' (Home row "Mijn recepten")
  // chooses that sort mode and remembers it, like a tap on the pill; an unknown value ('?sort=foo')
  // changes nothing but is dropped from the hash all the same, so it never lingers (spec §7 check 3).
  const onList = route.value.path === '/recipes';
  const cat = onList ? route.value.query.get('cat') : null;
  const selectQuery = onList ? route.value.query.get('select') : null;
  const preselect = onList ? route.value.query.get('id') : null;
  const sortQuery = onList ? route.value.query.get('sort') : null;
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
  useEffect(() => {
    if (sortQuery === null) return;
    if (isListSort(sortQuery)) {
      changeSort(sortQuery); // chooses and remembers (saveListSort), scrolls to the top
      // Arriving from Home ("Mijn recepten N ›") promises that list, not an old search over all recipes
      // (decision Fable, 23 Oct 2026; DEVICE-TEST row 70 step 4). A tap on the sort pill keeps the search.
      setQuery('');
    }
    navigate('/recipes', { replace: true });
  }, [sortQuery]);

  function changeFilters(next: PickFilter) {
    setFilters(next);
    savePickFilter(LIST_FILTERS_KEY, next);
  }

  function changeSort(next: ListSort) {
    setSortMode(next);
    saveListSort(next);
    setRailLetter(null);
    // A mode switch starts at the top: the old offset belongs to the old order. Forget the saved
    // offset too: on arrival via '?sort=' the list is still empty here, and the restore effect below
    // would otherwise scroll the new order to the old position once the recipes load.
    savedScroll = 0;
    if (scroller.current) scroller.current.scrollTop = 0;
  }

  // The search box is the screen's own (grouped results); the chip filter carries no query.
  const filtering = pickFilterActive(filters);
  const q = query.trim();
  const searching = q !== '';
  const az = sortMode === 'az';

  const tags = useMemo(() => tagIdsIn(all ?? []), [all]);
  const base = useMemo(() => applyPickFilter(all ?? [], filters, dict, l), [all, filters, dict, l]);
  // The chip-filtered recipes in the mode's own order (A–Z: unchanged; the groups sort by name).
  const recent = useMemo(() => (sortMode === 'recent' ? recentIds() : []), [sortMode, all]);
  const ordered = useMemo(() => (az ? base : orderRecipes(base, sortMode, recent)), [base, az, sortMode, recent]);
  // A search looks through every (chip-filtered) recipe, whatever the sort mode: "Eigen" or "Recent
  // bekeken" is a filter, and a remembered one must not silently turn "soep" into "Geen recepten gevonden".
  const searchGroups = useMemo<SearchGroup[]>(
    () => (searching ? searchRecipes(base, q, dict, l).map((g) => ({ kind: g.kind, recipes: sortByName(g.recipes, l) })) : []),
    [base, q, dict, l, searching],
  );
  const groups = useMemo(() => (searching || filtering || !az ? [] : groupRecipes(base, l)), [base, l, searching, filtering, az]);
  // Flat list: chips on in A–Z (by name), or any other mode (in its own order).
  const plain = useMemo(() => (searching ? [] : az ? (filtering ? sortByName(base, l) : []) : ordered), [base, ordered, l, searching, filtering, az]);
  const count = searching ? searchGroups.reduce((n, g) => n + g.recipes.length, 0) : ordered.length;

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
      if (!cancelled) setShareData({ plan, bundle, ids: selectedList.map((r) => r.id) });
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
    const ids = shareData.ids;
    const plan = shareData.plan;
    const done = 'text' in plan
      ? shareText(plan.text).then((r) => {
          if (r.outcome === 'shared') {
            setSelectStatus(t('select.shared'));
            countShared(shared);
            logSelectionShared('recipes', ids);
          } else if (r.outcome === 'no-share-api') setSelectStatus(t('share.noShareApi'));
          else if (r.outcome === 'failed') setSelectStatus(`${t('share.error')}: ${r.error ?? ''}`);
        })
      : shareJsonFile(plan.file.name, plan.file.json).then((r) => {
          if (r.outcome === 'shared') {
            setSelectStatus(t('share.fileShared'));
            countShared(shared);
            logSelectionShared('recipes', ids);
          } else if (r.outcome === 'downloaded') {
            setSelectStatus(t('share.fileDownloaded', { name: r.name }));
            logSelectionShared('recipes', ids);
          } else if (r.outcome === 'failed') setSelectStatus(`${t('share.fileFailed')}: ${r.error ?? ''}`);
        });
    void done.finally(() => setSelectBusy(false));
  }

  /** "Exporteer": always a bundle file (share sheet first, download as the fallback). Inside the tap. */
  function exportSelected() {
    if (!shareData || selectBusy) return;
    setSelectBusy(true);
    setSelectStatus('');
    const ids = shareData.ids;
    const fresh: Envelope = { ...shareData.bundle, at: nowIso() };
    void shareJsonFile(bundleFileName(by || 'selectie'), JSON.stringify(fresh, null, 2))
      .then((r) => {
        if (r.outcome === 'shared') {
          setSelectStatus(t('share.fileShared'));
          logSelectionShared('bundle', ids);
        } else if (r.outcome === 'downloaded') {
          setSelectStatus(t('share.fileDownloaded', { name: r.name }));
          logSelectionShared('bundle', ids);
        } else if (r.outcome === 'failed') setSelectStatus(`${t('share.fileFailed')}: ${r.error ?? ''}`);
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
    : searching || filtering || !az
      ? t('list.filtered', { n: count, total: all.length })
      : t('list.count', { n: count });
  const empty = all && count === 0;
  // A mode with nothing in it says why ("Nog niets bekeken"); with a search or chips on it is the plain "Geen recepten gevonden".
  const emptyText = t(searching || filtering ? 'list.empty' : SORT_EMPTY[sortMode]);

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
          {/* 13A-2: the sort row. Radios in a horizontally scrolling strip (44 px pills, 360 px wide phones). */}
          <div class="list-sort" role="radiogroup" aria-label={t('list.sort')}>
            {LIST_SORTS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={sortMode === m} class={'list-sort-pill' + (sortMode === m ? ' on' : '')} onClick={() => changeSort(m)}>
                {t(SORT_LABEL[m])}
              </button>
            ))}
          </div>
          <div class="muted small list-count">{countLabel}</div>
          {empty && <div class="empty">{emptyText}</div>}
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
          {/* Flat list: chips on in A–Z, or any other sort mode (its own order, no letter groups). */}
          {!searching && (filtering || !az) && (
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
      <AddMenu open={addMenu} onClose={() => setAddMenu(false)} />
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
