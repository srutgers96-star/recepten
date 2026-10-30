// One ingredient line rendered through the dictionary (docs/phase-2-spec.md §5), in the active
// language and scaled to the chosen servings: "250 g haddock fillet (or cod), 2-3 cm pieces".
// The amount is set in bold, the original amount is shown muted when scaled ("(4 pers.: 500 g)"),
// Dutch-only products get their English gloss. Unresolved lines show their raw text with a small
// "?" chip; tapping it (or long-pressing a resolved line) opens the IngredientPicker and stores the
// choice: as a line override (`setLineOverride`) for a classic, in the line itself
// (`linkUserRecipeLine`) for an own or received recipe (docs/phase-2-spec.md §5).
//
// `IngredientList` is the list the detail page and the cook mode ("Klaarzetten") render: it owns
// the picker state and, in cook mode, the tick boxes.
//
// 13D (docs/specs/varianten-tabs.md §1b, §1f): on a diet tab a line can carry a marking (`LineMark`):
// a swapped line gets `.ing-item.swapped.diet-<diet>` (a bar in the diet colour), a "controleer zelf"
// line `.ing-item.check-self` with an orange dot before the text (labelled "controleer zelf") and, when
// it was ticked on approval, a small "✓" after it. Swapped lines are derived (`lockedIndexes`): no "?"
// chip and no long press on them; the other lines stay linkable.
import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { IngredientPicker } from '@/components/IngredientPicker';
import { isBuiltinId, linkUserRecipeLine, setLineOverride } from '@/db/repo';
import { dictionary, lineParts } from '@/dictionary';
import { wordLinkOverride, type WordLink } from '@/domain/line-words';
import { pickText, type Lang, type Line } from '@/domain/model';
import type { VariantDiet } from '@/domain/variants';
import { recordFeature } from '@/features';
import { lang, t } from '@/i18n';

/** Below this parser confidence a resolved line still gets a (soft) "?" chip. */
export const LOW_CONFIDENCE = 0.6;

const LONG_PRESS_MS = 550;
const LONG_PRESS_MOVE_PX = 10;

