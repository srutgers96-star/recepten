// "Kies N" bottom sheet (docs/phase-4-spec.md §3 Week): a multi-select over all recipes with a
// search box, generic chips (every tag id present in the data + the categories; labelled via i18n
// with a fallback to the id, so a new tag such as `glutenvrij` shows up without code), sorted
// "lang niet gegeten" first (never cooked, then the oldest cook-log date), a counter x/N and
// "Verras me" that fills the remaining slots with `pickRecipes`. The filter + query are owned by
// the caller (the Week screen): they also define the pool of the per-slot reroll (🎲).
// The same generic chips (`PickChips` + `applyPickFilter`) serve the Recipes list and the Home
// dice (spec §0: one chip row that follows the data), persisted per screen with
// `loadPickFilter` / `savePickFilter`.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { formatShortDate } from '@/components/RecipeRow';
import { categoryLabel } from '@/components/FilterChips';
import { dictionary } from '@/dictionary';
import type { Dictionary } from '@/domain/dictionary';
import { pickText, type Lang, type Recipe } from '@/domain/model';
import { pickRecipes, type PlanItem } from '@/domain/planner';
import { flattenResults, searchRecipes } from '@/domain/search';
import { hasKey, lang, t } from '@/i18n';

export interface PickFilter {
  /** Tag ids; AND together (a recipe must carry all of them). */
  tags: string[];
  /** Category ids; OR among themselves (a recipe has one category; a tag with the same id counts too, "oven"). */
  cats: string[];
  /** Free-text search over name, ingredient, category and tag (src/domain/search.ts). */
  query: string;
}

export const EMPTY_PICK_FILTER: PickFilter = { tags: [], cats: [], query: '' };

export function pickFilterActive(f: PickFilter): boolean {
  return f.tags.length > 0 || f.cats.length > 0 || f.query.trim() !== '';
}

/** Chicken-like ingredient ids: kip, kipfilet, kipdijfilet, braadkip, kippenbout … but not the stock/spices. */
const CHICKEN_RE = /^(braadkip|kip(?!kruiden|penbouillon|penfond))/;

function hasChicken(r: Recipe): boolean {
  return r.lines.some((line) => {
    if (line.kind === 'header') return false;
    if (line.ing && CHICKEN_RE.test(line.ing)) return true;
    if (line.alt?.some((a) => a.ing && CHICKEN_RE.test(a.ing))) return true;
    // Unresolved line: the raw Dutch text still says "kip…" (not "kippenbouillon").
    return !line.ing && /\bkip(?!penbouillon|penfond|kruiden)/i.test(line.raw.nl ?? '');
  });
}

/**
 * Pseudo-tags computed from the lines rather than read from `recipe.tags` (no data tag exists
 * for them): "kip". They are offered as chips only when at least one recipe matches.
 */
const DERIVED_TAGS: Record<string, (r: Recipe) => boolean> = { kip: hasChicken };

function hasTag(r: Recipe, tag: string): boolean {
  const derived = DERIVED_TAGS[tag];
  return derived ? derived(r) : r.tags.includes(tag);
}

/** Every tag id present in the recipes, most frequent first, then the derived ones that match anything. */
export function tagIdsIn(recipes: readonly Recipe[]): string[] {
  const counts = new Map<string, number>();
  for (const r of recipes) for (const tag of r.tags ?? []) if (typeof tag === 'string' && tag) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  const out = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([id]) => id);
  for (const [id, test] of Object.entries(DERIVED_TAGS)) if (!counts.has(id) && recipes.some(test)) out.push(id);
  return out;
}

function sanitizePickFilter(v: unknown): PickFilter {
  const o = (v && typeof v === 'object' ? v : {}) as { tags?: unknown; cats?: unknown; query?: unknown; quick?: unknown };
  const strings = (list: unknown): string[] => (Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string' && x !== '') : []);
  const tags = strings(o.tags);
  const cats = strings(o.cats);
  // Phase-2 shape ({ quick, cats }): the quick chips were tags, except "vis" which was the category.
  for (const q of strings(o.quick)) {
    if (q === 'vis') cats.push(q);
    else tags.push(q);
  }
  return { tags: [...new Set(tags)], cats: [...new Set(cats)], query: typeof o.query === 'string' ? o.query : '' };
}

/** The persisted chip selection of a screen (localStorage; the query is never persisted). */
export function loadPickFilter(key: string): PickFilter {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...sanitizePickFilter(JSON.parse(raw)), query: '' } : EMPTY_PICK_FILTER;
  } catch {
    return EMPTY_PICK_FILTER;
  }
}

