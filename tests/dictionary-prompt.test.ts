// collectMissing / buildMissingPrompt / parseMissingAnswer / planMissingAnswer
// (docs/specs/labels-categorieen.md §1f, §3 block 5, §6a).
import { describe, expect, it } from 'vitest';
import aislesJson from '../data/aisles.json';
import { withUserEntries, type Ingredient } from '../src/domain/dictionary';
import {
  buildMissingPrompt,
  collectMissing,
  MISSING_LIMIT,
  missingFieldsOf,
  parseMissingAnswer,
  planMissingAnswer,
  refreshMissingItems,
  type MissingEntryItem,
  type MissingItem,
  type MissingLineItem,
  type MissingSourceRecipe,
} from '../src/domain/dictionary-prompt';
import type { Line } from '../src/domain/model';
import { testDictionary } from './fixtures/test-dictionary';

/** An own entry that is complete unless `extra` takes something away. */
function own(id: string, nl: string, en: string, extra: Partial<Ingredient> = {}): Ingredient {
  return { id, nl: { one: nl }, en: { one: en }, aisle: 'droog', defaultUnit: 'stuk', staple: false, veg: true, vegan: true, gluten: false, lactose: false, ...extra };
}

/** Removes the given keys (a flag that was never set). */
function without(entry: Ingredient, ...keys: string[]): Ingredient {
  const out: Ingredient = { ...entry };
  for (const k of keys) delete out[k];
  return out;
}

function line(raw: string, name: string, extra: Partial<Line> = {}): Line {
  return { raw: { nl: raw }, kind: 'line', ing: null, name, ...extra };
}

/** A line of an English recipe (parseLine with lang 'en': only `raw.en`, an English name). */
function enLine(raw: string, name: string, extra: Partial<Line> = {}): Line {
  return { raw: { en: raw }, kind: 'line', ing: null, name, ...extra };
}

function recipe(id: string, nl: string, lines: Line[]): MissingSourceRecipe {
  return { id, name: { nl }, lines };
}

/** The example of §1f: an own "sultana's" (only a Dutch name: the form copied it) and "2 tl csipetke". */
const sultanas = without(own('sultanas', "sultana's", "sultana's", { aisle: 'overig' }), 'vegan', 'gluten', 'lactose');
const gulyas = recipe('u:gulyas', "Dino's Gulyás", [line('1 ui', 'ui', { ing: 'ui' }), line('2 tl csipetke', 'csipetke')]);

function dictWith(entries: Ingredient[]) {
  return withUserEntries(testDictionary(), entries);
}

describe('missingFieldsOf / collectMissing: own entries', () => {
  it('reports "en" when the English name is only the copy of the Dutch one (case-insensitive), never "nl"', () => {
    // Adjusted for Fable's decision (block 5, "zelfde naam telt als compleet"): the copy is a gap only
    // while the entry has another gap; `own()` is complete, so the copy alone is no longer reported.
    expect(missingFieldsOf(own('rozijn', 'rozijn', 'Rozijn', { aisle: 'overig' }))).toEqual(['en', 'aisle']);
    expect(missingFieldsOf(own('rozijn', 'rozijn', 'Rozijn'))).toEqual([]);
    expect(missingFieldsOf(own('rozijn', 'rozijn', ''))).toEqual(['en']);
    expect(missingFieldsOf(own('rozijn', '', 'raisin'))).toEqual([]);
    expect(missingFieldsOf(own('rozijn', 'rozijn', 'raisin'))).toEqual([]);
  });

  it('an entry without en → missing: [en]', () => {
    // Adjusted for Fable's decision (block 5): an empty English name, since a copy of the Dutch one on
    // an otherwise complete entry counts as confirmed.
    const entry = own('rozijn', 'rozijn', '');
    const items = collectMissing([entry], [], dictWith([entry]));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'entry', missing: ['en'] });
    expect((items[0] as MissingEntryItem).entry).toBe(entry);
  });

  it('the aisle "overig" counts as missing; a missing lactose flag too', () => {
    expect(missingFieldsOf(own('a', 'a-nl', 'a-en', { aisle: 'overig' }))).toContain('aisle');
    expect(missingFieldsOf(own('a', 'a-nl', 'a-en', { aisle: '' }))).toContain('aisle');
    expect(missingFieldsOf(without(own('a', 'a-nl', 'a-en'), 'lactose'))).toEqual(['lactose']);
    expect(missingFieldsOf(sultanas)).toEqual(['en', 'aisle', 'vegan', 'gluten', 'lactose']);
  });

  it('an "unsure" flag is filled in (it shows as "misschien"), only an absent flag is missing', () => {
    expect(missingFieldsOf(own('a', 'a-nl', 'a-en', { vegan: false, gluten: false, glutenUnsure: true, lactose: false, lactoseUnsure: true }))).toEqual([]);
  });

  it('complete entries are left out; own entries come first, sorted by name', () => {
    // Adjusted for Fable's decision (block 5): zz and aa get a second gap, else their copied English
    // name would count as confirmed and they would be complete as well.
    const entries = [own('zz', 'zuurdesem', 'zuurdesem', { aisle: 'overig' }), own('ok', 'oké', 'okay'), without(own('aa', 'Ajowan', 'ajowan'), 'lactose')];
    const items = collectMissing(entries, [gulyas], dictWith(entries));
    expect(items.map((i) => (i.kind === 'entry' ? i.entry.id : i.key))).toEqual(['aa', 'zz', 'csipetke']);
  });
});

