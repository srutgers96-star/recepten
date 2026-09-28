// App-level timer engine (docs/phase-1-spec.md §5 "Koken"). One module-level store, not per screen:
// timers keep counting while you browse or leave the app. Persisted through the repo (`timers`
// table) so they survive a reload; wall-clock `endAt`; one interval while anything runs.
//
// On finish: beep (WebAudio, unlocked on the first tap in the app — the phase-0 approach that proved
// to sound in the background on Android, see src/testtimer.ts), vibrate, and — when Notification
// permission is granted — a service-worker notification "Timer klaar — <label>" (tag `timer:<id>`).
// While a timer runs (permission granted) a silent notification with the remaining minutes is
// refreshed once per minute under the same tag ("min-tijd zien"). A finished timer stays in the
// store (showing "Klaar") until the user dismisses it with ×.
import { computed, signal } from '@preact/signals';
import type { RunningTimer, TimerSpec } from '@/domain/model';
import { timerMs } from '@/domain/timers';
import { deleteTimer, getSetting, listTimers, putTimer, setSetting } from '@/db/repo';
import { lang, tIn } from '@/i18n';
import { navigate, route } from '@/router';

export const NOTIF_ASKED_SETTING = 'timers.notifAsked';
const FIRED_KEY = 'recepten.timers.fired';
const TICK_MS = 500;
export const MINUTE_MS = 60_000;

/** All timers (running and finished-but-not-dismissed), earliest endAt first. */
export const timers = signal<RunningTimer[]>([]);
/** Wall clock at the last tick; read it to render countdowns. */
export const now = signal<number>(Date.now());
/** True once the store has been read from the database. */
export const timersLoaded = signal(false);
/** True while the one-time "Meldingen aanzetten" prompt should be shown. */
export const notifPrompt = signal(false);
/** Mirror of Notification.permission ('unsupported' when the API is missing). */
export const notifPermission = signal<NotificationPermission | 'unsupported'>(readPermission());
export const anyRunning = computed(() => timers.value.some((t) => t.endAt > now.value));

function readPermission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

// --- Fired bookkeeping (survives a reload so an overdue timer never beeps twice) ------------------

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

const fired = new Set<string>(
  (() => {
    try {
      const v = JSON.parse(lsGet(FIRED_KEY) ?? '[]');
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  })(),
);

function saveFired() {
  lsSet(FIRED_KEY, JSON.stringify([...fired]));
}

// --- Audio (unlock inside a user gesture; iOS and Chrome both need it) ---------------------------

let audio: AudioContext | null = null;

/** Creates/resumes the AudioContext. Call inside a tap; harmless to call again. */
export function unlockAudio() {
  try {
    const ctx = audio ?? new AudioContext();
    audio = ctx;
    void ctx.resume();
    // A near-silent blip inside the gesture marks the context as user-activated.
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {
    console.warn('AudioContext', e);
  }
}

/** Three short 880 Hz beeps (the pattern that proved to sound in the background), played twice. */
function beep(ctx: AudioContext) {
  const start = ctx.currentTime;
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < 3; i++) {
      const at = start + round * 1.2 + i * 0.3;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.5, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + 0.25);
    }
  }
}

function installUnlockListener() {
  if (typeof document === 'undefined') return;
  const handler = () => {
    unlockAudio();
    if (audio && audio.state === 'running') {
      document.removeEventListener('pointerup', handler);
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
    }
  };
  document.addEventListener('pointerup', handler);
  document.addEventListener('click', handler);
  document.addEventListener('keydown', handler);
}

// --- Notifications -------------------------------------------------------------------------------

/** lib.dom lacks the non-standard-but-supported keys; keep them typed here. */
interface TimerNotificationOptions extends NotificationOptions {
  renotify?: boolean;
  vibrate?: number[];
}

function iconUrl(): string {
  return import.meta.env.BASE_URL + 'icons/icon-192.png';
}

async function showNotification(title: string, opts: TimerNotificationOptions): Promise<void> {
  if (notifPermission.value !== 'granted') return;
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, opts);
        return;
      }
    }
  } catch (e) {
    console.warn('showNotification', e);
  }
  try {
    new Notification(title, opts);
  } catch (e) {
    console.warn('Notification', e);
  }
}

async function closeNotification(id: string): Promise<void> {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    for (const n of await reg.getNotifications({ tag: 'timer:' + id })) n.close();
  } catch {
    /* ignore */
  }
}

function pathFor(t: RunningTimer): string | undefined {
  return t.recipeId ? '/cook/' + t.recipeId : undefined;
}

