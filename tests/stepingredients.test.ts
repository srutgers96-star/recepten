// findStepIngredients & friends (docs/phase-6-spec.md 13I): the recipe's own ingredients in a step,
// over REAL steps and lines from data/recipes.json and the bundled dictionary. Precision first: the
// "no false positives" cases are real sentences that tripped a naive matcher.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultDictionary } from '../src/domain/data';
import type { Lang, Line, Recipe } from '../src/domain/model';
import {
  findStepIngredients,
  lineQuantityText,
  matchQuantityText,
  spokenStepQuantities,
  stepSegments,
  type StepIngredientMatch,
} from '../src/domain/stepingredients';

const { recipes } = JSON.parse(readFileSync(new URL('../data/recipes.json', import.meta.url), 'utf8')) as { recipes: Recipe[] };
const dict = defaultDictionary();

function recipe(id: string): Recipe {
  const r = recipes.find((x) => x.id === id);
  if (!r) throw new Error(`no recipe ${id}`);
  return r;
}

function stepText(id: string, step: number, lang: Lang): string {
  const t = recipe(id).steps[step]?.text[lang];
  if (!t) throw new Error(`no step ${step} (${lang}) in ${id}`);
  return t;
}

/** The matched words of a step, in order. */
function words(text: string, matches: readonly StepIngredientMatch[]): string[] {
  return matches.map((m) => text.slice(m.start, m.end));
}

function run(id: string, step: number, lang: Lang): { text: string; lines: Line[]; matches: StepIngredientMatch[] } {
  const text = stepText(id, step, lang);
  const lines = recipe(id).lines;
  return { text, lines, matches: findStepIngredients(text, lines, dict, lang) };
}

function find(text: string, matches: readonly StepIngredientMatch[], word: string): StepIngredientMatch {
  const m = matches.find((x) => text.slice(x.start, x.end) === word);
  if (!m) throw new Error(`no match "${word}" in: ${words(text, matches).join(', ')}`);
  return m;
}

const GOULASH = 'b:goulash-maaltijdsoep';

