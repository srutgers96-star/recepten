// The parser/dictionary rules and the review layer added by the phase-2 data review (British
// English renders, notes with an English channel, aliases that start with a unit word, cut words
// inside the name, "30 g + 40 g", the stock cube, data/review/lines.json). Runs on the real
// dictionary so the corpus lines quoted here are the ones the girlfriend will read.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadDictionary } from '../src/domain/dictionary';
import type { Recipe } from '../src/domain/model';
import { parseLine } from '../src/domain/parser';
import { renderLine } from '../src/domain/render';
import { applyBatch, checkBatch, type BatchFile } from '../tools/apply-llm-batch.ts';
import { applyReview, checkReview, type ReviewFile } from '../tools/apply-review.ts';
import { readDictionaryData } from '../tools/build-dictionary-seed.ts';
import { splitServingNote } from '../tools/migrate-from-recepten2.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const dict = loadDictionary(readDictionaryData(ROOT));
const { recipes } = JSON.parse(readFileSync(new URL('../data/recipes.json', import.meta.url), 'utf8')) as { recipes: Recipe[] };

const nl = (raw: string) => parseLine(raw, dict, 'nl');
const en = (raw: string) => renderLine(nl(raw), dict, 'en');
const both = (raw: string) => [renderLine(nl(raw), dict, 'nl'), en(raw)];

describe('British English in the dictionary', () => {
  it('maps Dutch cheese ages to Gouda maturity, not age words', () => {
    expect(en('50 g geraspte oude kaas')).toBe('50 g grated extra mature cheese');
    expect(en('100 g geraspte jonge kaas')).toBe('100 g grated mild cheese');
    expect(nl('100 g jong belegen kaas')).toMatchObject({ ing: 'kaas', qual: ['jong-belegen'] });
    expect(en('100 g geraspte jong belegen Goudse kaas')).toBe('100 g grated medium-mature cheese');
    // "jonge kapucijners" and "oud brood" are products, not mild peas or extra mature bread.
    expect(en('1 blik jonge kapucijners')).toBe('1 tin marrowfat peas');
    expect(en('2 sneetjes oud wit brood')).toBe('2 slices white bread');
  });

  it('passata, large carrot, double cream, a blade of mace', () => {
    expect(en('1 pak (500 g) gezeefde tomaten')).toBe('1 pack passata (500 g)');
    expect(en('250 ml tomatensaus au naturel')).toBe('250 ml passata');
    expect(en('400 g winterpeen [stukjes]')).toBe('400 g large carrots, small pieces');
    expect(en('1 grote winterwortel [stukken van 2 cm]')).toBe('1 large carrot, 2 cm pieces');
    expect(en('125 ml slagroom')).toBe('125 ml double cream');
    expect(both('1 stukje foelie')).toEqual(['1 stuk foelie', '1 blade mace']);
  });

  it('"fijngesneden" is finely chopped for herbs, garlic and ginger, finely sliced for onion and leek', () => {
    expect(en('Peterselie [fijngesneden]')).toBe('Parsley, finely chopped');
    expect(en('2 teentjes knoflook [fijngesneden]')).toBe('2 cloves garlic, finely chopped');
    expect(en('2 tl gember [fijngesneden]')).toBe('2 tsp ginger, finely chopped');
    expect(en('het wit van 1 prei [fijngesneden]')).toBe('the white of 1 leek, finely sliced');
    expect(en('1 ui [fijn gesneden]')).toBe('1 onion, finely sliced');
    expect(en('400 g kipfilet [fijngesneden]')).toBe('400 g chicken breasts, finely sliced');
    expect(dict.prepFromEn('finely chopped')).toEqual({ nl: 'fijngehakt', en: 'finely chopped' });
  });
});

