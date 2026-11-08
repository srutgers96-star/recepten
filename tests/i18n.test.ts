// The UI dictionaries (CLAUDE.md "every UI string exists in both languages"; docs/specs/opschoonronde.md
// §2A.1, §2A.3, §2A.5): every key has a Dutch and an English string, the composed families stay, and
// the new keys of 13c (levelup.moreParts and the …One sisters) exist in both.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tIn } from '../src/i18n';
import { avatar } from '../src/i18n/avatar';
import { badges } from '../src/i18n/badges';
import { browse } from '../src/i18n/browse';
import { common } from '../src/i18n/common';
import { edit } from '../src/i18n/edit';
import type { Dict } from '../src/i18n/index';
import { phase2 } from '../src/i18n/phase2';
import { settings } from '../src/i18n/settings';
import { shopping } from '../src/i18n/shopping';
import { variants } from '../src/i18n/variants';
import { week } from '../src/i18n/week';
import { xp } from '../src/i18n/xp';

const DICTS: Record<string, Dict> = { common, browse, edit, settings, phase2, week, shopping, badges, variants, avatar, xp };
const ALL: Dict = Object.assign({}, ...Object.values(DICTS)) as Dict;

/** New in 13c: the level-up button and the singular sisters (§2A.2, §2A.3). */
const ADDED = [
  'levelup.moreParts', 'badges.secretCountOne', 'more.householdValueOne', 'progress.cookDays30One', 'progress.streakBadgesOne',
  'checkRecipes.doneOne', 'inbox.lineCountOne', 'select.deletedOne', 'select.metaAppliedOne', 'shop.list.receivedOne', 'shop.list.putSnackOne',
];

/** The hints under the More switches that stayed: one short sentence (§2A.1, ±60 characters). */
const SHORT_HINTS = [
  'more.badgesHint', 'more.readAloudHint', 'more.voiceCommandsHint', 'more.timerVibrateHint', 'more.timerSoundIOSHint',
  'more.experimentsHint', 'more.storageHint', 'more.sendNewHint', 'more.dictHint', 'more.linksHint', 'more.styleHint',
  'more.householdRowHint', 'more.checkRecipesHint', 'more.inboxHint', 'more.donateHint',
];

describe('i18n dictionaries', () => {
  it('every key has a Dutch and an English string', () => {
    for (const [file, dict] of Object.entries(DICTS)) {
      for (const [key, entry] of Object.entries(dict)) {
        expect(typeof entry.nl, `${file}: ${key} nl`).toBe('string');
        expect(typeof entry.en, `${file}: ${key} en`).toBe('string');
      }
    }
  });

  it('the families that are composed at run time keep their keys', () => {
    for (const key of ['more.theme.system', 'more.theme.light', 'more.theme.dark', 'search.name', 'search.ingredient', 'search.category', 'search.tag', 'inbox.field.name', 'dict.missingField.lactose']) {
      expect(ALL[key], key).toBeDefined();
    }
  });

  it('the new keys of 13c exist in both languages', () => {
    for (const key of ADDED) {
      expect(ALL[key]?.nl, key).toBeTruthy();
      expect(ALL[key]?.en, key).toBeTruthy();
    }
    expect(ALL['badges.secretCountOne']).toEqual({ nl: '1 geheime badge gevonden', en: '1 secret badge found' });
    expect(ALL['progress.cookDays30One']?.nl).toMatch(/^1 kookdag /);
    expect(ALL['levelup.moreParts']).toEqual({ nl: 'Toon alle {n} nieuwe avatar-onderdelen', en: 'Show all {n} new avatar parts' });
  });

  it('the hints that stayed are one short sentence in both languages', () => {
    for (const key of SHORT_HINTS) {
      for (const l of ['nl', 'en'] as const) {
        const text = ALL[key]?.[l] ?? '';
        expect(text.length, `${key} ${l}: ${text}`).toBeGreaterThan(0);
        expect(text.length, `${key} ${l}: ${text}`).toBeLessThanOrEqual(62);
        expect(text.replace(/\.$/, ''), `${key} ${l}: one sentence`).not.toMatch(/[.:]\s/);
      }
    }
  });
});

// The singular rule of t/tIn (13c follow-up): with `n === 1` a sister `key + 'One'` wins when it exists.
describe('singular rule in t and tIn', () => {
  it('a key with a …One sister gives the sister at n=1 and the plural at n=2, in NL and EN', () => {
    expect(tIn('nl', 'storage.changes', { n: 1 })).toBe('1 wijziging');
    expect(tIn('en', 'storage.changes', { n: 1 })).toBe('1 change');
    expect(tIn('nl', 'storage.changes', { n: 2 })).toBe('2 wijzigingen');
    expect(tIn('en', 'storage.changes', { n: 2 })).toBe('2 changes');
  });

  it('a key without a sister is unchanged at n=1', () => {
    expect(ALL['checkRecipes.countOne']).toBeUndefined();
    expect(tIn('nl', 'checkRecipes.count', { n: 1, m: 5 })).toBe('1 van 5 recepten wijken af');
    expect(tIn('en', 'checkRecipes.count', { n: 1, m: 5 })).toBe('1 of 5 recipes differ');
  });

  it('a sister with other placeholders interpolates them', () => {
    expect(tIn('nl', 'inbox.plan.title', { name: 'Anna', n: 1 })).toBe('Weekplan van Anna: 1 gerecht');
    expect(tIn('en', 'inbox.plan.title', { name: 'Anna', n: 1 })).toBe('Week plan from Anna: 1 dish');
    expect(tIn('nl', 'shop.list.putSnack', { n: 1, m: 3 })).toBe('1 regel op je lijst gezet, 3 al aanwezig');
    expect(tIn('en', 'shop.list.putSnack', { n: 4, m: 1 })).toBe('4 lines put on your list, 1 already there');
  });
});

// Dead keys must not come back (13c §2A.5). A key counts as used when src/ (outside src/i18n) has it as a
// literal ('key', "key", `key`), when its prefix up to the last dot is composed ('prefix.' + x or
// `prefix.${x}`), or when it is the …One sister of a used key. ALLOWED holds the few keys that are used in
// a way this scan cannot see; each has a reason.
const ALLOWED: Record<string, string> = {
  // (empty on 8 Nov 2026: shop.lines / shop.lineOne were removed instead of allowed)
};

function sourceText(dir: string): string {
  let out = '';
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (p !== join('src', 'i18n')) out += sourceText(p);
    } else if (/\.tsx?$/.test(e.name)) out += readFileSync(p, 'utf8') + '\n';
  }
  return out;
}

describe('no unused i18n keys', () => {
  it('every key is used somewhere in src/', () => {
    const src = sourceText('src');
    const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const literal = (k: string) => src.includes(`'${k}'`) || src.includes(`"${k}"`) || src.includes('`' + k + '`');
    const composed = (k: string) => {
      const i = k.lastIndexOf('.');
      if (i < 0) return false;
      const p = esc(k.slice(0, i + 1));
      return new RegExp(`(['"])${p}\\1\\s*\\+|\`${p}\\$\\{`).test(src);
    };
    const used = (k: string) => literal(k) || composed(k);
    const unused = Object.keys(ALL).filter(
      (k) => !used(k) && !(k.endsWith('One') && used(k.slice(0, -3))) && !(k in ALLOWED),
    );
    expect(unused).toEqual([]);
  });
});