describe('findStepIngredients: Dutch', () => {
  it('finds the goulash ingredients, longest name first, and not the words that are no line', () => {
    const { text, matches } = run(GOULASH, 0, 'nl');
    // "schenkel" / "poulet" (lines: runderschenkel, runderpoulet) and "water" (no line) stay plain.
    expect(words(text, matches)).toEqual(['olie', 'knoflook', 'ui', 'paprika', 'bloem', 'paprikapoeder', 'cayennepeper', 'gezeefde tomaten']);
    expect(find(text, matches, 'paprikapoeder').lines).toEqual([8]);
    expect(find(text, matches, 'cayennepeper').lines).toEqual([9]);
    // "gezeefde tomaten": an alias of tomatensaus and the name as written in the line.
    expect(find(text, matches, 'gezeefde tomaten').lines).toEqual([10]);
    expect(matches.every((m) => !m.qtyInText)).toBe(true);
    // sorted by position, never overlapping
    for (let i = 1; i < matches.length; i++) expect(matches[i]!.start).toBeGreaterThanOrEqual(matches[i - 1]!.end);
  });

  it('maps an ingredient that is on two lines to both (groene + rode paprika)', () => {
    const { text, lines, matches } = run(GOULASH, 0, 'nl');
    const m = find(text, matches, 'paprika');
    expect(m.lines).toEqual([1, 2]);
    expect(matchQuantityText(m, lines, dict, 'nl')).toBe('1 groene + 1 rode');
  });

  it('maps butter for the vegetables and butter for the sauce to both lines', () => {
    const { text, lines, matches } = run('b:lasagne-met-courgette-en-kaassaus', 1, 'nl');
    const m = find(text, matches, 'boter');
    expect(m.lines).toEqual([2, 6]);
    expect(matchQuantityText(m, lines, dict, 'nl')).toBe('50 g + 75 g');
    expect(matchQuantityText(m, lines, dict, 'nl', 2)).toBe('100 g + 150 g');
  });

  it('finds singular and plural forms (ui / uien) and keeps diacritics and offsets exact', () => {
    const goulash = run(GOULASH, 0, 'nl');
    expect(find(goulash.text, goulash.matches, 'ui').lines).toEqual([0]);
    const bonen = run('b:mexicaanse-bonenschotel', 0, 'nl');
    expect(find(bonen.text, bonen.matches, 'uien').lines).toEqual([1]);
    const { text, matches } = run(GOULASH, 3, 'nl');
    expect(words(text, matches)).toEqual(['stokbrood', 'crème fraîche', 'geraspte kaas', 'stokbrood']);
    // A qualifier of the line right before the name joins the green words.
    expect(find(text, matches, 'geraspte kaas').lines).toEqual([18]);
  });

  it('matches decomposed diacritics too, with offsets into the text as passed in', () => {
    const nfd = stepText(GOULASH, 3, 'nl').normalize('NFD');
    const matches = findStepIngredients(nfd, recipe(GOULASH).lines, dict, 'nl');
    expect(words(nfd, matches)).toEqual(['stokbrood', 'crème fraîche'.normalize('NFD'), 'geraspte kaas', 'stokbrood']);
  });

  it('finds whole words only: "olie" is not inside "olijfolie", "ui" not in "ui-paprikamengsel"', () => {
    // A real sentence (macaroni-ham-kaas) against the goulash lines, which have "3 el olie".
    const text = stepText('b:macaroni-ham-kaas', 0, 'nl');
    const matches = findStepIngredients(text, recipe(GOULASH).lines, dict, 'nl');
    expect(text).toContain('olijfolie');
    expect(words(text, matches)).toEqual(['ui', 'knoflook']);
    // Its own lines do have olijfolie: then it is green, and "2 el" is in the text.
    const own = run('b:macaroni-ham-kaas', 0, 'nl');
    expect(find(own.text, own.matches, 'olijfolie').qtyInText).toBe(true);
    // "het ui-paprikamengsel" is not the onion line.
    const bonen = run('b:mexicaanse-bonenschotel', 0, 'nl');
    expect(words(bonen.text, bonen.matches)).toEqual(['uien', 'paprika', 'ketchup']);
  });

  it('a recipe with olijfolie does not make "olie" green (salade niçoise dressing)', () => {
    const { text, matches } = run('b:salade-nicoise', 1, 'nl');
    expect(text).toContain('olie');
    expect(words(text, matches)).toEqual(['aardappels']);
  });

  it('ignores header lines', () => {
    const { text, lines, matches } = run('b:lasagne-met-courgette-en-kaassaus', 2, 'nl');
    expect(lines[5]!.kind).toBe('header');
    expect(words(text, matches)).not.toContain('kaassaus');
    // Even a header that carries a name never matches.
    const header: Line = { raw: { nl: 'Kerrie:' }, kind: 'header', name: 'kerrie' };
    const withHeader = [header, ...lines.filter((l) => l.ing !== 'kerrie')];
    expect(words(text, findStepIngredients(text, withHeader, dict, 'nl'))).not.toContain('kerrie');
  });

  it('names an alternative: "olie of boter" uses the 30 g of butter, not the 3 el of oil', () => {
    const { text, lines, matches } = run('b:pittige-gehaktballen-met-pindasaus', 2, 'nl');
    const m = find(text, matches, 'boter');
    expect(m.lines).toEqual([5]);
    expect(m.alt).toEqual([0]);
    expect(matchQuantityText(m, lines, dict, 'nl')).toBe('30 g');
    expect(matchQuantityText(find(text, matches, 'ui'), lines, dict, 'nl')).toBe('1');
  });
});