describe('parser rules from the review', () => {
  it('lets an alias that starts with a unit word fire: "blik tomaten" is the tinned product', () => {
    expect(nl('1 blik tomaten (440 g)')).toMatchObject({ qty: { min: 1 }, unit: 'blik', ing: 'tomaten-uit-blik', packSize: '440 g' });
    expect(both('1 blik tomaten (440 g)')).toEqual(['1 blik tomaten (440 g)', '1 tin plum tomatoes (440 g)']);
    expect(both('1 blik gepelde tomaten')).toEqual(['1 blik tomaten', '1 tin plum tomatoes']);
    expect(nl('2 teentjes knoflook [geperst]')).toMatchObject({ unit: 'teen', ing: 'knoflook' });
    expect(nl('1 blik mais')).toMatchObject({ unit: 'blik', ing: 'mais' });
  });

  it('adds "30 g + 40 g" up and keeps the split as a note', () => {
    expect(nl('30 g + 40 g boter')).toMatchObject({ qty: { min: 70 }, unit: 'g', ing: 'boter', note: { nl: '30 g + 40 g', en: '30 g + 40 g' }, confidence: 1 });
    expect(both('30 g + 40 g boter')).toEqual(['70 g boter (30 g + 40 g)', '70 g butter (30 g + 40 g)']);
    expect(nl('2+1 el olijfolie')).toMatchObject({ qty: { min: 3 }, unit: 'el' });
  });

  it('a counted "(blokje)" is the stock cube; a volume with "(blokje)" keeps the note', () => {
    expect(both('1 kippenbouillon (blokje)')).toEqual(['1 kippenbouillonblokje', '1 chicken stock cube']);
    expect(both('2 dl kippenbouillon (blokje)')).toEqual(['2 dl kippenbouillon (blokje)', '200 ml chicken stock (cube)']);
  });

  it('a size word before a slice word describes the slices, not the ingredient', () => {
    expect(both('8 dunne sneetjes stokbrood')).toEqual(['8 sneden stokbrood, dun gesneden', '8 slices baguette, thinly sliced']);
    expect(nl('8 dunne sneetjes stokbrood')).toMatchObject({ qty: { min: 8 }, unit: 'snee', ing: 'stokbrood', prep: { nl: 'dun gesneden', en: 'thinly sliced' } });
    expect(nl('8 dunne sneetjes stokbrood').qual).toBeUndefined();
    expect(both('150 g dunne plakjes pancetta (of bacon)')).toEqual(['150 g pancetta (of bacon), dunne plakjes', '150 g pancetta (or bacon), thinly sliced']);
    expect(both('250 g plakjes achterham')).toEqual(['250 g ham, plakjes', '250 g cooked ham, sliced']);
    // A size word before a plain noun stays a qualifier ("4 dunne preien").
    expect(nl('4 dunne preien [smalle ringen]')).toMatchObject({ ing: 'prei', qual: ['dunne'] });
    expect(nl('1 klein blik mais')).toMatchObject({ unit: 'blik', qual: ['kleine'], ing: 'mais' });
  });

  it('keeps cooking-relevant words: "zonder pit", "gehalveerde", a/b alternatives, "selderijstengels"', () => {
    expect(both('100 g groene olijven zonder pit [kleine stukjes]')).toEqual(['100 g groene olijven, zonder pit; kleine stukjes', '100 g green olives, pitted; small pieces']);
    expect(nl('15 zwarte olijven zonder pit [gehalveerd]')).toMatchObject({ ing: 'olijf', qual: ['zwarte'], prep: { nl: 'zonder pit; gehalveerd', en: 'pitted; halved' } });
    expect(en('125 g kleine gehalveerde champignonhoedjes')).toBe('125 g small halved mushrooms');
    const nuts = nl("50 g ongezouten pinda's/cashewnoten [gehakt]");
    expect(nuts).toMatchObject({ ing: 'pinda', qual: ['ongezouten'], altMode: 'or' });
    expect(nuts.alt?.[0]).toMatchObject({ ing: 'cashewnoot' });
    expect(en("50 g ongezouten pinda's/cashewnoten [gehakt]")).toBe('50 g unsalted peanuts (or cashew nuts), chopped');
    const wine = nl('droge witte/rode wijn');
    expect(wine).toMatchObject({ ing: 'wijn', qual: ['droge', 'witte'] });
    expect(wine.alt?.[0]).toMatchObject({ ing: 'wijn', qual: ['rode'] });
    expect(en('droge witte/rode wijn')).toBe('dry white wine (or red wine)');
    // Synonyms on both sides of the slash stay one product.
    expect(nl('1 tl geelwortel/koenjit')).toMatchObject({ ing: 'kurkuma' });
    expect(nl('1 tl geelwortel/koenjit').alt).toBeUndefined();
    expect(both('5 selderijstengels [gehakt]')).toEqual(['5 stengels bleekselderij, gehakt', '5 stalks celery, chopped']);
    expect(nl('2 knoflookteentjes [gesnipperd]')).toMatchObject({ unit: 'teen', ing: 'knoflook' });
    expect(both('2 laurierblaadjes')).toEqual(['2 laurierblaadjes', '2 bay leaves']);
  });

  it('drops a note that only repeats the product, and turns a lone qualifier in parentheses into a qualifier', () => {
    expect(both('1 tl djinten (komijn)')).toEqual(['1 tl komijn', '1 tsp ground cumin']);
    expect(both('½ tl ketoembar (gemalen koriander)')).toEqual(['½ tl ketoembar', '½ tsp ground coriander']);
    expect(both('2 tl ketoembar (koriander)')).toEqual(['2 tl ketoembar', '2 tsp ground coriander']);
    expect(nl('½ tl trassi (garnalenpasta)').note).toBeUndefined();
    expect(both('80 g (baby-)spinazie')).toEqual(['80 g baby spinazie', '80 g baby spinach']);
    // A note that says something new stays (its English comes from the batch or the review layer).
    expect(nl('400 g pasta (macaroni of penne)')).toMatchObject({ ing: 'pasta', note: { nl: 'macaroni of penne' } });
  });
});

