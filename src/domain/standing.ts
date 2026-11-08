// The standing shopping list ("Vaste lijst" / "Every week", docs/specs/vaste-lijst.md §2–§3): what
// you buy every week, with or without a week plan. One list per phone (= per household), stored as
// the setting 'standing.list' by src/db/repo.ts. Framework-free: no preact, no dexie, nothing from
// src/db (the list shape absorbPins reads is the local `ListLike`).
import type { Dictionary, Ingredient } from './dictionary.ts';
import { effectiveQty, itemName, renderListItem, type ListItem } from './aggregate.ts';
import { pickText, randomId, type Lang, type Text } from './model.ts';

// --- Types --------------------------------------------------------------------------------------

export interface StandingItem {
  /** 's:' + 8 characters [a-z0-9] (randomId('s:')). Never changes. */
  id: string;
  /** Dictionary id, or null for free text. */
  ing: string | null;
  /** Free text when ing is null; {nl,en}, either side may be empty (invariant 3). */
  label?: Text;
  /** Usual amount in display units; null = no number ("melk"). Never 0. */
  qty: number | null;
  /** Unit id, usually from STANDING_UNITS; null = pieces. A typed or adopted unit outside that list
   *  ('el', 'dl', 'bos') stays as it is (decision C); normalizeStandingList only requires string | null. */
  unit: string | null;
  /** Aisle id, fixed when added: the dictionary item's, or (free text) what ExtraField passes
   *  ('overig', or the aisle of a near hit: "doos eieren" -> 'zuivel-eieren'). */
  aisle: string;
  /** false = "Even niet meenemen": kept, but left off the list. */
  enabled: boolean;
  addedAt: string;
}

export interface StandingList {
  v: 1;
  items: StandingItem[];
  updatedAt: string;
}

/** Units of the edit sheet, in this order; every id exists in data/units.json. */
export const STANDING_UNITS: readonly (string | null)[] = [null, 'pot', 'pak', 'fles', 'zak', 'blik', 'g', 'kg', 'ml', 'l'];

/** Step of the edit sheet's stepper (decision A); anything not listed -> 1. */
export const STANDING_STEP: Readonly<Record<string, number>> = { l: 1, kg: 0.5, g: 50, ml: 100 };

/** Fallback aisle for a line without one. */
const OTHER_AISLE = 'overig';

// --- Small helpers ------------------------------------------------------------------------------

export function standingStep(unit: string | null): number {
  return STANDING_STEP[unit ?? ''] ?? 1;
}

/**
 * Label matching key: the same rules as `normalize` in src/components/ExtraField.tsx (NFKD, accents
 * removed, lowercase, trim), copied rather than imported from a component. Deliberately not
 * `normalizeKey` from dictionary.ts, which does more (spec §3).
 */
