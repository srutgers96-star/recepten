// One recipe step: the text in the active language plus a timer chip per duration found in it.
// Used as a numbered list item on the detail screen and as the big card in cook mode (`big`).
// A chip starts a timer in the global store (src/timers.ts); while that timer runs the chip shows
// the countdown instead, so a second tap never starts a duplicate.
//
// Phase 2: with the setting "°F erbij" (units.fahrenheit) on, oven temperatures in the text render
// as "200 °C (400 °F)" (docs/phase-2-spec.md §5). The step text itself is never rewritten; the
// conversion is applied at render time only.
//
// 13I (docs/phase-6-spec.md): given the recipe's `lines`, the ingredients the step names are green
// (src/domain/stepingredients.ts, matched on the DISPLAYED text). A green word whose amount is not
// already in the text is a button: a tap shows the amount behind it, scaled by `factor`
// ("karwijzaad (1 tl)"), a second tap hides it. The device setting cook.showAmounts
// (src/step-amounts.ts, the "Toon hoeveelheden" button in cook mode) shows them all; a tap then
// hides that one word. A green word that has nothing to add (the text says "2 el olie", or the
// line has no amount, like "zout") is plain green text, not a button, so no tap ever does nothing.
import { Fragment } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { useLive } from '@/db/live';
import { getFahrenheit } from '@/db/repo';
import { dictionary } from '@/dictionary';
import type { Dictionary } from '@/domain/dictionary';
import type { Lang, Line, Step, TimerSpec } from '@/domain/model';
import { findStepIngredients, matchQuantityText, stepSegments, type StepIngredientMatch } from '@/domain/stepingredients';
import { findTimers, formatTimer, timerMs } from '@/domain/timers';
import { pickSpoken } from '@/domain/voice';
import { lang, t } from '@/i18n';
import { loadShowAmounts, showAmounts } from '@/step-amounts';
import { findRunningTimer, formatRemaining, now, remainingMs, startTimer } from '@/timers';

/** The oven table (docs/phase-2-spec.md §5); other values fall back to the formula, rounded to 5. */
const OVEN_F: Record<number, number> = {
  140: 275,
  150: 300,
  160: 325,
  170: 340,
  180: 350,
  190: 375,
  200: 400,
  220: 425,
  230: 450,
  250: 480,
};

export function celsiusToF(c: number): number {
  const table = OVEN_F[c];
  if (table !== undefined) return table;
  return Math.round((c * 9) / 5 / 5 + 32 / 5) * 5;
}

