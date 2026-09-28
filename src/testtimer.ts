// The 30 s test timer of the device check (PLAN.md §3b test 11), as module-level signals so it keeps
// counting and fires on whichever screen is open ("timers lopen door terwijl je verder bladert").
// endAt survives a reload via localStorage; the timer fires exactly once per endAt.
import { signal } from '@preact/signals';
import { lang } from './i18n';

const TIMER_KEY = 'recepten.testtimer.endAt';
const FIRED_KEY = 'recepten.testtimer.firedFor';
export const TEST_TIMER_MS = 30_000;

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function readEndAt(): number | null {
  const v = Number(lsGet(TIMER_KEY));
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Wall-clock end time of the running timer, or null when idle. */
export const timerEndAt = signal<number | null>(readEndAt());
/** Wall clock at the last tick (drives the countdown display). */
export const timerNow = signal<number>(Date.now());
/** True once the current timer has fired (also after a reload). */
export const timerFired = signal<boolean>(lsGet(TIMER_KEY) !== null && lsGet(FIRED_KEY) === lsGet(TIMER_KEY));

let audio: AudioContext | null = null;

function beep(ctx: AudioContext) {
  const start = ctx.currentTime;
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, start + i * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.5, start + i * 0.3 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.3 + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start + i * 0.3);
    osc.stop(start + i * 0.3 + 0.25);
  }
}

async function notify(title: string, body: string) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts: NotificationOptions = { body, tag: 'recepten-testtimer' };
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

function fire(endAt: number) {
  if (lsGet(FIRED_KEY) === String(endAt)) return;
  lsSet(FIRED_KEY, String(endAt));
  timerFired.value = true;
  try {
    if (audio) beep(audio);
  } catch (e) {
    console.warn('beep', e);
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* ignore */
  }
  const nl = lang.value === 'nl';
  void notify(nl ? 'Testtimer afgelopen' : 'Test timer finished', nl ? '30 seconden voorbij.' : '30 seconds are up.');
}

function tick() {
  const endAt = timerEndAt.value;
  if (endAt === null) return;
  const n = Date.now();
  timerNow.value = n;
  if (n >= endAt) fire(endAt);
}

let ticking = false;
/** Starts the global 250 ms ticker (idempotent). Called once from the app root. */
export function startTestTimerTicker() {
  if (ticking) return;
  ticking = true;
  setInterval(tick, 250);
  document.addEventListener('visibilitychange', tick);
  tick();
}

/** Call inside a tap: creates/unlocks the AudioContext (iOS) and starts a fresh 30 s countdown. */
export function startTestTimer() {
  try {
    const ctx = audio ?? new AudioContext();
    audio = ctx;
    void ctx.resume();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {
    console.warn('AudioContext', e);
  }
  const end = Date.now() + TEST_TIMER_MS;
  lsSet(FIRED_KEY, null);
  lsSet(TIMER_KEY, String(end));
  timerFired.value = false;
  timerNow.value = Date.now();
  timerEndAt.value = end;
}

export function stopTestTimer() {
  lsSet(TIMER_KEY, null);
  lsSet(FIRED_KEY, null);
  timerEndAt.value = null;
  timerFired.value = false;
}
