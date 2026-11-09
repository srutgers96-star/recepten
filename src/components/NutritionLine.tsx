// V9 (docs/specs/verbeterronde-9.md §1b): one quiet line under the recipe meta — "≈ 620 kcal p.p. · 92 %
// bekend" — that folds out into a small table per serving. Renders nothing when the setting is off, the
// table has not loaded yet, nothing could be counted, or fewer than NUTRITION_MIN_COVERAGE of the lines
// are known (a number on half a list misleads more than no number). Not in cook mode, share text or lists.
import { Fragment } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { dictionary } from '@/dictionary';
import type { Lang, Line } from '@/domain/model';
import { NUTRITION_MIN_COVERAGE, recipeNutrition, roundNutrients } from '@/domain/nutrition';
import { lang, t } from '@/i18n';
import { loadNutrition, nutritionEnabled, nutritionTable } from '@/nutrition';

/** A number with the language's decimal separator ("1,3" in Dutch, "1.3" in English). */
export function formatNutrient(n: number, l: Lang): string {
  const s = String(n);
  return l === 'nl' ? s.replace('.', ',') : s;
}

export function NutritionLine(props: { lines: readonly Line[]; servings: number }) {
  const [open, setOpen] = useState(false);
  const enabled = nutritionEnabled.value;
  const table = nutritionTable.value;
  const dict = dictionary.value;
  const l = lang.value;

  useEffect(() => {
    void loadNutrition();
  }, []);

  const result = useMemo(
    () => (enabled && table ? recipeNutrition(props.lines, props.servings, dict, table) : null),
    [enabled, table, props.lines, props.servings, dict],
  );

  if (!enabled || !table || !result || !result.perServing || result.coverage < NUTRITION_MIN_COVERAGE) return null;

  const n = roundNutrients(result.perServing);
  const pct = Math.round(result.coverage * 100);
  const rows: Array<[string, string]> = [
    [t('nutri.kcal'), `${formatNutrient(n.kcal, l)} kcal`],
    [t('nutri.protein'), `${formatNutrient(n.protein, l)} g`],
    [t('nutri.fat'), `${formatNutrient(n.fat, l)} g`],
    [t('nutri.carbs'), `${formatNutrient(n.carbs, l)} g`],
    [t('nutri.fibre'), `${formatNutrient(n.fibre, l)} g`],
    [t('nutri.salt'), `${formatNutrient(n.salt, l)} g`],
  ];

  return (
    <div class="nutri">
      <button type="button" class="nutri-line" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>
          {t('recipe.kcalLine', { kcal: formatNutrient(n.kcal, l) })} · {t('recipe.nutriKnown', { pct })}
        </span>
        <svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <>
          <p class="nutri-title">{t('recipe.nutriTitle')}</p>
          <dl class="nutri-table" aria-label={t('recipe.nutriTitle')}>
            {rows.map(([label, value]) => (
              <Fragment key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </Fragment>
            ))}
          </dl>
          <p class="nutri-note">{t('recipe.nutriNote', { counted: result.counted, total: result.total })}</p>
        </>
      )}
    </div>
  );
}
