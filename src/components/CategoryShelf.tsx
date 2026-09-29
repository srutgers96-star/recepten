// Categories shelf on Home (docs/phase-2-spec.md §5): one tile per category from categories.json
// with the translated name and the number of recipes in it; a tap opens the Recipes list
// pre-filtered ('#/recipes?cat=<id>'). Categories without recipes are skipped.
import { useMemo } from 'preact/hooks';
import { categoryLabel } from '@/components/FilterChips';
import { dictionary } from '@/dictionary';
import type { Recipe } from '@/domain/model';
import { t } from '@/i18n';
import { navigateTab } from '@/router';

const ICONS: Record<string, string> = {
  soep: '🍲',
  salade: '🥗',
  'hartige-taart': '🥧',
  pasta: '🍝',
  rijst: '🍚',
  vlees: '🥩',
  vis: '🐟',
  stamppot: '🥔',
  oven: '🔥',
  'wok-noedels': '🍜',
  overig: '🍽️',
};

export function categoryCounts(recipes: readonly Recipe[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of recipes) if (r.category) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  return counts;
}

export function CategoryShelf(props: { recipes: readonly Recipe[] }) {
  const counts = useMemo(() => categoryCounts(props.recipes), [props.recipes]);
  const cats = dictionary.value.categories.filter((c) => (counts.get(c.id) ?? 0) > 0);
  if (cats.length === 0) return null;
  return (
    <section class="home-section">
      <h2>{t('home.categories')}</h2>
      <div class="cat-shelf">
        {cats.map((c) => (
          <a
            key={c.id}
            class="cat-tile"
            href={'#/recipes?cat=' + encodeURIComponent(c.id)}
            onClick={(e) => {
              e.preventDefault();
              navigateTab('/recipes?cat=' + encodeURIComponent(c.id));
            }}
          >
            <span class="cat-icon" aria-hidden="true">
              {ICONS[c.id] ?? '🍽️'}
            </span>
            <span class="cat-name">{categoryLabel(c, c.id)}</span>
            <span class="cat-count">{counts.get(c.id) ?? 0}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
