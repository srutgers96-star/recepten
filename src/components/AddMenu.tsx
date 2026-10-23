// The menu behind the "+" (docs/specs/home-a-plus.md §1b): one component, used in the header of
// Home and of Recipes. Four rows, in this order on both screens, each with its one-line hint:
// Plak een recept ('/add?mode=paste': the paste box open, invariant 5 — the textarea stays there),
// Zelf schrijven ('/add'), Met AI ('/add?mode=ai': the prompt section open) and Kies een bestand
// (A-bis.9: a recipe/bundle/backup file goes to the Inbox, text to the Add screen's paste box via
// src/paste.ts `openPastedText`; a failure shows `edit.fileEmpty` / `edit.fileFailed` under the rows).
// A bottom sheet through SheetPortal (13J: inside `.screen` the iPhone cut off its bottom), with a
// plain `.sheet-head` (title + ×): the menu stores nothing, so there is no Annuleer/Bewaar head.
// Swiping it down (grab bar / head), tapping beside it, × and Escape close it without doing anything.
// The swipe is the same pointer code as CookedSheet (the shared grab-bar classes `.cooked-drag` and
// `.sheet-grab` live in browse.css). Every open starts fresh: the sheet mounts on open, so a status
// line from an earlier attempt is gone and the × gets the focus.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { SheetPortal } from '@/components/SheetPortal';
import { t } from '@/i18n';
import { openPastedText, PASTE_FILE_ACCEPT } from '@/paste';
import { navigate } from '@/router';

/** How far (px) the sheet must be pulled down before letting go closes it (as CookedSheet). */
const DISMISS_PX = 80;

export function AddMenu(props: { open: boolean; onClose: () => void }): JSX.Element | null {
  if (!props.open) return null;
  return <AddMenuSheet onClose={props.onClose} />;
}

function AddMenuSheet(props: { onClose: () => void }) {
  const { onClose } = props;
  const [status, setStatus] = useState('');
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

  // aria-modal moves no focus by itself: put it on the × on open and hand it back on close (only
  // while the "+" is still there; a row that navigated away unmounted it).
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtn.current?.focus({ preventScroll: true });
    return () => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  function go(path: string) {
    onClose();
    navigate(path);
  }

  /**
   * "Kies een bestand": routed like a paste (src/paste.ts) — recipes, links and cards to the Inbox,
   * a website recipe or AI answer to the Add screen (filled in on arrival), other text to its paste box.
   */
  function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    setStatus('');
    file.text().then(
      (text) => {
        if (!openPastedText(text)) {
          setStatus(t('edit.fileEmpty'));
          return;
        }
        onClose();
      },
      () => setStatus(t('edit.fileFailed')),
    );
  }

  // Swipe down on the grab bar / head: the sheet follows the finger; far enough = close.
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
    if (!cancelled && d.dy > DISMISS_PX) onClose();
  }

  const title = t('list.add');
  return (
    <SheetPortal>
      <div class="sheet-backdrop" onClick={onClose}>
        <div ref={sheetRef} class="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
          <div
            class="cooked-drag"
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={(e) => onDragEnd(e, false)}
            onPointerCancel={(e) => onDragEnd(e, true)}
          >
            <div class="sheet-grab" aria-hidden="true" />
            <div class="sheet-head">
              <h2>{title}</h2>
              <button ref={closeBtn} type="button" class="icon-btn" aria-label={t('common.close')} onClick={onClose}>
                ×
              </button>
            </div>
          </div>
          <div class="sheet-body add-menu">
            {/* §1b: Plak first, then Zelf, AI, Bestand — the same four on Home and Recipes. */}
            <button type="button" class="add-menu-row" onClick={() => go('/add?mode=paste')}>
              <strong>{t('list.addPaste')}</strong>
              <span class="muted small">{t('list.addPasteHint')}</span>
            </button>
            <button type="button" class="add-menu-row" onClick={() => go('/add')}>
              <strong>{t('list.addWrite')}</strong>
              <span class="muted small">{t('list.addWriteHint')}</span>
            </button>
            <button type="button" class="add-menu-row" onClick={() => go('/add?mode=ai')}>
              <strong>{t('list.addAi')}</strong>
              <span class="muted small">{t('list.addAiHint')}</span>
            </button>
            <label class="add-menu-row">
              <strong>{t('list.addFileChoice')}</strong>
              <span class="muted small">{t('list.addFileChoiceHint')}</span>
              <input type="file" accept={PASTE_FILE_ACCEPT} style="display:none" onChange={onFile} />
            </label>
            {status && (
              <p class="muted small" role="status">
                {status}
              </p>
            )}
          </div>
        </div>
      </div>
    </SheetPortal>
  );
}
