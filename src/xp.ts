// XP app layer (docs/specs/xp-levels.md §2a, §2g, §3 block 6D-1; pattern of src/badges.ts).
//
// XP is DERIVED, never added up or stored: `deriveXp` (src/domain/xp.ts) recomputes the whole state
// from what is in the database anyway (cook log, photos, own recipes, earned badges). This module
// builds those facts per member, memoises the result in the `xpStates` signal, and turns a
// "reward moment" into pops, a level-up sheet and an honest 0-XP toast (`settleXp`).
//
// Reward moments (the seven of §5.11) call `settleXp(memberId)`: recordCooked, CookScreen.onCooked,
// CookedSheet rating/photo, CookScreen.onPhotoPicked, RecipeScreen.onPhotoFile, EditScreen saving an
// own recipe, and checkNewBadges after a new badge. Never from a mount effect or `useLive`.
//
// What a settle compares with: the state of this member as it was last settled (`baseline`, in
// memory) and the setting `xp.lastSeen` (total + level as last shown). At boot `checkRulesVersion`
// settles every local profile quietly, and after a restore `reloadXp` does the same, so a silent
// recalculation (start-up, restore, a rules change, 13F) never pops and never opens the sheet.
//
// Badges off (`badges.enabled` false): nothing here is visible. A settle then still records the new
// state quietly (no pops, no sheet, no toast), so turning badges back on shows the same level and
// the next action pops only that action — nothing "lost", nothing flooding in.
import { signal, type Signal } from '@preact/signals';
import { badgesEnabled, badgeStatuses, loadBadgeSettings } from '@/badges';
import { allRecipes, getSetting, listAllPhotosMeta, listCookLog, listProfiles, setSetting } from '@/db/repo';
import { hasLang, type Recipe } from '@/domain/model';
import {
  deriveXp,
  diffXp,
  XP_RULES_VERSION,
  type Crit,
  type XpDelta,
  type XpEventKind,
  type XpFacts,
  type XpRecipeFact,
  type XpState,
} from '@/domain/xp';
import { localDayIndex } from '@/domain/days';

/** Setting `xp.seenRulesVersion` (number): the rules version the user was last told about (§1e). */
export const XP_SEEN_RULES_SETTING = 'xp.seenRulesVersion';
/** Setting `xp.lastSeen`: Record<memberId, { total, level }> as last shown (§2g). */
export const XP_LAST_SEEN_SETTING = 'xp.lastSeen';

/**
 * Placeholder for the unlock type of block 6D-3 (src/domain/unlocks.ts, docs/specs/xp-levels.md
 * §2e; same shape). 6D-1 announces no unlocks, so `LevelUpInfo.unlocked` is always empty here;
 * 6D-3 replaces this with an import from '@/domain/unlocks'.
 */
export interface Unlock {
  id: string;
  kind: 'confetti' | 'timerSound' | 'cookedSound' | 'cookFont' | 'feature';
  by: { level: number } | { badge: string; level?: number };
  icon: string;
  value: string;
  nl: { name: string; description: string };
  en: { name: string; description: string };
}

/** One "+12" chip in the queue of <XpPop/>; `sumAfter` = the series' total, on its last pop only (≥ 2 pops). */
export interface XpPopItem {
  id: number;
  xp: number;
  crit: Crit | null;
  kind: XpEventKind;
  sumAfter?: number;
}

/** What <LevelUpSheet/> shows: from → to (several levels at once = one sheet for the highest). */
export interface LevelUpInfo {
  memberId: string;
  from: number;
  to: number;
  /** Empty in 6D-1; 6D-3 fills it via announceUnlocks. */
  unlocked: Unlock[];
}

