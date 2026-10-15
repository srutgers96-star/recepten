// buildImportPrompt / parsePlainRecipe (docs/phase-2-spec.md §5 "Foto-import"); phase 6 (6A.10,
// 6A.14, 6A.16, 13C): the code-block prompt with the ingredient-line rules, and the repair of a
// copied answer (`normalizePastedAnswer`) with Stijn's two broken copies of 13 October as test cases.
import { describe, expect, it } from 'vitest';
import {
  buildImportPrompt,
  categoryIdFromWord,
  cleanPastedText,
  LINE_RULES,
  normalizePastedAnswer,
  parseBilingualPlain,
  parsePlainRecipe,
  splitCollapsedIngredients,
  tagIdsFromText,
} from '../src/domain/photo-import';

describe('buildImportPrompt', () => {
  it('describes the plain format in both languages', () => {
    const nl = buildImportPrompt('nl');
    expect(nl).toContain('# Naam');
    expect(nl).toContain('## Ingrediënten');
    expect(nl).toContain('## Bereiding');
    expect(nl).toContain('Porties:');
    const en = buildImportPrompt('en');
    expect(en).toContain('# Name');
    expect(en).toContain('## Ingredients');
    expect(en).toContain('## Method');
    expect(en).toContain('Servings:');
  });

  // 13C: the whole answer in ONE code block, so "Copy code" copies line breaks and brackets intact.
  it('asks for the whole answer in one code block and shows the format inside a fence', () => {
    for (const l of ['nl', 'en'] as const) {
      for (const bilingual of [true, false]) {
        const p = buildImportPrompt(l, { bilingual });
        const lines = p.split('\n');
        const fences = lines.map((line, i) => (line.trim() === '```' ? i : -1)).filter((i) => i >= 0);
        expect(fences, `${l} ${bilingual}`).toHaveLength(2);
        expect(p).toContain(l === 'nl' ? 'één codeblok' : 'one code block');
        // The fenced example holds the format block(s), the rules come after the closing fence.
        const inside = lines.slice((fences[0] as number) + 1, fences[1]).join('\n');
        const after = lines.slice((fences[1] as number) + 1).join('\n');
        expect(inside).toContain(bilingual || l === 'nl' ? '# Naam van het gerecht' : '# Name of the dish');
        if (bilingual) expect(inside).toContain('=== EN ===');
        expect(after).toContain(LINE_RULES[l]);
      }
    }
  });

  // 6A.10 / 6A.14 / 6A.16: the ingredient-line rules in every prompt form.
  it('teaches "- " per line, one ingredient per line, no invented amounts and [brackets] for everything but the shop name', () => {
    for (const l of ['nl', 'en'] as const) {
      for (const bilingual of [true, false]) {
        const p = buildImportPrompt(l, { bilingual });
        expect(p).toContain(LINE_RULES[l]);
        if (bilingual || l === 'nl') {
          expect(p).toContain('- 400 g aardappelen');
          expect(p).toContain('- 1 sjalotje [gesnipperd]');
          expect(p).toContain('- koosjer zout [naar smaak]');
          expect(p).toContain('- 2 sneetjes stokbrood [knapperig; of brood; voor erbij]');
        }
        if (bilingual || l === 'en') {
          expect(p).toContain('- 400 g potatoes');
          expect(p).toContain('- 1 shallot [finely chopped]');
          expect(p).toContain('- kosher salt [to taste]');
          expect(p).toContain('- 2 slices baguette [crusty; or bread; to serve]');
        }
      }
    }
    expect(LINE_RULES.nl).toContain('één ingrediënt per regel');
    expect(LINE_RULES.nl).toContain('"zout en peper" wordt twee regels');
    expect(LINE_RULES.nl).toContain('nooit een verzonnen getal');
    expect(LINE_RULES.nl).toContain('kortste naam');
    expect(LINE_RULES.en).toContain('one ingredient per line');
    expect(LINE_RULES.en).toContain('"salt and pepper" becomes two lines');
    expect(LINE_RULES.en).toContain('never becomes an invented number');
    expect(LINE_RULES.en).toContain('shortest name');
    // The meta lines stay.
    expect(buildImportPrompt('nl')).toContain('Categorie: pasta');
    expect(buildImportPrompt('nl')).toContain('Labels: vegetarisch, snel');
  });

  it('asks for the optional category and labels lines and lists the vocabularies', () => {
    const nl = buildImportPrompt('nl', { bilingual: false });
    expect(nl).toContain('Categorie: pasta');
    expect(nl).toContain('Labels: vegetarisch, snel');
    expect(nl).toContain('hartige-taart');
    expect(nl).toContain('glutenvrij-optie');
    const en = buildImportPrompt('en', { bilingual: false });
    expect(en).toContain('Category: pasta');
    expect(en).toContain('Tags: vegetarian, quick');
    for (const l of ['nl', 'en'] as const) {
      const p = buildImportPrompt(l);
      expect(p).toContain('Categorie: pasta');
      expect(p).toContain('Category: pasta');
      expect(p).toContain('Labels:');
      expect(p).toContain('Tags:');
    }
  });
});

