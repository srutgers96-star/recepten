// The two meta rows of a recipe (docs/phase-5-spec.md block A.4): "Categorie" (one choice over
// categories.json) and "Dieet & labels" (chips over the tag vocabulary). Shared by the editor and
// the "Controleer mijn recepten" screen's inline edit. The rows are controlled: the parent owns
// `value` and decides what a change means (the editor marks the recipe `metaManual`).
//
// A `suggestion` (src/domain/diet.ts `suggestMeta`) is shown as a hint with "Overnemen" when it
// differs from the value. Only the SURE part of a suggestion is ever applied: a diet tag the
// dictionary could only guess at (`unsure`) is shown as "waarschijnlijk" on its chip and in the
// hint, and the person confirms it with a tap — the same policy as tools/derive-tags.ts, which
// never writes an unsure tag.
//
// 6B blok 3 (docs/specs/labels-categorieen.md §1b, §1e): a third row "Keuken" between the two —
// "geen" plus every cuisine with its flag, one at a time (a second tap on the chosen one = geen).
// A cuisine is never suggested (no reliable heuristic): `applySuggestion` leaves it as it is.
//
// 6B blok 6 (docs/specs/labels-categorieen.md, "Blok 6 — keukens wereldwijd"): data/cuisines.json
// also holds reserve cuisines (`rare: true`, order 19+). The chips show "geen" + every ordinary
// cuisine + each reserve cuisine that is chosen or used by an existing recipe (`usedCuisines`, filled
// by the caller); under the chips a native select "Andere keuken…" lists every reserve cuisine
// alphabetically in the UI language. Picking one makes it the cuisine (it then shows as a chip) and
// the select jumps back to its first option.
import { categoryLabel, cuisineLabel } from '@/components/FilterChips';
import { dictionary } from '@/dictionary';
import { DIET_TAGS, SUGGESTED_TAGS, type DietTag, type MetaSuggestion } from '@/domain/diet';
import type { Cuisine } from '@/domain/dictionary';
import type { Lang } from '@/domain/model';
import { IMPORT_TAG_IDS } from '@/domain/photo-import';
import { hasKey, lang, t } from '@/i18n';

/** Category (null = none), cuisine (null = none) and tags as the recipe stores them. */
export interface MetaValue {
  category: string | null;
  /** data/cuisines.json id; null = no cuisine. */
  cuisine: string | null;
  tags: string[];
}

/** The tag vocabulary the chips offer, in data order (validate-data RECIPE_TAGS via photo-import). */
export const META_TAG_IDS: readonly string[] = IMPORT_TAG_IDS;

/** Label of a tag: `tag.<id>` (browse.ts) when it exists, else this file's own `meta.tag.<id>`, else the id. */
export function metaTagLabel(id: string): string {
  if (hasKey('tag.' + id)) return t('tag.' + id);
  if (hasKey('meta.tag.' + id)) return t('meta.tag.' + id);
  return id;
}

/** Label of a category id in the active language (falls back to the id). */
export function metaCategoryLabel(id: string | null | undefined): string {
  if (!id) return t('recipe.noCategory');
  return categoryLabel(dictionary.value.category(id), id);
}

/** "🇮🇹 Italiaans": flag + name of a cuisine id in the active language (falls back to the id). */
export function metaCuisineLabel(id: string): string {
  return cuisineLabel(dictionary.value.cuisine(id), id);
}

/** A reserve cuisine (`rare: true` in data/cuisines.json): offered in the "Andere keuken…" select. */
function isRareCuisine(c: Cuisine): boolean {
  return c.rare === true;
}

/**
 * The cuisines the Keuken row shows as chips, in `order`: every ordinary one, plus each reserve
 * cuisine that is `chosen` or occurs in `used` (the cuisine ids of the existing recipes).
 */
export function cuisineChipList(cuisines: readonly Cuisine[], chosen: string | null, used: readonly string[]): Cuisine[] {
  const shown = new Set(used);
  if (chosen) shown.add(chosen);
  return cuisines.filter((c) => !isRareCuisine(c) || shown.has(c.id));
}

