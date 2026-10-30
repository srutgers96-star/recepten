// The variant tab row on the recipe page (13D, docs/specs/varianten-tabs.md §1a, §1f): one quiet,
// sideways scrolling row of pills above the ingredients — Origineel · one tab per active diet ·
// the personal versions (oldest first). A dashed diet tab is a proposal (proposed / stale), a full
// one is approved; a diet the recipe already has by nature is full with "✓ " and cannot be chosen
// (a tap only says so in a short line under the row; a swipe skips it). A personal version is full
// in the personal colour, labelled with the maker's first name ("Dino", "Dino 2" for a second one).
// The chosen tab has `.on` + `aria-selected`. Which tabs exist and what they show is decided by the
// page (`variantTabs` / `variantView` in src/domain/variants.ts, RecipeScreen); this component only
// draws the row and reports a choice. Colours and shape are CSS (`.vtabs`, `.vtab.*`, §1f); the
// pills also carry the app's generic `.chip` base.
//
// The choice travels as the `?v=` value of the page (`tabChoiceToParam` / `tabChoiceFromParam`): a
// diet ('glutenvrij') or the id of a personal version; Origineel has none. The same value is what
// src/vtab-memory.ts remembers per recipe.
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { Recipe } from '@/domain/model';
import { versionAuthor, type VariantDiet, type VariantStatus } from '@/domain/variants';
import { t } from '@/i18n';

export type TabChoice = { kind: 'original' } | { kind: 'diet'; diet: VariantDiet } | { kind: 'version'; recipeId: string };

/** One diet tab as `variantTabs(…).diets` gives it. */
export interface DietTab {
  diet: VariantDiet;
  status: VariantStatus;
}

export interface VariantTabsProps {
  tabs: Array<{ diet: VariantDiet; status: VariantStatus }>;
  /** `variantsOf(id)`, oldest first. */
  versions: Recipe[];
  choice: TabChoice;
  onChoose: (c: TabChoice) => void;
}

const ORIGINAL: TabChoice = { kind: 'original' };

/** How long the "Dit recept is al glutenvrij." line stays (the copy flash of the recipe page: 2.5 s). */
const NATURAL_SNACK_MS = 2500;

/** The tabs a tap or a swipe can land on, in row order: Origineel, the non-natural diets, the versions. */
function choosable(tabs: readonly DietTab[], versions: readonly Pick<Recipe, 'id'>[]): TabChoice[] {
  const out: TabChoice[] = [ORIGINAL];
  for (const tab of tabs) if (tab.status !== 'natural') out.push({ kind: 'diet', diet: tab.diet });
  for (const v of versions) if (v && v.id) out.push({ kind: 'version', recipeId: v.id });
  return out;
}

/** `?v=` of a choice: the diet, the version's recipe id, or null for Origineel. */
export function tabChoiceToParam(c: TabChoice): string | null {
  if (c.kind === 'diet') return c.diet;
  if (c.kind === 'version') return c.recipeId || null;
  return null;
}

/**
 * `?v=` (or the remembered value) as a choice: a diet whose tab exists and is not natural, or the id
 * of one of `versions`; anything else (absent, unknown, a tab that no longer exists) is Origineel.
 */
export function tabChoiceFromParam(v: string | null, tabs: readonly DietTab[], versions: readonly Pick<Recipe, 'id'>[]): TabChoice {
  if (!v) return ORIGINAL;
  return choosable(tabs, versions).find((c) => tabChoiceToParam(c) === v) ?? ORIGINAL;
}

/**
 * The tab a swipe lands on: `dir` 1 = the next tab (finger to the left), -1 = the previous one.
 * Natural diet tabs are skipped; at either end the choice stays. A choice that is not in the row
 * counts as Origineel.
 */
export function nextTabChoice(c: TabChoice, dir: 1 | -1, tabs: readonly DietTab[], versions: readonly Pick<Recipe, 'id'>[]): TabChoice {
  const list = choosable(tabs, versions);
  const key = tabChoiceToParam(c);
  const at = Math.max(0, list.findIndex((x) => tabChoiceToParam(x) === key));
  return list[at + dir] ?? list[at] ?? ORIGINAL;
}

