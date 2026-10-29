// Unlocks app layer (docs/specs/xp-levels.md §1f, §1g, §2e, §2g, §3 block "6D-3" there = 6D-4a in
// docs/specs/README.md §1). The pure rules live in src/domain/unlocks.ts; this module adds what
// needs the app: the normalized data/unlocks.json, what this PHONE has unlocked, the per-phone
// on/off switches and the "already announced" bookkeeping of the level-up sheet.
//
// - Earned per member (their level from the derived XP state, their own badges), used per phone:
//   `unlockedOnPhone` is the UNION over the local profiles (one household, one phone: everyone here
//   profits). `refreshUnlocks()` recomputes it; src/xp.ts calls it after settleXp, and at boot.
// - `unlocks.disabled` (device-local: "on/off applies to this phone") holds what was switched off;
//   new = on. Switching off the chosen timer sound falls back to 'beeps' (also as the remembered
//   last sound behind a muted 🔔), switching off the chosen cook-mode typeface falls back to
//   'default' (§1f, §1g).
// - `unlocks.announced` (Record<memberId, string[]>) holds what a level-up sheet already showed, so
//   `announceUnlocks` never announces the same unlock twice to the same member (§1d).
// - Badges off: nothing new to see (§1, §1g). The three `active…()` lists then return only the
//   standard choices (no unlocked confetti in the rotation, no extra options in the pickers); what
//   was already chosen keeps working, because the timer and the cook mode read their own settings
//   (`timer.sound`, `cook.font`, `cooked.sound`), not these lists.
import unlocksJson from '@data/unlocks.json';
import { signal, type Signal } from '@preact/signals';
import { badgesEnabled, badgeStatuses } from '@/badges';
import { getSetting, listProfiles, setSetting } from '@/db/repo';
import { normalizeUnlocks, unlockedIds, unlocksForBadge, unlocksForLevels, type Unlock } from '@/domain/unlocks';
import type { XpBadgeFact } from '@/domain/xp';
import { dropTimerSound, type TimerSound } from '@/sounds';
import { xpStateFor } from '@/xp';

/** Setting `unlocks.disabled` (string[], device-local, §2g): unlock ids switched off on this phone. */
const DISABLED_SETTING = 'unlocks.disabled';
/** Setting `unlocks.announced` (Record<memberId, string[]>, §2g): already shown in a level-up sheet. */
const ANNOUNCED_SETTING = 'unlocks.announced';
/** Setting `cook.font` ('default' | 'chalk' | 'hand', §2g): the chosen cook-mode typeface (CookScreen, Meer). */
export const COOK_FONT_SETTING = 'cook.font';

/** The four timer sounds every phone has (src/sounds.ts), before any unlocked one. */
const BASE_TIMER_SOUNDS: readonly TimerSound[] = ['beeps', 'bell', 'melody', 'off'];
export type CookFont = 'default' | 'chalk' | 'hand';
const UNLOCKABLE_FONTS: ReadonlySet<string> = new Set(['chalk', 'hand']);

let cachedData: Unlock[] | null = null;

/** The normalized data/unlocks.json, in file order (module cache). */
export function unlockData(): Unlock[] {
  if (cachedData === null) cachedData = normalizeUnlocks(unlocksJson as unknown);
  return cachedData;
}

/** What the local profiles of this phone unlocked together (the union, §2e). Empty until refreshUnlocks. */
export const unlockedOnPhone: Signal<ReadonlySet<string>> = signal<ReadonlySet<string>>(new Set());
/** Mirror of the setting `unlocks.disabled`: the unlocks switched off on this phone. */
export const disabledUnlocks: Signal<ReadonlySet<string>> = signal<ReadonlySet<string>>(new Set());

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && x !== ''))] : [];
}

function normalizeAnnounced(v: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [memberId, ids] of Object.entries(v as Record<string, unknown>)) {
      const list = stringList(ids);
      if (list.length) out[memberId] = list;
    }
  }
  return out;
}

let disabledLoaded: Promise<void> | null = null;

/** Reads `unlocks.disabled` once (idempotent, like loadSoundSettings). */
function loadDisabled(): Promise<void> {
  if (!disabledLoaded) {
    disabledLoaded = getSetting<unknown>(DISABLED_SETTING, [])
      .then((v) => {
        disabledUnlocks.value = new Set(stringList(v));
      })
      .catch(() => undefined);
  }
  return disabledLoaded;
}

/** The badges this member earned on their own tab, as XP badge facts (tier = reached level). */
async function badgeFactsFor(memberId: string): Promise<XpBadgeFact[]> {
  const statuses = await badgeStatuses(memberId);
  return statuses
    .filter((s) => s.earned && s.tier >= 1)
    .map((s) => ({ id: s.badge.id, level: s.tier, secret: s.badge.hidden === true, xp: s.badge.xp }));
}

