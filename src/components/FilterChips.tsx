// Category labels for the chips and the Home shelf, plus the "Dieet" chip row (docs/phase-5-spec.md
// A.3): vegetarisch · vegan · glutenvrij as prominent chips above the generic chips on Home, the
// Recipes list and the Kies-N sheet, with one secondary toggle "ook als optie" that lets a chosen
// diet chip also match the `-optie` variant of that tag (vega-optie, vegan-optie, glutenvrij-optie).
// The phase-2 chip row that lived here (a hard-coded quick-filter list) was replaced by the generic
// `PickChips` in PickSheet.tsx (spec §0: chips follow the tags present in the data).
import type { Category } from '@/domain/dictionary';
import { DIET_TAGS, type DietTag } from '@/domain/diet';
import { hasKey, lang, t } from '@/i18n';

/** Category label in the active language (falls back to the id). */
export function categoryLabel(c: Category | undefined, id: string): string {
  if (!c) return id;
  return (lang.value === 'nl' ? c.nl : c.en) || c.nl || id;
}

/** The "-optie" tag of a diet tag (data/recipes.json: vega-optie, vegan-optie, glutenvrij-optie). */
export const OPTIE_TAG: Readonly<Record<DietTag, string>> = { vegetarisch: 'vega-optie', vegan: 'vegan-optie', glutenvrij: 'glutenvrij-optie' };

/** Every tag the diet row covers (the generic row leaves these out). */
export const DIET_ROW_TAGS: ReadonlySet<string> = new Set<string>([...DIET_TAGS, ...Object.values(OPTIE_TAG)]);

export function isDietTag(id: string): id is DietTag {
  return (DIET_TAGS as readonly string[]).includes(id);
}

/** Chip label of a tag: `filter.<id>` (capitalised), else `tag.<id>` capitalised, else the id. */
export function tagChipLabel(id: string): string {
  if (hasKey('filter.' + id)) return t('filter.' + id);
  if (hasKey('tag.' + id)) {
    const s = t('tag.' + id);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return id;
}

/** Lower-case label of a tag for inline chips (detail page): `tag.<id>`, else the id. */
export function tagTextLabel(id: string): string {
  return hasKey('tag.' + id) ? t('tag.' + id) : id;
}

export interface DietChipsProps {
  /** The diet tags that are on. */
  selected: readonly string[];
  /** "ook als optie": a selected diet tag also matches its -optie variant. */
  optie: boolean;
  onToggle: (tag: DietTag) => void;
  onOptie: (on: boolean) => void;
}

/** The prominent diet row: [Dieet] Vegetarisch · Vegan · Glutenvrij · (ook als optie). */
export function DietChips(props: DietChipsProps) {
  const anyOn = DIET_TAGS.some((tag) => props.selected.includes(tag));
  return (
    <div class="chips filter-chips diet-chips" role="group" aria-label={t('filter.diet')}>
      <span class="diet-label" aria-hidden="true">
        {t('filter.diet')}
      </span>
      {DIET_TAGS.map((tag) => {
        const on = props.selected.includes(tag);
        return (
          <button key={tag} type="button" class={'chip chip-diet' + (on ? ' on' : '')} aria-pressed={on} onClick={() => props.onToggle(tag)}>
            {tagChipLabel(tag)}
          </button>
        );
      })}
      <button
        type="button"
        class={'chip chip-optie' + (props.optie ? ' on' : '')}
        aria-pressed={props.optie}
        disabled={!anyOn}
        title={t('filter.dietOptieHint')}
        onClick={() => props.onOptie(!props.optie)}
      >
        {t('filter.dietOptie')}
      </button>
    </div>
  );
}
