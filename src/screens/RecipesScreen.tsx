// '#/recipes' — all recipes (classics + own + received) grouped by initial in the active language,
// sticky letter headers, A-Z rail, bilingual search and filter chips (docs/phase-2-spec.md §5).
// The rail/scroll logic is the one that passed the phone test in phase 0; the data comes from the
// repository (schema 2). Unfiltered: letter groups + rail. Filtering (chips): a plain sorted list.
// Searching: `searchRecipes` groups (name → ingredient → category → tag) with a small header each,
// so typing "onion" finds the recipes that contain `ui`. '#/recipes?cat=<id>' opens the list
// pre-filtered on that category (Home shelf); the query is then dropped from the hash.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { FilterChips, applyFilters, isActive, loadFilters, saveFilters, type Filters } from '@/components/FilterChips';
import { Header } from '@/components/Header';
import { RecipeRow } from '@/components/RecipeRow';
import { TimerBar } from '@/components/TimerBar';
import { useLive } from '@/db/live';
import { allRecipes, listFavorites } from '@/db/repo';
import { dictionary } from '@/dictionary';
import { pickText, type Lang, type Recipe } from '@/domain/model';
import { initialOf } from '@/domain/recipe-source';
import { searchRecipes, type SearchGroup } from '@/domain/search';
import { lang, t } from '@/i18n';
import { activeProfile } from '@/profile';
import { navigate, route } from '@/router';

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

export function RecipesScreen() {
  const l = lang.value;
  const pid = activeProfile.value?.id ?? '';
  const all = useLive(allRecipes, []);
  const favs = useLive(() => (pid ? listFavorites(pid) : Promise.resolve(new Set<string>())), [pid]);
  const [query, setQuery] = useState(savedQuery);
  const [filters, setFilters] = useState<Filters>(() => loadFilters(LIST_FILTERS_KEY));
  const queryRef = useRef(query);
  queryRef.current = query;
  const scroller = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const [railLetter, setRailLetter] = useState<string | null>(null);
  const dict = dictionary.value;

  // '#/recipes?cat=<id>' from the Home shelf: replace the selection, then drop the query from the
  // hash so a reload or a tab switch does not re-apply it.
  const cat = route.value.path === '/recipes' ? route.value.query.get('cat') : null;
  useEffect(() => {
    if (!cat) return;
    changeFilters({ quick: [], cats: [cat] });
    setQuery('');
    navigate('/recipes', { replace: true });
  }, [cat]);

  function changeFilters(next: Filters) {
    setFilters(next);
    saveFilters(LIST_FILTERS_KEY, next);
  }

  const filtering = isActive(filters);
  const q = query.trim();
  const searching = q !== '';

  const base = useMemo(() => applyFilters(all ?? [], filters), [all, filters]);
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

  const countLabel = !all
    ? t('common.loading')
    : searching || filtering
      ? t('list.filtered', { n: count, total: all.length })
      : t('list.count', { n: count });
  const empty = all && count === 0;

  return (
    <>
      <Header title={t('list.title')}>
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
        <FilterChips value={filters} onChange={changeFilters} />
      </Header>
      <TimerBar />
      {/* The rail is positioned inside .az-area (list only), so it never overlays the header. */}
      <div class="az-area">
        <div class={'screen' + (groups.length > 1 ? ' has-az' : '')} ref={scroller}>
          <div class="muted small list-count">{countLabel}</div>
          {empty && <div class="empty">{t('list.empty')}</div>}
          {searching &&
            searchGroups.map((g) => (
              <section key={g.kind}>
                <div class="group-head">{t('search.' + g.kind)}</div>
                <ul class="list">
                  {g.recipes.map((r) => (
                    <li key={r.id}>
                      <RecipeRow recipe={r} favorite={favs?.has(r.id)} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          {!searching && filtering && (
            <ul class="list">
              {plain.map((r) => (
                <li key={r.id}>
                  <RecipeRow recipe={r} favorite={favs?.has(r.id)} />
                </li>
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
                  <li key={r.id}>
                    <RecipeRow recipe={r} favorite={favs?.has(r.id)} />
                  </li>
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
    </>
  );
}