/**
 * The labels of the personal-version tabs, in the order given: the maker's first name
 * (`versionAuthor`), else `vt.tab.version`; a second version with the same label gets a number
 * ("Dino", "Dino 2").
 */
export function versionTabLabels(versions: readonly Pick<Recipe, 'origin'>[]): string[] {
  const seen = new Map<string, number>();
  return versions.map((v) => {
    const base = versionAuthor(v) ?? t('vt.tab.version');
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base} ${n}`;
  });
}

function dietLabel(diet: VariantDiet): string {
  return t('vt.tab.' + diet);
}

function prefersReducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function VariantTabs(props: VariantTabsProps): JSX.Element {
  const { tabs, versions, choice, onChoose } = props;
  const row = useRef<HTMLDivElement>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const snackTimer = useRef<number | null>(null);
  const chosen = tabChoiceToParam(choice);

  // The "already gluten-free" line never outlives the row.
  useEffect(
    () => () => {
      if (snackTimer.current !== null) window.clearTimeout(snackTimer.current);
    },
    [],
  );

  // Keep the chosen pill in view after a tap, a swipe or on opening (sideways only: the page itself
  // never scrolls for it).
  useEffect(() => {
    const el = row.current;
    const pill = el?.querySelector<HTMLElement>('.vtab.on');
    if (!el || !pill) return;
    const box = el.getBoundingClientRect();
    const p = pill.getBoundingClientRect();
    const edge = 16;
    let delta = 0;
    if (p.left < box.left + edge) delta = p.left - (box.left + edge);
    else if (p.right > box.right - edge) delta = p.right - (box.right - edge);
    if (delta === 0) return;
    if (typeof el.scrollBy === 'function') el.scrollBy({ left: delta, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    else el.scrollLeft += delta;
  }, [chosen]);

  function choose(c: TabChoice) {
    if (tabChoiceToParam(c) === chosen) return;
    onChoose(c);
  }

  function showNatural(diet: VariantDiet) {
    setSnack(t('vt.naturalSnack', { diet: dietLabel(diet).toLowerCase() }));
    if (snackTimer.current !== null) window.clearTimeout(snackTimer.current);
    snackTimer.current = window.setTimeout(() => {
      snackTimer.current = null;
      setSnack(null);
    }, NATURAL_SNACK_MS);
  }

  const labels = versionTabLabels(versions);

  return (
    <>
      <div class="vtabs no-print" role="tablist" aria-label={t('vt.rowAria')} ref={row}>
        <button
          type="button"
          role="tab"
          class={'chip vtab original' + (chosen === null ? ' on' : '')}
          aria-selected={chosen === null}
          onClick={() => choose(ORIGINAL)}
        >
          {t('vt.tab.original')}
        </button>
        {tabs.map((tab) => {
          const label = dietLabel(tab.diet);
          if (tab.status === 'natural') {
            return (
              <button
                key={tab.diet}
                type="button"
                role="tab"
                class={'chip vtab diet-' + tab.diet + ' full natural'}
                aria-selected={false}
                aria-disabled="true"
                aria-label={t('vt.naturalAria', { diet: label.toLowerCase() })}
                onClick={() => showNatural(tab.diet)}
              >
                {'✓ ' + label}
              </button>
            );
          }
          const on = chosen === tab.diet;
          const look = tab.status === 'approved' ? ' full' : ' dotted';
          return (
            <button
              key={tab.diet}
              type="button"
              role="tab"
              class={'chip vtab diet-' + tab.diet + look + (on ? ' on' : '')}
              aria-selected={on}
              onClick={() => choose({ kind: 'diet', diet: tab.diet })}
            >
              {label}
            </button>
          );
        })}
        {versions.map((v, i) => {
          const on = chosen === v.id;
          const label = labels[i] ?? '';
          return (
            <button
              key={v.id}
              type="button"
              role="tab"
              class={'chip vtab personal full' + (on ? ' on' : '')}
              aria-selected={on}
              aria-label={t('vt.personal.by', { name: label })}
              onClick={() => choose({ kind: 'version', recipeId: v.id })}
            >
              {label}
            </button>
          );
        })}
      </div>
      {snack && (
        <p class="tool-flash vtab-flash no-print" role="status">
          {snack}
        </p>
      )}
    </>
  );
}
