// Servings scaler (docs/phase-2-spec.md §5): presets 2 / 4 / 6 / 8 plus − / +. The default is
// the recipe's own servings (classics: 4). The chosen value is remembered per recipe in memory
// only (a module-level map), so leaving and reopening a recipe keeps it during the session and a
// restart forgets it. The detail page hands the value to cook mode through `?srv=`.
import { t } from '@/i18n';

export const SERVINGS_PRESETS = [2, 4, 6, 8] as const;
export const MIN_SERVINGS = 1;
export const MAX_SERVINGS = 24;

const remembered = new Map<string, number>();

/** The servings last chosen for this recipe in this session, else `fallback`. */
export function rememberedServings(recipeId: string, fallback: number): number {
  return remembered.get(recipeId) ?? fallback;
}

export function rememberServings(recipeId: string, servings: number): void {
  remembered.set(recipeId, clampServings(servings));
}

export function clampServings(n: number): number {
  if (!Number.isFinite(n)) return 4;
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.round(n)));
}

/** Parses a `?srv=` query value; undefined when missing or invalid. */
export function parseServingsParam(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= MIN_SERVINGS && n <= MAX_SERVINGS ? Math.round(n) : undefined;
}

export interface ServingsPickerProps {
  value: number;
  /** The recipe's own servings; shown as "(recipe)" hint when the value differs. */
  base: number;
  onChange: (n: number) => void;
  /** Tighter variant for the cook-mode card. */
  compact?: boolean;
}

export function ServingsPicker(props: ServingsPickerProps) {
  const { value, base } = props;
  const set = (n: number) => {
    const next = clampServings(n);
    if (next !== value) props.onChange(next);
  };
  return (
    <div class={'servings' + (props.compact ? ' compact' : '')} role="group" aria-label={t('servings.label')}>
      <button type="button" class="servings-step" aria-label={t('servings.less')} disabled={value <= MIN_SERVINGS} onClick={() => set(value - 1)}>
        −
      </button>
      <div class="servings-presets">
        {SERVINGS_PRESETS.map((n) => (
          <button key={n} type="button" class={'servings-preset' + (n === value ? ' on' : '')} aria-pressed={n === value} onClick={() => set(n)}>
            {n}
          </button>
        ))}
        {!SERVINGS_PRESETS.includes(value as (typeof SERVINGS_PRESETS)[number]) && (
          <span class="servings-preset on custom" aria-current="true">
            {value}
          </span>
        )}
      </div>
      <button type="button" class="servings-step" aria-label={t('servings.more')} disabled={value >= MAX_SERVINGS} onClick={() => set(value + 1)}>
        +
      </button>
      <span class="servings-text">
        {t('servings.persons', { n: value })}
        {value !== base && <span class="muted"> · {t('servings.base', { n: base })}</span>}
      </span>
    </div>
  );
}