describe('parsePlainRecipe', () => {
  it('reads the Dutch format', () => {
    const r = parsePlainRecipe('# Uiensoep\nPorties: 6\n## Ingrediënten\n4 uien\n1 l bouillon\n## Bereiding\nSnipper de uien.\n\nKook 20 minuten.\n');
    expect(r).toEqual({ name: 'Uiensoep', servings: 6, lines: ['4 uien', '1 l bouillon'], steps: ['Snipper de uien.', 'Kook 20 minuten.'] });
  });

  it('reads the English format with bullets, numbers and a numbered method', () => {
    const r = parsePlainRecipe('# Onion soup\nServings: 4\n\n## Ingredients\n- 4 onions\n2. 1 l stock\n\n## Method\n1. Slice the onions.\n2. Simmer for 20 minutes.\n');
    expect(r).toEqual({ name: 'Onion soup', servings: 4, lines: ['4 onions', '1 l stock'], steps: ['Slice the onions.', 'Simmer for 20 minutes.'] });
  });

  it('is lenient about headers without # and a plain first line as the name', () => {
    const r = parsePlainRecipe('Onion soup\nIngredients:\n4 onions\nMethod:\nSlice.\nSimmer.');
    expect(r).toEqual({ name: 'Onion soup', servings: null, lines: ['4 onions'], steps: ['Slice.', 'Simmer.'] });
  });

  it('joins wrapped paragraph lines into one step when paragraphs are blank-line separated', () => {
    const r = parsePlainRecipe('# X\n## Bereiding\nKook de aardappelen\nin 20 minuten gaar.\n\nStamp ze fijn.');
    expect(r?.steps).toEqual(['Kook de aardappelen in 20 minuten gaar.', 'Stamp ze fijn.']);
  });

  it('keeps a header line ("Dressing:") among the ingredients and a Naam: key', () => {
    const r = parsePlainRecipe('Naam: Salade\n## Ingrediënten\nDressing:\n2 el olie\n## Bereiding\nMeng.');
    expect(r?.name).toBe('Salade');
    expect(r?.lines).toEqual(['Dressing:', '2 el olie']);
  });

  it('reads Categorie:/Labels: and Category:/Tags: lines into ids, dropping unknown words', () => {
    const nl = parsePlainRecipe('# Uiensoep\nPorties: 6\nCategorie: Soep\nLabels: vegetarisch, snel, onbekend\n## Ingrediënten\n4 uien\n## Bereiding\nKook.');
    expect(nl).toEqual({ name: 'Uiensoep', servings: 6, category: 'soep', tags: ['vegetarisch', 'snel'], lines: ['4 uien'], steps: ['Kook.'] });
    const en = parsePlainRecipe('# Pie\n**Category:** Savoury pie\nTags: vegetarian; quick and oven\n## Ingredients\n1 egg\n## Method\nBake.');
    expect(en?.category).toBe('hartige-taart');
    expect(en?.tags).toEqual(['vegetarisch', 'snel', 'oven']);
    // Unknown category: no key at all; no lines: no keys at all (the editor keeps its own values).
    const odd = parsePlainRecipe('# X\nCategorie: Toetje\nLabels: -\n## Ingrediënten\n1 ei\n## Bereiding\nRoer.');
    expect(odd).not.toHaveProperty('category');
    expect(odd?.tags).toEqual([]);
    const none = parsePlainRecipe('# X\n## Ingrediënten\n1 ei\n## Bereiding\nLabels: dit is een stap.');
    expect(none).not.toHaveProperty('category');
    expect(none).not.toHaveProperty('tags');
    expect(none?.steps).toEqual(['Labels: dit is een stap.']);
  });

  it('maps category and tag words in both languages, tolerant of case, diacritics and decoration', () => {
    expect(categoryIdFromWord('Wok & noedels')).toBe('wok-noedels');
    expect(categoryIdFromWord('Wok & noodles')).toBe('wok-noedels');
    expect(categoryIdFromWord('Pasta (vegetarisch)')).toBe('pasta');
    expect(categoryIdFromWord('hartige-taart')).toBe('hartige-taart');
    expect(categoryIdFromWord('Stamppot (Dutch mash)')).toBe('stamppot');
    expect(categoryIdFromWord('Dessert')).toBeUndefined();
    expect(tagIdsFromText('gluten-free, plant-based, kids')).toEqual(['glutenvrij', 'vegan', 'kids']);
    expect(tagIdsFromText('Vegetarisch · Zomer · vegetarisch')).toEqual(['vegetarisch', 'zomer']);
    expect(tagIdsFromText('veggie option / world')).toEqual(['vega-optie', 'wereld']);
    expect(tagIdsFromText('')).toEqual([]);
  });

  it('returns null for text without a recipe', () => {
    expect(parsePlainRecipe('')).toBeNull();
    expect(parsePlainRecipe('   \n\n')).toBeNull();
    expect(parsePlainRecipe('## Ingrediënten\n\n## Bereiding\n')).toBeNull();
  });

  // 6A.10: an answer in the new line shape arrives in the editor verbatim (the parser reads the brackets).
  it('keeps [bracket] lines exactly as the AI wrote them, "- " stripped, headings included', () => {
    const r = parsePlainRecipe(
      '# Soep\n## Ingrediënten\n- 1 sjalotje [gesnipperd]\n- koosjer zout [naar smaak]\n- Erbij:\n- 2 sneetjes stokbrood [knapperig; of brood; voor erbij]\n## Bereiding\nKook.',
    );
    expect(r?.lines).toEqual(['1 sjalotje [gesnipperd]', 'koosjer zout [naar smaak]', 'Erbij:', '2 sneetjes stokbrood [knapperig; of brood; voor erbij]']);
  });

  it('reads the meta lines in the shapes assistants actually produce', () => {
    const bold = parsePlainRecipe('# Pasta pesto\n**Porties:** 4\n**Categorie:** Pasta\n**Labels:** Vegetarisch · Snel\n## Ingrediënten\n300 g pasta\n## Bereiding\nKook.');
    expect(bold?.servings).toBe(4);
    expect(bold?.category).toBe('pasta');
    expect(bold?.tags).toEqual(['vegetarisch', 'snel']);
  });
});