describe('collectMissing: unrecognised lines', () => {
  it('groups one name over two recipes into one item with two positions', () => {
    const other = recipe('u:soep', 'Soep', [line('Soep:', '', { kind: 'header' }), line('1 handje Csipetke', 'Csipetke')]);
    const items = collectMissing([], [gulyas, other], testDictionary());
    expect(items).toHaveLength(1);
    const item = items[0] as MissingLineItem;
    expect(item.kind).toBe('line');
    expect(item.name).toBe('csipetke');
    expect(item.key).toBe('csipetke');
    expect(item.positions).toEqual([
      { recipeId: 'u:gulyas', index: 1 },
      { recipeId: 'u:soep', index: 1 },
    ]);
    expect(item.recipeName).toEqual({ nl: "Dino's Gulyás" });
    expect(item.raw).toBe('2 tl csipetke');
    expect(item.lang).toBe('nl');
    expect(item.missing).toEqual(['en', 'aisle', 'vegan', 'gluten', 'lactose']);
  });

  it('a line with only English text keeps its name as the English one and asks for the Dutch (invariant 3)', () => {
    const gabi = { id: 'u:stew', name: { en: "Gabi's stew" }, lines: [enLine('2 chorizo sausages', 'chorizo sausages')] };
    const [item] = collectMissing([], [gabi], testDictionary()) as MissingLineItem[];
    expect(item).toMatchObject({ kind: 'line', name: 'chorizo sausages', lang: 'en', missing: ['nl', 'aisle', 'vegan', 'gluten', 'lactose'] });
    expect(buildMissingPrompt([item!], 'en')).toContain('M1. (from "Gabi\'s stew": "2 chorizo sausages") nl: ? | en: chorizo sausages | aisle: ? | vegan: ? | gluten: ? | lactose: ?\n');
    // The same name on a Dutch line as well: the name is Dutch, the prompt asks for English.
    const nlToo = recipe('u:nl', 'NL', [line('1 csabai', 'csabai')]);
    const enFirst = { id: 'u:en', name: { en: 'EN' }, lines: [enLine('1 Csabai', 'Csabai')] };
    const [both] = collectMissing([], [enFirst, nlToo], testDictionary()) as MissingLineItem[];
    expect(both).toMatchObject({ lang: 'nl', missing: ['en', 'aisle', 'vegan', 'gluten', 'lactose'] });
    expect(both?.positions).toHaveLength(2);
  });

  it('skips names of 2 characters or less, headers, resolved lines, classics and names the dictionary already knows', () => {
    const r = recipe('u:mix', 'Mix', [
      line('1 x', 'x'),
      line('2 el', 'el'),
      line('Saus:', 'Saus', { kind: 'header' }),
      line('1 ui', 'ui', { ing: 'ui' }),
      // Linked to an own entry of the other phone: unknown here, so unrecognised.
      line('1 zakje sumak', 'sumak', { ing: 'sumak-van-gabi' }),
      // Unlinked, but "tomaten" is an entry by now (findExisting): not a gap in the dictionary.
      line('3 tomaten', 'tomaten'),
      line('1 snuf ajowan', 'ajowan', { ing: undefined }),
    ]);
    const classic = recipe('b:klassieker', 'Klassieker', [line('1 kruidnagel van Zanzibar', 'kruidnagel van Zanzibar')]);
    const items = collectMissing([], [r, classic], testDictionary()) as MissingLineItem[];
    expect(items.map((i) => i.key)).toEqual(['ajowan', 'sumak']);
    expect(items[1]?.positions).toEqual([{ recipeId: 'u:mix', index: 4 }]);
  });

  it('an own entry made since (DT 80: "+ Nieuw ingrediënt") takes the line out of the list', () => {
    // Adjusted for Fable's decision (block 5): the form's default aisle "overig", so the copied
    // English name is still a gap (a complete entry with the same name would drop out entirely).
    const entry = own('csipetke', 'csipetke', 'csipetke', { aisle: 'overig' });
    const items = collectMissing([entry], [gulyas], dictWith([entry]));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'entry', missing: ['en', 'aisle'] });
  });

  it('returns at most 40 (41 items → 40); Infinity gives the full count', () => {
    // Adjusted for Fable's decision (block 5): aisle "overig" keeps every entry incomplete.
    const entries = Array.from({ length: 41 }, (_, i) => own(`e${i}`, `eigen ${String(i).padStart(2, '0')}`, `eigen ${String(i).padStart(2, '0')}`, { aisle: 'overig' }));
    const dict = dictWith(entries);
    expect(MISSING_LIMIT).toBe(40);
    const items = collectMissing(entries, [], dict);
    expect(items).toHaveLength(40);
    expect((items[39] as MissingEntryItem).entry.id).toBe('e39');
    expect(collectMissing(entries, [], dict, Infinity)).toHaveLength(41);
    expect(collectMissing(entries, [], dict, 0)).toEqual([]);
  });
});

