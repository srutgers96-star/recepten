// The cooking bar under the header (13K, docs/specs/kookbalk.md §1b): one row per recipe you are
// cooking ("Afwasmachinezalm · stap 3 van 7 ›"), that recipe's timers nested under it with a short
// label ("stap 3"), and timers without a cooking session under "Losse timers" with their full label.
// Tap a recipe row = back to that recipe's cook mode on the remembered step, with its servings.
// The × on a recipe row ends the session; it is only there while no timer of that recipe still runs.
// ONE 🔔/🔕 button for the whole bar (on its own slim head row — a fifth button on the first timer row
// left the label ~18 px at 360 px width) mirrors the `timer.sound` setting off/on.
// Renders nothing while there is no session and no timer. Also hosts the one-time "Meldingen
// aanzetten" prompt. In cook mode (`current` = that recipe's id) the recipe's own row is hidden (the
// screen's "Stap 3 van 7" says it already); its timers sit directly under the head row.
// The timer engine lives in src/timers.ts, the cooking sessions in src/cooking.ts.
import { Fragment } from 'preact';
import { useEffect } from 'preact/hooks';
import { lang, t } from '@/i18n';
import { pickText, type RunningTimer } from '@/domain/model';
import { cookPath, groupBar, type BarRecipeGroup } from '@/domain/cooking';
import { endCooking, liveSessions, loadCooking } from '@/cooking';
import { loadSoundSettings, timerSound, toggleTimerSound } from '@/sounds';
import {
  MINUTE_MS,
  adjustTimer,
  dismissNotifPrompt,
  formatRemaining,
  isDone,
  notifPrompt,
  now,
  openTimerPath,
  remainingMs,
  requestNotifications,
  resetTimer,
  startTimerEngine,
  stopTimer,
  timerPath,
  timers,
  unlockAudio,
} from '@/timers';

export function TimerBar(props: { current?: string }) {
  useEffect(() => {
    void startTimerEngine();
    void loadSoundSettings();
    void loadCooking();
  }, []);
  const at = now.value;
  const model = groupBar(liveSessions.value, timers.value, at, props.current);
  const ask = notifPrompt.value;
  const soundOn = timerSound.value !== 'off';
  const soundLabel = soundOn ? t('timer.soundOn') : t('timer.soundOff');
  const hasRows = model.current.length > 0 || model.groups.length > 0;
  if (!hasRows && !ask) return null;
  const title = model.hasSessions ? t('cooking.title') : t('timer.title');
  return (
    <div class="timerbar" role="region" aria-label={title}>
      {ask && (
        <div class="timerbar-ask">
          <div class="timerbar-ask-text">
            <strong>{t('timer.askTitle')}</strong> {t('timer.askBody')}
          </div>
          <div class="timerbar-ask-actions">
            <button type="button" class="btn btn-primary btn-small" onClick={() => void requestNotifications()}>
              {t('timer.askYes')}
            </button>
            <button type="button" class="btn btn-small" onClick={dismissNotifPrompt}>
              {t('timer.askNo')}
            </button>
          </div>
        </div>
      )}
      {hasRows && (
        // One sound toggle for the whole bar (mirrors the `timer.sound` setting), not per timer.
        // Toggle semantics: the accessible name stays fixed, the state comes from aria-pressed.
        <div class="timerbar-head">
          <span class="timerbar-head-label">{title}</span>
          <button
            type="button"
            class="timerbar-btn bell"
            aria-pressed={soundOn}
            aria-label={t('timer.sound')}
            title={soundLabel}
            onClick={() => {
              unlockAudio();
              void toggleTimerSound();
            }}
          >
            {soundOn ? '🔔' : '🔕'}
          </button>
        </div>
      )}
      {/* Cook mode: the timers of the recipe on this screen, short label, not nested (no row above). */}
      {model.current.map((tm) => (
        <TimerRow key={tm.id} tm={tm} at={at} label={shortLabel(tm)} />
      ))}
      {model.groups.map((g) =>
        g.kind === 'recipe' ? (
          <Fragment key={'r:' + g.session.recipeId}>
            <RecipeRow group={g} />
            {g.timers.map((tm) => (
              <TimerRow key={tm.id} tm={tm} at={at} label={shortLabel(tm)} nested />
            ))}
          </Fragment>
        ) : (
          <Fragment key="loose">
            {/* Without any session the bar looks exactly as before 13K: head "Timers", no sub-head. */}
            {model.hasSessions && <div class="timerbar-loose">{t('cooking.loose')}</div>}
            {g.timers.map((tm) => (
              <TimerRow key={tm.id} tm={tm} at={at} label={tm.label} />
            ))}
          </Fragment>
        ),
      )}
    </div>
  );
}