// --- 13C: the damage of copying a rendered answer, undone -----------------------------------------

/** Stijn's screenshot of 13 October: the French onion soup ingredients, one line, escaped brackets. */
const STIJN_INGREDIENTS =
  '### Ingrediënten\n\n1,5 kg uien \\[in plakken\\] 1 bol knoflook \\[in plakjes\\] 75 g boter zout peper 1 tl suiker 3 el bloem 2 l warme runderbouillon 1-2 el Noilly Prat 1-2 el cognac 200 g Gruyère 1 hard/oud stokbrood \\[met stevige structuur\\] 2 takjes tijm \\[ter garnering\\]';

/** Stijn's other screenshot: the whole answer landed in the Name field as one line. */
const STIJN_NAME_FIELD =
  '=== NL === # Broccoli quiche Porties: 4 Categorie: hartige taart Labels: vegetarisch, oven ## Ingrediënten - 1 rol bladerdeeg - 400 g broccoli - 3 eieren - 150 ml room - 100 g geraspte kaas - zout - peper ## Bereiding 1. Verwarm de oven voor op 200 °C. 2. Snijd de broccoli in roosjes en kook 3 minuten. 3. Klop de eieren met de room. === EN === # Broccoli quiche Servings: 4 Category: savoury pie Tags: vegetarian, oven ## Ingredients - 1 roll puff pastry - 400 g broccoli - 3 eggs - 150 ml cream - 100 g grated cheese - salt - pepper ## Method 1. Preheat the oven to 200 °C. 2. Cut the broccoli into florets and boil for 3 minutes. 3. Beat the eggs with the cream.';