/** Pointer handlers that fire `onLong` after a still press and swallow the click that follows. */
function useLongPress(onLong: () => void, enabled: boolean) {
  const timer = useRef<number | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const cancel = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    start.current = null;
  };
  return {
    onPointerDown(e: PointerEvent) {
      if (!enabled) return;
      cancel();
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = window.setTimeout(() => {
        timer.current = null;
        start.current = null;
        fired.current = true;
        onLong();
      }, LONG_PRESS_MS);
    },
    onPointerMove(e: PointerEvent) {
      const s = start.current;
      if (!s) return;
      if (Math.abs(e.clientX - s.x) > LONG_PRESS_MOVE_PX || Math.abs(e.clientY - s.y) > LONG_PRESS_MOVE_PX) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    onClickCapture(e: MouseEvent) {
      // The tap that ends a long press must not also toggle the tick box.
      if (fired.current) {
        fired.current = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
    onContextMenu(e: Event) {
      if (enabled) e.preventDefault();
    },
  };
}

/** The rendered text of a line: bold amount, name, gloss, muted original amount when scaled. */
export function LineText(props: { line: Line; lang: Lang; factor: number; base: number }) {
  const { line, factor, base } = props;
  const l = props.lang;
  const p = lineParts(line, l, factor);
  const scaled = factor !== 1 && !!line.qty;
  let orig = '';
  if (scaled) {
    const o = lineParts(line, l, 1);
    orig = [o.qty, o.unit].filter(Boolean).join(' ');
  }
  let head = '';
  let rest = p.text;
  if (p.resolved) {
    const prefix = [p.part, p.qty, p.unit].filter(Boolean).join(' ');
    if (prefix && p.text.toLowerCase().startsWith(prefix.toLowerCase())) {
      head = p.text.slice(0, prefix.length);
      rest = p.text.slice(prefix.length);
    }
  }
  // A-bis.1: a note or prep shown in the OTHER language (no translation yet) is greyed. The text
  // is split around the exact substrings `renderLineParts` composed (", prep" and "(note)").
  const foreign: string[] = [];
  if (p.resolved && p.prepForeign && p.prep) foreign.push(p.prep);
  if (p.resolved && p.noteForeign && p.note) foreign.push(`(${p.note})`);
  const body = foreign.length ? splitForeign(rest, foreign) : rest;
  return (
    <span class={'ing-text' + (p.resolved ? '' : ' raw')}>
      {head && <b class="ing-amt">{head}</b>}
      {body}
      {p.gloss && <span class="ing-gloss muted"> — {p.gloss}</span>}
      {orig && <span class="ing-orig muted small"> {t('servings.orig', { n: base, amt: orig })}</span>}
    </span>
  );
}

/** `text` with every occurrence of the given substrings wrapped in a muted, italic span. */
function splitForeign(text: string, parts: string[]): ComponentChildren {
  const out: ComponentChildren[] = [];
  let rest = text;
  for (const part of parts) {
    const idx = rest.indexOf(part);
    if (idx < 0) continue;
    out.push(rest.slice(0, idx));
    out.push(
      <span class="ing-foreign" title={t('edit.foreignHint')}>
        {part}
      </span>,
    );
    rest = rest.slice(idx + part.length);
  }
  out.push(rest);
  return out;
}

/** A marking on one line of a diet tab: swapped (diet-coloured bar) or "controleer zelf" (orange dot; `done` = ticked on approval). */
export type LineMark = { kind: 'swapped'; diet: VariantDiet } | { kind: 'check'; done: boolean };

export interface LineViewProps {
  line: Line;
  index: number;
  /** servings / base servings. */
  factor: number;
  /** The recipe's own servings (for the muted original). */
  base: number;
  /** Cook mode: the row is a tick box. */
  tick?: { on: boolean; toggle: () => void };
  /** Opens "Koppel ingrediënt" for this line (the "?" chip, or a long press on a resolved line). */
  onLink?: (index: number, query: string) => void;
  /** 13D: the marking of this line on a diet tab. */
  mark?: LineMark;
}

export function LineView(props: LineViewProps) {
  const { line, index, factor, base, tick, mark } = props;
  const l = lang.value;
  const header = line.kind === 'header';
  // An `ing` this dictionary does not know (a user entry from the other phone) is unresolved here.
  const resolved = !!line.ing && !!dictionary.value.get(line.ing);
  const low = resolved && typeof line.confidence === 'number' && line.confidence < LOW_CONFIDENCE;
  const query = line.name ?? '';
  const canLink = !!props.onLink && !header;
  const open = () => props.onLink?.(index, query);
  // Hooks before the early return, so the order is stable for every kind of line.
  const press = useLongPress(open, canLink && resolved);
  if (header) {
    return <li class="ing-header">{pickText(line.raw, l).replace(/:\s*$/, '')}</li>;
  }
  const markClass = mark?.kind === 'swapped' ? ` swapped diet-${mark.diet}` : mark?.kind === 'check' ? ' check-self' : '';
  // The orange dot sits before the text, the "✓" (ticked on approval) after it.
  const text = (
    <>
      {mark?.kind === 'check' && <span class="ing-dot" role="img" aria-label={t('variant.check')} />}
      <LineText line={line} lang={l} factor={factor} base={base} />
      {mark?.kind === 'check' && mark.done && (
        <span class="ing-done" role="img" aria-label={t('vt.sheet.checked')}>
          {' ✓'}
        </span>
      )}
    </>
  );
  return (
    <li class={'ing-item' + (tick?.on ? ' on' : '') + markClass}>
      {tick ? (
        <button type="button" class={'ing-row' + (tick.on ? ' on' : '')} aria-pressed={tick.on} onClick={tick.toggle} {...press}>
          <span class="box" aria-hidden="true">
            {tick.on ? '✓' : ''}
          </span>
          <span class="txt">{text}</span>
        </button>
      ) : (
        <div class={'ing-body' + (canLink && resolved ? ' pressable' : '')} {...press}>
          {text}
        </div>
      )}
      {canLink && (!resolved || low) && (
        <button type="button" class={'ing-q' + (low ? ' soft' : '')} aria-label={t('line.link')} title={t('line.link')} onClick={open}>
          ?
        </button>
      )}
    </li>
  );
}

export interface IngredientListProps {
  recipeId: string;
  /** The effective lines (`useRecipeLines`). */
  lines: Line[];
  servings: number;
  base: number;
  /** Cook-mode typography + tick boxes. */
  tick?: { ticked: Set<number>; toggle: (index: number) => void };
  big?: boolean;
  /** Set false to hide the "?" chips (e.g. read-only contexts). Default true. */
  linkable?: boolean;
  /** 13D: index -> marking on a diet tab (swapped line / "controleer zelf"). */
  marks?: ReadonlyMap<number, LineMark>;
  /** 13D: lines without "?" chip and long press (the swapped lines of a diet tab: derived, not linkable). */
  lockedIndexes?: ReadonlySet<number>;
}

/** The ingredient list with its "Koppel ingrediënt" sheet; the pick is stored as a line override (classic) or in the line (own recipe). */
export function IngredientList(props: IngredientListProps) {
  const { recipeId, lines, servings, base } = props;
  const [pick, setPick] = useState<{ index: number; query: string } | null>(null);
  const factor = base > 0 && servings > 0 ? servings / base : 1;
  const linkable = props.linkable !== false;
  const onLink = linkable ? (index: number, query: string) => setPick({ index, query }) : undefined;
  const { marks, lockedIndexes } = props;

  /**
   * Stores the pick. "Variant van …" (6A.16) comes with a `WordLink`: the words that are not the
   * ingredient become the prep note next to the link (`wordLinkOverride`); the raw line stays.
   */
  async function onPick(id: string, link?: WordLink) {
    const target = pick;
    setPick(null);
    if (!target) return;
    try {
      const line = lines[target.index];
      const fields = link && line ? wordLinkOverride(line, link, dictionary.value) : { ing: id };
      if (isBuiltinId(recipeId)) await setLineOverride({ recipeId, index: target.index, ...fields });
      else await linkUserRecipeLine(recipeId, target.index, fields.ing, fields.prep);
      void recordFeature('dictEdit');
    } catch (e) {
      console.error('link line', e);
    }
  }

  return (
    <>
      <ul class={'ing' + (props.big ? ' big' : '')}>
        {lines.map((line, i) => (
          <LineView
            key={i}
            line={line}
            index={i}
            factor={factor}
            base={base}
            onLink={lockedIndexes?.has(i) ? undefined : onLink}
            mark={marks?.get(i)}
            tick={
              props.tick && line.kind !== 'header'
                ? { on: props.tick.ticked.has(i), toggle: () => props.tick?.toggle(i) }
                : undefined
            }
          />
        ))}
      </ul>
      <IngredientPicker open={pick !== null} initialQuery={pick?.query ?? ''} onPick={(id, _created, link) => void onPick(id, link)} onClose={() => setPick(null)} />
    </>
  );
}
