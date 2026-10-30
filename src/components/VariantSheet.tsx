// "Controleer en keur goed" — the approve sheet of a diet tab (docs/specs/varianten-tabs.md §1c, 13D
// blok 2). Rebuilt from the blok-F "Maak … versie" sheet: approving no longer makes a new recipe, it
// stores the reviewed swaps ON the recipe (`approveVariant`: `Recipe.variants[diet]` for an own or
// received recipe, the override patch for a classic) and the tab turns full.
//
// The rows come from `view.plan` (planVariant over the effective lines), in the order of the old
// sheet: first the swaps the app can make (a tick box, on; old line struck through, new line in bold,
// the cook's note under it), then the "controleer zelf" lines (no swap known, or a swap the app could
// not place in this line), each group in line order. A "controleer zelf" row has a tick box
// "Gecontroleerd" (off); Goedkeuren is only enabled once every one of them is ticked and there is an
// active profile (spec §5 point 4).
//
// What is stored (Fable's decision (1) after blok 1, 30 Oct): a swap that is UNTICKED means "this line
// I leave as it is, I sort it out myself", so its line index goes into `checked`, next to the ticked
// "controleer zelf" lines. `variantView` then sees the approval as `approved`, not `stale`; a diet
// with only unticked swaps still exists ({ swaps: [], checked: [i] }).
//
// Next to `checked` the sheet stores `checkedIngs` ("Besluiten Fable na blok 2", point 2): per index the
// `ing` of that line as the sheet showed it. `variantView` counts an index as ticked only while its line
// still holds that ing, so a ticked line that later turns into another product makes the tab stale.
//
// "Opnieuw controleren" (status stale) opens the same sheet over the plan of the current lines: every
// swap that still fits is on (spec §1c, "de checkboxes van swaps die nog passen staan aan"); the
// "controleer zelf" lines that were ticked before and still hold the same ing (`view.checked`) are
// ticked again (`initialSheetState`). A swap is never unticked from `checked`: Fable's decision (3)
// after blok 2 keeps §1c literal (an earlier "laat ik zo" is unticked again by hand), and an old
// approval without `checkedIngs` holds bare line indexes that, after a line is inserted or deleted
// above them, can point at a different line (review finding, 30 Oct).
//
// Dismissal (13J, spec §1c, as CookedSheet): Annuleer and Goedkeuren sit in the head; swiping the
// sheet down (grab bar / head), tapping beside it, Annuleer and Escape all close WITHOUT saving. The
// caller closes the sheet after `onApproved` and shows the "{diet} versie goedgekeurd" snack.
import { useEffect, useRef, useState } from 'preact/hooks';
import { SheetPortal } from '@/components/SheetPortal';
import { approveVariant, type VariantApproval } from '@/db/repo';
import { dictionary, lineText } from '@/dictionary';
import { pickText, type Line, type Recipe } from '@/domain/model';
import { applySwap, planVariant, storedSwapsFrom, type VariantPlan, type VariantSwap, type VariantView } from '@/domain/variants';
import { lang, t } from '@/i18n';
import { activeProfile } from '@/profile';
import { swapsData } from '@/swaps';

export interface VariantSheetProps {
  /** The recipe as the detail page shows it (a classic with its override folded in); only `id` is written to. */
  recipe: Recipe;
  /** The tab's view, status 'proposed' or 'stale' (`plan` filled). */
  view: VariantView;
  onClose: () => void;
  /** After `approveVariant` succeeded; the caller closes the sheet and shows `vt.approvedSnack`. */
  onApproved: () => void;
}

/** One row of the sheet: a swap the app can make (tickable) or a "controleer zelf" line. */
export interface SheetRow {
  kind: 'swap' | 'check';
  /** Line index (the same index space as `StoredSwap.index` and `RecipeVariant.checked`). */
  index: number;
  line: Line;
  /** The plan's swap: always on a 'swap' row; on a 'check' row when the app could not place it (`applies: false`). */
  swap?: VariantSwap;
}

/** The rows of the sheet: the applying swaps first, then the "controleer zelf" lines, each group in line order. */
export function sheetRows(plan: VariantPlan): SheetRow[] {
  const swapRows: SheetRow[] = [];
  const checkRows: SheetRow[] = [];
  for (const s of plan.swaps) {
    const line = plan.lines[s.index];
    if (!line) continue;
    if (s.applies) swapRows.push({ kind: 'swap', index: s.index, line, swap: s });
    else checkRows.push({ kind: 'check', index: s.index, line, swap: s });
  }
  for (const i of plan.unresolved) {
    const line = plan.lines[i];
    if (line && !checkRows.some((r) => r.index === i)) checkRows.push({ kind: 'check', index: i, line });
  }
  swapRows.sort((a, b) => a.index - b.index);
  checkRows.sort((a, b) => a.index - b.index);
  return [...swapRows, ...checkRows];
}