const NL_PROMPT_HEAD = [
  'Vul voor elk genummerd ingrediënt de ontbrekende gegevens aan (de vraagtekens). Antwoord ALLEEN met de regels hieronder, in één codeblok, één regel per nummer, in precies dit formaat:',
  'M1. nl: <naam, enkelvoud> | en: <British English name, singular> | schap: <id> | vegan: ja/nee | gluten: ja/nee/misschien | lactose: ja/nee/misschien',
  'Schap is één van: groente-fruit, brood-ontbijt, vlees-vis, zuivel-eieren, kaas, droog, blik-pot, kruiden-specerijen, sauzen-olie-azijn, wereld, bakken, diepvries, dranken, snacks-zoet, huishoudelijk, drogisterij, overig. Lactose streng: elk zuivelproduct (ook harde kaas, boter, ghee) is "ja". Verander niets wat al is ingevuld.',
].join('\n');

describe('buildMissingPrompt', () => {
  const items = collectMissing([sultanas], [gulyas], dictWith([sultanas]));

  it('is literally the prompt of §1f for its example', () => {
    expect(buildMissingPrompt(items, 'nl')).toBe(
      NL_PROMPT_HEAD +
        '\n\n' +
        "M1. nl: sultana's | en: ? | schap: ? | vegan: ? | gluten: ? | lactose: ?\n" +
        'M2. (uit "Dino\'s Gulyás": "2 tl csipetke") nl: csipetke | en: ? | schap: ? | vegan: ? | gluten: ? | lactose: ?\n',
    );
  });

  it('writes out what is filled in, "?" for what is missing, and lists the 17 aisle ids', () => {
    // Adjusted for Fable's decision (block 5): an empty English name, since a copy of the Dutch one on
    // an otherwise complete entry counts as confirmed.
    const entry = own('rozijn', 'rozijn', '', { vegan: false, gluten: false, glutenUnsure: true });
    const noLactose = without(own('kaasje', 'kaasje', 'little cheese', { aisle: 'kaas', vegan: false, gluten: true }), 'lactose');
    const p = buildMissingPrompt(collectMissing([entry, noLactose], [], dictWith([entry, noLactose])), 'nl');
    expect(p).toContain('M1. nl: kaasje | en: little cheese | schap: kaas | vegan: nee | gluten: ja | lactose: ?\n');
    expect(p).toContain('M2. nl: rozijn | en: ? | schap: droog | vegan: nee | gluten: misschien | lactose: nee\n');
    expect(aislesJson).toHaveLength(17);
    for (const a of aislesJson) expect(p).toContain(a.id);
    expect(p.endsWith('\n')).toBe(true);
  });

  it('has an English version with "aisle" and yes/no/maybe', () => {
    const p = buildMissingPrompt(items, 'en');
    expect(p.startsWith('For each numbered ingredient, fill in the missing details (the question marks).')).toBe(true);
    expect(p).toContain('M1. nl: <Dutch name, singular> | en: <British English name, singular> | aisle: <id> | vegan: yes/no | gluten: yes/no/maybe | lactose: yes/no/maybe\n');
    expect(p).toContain('Aisle is one of: groente-fruit, brood-ontbijt,');
    expect(p).toContain('Lactose strictly: every dairy product (also hard cheese, butter, ghee) is "yes".');
    expect(p).toContain("M1. nl: sultana's | en: ? | aisle: ? | vegan: ? | gluten: ? | lactose: ?\n");
    expect(p).toContain('M2. (from "Dino\'s Gulyás": "2 tl csipetke") nl: csipetke | en: ? | aisle: ? | vegan: ? | gluten: ? | lactose: ?\n');
    const filled = buildMissingPrompt([{ kind: 'entry', entry: own('x1', 'abc', 'abc', { gluten: false, glutenUnsure: true }), missing: ['en'] }], 'en');
    expect(filled).toContain('M1. nl: abc | en: ? | aisle: droog | vegan: yes | gluten: maybe | lactose: no\n');
  });
});

