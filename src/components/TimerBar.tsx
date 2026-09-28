// The running-timers bar under the header: every timer (all recipes), mm:ss, −1/+1 min, ×.
// Renders nothing while no timer exists. Also hosts the one-time "Meldingen aanzetten" prompt.
// Mount it on any screen that should show the timers; the engine itself lives in src/timers.ts.
import { useEffect } from 'preact/hooks';
import { t } from '@/i18n';
import {
  MINUTE_MS,
  adjustTimer,
  dismissNotifPrompt,
  formatRemaining,
  isDone,
  notifPrompt,
  now,
  remainingMs,
  requestNotifications,
  resetTimer,
  startTimerEngine,
  stopTimer,
  timers,
} from '@/timers';

export function TimerBar() {
  useEffect(() => {
    void startTimerEngine();
  }, []);
  const list = timers.value;
  const at = now.value;
  const ask = notifPrompt.value;
  if (!list.length && !ask) return null;
  return (
    <div class="timerbar" role="region" aria-label={t('timer.title')}>
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
      {list.map((tm) => {
        const done = isDone(tm, at);
        return (
          <div key={tm.id} class={'timerbar-row' + (done ? ' done' : '')}>
            <span class="timerbar-label">{tm.label}</span>
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
      })}
    </div>
  );
}