describe('findStepIngredients: English', () => {
  it('finds the goulash ingredients in the English step ("paprika" is the spice there)', () => {
    const { text, lines, matches } = run(GOULASH, 0, 'en');
    expect(words(text, matches)).toEqual(['oil', 'diced beef', 'garlic', 'onion', 'peppers', 'flour', 'paprika', 'cayenne pepper', 'passata']);
    expect(find(text, matches, 'paprika').lines).toEqual([8]);
    expect(find(text, matches, 'peppers').lines).toEqual([1, 2]);
    expect(matchQuantityText(find(text, matches, 'peppers'), lines, dict, 'en')).toBe('1 green + 1 red');
    expect(matchQuantityText(find(text, matches, 'paprika'), lines, dict, 'en')).toBe('2 tbsp');
  });

  it('never makes "pepper" green for a bell pepper: it is black pepper in "salt and pepper"', () => {
    const bonen = run('b:mexicaanse-bonenschotel', 0, 'en');
    expect(words(bonen.text, bonen.matches)).toEqual(['onions', 'onion', 'ketchup']);
    const r = recipes.find((x) => x.lines.some((l) => l.ing === 'paprika') && !x.lines.some((l) => l.ing === 'peper' || l.ing === 'zout-en-peper') && x.steps.some((s) => /salt and pepper/.test(s.text.en ?? '')));
    expect(r).toBeDefined();
    for (const s of r!.steps) {
      const text = s.text.en ?? '';
      expect(words(text, findStepIngredients(text, r!.lines, dict, 'en')).map((w) => w.toLowerCase())).not.toContain('pepper');
    }
  });
});

describe('qtyInText', () => {
  it('is true when the amount is written right before the name', () => {
    const lasagne = run('b:lasagne-met-courgette-en-kaassaus', 2, 'nl');
    const kaas = find(lasagne.text, lasagne.matches, 'geraspte kaas'); // "100 g geraspte kaas"
    expect(kaas.qtyInText).toBe(true);
    expect(matchQuantityText(kaas, lasagne.lines, dict, 'nl')).toBe('');
    const bonen = run('b:mexicaanse-bonenschotel', 0, 'nl');
    expect(find(bonen.text, bonen.matches, 'ketchup').qtyInText).toBe(true); // "4 el ketchup"
    const risotto = run('b:safraan-risotto-met-garnalen', 1, 'en');
    // "Heat 50 g of butter ... glisten with butter": the first has an amount, the second not.
    expect(risotto.matches.filter((m) => risotto.text.slice(m.start, m.end) === 'butter').map((m) => m.qtyInText)).toEqual([true, false]);
  });

  it('is true for a part or an unmeasured amount: "de rest van de kaas", "1/3 van de courgette", "ruim water"', () => {
    const lasagne = run('b:lasagne-met-courgette-en-kaassaus', 3, 'nl');
    expect(find(lasagne.text, lasagne.matches, 'kaas').qtyInText).toBe(true);
    expect(find(lasagne.text, lasagne.matches, 'courgette').qtyInText).toBe(true);
    const penne = run('b:penne-all-arrabbiata', 2, 'nl'); // "Kook de penne in ruim water"
    expect(find(penne.text, penne.matches, 'water').qtyInText).toBe(true);
    expect(find(penne.text, penne.matches, 'penne').qtyInText).toBe(false);
  });

  it('is true for a vague or partial amount (review 13I, real steps)', () => {
    const cases: [string, number, Lang, string][] = [
      ['b:naanbrood-voor-bij-dahl', 0, 'nl', 'olijfolie'], // "met een klein beetje olijfolie"
      ['b:macaroni-ham-kaas', 3, 'nl', 'olijfolie'], // "nog een beetje olijfolie"
      ['b:macaroni-ham-kaas', 3, 'en', 'olive oil'], // "a little more olive oil"
      ['b:kipkarbonades-in-witte-wijn', 1, 'nl', 'boter'], // "in de achtergebleven boter"
      ['b:kipkarbonades-in-witte-wijn', 4, 'nl', 'witte wijn'], // "met wat witte wijn"
      ['b:kipkarbonades-in-witte-wijn', 4, 'en', 'white wine'], // "a little white wine"
      ['b:boeuf-stroganoff', 1, 'nl', 'boter'], // "in de achtergebleven boter"
      ['b:boeuf-stroganoff', 1, 'en', 'butter'], // "the butter left in the pan"
      ['b:rigatoni-met-tonijncarbonara', 0, 'en', 'chives'], // "two thirds of the chives"
      ['b:mexicaanse-ovenschotel-met-zoete-aardappel', 0, 'nl', 'cajunkruiden'], // "met wat cajunkruiden"
      ['b:mexicaanse-ovenschotel-met-zoete-aardappel', 0, 'en', 'Cajun seasoning'], // "a little of the Cajun seasoning"
      ['b:spaghetti-mediterranei', 4, 'nl', 'olijfolie'], // "de derde el olijfolie"
      ['b:spaghetti-mediterranei', 4, 'en', 'olive oil'], // "the third tbsp of olive oil"
      ['b:portugese-visschotel', 4, 'en', 'olives'], // "a few olives"
      ['b:portugese-visschotel', 4, 'nl', 'olijven'], // "enkele olijven"
      ['b:dahl-van-rode-linzen-boerenkool', 3, 'en', 'coriander leaves'], // "a few coriander leaves"
    ];
    for (const [id, step, lang, word] of cases) {
      const { text, lines, matches } = run(id, step, lang);
      const m = find(text, matches, word);
      expect(m.qtyInText, `${id} ${step} ${lang} "${word}"`).toBe(true);
      expect(matchQuantityText(m, lines, dict, lang)).toBe('');
    }
  });

  it('"beetje bij beetje de melk" is how to add it, not how much', () => {
    const { text, lines, matches } = run('b:ham-prei-rolletjes', 1, 'nl');
    const melk = find(text, matches, 'melk');
    expect(melk.qtyInText).toBe(false);
    expect(matchQuantityText(melk, lines, dict, 'nl')).not.toBe('');
  });

  it('is false for "de", "en", a time or a temperature before the name', () => {
    const { matches } = run(GOULASH, 0, 'nl');
    expect(matches.some((m) => m.qtyInText)).toBe(false);
    const text = 'Bak 5 minuten de ui en voeg na 2 minuten de knoflook toe.';
    expect(findStepIngredients(text, recipe(GOULASH).lines, dict, 'nl').map((m) => m.qtyInText)).toEqual([false, false]);
  });
});

