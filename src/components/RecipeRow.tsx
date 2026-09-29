// One list row for a recipe (A-Z list, Home): name in the active language (fallback the other),
// the other language's name as a muted second line when it exists and differs, small badges —
// ★ favourite, "eigen", "van <naam>" — and a chevron. Tapping opens the detail.
import { hasLang, pickText, type Lang, type Recipe } from '@/domain/model';
import { lang, t } from '@/i18n';
import { navigate } from '@/router';

export interface RecipeRowProps {
  recipe: Recipe;
  favorite?: boolean;
  /** Optional second line under the name (e.g. a date). */
  subtitle?: string;
}

/** The name in the other language, when it exists and differs from the shown name. */
export function otherLanguageName(r: Recipe, l: Lang): string | null {
  const other: Lang = l === 'nl' ? 'en' : 'nl';
  if (!hasLang(r.name, l) || !hasLang(r.name, other)) return null;
  const shown = pickText(r.name, l);
  const alt = (r.name[other] ?? '').trim();
  return alt && alt.toLowerCase() !== shown.toLowerCase() ? alt : null;
}

export function RecipeRow(props: RecipeRowProps) {
  const r = props.recipe;
  const l = lang.value;
  const name = pickText(r.name, l);
  const altName = otherLanguageName(r, l);
  const kind = r.origin.kind;
  return (
    <a
      class="row"
      href={'#/recipe/' + r.id}
      onClick={(e) => {
        e.preventDefault();
        navigate('/recipe/' + r.id);
      }}
    >
      <span class="name">
        {name}
        {altName && (
          <span class="row-sub row-alt" lang={l === 'nl' ? 'en' : 'nl'}>
            {altName}
          </span>
        )}
        {props.subtitle && <span class="row-sub">{props.subtitle}</span>}
      </span>
      <span class="row-badges">
        {props.favorite && (
          <span class="star on" aria-label={t('list.favorite')}>
            ★
          </span>
        )}
        {kind === 'user' && <span class="badge">{t('list.own')}</span>}
        {kind === 'received' && (
          <span class="badge badge-green">{r.origin.receivedFrom ? t('list.from', { name: r.origin.receivedFrom }) : t('list.received')}</span>
        )}
      </span>
      <span class="chev" aria-hidden="true">
        ›
      </span>
    </a>
  );
}

/** "12 mrt" / "12 Mar"; the year is added when it is not the current one. Empty for bad input. */
export function formatShortDate(iso: string | undefined | null, l: Lang = lang.value): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  try {
    return d.toLocaleDateString(l === 'nl' ? 'nl-NL' : 'en-GB', opts);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
