// The level-up sheet (docs/specs/xp-levels.md §1d, block 6D-1), mounted once in the shell next to
// <XpPop/>. settleXp (src/xp.ts) sets `levelUp` when a reward moment raises the level; the sheet
// opens AFTER the last pop (it waits until the pop queue is empty and <XpPop/> has nothing scheduled
// or on screen). Several levels at once (first cook: 1 → 3) = one sheet for the highest level.
// Through SheetPortal with the existing .sheet classes; the head `.sheet-head.with-actions` has only
// Sluit on the right (13J), and Sluit appears only there (no second one at the bottom; Fable,
// 28 Oct). Content: "🎉 Level {level}!" (head), the title from data/levels.json big, the note
// muted when there is one. The "Ontgrendeld" list and "Bekijk Vrijgespeeld" come in 6D-3
// (`LevelUpInfo.unlocked` is empty in 6D-1). Swiping it down, tapping beside it, Escape and Sluit
// close it (clearLevelUp); there is nothing to keep. Never for a quiet recompute (settleXp sets
// no levelUp then); badges off → nothing.
import type { JSX } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { badgesEnabled } from '@/badges';
import { noteFor, titleFor } from '@/domain/levels';
import { lang, t } from '@/i18n';
import { clearLevelUp, levelUp, xpPops, type LevelUpInfo } from '@/xp';
import { SheetPortal } from './SheetPortal';
import { xpPopsActive } from './XpPop';

/** How far (px) the sheet must be pulled down before letting go closes it (as CookedSheet/SideSheet). */
const DISMISS_PX = 80;

export function LevelUpSheet(): JSX.Element | null {
  const info = levelUp.value;
  const popsIdle = xpPops.value.length === 0 && !xpPopsActive.value;
  const [open, setOpen] = useState<LevelUpInfo | null>(null);

  useEffect(() => {
    if (!info) {
      setOpen(null);
      return;
    }
    if (!popsIdle) return;
    // One macrotask: pops queued in the same reward moment as `levelUp` are seen first.
    const handle = setTimeout(() => {
      if (xpPops.value.length === 0 && !xpPopsActive.value) setOpen(levelUp.value);
    }, 0);
    return () => clearTimeout(handle);
  }, [info, popsIdle]);

  if (!open || !badgesEnabled.value) return null;
  return (
    <LevelUpBody
      info={open}
      onClose={() => {
        setOpen(null);
        clearLevelUp();
      }}
    />
  );
}

function LevelUpBody(props: { info: LevelUpInfo; onClose: () => void }) {
  const { info, onClose } = props;
  const l = lang.value;
  const heading = t('levelup.title', { level: info.to });
  const title = titleFor(info.to, l);
  const note = noteFor(info.to, l);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; id: number; dy: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // aria-modal moves no focus by itself: put it on Sluit on open, hand it back on close.
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtn.current?.focus({ preventScroll: true });
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  // Swipe down on the grab bar / head: the sheet follows the finger; far enough = close.
  function onDragStart(e: PointerEvent) {
    if ((e.target as HTMLElement | null)?.closest('button')) return;
    drag.current = { y: e.clientY, id: e.pointerId, dy: 0 };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    } catch {
      // The pointer is already gone (a very short tap): the drag works without capture.
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
    if (!cancelled && d.dy > DISMISS_PX) onClose();
  }

  return (
    <SheetPortal>
      <div class="sheet-backdrop" onClick={onClose}>
        <div ref={sheetRef} class="sheet levelup-sheet" role="dialog" aria-modal="true" aria-label={heading} onClick={(e) => e.stopPropagation()}>
          <div
            class="cooked-drag"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={(e) => onDragEnd(e, false)}
            onPointerCancel={(e) => onDragEnd(e, true)}
          >
            <div class="sheet-grab" aria-hidden="true" />
            <div class="sheet-head with-actions">
              <h2>{heading}</h2>
              <button ref={closeBtn} type="button" class="sheet-head-btn" onClick={onClose}>
                {t('common.close')}
              </button>
            </div>
          </div>
          <div class="sheet-body levelup-body">
            <p class="levelup-name">{title}</p>
            {note && <p class="levelup-note muted">{note}</p>}
          </div>
        </div>
      </div>
    </SheetPortal>
  );
}