describe('parseMissingAnswer', () => {
  it('reads a plain line', () => {
    expect(parseMissingAnswer("M1. nl: sultana | en: sultana | schap: droog | vegan: ja | gluten: nee | lactose: nee")).toEqual([
      { n: 1, nl: 'sultana', en: 'sultana', aisle: 'droog', vegan: 'yes', gluten: 'no', lactose: 'no' },
    ]);
  });

  it('reads "M1:" and "M1)" (and "**M1.**", an aisle: key, the copied context)', () => {
    const rows = parseMissingAnswer(
      [
        'M1: nl: rozijn | en: raisin | schap: droog | vegan: yes | gluten: no | lactose: no',
        'M2) nl: kaasje | en: little cheese | aisle: Kaas | vegan: no | gluten: maybe | lactose: yes',
        '**M3.** (uit "Dino\'s Gulyás": "2 tl csipetke (zelfgemaakt)") nl: csipetke | en: pinched noodles | schap: droog | vegan: nee | gluten: ja | lactose: nee',
      ].join('\n'),
    );
    expect(rows).toEqual([
      { n: 1, nl: 'rozijn', en: 'raisin', aisle: 'droog', vegan: 'yes', gluten: 'no', lactose: 'no' },
      { n: 2, nl: 'kaasje', en: 'little cheese', aisle: 'kaas', vegan: 'no', gluten: 'unsure', lactose: 'yes' },
      { n: 3, nl: 'csipetke', en: 'pinched noodles', aisle: 'droog', vegan: 'no', gluten: 'yes', lactose: 'no' },
    ]);
  });

  it('survives markdown escapes, a code block around it and chatter in between', () => {
    const answer = [
      'Hier is het antwoord:',
      '```text',
      "M1\\. nl: sultana's \\| en: sultana \\| schap: droog \\| vegan: ja \\| gluten: nee \\| lactose: nee",
      'Let op: dit is een schatting.',
      'M2\\. nl: csipetke \\| en: **pinched noodles** \\| schap: `droog` \\| vegan: nee \\| gluten: ja \\| lactose: misschien',
      '```',
      'Laat het weten als je meer wilt!',
    ].join('\r\n');
    expect(parseMissingAnswer(answer)).toEqual([
      { n: 1, nl: "sultana's", en: 'sultana', aisle: 'droog', vegan: 'yes', gluten: 'no', lactose: 'no' },
      { n: 2, nl: 'csipetke', en: 'pinched noodles', aisle: 'droog', vegan: 'no', gluten: 'yes', lactose: 'unsure' },
    ]);
  });

  it('reads misschien/maybe as unsure and ja/nee/yes/no (also with an explanation behind it)', () => {
    const [row] = parseMissingAnswer('M4. nl: x-nl | en: x-en | schap: droog | vegan: nee (bevat ei) | gluten: misschien | lactose: Maybe');
    expect(row).toMatchObject({ vegan: 'no', gluten: 'unsure', lactose: 'unsure' });
    const [yes] = parseMissingAnswer('M5. vegan: Yes | gluten: JA | lactose: no');
    expect(yes).toEqual({ n: 5, vegan: 'yes', gluten: 'yes', lactose: 'no' });
    const [dot] = parseMissingAnswer('M6. vegan: Nee. | gluten: misschien wel | lactose: ja!');
    expect(dot).toEqual({ n: 6, vegan: 'no', gluten: 'unsure', lactose: 'yes' });
  });

  it('never reads "no idea", "N/B", "n.v.t." or "nee/misschien" as a no: they stay "?" (§2a)', () => {
    expect(parseMissingAnswer('M1. gluten: N/B | lactose: no idea')).toEqual([{ n: 1 }]);
    expect(parseMissingAnswer('M2. vegan: n.v.t. | gluten: nee/misschien | lactose: n')).toEqual([{ n: 2 }]);
    expect(parseMissingAnswer('M3. vegan: y | gluten: j | lactose: geen idee')).toEqual([{ n: 3 }]);
    // Nothing readable, so nothing is written: no gluten-free or lactose-free claim.
    const entry = without(own('saus', 'saus van de zaak', 'house sauce', { vegan: false }), 'gluten', 'lactose');
    const dict = dictWith([entry]);
    const plan = planMissingAnswer(collectMissing([entry], [], dict), parseMissingAnswer('M1. nl: saus van de zaak | gluten: N/B | lactose: no idea'), dict, slug);
    expect(plan.updates).toEqual([]);
    expect(plan.skipped).toEqual([1]);
  });

  it('leaves "?" and the placeholders of the format line out, and merges the prompt pasted along', () => {
    const items = collectMissing([sultanas], [gulyas], dictWith([sultanas]));
    const pasted = buildMissingPrompt(items, 'nl') + '\n' + "M1. nl: sultana's | en: sultana | schap: droog | vegan: ja | gluten: nee | lactose: nee\n";
    const rows = parseMissingAnswer(pasted);
    expect(rows).toEqual([
      { n: 1, nl: "sultana's", en: 'sultana', aisle: 'droog', vegan: 'yes', gluten: 'no', lactose: 'no' },
      { n: 2, nl: 'csipetke' },
    ]);
  });

  it('keeps a marker without readable fields as a row with only its number; joins a wrapped row', () => {
    const rows = parseMissingAnswer(['M1. geen idee', 'M2. nl: rozijn | en: raisin | schap: droog |', '  vegan: ja | gluten: nee | lactose: nee', '', 'gluten: ja'].join('\n'));
    expect(rows).toEqual([
      { n: 1 },
      { n: 2, nl: 'rozijn', en: 'raisin', aisle: 'droog', vegan: 'yes', gluten: 'no', lactose: 'no' },
    ]);
    expect(parseMissingAnswer('Sorry, ik weet het niet.')).toEqual([]);
    expect(parseMissingAnswer('')).toEqual([]);
  });
});

/** A `newId` like the app's: the slug of the Dutch name. */
const slug = (nl: string) => nl.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

