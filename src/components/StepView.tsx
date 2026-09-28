// One recipe step: the text in the active language plus a timer chip per duration found in it.
// Used as a numbered list item on the detail screen and as the big card in cook mode (`big`).
// A chip starts a timer in the global store (src/timers.ts); while that timer runs the chip shows
// the countdown instead, so a second tap never starts a duplicate.
import { pickText, type Step, type TimerSpec } from '@/domain/model';
import { findTimers, formatTimer, timerMs } from '@/domain/timers';
import { lang, t } from '@/i18n';
import { findRunningTimer, formatRemaining, now, remainingMs, startTimer } from '@/timers';

export interface StepViewProps {
  recipeId: string;
  /** Recipe name in the active language; goes into the timer label ("Lasagne · stap 3"). */
  recipeName: string;
  /** Zero-based step index. */
  index: number;
  step: Step;
  /** Cook-mode typography (20-22 px). */
  big?: boolean;
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

export function StepView(props: StepViewProps) {
  const text = pickText(props.step.text, lang.value);
  const specs = stepTimers(props.step, text);
  if (props.big) {
    return (
      <div class="step-big">
        <p class="cook-text">{text}</p>
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
        <p class="step-text">{text}</p>
        <TimerChips recipeId={props.recipeId} recipeName={props.recipeName} index={props.index} specs={specs} />
      </div>
    </li>
  );
}
