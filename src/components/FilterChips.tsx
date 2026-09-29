// Filter chips for the Recipes list and the "Verras me" dice (docs/phase-2-spec.md §5): the quick
// filters Vegetarisch · Snel · Oven · Vis · Kip · Wereld (from tags / category / ingredient ids)
// plus one chip per category from categories.json. Multi-select: the quick filters AND together,
// the category chips OR among themselves (a recipe has one category). The selection is kept in
// localStorage under a key the caller chooses ('recepten.filters' for the list).
import type { Category } from '@/domain/dictionary';
import type { Recipe } from '@/domain/model';
import { dictionary } from '@/dictionary';
import { lang, t } from '@/i18n';

export const QUICK_FILTERS = ['vegetarisch', 'snel', 'oven', 'vis', 'kip', 'wereld'] as const;
export type QuickFilter = (typeof QUICK_FILTERS)[number];

export interface Filters {
  quick: QuickFilter[];
  /** Category ids (categories.json). */
  cats: string[];
}

export const EMPTY_FILTERS: Filters = { quick: [], cats: [] };

/** Category ids already covered by a quick chip (not repeated in the category row). */
const COVERED_BY_QUICK = new Set<string>(['oven', 'vis']);

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

export function matchesQuick(r: Recipe, f: QuickFilter): boolean {
  switch (f) {
    case 'vegetarisch':
      return r.tags.includes('vegetarisch');
    case 'snel':
      return r.tags.includes('snel');
    case 'oven':
      return r.tags.includes('oven') || r.category === 'oven';
    case 'vis':
      return r.category === 'vis';
    case 'kip':
      return hasChicken(r);
    case 'wereld':
      return r.tags.includes('wereld');
  }
}

export function isActive(f: Filters): boolean {
  return f.quick.length > 0 || f.cats.length > 0;
}

export function matchesFilters(r: Recipe, f: Filters): boolean {
  if (f.cats.length && !(r.category && f.cats.includes(r.category))) return false;
  return f.quick.every((q) => matchesQuick(r, q));
}

export function applyFilters(list: readonly Recipe[], f: Filters): Recipe[] {
  if (!isActive(f)) return [...list];
  return list.filter((r) => matchesFilters(r, f));
}

function sanitize(v: unknown): Filters {
  const o = (v && typeof v === 'object' ? v : {}) as { quick?: unknown; cats?: unknown };
  const quick = Array.isArray(o.quick) ? o.quick.filter((q): q is QuickFilter => (QUICK_FILTERS as readonly string[]).includes(String(q))) : [];
  const cats = Array.isArray(o.cats) ? o.cats.filter((c): c is string => typeof c === 'string' && c !== '') : [];
  return { quick: [...new Set(quick)], cats: [...new Set(cats)] };
}

export function loadFilters(key: string): Filters {
  try {
    const raw = localStorage.getItem(key);
    return raw ? sanitize(JSON.parse(raw)) : EMPTY_FILTERS;
  } catch {
    return EMPTY_FILTERS;
  }
}

export function saveFilters(key: string, f: Filters): void {
  try {
    if (isActive(f)) localStorage.setItem(key, JSON.stringify(f));
    else localStorage.removeItem(key);
  } catch {
    /* storage may be unavailable (private mode) */
  }
}

/** Category label in the active language (falls back to the id). */
export function categoryLabel(c: Category | undefined, id: string): string {
  if (!c) return id;
  return (lang.value === 'nl' ? c.nl : c.en) || c.nl || id;
}

export interface FilterChipsProps {
  value: Filters;
  onChange: (next: Filters) => void;
  /** Hide the category chips (Home keeps the row short). */
  noCategories?: boolean;
  /** Shown to a screen reader as the group name. */
  label?: string;
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

export function FilterChips(props: FilterChipsProps) {
  const f = props.value;
  const cats = props.noCategories ? [] : dictionary.value.categories.filter((c) => !COVERED_BY_QUICK.has(c.id));
  const active = isActive(f);
  return (
    <div class="chips filter-chips" role="group" aria-label={props.label ?? t('filter.label')}>
      {active && (
        <button type="button" class="chip chip-clear" onClick={() => props.onChange(EMPTY_FILTERS)} aria-label={t('filter.clear')}>
          ×
        </button>
      )}
      {QUICK_FILTERS.map((q) => {
        const on = f.quick.includes(q);
        return (
          <button key={q} type="button" class={'chip' + (on ? ' on' : '')} aria-pressed={on} onClick={() => props.onChange({ ...f, quick: toggle(f.quick, q) })}>
            {t('filter.' + q)}
          </button>
        );
      })}
      {cats.map((c) => {
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