describe('planMissingAnswer', () => {
  it('updates only the fields that were missing; a filled-in field is never overwritten', () => {
    const entry = without(own('rozijn', 'rozijn', 'rozijn', { aisle: 'droog', vegan: true }), 'gluten');
    const items: MissingItem[] = collectMissing([entry], [], dictWith([entry]));
    expect((items[0] as MissingEntryItem).missing).toEqual(['en', 'gluten']);
    const rows = parseMissingAnswer('M1. nl: rozijn | en: raisin | schap: snacks-zoet | vegan: nee | gluten: nee | lactose: ja');
    const plan = planMissingAnswer(items, rows, dictWith([entry]), slug);
    expect(plan.creates).toEqual([]);
    expect(plan.skipped).toEqual([]);
    expect(plan.updates).toHaveLength(1);
    const u = plan.updates[0]!;
    expect(u).toMatchObject({ n: 1, id: 'rozijn', fields: ['en', 'gluten'] });
    expect(u.entry).toEqual({ ...entry, en: { one: 'raisin' }, gluten: false });
    // The input entry itself is not mutated.
    expect(entry.en).toEqual({ one: 'rozijn' });
  });

  it('fills the whole example entry: en, aisle and the three flags', () => {
    const dict = dictWith([sultanas]);
    const items = collectMissing([sultanas], [], dict);
    const plan = planMissingAnswer(items, parseMissingAnswer("M1. nl: sultana's | en: sultana | schap: droog | vegan: ja | gluten: nee | lactose: nee"), dict, slug);
    expect(plan.updates[0]?.fields).toEqual(['en', 'aisle', 'vegan', 'gluten', 'lactose']);
    expect(plan.updates[0]?.entry).toMatchObject({ en: { one: 'sultana' }, aisle: 'droog', veg: true, vegan: true, gluten: false, lactose: false });
  });

  it('an answered English name that is the Dutch one again does not count as filled in', () => {
    // Adjusted for Fable's decision (block 5): the entry lacks its gluten flag, else the copied English
    // name would count as confirmed and the entry would not be asked about at all.
    const entry = without(own('csipetke', 'csipetke', 'csipetke'), 'gluten');
    const dict = dictWith([entry]);
    const items = collectMissing([entry], [], dict);
    expect((items[0] as MissingEntryItem).missing).toEqual(['en', 'gluten']);
    const plan = planMissingAnswer(items, parseMissingAnswer('M1. nl: csipetke | en: Csipetke | schap: droog'), dict, slug);
    expect(plan.updates).toEqual([]);
    expect(plan.skipped).toEqual([1]);
    // With the last flag answered the copy is not written either, but the entry is complete then: the
    // same name counts as confirmed and the entry leaves the list.
    const done = planMissingAnswer(items, parseMissingAnswer('M1. nl: csipetke | en: Csipetke | gluten: ja'), dict, slug);
    expect(done.updates[0]?.fields).toEqual(['gluten']);
    expect(done.updates[0]?.entry.en).toEqual({ one: 'csipetke' });
    expect(collectMissing([done.updates[0]!.entry], [], dictWith([done.updates[0]!.entry]))).toEqual([]);
  });

  it('an unknown aisle id keeps the current aisle; an aisle name is understood', () => {
    const entry = own('rozijn', 'rozijn', 'raisin', { aisle: 'overig' });
    const dict = dictWith([entry]);
    const items = collectMissing([entry], [], dict);
    const unknown = planMissingAnswer(items, parseMissingAnswer('M1. nl: rozijn | en: raisin | schap: rozijnenschap'), dict, slug);
    expect(unknown.updates).toEqual([]);
    expect(unknown.skipped).toEqual([1]);
    const byName = planMissingAnswer(items, parseMissingAnswer('M1. schap: Tins & jars'), dict, slug);
    expect(byName.updates[0]?.entry.aisle).toBe('blik-pot');
    expect(byName.updates[0]?.fields).toEqual(['aisle']);
  });

  it('maps "misschien" to false + unsure for gluten and lactose', () => {
    const entry = without(own('saus', 'saus van de zaak', 'house sauce', { vegan: false }), 'gluten', 'lactose');
    const dict = dictWith([entry]);
    const plan = planMissingAnswer(collectMissing([entry], [], dict), parseMissingAnswer('M1. gluten: misschien | lactose: misschien'), dict, slug);
    expect(plan.updates[0]?.entry).toMatchObject({ gluten: false, glutenUnsure: true, lactose: false, lactoseUnsure: true });
    expect(plan.updates[0]?.fields).toEqual(['gluten', 'lactose']);
  });

  it('applies lactose STRICTLY: vegan means lactose-free without doubt, a contradiction keeps the lactose fact', () => {
    const blank = without(own('blank', 'blanco', 'blank', { aisle: 'droog' }), 'vegan', 'gluten', 'lactose');
    const dict = dictWith([blank]);
    const items = collectMissing([blank], [], dict);
    const veganMaybe = planMissingAnswer(items, parseMissingAnswer('M1. vegan: ja | lactose: misschien'), dict, slug);
    expect(veganMaybe.updates[0]?.entry).toMatchObject({ vegan: true, lactose: false });
    expect(veganMaybe.updates[0]?.entry.lactoseUnsure).toBeUndefined();
    const contradiction = planMissingAnswer(items, parseMissingAnswer('M1. vegan: ja | lactose: ja'), dict, slug);
    expect(contradiction.updates[0]?.entry.vegan).toBeUndefined();
    expect(contradiction.updates[0]?.entry.lactose).toBe(true);
    expect(contradiction.updates[0]?.fields).toEqual(['lactose']);
    // Already vegan (filled in): the missing lactose follows rule H1, whatever the answer says.
    const vegan = without(own('tofu-x', 'tofu x', 'tofu x2', { vegan: true }), 'lactose');
    const d2 = dictWith([vegan]);
    const h1 = planMissingAnswer(collectMissing([vegan], [], d2), parseMissingAnswer('M1. lactose: ja'), d2, slug);
    expect(h1.updates[0]?.entry).toMatchObject({ vegan: true, lactose: false });
    // Not vegetarian (filled in): "vegan: ja" is not written.
    const meat = without(own('worstje', 'worstje', 'little sausage', { veg: false }), 'vegan');
    const d3 = dictWith([meat]);
    const noVegan = planMissingAnswer(collectMissing([meat], [], d3), parseMissingAnswer('M1. vegan: ja'), d3, slug);
    expect(noVegan.updates).toEqual([]);
  });

  it('skips a row whose Dutch name is another ingredient (shifted numbers); a singular of the name is the same one', () => {
    const entry = without(own('sultanas', "sultana's", "sultana's", { aisle: 'droog' }), 'gluten');
    const dict = dictWith([entry]);
    const items = collectMissing([entry], [gulyas], dict);
    const shifted = planMissingAnswer(items, parseMissingAnswer('M1. nl: aardpeer | en: Jerusalem artichoke | schap: groente-fruit | gluten: nee\nM2. nl: sultana | en: sultana | gluten: nee'), dict, slug);
    expect(shifted.updates).toEqual([]);
    expect(shifted.creates).toEqual([]);
    expect(shifted.skipped).toEqual([1, 2]);
    const singular = planMissingAnswer(items, parseMissingAnswer('M1. nl: sultana | en: sultana | gluten: nee\nM2. nl: Csipetke | en: pinched noodles'), dict, slug);
    expect(singular.updates[0]).toMatchObject({ n: 1, id: 'sultanas', fields: ['en', 'gluten'] });
    expect(singular.creates[0]).toMatchObject({ n: 2, entry: { nl: { one: 'csipetke' } } });
  });

  it('an English line becomes an entry with the answered Dutch name and its own English name', () => {
    const gabi = { id: 'u:stew', name: { en: "Gabi's stew" }, lines: [enLine('2 chorizo sausages', 'chorizo sausages')] };
    const dict = testDictionary();
    const items = collectMissing([], [gabi], dict);
    const plan = planMissingAnswer(items, parseMissingAnswer('M1. nl: chorizoworst | en: chorizo sausage | aisle: vlees-vis | vegan: no | gluten: no | lactose: maybe'), dict, slug);
    expect(plan.creates[0]?.entry).toMatchObject({ nl: { one: 'chorizoworst' }, en: { one: 'chorizo sausages' }, aisle: 'vlees-vis', lactose: false, lactoseUnsure: true });
    expect(plan.creates[0]?.links).toEqual([{ recipeId: 'u:stew', index: 0 }]);
    // Without a Dutch name there is no new entry; an English name of another line is skipped.
    expect(planMissingAnswer(items, parseMissingAnswer('M1. nl: ? | en: chorizo sausage | aisle: vlees-vis'), dict, slug).skipped).toEqual([1]);
    expect(planMissingAnswer(items, parseMissingAnswer('M1. nl: lamsworst | en: lamb sausage'), dict, slug).skipped).toEqual([1]);
  });

  it('makes a new entry for unrecognised lines, linked at every position', () => {
    const other = recipe('u:soep', 'Soep', [line('1 handje csipetke', 'csipetke')]);
    const dict = testDictionary();
    const items = collectMissing([], [gulyas, other], dict);
    const plan = planMissingAnswer(items, parseMissingAnswer('M1. nl: Csipetke | en: pinched noodles | schap: droog | vegan: nee | gluten: ja | lactose: nee'), dict, slug);
    expect(plan.updates).toEqual([]);
    expect(plan.creates).toHaveLength(1);
    const c = plan.creates[0]!;
    expect(c.n).toBe(1);
    // The Dutch name is the line's (filled in by the prompt), not the AI's spelling.
    expect(c.entry).toEqual({ id: 'csipetke', nl: { one: 'csipetke' }, en: { one: 'pinched noodles' }, aisle: 'droog', defaultUnit: 'stuk', staple: false, veg: true, vegan: false, gluten: true, lactose: false });
    expect(c.links).toEqual([
      { recipeId: 'u:gulyas', index: 1 },
      { recipeId: 'u:soep', index: 0 },
    ]);
    expect(c.recipes).toBe(2);
  });

  it('a new entry needs an English name as well (else skipped); an unknown aisle becomes "overig"', () => {
    const dict = testDictionary();
    const items = collectMissing([], [gulyas], dict);
    const noEn = planMissingAnswer(items, parseMissingAnswer('M1. nl: csipetke | en: ? | schap: droog | vegan: nee'), dict, slug);
    expect(noEn.creates).toEqual([]);
    expect(noEn.skipped).toEqual([1]);
    const odd = planMissingAnswer(items, parseMissingAnswer('M1. en: pinched noodles | schap: pastaschap'), dict, slug);
    expect(odd.creates[0]?.entry.aisle).toBe('overig');
    expect(odd.creates[0]?.entry.vegan).toBeUndefined();
  });

  it('keeps new ids unique against the dictionary and each other', () => {
    const r = recipe('u:r', 'R', [line('1 tomatenpuree van oma', 'tomatenpuree van oma'), line('1 tomaatje oma', 'tomaatje oma')]);
    const dict = testDictionary();
    const items = collectMissing([], [r], dict);
    const plan = planMissingAnswer(items, parseMissingAnswer('M1. en: tomato a | schap: blik-pot\nM2. en: tomato b | schap: blik-pot'), dict, () => 'tomaat');
    expect(plan.creates.map((c) => c.entry.id)).toEqual(['tomaat-2', 'tomaat-3']);
    const bad = planMissingAnswer(items, parseMissingAnswer('M1. en: tomato a'), dict, () => 'Not An Id!');
    expect(bad.creates[0]?.entry.id).toBe('tomaatje-oma');
  });

  it('skips unreadable rows, numbers the prompt did not have and repeated numbers', () => {
    const dict = dictWith([sultanas]);
    const items = collectMissing([sultanas], [], dict);
    const plan = planMissingAnswer(items, [{ n: 1 }, { n: 7, en: 'x' }, { n: 1, en: 'sultana' }], dict, slug);
    expect(plan).toEqual({ updates: [], creates: [], skipped: [1, 7] });
  });
});