describe('normalizePastedAnswer (13C)', () => {
  it("Stijn's collapsed ingredient line: 13 products, one per line, brackets unescaped", () => {
    const r = parsePlainRecipe(STIJN_INGREDIENTS);
    expect(r?.lines).toEqual([
      '1,5 kg uien [in plakken]',
      '1 bol knoflook [in plakjes]',
      '75 g boter',
      'zout',
      'peper',
      '1 tl suiker',
      '3 el bloem',
      '2 l warme runderbouillon',
      '1-2 el Noilly Prat',
      '1-2 el cognac',
      '200 g Gruyère',
      '1 hard/oud stokbrood [met stevige structuur]',
      '2 takjes tijm [ter garnering]',
    ]);
    expect(normalizePastedAnswer(STIJN_INGREDIENTS)).not.toContain('\\');
  });

  it("Stijn's Name-field text falls apart into both blocks again, meta lines included", () => {
    const r = parseBilingualPlain(STIJN_NAME_FIELD);
    expect(r.mismatch).toBeUndefined();
    expect(r.first).toBe('nl');
    expect(r.nl).toEqual({
      name: 'Broccoli quiche',
      servings: 4,
      category: 'hartige-taart',
      tags: ['vegetarisch', 'oven'],
      lines: ['1 rol bladerdeeg', '400 g broccoli', '3 eieren', '150 ml room', '100 g geraspte kaas', 'zout', 'peper'],
      steps: ['Verwarm de oven voor op 200 °C.', 'Snijd de broccoli in roosjes en kook 3 minuten.', 'Klop de eieren met de room.'],
    });
    expect(r.en?.name).toBe('Broccoli quiche');
    expect(r.en?.lines).toEqual(['1 roll puff pastry', '400 g broccoli', '3 eggs', '150 ml cream', '100 g grated cheese', 'salt', 'pepper']);
    expect(r.en?.steps).toEqual(['Preheat the oven to 200 °C.', 'Cut the broccoli into florets and boil for 3 minutes.', 'Beat the eggs with the cream.']);
    expect(r.en?.category).toBe('hartige-taart');
  });

  it('a clean answer comes back unchanged (idempotent)', () => {
    const clean = '=== NL ===\n# Uiensoep\nPorties: 6\nCategorie: soep\n## Ingrediënten\n- 4 uien [gesnipperd]\n- 1 l bouillon\n## Bereiding\nSnipper de uien.\n\nKook 20 minuten.\n\n=== EN ===\n# Onion soup\nServings: 6\n## Ingredients\n- 4 onions [finely chopped]\n- 1 l stock\n## Method\nSlice the onions.\n\nSimmer for 20 minutes.\n';
    expect(normalizePastedAnswer(clean)).toBe(clean);
    expect(normalizePastedAnswer(normalizePastedAnswer(STIJN_NAME_FIELD))).toBe(normalizePastedAnswer(STIJN_NAME_FIELD));
  });

  it('keeps only what is inside the code block: chatter before and after it is gone', () => {
    const r = parseBilingualPlain('Natuurlijk! Hier is het recept:\n```\n# Uiensoep\n## Ingrediënten\n- 4 uien\n## Bereiding\nKook 20 minuten.\n```\nLaat weten als je nog iets wilt aanpassen! Eet smakelijk.');
    expect(r.nl?.name).toBe('Uiensoep');
    expect(r.nl?.steps).toEqual(['Kook 20 minuten.']);
    // Two fenced blocks with the language markers outside them.
    const two = parseBilingualPlain('=== NL ===\n```\n# Soep\n## Ingrediënten\n- 1 ui\n## Bereiding\nKook.\n```\n=== EN ===\n```\n# Soup\n## Ingredients\n- 1 onion\n## Method\nBoil.\n```\nDone!');
    expect(two.nl?.name).toBe('Soep');
    expect(two.en?.name).toBe('Soup');
    expect(two.en?.steps).toEqual(['Boil.']);
    expect(two.mismatch).toBeUndefined();
  });

  it('numbered steps that ran together are split again, in order only', () => {
    const r = parsePlainRecipe('# Soep\n## Ingrediënten\n- 1 ui\n## Bereiding\n1. Verwarm de oven voor op 200 °C. 2. Snijd de ui in 2 stukken en kook hem 3 minuten. 3. Serveer.');
    expect(r?.steps).toEqual(['Verwarm de oven voor op 200 °C.', 'Snijd de ui in 2 stukken en kook hem 3 minuten.', 'Serveer.']);
  });

  it('markers mid-line without "#": "Ingrediënten" and "Bereiding" as plain capitalised headings', () => {
    const r = parsePlainRecipe('Broccoli quiche Porties: 4 Ingrediënten - 400 g broccoli - 3 eieren Bereiding Verwarm de oven. Bak 30 minuten.');
    expect(r?.name).toBe('Broccoli quiche');
    expect(r?.servings).toBe(4);
    expect(r?.lines).toEqual(['400 g broccoli', '3 eieren']);
    expect(r?.steps).toEqual(['Verwarm de oven. Bak 30 minuten.']);
    expect(parsePlainRecipe('Soup Servings: 4 Ingredients 1 onion 2 carrots Method 1. Chop. 2. Cook.')?.steps).toEqual(['Chop.', 'Cook.']);
  });

  it('a capitalised heading word inside a step is not a heading', () => {
    const r = parsePlainRecipe('# Soep\n## Ingrediënten\n- 1 ui\n## Bereiding\nSnijd de ui. Serveer de soep met brood; de Bereiding van de saus staat hieronder.');
    expect(r?.steps).toEqual(['Snijd de ui. Serveer de soep met brood; de Bereiding van de saus staat hieronder.']);
    const packet = parsePlainRecipe('# Soep\n## Ingrediënten\n- 1 ui\n## Bereiding\n1. Volg de Instructions op de verpakking.\n2. Serveer.');
    expect(packet?.steps).toEqual(['Volg de Instructions op de verpakking.', 'Serveer.']);
    const en = parsePlainRecipe('# Soup\n## Ingredients\n- 1 onion\n## Method\n1. Follow the Directions on the packet.\n2. Serve.');
    expect(en?.steps).toEqual(['Follow the Directions on the packet.', 'Serve.']);
  });

  it('the translation markers I1/S1 run together land on their own lines', () => {
    expect(normalizePastedAnswer('I1. 4 onions I2. 1 l stock S1. Slice the onions. S2. Simmer.')).toBe('I1. 4 onions\nI2. 1 l stock\nS1. Slice the onions.\nS2. Simmer.');
  });

  it('cleanPastedText: CRLF, no-break spaces, zero-width characters and escapes; fences stay', () => {
    expect(cleanPastedText('a\r\nb\u00A0c\u200Bd \\[x\\] \\* \\_ \\#\n```')).toBe('a\nb cd [x] * _ #\n```');
  });
});