describe('no false positives on tricky real steps', () => {
  it('"egg yolk" is not the egg line, "potato masher" is a tool, "mash" is a verb', () => {
    expect(run('b:kalkoenpie', 3, 'en').matches).toEqual([]);
    const husselpot = run('b:husselpot', 2, 'en');
    expect(words(husselpot.text, husselpot.matches)).toEqual(['lardons', 'onions', 'celery leaf', 'parsley']);
    const zuurkool = run('b:zuurkoolovenschotel-met-pastrami', 3, 'en');
    expect(words(zuurkool.text, zuurkool.matches)).toEqual(['pastrami', 'sauerkraut', 'potatoes', 'butter', 'milk']);
  });

  it('"olive oil" is not the olives line', () => {
    const { text, matches } = run('b:pasta-met-gerookte-zalm-venkel-en-olijven', 0, 'en');
    expect(words(text, matches)).toEqual(['fennel', 'crème fraîche', 'olives']);
    expect(find(text, matches, 'olives').start).toBeGreaterThan(text.indexOf('olive oil') + 'olive oil'.length);
  });

  it('"Bak lasagne" is the dish, not the lasagne sheets; "kaassaus" is not the cheese', () => {
    const { text, matches } = run('b:lasagne-met-courgette-en-kaassaus', 3, 'nl');
    expect(words(text, matches)).toEqual(['lasagnebladen', 'courgette', 'ei', 'paneermeel', 'kaas']);
  });

  it('"the egg mixture" is a mixture, not the eggs (UI pass, 16 Oct 2026)', () => {
    const omelet = run('b:boerenomelet', 1, 'en');
    expect(words(omelet.text, omelet.matches)[0]).toBe('eggs'); // "Beat the eggs with the milk"
    expect(omelet.matches.some((m) => m.start === omelet.text.indexOf('egg mixture'))).toBe(false);
    const bonen = run('b:mexicaanse-bonenschotel', 2, 'en');
    expect(words(bonen.text, bonen.matches).filter((w) => w === 'soured cream')).toHaveLength(1);
  });

  it('English: a name before "sauce" / "oil" / "crumble" is a preparation, not the ingredient (review 13I)', () => {
    const courgette = run('b:macaroni-met-courgette', 2, 'en'); // "the courgette sauce and the courgette pieces"
    expect(words(courgette.text, courgette.matches)).toEqual(['courgette', 'grated cheese']);
    expect(courgette.matches[0]!.start).toBe(courgette.text.indexOf('courgette pieces'));
    const rollade = run('b:rollade-met-groenten-uit-de-oven', 2, 'en'); // "brushing it with the garlic oil"
    expect(words(rollade.text, rollade.matches)).not.toContain('garlic');
    const crumble = run('b:kabeljauw-met-notencrumble', 0, 'en'); // "Spread the nut crumble over"
    expect(words(crumble.text, crumble.matches)).toContain('nuts');
    expect(words(crumble.text, crumble.matches)).not.toContain('nut');
    // a full name with "sauce" in it stays green
    const teriyaki = run('b:zalm-teriyaki-met-pindaboontjes-en-noedels', 1, 'en');
    expect(words(teriyaki.text, teriyaki.matches)).toContain('soy sauce');
  });

  it('English: "Butter a dish" opening a sentence is a verb, "the rest of the butter" is not (review 13I)', () => {
    const noorse = run('b:noorse-visschotel', 1, 'en'); // "Butter a large ovenproof dish"
    expect(words(noorse.text, noorse.matches)).toEqual(['paprika', 'flour']);
    const spinazie = run('b:macaroni-met-spinazie-en-kabeljauw', 0, 'en'); // "Butter an ovenproof dish, … the rest of the butter"
    expect(words(spinazie.text, spinazie.matches)).toEqual(['lemon juice', 'butter', 'wine']);
    expect(find(spinazie.text, spinazie.matches, 'butter').qtyInText).toBe(true);
    // the verb rule is English only and needs the capital: "boter" in a Dutch step is still the butter
    const nl = run('b:macaroni-met-spinazie-en-kabeljauw', 0, 'nl');
    expect(words(nl.text, nl.matches).map((w) => w.toLowerCase())).toContain('boter');
  });

  it('only the recipe\'s own lines: "boter" is plain text when butter is not on the list', () => {
    const { text, matches } = run('b:mexicaanse-bonenschotel', 0, 'nl');
    expect(text).toContain('boter');
    expect(words(text, matches)).not.toContain('boter');
  });
});

