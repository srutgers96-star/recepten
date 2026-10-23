// The Home card VANAVOND (docs/specs/home-a-plus.md §1g, Home A+ block 2). Three modes, decided by
// the pure `tonightMode` (src/domain/tonight.ts):
// - loading: recipes or plan still undefined → only the head line and "Laden…".
// - plan: the week plan has an uncooked dish whose recipe exists, and "Iets buiten je week" was not
//   tapped → that dish with its meta line ("45 min · Vlees · nog 3 te gaan" / "de laatste van je
//   week"), Open and 🎲 Iets anders (the NEXT uncooked dish of the plan, round; disabled with one).
//   The foot has one text button "Iets buiten je week ›" (→ free mode until the app restarts).
// - free: no plan, all cooked, or free mode → the former "Verras me": a random recipe from the pool
//   (`applyPickFilter` over the chips, minus every dish of the week plan via `outsideWeekIds`, unless
//   that leaves nothing: decision Fable 23 Oct, "Iets buiten je week" means really outside the week),
//   Open and 🎲 Nog een. The foot has the toggle "filters ▾" (the chips open under it; open/closed
//   remembered per phone) and, while the plan still has an uncooked dish, "Terug naar je week ›".
//   The chips only ever apply to the dice, never to the plan. The dice is a picker (6B blok 4,
//   docs/specs/labels-categorieen.md §1c): it rolls over main dishes only (`mainOnly`), unless the
//   chip "ook bijgerechten & zoet" (`pick.all`) or a chip of such a category is on. The plan mode
//   skips side dishes (`PlanItem.sideOf`, §1d): they follow their main and are never "Vanavond".
// Like `surpriseId` before, the shown dish lives in module variables (diceId, planItemId, freeMode)
// so Home shows the same one when you come back. `onShown` reports the shown recipe id (null while
// loading or empty) from a LAYOUT effect, never during render: it runs before the browser paints, so
// HomeScreen re-renders "Verder met" with the new id before any frame shows the line repeating the
// card's dish (decision Fable 23 Oct; a plain useEffect runs after paint and let it flash one frame).
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { categoryLabel } from '@/components/FilterChips';
import { PickChips, applyPickFilter, cuisineIdsIn, loadPickFilter, pickFilterActive, savePickFilter, tagIdsIn, type PickFilter } from '@/components/PickSheet';
import { otherLanguageName } from '@/components/RecipeRow';
import { dictionary } from '@/dictionary';
import type { Dictionary } from '@/domain/dictionary';
import { pickText, type Lang, type Recipe } from '@/domain/model';
import { mainItems, type Plan, type PlanItem } from '@/domain/planner';
import { currentPlanItem, nextPlanItem, outsideWeekIds, pickRandomId, tonightMeta, tonightMode, uncookedItems } from '@/domain/tonight';
import { lang, t } from '@/i18n';
import { navigate } from '@/router';

/** The dice chips survive a reload (moved here from HomeScreen; same key, so nobody loses them). */
export const SURPRISE_FILTERS_KEY = 'recepten.surpriseFilters';
/** "1" = the dice chips are open; any other value or absent = closed (per phone, §2b). */
export const TONIGHT_FILTERS_OPEN_KEY = 'recepten.tonightFiltersOpen';

// Module-level so the card shows the same dish when you come back to Home.
/** The dice pick of the free mode (re-rolled when it drops out of the pool, e.g. once it is in the week). */
let diceId: string | null = null;
/** The plan slot the plan mode shows (falls back to the first uncooked slot when it is gone). */
let planItemId: string | null = null;
/** "Iets buiten je week" was tapped: holds until the app restarts (never stored, §5c.6). */
let freeMode = false;

function loadFiltersOpen(): boolean {
  try {
    return localStorage.getItem(TONIGHT_FILTERS_OPEN_KEY) === '1';
  } catch {
    return false; // storage unavailable (private mode): closed
  }
}