/** Remaining minutes as last shown per timer, so the silent notification updates once per minute. */
const notifiedMinute = new Map<string, number>();

function notifyProgress(t: RunningTimer, n: number) {
  const minutes = Math.ceil((t.endAt - n) / MINUTE_MS);
  if (minutes <= 0 || notifiedMinute.get(t.id) === minutes) return;
  notifiedMinute.set(t.id, minutes);
  const l = lang.value;
  void showNotification(t.label, {
    body: tIn(l, 'timer.notif.left', { n: minutes }),
    tag: 'timer:' + t.id,
    icon: iconUrl(),
    silent: true,
    renotify: false,
    data: { path: pathFor(t) },
  });
}

function notifyDone(t: RunningTimer) {
  const l = lang.value;
  void showNotification(tIn(l, 'timer.notif.done', { label: t.label }), {
    body: tIn(l, 'timer.notif.doneBody'),
    tag: 'timer:' + t.id,
    icon: iconUrl(),
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 150, 300, 150, 300],
    data: { path: pathFor(t) },
  });
}

/** Asks for Notification permission (call inside a tap). Returns the new state. */
export async function requestNotifications(): Promise<NotificationPermission | 'unsupported'> {
  notifPrompt.value = false;
  void setSetting(NOTIF_ASKED_SETTING, true);
  if (typeof Notification === 'undefined') return 'unsupported';
  try {
    const result = await Notification.requestPermission();
    notifPermission.value = result;
    return result;
  } catch {
    notifPermission.value = readPermission();
    return notifPermission.value;
  }
}

/** "Niet nu": never ask again from the timer flow (Meer keeps its own way in). */
export function dismissNotifPrompt() {
  notifPrompt.value = false;
  void setSetting(NOTIF_ASKED_SETTING, true);
}

async function maybePromptNotifications() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
  const asked = await getSetting<boolean>(NOTIF_ASKED_SETTING, false);
  if (!asked) notifPrompt.value = true;
}

// --- Ticking -------------------------------------------------------------------------------------

let interval: number | null = null;

function fire(t: RunningTimer) {
  fired.add(t.id);
  saveFired();
  notifiedMinute.delete(t.id);
  try {
    if (audio) beep(audio);
  } catch (e) {
    console.warn('beep', e);
  }
  try {
    navigator.vibrate?.([300, 150, 300, 150, 300]);
  } catch {
    /* ignore */
  }
  notifyDone(t);
}

function tick() {
  const n = Date.now();
  now.value = n;
  for (const t of timers.value) {
    if (t.endAt <= n) {
      if (!fired.has(t.id)) fire(t);
    } else if (notifPermission.value === 'granted') {
      notifyProgress(t, n);
    }
  }
  syncInterval();
}

/**
 * The interval runs only while a timer is still counting. The tick that fires the last timer is
 * the final one (it has already refreshed `now`); a finished-but-undismissed timer needs no ticks.
 */
function syncInterval() {
  const n = Date.now();
  const needed = timers.value.some((t) => t.endAt > n);
  if (needed && interval === null) interval = window.setInterval(tick, TICK_MS);
  else if (!needed && interval !== null) {
    window.clearInterval(interval);
    interval = null;
  }
}

let engine: Promise<void> | null = null;

/**
 * Loads persisted timers and starts the ticker (idempotent). The shell calls it at start; the
 * TimerBar and startTimer() call it too as a safety net.
 */
export function startTimerEngine(): Promise<void> {
  if (engine) return engine;
  engine = (async () => {
    installUnlockListener();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          notifPermission.value = readPermission();
          tick();
        }
      });
    }
    if ('serviceWorker' in navigator) {
      // A notification tap: the service worker focuses us and asks to open the cook screen.
      navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
        const data = event.data as { type?: string; path?: string } | null;
        if (data && data.type === 'NAVIGATE' && typeof data.path === 'string' && data.path.startsWith('/')) {
          if (route.value.path !== data.path) navigate(data.path);
        }
      });
    }
    try {
      const list = await listTimers();
      // Prune bookkeeping of timers that no longer exist.
      for (const id of [...fired]) if (!list.some((t) => t.id === id)) fired.delete(id);
      saveFired();
      timers.value = list.sort((a, b) => a.endAt - b.endAt);
    } catch (e) {
      console.warn('listTimers', e);
    }
    timersLoaded.value = true;
    tick();
  })();
  return engine;
}

// --- Public API ----------------------------------------------------------------------------------