describe('splitCollapsedIngredients', () => {
  it('splits before a quantity after a word and after every "]" tail; salt and pepper become their own lines', () => {
    expect(splitCollapsedIngredients('1 ui [gesnipperd] 2 el olie 75 g boter zout peper 1 tl suiker')).toEqual(['1 ui [gesnipperd]', '2 el olie', '75 g boter', 'zout', 'peper', '1 tl suiker']);
    expect(splitCollapsedIngredients('1 onion [chopped] 2 tbsp oil 75 g butter salt pepper 1 tsp sugar')).toEqual(['1 onion [chopped]', '2 tbsp oil', '75 g butter', 'salt', 'pepper', '1 tsp sugar']);
    expect(splitCollapsedIngredients('- 1 ui - 2 el olie - zout')).toEqual(['1 ui', '2 el olie', 'zout']);
  });

  it('leaves a single ingredient alone, whatever numbers it holds', () => {
    for (const line of [
      '2 x 400 g tomatenblokjes',
      '1 blik (400 g) tomaten',
      '4 zalmfilets van 150 g',
      '2 el olijfolie',
      '1 ui [gesnipperd]',
      'bloem type 00',
      '200 g boter, grof zout en peper',
      'zout en peper',
      'koosjer zout [naar smaak]',
      '1 1/2 el mayonaise',
      '30 g + 40 g boter',
      '1 of 2 meloenen',
      'ca. 400 g aardappelen',
      '2 sneetjes stokbrood [knapperig; of brood; voor erbij]',
      // A note, an alternative or a pack size after the "]" belongs to the same ingredient.
      '50 g walnoten [gehakt] (optioneel)',
      '50 g walnuts [chopped] (optional)',
      '2 el olijfolie [extra vierge] (plus extra om te besprenkelen)',
      '1 ui [gesnipperd] of 2 sjalotjes',
      '1 onion [chopped] or 2 shallots',
      '2 courgettes [in plakjes] (ca. 500 g)',
      '400 g kipfilet [in blokjes] (of kipdijfilet)',
      // A quantity + unit that ends the line is the pack size, not a next ingredient.
      '1 blik kokosmelk 400 ml',
      '1 pot pesto 190 g',
      '1 pak filodeeg 270 g',
      '1 tin coconut milk 400 ml',
      '1 blik kikkererwten 400 g [uitgelekt]',
      // "1 - 2" is a range, not two bullets.
      '- 1 - 2 tl sambal',
    ]) {
      expect(splitCollapsedIngredients(line), line).toEqual([line]);
    }
    // One mid-line number without a second signal is left alone too (better unsplit than wrongly split).
    expect(splitCollapsedIngredients('100 g kaas 2 eieren')).toEqual(['100 g kaas 2 eieren']);
    // A quantity with a product after it is still a next ingredient.
    expect(splitCollapsedIngredients('1 ui [gesnipperd] 400 g tomaten [in blokjes]')).toEqual(['1 ui [gesnipperd]', '400 g tomaten [in blokjes]']);
    // The whole answer: one line per ingredient, nothing phantom.
    const r = parsePlainRecipe('# Soep\n## Ingrediënten\n- 1 ui [gesnipperd]\n- 50 g walnoten [gehakt] (optioneel)\n- 1 blik kokosmelk 400 ml\n## Bereiding\nKook.');
    expect(r?.lines).toEqual(['1 ui [gesnipperd]', '50 g walnoten [gehakt] (optioneel)', '1 blik kokosmelk 400 ml']);
  });

  it('"grof zout", "zeezout", "peper en zout" and "witte peper" are never split', () => {
    expect(splitCollapsedIngredients('1 tl grof zout 1 tl witte peper')).toEqual(['1 tl grof zout', '1 tl witte peper']);
    expect(splitCollapsedIngredients('100 g boter peper en zout 1 tl suiker')).toEqual(['100 g boter peper en zout', '1 tl suiker']);
    expect(splitCollapsedIngredients('200 g spek zeezout 1 tl suiker')).toEqual(['200 g spek zeezout', '1 tl suiker']);
  });
});

