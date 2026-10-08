// "Maak glutenvrije / vegetarische / vegan versie" review sheet (docs/phase-5-spec.md block F.2).
// Lists the swaps `planVariant` found for the diet (data/swaps.json) as tickable rows — old line
// struck through, new line in bold, the cook's note under it — and the lines that break the diet
// without a known replacement as "controleer zelf" rows. "Bewaar als nieuw recept" makes the
// variant (`makeVariant`: a NEW own recipe with `variantOf`, the diet tag and only the ticked
// swaps), saves it through the repo and hands the new id back so the caller can open it. The
// original is never touched. Uses the .sheet-* shell of base.css (same as IngredientPicker).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import swapsJson from '../../data/swaps.json';
import { saveUserRecipe } from '@/db/repo';
import { dictionary, lineText } from '@/dictionary';
import { pickText, type Line, type Recipe } from '@/domain/model';
import { applySwap, makeVariant, planVariant, type Swap, type VariantDiet, type VariantSwap } from '@/domain/variants';
import { lang, t } from '@/i18n';
import { activeProfile } from '@/profile';

/** data/swaps.json as the domain type (validated by tools/validate-data.ts `validateSwaps`). */
export const swapsData: Swap[] = swapsJson as Swap[];

export interface VariantSheetProps {
  recipe: Recipe;
  /** The EFFECTIVE lines (line overrides folded in), as the detail page shows them. */
  lines: readonly Line[];
  diet: VariantDiet;
  onClose: () => void;
  /** Called with the new recipe's id after a successful save. */
  onSaved: (id: string) => void;
}

/** One row of the review list: a swap (tickable) or an unresolved line ("controleer zelf"). */
interface Row {
  index: number;
  line: Line;
  swap?: VariantSwap;
}

export function VariantSheet(props: VariantSheetProps) {
  const l = lang.value;
  const dict = dictionary.value;
  const profile = activeProfile.value;
  const title = t('variant.title.' + props.diet);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [off, setOff] = useState<ReadonlySet<number>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const { onClose } = props;

  const plan = useMemo(() => planVariant({ lines: [...props.lines] }, props.diet, swapsData, dict), [props.lines, props.diet, dict]);

  // Swaps that apply first (tickable), then the "controleer zelf" lines, each group in line order.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const s of plan.swaps) if (s.applies) out.push({ index: s.index, line: plan.lines[s.index] as Line, swap: s });
    const check: Row[] = [];
    for (const s of plan.swaps) if (!s.applies) check.push({ index: s.index, line: plan.lines[s.index] as Line, swap: s });
    for (const i of plan.unresolved) check.push({ index: i, line: plan.lines[i] as Line });
    check.sort((a, b) => a.index - b.index);
    return [...out, ...check];
  }, [plan]);
  const tickable = rows.filter((r) => r.swap?.applies).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // aria-modal moves no focus by itself: put it on the × on open and hand it back on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtn.current?.focus({ preventScroll: true });
    return () => opener?.focus();
  }, []);

  function toggle(index: number) {
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function onSave() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const reviewed = { ...plan, swaps: plan.swaps.map((s) => (off.has(s.index) ? { ...s, applies: false } : s)) };
      const variant = makeVariant(props.recipe, reviewed, props.diet, { author: profile?.name ?? null });
      await saveUserRecipe(variant);
      props.onSaved(variant.id);
    } catch (e) {
      console.error('makeVariant', e);
      setError(true);
      setBusy(false);
    }
  }

  function oldText(line: Line): string {
    return lineText(line, l).trim() || pickText(line.raw, l);
  }

  function newText(line: Line, swap: VariantSwap): string {
    return lineText(applySwap(line, swap), l).trim() || pickText(swap.raw, l);
  }

  return (
    <div class="sheet-backdrop no-print" onClick={onClose}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <h2>{title}</h2>
          <button ref={closeBtn} type="button" class="icon-btn" aria-label={t('common.close')} onClick={onClose}>
            ×
          </button>
        </div>
        <div class="sheet-body">
          <p class="muted small variant-intro">{tickable > 0 ? t('variant.intro') : t('variant.onlyCheck')}</p>
          <ul class="variant-list">
            {rows.map((row) => {
              const swap = row.swap;
              if (swap && swap.applies) {
                const on = !off.has(row.index);
                return (
                  <li key={row.index}>
                    <label class={'variant-row' + (on ? '' : ' off')}>
                      <input type="checkbox" checked={on} disabled={busy} onChange={() => toggle(row.index)} />
                      <span class="variant-body">
                        <span class="visually-hidden">
                          {t('variant.swapLabel', { from: dict.ingredientName(swap.fromId, l), to: dict.ingredientName(swap.toId, l) })}
                        </span>
                        <span class="variant-old" aria-hidden="true">
                          {oldText(row.line)}
                        </span>
                        <br />
                        <span class="variant-new">{newText(row.line, swap)}</span>
                        {swap.note && pickText(swap.note, l) && <p class="variant-note">{pickText(swap.note, l)}</p>}
                      </span>
                    </label>
                  </li>
                );
              }
              // "controleer zelf": no swap known, or a swap the app could not place in this line
              // (name not found, a count without a piece weight, an "of …" alternative outside
              // parentheses) — then it says WHAT to replace it with, and still shows the cook's note.
              return (
                <li key={row.index}>
                  <div class="variant-row">
                    <span class="variant-mark" aria-hidden="true">
                      !
                    </span>
                    <span class="variant-body">
                      <span>{oldText(row.line)}</span>
                      <span class="variant-check">{t('variant.check')}</span>
                      <p class="variant-note">{swap ? t('variant.checkSwap', { from: dict.ingredientName(swap.fromId, l), to: dict.ingredientName(swap.toId, l) }) : t('variant.checkHint')}</p>
                      {swap?.note && pickText(swap.note, l) && <p class="variant-note">{pickText(swap.note, l)}</p>}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <div class="variant-foot">
          <p class="muted small variant-foot-hint">{profile ? t('variant.foot') : t('variant.noProfile')}</p>
          <button type="button" class="btn btn-primary" disabled={busy || !profile} onClick={() => void onSave()}>
            {busy ? t('variant.saving') : t('variant.save')}
          </button>
          {error && (
            <p class="variant-error" role="alert">
              {t('variant.saveFailed')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
