// One list row for a recipe (A-Z list, Home): name in the active language (fallback the other),
// the other language's name as a muted second line when it exists and differs, small badges —
// ★ favourite, "eigen", "van <naam>" — and a chevron. Tapping opens the detail.
// Phase 5 (docs/phase-5-spec.md A-bis.8): select mode. With `selectable` the row shows a
// checkbox and a tap toggles `selected` instead of opening; `onLongPress` (500 ms, cancelled by
// movement or lift) lets a list enter select mode with this row preselected. The long-press is
// pointer-based so it works for mouse and touch; the click that Chrome fires after it is
// swallowed, and the link's context menu is suppressed so Android shows no "Open in new tab".
import { useRef } from 'preact/hooks';
import { hasLang, pickText, type Lang, type Recipe } from '@/domain/model';
import { lang, t } from '@/i18n';
import { navigate } from '@/router';

export interface RecipeRowProps {
  recipe: Recipe;
  favorite?: boolean;
  /** Optional second line under the name (e.g. a date). */
  subtitle?: string;
  /** Select mode: a checkbox at the left, tap toggles instead of opening. */
  selectable?: boolean;
  selected?: boolean;
  onToggle?: (recipe: Recipe) => void;
  /** Long-press (500 ms) on the row; the following click is swallowed. */
  onLongPress?: (recipe: Recipe) => void;
}

/** Milliseconds a finger must rest on the row before it counts as a long-press. */
export const LONG_PRESS_MS = 500;
/** Movement (px) that cancels the long-press: the person is scrolling. */
const LONG_PRESS_SLOP = 10;

/** The name in the other language, when it exists and differs from the shown name. */
export function otherLanguageName(r: Recipe, l: Lang): string | null {
  const other: Lang = l === 'nl' ? 'en' : 'nl';
  if (!hasLang(r.name, l) || !hasLang(r.name, other)) return null;
  const shown = pickText(r.name, l);
  const alt = (r.name[other] ?? '').trim();
  return alt && alt.toLowerCase() !== shown.toLowerCase() ? alt : null;
}

export function RecipeRow(props: RecipeRowProps) {
  const r = props.recipe;
  const l = lang.value;
  const name = pickText(r.name, l);
  const altName = otherLanguageName(r, l);
  const kind = r.origin.kind;
  const selectable = props.selectable === true;
  const selected = props.selected === true;

  // Long-press bookkeeping (refs: no re-render while the finger rests).
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  function cancelPress() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    start.current = null;
  }

  function onPointerDown(e: PointerEvent) {
    if (!props.onLongPress || selectable) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelPress();
    fired.current = false;
    start.current = { x: e.clientX, y: e.clientY };
    timer.current = window.setTimeout(() => {
      timer.current = null;
      start.current = null;
      fired.current = true;
      try {
        navigator.vibrate?.(15);
      } catch {
        /* no haptics */
      }
      props.onLongPress?.(r);
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e: PointerEvent) {
    const s = start.current;
    if (!s) return;
    if (Math.abs(e.clientX - s.x) > LONG_PRESS_SLOP || Math.abs(e.clientY - s.y) > LONG_PRESS_SLOP) cancelPress();
  }

  function onClick(e: MouseEvent) {
    e.preventDefault();
    if (fired.current) {
      // The click Chrome fires after a long-press: not a tap.
      fired.current = false;
      return;
    }
    if (selectable) {
      props.onToggle?.(r);
      return;
    }
    navigate('/recipe/' + r.id);
  }

  return (
    <a
      class={'row' + (selectable ? ' row-selectable' : '') + (selected ? ' row-selected' : '')}
      href={'#/recipe/' + r.id}
      role={selectable ? 'checkbox' : undefined}
      aria-checked={selectable ? selected : undefined}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={cancelPress}
      onPointerCancel={cancelPress}
      onPointerLeave={cancelPress}
      onContextMenu={props.onLongPress || selectable ? (e) => e.preventDefault() : undefined}
    >
      {selectable && (
        <span class={'row-check' + (selected ? ' on' : '')} aria-hidden="true">
          {selected && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12l5 5L19 7" />
            </svg>
          )}
        </span>
      )}
      <span class="name">
        {name}
        {altName && (
          <span class="row-sub row-alt" lang={l === 'nl' ? 'en' : 'nl'}>
            {altName}
          </span>
        )}
        {props.subtitle && <span class="row-sub">{props.subtitle}</span>}
      </span>
      <span class="row-badges">
        {props.favorite && (
          <span class="star on" aria-label={t('list.favorite')}>
            ★
          </span>
        )}
        {kind === 'user' && <span class="badge">{t('list.own')}</span>}
        {kind === 'received' && (
          <span class="badge badge-green">{r.origin.receivedFrom ? t('list.from', { name: r.origin.receivedFrom }) : t('list.received')}</span>
        )}
      </span>
      {!selectable && (
        <span class="chev" aria-hidden="true">
          ›
        </span>
      )}
    </a>
  );
}

/** "12 mrt" / "12 Mar"; the year is added when it is not the current one. Empty for bad input. */
export function formatShortDate(iso: string | undefined | null, l: Lang = lang.value): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  try {
    return d.toLocaleDateString(l === 'nl' ? 'nl-NL' : 'en-GB', opts);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