/** A recipe's timer under its recipe row (or in its own cook mode): "stap 3", or "timer" without a step. */
function shortLabel(tm: RunningTimer): string {
  return typeof tm.stepIndex === 'number' && tm.stepIndex >= 0
    ? t('cook.stepShort', { n: tm.stepIndex + 1 })
    : t('cooking.timerNoStep');
}

/** "Afwasmachinezalm · stap 3 van 7 ›" (tap → cook mode on that step) plus × while stoppable. */
function RecipeRow(props: { group: BarRecipeGroup }) {
  const { session, stoppable } = props.group;
  const name = pickText(session.name, lang.value);
  const onStep = session.page >= 1;
  const stepText = onStep ? t('cooking.stepOf', { n: session.page, total: session.stepCount }) : t('cooking.prepare');
  const openLabel = onStep ? t('cooking.open', { name, n: session.page }) : t('cooking.openPrepare', { name });
  const stopLabel = t('cooking.stop', { name });
  return (
    <div class="timerbar-recipe">
      <button type="button" class="timerbar-open timerbar-recipe-btn" aria-label={openLabel} onClick={() => openTimerPath(cookPath(session))}>
        <span class="timerbar-label-text">{name}</span>
        {/* The no-break space keeps " · " readable: a flex item drops a leading normal space. */}
        <span class="timerbar-recipe-step">{' · ' + stepText}</span>
        <span class="timerbar-chev" aria-hidden="true">
          ›
        </span>
      </button>
      {stoppable && (
        <button type="button" class="timerbar-btn x" aria-label={stopLabel} title={stopLabel} onClick={() => void endCooking(session.recipeId)}>
          ×
        </button>
      )}
    </div>
  );
}

/** One timer: label (a button to its step when it has a recipe), mm:ss, −1, +1, ↻, ×. */
function TimerRow(props: { tm: RunningTimer; at: number; label: string; nested?: boolean }) {
  const { tm, at, label, nested } = props;
  const done = isDone(tm, at);
  const path = timerPath(tm);
  return (
    <div class={'timerbar-row' + (nested ? ' nested' : '') + (done ? ' done' : '')}>
      {path ? (
        <button type="button" class="timerbar-label timerbar-open" aria-label={t('timer.openStep', { label: tm.label })} onClick={() => openTimerPath(path)}>
          <span class="timerbar-label-text">{label}</span>
          <span class="timerbar-chev" aria-hidden="true">
            ›
          </span>
        </button>
      ) : (
        <span class="timerbar-label">{label}</span>
      )}
      <span class="timerbar-time" aria-live={done ? 'assertive' : 'off'}>
        {done ? t('timer.done') : formatRemaining(remainingMs(tm, at))}
      </span>
      <button type="button" class="timerbar-btn" aria-label={t('timer.minus')} onClick={() => void adjustTimer(tm.id, -MINUTE_MS)}>
        −1
      </button>
      <button type="button" class="timerbar-btn" aria-label={t('timer.plus')} onClick={() => void adjustTimer(tm.id, MINUTE_MS)}>
        +1
      </button>
      <button
        type="button"
        class="timerbar-btn"
        aria-label={t('timer.reset', { d: formatRemaining(tm.durationMs) })}
        title={t('timer.reset', { d: formatRemaining(tm.durationMs) })}
        onClick={() => void resetTimer(tm.id)}
      >
        ↻
      </button>
      <button type="button" class="timerbar-btn x" aria-label={t('timer.stop')} onClick={() => void stopTimer(tm.id)}>
        ×
      </button>
    </div>
  );
}