const TEMP_RE = /(\d{2,3})\s?(°C|℃)(?!\s?\()/gu;

/** "200 °C" / "200°C" / "200 ℃" -> "200 °C (400 °F)"; text already carrying a °F stays as it is. */
export function addFahrenheit(text: string): string {
  return text.replace(TEMP_RE, (_m, num: string) => {
    const c = Number(num);
    return `${c} °C (${celsiusToF(c)} °F)`;
  });
}

/** Live value of the setting units.fahrenheit (false until read). */
export function useFahrenheit(): boolean {
  return useLive(() => getFahrenheit(), []) === true;
}

export interface StepViewProps {
  recipeId: string;
  /** Recipe name in the active language; goes into the timer label ("Lasagne · stap 3"). */
  recipeName: string;
  /** Zero-based step index. */
  index: number;
  step: Step;
  /** Cook-mode typography (20-22 px). */
  big?: boolean;
  /** Append °F to oven temperatures (setting units.fahrenheit). */
  fahrenheit?: boolean;
  /** The recipe's (effective) ingredient lines: when given, the ingredients the step names are green (13I). */
  lines?: readonly Line[];
  /** Servings factor for the amounts behind a green word (chosen servings / recipe servings; default 1). */
  factor?: number;
}

/** A step as it is shown: the text (with °F when that is on), the stored text and the language it is in. */
export interface ShownStep {
  /** The step text in the active language, or the other one when that is empty (`pickText`). */
  source: string;
  /** `source` as displayed: with "(400 °F)" after oven temperatures when that setting is on. */
  text: string;
  /** The language `text` is written in (the fallback made explicit, as `pickSpoken` does). */
  lang: Lang;
  /** The recipe's ingredients named in `text`; offsets are into `text`. */
  matches: StepIngredientMatch[];
}

/**
 * The displayed text of a step and the ingredients it names (13I). Cook mode uses the same call for
 * the "Toon hoeveelheden" button and the voice command "hoeveel?", so all three agree on the words.
 */
export function shownStep(step: Step, l: Lang, fahrenheit: boolean, lines: readonly Line[] | undefined, dict: Dictionary): ShownStep {
  const picked = pickSpoken(step.text, l);
  const text = fahrenheit ? addFahrenheit(picked.text) : picked.text;
  const matches = lines && lines.length ? findStepIngredients(text, lines, dict, picked.lang) : [];
  return { source: picked.text, text, lang: picked.lang, matches };
}

/** True when a tap on one of the step's green words has an amount to show (the "Toon hoeveelheden" button). */
export function hasAmountsToShow(shown: ShownStep, lines: readonly Line[], dict: Dictionary): boolean {
  return shown.matches.some((m) => matchQuantityText(m, lines, dict, shown.lang) !== '');
}

/** Timer specs of a step: as stored, else derived from the displayed text. */
export function stepTimers(step: Step, text: string): TimerSpec[] {
  return step.timers && step.timers.length ? step.timers : findTimers(text);
}

export function TimerChips(props: { recipeId: string; recipeName: string; index: number; specs: TimerSpec[] }) {
  if (!props.specs.length) return null;
  const l = lang.value;
  // Reading `now` subscribes this component to the 500 ms tick — only for steps that have chips.
  const at = now.value;
  return (
    <div class="chips-inline">
      {props.specs.map((spec, i) => {
        const ms = timerMs(spec);
        const running = findRunningTimer(props.recipeId, props.index, ms);
        const label = formatTimer(spec, l);
        return (
          <button
            key={i}
            type="button"
            class={'timer-chip' + (running ? ' on' : '')}
            aria-label={running ? t('timer.running') : t('timer.start', { d: label })}
            onClick={() => {
              if (running) return;
              void startTimer({
                spec,
                label: `${props.recipeName} · ${t('cook.stepShort', { n: props.index + 1 })}`,
                recipeId: props.recipeId,
                stepIndex: props.index,
              });
            }}
          >
            <span aria-hidden="true">⏱</span>
            {running ? formatRemaining(remainingMs(running, at)) : label}
          </button>
        );
      })}
    </div>
  );
}

const NO_KEYS: ReadonlySet<number> = new Set();

/**
 * The step text with its green ingredients (13I). `flip` holds the words tapped since the "show
 * all" setting last changed (keyed by their offset in this text): those show the opposite of the
 * setting. A change of the setting or of the text starts over with none flipped.
 */
function StepText(props: { cls: string; shown: ShownStep; lines: readonly Line[] | undefined; factor: number }) {
  const { shown, lines } = props;
  const all = showAmounts.value;
  const dict = dictionary.value;
  const [flip, setFlip] = useState<{ all: boolean; text: string; keys: ReadonlySet<number> }>(() => ({ all, text: shown.text, keys: NO_KEYS }));
  useEffect(() => {
    if (lines) void loadShowAmounts();
  }, [!!lines]);
  if (!lines || shown.matches.length === 0) return <p class={props.cls}>{shown.text}</p>;
  const flipped = flip.all === all && flip.text === shown.text ? flip.keys : NO_KEYS;
  const toggle = (key: number) =>
    setFlip((prev) => {
      const keys = new Set(prev.all === all && prev.text === shown.text ? prev.keys : NO_KEYS);
      if (keys.has(key)) keys.delete(key);
      else keys.add(key);
      return { all, text: shown.text, keys };
    });
  return (
    <p class={props.cls}>
      {stepSegments(shown.text, shown.matches).map((seg, i) => {
        const m = seg.match;
        if (!m) return <Fragment key={i}>{seg.text}</Fragment>;
        const qty = matchQuantityText(m, lines, dict, shown.lang, props.factor);
        // Nothing to add (the amount is in the text, or the line has none): green, but no button.
        if (!qty) {
          return (
            <span key={i} class="step-ing-plain">
              {seg.text}
            </span>
          );
        }
        const open = all !== flipped.has(m.start);
        return (
          // .step-ing-wrap keeps the word and the "(" of its amount together (no break after the
          // inline button; the amount starts with a no-break space). The amount itself may wrap at its
          // inner spaces (.step-qty), so a long one ("kaas (50 g geraspte jonge + 3 el geraspte
          // oude)") never runs off a 360 px screen.
          <span key={i} class="step-ing-wrap">
            <button type="button" class="step-ing" aria-pressed={open} aria-label={`${seg.text}, ${qty}`} onClick={() => toggle(m.start)}>
              {seg.text}
            </button>
            {open && (
              // The button's label already carries the amount for a screen reader.
              <span class="step-qty" aria-hidden="true">
                {' '}({qty})
              </span>
            )}
          </span>
        );
      })}
    </p>
  );
}

export function StepView(props: StepViewProps) {
  const l = lang.value;
  const dict = dictionary.value;
  const { step, lines } = props;
  const fahrenheit = !!props.fahrenheit;
  const shown = useMemo(() => shownStep(step, l, fahrenheit, lines, dict), [step, l, fahrenheit, lines, dict]);
  const specs = stepTimers(step, shown.source);
  const factor = props.factor && props.factor > 0 ? props.factor : 1;
  if (props.big) {
    return (
      <div class="step-big">
        <StepText cls="cook-text" shown={shown} lines={lines} factor={factor} />
        <TimerChips recipeId={props.recipeId} recipeName={props.recipeName} index={props.index} specs={specs} />
      </div>
    );
  }
  return (
    <li class="step">
      <span class="step-num" aria-hidden="true">
        {props.index + 1}
      </span>
      <div class="step-body">
        <StepText cls="step-text" shown={shown} lines={lines} factor={factor} />
        <TimerChips recipeId={props.recipeId} recipeName={props.recipeName} index={props.index} specs={specs} />
      </div>
    </li>
  );
}