/** Derived XP state per memberId (memoised; `xpStateFor` fills it). */
export const xpStates: Signal<ReadonlyMap<string, XpState>> = signal<ReadonlyMap<string, XpState>>(new Map());
/** Queue for <XpPop/>; the component shows them in order and calls `dismissXpPop(id)`. */
export const xpPops: Signal<XpPopItem[]> = signal<XpPopItem[]>([]);
/** The level-up to show after the last pop, or null. */
export const levelUp: Signal<LevelUpInfo | null> = signal<LevelUpInfo | null>(null);
/** i18n key of the 0-XP note to toast ('xp.busyWeek' | 'xp.dayCap' | 'xp.rulesChanged'), or null. */
export const xpToast: Signal<string | null> = signal<string | null>(null);

// ---------------------------------------------------------------------------- facts

/** Copy of `foldName` in src/domain/household.ts: trimmed, accents removed (NFKD), lower case. */
function foldName(s: string): string {
  return s.trim().normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Name in both languages and every step in both languages (§3: 15 XP instead of 10). */
function isBilingual(r: Recipe): boolean {
  return hasLang(r.name, 'nl') && hasLang(r.name, 'en') && r.steps.every((s) => hasLang(s.text, 'nl') && hasLang(s.text, 'en'));
}

/**
 * The XP facts of one member: their cook log and photos, every recipe's ingredient-line count
 * (headers excluded), their own recipes (origin 'user', author = this profile's name folded, no
 * `variantOf` and no `origin.basedOn`) and the badges earned on their OWN tab. Since 6D-2a every
 * earned badge is `{ id, level: tier, secret: hidden, xp: Badge.xp }` (§2f: ladder 50·k per reached
 * tier, one-off `xp ?? (hidden ? 250 : 50)`). The badges are evaluated WITHOUT this member's XP
 * state (`{ xp: false }`): badgeStatuses would otherwise ask xpStateFor for the state being derived
 * right here and wait for itself; a registered `overcooked` badge still counts (sticky).
 */
export async function buildXpFacts(memberId: string): Promise<XpFacts> {
  const [recipes, log, photos, profiles, statuses] = await Promise.all([
    allRecipes(),
    listCookLog(),
    listAllPhotosMeta(),
    listProfiles(),
    badgeStatuses(memberId, { xp: false }),
  ]);
  const lines = new Map<string, XpRecipeFact>();
  for (const r of recipes) {
    let n = 0;
    for (const l of r.lines) if (l.kind !== 'header') n++;
    lines.set(r.id, { lines: n });
  }
  const profile = profiles.find((p) => p.id === memberId);
  const me = profile ? foldName(profile.name) : '';
  const ownRecipes = me
    ? recipes
        .filter((r) => r.origin.kind === 'user' && typeof r.origin.author === 'string' && foldName(r.origin.author) === me && !r.variantOf && !r.origin.basedOn)
        .map((r) => ({ id: r.id, bilingual: isBilingual(r) }))
    : [];
  return {
    log: log.filter((e) => e.profileId === memberId),
    recipes: lines,
    photos: photos.filter((p) => p.memberId === memberId).map((p) => ({ recipeId: p.recipeId, at: p.at })),
    ownRecipes,
    badges: statuses.filter((s) => s.earned).map((s) => ({ id: s.badge.id, level: s.tier, secret: s.badge.hidden === true, xp: s.badge.xp })),
  };
}

// ---------------------------------------------------------------------------- memo

/** Members whose memoised state is out of date (a write that touches XP happened). */
const dirty = new Set<string>();
/** Local day each memoised state was derived on (the streak depends on "today"). */
const memoDay = new Map<string, number>();
/** Latest computation per member; an older one finishing later never overwrites a newer result. */
const generation = new Map<string, number>();
const inflight = new Map<string, Promise<XpState>>();

function recompute(memberId: string): Promise<XpState> {
  dirty.delete(memberId);
  const gen = (generation.get(memberId) ?? 0) + 1;
  generation.set(memberId, gen);
  const today = localDayIndex(new Date());
  const run = buildXpFacts(memberId)
    .then((facts) => {
      const state = deriveXp(facts, undefined, today);
      if (generation.get(memberId) === gen) {
        memoDay.set(memberId, today);
        const next = new Map(xpStates.value);
        next.set(memberId, state);
        xpStates.value = next;
      }
      return state;
    })
    .finally(() => {
      if (inflight.get(memberId) === run) inflight.delete(memberId);
    });
  inflight.set(memberId, run);
  return run;
}

/** The derived state of one member: memoised, recomputed when it was marked dirty (or on a new day). */
export function xpStateFor(memberId: string): Promise<XpState> {
  if (!dirty.has(memberId)) {
    const running = inflight.get(memberId);
    if (running) return running;
    const cached = xpStates.value.get(memberId);
    if (cached && memoDay.get(memberId) === localDayIndex(new Date())) return Promise.resolve(cached);
  }
  return recompute(memberId);
}

/** After every write that touches XP (cook log, photo, recipe, badges); no id = every member. */
export function markXpDirty(memberId?: string): void {
  if (memberId !== undefined) {
    dirty.add(memberId);
    return;
  }
  for (const id of xpStates.value.keys()) dirty.add(id);
  for (const id of inflight.keys()) dirty.add(id);
}

// ---------------------------------------------------------------------------- settle

/** The state of each member as it was last settled (the breakdown of the next diff). */
const baseline = new Map<string, XpState>();

interface LastSeen {
  total: number;
  level: number;
}

function normalizeLastSeen(v: unknown): Record<string, LastSeen> {
  const out: Record<string, LastSeen> = {};
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    for (const [id, s] of Object.entries(v as Record<string, unknown>)) {
      const o = s as { total?: unknown; level?: unknown } | null;
      if (o && typeof o === 'object' && typeof o.total === 'number' && Number.isFinite(o.total) && typeof o.level === 'number' && Number.isFinite(o.level)) {
        out[id] = { total: o.total, level: o.level };
      }
    }
  }
  return out;
}