function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function labelKeys(label: Text | undefined): string[] {
  const out: string[] = [];
  for (const side of [label?.nl, label?.en]) {
    if (typeof side !== 'string') continue;
    const k = normalize(side);
    if (k) out.push(k);
  }
  return out;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function cleanText(v: unknown): Text | undefined {
  if (!isObject(v)) return undefined;
  const t: Text = {};
  if (typeof v.nl === 'string') t.nl = v.nl;
  if (typeof v.en === 'string') t.en = v.en;
  return t.nl !== undefined || t.en !== undefined ? t : undefined;
}

function hasText(t: Text | undefined): boolean {
  return labelKeys(t).length > 0;
}

// --- Construction & normalisation ---------------------------------------------------------------

export function emptyStandingList(): StandingList {
  return { v: 1, items: [], updatedAt: '' };
}

/**
 * Anything that may sit in the setting -> a valid StandingList. Invalid items drop (no 's:' id, a
 * repeated id, or neither a dictionary id nor label text); qty that is not a positive finite number
 * becomes null; unit must be string | null (anything else -> null); aisle must be a string ('overig'
 * otherwise); enabled defaults to true; unknown fields drop; `v` is always 1.
 */
export function normalizeStandingList(v: unknown): StandingList {
  if (!isObject(v)) return emptyStandingList();
  const items: StandingItem[] = [];
  const seen = new Set<string>();
  const raw: unknown[] = Array.isArray(v.items) ? v.items : [];
  for (const r of raw) {
    if (!isObject(r)) continue;
    const id = r.id;
    if (typeof id !== 'string' || !id.startsWith('s:') || id.length <= 2 || seen.has(id)) continue;
    const ing = typeof r.ing === 'string' && r.ing.trim() !== '' ? r.ing : null;
    const label = cleanText(r.label);
    if (ing === null && !hasText(label)) continue;
    const qty = typeof r.qty === 'number' && Number.isFinite(r.qty) && r.qty > 0 ? r.qty : null;
    const unit = typeof r.unit === 'string' && r.unit !== '' ? r.unit : null;
    const aisle = typeof r.aisle === 'string' ? r.aisle : OTHER_AISLE;
    const enabled = typeof r.enabled === 'boolean' ? r.enabled : true;
    const addedAt = typeof r.addedAt === 'string' ? r.addedAt : '';
    const item: StandingItem = { id, ing, qty, unit, aisle, enabled, addedAt };
    if (ing === null && label) item.label = label;
    seen.add(id);
    items.push(item);
  }
  return { v: 1, items, updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : '' };
}

export function newStandingId(): string {
  return randomId('s:');
}

export function standingKey(id: string): string {
  return 's|' + id.slice(2);
}

export function isStandingKey(key: string): boolean {
  return /^s\|/.test(key);
}

/**
 * The unit a dictionary item gets on the standing list when none was typed: (1) its buyUnit when
 * that is a standing unit (pindakaas -> 'pot'); (2) the first gramsPer key that is a package unit and
 * a standing unit (boter -> 'pak'); (3) from defaultUnit: ml -> l, g -> g, kg -> kg, l -> l; anything
 * else (stuk, el, teen, none, unknown ingredient) -> null (pieces).
 */
export function defaultStandingUnit(ing: Ingredient | undefined, dict: Dictionary): string | null {
  if (!ing) return null;
  if (ing.buyUnit && STANDING_UNITS.includes(ing.buyUnit)) return ing.buyUnit;
  for (const id of Object.keys(ing.gramsPer ?? {})) {
    if (dict.unit(id)?.group === 'package' && STANDING_UNITS.includes(id)) return id;
  }
  switch (ing.defaultUnit) {
    case 'ml':
    case 'l':
      return 'l';
    case 'g':
      return 'g';
    case 'kg':
      return 'kg';
    default:
      return null;
  }
}

/** The list line of a standing item (section 'main', sources [], standing true, aisle 'overig' when empty). */
export function standingToListItem(s: StandingItem): ListItem {
  const it: ListItem = {
    key: standingKey(s.id),
    ing: s.ing,
    qty: s.qty,
    unit: s.unit,
    aisle: s.aisle || OTHER_AISLE,
    section: 'main',
    sources: [],
    standing: true,
  };
  if (s.label) it.label = { ...s.label };
  return it;
}

/**
 * A standing item from a list line ("Zet op de vaste lijst" and the pin migration); null for a
 * 'check' line (and for a line with neither a dictionary id nor label text). Variant qualifiers
 * ("rode") drop: the item is the ingredient.
 */
export function standingFromListItem(it: ListItem, now: string): StandingItem | null {
  if (it.section === 'check') return null;
  const ing = typeof it.ing === 'string' && it.ing !== '' ? it.ing : null;
  const label = ing === null ? cleanText(it.label) : undefined;
  if (ing === null && !hasText(label)) return null;
  const eff = effectiveQty(it);
  const s: StandingItem = {
    id: newStandingId(),
    ing,
    qty: eff !== null && eff > 0 ? eff : null,
    unit: it.unit ?? null,
    aisle: it.aisle || OTHER_AISLE,
    enabled: true,
    addedAt: now,
  };
  if (label) s.label = label;
  return s;
}

/** Same ingredient or (free text) the same normalised label text in either language. */
export function findSameStanding(items: readonly StandingItem[], probe: Pick<StandingItem, 'ing' | 'label'>): StandingItem | undefined {
  if (probe.ing) return items.find((s) => s.ing === probe.ing);
  const keys = labelKeys(probe.label);
  if (keys.length === 0) return undefined;
  return items.find((s) => s.ing === null && labelKeys(s.label).some((k) => keys.includes(k)));
}

// --- Pin migration ------------------------------------------------------------------------------

/** Local type (no import from src/db): the two fields of List that absorbPins reads. */
export type ListLike = { items: ListItem[]; extras: ListItem[] };

/**
 * Moves the old "Elke week" pins onto the standing list (spec §2 "Migratie"). Per pinned line in
 * `items` or `extras` (once per key): a standing item via standingFromListItem, unless one with the
 * same ing / label already exists; a new 's|' line takes the old line's checked / inHouse / adjusted;
 * a pinned manual line (extra) leaves `items` and `extras`, a pinned generated line stays but loses
 * `pinned`. A pin whose item is already on the standing list only loses `pinned` (no duplicate).
 * Idempotent: a second run moves 0. Without pins the result equals the input.
 */
export function absorbPins(
  standing: StandingList,
  list: ListLike,
  now: string,
): { standing: StandingList; items: ListItem[]; extras: ListItem[]; moved: number } {
  const pinned = new Map<string, ListItem>();
  for (const it of [...list.items, ...list.extras]) if (it.pinned && !pinned.has(it.key)) pinned.set(it.key, it);
  if (pinned.size === 0) return { standing, items: [...list.items], extras: [...list.extras], moved: 0 };

  const sItems = [...standing.items];
  // Old key -> the new 's|' line (absent when nothing new was created for that pin).
  const created = new Map<string, ListItem>();
  // Old keys whose pin is handled (moved, or the same item already on the standing list).
  const handled = new Set<string>();
  for (const [key, it] of pinned) {
    const s = standingFromListItem(it, now);
    if (!s) continue; // a 'check' line: nothing to move, left as it is
    handled.add(key);
    if (findSameStanding(sItems, s)) continue; // no duplicates on the standing list
    sItems.push(s);
    const line = standingToListItem(s);
    if (it.checked) line.checked = true;
    if (it.inHouse) {
      line.inHouse = true;
      line.section = 'inHouse';
    }
    if (typeof it.adjusted === 'number' && Number.isFinite(it.adjusted) && it.adjusted !== 0) line.adjusted = it.adjusted;
    created.set(key, line);
  }

  const items: ListItem[] = [];
  const placed = new Set<string>();
  for (const it of list.items) {
    if (!handled.has(it.key)) {
      items.push(it);
      continue;
    }
    const line = created.get(it.key);
    if (it.manual) {
      // The standing line replaces the extra.
      items.push(line ?? unpin(it));
    } else {
      // The recipe still needs this line; the standing line comes next to it.
      items.push(unpin(it));
      if (line) items.push(line);
    }
    if (line) placed.add(it.key);
  }
  for (const [key, line] of created) if (!placed.has(key)) items.push(line);

  const extras: ListItem[] = [];
  for (const x of list.extras) {
    if (!handled.has(x.key)) extras.push(x);
    else if (!created.has(x.key)) extras.push(unpin(x));
    // else: moved to the standing list, the extra goes
  }

  const moved = created.size;
  return { standing: moved > 0 ? { v: 1, items: sItems, updatedAt: now } : standing, items, extras, moved };
}

function unpin(it: ListItem): ListItem {
  const copy = { ...it };
  delete copy.pinned;
  return copy;
}

// --- Backup merge -------------------------------------------------------------------------------

/**
 * Union on id; on an equal id the local item wins; an incoming item with the same ing (or the same
 * normalised label text) as an item already kept is skipped; updatedAt = the newest. Restoring the
 * other phone's backup never wipes this phone's list.
 */
export function mergeStandingLists(local: StandingList, incoming: StandingList): StandingList {
  const items = [...local.items];
  const ids = new Set(items.map((s) => s.id));
  for (const s of incoming.items) {
    if (ids.has(s.id)) continue;
    if (findSameStanding(items, s)) continue;
    items.push(s);
    ids.add(s.id);
  }
  const updatedAt = local.updatedAt >= incoming.updatedAt ? local.updatedAt : incoming.updatedAt;
  return { v: 1, items, updatedAt };
}

// --- Display ------------------------------------------------------------------------------------

/** "3 l melk", "1 pot mayonaise", "melk", "postzegels": the list line's text. */
export function renderStandingItem(s: StandingItem, dict: Dictionary, lang: Lang): string {
  return renderListItem(standingToListItem(s), dict, lang);
}

/** Aisle order (dict.aisles) and then name (Intl.Collator per language); paused items last within their aisle. */
export function sortStandingItems(items: readonly StandingItem[], dict: Dictionary, lang: Lang): StandingItem[] {
  const order = new Map<string, number>();
  dict.aisles.forEach((a, idx) => order.set(a.id, idx));
  const collator = new Intl.Collator(lang === 'nl' ? 'nl' : 'en', { sensitivity: 'base' });
  const name = (s: StandingItem) => itemName(standingToListItem(s), dict, lang) || pickText(s.label, lang);
  const aisleId = (s: StandingItem) => s.aisle || OTHER_AISLE;
  return [...items].sort(
    (a, b) =>
      (order.get(aisleId(a)) ?? 999) - (order.get(aisleId(b)) ?? 999) ||
      aisleId(a).localeCompare(aisleId(b)) ||
      Number(!a.enabled) - Number(!b.enabled) ||
      collator.compare(name(a), name(b)),
  );
}