describe('refreshMissingItems: the answer belongs to the prompt that was copied', () => {
  // Adjusted for Fable's decision (block 5): rozijn and aardpeer (below) have aisle "overig", so their
  // copied English name is still a gap.
  const rozijn = own('rozijn', 'rozijn', 'rozijn', { aisle: 'overig' });
  const zout = without(own('zoutje', 'zoutje', 'little salt'), 'lactose');

  it('keeps the numbers when an own entry was added since (the live list shifted)', () => {
    const copied = collectMissing([rozijn, zout], [gulyas], dictWith([rozijn, zout]));
    expect(copied.map((i) => (i.kind === 'entry' ? i.entry.id : i.key))).toEqual(['rozijn', 'zoutje', 'csipetke']);
    // "aardpeer" is made in between: it sorts first, so the live M1 is no longer rozijn.
    const aardpeer = own('aardpeer', 'aardpeer', 'aardpeer', { aisle: 'overig' });
    const now = [aardpeer, rozijn, zout];
    const dict = dictWith(now);
    expect(collectMissing(now, [gulyas], dict).map((i) => (i.kind === 'entry' ? i.entry.id : i.key))).toEqual(['aardpeer', 'rozijn', 'zoutje', 'csipetke']);
    const answer = parseMissingAnswer('M1. nl: rozijn | en: raisin\nM2. nl: zoutje | lactose: nee\nM3. nl: csipetke | en: pinched noodles');
    const plan = planMissingAnswer(refreshMissingItems(copied, now, dict), answer, dict, slug);
    expect(plan.updates.map((u) => [u.n, u.id, u.fields])).toEqual([
      [1, 'rozijn', ['en']],
      [2, 'zoutje', ['lactose']],
    ]);
    expect(plan.creates.map((c) => [c.n, c.entry.nl.one, c.entry.en.one])).toEqual([[3, 'csipetke', 'pinched noodles']]);
  });

  it('writes over nothing that changed in between: a completed field stays, a deleted entry and a known line are skipped', () => {
    const copied = collectMissing([rozijn, zout], [gulyas], dictWith([rozijn, zout]));
    // In between: rozijn got its English name by hand, zoutje was deleted, csipetke became an own entry.
    const rozijnNow = own('rozijn', 'rozijn', 'raisin', { aisle: 'snacks-zoet' });
    const csipetke = own('csipetke', 'csipetke', 'pinched noodles');
    const now = [rozijnNow, csipetke];
    const dict = dictWith(now);
    const items = refreshMissingItems(copied, now, dict);
    expect(items[0]).toMatchObject({ kind: 'entry', entry: rozijnNow });
    expect(items[1]).toBeUndefined();
    expect(items[2]).toBeUndefined();
    const plan = planMissingAnswer(items, parseMissingAnswer('M1. nl: rozijn | en: sultana\nM2. nl: zoutje | lactose: nee\nM3. nl: csipetke | en: x'), dict, slug);
    expect(plan).toEqual({ updates: [], creates: [], skipped: [1, 2, 3] });
  });
});