/** Pops that arrive within this window of a series' start join it (one series, one sum line). */
const MERGE_MS = 2000;
let series: { startedAt: number; sum: number; count: number; lastId: number } | null = null;
let nextPopId = 1;

function queuePops(pops: XpDelta['pops']): void {
  if (!pops.length) return;
  const now = Date.now();
  const join = series !== null && now - series.startedAt <= MERGE_MS;
  const s = join && series ? series : { startedAt: now, sum: 0, count: 0, lastId: 0 };
  const items: XpPopItem[] = pops.map((p) => ({ id: nextPopId++, xp: p.xp, crit: p.crit, kind: p.kind }));
  for (const it of items) s.sum += it.xp;
  s.count += items.length;
  // Only the last pop of a series carries the sum line: take it off the previous last one.
  const queue = join ? xpPops.value.map((q) => (q.id === s.lastId && q.sumAfter !== undefined ? { id: q.id, xp: q.xp, crit: q.crit, kind: q.kind } : q)) : xpPops.value;
  const last = items[items.length - 1]!;
  if (s.count >= 2) last.sumAfter = s.sum;
  s.lastId = last.id;
  series = s;
  xpPops.value = [...queue, ...items];
}

function announceLevelUp(memberId: string, from: number, to: number): void {
  if (to <= from) return;
  const open = levelUp.value;
  // Several level-ups before the sheet was closed = one sheet for the highest level (§1d).
  if (open && open.memberId === memberId) {
    levelUp.value = { memberId, from: Math.min(open.from, from), to: Math.max(open.to, to), unlocked: [...open.unlocked] };
  } else {
    levelUp.value = { memberId, from, to, unlocked: [] };
  }
}

// Serialized like checkNewBadges: two quick reward moments never read the same old baseline.
let settling: Promise<unknown> = Promise.resolve();

/**
 * Reward moment: recompute, compare with the last settled state / `xp.lastSeen`, fill the pops,
 * the level-up and the 0-XP toast, and write `xp.lastSeen`. `quiet` = only record the new state
 * (also what happens with badges off). Returns the delta, or null when quiet.
 */
