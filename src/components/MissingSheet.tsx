// "Ontbrekende gegevens aanvullen met AI" review sheet (docs/specs/labels-categorieen.md §1f, 6B
// blok 5). The Woordenboek card reads the AI's answer (`parseMissingAnswer` + `planMissingAnswer`,
// src/domain/dictionary-prompt.ts) and hands this sheet one row per answer line:
// - an own entry that gets details filled in: "{name}: {fields} aanvullen" (tickable);
// - a new entry for an unrecognised line: "Nieuw: {nl} / {en} · {aisle} · in {n} recept(en)
//   gekoppeld" (tickable);
// - an answer line that could not be read: "M{n}: niet te lezen, overgeslagen" (no tick box).
// Every tick box starts on. Nothing readable at all: "Ik herken het antwoord niet …" and Bewaar
// stays off. Through SheetPortal (13J) with the head `.sheet-head.with-actions`: Annuleer left,
// "Zet in woordenboek" right (a sheet that saves has both at the top). Annuleer, swiping the sheet
// down (grab bar / head), tapping beside it and Escape close it without saving anything. The sheet
// only collects the ticks; the Woordenboek screen writes them (saveUserIngredient,
// linkUserRecipeLine) and shows the result.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { SheetPortal } from '@/components/SheetPortal';
import { t } from '@/i18n';

/** The fields of dict.missingRowUpdate, in the order §1f lists them (also the order they are shown in). */
const FIELD_ORDER = ['en', 'nl', 'aisle', 'vegan', 'gluten', 'lactose'] as const;
/** How far (px) the sheet must be pulled down before letting go closes it (as SideSheet/CookedSheet). */
const DISMISS_PX = 80;

/** One row of the proposal, already resolved to display values by the caller. */
export type MissingSheetRow =
  /** An own entry that gets the listed fields filled in. `name` is its name in the UI language. */
  | { kind: 'update'; key: string; name: string; fields: readonly string[] }
  /** A new entry; `aisle` is the aisle's name in the UI language, `recipes` the recipes it gets linked in. */
  | { kind: 'new'; key: string; nl: string; en: string; aisle: string; recipes: number }
  /** An answer line (M{n}) that could not be read. */
  | { kind: 'skipped'; key: string; n: number };

export interface MissingSheetProps {
  /** null = closed. */
  rows: readonly MissingSheetRow[] | null;
  /** While the caller writes: the head buttons and tick boxes are off. */
  busy: boolean;
  onCancel: () => void;
  /** "Zet in woordenboek": the keys of the ticked update/new rows. */
  onSave: (keys: ReadonlySet<string>) => void;
}

export function MissingSheet(props: MissingSheetProps): JSX.Element | null {
  if (!props.rows) return null;
  return <MissingSheetBody {...props} rows={props.rows} />;
}

/** "Engels, schap, vegan" in the UI language, in the fixed order of §1f; unknown names are left out. */
export function missingFieldsText(fields: readonly string[]): string {
  const set = new Set(fields);
  return FIELD_ORDER.filter((f) => set.has(f))
    .map((f) => t('dict.missingField.' + f))
    .join(', ');
}

function MissingSheetBody(props: MissingSheetProps & { rows: readonly MissingSheetRow[] }) {
  const { rows, busy, onCancel, onSave } = props;
  const cancelBtn = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; id: number; dy: number } | null>(null);
  // Unticked keys (every tick box starts on); the sheet mounts per review, so this starts empty.
  const [off, setOff] = useState<ReadonlySet<string>>(() => new Set());

  const tickable = rows.filter((r) => r.kind !== 'skipped');
  const chosen = new Set(tickable.filter((r) => !off.has(r.key)).map((r) => r.key));
  const title = t('dict.missingReview');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, busy]);

  // aria-modal moves no focus by itself: put it on Annuleer on open and hand it back on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelBtn.current?.focus({ preventScroll: true });
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  function toggle(key: string) {
    setOff((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Swipe down on the grab bar / head: the sheet follows the finger; far enough = close, nothing saved.
  function onDragStart(e: PointerEvent) {
    if ((e.target as HTMLElement | null)?.closest('button')) return;
    drag.current = { y: e.clientY, id: e.pointerId, dy: 0 };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // The pointer is already gone (a very short tap): the drag simply works without capture.
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
    if (!cancelled && d.dy > DISMISS_PX && !busy) onCancel();
  }

  function rowText(r: MissingSheetRow): string {
    if (r.kind === 'update') return t('dict.missingRowUpdate', { name: r.name, fields: missingFieldsText(r.fields) });
    if (r.kind === 'new') return t('dict.missingRowNew', { nl: r.nl, en: r.en, aisle: r.aisle, n: r.recipes });
    return t('dict.missingRowSkipped', { n: r.n });
  }

  return (
    <SheetPortal>
      <div class="sheet-backdrop no-print" onClick={() => !busy && onCancel()}>
        <div ref={sheetRef} class="sheet missing-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
          <div
            class="cooked-drag"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={(e) => onDragEnd(e, false)}
            onPointerCancel={(e) => onDragEnd(e, true)}
          >
            <div class="sheet-grab" aria-hidden="true" />
            <div class="sheet-head with-actions">
              <button ref={cancelBtn} type="button" class="sheet-head-btn" disabled={busy} onClick={onCancel}>
                {t('common.cancel')}
              </button>
              <h2>{title}</h2>
              <button type="button" class="sheet-head-btn save" disabled={busy || chosen.size === 0} onClick={() => onSave(chosen)}>
                {t('dict.missingSave')}
              </button>
            </div>
          </div>
          <div class="sheet-body">
            {tickable.length === 0 && (
              <p class="missing-fail" role="alert">
                {t('dict.missingParseFail')}
              </p>
            )}
            {rows.length > 0 && (
              <ul class="missing-list">
                {rows.map((r) =>
                  r.kind === 'skipped' ? (
                    <li key={r.key} class="missing-row skipped muted">
                      <span class="missing-mark" aria-hidden="true">
                        –
                      </span>
                      <span class="missing-text">{rowText(r)}</span>
                    </li>
                  ) : (
                    <li key={r.key}>
                      <label class={'missing-row' + (off.has(r.key) ? ' off' : '')}>
                        <input type="checkbox" checked={!off.has(r.key)} disabled={busy} onChange={() => toggle(r.key)} />
                        <span class="missing-text">{rowText(r)}</span>
                      </label>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </SheetPortal>
  );
}
