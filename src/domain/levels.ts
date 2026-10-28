// Level titles (docs/specs/xp-levels.md §2d). Framework-free; the bundled data/levels.json is
// imported the way src/domain/data.ts imports the dictionary files.
import levelsJson from '../../data/levels.json';
import type { Lang } from './model';

export const MAX_LEVEL = 100;

export interface LevelText { title: string; note?: string }
export interface LevelTitle { level: number; nl: LevelText; en: LevelText }

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function fallback(level: number): string {
  return `Level ${level}`;
}

function normalizeText(v: unknown, level: number): LevelText {
  if (!isRecord(v) || typeof v['title'] !== 'string' || v['title'].trim() === '') return { title: fallback(level) };
  const out: LevelText = { title: v['title'].trim() };
  const note = v['note'];
  if (typeof note === 'string' && note.trim() !== '') out.note = note.trim();
  return out;
}

/**
 * Exactly MAX_LEVEL items, level 1…MAX_LEVEL in order. Invalid or missing levels (or a missing
 * language title) get { title: 'Level N' }; the first item for a level wins.
 */
export function normalizeLevels(data: unknown): LevelTitle[] {
  const raw = new Map<number, Record<string, unknown>>();
  if (Array.isArray(data)) {
    for (const item of data) {
      if (!isRecord(item)) continue;
      const level = item['level'];
      if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > MAX_LEVEL) continue;
      if (!raw.has(level)) raw.set(level, item);
    }
  }
  const out: LevelTitle[] = [];
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const item = raw.get(level);
    out.push({ level, nl: normalizeText(item?.['nl'], level), en: normalizeText(item?.['en'], level) });
  }
  return out;
}

let bundled: LevelTitle[] | null = null;

/** The normalized data/levels.json (module cache). */
function bundledLevels(): LevelTitle[] {
  if (bundled === null) bundled = normalizeLevels(levelsJson);
  return bundled;
}

function find(level: number, levels: readonly LevelTitle[]): LevelTitle | undefined {
  const atIndex = levels[level - 1];
  if (atIndex && atIndex.level === level) return atIndex;
  return levels.find((l) => l.level === level);
}

/** Title of `level` in `lang`; 'Level N' for anything without a title (never throws). */
export function titleFor(level: number, lang: Lang, levels: readonly LevelTitle[] = bundledLevels()): string {
  const title = find(level, levels)?.[lang]?.title;
  return typeof title === 'string' && title !== '' ? title : fallback(level);
}

/** The joke/explanation the level-up sheet shows, or null. */
export function noteFor(level: number, lang: Lang, levels: readonly LevelTitle[] = bundledLevels()): string | null {
  const note = find(level, levels)?.[lang]?.note;
  return typeof note === 'string' && note !== '' ? note : null;
}