describe('Fable decision (block 5): the same name counts as complete', () => {
  it('(a) csipetke with en === nl and without an aisle → en is missing', () => {
    const entry = own('csipetke', 'csipetke', 'csipetke', { aisle: 'overig' });
    const dict = dictWith([entry]);
    const items = collectMissing([entry], [], dict);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'entry', missing: ['en', 'aisle'] });
    expect(buildMissingPrompt(items, 'nl')).toContain('M1. nl: csipetke | en: ? | schap: ? | vegan: ja | gluten: nee | lactose: nee\n');
    expect(missingFieldsOf(own('csipetke', 'csipetke', 'csipetke', { aisle: '' }))).toEqual(['en', 'aisle']);
    // Case-insensitive, and one absent flag is enough to keep the copy a gap.
    expect(missingFieldsOf(without(own('csipetke', 'csipetke', 'Csipetke'), 'vegan'))).toEqual(['en', 'vegan']);
    expect(missingFieldsOf(without(own('pesto', 'pesto', 'pesto'), 'gluten'))).toEqual(['en', 'gluten']);
    expect(missingFieldsOf(without(own('focaccia', 'focaccia', 'FOCACCIA'), 'lactose'))).toEqual(['en', 'lactose']);
  });

  it('(b) the same entry with aisle "droog" and the three flags → not in collectMissing (count and prompt)', () => {
    const entry = own('csipetke', 'csipetke', 'csipetke', { aisle: 'droog' });
    expect(missingFieldsOf(entry)).toEqual([]);
    const dict = dictWith([entry]);
    // The Gulyás line is known through the own entry, and the entry itself is complete.
    expect(collectMissing([entry], [gulyas], dict)).toEqual([]);
    expect(collectMissing([entry], [gulyas], dict, Infinity)).toHaveLength(0);
    expect(buildMissingPrompt(collectMissing([entry], [gulyas], dict), 'nl')).not.toContain('csipetke');
    // Case-insensitive; a "misschien" flag is filled in as well.
    expect(missingFieldsOf(own('pesto', 'pesto', 'Pesto', { vegan: false, gluten: false, glutenUnsure: true, lactose: false, lactoseUnsure: true }))).toEqual([]);
  });

  it('(c) an empty en.one on an otherwise complete entry → en is missing', () => {
    const entry = own('csipetke', 'csipetke', '');
    expect(missingFieldsOf(entry)).toEqual(['en']);
    expect(missingFieldsOf(own('csipetke', 'csipetke', '   '))).toEqual(['en']);
    const items = collectMissing([entry], [], dictWith([entry]));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'entry', missing: ['en'] });
    expect(buildMissingPrompt(items, 'nl')).toContain('M1. nl: csipetke | en: ? | schap: droog | vegan: ja | gluten: nee | lactose: nee\n');
  });
});