function sameSet(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

async function doRefresh(): Promise<void> {
  try {
    await loadDisabled();
    const data = unlockData();
    const profiles = await listProfiles();
    const sets = await Promise.all(
      profiles.map(async (p) => {
        const [state, badges] = await Promise.all([xpStateFor(p.id), badgeFactsFor(p.id)]);
        return unlockedIds(data, { level: state.level, badges });
      }),
    );
    const union = new Set<string>();
    for (const s of sets) for (const id of s) union.add(id);
    if (!sameSet(union, unlockedOnPhone.value)) unlockedOnPhone.value = union;
  } catch (e) {
    console.warn('refreshUnlocks', e);
  }
}

let running: Promise<void> | null = null;
let queued: Promise<void> | null = null;

/**
 * Recompute `unlockedOnPhone` over every local profile (level from the derived XP state, badges
 * from their own tab) and load `unlocks.disabled`. After settleXp (src/xp.ts) and at boot. Calls
 * that arrive while one runs are coalesced into one more run afterwards. Never throws.
 */
export function refreshUnlocks(): Promise<void> {
  if (!running) {
    running = doRefresh().finally(() => {
      running = null;
    });
    return running;
  }
  if (!queued) {
    queued = running.then(() => {
      queued = null;
      return refreshUnlocks();
    });
  }
  return queued;
}

/** Unlocked on this phone (by any local profile) and not switched off here. */
export function isActive(id: string): boolean {
  return unlockedOnPhone.value.has(id) && !disabledUnlocks.value.has(id);
}

/** The `value`s of the active unlocks of one kind, in file order; none with badges off (§1, §1g). */
function activeValues(kind: Unlock['kind']): string[] {
  if (!badgesEnabled.value) return [];
  return unlockData()
    .filter((u) => u.kind === kind && isActive(u.id))
    .map((u) => u.value);
}

/** The confetti rotation of celebrate(): ['default', …values of the active confetti unlocks]. */
export function activeConfettiStyles(): string[] {
  return ['default', ...activeValues('confetti')];
}

/**
 * The timer-sound picker: the four base sounds + the active unlocked ones (file order). Badges off
 * = the base four; an already chosen unlocked sound still plays (src/sounds.ts reads `timer.sound`).
 */
export function activeTimerSounds(): TimerSound[] {
  const extra = activeValues('timerSound').filter((v) => !(BASE_TIMER_SOUNDS as readonly string[]).includes(v));
  return [...BASE_TIMER_SOUNDS, ...(extra as TimerSound[])];
}

/**
 * The cook-mode typeface picker: 'default' + the active unlocked typefaces. Badges off = only
 * 'default'; to APPLY an already chosen typeface read `cook.font` itself (§1g: it keeps working).
 */
export function activeFonts(): CookFont[] {
  const extra = activeValues('cookFont').filter((v): v is Exclude<CookFont, 'default'> => UNLOCKABLE_FONTS.has(v));
  return ['default', ...extra];
}

// Serialized: two quick switches (or a switch and an announcement) never read the same old list.
let writes: Promise<unknown> = Promise.resolve();

/**
 * Switch one unlock on or off on this phone (setting `unlocks.disabled`). Switching off the timer
 * sound that is chosen sets `timer.sound` back to 'beeps' (and `timer.soundLast`, when the timer is
 * muted with that sound as the last choice); switching off the chosen cook-mode
 * typeface sets `cook.font` back to 'default' (§1f, §1g).
 */
export function setUnlockEnabled(id: string, on: boolean): Promise<void> {
  const run = writes.then(async () => {
    await loadDisabled();
    const next = new Set(disabledUnlocks.value);
    if (on) next.delete(id);
    else next.add(id);
    disabledUnlocks.value = next;
    await setSetting(DISABLED_SETTING, [...next]);
    if (!on) await fallBackFrom(id);
  });
  writes = run.catch(() => undefined);
  return run;
}

/** A switched-off unlock that is the chosen timer sound or typeface gives way to the standard one. */
async function fallBackFrom(id: string): Promise<void> {
  const u = unlockData().find((x) => x.id === id);
  if (!u) return;
  if (u.kind === 'timerSound') {
    // Also when the timer is muted with it as the last choice: the 🔔 must not bring it back.
    await dropTimerSound(u.value as TimerSound);
  } else if (u.kind === 'cookFont') {
    const font = await getSetting<unknown>(COOK_FONT_SETTING, 'default');
    if (font === u.value) await setSetting(COOK_FONT_SETTING, 'default');
  }
}

/**
 * For the level-up sheet (§1d): the unlocks of the levels (from, to] and of `badges` (at their
 * reached tier) that this member was not shown yet, in file order; records them in
 * `unlocks.announced` so they are never announced twice. A failure is logged and gives [].
 */
export function announceUnlocks(memberId: string, from: number, to: number, badges: XpBadgeFact[]): Promise<Unlock[]> {
  const run = writes.then(async (): Promise<Unlock[]> => {
    try {
      const data = unlockData();
      const wanted = new Set<string>();
      for (const u of unlocksForLevels(data, from, to)) wanted.add(u.id);
      for (const b of badges) for (const u of unlocksForBadge(data, b)) wanted.add(u.id);
      if (wanted.size === 0) return [];
      const announced = normalizeAnnounced(await getSetting<unknown>(ANNOUNCED_SETTING, {}));
      const shown = announced[memberId] ?? [];
      const done = new Set(shown);
      const fresh = data.filter((u) => wanted.has(u.id) && !done.has(u.id));
      if (fresh.length) {
        announced[memberId] = [...shown, ...fresh.map((u) => u.id)];
        await setSetting(ANNOUNCED_SETTING, announced);
      }
      return fresh;
    } catch (e) {
      console.warn('announceUnlocks', e);
      return [];
    }
  });
  writes = run.catch(() => undefined);
  return run;
}
