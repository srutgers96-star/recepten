# Phase 2 — "Structuur & Engels" — build spec

Goal (PLAN.md §10 phase 2, decisions §0): the 196 classics become **structured** (every ingredient
line coded against a bilingual dictionary) and **bilingual** (names, steps, prep notes in English),
so that the girlfriend gets the whole book in English, quantities scale, and phase 4 can add up a
shopping list. No LLM runs inside the app: the translation/structuring pass is done once, by agents in
Claude Code sessions, into committed data files that a script validates.

Binding for all agents. Contracts marked **CONTRACT** cross ownership boundaries.

## 1. Data files (`data/`) — CONTRACT (all UTF-8 JSON, arrays sorted by `id`, 2-space indent)

- `units.json`: `{ id, group: 'mass'|'volume'|'count'|'package'|'pinch'|'length', g?: number, ml?: number,
  nl: { one, many?, long? }, en: { one, many?, long?, render?: string, scale?: number }, aliases?: { nl?: string[], en?: string[] } }`.
  Ids seen in the corpus (docs/measure-parse.md): g, kg, ml, dl, l, el (15 ml, tbsp), tl (5 ml, tsp), mp
  (mespunt, pinch), snuf (snufje, pinch), kop (250 ml, cup — Dutch cup), teen (teentje/clove; buy: bol),
  blik (tin), blikje→blik alias, pak (pack), zak (bag), pot (jar), bos (bunch), takje (sprig), stengel (stalk),
  plak (slice), snee (slice of bread), scheut (splash/dash), beker (tub), bakje (tub), klont (knob), hand
  (handful), blad (leaf), cm, fles (bottle), glas (glass), stuk (piece), druppel (drop), envelopje (sachet),
  zakje (sachet), bol (bulb), kopje→kop alias. `dl` renders in EN as ml ×100 (Britons don't use dl).
- `qualifiers.json`: `{ id, nl: string[], en: string, kind: 'colour'|'size'|'state'|'variety'|'fat'|'other', variant: boolean }`
  — `variant: true` means the qualifier makes a different shopping item (rode ui ≠ ui; kruimige ≠
  vastkokende aardappelen); `false` = a note (grote, kleine, middelgrote, verse, rijpe).
- `prep-phrases.json`: `{ nl: string, en: string, enSliced?: string }` plus templates with `{n}`: `"blokjes van {n} cm"` →
  `"{n} cm dice"`, `"stukken van {n} cm"` → `"{n} cm pieces"`, `"reepjes van {n} cm"` → `"{n} cm strips"`.
  ~120 entries covering every bracket note in the corpus (measure them: all `[…]` texts, deduplicated).
  `enSliced` is used for ingredients with `cut: 'slice'` ("fijngesneden": finely chopped herbs, finely sliced onion).
- `categories.json`: `{ id, nl, en, order }`: soep, salade, hartige-taart, pasta, rijst, vlees, vis,
  stamppot, oven, wok-noedels, overig.
- `aisles.json`: `{ id, nl, en, order }` — one standard supermarket order for everyone, including aisles
  without recipe ingredients (decision §0): groente-fruit, brood-ontbijt, vlees-vis, zuivel-eieren, kaas,
  droog (pasta/rijst/granen/peulvruchten), blik-pot, kruiden-specerijen, sauzen-olie-azijn, wereld,
  bakken (bloem/suiker), diepvries, dranken, snacks-zoet, huishoudelijk, drogisterij, overig.
- `ingredients.json` (the dictionary, ~400-450 entries): `{ id, nl: { one, many? }, en: { one, many? },
  aliases?: { nl?: string[], en?: string[] }, aisle, defaultUnit: 'stuk'|<unit id>|null, buyUnit?: string,
  gramsPer?: Record<string, number>, staple: boolean, veg: boolean, perishable?: boolean, gloss?: { en: string },
  cut?: 'slice'|'chop', unitNames?: Record<unitId, { nl?: {one, many?}, en?: {one, many?} }> }` (`unitNames`: how a unit
  of this product is called, foelie `{ stuk: { en: { one: 'blade' } } }` → "1 blade mace").
  Id rules: slug of the Dutch singular base noun (`ui`, `knoflook`, `rode-peper`, `zure-room`,
  `zout-en-peper`); a **different product** is a different id (rode peper ≠ zwarte peper; kruimige
  aardappelen and vastkokende aardappelen are ONE id `aardappel` with qualifier variants; `rode ui` is
  `ui` + variant qualifier `rode`). Compound pantry items are entries (`zout-en-peper`,
  `olie-en-boter-om-in-te-bakken`, staple). Dutch-only products get a `gloss.en` ("rookworst — Dutch
  smoked sausage"). `staple` = pantry (zout, peper, olie, boter, suiker, bloem, azijn, sojasaus, bouillon-
  blokje, kruiden gedroogd). `veg` = vegetarian ingredient.
- `recipes.json` (`{ schema: 2, dataVersion: 2, generatedAt, recipes[] }`): every recipe gets `name.en`,
  `steps[].text.en`, `servingTip.en` if present, `category`, `tags` (subset of: vegetarisch, vega-optie,
  snel, oven, wok, kids, wereld, feest, zomer, winter), `time: { active, total }` (minutes, estimated from
  the text), `text: { en: 'llm' }`, and structured `lines` (see §2). Quantities in the Dutch raw line are
  the source of truth and are NEVER changed by the pass.
- `data/llm/` — the batch outputs (`batch-01.json` …) committed as provenance; `tools/apply-llm-batch.ts`
  merges them. `data/README.md` documents all files.

## 2. Structured ingredient line — CONTRACT (`src/domain/model.ts`, extend `Line`)

```ts
export interface Line {
  raw: Text;                         // original line, never removed
  kind?: 'line' | 'header';          // "Dressing:" → header
  qty?: { min: number; max?: number; approx?: boolean } | null;   // "2-3", "ca."; null = no quantity
  unit?: string | null;              // units.json id; null = counted pieces (defaultUnit) or no unit
  ing?: string | null;               // ingredients.json id; null = free text (not resolved)
  qual?: string[];                   // qualifiers.json ids ("rode", "grote", "verse")
  part?: 'sap' | 'rasp' | 'wit' | 'geel' | 'blaadjes' | null;    // "sap van ½ limoen"
  prep?: Text | null;                // from [brackets]
  note?: Text | null;                // (parentheses) that are not alternatives/pack sizes
  packSize?: string | null;          // "(400 g)", "van 150 g"
  alt?: Line[]; altMode?: 'or' | 'and-or';   // "(of kabeljauw)", "en/of"
  optional?: boolean;                // "naar smaak", "(garnering)", "evt."
  role?: 'main' | 'garnish';
  confidence?: number;               // 0-1 from the parser/LLM; UI shows a hint below 0.6
  [k: string]: unknown;
}
```

## 3. Domain modules — CONTRACT (framework-free, `src/domain/`)

- `dictionary.ts`: `loadDictionary(data: { units, qualifiers, prepPhrases, ingredients, aisles, categories }): Dictionary`
  (built from the JSON imports; memoised); `Dictionary` offers `ingredientByName(text, lang)`,
  `unitByAlias(text, lang)`, `qualifierByWord(word, lang)`, `prepFor(nl: string): Text`, `get(id)`,
  `search(query, lang)` (diacritic-insensitive, singular/plural/alias), plus **user overrides**:
  `withUserEntries(dict, entries: Ingredient[])` (new ingredients a user created travel in tokens later).
- `parser.ts`: `parseLine(raw: string, dict: Dictionary, lang: Lang): Line` — deterministic grammar from
  PLAN.md §5 "Parser": qty (`\d+([.,]\d+)?`, unicode fractions ½¼¾⅓⅔, `1 1/2`, `1½`, ranges `2-3`, `2 à 3`,
  `1 of 2`), optional `ca.`/`circa`/`±` → approx, unit by longest alias match, then qualifiers at the start
  of the name, `sap van`/`rasp van`/`het wit van` → part, parentheses classified (alternative `of X` /
  `en/of` → alt; `\d+\s?(g|ml|kg)` → packSize; else note), `[…]` → prep via prep-phrases (templated),
  `naar smaak`/`(garnering)`/`evt.`/`eventueel` → optional/garnish, trailing `:` → header; the remaining
  name resolved in the dictionary (singular/plural/aliases, diacritics folded) else `ing: null`. English
  input uses the English unit/qualifier tables and `.` decimals. `confidence` reflects how much was resolved.
- `render.ts`: `renderLine(line: Line, dict: Dictionary, lang: Lang, factor = 1): string` — "250 g
  schelvisfilet (of kabeljauw), stukken van 2-3 cm" / "250 g haddock fillet (or cod), 2-3 cm pieces";
  `formatQty(min, max?, lang)` (½, 1½, 2-3; EN decimals for non-fraction values), scaling with the
  rounding rules from PLAN.md §8 step 5 (pieces → sensible fractions ½/¼ or ceil for scaling up; g/ml
  rounded to 5/10/50 by magnitude; pinches never scale); unresolved lines render `raw` (scaled only when
  the qty was parsed). `renderLineParts(...)` returns `{ qty, unit, name, prep, note, alt }` for the UI chips.
- `scale.ts`: `scaleFactor(servings, base = 4)`, `scaleQty(q, factor)` with the rounding rules.
- `search.ts`: bilingual recipe search: name (both languages), ingredient ids → both names, categories,
  tags; diacritic-insensitive; `searchRecipes(recipes, query, dict, lang)` returns grouped results
  (name matches first, then ingredient matches).

## 4. Tools (Node 22 strip-types, `tools/`)

- `tools/build-dictionary-seed.ts`: runs the parser WITHOUT ingredient resolution over
  `data/source/recipes-recepten2.json`, writes `data/work/name-parts.json` = unique name parts with
  counts and example lines (input for the dictionary agents).
- `tools/measure-resolution.ts`: parses all lines with the current dictionary, prints resolved %, lists
  unresolved name parts by frequency, writes `docs/measure-resolution.md`.
- `tools/apply-llm-batch.ts`: validates one or all `data/llm/batch-*.json` (schema below) and merges
  into `data/recipes.json` and `data/ingredients.json` (new entries), refusing when quantities differ
  from the raw line, when step counts differ per language, or when an `ing` id does not exist.
- `tools/validate-data.ts` (extend): schema-2 rules incl. dictionary references, `name.en` present for
  builtins when `text.en` is set, equal step counts, qualifiers/units ids exist, categories exist.
- `tools/gen-golden.ts`: regenerates `tests/parser.golden.json` = every unique raw line → `{ line, nl, en }`
  (parse + rendered NL + rendered EN). The test `tests/parser.golden.test.ts` compares; a change must be
  intentional (regenerate + commit).
- `npm run migrate` keeps producing `data/recipes.json` deterministically from the source PLUS the
  committed enrichment: `data/llm/*.json` are the LLM results; migration = parse(raw) ⊕ llm enrichment.
  Order of truth: raw line (quantities, unit) → parser → LLM `ing`/`prep.en`/`note.en` only where the
  parser returned null or the LLM had higher confidence → the human-reviewed override
  (`data/review/lines.json`, `tools/apply-review.ts`: per line `ing`, `qual`, `note`, `prep`, `optional`;
  never quantities) wins over both.

### Batch file schema (`data/llm/batch-NN.json`) — CONTRACT

```jsonc
{ "batch": 1, "model": "claude (session)", "at": "2026-09-29", "recipes": [
  { "id": "b:afwasmachinezalm",
    "name": { "en": "Dishwasher salmon" },
    "description": { "nl": "…optional 1 sentence…", "en": "…" },
    "category": "vis", "tags": ["snel"], "time": { "active": 20, "total": 90 },
    "steps": [ { "en": "…" }, … ],                  // exactly as many as steps[] in recipes.json, same order
    "servingTip": { "en": "…" },                    // only if the recipe has one
    "lines": [                                      // one per non-header line, same order
      { "i": 0, "ing": "zalmfilet", "qual": [], "prep": { "en": "…" }, "note": { "en": "…" }, "confidence": 0.95 },
                                                    // note.en: English for the parser's Dutch (…) note the dictionary could not translate
      { "i": 3, "ing": "NEW", "new": { "id": "gestoomde-makreel", "nl": {"one": "gestoomde makreel"}, "en": {"one": "smoked mackerel"}, "aisle": "vlees-vis", "defaultUnit": "g", "staple": false, "veg": false } }
    ] } ] }
```
British English, metric, tbsp/tsp/tin/clove; never restate quantities; keep the tone of the Dutch.

## 5. App (phase-2 core)

- Detail, cook mode, list rows and search render ingredient lines through `renderLine` in the active
  language; unresolved lines show raw text with a small "?" chip (tap → "Koppel ingrediënt": search the
  dictionary, pick → stored as a **line override** on the recipe (`ing`, `qual`) — for builtins in
  `overrides`-like storage keyed by recipe id + line index (table `lineOverrides: '[recipeId+index]'`),
  for user recipes directly in the line).
- **Servings scaler** on detail and cook mode: 2 / 4 / 6 / 8 (and −/+), default 4 (decision §0); the
  original quantity shown muted when scaled; step texts never rewritten.
- **English units/temperatures**: names only (tbsp/tsp/clove/tin/bunch/sprig, dl→ml), °C stays; setting
  "°F erbij" appends the oven table value (160→325, 180→350, 200→400, 220→425) to `{temp:…}` tokens —
  steps that contain `\d{3}\s?(°C|℃)` render as "200 °C (400 °F)" when enabled.
- **Categories** on Home (shelf of tiles with counts) and **filter chips** on the Recipes list
  (vegetarisch, snel, oven, vis, kip, wereld) from `tags`/`category`; category editable from the detail
  page (own recipes) — builtins: "Hercategoriseer" stored as an override.
- **Bilingual search** (`search.ts`) in the Recipes list: typing "onion" finds recipes with `ui`.
- **Editor**: each ingredient input gets live chips below it (`renderLineParts`): `[2] [el] [olijfolie ✓]`
  or `[?]` when unresolved with "Koppel" / "Nieuw ingrediënt" (creates a user dictionary entry:
  nl/en/aisle; stored in table `userIngredients: 'id'`, merged into the dictionary at load); tapping a
  chip opens an inline editor for qty/unit/prep/optional. "Bewaar als tekst" always possible.
  **Language pair**: side-by-side editor when "beide" (already) + a **"Kopieer voor vertaling"** button
  (puts a fixed numbered prompt + the recipe on the clipboard, for ChatGPT/Claude) and **"Plak vertaling"**
  (parses the pasted numbered answer back into the other language's name/steps/prep, validated: same
  number of steps). **Foto-import (decision §0)**: "Importeer van foto/tekst" = "Kopieer instructie-prompt"
  (a prompt that asks an external AI to rewrite a photographed recipe into the app's plain format:
  `# Naam`, `## Ingrediënten` one per line, `## Bereiding` one step per paragraph, optional `Porties: N`)
  + a paste box that fills the editor (`splitSteps`, lines → parser).
- **Curator (minimal)**: on the detail page, when `lang = en` and `text.en === 'llm'`, a muted badge
  "machine translation — tap to improve" opens the language-pair editor for that builtin; saved edits are
  stored as an override (`overrides: 'baseId'` table with the schema-2 patch `{ name?, steps?, lines? }`)
  and rendered on top of the builtin; export of overrides comes with sharing (phase 3).
- Data version bump: `ensureBuiltins()` replaces builtins when `dataVersion` changes (already), and the
  user-recipe lines are parsed at render time from `raw` (no Dexie migration needed); user corrections
  live in the line (`ing`, `qual`) or in `lineOverrides`.

## 6. Non-negotiables

CLAUDE.md invariants; no new npm dependencies; quantities never altered by any automated pass; the
LLM never runs in the app; NL and EN complete for all new UI strings; `npm run check`, `test`, `build`,
`build:next`, `validate:data`, `migrate` (deterministic) green; golden fixture committed.