function saveFiltersOpen(open: boolean): void {
  try {
    if (open) localStorage.setItem(TONIGHT_FILTERS_OPEN_KEY, '1');
    else localStorage.removeItem(TONIGHT_FILTERS_OPEN_KEY);
  } catch {
    /* storage may be unavailable (private mode) */
  }
}

function openRecipe(id: string) {
  navigate('/recipe/' + id);
}

/** "45 min" from the total time, else the active time; null when neither is there. */
function timePart(r: Recipe): string | null {
  const n = r.time?.total ?? r.time?.active;
  return typeof n === 'number' && n > 0 ? t('home.tonightMin', { n }) : null;
}

/** The category label; '' when the recipe has none (tonightMeta drops it). */
function categoryPart(r: Recipe, dict: Dictionary): string {
  return categoryLabel(
    dict.categories.find((c) => c.id === r.category),
    r.category ?? '',
  );
}

/** The dish name as a button (→ recipe), with the other language's name under it. */
function DishName(props: { recipe: Recipe; l: Lang }) {
  const { recipe, l } = props;
  const alt = otherLanguageName(recipe, l);
  return (
    <button type="button" class="surprise-name" onClick={() => openRecipe(recipe.id)}>
      {pickText(recipe.name, l)}
      {alt && <span class="surprise-alt">{alt}</span>}
    </button>
  );
}

export interface TonightCardProps {
  recipes: readonly Recipe[] | undefined; // allRecipes (undefined = loading)
  plan: Plan | undefined; // getPlan (undefined = loading)
  /** The recipe id the card shows now (null while loading/empty); HomeScreen uses it for "Verder met". */
  onShown?: (recipeId: string | null) => void;
}