describe('batches: note.en', () => {
  const ID = 'b:macaroni-ham-kaas';
  const recipe = recipes.find((r) => r.id === ID)!;
  const batch = (note: unknown): BatchFile => ({
    batch: 99,
    recipes: [{
      id: ID,
      name: { en: 'Macaroni cheese with ham' },
      category: 'pasta',
      steps: recipe.steps.map(() => ({ en: 'x' })),
      lines: [{ i: 0, ing: 'pasta', note, confidence: 0.9 } as never],
    }],
  });

  it('fills the English of a Dutch note the parser could not translate, and never invents one', () => {
    expect(recipe.lines[0]!.raw.nl).toBe('400 g pasta (macaroni of penne)');
    const ok = checkBatch(batch({ en: 'macaroni or penne' }), recipes, dict);
    expect(ok.errors).toEqual([]);
    const { recipes: out, stats } = applyBatch(recipes, ok.batch!, dict, []);
    expect(out.find((r) => r.id === ID)!.lines[0]!.note).toEqual({ nl: 'macaroni of penne', en: 'macaroni or penne' });
    expect(stats.noteFromLlm).toBe(1);
    expect(checkBatch(batch({ en: 42 }), recipes, dict).errors.join('\n')).toContain('note must be { en }');
    const b = batch({ en: 'nothing to attach to' });
    b.recipes[0]!.lines[0] = { i: 1, ing: recipe.lines[1]!.ing ?? null, note: { en: 'x' } };
    const r = checkBatch(b, recipes, dict);
    expect(r.errors).toEqual([]);
    expect(r.warnings.join('\n')).toContain('note.en given but the line has no Dutch note');
    expect(applyBatch(recipes, r.batch!, dict, []).recipes.find((x) => x.id === ID)!.lines[1]!.note).toBeUndefined();
  });
});

