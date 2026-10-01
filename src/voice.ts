// Voice commands for the cook mode (docs/phase-5-spec.md Block B.2, Android first):
// webkitSpeechRecognition/SpeechRecognition, continuous, no interim results, language from the
// active profile. Chrome ends a continuous session every so often, so `onend` restarts it for as
// long as `startListening` is in force; a permission error ('not-allowed') stops it for good and
// keeps the 'error' state visible (Chrome fires `onend` right after `onerror`, which must not
// overwrite it with 'off'). Results are ignored while the app itself reads aloud (src/speech.ts),
// or "put the tray back in the oven" from our own speaker would navigate.
// The grammar lives framework-free in src/domain/voice.ts (parseVoiceCommand). The setting
// `speech.commands` (default false) follows the src/celebrate.ts pattern. Honest capability
// (CLAUDE.md invariant 13): the UI only offers the mic when `canListen()` is true.
import { signal } from '@preact/signals';
import type { Lang } from '@/domain/model';
import { parseVoiceCommand, type VoiceCommand } from '@/domain/voice';
import { getSetting, setSetting } from '@/db/repo';
import { hearingOwnVoice } from '@/speech';

export const COMMANDS_SETTING = 'speech.commands';

/** Mirror of the `speech.commands` setting (default false). */
export const commandsEnabled = signal(false);

let loaded: Promise<void> | null = null;

/** Reads the `speech.commands` setting once (idempotent). */
export function loadVoiceSettings(): Promise<void> {
  if (!loaded) {
    loaded = getSetting<boolean>(COMMANDS_SETTING, false)
      .then((on) => {
        commandsEnabled.value = on === true;
      })
      .catch(() => undefined);
  }
  return loaded;
}

/** Re-reads the setting from the database (after a restore replaced it). */
export function reloadVoiceSettings(): Promise<void> {
  loaded = null;
  return loadVoiceSettings();
}

export async function setCommandsEnabled(on: boolean): Promise<void> {
  // Wait for a load that may still be running, or its late .then would undo this toggle.
  await loadVoiceSettings();
  commandsEnabled.value = on;
  await setSetting(COMMANDS_SETTING, on);
}

// --- Minimal typing: lib.dom has no SpeechRecognition types ----------------------------------------

interface RecognitionAlternativeLike {
  transcript: string;
}
interface RecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: RecognitionAlternativeLike;
}
interface RecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onresult: ((event: RecognitionEventLike) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True when this browser has a speech-recognition API at all. */
export function canListen(): boolean {
  return recognitionCtor() !== null;
}

// --- Listening ------------------------------------------------------------------------------------

export type MicState = 'off' | 'starting' | 'listening' | 'error';

/** Visible mic state for the UI (colour/label/aria on the mic button). */
export const micState = signal<MicState>('off');

/** The recognition language per app language (same preference as the voices in src/speech.ts). */
const RECOGNITION_LANG: Record<Lang, string> = { nl: 'nl-NL', en: 'en-GB' };

/** Delay before a restart that follows an error, so an offline phone never hammers the service. */
const ERROR_RESTART_MS = 1500;

let active = false;
let rec: SpeechRecognitionLike | null = null;
let restartTimer: number | null = null;
let lastErrorAt = 0;
/** Permission refused: `onend` (which Chrome fires right after) must keep 'error', not show 'off'. */
let denied = false;

function clearRestart(): void {
  if (restartTimer !== null) window.clearTimeout(restartTimer);
  restartTimer = null;
}

/**
 * Starts continuous recognition in `lang`; every final transcript goes through
 * `parseVoiceCommand` and a recognised command is handed to `onCommand`. Restarts itself on
 * `onend` (Chrome stops periodically) until `stopListening()` is called.
 */
export function startListening(lang: Lang, onCommand: (cmd: VoiceCommand) => void): void {
  const Ctor = recognitionCtor();
  if (!Ctor) return;
  stopListening();
  active = true;
  denied = false;
  micState.value = 'starting';
  const r = new Ctor();
  rec = r;
  r.lang = RECOGNITION_LANG[lang];
  r.continuous = true;
  r.interimResults = false;
  r.onstart = () => {
    if (rec === r && active) micState.value = 'listening';
  };
  r.onresult = (e) => {
    if (rec !== r || !active) return;
    // Echo guard: while the app reads aloud (and a moment after) the mic hears the phone's own
    // speaker — "put the tray back in the oven" must not navigate. Commands wait until it is quiet.
    if (hearingOwnVoice()) return;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const result = e.results[i];
      if (!result || !result.isFinal) continue;
      const transcript = result[0]?.transcript ?? '';
      const cmd = parseVoiceCommand(transcript, lang);
      if (cmd) onCommand(cmd);
    }
  };
  r.onerror = (e) => {
    if (rec !== r) return;
    const err = e?.error ?? '';
    if (err === 'not-allowed' || err === 'service-not-allowed') {
      // Permission denied is final: stop for good instead of re-triggering the mic prompt.
      // `denied` keeps the 'error' state through the onend that Chrome fires right after.
      denied = true;
      active = false;
      micState.value = 'error';
      return;
    }
    // Routine ends ('no-speech' after silence, 'aborted'): nothing is wrong; onend restarts.
    if (err === 'no-speech' || err === 'aborted') return;
    // Real transient trouble ('network', 'audio-capture' …): show it; onend decides the restart.
    lastErrorAt = Date.now();
    if (active) micState.value = 'error';
  };
  r.onend = () => {
    if (rec !== r) return;
    if (!active) {
      // A final (permission) failure stays visible; only a plain stop goes back to 'off'.
      if (!denied) micState.value = 'off';
      return;
    }
    // Chrome ends a continuous session periodically: restart while we are supposed to listen.
    // During the backoff after a real error keep showing 'error' instead of 'starting', so an
    // offline restart loop reads as a fault, not as an eternal "Mic aan…".
    const delay = Date.now() - lastErrorAt < 2 * ERROR_RESTART_MS ? ERROR_RESTART_MS : 0;
    micState.value = delay > 0 ? 'error' : 'starting';
    clearRestart();
    restartTimer = window.setTimeout(() => {
      restartTimer = null;
      if (rec !== r || !active) return;
      try {
        r.start();
      } catch {
        micState.value = 'error';
      }
    }, delay);
  };
  try {
    r.start();
  } catch {
    active = false;
    rec = null;
    micState.value = 'error';
  }
}

export function stopListening(): void {
  active = false;
  clearRestart();
  const r = rec;
  rec = null;
  micState.value = 'off';
  if (r) {
    r.onstart = null;
    r.onresult = null;
    r.onerror = null;
    r.onend = null;
    try {
      r.abort();
    } catch {
      /* ignore */
    }
  }
}
