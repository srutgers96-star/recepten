// "?" next to the mic in cook mode (docs/phase-6-spec.md 6A.8): a bottom sheet with every voice
// command in the UI language and a few example phrases per command. Same sheet markup as the
// IngredientPicker (.sheet-backdrop / .sheet / .sheet-head / .sheet-body in base.css); Escape and
// the backdrop close it. Honest about the mechanics (invariant 13): the mic listens in the language
// of the active profile and pauses while the app itself reads aloud (the echo guard in src/voice.ts).
import { useEffect } from 'preact/hooks';
import type { VoiceCommand } from '@/domain/voice';
import { t } from '@/i18n';

interface HelpRow {
  kind: VoiceCommand['kind'];
  /** i18n key of the command name; `${name}Say` holds the example phrases ("volgende · volgende stap"). */
  name: string;
}

/** Order as spoken in the kitchen: moving, hearing, timers, stop. */
const ROWS: readonly HelpRow[] = [
  { kind: 'next', name: 'cook.cmd.next' },
  { kind: 'prev', name: 'cook.cmd.prev' },
  { kind: 'read', name: 'cook.cmd.read' },
  { kind: 'repeat', name: 'cook.cmd.repeat' },
  { kind: 'ingredients', name: 'cook.cmd.ingredients' },
  { kind: 'timer', name: 'cook.cmd.timer' },
  { kind: 'timeLeft', name: 'cook.cmd.timeLeft' },
  { kind: 'stop', name: 'cook.cmd.stop' },
];

export function VoiceHelp(props: { open: boolean; onClose: () => void }) {
  // Escape closes (same as the picker sheet).
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  const title = t('cook.mic');
  return (
    <div class="sheet-backdrop" onClick={props.onClose}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div class="sheet-head">
          <h2>{title}</h2>
          <button type="button" class="icon-btn" aria-label={t('common.close')} onClick={props.onClose}>
            ×
          </button>
        </div>
        <div class="sheet-body">
          <p class="muted small">{t('cook.helpIntro')}</p>
          <ul class="voice-help">
            {ROWS.map((r) => (
              <li key={r.kind}>
                <span class="vh-cmd">{t(r.name)}</span>
                <span class="vh-say muted">{t(`${r.name}Say`)}</span>
              </li>
            ))}
          </ul>
          <p class="muted small">{t('cook.helpEcho')}</p>
        </div>
      </div>
    </div>
  );
}