/**
 * The tick state the sheet opens with. A proposal: every swap on, no line checked. "Opnieuw
 * controleren" (stale): every swap that still fits is on (spec §1c); the indexes the earlier
 * approval had in `checked` that still break the diet and (with `checkedIngs`) still hold the same
 * ing (`view.checked`) come back as a ticked "controleer zelf" row. A swap row is never unticked from
 * `checked` (decision (3) after blok 2; an old bare index can name another line after an insert or
 * delete above it, and re-approving would drop an approved swap); a swap left as it was ("laat ik
 * zo", decision (1)) is unticked again by hand.
 */
export function initialSheetState(view: Pick<VariantView, 'status' | 'checked'>, rows: readonly SheetRow[]): { off: Set<number>; ticked: Set<number> } {
  const off = new Set<number>();
  const ticked = new Set<number>();
  if (view.status !== 'stale') return { off, ticked };
  const before = new Set(view.checked);
  for (const r of rows) {
    if (r.kind === 'check' && before.has(r.index)) ticked.add(r.index);
  }
  return { off, ticked };
}

/** True when every "controleer zelf" row is ticked (Goedkeuren may be enabled, spec §1c / §5 point 4). */
export function allChecked(rows: readonly SheetRow[], ticked: ReadonlySet<number>): boolean {
  return rows.every((r) => r.kind !== 'check' || ticked.has(r.index));
}

/** What the sheet hands `approveVariant`: the approval plus `checkedIngs` (stored as it is, `...a`). */
export type SheetApproval = VariantApproval & { checkedIngs: Array<string | null> };

/**
 * What `approveVariant` gets: the ticked swaps (`storedSwapsFrom`) and, as `checked`, the unticked
 * swaps (decision (1): "laat ik zo") plus the ticked "controleer zelf" lines, sorted, no duplicates;
 * `checkedIngs` parallel to it ("Besluiten Fable na blok 2", point 2): the `ing` of each of those
 * lines as the sheet showed it (null when it has none), so a line that later turns into another
 * product makes the tab stale (`variantView`).
 */
export function sheetApproval(plan: VariantPlan, rows: readonly SheetRow[], off: ReadonlySet<number>, ticked: ReadonlySet<number>): SheetApproval {
  const ingOf = new Map<number, string | null>();
  for (const r of rows) {
    if (r.kind === 'swap' ? off.has(r.index) : ticked.has(r.index)) ingOf.set(r.index, typeof r.line.ing === 'string' && r.line.ing !== '' ? r.line.ing : null);
  }
  const checked = [...ingOf.keys()].sort((a, b) => a - b);
  return { swaps: storedSwapsFrom(plan, off), checked, checkedIngs: checked.map((i) => ingOf.get(i) ?? null) };
}