/** Every reserve cuisine for the "Andere keuken…" select, alphabetical on its name in `l`. */
export function rareCuisineOptions(cuisines: readonly Cuisine[], l: Lang): Cuisine[] {
  const name = (c: Cuisine) => (l === 'nl' ? c.nl : c.en) || c.nl || c.id;
  return cuisines.filter(isRareCuisine).sort((a, b) => name(a).localeCompare(name(b), l === 'nl' ? 'nl' : 'en'));
}

/** The tags of a suggestion the dictionary is sure about (the ones "Overnemen" applies). */
export function sureTags(s: MetaSuggestion): string[] {
  return s.tags.filter((tag) => !s.unsure.includes(tag as DietTag));
}

/**
 * `value` with the sure part of `suggestion` applied: the category when the heuristic has one,
 * the tags the heuristic decides about (SUGGESTED_TAGS) set to its answer, every other tag
 * ("kids", "-optie", …) kept. Unsure diet tags are left as they are on the value. Order: the
 * value's tags in their order, new ones appended. The cuisine is never suggested and stays as it is.
 */
export function applySuggestion(value: MetaValue, suggestion: MetaSuggestion): MetaValue {
  const sure = sureTags(suggestion);
  const decided = (tag: string) => SUGGESTED_TAGS.includes(tag) && !suggestion.unsure.includes(tag as DietTag);
  const tags = value.tags.filter((tag) => !decided(tag) || sure.includes(tag));
  for (const tag of sure) if (!tags.includes(tag)) tags.push(tag);
  return { category: suggestion.category ?? value.category, cuisine: value.cuisine ?? null, tags };
}

/** True when applying the suggestion would change nothing. */
export function metaEqual(a: MetaValue, b: MetaValue): boolean {
  if ((a.category ?? null) !== (b.category ?? null)) return false;
  if ((a.cuisine ?? null) !== (b.cuisine ?? null)) return false;
  if (a.tags.length !== b.tags.length) return false;
  const set = new Set(a.tags);
  return b.tags.every((tag) => set.has(tag));
}

/** "Pasta · 🇮🇹 Italiaans · vegetarisch, snel" — the one-line summary of a value (or of a suggestion, with "waarschijnlijk"). */
export function metaSummary(value: MetaValue, unsure: readonly string[] = []): string {
  const parts: string[] = [];
  if (value.category) parts.push(metaCategoryLabel(value.category));
  if (value.cuisine) parts.push(metaCuisineLabel(value.cuisine));
  const tags = value.tags.map((tag) => (unsure.includes(tag) ? t('meta.probably', { tag: metaTagLabel(tag) }) : metaTagLabel(tag)));
  if (tags.length) parts.push(tags.join(', '));
  return parts.join(' · ');
}

export interface MetaRowsProps {
  value: MetaValue;
  onChange: (next: MetaValue) => void;
  /** Live suggestion; the hint + "Overnemen" appear when its sure part differs from `value`. */
  suggestion?: MetaSuggestion | null;
  /** Called on "Overnemen"; defaults to onChange(applySuggestion(value, suggestion)). */
  onAdopt?: (next: MetaValue) => void;
  disabled?: boolean;
  /** Distinguishes the radio/select names when two instances are on one page. */
  name?: string;
  /**
   * 6B blok 6: the cuisine ids that occur in the recipe list (PickSheet `cuisineIdsIn`); a reserve
   * cuisine among them is shown as a chip, the others only in the "Andere keuken…" select.
   */
  usedCuisines: readonly string[];
}