describe('buildImportPrompt (bilingual, the default)', () => {
  it('asks for an NL block and an EN block with equal counts', () => {
    for (const l of ['nl', 'en'] as const) {
      const p = buildImportPrompt(l);
      expect(p).toContain('=== NL ===');
      expect(p).toContain('=== EN ===');
      expect(p).toContain('## Ingrediënten');
      expect(p).toContain('## Ingredients');
      expect(p).toContain('Porties: 4');
      expect(p).toContain('Servings: 4');
    }
    expect(buildImportPrompt('nl', { bilingual: false })).not.toContain('=== EN ===');
    expect(buildImportPrompt('en', { bilingual: false })).toContain('# Name');
  });
});

const NL_BLOCK = '# Uiensoep\nPorties: 6\n## Ingrediënten\n4 uien\n1 l bouillon\n## Bereiding\nSnipper de uien.\n\nKook 20 minuten.\n';
const EN_BLOCK = '# Onion soup\nServings: 6\n## Ingredients\n4 onions\n1 l stock\n## Method\nSlice the onions.\n\nSimmer for 20 minutes.\n';

describe('parseBilingualPlain', () => {
  it('carries category and tags per block', () => {
    const r = parseBilingualPlain(`=== NL ===\n# Soep\nCategorie: soep\nLabels: snel\n## Ingrediënten\n1 ui\n## Bereiding\nKook.\n=== EN ===\n# Soup\nCategory: Soup\nTags: quick\n## Ingredients\n1 onion\n## Method\nBoil.`);
    expect(r.mismatch).toBeUndefined();
    expect(r.nl?.category).toBe('soep');
    expect(r.en?.category).toBe('soep');
    expect(r.nl?.tags).toEqual(['snel']);
    expect(r.en?.tags).toEqual(['snel']);
  });

  it('reads two blocks', () => {
    const r = parseBilingualPlain(`=== NL ===\n${NL_BLOCK}\n=== EN ===\n${EN_BLOCK}`);
    expect(r.mismatch).toBeUndefined();
    expect(r.first).toBe('nl');
    expect(r.nl).toEqual({ name: 'Uiensoep', servings: 6, lines: ['4 uien', '1 l bouillon'], steps: ['Snipper de uien.', 'Kook 20 minuten.'] });
    expect(r.en).toEqual({ name: 'Onion soup', servings: 6, lines: ['4 onions', '1 l stock'], steps: ['Slice the onions.', 'Simmer for 20 minutes.'] });
  });

  it('reads a single Dutch block without markers', () => {
    const r = parseBilingualPlain(NL_BLOCK);
    expect(r.en).toBeUndefined();
    expect(r.first).toBe('nl');
    expect(r.nl?.name).toBe('Uiensoep');
    expect(r.nl?.lines).toEqual(['4 uien', '1 l bouillon']);
  });

  it('reads a single English block without markers (language from the headers)', () => {
    const r = parseBilingualPlain(EN_BLOCK);
    expect(r.nl).toBeUndefined();
    expect(r.first).toBe('en');
    expect(r.en?.name).toBe('Onion soup');
    expect(r.en?.steps).toEqual(['Slice the onions.', 'Simmer for 20 minutes.']);
  });

  it('returns both blocks plus the mismatch when the counts differ', () => {
    const en = '# Onion soup\n## Ingredients\n4 onions\n1 l stock\n2 tbsp butter\n## Method\nSlice the onions. Simmer for 20 minutes.\n';
    const r = parseBilingualPlain(`=== NL ===\n${NL_BLOCK}\n=== EN ===\n${en}`);
    expect(r.nl?.lines).toHaveLength(2);
    expect(r.en?.lines).toHaveLength(3);
    expect(r.mismatch).toEqual({ lines: [2, 3], steps: [2, 1] });
    expect(r.first).toBe('nl');
  });

  it('ignores prose around the blocks and tolerates decorated markers', () => {
    const text = `Here is the recipe in both languages:\n\n**=== NL ===**\n${NL_BLOCK}\n### === EN ===\n${EN_BLOCK}\n---\nLet me know if you want any changes!\n`;
    const r = parseBilingualPlain(text);
    expect(r.mismatch).toBeUndefined();
    expect(r.nl?.name).toBe('Uiensoep');
    expect(r.en?.name).toBe('Onion soup');
    expect(r.en?.steps).toEqual(['Slice the onions.', 'Simmer for 20 minutes.']);
    // Chatter before a single block never becomes the name when a "# Name" line follows.
    const single = parseBilingualPlain('Sure! Here it is:\n\n```\n' + EN_BLOCK + '```\n');
    expect(single.en?.name).toBe('Onion soup');
    expect(single.en?.lines).toEqual(['4 onions', '1 l stock']);
  });

  it('accepts the marker forms assistants make of "=== NL ===", but not a bare Dutch "en"', () => {
    const r = parseBilingualPlain(`## Nederlands\n${NL_BLOCK}\n**English:**\n${EN_BLOCK}`);
    expect(r.mismatch).toBeUndefined();
    expect(r.nl?.name).toBe('Uiensoep');
    expect(r.en?.name).toBe('Onion soup');
    const paren = parseBilingualPlain(`(NL)\n${NL_BLOCK}\n(EN)\n${EN_BLOCK}`);
    expect(paren.nl?.lines).toEqual(['4 uien', '1 l bouillon']);
    expect(paren.en?.lines).toEqual(['4 onions', '1 l stock']);
    // A step that is only the word "en" (Dutch "and") does not start an English block.
    const odd = parseBilingualPlain(`=== NL ===\n# Soep\n## Bereiding\nRoer\n\nen\n\nproef.\n`);
    expect(odd.en).toBeUndefined();
    expect(odd.nl?.steps).toEqual(['Roer', 'en', 'proef.']);
  });

  it('returns nothing for text without a recipe', () => {
    expect(parseBilingualPlain('')).toEqual({});
    expect(parseBilingualPlain('=== NL ===\n\n=== EN ===\n')).toEqual({});
  });
});
