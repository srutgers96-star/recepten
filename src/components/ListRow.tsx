// One line of the shopping list (docs/phase-4-spec.md §3, state 3): tap = tick (strike-through,
// the row stays where it is), hold ≈ 500 ms = the long-press menu (Heb ik al / Aantal aanpassen /
// Waarvoor is dit? / Verwijder / Elke week). The caller renders the text (`renderListItem`) so
// the row knows nothing about the dictionary. Pointer events only: a finger that moves more than
// 10 px scrolls, and the click after a completed hold is swallowed.
import { useRef, useState } from 'preact/hooks';
import type { ListItem } from '@/domain/aggregate';
import { t } from '@/i18n';

const HOLD_MS = 500;
const MOVE_PX = 10;

export interface ListRowProps {
  item: ListItem;
  /** The rendered line ("4 uien (1 grote)"). */
  text: string;
  onToggle: (item: ListItem) => void;
  onHold: (item: ListItem) => void;
}

export function ListRow(props: ListRowProps) {
  const { item } = props;
  const [pressing, setPressing] = useState(false);
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const held = useRef(false);

  function clear() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
    setPressing(false);
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== undefined && e.button !== 0) return;
    held.current = false;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    setPressing(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      if (!start.current) return;
      held.current = true;
      clear();
      if (typeof navigator.vibrate === 'function') navigator.vibrate(12);
      props.onHold(item);
    }, HOLD_MS);
  }

  function onPointerMove(e: PointerEvent) {
    const s = start.current;
    if (!s || e.pointerId !== s.id) return;
    if (Math.abs(e.clientX - s.x) > MOVE_PX || Math.abs(e.clientY - s.y) > MOVE_PX) clear();
  }

  function onClick(e: MouseEvent) {
    if (held.current) {
      // The click that follows a completed hold must not also tick the row.
      held.current = false;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    props.onToggle(item);
  }

  const checked = item.checked === true;
  return (
    <li class={'lr' + (checked ? ' checked' : '') + (item.fresh ? ' fresh' : '')}>
      <button
        type="button"
        class={'lr-main' + (pressing ? ' pressing' : '')}
        role="checkbox"
        aria-checked={checked}
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={clear}
        onPointerCancel={clear}
        onPointerLeave={clear}
        onContextMenu={(e) => e.preventDefault()}
      >
        <span class="lr-box" aria-hidden="true">
          {checked ? '✓' : ''}
        </span>
        <span class="lr-text">{props.text}</span>
        {item.fresh && !checked && <span class="badge badge-green">{t('shop.new')}</span>}
        {item.pinned && (
          <span class="lr-pin" title={t('shop.pinned')} aria-label={t('shop.pinned')}>
            📌
          </span>
        )}
      </button>
    </li>
  );
}