describe('Fable decision (block 5): the vegetarian flag of a new entry', () => {
  /** The plan for one unrecognised line answered with `answer`. */
  function createFor(name: string, answer: string) {
    const dict = testDictionary();
    const items = collectMissing([], [recipe('u:veg', 'Veg', [line(`1 ${name}`, name)])], dict);
    expect(items).toHaveLength(1);
    return planMissingAnswer(items, parseMissingAnswer(answer), dict, slug).creates[0]?.entry;
  }

  it('a meat line with aisle vlees-vis and vegan nee → veg false', () => {
    expect(createFor('merguez', 'M1. nl: merguez | en: merguez sausage | schap: vlees-vis | vegan: nee | gluten: nee | lactose: nee')).toMatchObject({ aisle: 'vlees-vis', veg: false, vegan: false });
    // The aisle by its name is the same aisle.
    expect(createFor('merguez', 'M1. nl: merguez | en: merguez sausage | schap: Vlees & vis')).toMatchObject({ aisle: 'vlees-vis', veg: false });
  });

  it('a cheese line with aisle kaas and vegan nee → veg true', () => {
    expect(createFor('manchego', 'M1. nl: manchego | en: Manchego | schap: kaas | vegan: nee | gluten: nee | lactose: ja')).toMatchObject({ aisle: 'kaas', veg: true, vegan: false, lactose: true });
    // An unknown aisle is "overig": the form's default, vegetarian.
    expect(createFor('manchego', 'M1. nl: manchego | en: Manchego | schap: kaasschap | vegan: nee')).toMatchObject({ aisle: 'overig', veg: true, vegan: false });
  });

  it('vegan ja → veg true whatever the aisle', () => {
    expect(createFor('seitan', 'M1. nl: seitan | en: seitan | schap: vlees-vis | vegan: ja | gluten: ja | lactose: nee')).toMatchObject({ aisle: 'vlees-vis', veg: true, vegan: true });
    expect(createFor('seitan', 'M1. nl: seitan | en: seitan | schap: droog | vegan: ja')).toMatchObject({ aisle: 'droog', veg: true, vegan: true });
    expect(createFor('seitan', 'M1. nl: seitan | en: seitan | vegan: ja')).toMatchObject({ aisle: 'overig', veg: true, vegan: true });
  });

  it('vegan ja dropped by the lactose contradiction still makes a vlees-vis entry vegetarian', () => {
    // "vegan: ja" + "lactose: ja" keeps the lactose fact and leaves vegan unknown, so applyFlags
    // never sets veg itself: only the "vegan: ja" part of the veg rule makes this entry vegetarian.
    const entry = createFor('seitan', 'M1. nl: seitan | en: seitan | schap: vlees-vis | vegan: ja | lactose: ja');
    expect(entry).toMatchObject({ aisle: 'vlees-vis', veg: true, lactose: true });
    expect(entry?.vegan).toBeUndefined();
  });
});