export interface StartTimerOptions {
  /** A duration from the step text; `durationMs` wins when both are given. */
  spec?: TimerSpec;
  durationMs?: number;
  /** Shown in the bar and in the notification ("Lasagne · stap 3"). */
  label: string;
  recipeId?: string | null;
  stepIndex?: number | null;
}

function newTimerId(): string {
  return 't:' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/** Starts a timer (call inside a tap so the audio gets unlocked). */
export async function startTimer(opts: StartTimerOptions): Promise<RunningTimer> {
  unlockAudio();
  void startTimerEngine();
  const durationMs = Math.max(1000, Math.round(opts.durationMs ?? (opts.spec ? timerMs(opts.spec) : 60_000)));
  const createdAt = Date.now();
  const t: RunningTimer = {
    id: newTimerId(),
    recipeId: opts.recipeId ?? null,
    stepIndex: opts.stepIndex ?? null,
    label: opts.label,
    endAt: createdAt + durationMs,
    durationMs,
    createdAt,
  };
  timers.value = [...timers.value, t].sort((a, b) => a.endAt - b.endAt);
  now.value = createdAt;
  syncInterval();
  try {
    await putTimer(t);
  } catch (e) {
    console.warn('putTimer', e);
  }
  void maybePromptNotifications();
  return t;
}

/**
 * −1/+1 minute. +1 on a finished timer restarts it from now; −1 on a finished timer does nothing
 * (it would restart it for a second and beep again). Only `endAt` moves: `durationMs` stays the
 * duration the timer was started with, because the step chip identifies its timer by it.
 */
export async function adjustTimer(id: string, deltaMs: number): Promise<void> {
  const t = timers.value.find((x) => x.id === id);
  if (!t) return;
  const n = Date.now();
  const finished = t.endAt <= n;
  if (finished && deltaMs <= 0) return;
  const endAt = Math.max(n + 1000, (finished ? n : t.endAt) + deltaMs);
  const next: RunningTimer = { ...t, endAt };
  if (fired.has(id) && endAt > n) {
    fired.delete(id);
    saveFired();
    void closeNotification(id);
  }
  notifiedMinute.delete(id);
  timers.value = timers.value.map((x) => (x.id === id ? next : x)).sort((a, b) => a.endAt - b.endAt);
  now.value = n;
  syncInterval();
  try {
    await putTimer(next);
  } catch (e) {
    console.warn('putTimer', e);
  }
}

/**
 * ↻ in the bar: starts the timer again from the duration it was started with (the "10 min" from the
 * step), whatever −1/+1 did in the meantime. Works on running and finished timers.
 */
export async function resetTimer(id: string): Promise<void> {
  const t = timers.value.find((x) => x.id === id);
  if (!t) return;
  unlockAudio();
  const n = Date.now();
  const next: RunningTimer = { ...t, createdAt: n, endAt: n + t.durationMs };
  if (fired.has(id)) {
    fired.delete(id);
    saveFired();
    void closeNotification(id);
  }
  notifiedMinute.delete(id);
  timers.value = timers.value.map((x) => (x.id === id ? next : x)).sort((a, b) => a.endAt - b.endAt);
  now.value = n;
  syncInterval();
  try {
    await putTimer(next);
  } catch (e) {
    console.warn('putTimer', e);
  }
}

/** × in the bar: removes the timer (running or finished) and its notification. */
export async function stopTimer(id: string): Promise<void> {
  timers.value = timers.value.filter((x) => x.id !== id);
  fired.delete(id);
  saveFired();
  notifiedMinute.delete(id);
  syncInterval();
  void closeNotification(id);
  try {
    await deleteTimer(id);
  } catch (e) {
    console.warn('deleteTimer', e);
  }
}

/**
 * The running timer for a step chip, if any: same recipe, step and started duration (a step can
 * carry two chips, "5 min" and "20 min"). `durationMs` never changes after start (see adjustTimer),
 * so a chip keeps showing its countdown after −1/+1 and a second tap never starts a duplicate.
 */
export function findRunningTimer(recipeId: string, stepIndex: number, durationMs: number): RunningTimer | undefined {
  return timers.value.find((t) => t.recipeId === recipeId && t.stepIndex === stepIndex && t.durationMs === durationMs && t.endAt > now.value);
}

export function remainingMs(t: RunningTimer, at: number = now.value): number {
  return Math.max(0, t.endAt - at);
}

export function isDone(t: RunningTimer, at: number = now.value): boolean {
  return t.endAt <= at;
}

/** "12:05", "0:42", "1:05:00" (hours only when needed). Rounds up so 59.5 s still reads 1:00. */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
