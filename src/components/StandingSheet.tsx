// The edit sheet of one standing-list line ("Vaste lijst" / "Every week", docs/specs/vaste-lijst.md
// §1c and §3, 6C blok 2). Opened from the Vaste lijst tab (StandingTab) by tapping a line.
//
// 13J pattern: rendered through <SheetPortal> with the buttons in the head (`.sheet-head.with-actions`),
// so nothing falls off the bottom edge on the iPhone. There is NO Annuleer and NO Bewaar (spec §5
// point 14): every tap in this sheet (stepper, unit pill, Even niet meenemen) saves at once through
// `onPatch`, so there is nothing to save or roll back. Sluit (in the head), Escape and tapping beside
// the sheet only close it. Focus goes to Sluit on open and back to the opener on close (VariantSheet).
//
// Stepper: the step is `standingStep(unit)` (decision A: l 1 · kg 0.5 · g 50 · ml 100 · anything else
// 1), not `adjustStep`. Going below one step makes the amount null ("zonder aantal"); + from null
// gives one step. Unit: a Segmented over the ten STANDING_UNITS; Segmented only takes strings, so
// "stuks" (null) is the value '-'. A unit outside STANDING_UNITS (decision C: 'el', 'dl', 'bos')
// leaves no pill selected; tapping a pill replaces it. Tapping the pill that is already on gives []
// from Segmented: nothing happens (there is always exactly one unit).
import { useEffect, useRef } from 'preact/hooks';
import { SheetPortal } from '@/components/SheetPortal';
import { Segmented, type SegOption } from '@/components/Segmented';
import type { StandingPatch } from '@/db/repo';
import { itemName } from '@/domain/aggregate';
import type { Dictionary } from '@/domain/dictionary';
import type { Lang } from '@/domain/model';
import { formatQty, unitName } from '@/domain/render';
import { STANDING_UNITS, standingStep, standingToListItem, type StandingItem } from '@/domain/standing';
import { t } from '@/i18n';

export interface StandingSheetProps {
  /** The line being edited; null renders nothing. */
  item: StandingItem | null;
  dict: Dictionary;
  lang: Lang;
  /** Saves at once (updateStandingItem); the live list re-renders the sheet with the new item. */
  onPatch: (id: string, patch: StandingPatch) => void;
  /** "Verwijder van de vaste lijst": the caller removes it and shows the snack with Ongedaan. */
  onRemove: (item: StandingItem) => void;
  onClose: () => void;
}

/** Segmented value of "stuks" (null unit): Segmented only takes strings. */
const NO_UNIT = '-';

/** Round away float noise (0.5 + 0.5 steps, 0.1-style values from a typed amount). */
function tidy(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** + on the stepper: one step from null, otherwise one step more. */
export function standingStepUp(qty: number | null, unit: string | null): number {
  const step = standingStep(unit);
  return qty === null ? step : tidy(qty + step);
}

/** − on the stepper: one step less; below one step the amount becomes null ("zonder aantal"). */
export function standingStepDown(qty: number | null, unit: string | null): number | null {
  if (qty === null) return null;
  const step = standingStep(unit);
  const next = tidy(qty - step);
  return next < step - 1e-9 ? null : next;
}

/** The pill that is on: '-' for null, the unit id when it is a STANDING_UNITS id, none otherwise (decision C). */
export function selectedUnitPill(unit: string | null): string[] {
  if (unit === null) return [NO_UNIT];
  return STANDING_UNITS.includes(unit) ? [unit] : [];
}

/** "1 l", "2 potten", "3", or "3 el" for a unit the dictionary does not know (shown as its id). */
function amountLabel(qty: number, unit: string | null, dict: Dictionary, lang: Lang): string {
  if (unit === null) return formatQty(qty, undefined, lang);
  const u = dict.unit(unit);
  if (!u) return `${formatQty(qty, undefined, lang)} ${unit}`;
  return `${formatQty(qty, undefined, lang, false, u)} ${unitName(u, lang, { min: qty })}`;
}

export function StandingSheet(props: StandingSheetProps) {
  if (!props.item) return null;
  return <StandingSheetOpen {...props} item={props.item} />;
}

function StandingSheetOpen(props: StandingSheetProps & { item: StandingItem }) {
  const { item, dict, lang, onPatch, onRemove, onClose } = props;
  const closeBtn = useRef<HTMLButtonElement>(null);
  const name = itemName(standingToListItem(item), dict, lang);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // aria-modal moves no focus by itself: put it on Sluit on open and hand it back on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtn.current?.focus({ preventScroll: true });
    return () => opener?.focus();
  }, []);

  const unitOptions: SegOption<string>[] = STANDING_UNITS.map((id) => ({
    value: id ?? NO_UNIT,
    label: id === null ? t('shop.standing.edit.unitNone') : (dict.unit(id)?.[lang].one ?? id),
  }));

  function onUnit(next: string[]) {
    const v = next[0];
    if (v === undefined) return; // the pill that was already on
    const unit = v === NO_UNIT ? null : v;
    if (unit !== item.unit) onPatch(item.id, { unit });
  }

  function remove() {
    onRemove(item);
    onClose();
  }

  return (
    <SheetPortal>
      <div class="sheet-backdrop no-print" onClick={onClose}>
        <div class="sheet standing-sheet" role="dialog" aria-modal="true" aria-label={name} onClick={(e) => e.stopPropagation()}>
          <div class="sheet-head with-actions">
            <span class="sheet-head-btn" aria-hidden="true" />
            <h2>{name}</h2>
            <button ref={closeBtn} type="button" class="sheet-head-btn save" onClick={onClose}>
              {t('common.close')}
            </button>
          </div>
          <div class="sheet-body">
            <div class="field standing-amount">
              <span>{t('shop.standing.edit.amount')}</span>
              <div class="stepper">
                <button
                  type="button"
                  class="btn btn-icon"
                  aria-label={t('shop.less')}
                  disabled={item.qty === null}
                  onClick={() => onPatch(item.id, { qty: standingStepDown(item.qty, item.unit) })}
                >
                  −
                </button>
                <output class="standing-amount-value" aria-live="polite">
                  {item.qty === null ? t('shop.standing.edit.noAmount') : amountLabel(item.qty, item.unit, dict, lang)}
                </output>
                <button type="button" class="btn btn-icon" aria-label={t('shop.more')} onClick={() => onPatch(item.id, { qty: standingStepUp(item.qty, item.unit) })}>
                  +
                </button>
              </div>
            </div>

            <div class="field standing-unit">
              <span>{t('shop.standing.edit.unit')}</span>
              <Segmented name={'standing-unit-' + item.id} options={unitOptions} selected={selectedUnitPill(item.unit)} onChange={onUnit} />
            </div>

            <div class="field standing-pause">
              <button type="button" class="btn btn-block" onClick={() => onPatch(item.id, { enabled: !item.enabled })}>
                {item.enabled ? t('shop.standing.edit.pause') : t('shop.standing.edit.resume')}
              </button>
              <p class="muted small standing-pause-hint">{t('shop.standing.edit.pauseHint')}</p>
            </div>

            <button type="button" class="btn btn-block btn-danger standing-remove" onClick={remove}>
              {t('shop.standing.edit.remove')}
            </button>
          </div>
        </div>
      </div>
    </SheetPortal>
  );
}