export function TonightCard(props: TonightCardProps): JSX.Element {
  const { recipes, plan } = props;
  const l = lang.value;
  const dict = dictionary.value;
  const [, bump] = useState(0);
  const [filters, setFilters] = useState<PickFilter>(() => loadPickFilter(SURPRISE_FILTERS_KEY));
  const [filtersOpen, setFiltersOpen] = useState<boolean>(loadFiltersOpen);
  const onShownRef = useRef(props.onShown);
  onShownRef.current = props.onShown;

  const byId = useMemo(() => new Map((recipes ?? []).map((r) => [r.id, r] as const)), [recipes]);
  // The plan mode is about main dishes only (docs/specs/labels-categorieen.md §1d: a side dish follows
  // its main and is not a dish of its own; "N gerechten" = main dishes): no side as "Vanavond", none
  // in "🎲 Iets anders", none counted in "nog N te gaan". The dice pool below keeps the whole plan.
  const mains = useMemo(() => (plan ? { ...plan, items: mainItems(plan.items) } : undefined), [plan]);
  const uncooked = useMemo(() => (mains ? uncookedItems(mains, byId) : []), [mains, byId]);
  const tags = useMemo(() => tagIdsIn(recipes ?? []), [recipes]);
  // The dice only rolls over recipes that match the chips and are not in the week plan (the whole
  // filtered pool when every match is in the week); the pick is re-rolled when it drops out, also a
  // pick from before Kies 7 that is a week dish now.
  const filteredIds = useMemo(() => applyPickFilter(recipes ?? [], filters, dict, l, { mainOnly: true }).map((r) => r.id), [recipes, filters, dict, l]);
  const poolIds = useMemo(() => outsideWeekIds(filteredIds, plan), [filteredIds, plan]);
  const poolSet = useMemo(() => new Set(poolIds), [poolIds]);
  const mode = tonightMode(mains, recipes, freeMode);

  let item: PlanItem | undefined;
  let shown: Recipe | undefined;
  if (mode === 'plan') {
    // Remember the resolved slot, so "Iets anders" steps on from the dish that is really shown.
    item = currentPlanItem(uncooked, planItemId);
    planItemId = item?.id ?? null;
    shown = item ? byId.get(item.recipeId) : undefined;
  } else if (mode === 'free') {
    // A remembered pick outside the pool is let go: a new roll, or null when the pool is empty.
    if (!diceId || !poolSet.has(diceId)) diceId = pickRandomId(poolIds, null);
    shown = diceId ? byId.get(diceId) : undefined;
  }
  const shownId = shown?.id ?? null;

  // Before paint (see the top of this file): HomeScreen's re-render lands in the same frame.
  useLayoutEffect(() => {
    onShownRef.current?.(shownId);
  }, [shownId]);

  function changeFilters(next: PickFilter) {
    setFilters(next);
    savePickFilter(SURPRISE_FILTERS_KEY, next);
  }

  function toggleFilters() {
    const next = !filtersOpen;
    setFiltersOpen(next);
    saveFiltersOpen(next);
  }

  function setFree(on: boolean) {
    freeMode = on;
    bump((n) => n + 1);
  }

  let body: JSX.Element;
  if (mode === 'loading') {
    body = <div class="muted">{t('common.loading')}</div>;
  } else if (mode === 'plan' && item && shown) {
    const current = item;
    const r = shown;
    const left = uncooked.length;
    const meta = tonightMeta([timePart(r), categoryPart(r, dict), left >= 2 ? t('home.tonightLeft', { n: left }) : t('home.tonightLast')]);
    body = (
      <>
        <DishName recipe={r} l={l} />
        {meta && <div class="tonight-meta">{meta}</div>}
        <div class="surprise-actions">
          <button type="button" class="btn btn-primary" onClick={() => openRecipe(r.id)}>
            {t('home.open')}
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            disabled={left < 2}
            onClick={() => {
              planItemId = nextPlanItem(uncooked, current.id)?.id ?? null;
              bump((n) => n + 1);
            }}
          >
            <span aria-hidden="true">🎲</span> {t('home.tonightOther')}
          </button>
        </div>
        <div class="tonight-foot">
          <button type="button" onClick={() => setFree(true)}>
            {t('home.tonightOutside')}
          </button>
        </div>
      </>
    );
  } else {
    // "filters (n)": every chip that is on, the cuisines of 6B blok 3 included.
    const chipCount = filters.tags.length + filters.cats.length + filters.cuisines.length;
    const meta = shown ? tonightMeta([timePart(shown), categoryPart(shown, dict)]) : '';
    body = (
      <>
        {shown ? (
          <>
            <DishName recipe={shown} l={l} />
            {meta && <div class="tonight-meta">{meta}</div>}
            <div class="surprise-actions">
              <button type="button" class="btn btn-primary" onClick={() => shown && openRecipe(shown.id)}>
                {t('home.open')}
              </button>
              <button
                type="button"
                class="btn btn-secondary"
                onClick={() => {
                  diceId = pickRandomId(poolIds, diceId);
                  bump((n) => n + 1);
                }}
              >
                <span aria-hidden="true">🎲</span> {t('home.reroll')}
              </button>
            </div>
          </>
        ) : (
          <div class="muted">{t(pickFilterActive(filters) ? 'home.noMatch' : 'common.loading')}</div>
        )}
        <div class="tonight-foot">
          <button type="button" class="tonight-filters-toggle" aria-expanded={filtersOpen} onClick={toggleFilters}>
            {chipCount > 0 ? t('home.filtersActive', { n: chipCount }) : t('home.filters')} <span aria-hidden="true">{filtersOpen ? '▴' : '▾'}</span>
          </button>
          {uncooked.length > 0 && (
            <button type="button" onClick={() => setFree(false)}>
              {t('home.tonightBack')}
            </button>
          )}
        </div>
        {filtersOpen && <PickChips filter={filters} onChange={changeFilters} tags={tags} cuisines={cuisineIdsIn(recipes ?? [])} noQuery mainOnlyToggle />}
      </>
    );
  }

  return (
    <section class="card tonight">
      <div class="tonight-head">{t('home.tonight')}</div>
      {body}
    </section>
  );
}