export function savePickFilter(key: string, f: PickFilter): void {
  try {
    if (f.tags.length || f.cats.length) localStorage.setItem(key, JSON.stringify({ tags: f.tags, cats: f.cats }));
    else localStorage.removeItem(key);
  } catch {
    /* storage may be unavailable (private mode) */
  }
}

/** Chip label of a tag: `filter.<id>` (capitalised chip strings), else `tag.<id>`, else the id. */
export function tagChipLabel(id: string): string {
  if (hasKey('filter.' + id)) return t('filter.' + id);
  if (hasKey('tag.' + id)) {
    const s = t('tag.' + id);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return id;
}

/** The recipes that match the chips and the query (the pool of Kies N, Verras me and reroll). */
export function applyPickFilter(recipes: readonly Recipe[], f: PickFilter, dict: Dictionary, l: Lang): Recipe[] {
  let out = recipes.filter((r) => {
    if (f.cats.length && !f.cats.some((c) => r.category === c || r.tags.includes(c))) return false;
    return f.tags.every((tag) => hasTag(r, tag));
  });
  const q = f.query.trim();
  if (q) out = flattenResults(searchRecipes(out, q, dict, l));
  return out;
}

function toggle(list: string[], v: string): string[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export interface PickChipsProps {
  filter: PickFilter;
  onChange: (next: PickFilter) => void;
  /** The tag ids to offer (from `tagIdsIn`). */
  tags: readonly string[];
  /** Hide the query chip (the sheet shows the search box itself). */
  noQuery?: boolean;
}

/** The generic chip row: [×] query · tags … · categories …, multi-select. A tag that shares its id with a category ("oven") is folded into that category chip. */
export function PickChips(props: PickChipsProps) {
  const f = props.filter;
  const dict = dictionary.value;
  const active = pickFilterActive(f);
  const q = f.query.trim();
  const catIds = new Set(dict.categories.map((c) => c.id));
  const tags = props.tags.filter((id) => !catIds.has(id));
  return (
    <div class="chips filter-chips pick-chips" role="group" aria-label={t('pick.filters')}>
      {active && (
        <button type="button" class="chip chip-clear" onClick={() => props.onChange(EMPTY_PICK_FILTER)} aria-label={t('pick.clear')}>
          ×
        </button>
      )}
      {!props.noQuery && q && (
        <button type="button" class="chip on chip-query" onClick={() => props.onChange({ ...f, query: '' })} aria-label={t('pick.clear')}>
          “{q}” ×
        </button>
      )}
      {tags.map((id) => {
        const on = f.tags.includes(id);
        return (
          <button key={id} type="button" class={'chip' + (on ? ' on' : '')} aria-pressed={on} onClick={() => props.onChange({ ...f, tags: toggle(f.tags, id) })}>
            {tagChipLabel(id)}
          </button>
        );
      })}
      {dict.categories.map((c) => {
        const on = f.cats.includes(c.id);
        return (
          <button key={c.id} type="button" class={'chip chip-cat' + (on ? ' on' : '')} aria-pressed={on} onClick={() => props.onChange({ ...f, cats: toggle(f.cats, c.id) })}>
            {categoryLabel(c, c.id)}
          </button>
        );
      })}
    </div>
  );
}

export interface PickSheetProps {
  open: boolean;
  /** N: the number of dishes to pick (the counter's total; "Verras me" fills up to it). */
  target: number;
  recipes: readonly Recipe[];
  /** Slots already in the plan: shown as "al in je week", never picked again. */
  existing: readonly PlanItem[];
  /** recipeId → ISO of the last cook-log entry (sort "lang niet gegeten"). */
  lastCooked: ReadonlyMap<string, string>;
  /** Cooked in the last 6 weeks (`recentCookedIds`); "Verras me" avoids them. */
  recentIds: ReadonlySet<string>;
  filter: PickFilter;
  onFilter: (next: PickFilter) => void;
  /** The chosen recipe ids, in selection order. */
  onConfirm: (ids: string[]) => void;
  onClose: () => void;
}

/** Never cooked first (by name), then the oldest cook date first. */
export function sortLongestNotEaten(list: readonly Recipe[], lastCooked: ReadonlyMap<string, string>, l: Lang): Recipe[] {
  const locale = l === 'nl' ? 'nl' : 'en';
  return [...list].sort((a, b) => {
    const da = lastCooked.get(a.id) ?? '';
    const db = lastCooked.get(b.id) ?? '';
    if (da !== db) return da < db ? -1 : 1;
    return pickText(a.name, l).localeCompare(pickText(b.name, l), locale, { sensitivity: 'base' });
  });
}

export function PickSheet(props: PickSheetProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const latest = useRef(props);
  latest.current = props;

  // Reset the selection on the OPEN transition only (the filter belongs to the caller and stays).
  useEffect(() => {
    if (!props.open) return;
    setSelected([]);
    const id = window.setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 80);
    return () => window.clearTimeout(id);
  }, [props.open]);

  // Escape closes.
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') latest.current.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.open]);

  const l = lang.value;
  const dict = dictionary.value;
  const tags = useMemo(() => tagIdsIn(props.recipes), [props.recipes]);
  const existingIds = useMemo(() => new Set(props.existing.map((p) => p.recipeId)), [props.existing]);
  const pool = useMemo(() => applyPickFilter(props.recipes, props.filter, dict, l), [props.recipes, props.filter, dict, l]);
  const rows = useMemo(() => sortLongestNotEaten(pool, props.lastCooked, l), [pool, props.lastCooked, l]);

  if (!props.open) return null;

  const target = Math.max(1, props.target);
  const remaining = Math.max(0, target - selected.length);
  const selectedSet = new Set(selected);

  function toggleRow(id: string) {
    if (existingIds.has(id)) return;
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  /** Fills the remaining slots from the filtered pool with the variation rules. */
  function surprise() {
    if (remaining === 0) return;
    const chosen: PlanItem[] = selected.map((recipeId) => ({ id: 'sel:' + recipeId, recipeId, servings: 4, addedAt: '' }));
    const picked = pickRecipes({ count: remaining, pool, recentIds: new Set(props.recentIds), existing: [...props.existing, ...chosen] });
    if (picked.length) setSelected((prev) => [...prev, ...picked.map((r) => r.id).filter((id) => !prev.includes(id))]);
  }

  return (
    <div class="sheet-backdrop" onClick={props.onClose}>
      <div class="sheet pick-sheet" role="dialog" aria-modal="true" aria-label={t('pick.title')} onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <h2>
            {t('pick.title')} <span class="pick-counter">{t('pick.counter', { n: selected.length, total: target })}</span>
          </h2>
          <button type="button" class="icon-btn" aria-label={t('common.close')} onClick={props.onClose}>
            ×
          </button>
        </div>
        <div class="pick-tools">
          <input
            ref={searchRef}
            class="input"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autocomplete="off"
            placeholder={t('pick.search')}
            value={props.filter.query}
            onInput={(e) => props.onFilter({ ...props.filter, query: (e.currentTarget as HTMLInputElement).value })}
          />
          <PickChips filter={props.filter} onChange={props.onFilter} tags={tags} noQuery />
          <div class="pick-sub muted small">
            <span>{t('pick.sortHint')}</span>
            <button type="button" class="btn btn-small btn-secondary" disabled={remaining === 0 || pool.length === 0} onClick={surprise}>
              <span aria-hidden="true">🎲</span> {t('pick.surprise')} · {remaining}
            </button>
          </div>
        </div>
        <div class="sheet-body pick-body">
          {rows.length === 0 ? (
            <div class="muted small picker-hint">{t('pick.none')}</div>
          ) : (
            <ul class="picker-list pick-list">
              {rows.map((r) => {
                const inPlan = existingIds.has(r.id);
                const on = selectedSet.has(r.id);
                const last = props.lastCooked.get(r.id);
                const sub = inPlan ? t('pick.inPlan') : last ? t('pick.lastCooked', { date: formatShortDate(last, l) }) : t('pick.neverCooked');
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      class={'picker-item pick-row' + (on ? ' on' : '') + (inPlan ? ' in-plan' : '')}
                      role="checkbox"
                      aria-checked={on}
                      disabled={inPlan}
                      onClick={() => toggleRow(r.id)}
                    >
                      <span class="pick-box" aria-hidden="true">
                        {on || inPlan ? '✓' : ''}
                      </span>
                      <span class="pick-text">
                        <span class="picker-name">{pickText(r.name, l)}</span>
                        <span class="picker-sub muted small">{sub}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div class="pick-foot">
          <button type="button" class="btn btn-primary btn-block" disabled={selected.length === 0} onClick={() => props.onConfirm(selected)}>
            {selected.length === 0 ? t('pick.addNone') : t('pick.add', { n: selected.length })}
          </button>
        </div>
      </div>
    </div>
  );
}