describe('the review layer (data/review/lines.json)', () => {
  const ID = 'b:pasta-met-zalm-en-rucola';
  const review = (line: Record<string, unknown>): ReviewFile => ({ reviewed: '2026-09-29', lines: [{ id: ID, i: 0, raw: '400 g rode zalm', ...line } as never] });

  it('is applied last: the committed file carries tinned red salmon', () => {
    const r = recipes.find((x) => x.id === ID)!;
    expect(r.lines[0]).toMatchObject({ raw: { nl: '400 g rode zalm' }, ing: 'zalm-uit-blik', qual: ['rode'], confidence: 1 });
    expect(renderLine(r.lines[0]!, dict, 'en')).toBe('400 g red tinned salmon');
  });

  it('refuses unknown ids, a raw echo that differs, quantities and empty patches', () => {
    expect(checkReview(review({ ing: 'zalm-uit-blik', qual: ['rode'] }), recipes, dict)).toEqual([]);
    expect(checkReview(review({ ing: 'bestaat-niet' }), recipes, dict).join('\n')).toContain('is not an ingredient id');
    expect(checkReview(review({ ing: 'zalm', qual: ['paars'] }), recipes, dict).join('\n')).toContain('qualifier "paars" does not exist');
    expect(checkReview(review({ raw: '400 g zalm', ing: 'zalm' }), recipes, dict).join('\n')).toContain('differs from the recipe line');
    expect(checkReview(review({ qty: { min: 500 } }), recipes, dict).join('\n')).toContain('"qty" cannot be reviewed');
    expect(checkReview(review({}), recipes, dict).join('\n')).toContain('changes nothing');
    expect(checkReview(review({ id: 'b:nee', ing: 'zalm' }), recipes, dict).join('\n')).toContain('does not exist');
    expect(checkReview({ nope: true }, recipes, dict)).toHaveLength(1);
  });

  it('patches ing, qual, note and prep of one line, leaves everything else untouched', () => {
    const before = JSON.stringify(recipes);
    const { recipes: out, applied } = applyReview(recipes, review({ ing: 'zalm', qual: [], note: { nl: 'x', en: 'y' }, prep: null }));
    expect(applied).toBe(1);
    const r = out.find((x) => x.id === ID)!;
    expect(r.lines[0]).toMatchObject({ ing: 'zalm', note: { nl: 'x', en: 'y' }, confidence: 1, raw: { nl: '400 g rode zalm' }, qty: { min: 400 }, unit: 'g' });
    expect(r.lines[0]!.qual).toBeUndefined();
    expect(r.lines[0]!.prep).toBeUndefined();
    expect(r.lines.slice(1)).toEqual(recipes.find((x) => x.id === ID)!.lines.slice(1));
    expect(out.filter((x, i) => x !== recipes[i])).toHaveLength(1);
    expect(JSON.stringify(recipes)).toBe(before);
  });
});

describe('migration: a serving note is not a step', () => {
  it('moves "Voorgerecht voor 4 personen, hoofdgerecht voor 2 personen." to servingTip', () => {
    expect(splitServingNote(['Voorgerecht voor 4 personen, hoofdgerecht voor 2 personen.', 'Hak de ui.'])).toEqual({ steps: ['Hak de ui.'], servingTip: 'Voorgerecht voor 4 personen, hoofdgerecht voor 2 personen.' });
    expect(splitServingNote(['Hak de ui.', 'Bak.'])).toEqual({ steps: ['Hak de ui.', 'Bak.'], servingTip: null });
    expect(splitServingNote(['Hoofdgerecht voor 4 personen.'])).toEqual({ steps: ['Hoofdgerecht voor 4 personen.'], servingTip: null });
    const r = recipes.find((x) => x.id === 'b:kipsalade-met-bleekselderij')!;
    expect(r.servingTip).toEqual({ nl: 'Voorgerecht voor 4 personen, hoofdgerecht voor 2 personen.', en: 'Starter for 4, main course for 2.' });
    expect(r.steps[0]!.text.nl).toMatch(/^Hak/);
  });
});