describe('quantities', () => {
  it('lineQuantityText scales and formats like the ingredient list', () => {
    const lines = recipe(GOULASH).lines;
    expect(lineQuantityText(lines[8]!, dict, 'nl')).toBe('2 el');
    expect(lineQuantityText(lines[8]!, dict, 'nl', 2)).toBe('4 el');
    expect(lineQuantityText(lines[8]!, dict, 'en')).toBe('2 tbsp');
    expect(lineQuantityText(lines[15]!, dict, 'nl')).toBe('½ tl'); // karwijzaad
    expect(lineQuantityText(lines[6]!, dict, 'en', 2)).toBe('2 cloves');
    expect(lineQuantityText(lines[0]!, dict, 'nl')).toBe('1'); // counted: "ui (1)"
  });

  it('spokenStepQuantities reads name + amount with long unit names, each line once, in text order', () => {
    const { lines, matches } = run(GOULASH, 0, 'nl');
    expect(spokenStepQuantities(matches, lines, dict, 'nl')).toEqual([
      'olie 3 eetlepels',
      'knoflook 1 teentje',
      '1 grote ui',
      '1 groene paprika',
      '1 rode paprika',
      'bloem 2 eetlepels',
      'paprikapoeder 2 eetlepels',
      'cayennepeper 1 theelepel',
      'tomatensaus 1 pak',
    ]);
    const en = run(GOULASH, 3, 'en');
    expect(spokenStepQuantities(en.matches, en.lines, dict, 'en', 2)).toEqual(['baguette 16 slices', 'crème fraîche 250 millilitres', 'grated cheese 200 grams']);
  });

  it('Stijn\'s case: "hoeveel?" on a step with paprikapoeder and karwijzaad', () => {
    const lines = recipe(GOULASH).lines;
    const text = 'Voeg 15 g paprikapoeder en de karwijzaadjes toe.';
    const matches = findStepIngredients(text, lines, dict, 'nl');
    expect(words(text, matches)).toEqual(['paprikapoeder', 'karwijzaadjes']);
    expect(matches.map((m) => m.qtyInText)).toEqual([true, false]);
    expect(matchQuantityText(matches[1]!, lines, dict, 'nl')).toBe('½ tl');
    // Measures stay singular in Dutch ("15 gram"), spoons count ("4 eetlepels").
    expect(spokenStepQuantities(matches, lines, dict, 'nl', 2)).toEqual(['paprikapoeder 4 eetlepels', 'karwijzaad 1 theelepel']);
  });

  it('a pinch-like unit without a number is the amount: "snufje nootmuskaat" (review 13I)', () => {
    const nl = run('b:tortellini-met-champignon-roomsaus', 0, 'nl');
    expect(matchQuantityText(find(nl.text, nl.matches, 'nootmuskaat'), nl.lines, dict, 'nl')).toBe('snufje');
    expect(spokenStepQuantities(nl.matches, nl.lines, dict, 'nl')).toContain('een snufje nootmuskaat');
    const en = run('b:tortellini-met-champignon-roomsaus', 0, 'en');
    expect(matchQuantityText(find(en.text, en.matches, 'nutmeg'), en.lines, dict, 'en')).toBe('pinch');
    expect(spokenStepQuantities(en.matches, en.lines, dict, 'en')).toContain('a pinch of nutmeg');
    // other units without a number say how it is cut, not how much: "partjes citroen (garnering)"
    const wedges = recipe('b:macaroni-met-spinazie-en-kabeljauw').lines[10]!;
    expect(wedges.unit).toBe('partje');
    expect(lineQuantityText(wedges, dict, 'nl')).toBe('');
  });

  it('two lines of one ingredient share the name when spoken; an alternative reads its own amount', () => {
    const lasagne = run('b:lasagne-met-courgette-en-kaassaus', 1, 'nl');
    expect(spokenStepQuantities(lasagne.matches, lasagne.lines, dict, 'nl')).toEqual(['boter 50 gram en 75 gram', 'knoflook 1 teentje']);
    const balls = run('b:pittige-gehaktballen-met-pindasaus', 2, 'en');
    expect(spokenStepQuantities(balls.matches, balls.lines, dict, 'en')).toEqual(['butter 30 grams', '1 onion']);
    expect(spokenStepQuantities([], balls.lines, dict, 'en')).toEqual([]);
  });
});

describe('stepSegments', () => {
  it('cuts the text into plain and ingredient pieces that join back to the text', () => {
    const { text, matches } = run(GOULASH, 3, 'nl');
    const segs = stepSegments(text, matches);
    expect(segs.map((s) => s.text).join('')).toBe(text);
    expect(segs.filter((s) => s.match).map((s) => s.text)).toEqual(['stokbrood', 'crème fraîche', 'geraspte kaas', 'stokbrood']);
    expect(segs.every((s) => s.text !== '')).toBe(true);
  });
});