export function settleXp(memberId: string, opts?: { quiet?: boolean }): Promise<XpDelta | null> {
  const run = settling.then(() => doSettle(memberId, opts?.quiet === true));
  settling = run.catch(() => undefined);
  return run;
}

async function doSettle(memberId: string, quietAsked: boolean): Promise<XpDelta | null> {
  await loadBadgeSettings();
  const quiet = quietAsked || !badgesEnabled.value;
  const [next, seenRaw] = await Promise.all([recompute(memberId), getSetting<unknown>(XP_LAST_SEEN_SETTING, {})]);
  const lastSeen = normalizeLastSeen(seenRaw);
  const prev = baseline.get(memberId) ?? null;
  const seen = lastSeen[memberId];
  baseline.set(memberId, next);
  if (!seen || seen.total !== next.total || seen.level !== next.level) {
    lastSeen[memberId] = { total: next.total, level: next.level };
    await setSetting(XP_LAST_SEEN_SETTING, lastSeen);
  }
  if (quiet) return null;
  let delta: XpDelta;
  if (prev !== null || seen === undefined) {
    // The breakdown: every new event its own pop (crits included). No baseline and nothing seen
    // = a member new since boot: all their events come from this action.
    delta = diffXp(prev, next);
  } else {
    // No baseline in memory (boot priming did not run): only the total as last shown is known,
    // so the difference becomes one plain pop.
    const amount = Math.max(0, next.total - seen.total);
    const kind = next.events.length ? next.events[next.events.length - 1]!.kind : 'cook';
    delta = { amount, pops: amount > 0 ? [{ xp: amount, crit: null, kind }] : [], levelFrom: seen.level, levelTo: next.level, zeroReasons: [] };
  }
  queuePops(delta.pops);
  announceLevelUp(memberId, delta.levelFrom, delta.levelTo);
  // §1e: a cook that got 0 XP from the busy-week rule or the day cap says so; sameRecipe and
  // backdated stay silent (the sheet said it already).
  if (delta.zeroReasons.includes('busyWeek')) xpToast.value = 'xp.busyWeek';
  else if (delta.zeroReasons.includes('dayCap')) xpToast.value = 'xp.dayCap';
  return delta;
}

/** After a restore: everything dirty, then a quiet settle of every local profile (no pops, no sheet). */
export async function reloadXp(): Promise<void> {
  markXpDirty();
  baseline.clear();
  memoDay.clear();
  xpStates.value = new Map();
  const profiles = await listProfiles();
  await Promise.all(profiles.map((p) => settleXp(p.id, { quiet: true })));
}

/**
 * Once at boot (app.tsx, after loadBadgeSettings): a stored `xp.seenRulesVersion` lower than
 * XP_RULES_VERSION toasts `xp.rulesChanged` once; the setting is then brought up to date (first
 * start: only the setting). With badges off nothing is said and the setting waits, so the note
 * comes the first start with badges on. Then every local profile is settled quietly, so the
 * recalculation itself never pops.
 */
export async function checkRulesVersion(): Promise<void> {
  try {
    await loadBadgeSettings();
    if (badgesEnabled.value) {
      const seen = await getSetting<unknown>(XP_SEEN_RULES_SETTING, null);
      if (typeof seen === 'number' && seen < XP_RULES_VERSION) xpToast.value = 'xp.rulesChanged';
      if (seen !== XP_RULES_VERSION) await setSetting(XP_SEEN_RULES_SETTING, XP_RULES_VERSION);
    }
    const profiles = await listProfiles();
    await Promise.all(profiles.map((p) => settleXp(p.id, { quiet: true })));
  } catch (e) {
    console.warn('checkRulesVersion', e);
  }
}

/** <XpPop/> is done with this pop: drop it from the queue. */
export function dismissXpPop(id: number): void {
  xpPops.value = xpPops.value.filter((p) => p.id !== id);
}

/** <LevelUpSheet/> was closed. */
export function clearLevelUp(): void {
  levelUp.value = null;
}