export function VariantSheet(props: VariantSheetProps) {
  const l = lang.value;
  const dict = dictionary.value;
  const profile = activeProfile.value;
  const { view, onClose } = props;
  const title = t('vt.sheet.title.' + view.diet);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; id: number; dy: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  // Taken once, when the sheet opens: what is approved is what was reviewed, even when the caller
  // re-renders with a fresh view (e.g. the live recipe updating). `view.plan` is filled for
  // 'proposed' and 'stale'; the fallback only guards a caller that passes another view.
  const [sheet] = useState(() => {
    const plan: VariantPlan = view.plan ?? planVariant({ lines: [...view.lines] }, view.diet, swapsData, dict);
    const rows = sheetRows(plan);
    return { plan, rows, initial: initialSheetState(view, rows) };
  });
  const { plan, rows } = sheet;
  const [off, setOff] = useState<ReadonlySet<number>>(sheet.initial.off);
  const [ticked, setTicked] = useState<ReadonlySet<number>>(sheet.initial.ticked);
  const checksDone = allChecked(rows, ticked);
  const canApprove = !!profile && checksDone && !busy;

  /** Swipe down / tap beside the sheet / Escape: close without saving (only Goedkeuren saves). */
  function dismiss() {
    if (busy) return;
    onClose();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, busy]);

  // aria-modal moves no focus by itself: put it on Annuleer on open and hand it back on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtn.current?.focus({ preventScroll: true });
    return () => opener?.focus();
  }, []);

  // Swipe down on the grab bar / head: the sheet follows the finger; far enough = dismiss() (CookedSheet pattern).
  function onDragStart(e: PointerEvent) {
    if ((e.target as HTMLElement | null)?.closest('button')) return;
    drag.current = { y: e.clientY, id: e.pointerId, dy: 0 };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // The pointer is already gone (e.g. a very short tap): the drag simply works without capture.
    }
  }
  function onDragMove(e: PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    d.dy = Math.max(0, e.clientY - d.y);
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'none';
      sheetRef.current.style.transform = d.dy > 0 ? `translateY(${d.dy}px)` : '';
    }
  }
  function onDragEnd(e: PointerEvent, cancelled: boolean) {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (sheetRef.current) {
      sheetRef.current.style.transition = 'transform .18s ease-out';
      sheetRef.current.style.transform = '';
    }
    if (!cancelled && d.dy > 80) dismiss();
  }

  function toggleIn(set: ReadonlySet<number>, index: number): Set<number> {
    const next = new Set(set);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    return next;
  }

  async function onApprove() {
    if (!canApprove || !profile) return;
    setBusy(true);
    setError(false);
    try {
      await approveVariant(props.recipe.id, plan.diet, sheetApproval(plan, rows, off, ticked), profile.name);
      props.onApproved();
    } catch (e) {
      console.error('approveVariant', e);
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

  // Why Goedkeuren is grey (spec §1c): no profile first, then the unticked "controleer zelf" lines.
  const reason = !profile ? t('variant.noProfile') : !checksDone ? t('vt.sheet.needChecks') : '';

  return (
    <SheetPortal>
      <div class="sheet-backdrop no-print" onClick={dismiss}>
        <div ref={sheetRef} class="sheet variant-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
          <div
            class="cooked-drag"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={(e) => onDragEnd(e, false)}
            onPointerCancel={(e) => onDragEnd(e, true)}
          >
            <div class="sheet-grab" aria-hidden="true" />
            <div class="sheet-head with-actions">
              <button ref={closeBtn} type="button" class="sheet-head-btn" onClick={dismiss}>
                {t('common.cancel')}
              </button>
              <h2>{title}</h2>
              <button type="button" class="sheet-head-btn save" disabled={!canApprove} onClick={() => void onApprove()}>
                {t('vt.sheet.approve')}
              </button>
            </div>
          </div>
          <div class="sheet-body">
            <p class="muted small variant-intro">{t('vt.sheet.intro')}</p>
            <ul class="variant-list">
              {rows.map((row) => {
                const swap = row.swap;
                if (row.kind === 'swap' && swap) {
                  const on = !off.has(row.index);
                  return (
                    <li key={'s' + row.index}>
                      <label class={'variant-row' + (on ? '' : ' off')}>
                        <input type="checkbox" checked={on} disabled={busy} onChange={() => setOff((prev) => toggleIn(prev, row.index))} />
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
                // parentheses). Both hints say the same since blok 3 (Fable's decision (7) after blok 2);
                // a swap's cook's note is still shown.
                const done = ticked.has(row.index);
                return (
                  <li key={'c' + row.index}>
                    <div class="variant-row variant-check-row">
                      <span class="variant-mark" aria-hidden="true">
                        !
                      </span>
                      <span class="variant-body">
                        <span>{oldText(row.line)}</span>
                        <span class="variant-check">{t('variant.check')}</span>
                        <p class="variant-note">
                          {swap ? t('variant.checkSwap', { from: dict.ingredientName(swap.fromId, l), to: dict.ingredientName(swap.toId, l) }) : t('variant.checkHint')}
                        </p>
                        {swap?.note && pickText(swap.note, l) && <p class="variant-note">{pickText(swap.note, l)}</p>}
                        <label class="check variant-checked">
                          <input type="checkbox" checked={done} disabled={busy} onChange={() => setTicked((prev) => toggleIn(prev, row.index))} />
                          <span>
                            {t('vt.sheet.checked')}
                            <span class="visually-hidden"> — {oldText(row.line)}</span>
                          </span>
                        </label>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <div class="variant-foot">
            <p class="muted small variant-foot-hint">{t('vt.sheet.foot')}</p>
            {reason && (
              <p class="small variant-foot-hint variant-reason" role="status">
                {reason}
              </p>
            )}
            {error && (
              <p class="variant-error" role="alert">
                {t('variant.saveFailed')}
              </p>
            )}
          </div>
        </div>
      </div>
    </SheetPortal>
  );
}