export function MetaRows(props: MetaRowsProps) {
  const { value, suggestion } = props;
  const dict = dictionary.value;
  const cuisineChips = cuisineChipList(dict.cuisines, value.cuisine ?? null, props.usedCuisines);
  const rareOptions = rareCuisineOptions(dict.cuisines, lang.value);
  const proposed = suggestion ? applySuggestion(value, suggestion) : null;
  const differs = !!proposed && !metaEqual(proposed, value);
  // Unsure diet tags the value does not carry yet: offered on the chip as "waarschijnlijk".
  const probable = suggestion ? suggestion.unsure.filter((tag) => suggestion.tags.includes(tag) && !value.tags.includes(tag)) : [];

  function toggleTag(tag: string) {
    const on = value.tags.includes(tag);
    props.onChange({ ...value, tags: on ? value.tags.filter((x) => x !== tag) : [...value.tags, tag] });
  }

  /** One cuisine at a time: a tap on the chosen one (or on "geen") leaves none. */
  function pickCuisine(id: string | null) {
    props.onChange({ ...value, cuisine: id === null || value.cuisine === id ? null : id });
  }

  function adopt() {
    if (!proposed) return;
    (props.onAdopt ?? props.onChange)(proposed);
  }

  return (
    <div class="meta-rows">
      <label class="field meta-cat">
        <span>{t('meta.category')}</span>
        <select
          class="input"
          name={(props.name ?? 'meta') + '-category'}
          value={value.category ?? ''}
          disabled={props.disabled}
          onChange={(e) => {
            const v = (e.currentTarget as HTMLSelectElement).value;
            props.onChange({ ...value, category: v || null });
          }}
        >
          <option value="">{t('recipe.noCategory')}</option>
          {dict.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {categoryLabel(c, c.id)}
            </option>
          ))}
        </select>
      </label>

      <div class="field meta-cuisine">
        <span>{t('meta.cuisine')}</span>
        <div class="meta-chips meta-cuisine-chips" role="group" aria-label={t('meta.cuisine')}>
          <button type="button" class={'meta-chip' + (!value.cuisine ? ' on' : '')} aria-pressed={!value.cuisine} disabled={props.disabled} onClick={() => pickCuisine(null)}>
            {t('meta.cuisineNone')}
          </button>
          {cuisineChips.map((c) => {
            const on = value.cuisine === c.id;
            return (
              <button key={c.id} type="button" class={'meta-chip' + (on ? ' on' : '')} aria-pressed={on} disabled={props.disabled} onClick={() => pickCuisine(c.id)}>
                {cuisineLabel(c, c.id)}
              </button>
            );
          })}
        </div>
        {rareOptions.length > 0 && (
          <select
            class="input meta-cuisine-select"
            name={(props.name ?? 'meta') + '-cuisine-other'}
            aria-label={t('meta.cuisineOther')}
            value=""
            disabled={props.disabled}
            onChange={(e) => {
              // Picking sets the cuisine (no toggle); the select itself always shows its first option again.
              const el = e.currentTarget as HTMLSelectElement;
              const id = el.value;
              el.value = '';
              if (id) props.onChange({ ...value, cuisine: id });
            }}
          >
            <option value="">{t('meta.cuisineOther')}</option>
            {rareOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {cuisineLabel(c, c.id)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div class="field meta-tags">
        <span>{t('meta.tags')}</span>
        <div class="meta-chips" role="group" aria-label={t('meta.tags')}>
          {META_TAG_IDS.map((tag) => {
            const on = value.tags.includes(tag);
            const maybe = !on && probable.includes(tag as DietTag);
            return (
              <button
                key={tag}
                type="button"
                class={'meta-chip' + (on ? ' on' : '') + (maybe ? ' maybe' : '') + (DIET_TAGS.includes(tag as DietTag) ? ' diet' : '')}
                aria-pressed={on}
                disabled={props.disabled}
                title={maybe ? t('meta.probablyHint') : undefined}
                onClick={() => toggleTag(tag)}
              >
                {metaTagLabel(tag)}
                {maybe && <span class="meta-chip-q">?</span>}
              </button>
            );
          })}
        </div>
        {probable.length > 0 && <p class="muted small meta-hint">{t('meta.probablyLine', { tags: probable.map(metaTagLabel).join(', ') })}</p>}
      </div>

      {differs && proposed && (
        <div class="meta-suggest" role="status">
          <span class="meta-suggest-text">{t('meta.suggestion', { text: metaSummary(proposed) || t('recipe.noCategory') })}</span>
          <button type="button" class="btn btn-small" disabled={props.disabled} onClick={adopt}>
            {t('meta.adopt')}
          </button>
        </div>
      )}
    </div>
  );
}
