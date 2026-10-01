// Read-aloud for the cook mode (docs/phase-5-spec.md Block B.1): `speak(text, lang)` through
// `speechSynthesis` with a voice picked per language (prefer exact nl-NL / en-GB, else the first
// voice whose lang starts with 'nl'/'en', else just set `utterance.lang`), rate 0.95. The module
// cancels running speech on every navigation (route-signal subscription) and mirrors the setting
// `speech.readAloud` (auto-read on step change, off by default) the same way src/celebrate.ts does.
import { signal } from '@preact/signals';
import type { Lang } from '@/domain/model';
import { getSetting, setSetting } from '@/db/repo';
import { route } from '@/router';

export const READ_ALOUD_SETTING = 'speech.readAloud';

/** Mirror of the `speech.readAloud` setting (default false): auto-read each step in cook mode. */
export const readAloud = signal(false);
/** True while something is being read aloud (the 🔊 button shows its stop state on it). */
export const speaking = signal(false);

let loaded: Promise<void> | null = null;

/** Reads the `speech.readAloud` setting once (idempotent). */
export function loadSpeechSettings(): Promise<void> {
  if (!loaded) {
    loaded = getSetting<boolean>(READ_ALOUD_SETTING, false)
      .then((on) => {
        readAloud.value = on === true;
      })
      .catch(() => undefined);
  }
  return loaded;
}

/** Re-reads the setting from the database (after a restore replaced it). */
export function reloadSpeechSettings(): Promise<void> {
  loaded = null;
  return loadSpeechSettings();
}

export async function setReadAloud(on: boolean): Promise<void> {
  // Wait for a load that may still be running, or its late .then would undo this toggle.
  await loadSpeechSettings();
  readAloud.value = on;
  await setSetting(READ_ALOUD_SETTING, on);
}

// --- Echo guard -------------------------------------------------------------------------------

/** When the last utterance stopped: recognition results from just after may still be our own voice. */
let lastSpokeAt = 0;
const ECHO_GRACE_MS = 1000;

/**
 * True while the app reads aloud and for a moment after. Voice commands (src/voice.ts) ignore
 * transcripts in that window: the mic hears the phone's own speaker, and step texts contain
 * normal words like "terug"/"back"/"stop" that would otherwise navigate or stop mid-sentence.
 */
export function hearingOwnVoice(): boolean {
  return speaking.value || Date.now() - lastSpokeAt < ECHO_GRACE_MS;
}

/** True when this browser can speak at all (invariant 13: the 🔊 button only shows when it can). */
export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// --- Voice choice ---------------------------------------------------------------------------------

/** The voice we ask for per app language; girlfriend reviews the English edition in British English. */
const PREFERRED_VOICE: Record<Lang, string> = { nl: 'nl-NL', en: 'en-GB' };

let voices: SpeechSynthesisVoice[] = [];
let voicesHooked = false;

function refreshVoices(): void {
  try {
    voices = speechSynthesis.getVoices();
  } catch {
    voices = [];
  }
}

/** Voice lists load async (Chrome fires 'voiceschanged'); hook once, lazily. */
function ensureVoices(): void {
  if (voicesHooked || !canSpeak()) return;
  voicesHooked = true;
  refreshVoices();
  try {
    speechSynthesis.addEventListener('voiceschanged', refreshVoices);
  } catch {
    (speechSynthesis as SpeechSynthesis & { onvoiceschanged: (() => void) | null }).onvoiceschanged = refreshVoices;
  }
}

/** Exact preferred tag first ('nl-NL' / 'en-GB', '_' tolerated), else the first 'nl…'/'en…' voice. */
function voiceFor(lang: Lang): SpeechSynthesisVoice | null {
  const want = PREFERRED_VOICE[lang].toLowerCase();
  const norm = (tag: string) => tag.replace(/_/g, '-').toLowerCase();
  return voices.find((v) => norm(v.lang) === want) ?? voices.find((v) => norm(v.lang).startsWith(lang)) ?? null;
}

// --- Speaking -------------------------------------------------------------------------------------

/** The utterance being spoken; `onend` of a cancelled one must not clear the next one's state. */
let current: SpeechSynthesisUtterance | null = null;

/** Speaks `text` in `lang` (cancels whatever was being read). No-op without speechSynthesis. */
export function speak(text: string, lang: Lang): void {
  if (!canSpeak()) return;
  stopSpeaking();
  const clean = text.trim();
  if (!clean) return;
  ensureVoices();
  if (voices.length === 0) refreshVoices();
  const u = new SpeechSynthesisUtterance(clean);
  u.rate = 0.95;
  const voice = voiceFor(lang);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    // No matching voice installed: set the language and let the engine do its best.
    u.lang = PREFERRED_VOICE[lang];
  }
  const done = () => {
    if (current === u) {
      current = null;
      speaking.value = false;
      lastSpokeAt = Date.now();
    }
  };
  u.onend = done;
  u.onerror = done;
  current = u;
  // Optimistic: Android fires onstart late; the button should flip to its stop state right away.
  speaking.value = true;
  try {
    speechSynthesis.speak(u);
  } catch {
    done();
  }
}

export function stopSpeaking(): void {
  // Only an actual interruption poisons the echo window; a no-op stop (page change while quiet)
  // must not mute the mic for a second.
  if (speaking.value) lastSpokeAt = Date.now();
  current = null;
  speaking.value = false;
  if (!canSpeak()) return;
  try {
    speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

// --- Cancel on navigation (spec B.1: "cancel on navigation") --------------------------------------

let lastPath: string | null = null;
route.subscribe((r) => {
  if (lastPath !== null && r.path !== lastPath) stopSpeaking();
  lastPath = r.path;
});
