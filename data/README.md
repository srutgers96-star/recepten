# data/

Source of truth for everything the app ships with. The app bundles `recipes.json` and the
dictionary files; `source/` is read-only history; `work/` holds generated intermediates for the
translation sessions; `llm/` holds the committed answers of those sessions.

| File | What | Written by |
|---|---|---|
| `source/recipes-recepten2.json` | The 196 classics as exported from Recepten2 (flat Dutch records: `name`, `ingredients[]`, `instructions`). Never edited by hand. | Recepten2 export (once) |
| `recipes.json` | The same 196 classics in **schema 2** (see below): parsed ingredient lines ⊕ the LLM enrichment from `llm/`. Generated — do not edit by hand; edit the migration, the dictionary or a batch and regenerate. | `npm run migrate` |
| `units.json` | Units (`g`, `el`, `teen`, `blik`, …) with NL/EN names, aliases, `g`/`ml` conversions; `dl` renders as ml in English. | hand (docs/phase-2-spec.md §1) |
| `qualifiers.json` | Qualifier words (`rode`, `grote`, `verse`, …) with `variant: true` when they make a different shopping item. | hand |
| `prep-phrases.json` | `[bracket]` prep notes NL → EN, incl. `{n}` templates ("blokjes van {n} cm"); `enSliced` = the English for ingredients with `cut: "slice"` ("fijngesneden" → finely chopped herbs, finely sliced onion). | hand |
| `ingredients.json` | The bilingual ingredient dictionary (~380 entries): id = slug of the Dutch base noun, NL/EN names, aliases, aisle, default/buy unit, `staple`, `veg`, `vegan`, `gluten` (+ `glutenUnsure: true` when the gluten flag is a best guess — stock cubes, sauces; only next to `gluten: false`, since `gluten: true` is a fact and `validate:data` rejects the pair), `gloss.en` for Dutch-only products, `cut: "slice"` for products that are sliced rather than chopped, `unitNames` for a product's own unit name (foelie: "1 blade mace"). | hand + `tools/apply-llm-batch.ts --apply` (appends NEW entries) |
| `categories.json`, `aisles.json` | Recipe categories and the fixed supermarket aisle order. | hand |
| `cuisines.json` | The 18 cuisines (docs/specs/labels-categorieen.md §2c): `{ id, nl, en, flag, order }`, `flag` an emoji (Windows Chrome shows flag emoji as two letters, phones show flags), `order` = the chip order. A recipe has at most ONE cuisine (`Recipe.cuisine`, a cuisine id or null), and only when the dish really comes from that cuisine; the `wereld` tag stays the loose label. | hand |
| `llm/batch-NN.json` | The answers of the translation/structuring sessions (schema: docs/phase-2-spec.md §4 "Batch file schema"). Committed as provenance; merged by `tools/apply-llm-batch.ts` and replayed by `npm run migrate`. | Claude Code sessions |
| `review/lines.json` | Human-reviewed corrections for single ingredient lines (`{ id, i, raw, ing?, qual?, note?, prep?, optional?, why }`), applied after the batches by `npm run migrate` and `--apply all` (`tools/apply-review.ts`). For what neither the parser nor a batch can express (a batch never overrides a parser hit). Never quantities. | hand (review sessions) |
| `review/meta.json` | The hand-kept recipe labels of the classics (docs/specs/labels-categorieen.md §2e): `{ category?: { <recipe id>: <category id> }, goesWith?: { <recipe id>: [<recipe id>] }, cuisine?: { <recipe id>: <cuisine id> } }`. Now: the 71 cuisines of §2c (twijfel = no entry = no cuisine). Applied after `review/lines.json` and before the diet tags by `npm run migrate` and `--apply all` (`tools/apply-meta.ts`); a value sets the field; an unknown recipe, category, cuisine or goesWith id refuses the whole file. The category or cuisine of a classic is never edited in `recipes.json` itself. | hand |
| `work/name-parts.json` | Unique name parts of the corpus (parser without ingredient resolution) — the seed the dictionary was written from. | `tools/build-dictionary-seed.ts` |
| `work/batches/batch-NN.input.json` | The 20 batch inputs for the translation sessions (~10 recipes each, recipe-id order). | `tools/make-batch-inputs.ts` |
| `work/dictionary-ids.json` | `[{ id, nl, en, aisle }]` sorted by id — the ingredient ids a batch answer may use. | `tools/make-batch-inputs.ts` |
| `work/vocab.json` | `{ categories, cuisines, tags, aisles, units }` — the closed vocabularies a batch answer must stay inside. | `tools/make-batch-inputs.ts` |
| `work/ingredients-slice-*.json`, `work/_slice2-names.json` | Provenance of the first dictionary merge. | dictionary agents (once) |

Diet flags follow the conventional Dutch reading, not the strictest one: hard cheeses made with
animal rennet (`parmezaanse-kaas`, `blauwe-kaas`, …) and `pesto` count as `veg: true`, as they do on
Dutch supermarket labels; a strict vegetarian reads the ingredient list. Products that come in a
gluten-free and a wheat variant (`taco`, `tomatensoep`, stock cubes) are `gluten: false,
glutenUnsure: true`, so a recipe with them shows "waarschijnlijk glutenvrij" instead of a sure tag.

`lactose` follows the STRICT reading (docs/specs/labels-categorieen.md §2a): every dairy product
counts, also aged and hard cheese (Parmesan, Gruyère) and ghee. Lactose-free products
(`lactosevrije-melk`), plant-based dairy and eggs are `false`. Products that sometimes contain milk
ingredients (margarine, stock cube, crisps, puff pastry, sausage) are `lactose: false,
lactoseUnsure: true` — unless the entry is plant-based: `vegan: true` already says there is no milk
in it, so it is plain `lactose: false` (the stock cube and crisps in this file are). `validate:data`
rejects `lactoseUnsure` next to `lactose: true` and `lactose: true` or `lactoseUnsure` on a vegan
entry. The flags were set in one pass over ten aisle slices (`work/lactose/slice-NN-*.json`, merged by
`tools/apply-flag-slices.ts`).

## `recipes.json`

```
{ schema: 2, dataVersion: 6, generatedAt: "<ISO>", recipes: Recipe[] }   // sorted by name.nl
```

`Recipe` is the domain type in `src/domain/model.ts` (docs/phase-1-spec.md §1, phase-2-spec.md §2).
For the classics:

- `id` = `'b:' + slug(name.nl)` (`src/domain/recipe-source.ts` `slugId`) — ids never change.
- `origin` = `{ kind: 'builtin' }`, `servings` = 4, `rev` = 1, `createdAt`/`updatedAt` = the first
  edition date (`2025-12-01`), so the output is deterministic except `generatedAt`.
- `lines[]` = every raw ingredient string parsed by `parseLine` (`src/domain/parser.ts`) with the
  dictionary: `{ raw: { nl }, kind: 'line', qty, unit, ing, name, qual?, part?, prep?, note?,
  packSize?, alt?, altMode?, optional?, role?, confidence }`. `raw` is the source of truth and is
  never deleted (CLAUDE.md invariant 2); quantities are never altered by any pass. A line ending in
  `:` ("Dressing:") is `{ raw, kind: 'header' }`; empty source lines (group separators) are dropped.
  `ing: null` = not resolved in the dictionary (the name part sits in `name`).
- `steps[]` = `splitSteps(instructions)` (`src/domain/steps.ts`), each `{ text: { nl, en? }, timers? }`
  with `timers` = `findTimers(text.nl)` (`src/domain/timers.ts`).
- `goesWith` = the id of the main dish for side dishes named "X (voor bij Y)" / "X (bij Y)".
- From the batches (`llm/`): `name.en`, `description`, `category`, `tags`, `time`, `steps[].text.en`,
  `servingTip.en`, `text: { en: 'llm' }`, and per line `ing`/`qual`/`prep.en`/`confidence` where the
  parser returned null or the LLM was more confident (spec §4 "order of truth").
- From `review/meta.json`: `cuisine` (one `cuisines.json` id, placed right after `category`; absent =
  no cuisine) and, when listed there, `category` and `goesWith`.
- The diet tags (`vegetarisch`, `vegan`, `glutenvrij`, `lactosevrij`) are facts derived from the
  ingredient flags (`tools/derive-tags.ts`), set last.

## How `npm run migrate` composes `recipes.json` (raw → parser → LLM batches)

`tools/migrate-from-recepten2.ts` `migrate()` is a pure function of its inputs and is
deterministic except `generatedAt` (`tests/migrate.test.ts` asserts this and compares with the
committed file):

1. **raw** — `source/recipes-recepten2.json` → one `Recipe` per record: `id`, `name.nl`, the raw
   ingredient strings, `steps` from `splitSteps` + `findTimers`, `goesWith`. Quantities and units
   exist only here and are never altered by a later stage.
2. **parser** — every raw string goes through `parseLine(raw, dict, 'nl')` with the dictionary built
   from `units/qualifiers/prep-phrases/ingredients/aisles/categories/cuisines.json`. This yields `qty`,
   `unit`, `ing`, `qual`, `part`, `prep` (NL + EN via prep-phrases), `note`, `packSize`, `alt`,
   `optional`, `confidence`.
3. **LLM batches** — `llm/batch-*.json` are replayed in file-name order with `checkBatch(…, 'replay')`
   + `applyBatch` (`tools/apply-llm-batch.ts`). A batch that does not validate makes the migration
   throw (never a half-enriched file). Per recipe it sets `name.en`, `description`, `category`,
   `tags`, `time`, `steps[].text.en`, `servingTip.en`, `text.en = 'llm'`. Per line the batch's `ing`
   is taken only where the parser returned `null`, or where it differs and the batch's `confidence`
   is **higher** than the parser's (`prep.en` follows the same rule; `note.en` only fills the English
   of a Dutch note the dictionary could not translate); otherwise the parser's id stays. In replay
   mode a `NEW` entry must already be in `ingredients.json` — `--apply` is the only step that appends
   there, which is why `--apply all` and `npm run migrate` produce the same `recipes` array (verified
   2026-09-29: byte-identical apart from `generatedAt`).
4. **review** — `review/lines.json` is applied after the batches (`tools/apply-review.ts`): one patch
   per line, identified by recipe id + index + the raw text (a mismatch refuses the whole file). It wins
   over the parser and the batches (e.g. "400 g rode zalm" → `zalm-uit-blik` + `rode`, because the steps
   drain the tin), and is the place for a note's English when the parser drops the Dutch note as a synonym.
5. **meta** — `review/meta.json` (`tools/apply-meta.ts`, docs/specs/labels-categorieen.md §2e) sets the
   recipe-level labels: `cuisine` (the 71 of §2c), and `category` / `goesWith` when listed. `checkMeta`
   refuses unknown ids, so the migration throws rather than dropping a label. (Later the side dishes of
   docs/specs/bijgerechten.md are added between the review and this step, so meta can label them too.)
6. **diet facts** — `applyDerivedTags` (`tools/derive-tags.ts`) sets the diet tags from the dictionary
   flags, last.

Source quirks are handled in code, never by editing the source: the stray `""` key of the Rendang
(`normalizeSource`) and a first "step" that only states the servings ("Voorgerecht voor 4 personen,
hoofdgerecht voor 2 personen." → `servingTip`, `splitServingNote` in the migration).

So `--apply` is the *first* merge (and the place where the dictionary grows); `migrate` is the
reproducible replay. After changing the source, the dictionary, the parser or a batch: `npm run
migrate` → `node --experimental-strip-types tools/gen-golden.ts` → `npm run validate:data` → `npm test`.

## The translation batches (`work/batches/` → `llm/`)

1. `npm run migrate` then `node --experimental-strip-types tools/make-batch-inputs.ts` writes
   `work/batches/batch-01.input.json` … `batch-20.input.json` (plus `dictionary-ids.json`, `vocab.json`).
   Each input recipe is `{ id, name: {nl}, servings, lines: [{ i, raw, parsed: { qty, unit, ing, qual,
   prep: {nl}, name } }], steps: [{ nl }], servingTip: {nl}? }`. **`i` is the index into
   `recipe.lines`** (headers count in the numbering but are not listed).
2. A session answers one batch in the schema of **docs/phase-2-spec.md §4 "Batch file schema"** and
   saves it as `llm/batch-NN.json`: `name.en`, `description`, `category` (from `vocab.categories`),
   `tags` (subset of `vocab.tags`), `time`, exactly one `{ en }` per step, `servingTip.en` only when
   the recipe has one, and one `{ i, ing, qual, prep: { en }, note: { en }, confidence }` per non-header
   line — `ing` an id from `dictionary-ids.json`, `"NEW"` with a `new` entry (ingredients.json shape), or
   `null`; `note.en` only when the line has a Dutch `(…)` note without English.
   British English, metric, tbsp/tsp/tin/clove; never restate quantities.
3. `node --experimental-strip-types tools/apply-llm-batch.ts --check llm/batch-NN.json` validates
   (unknown recipe/ingredient/qualifier/category ids, tags outside the vocabulary, step counts that
   differ, a line index out of range or on a header, a NEW id colliding with a different entry — all
   refuse). `--apply <file|all>` merges into `recipes.json` and appends NEW entries to
   `ingredients.json`.
4. Then `npm run migrate` (replays every batch from the source, so the file is reproducible),
   `node --experimental-strip-types tools/gen-golden.ts` when the dictionary grew,
   `npm run validate:data`, `npm test`.

## `dataVersion`

The app keeps a copy of the classics in its `builtins` table (`src/db/repo.ts` `ensureBuiltins`).
On start it compares `settings.dataVersion` with the bundled `dataVersion` and re-imports the whole
file when they differ. **Bump `DATA_VERSION` in `tools/migrate-from-recepten2.ts`** whenever the
bundled classics change in a way every phone must pick up (new translations, fixed text, added
recipes). Version 2 = structured lines (phase 2); version 3 = diet tags derived from the ingredient flags
(phase 5 block A); version 4 = the block-E dictionary (1600+ products) and its review (phase 5 block E,
October 2026); version 5 = the `lactosevrij` tag on the classics (docs/specs/labels-categorieen.md blok 2);
version 6 = the cuisines of `review/meta.json` (blok 3, 23 October 2026). Builtins are never edited in place: "Maak eigen
kopie" creates a `u:` recipe with `origin.basedOn` pointing at the classic.

## Validation

`npm run validate:data` (`tools/validate-data.ts`) checks the source export, the dictionary files
(unique slug ids, aisle/unit references, no Dutch name claimed by two ingredients, the diet flags;
`cuisines.json`: id, `nl`, `en`, `flag` and `order` per cuisine) and `recipes.json` (unique ids,
`name.nl`, `servings > 0`, every line has a non-empty `raw`, structured line fields well-formed,
`unit`/`ing`/`qual`/`category`/`cuisine` ids exist (`cuisine` may be absent or null), tags inside the vocabulary,
`name.en` and every `steps[].text.en` present when `text.en` is set, timers well-formed, `goesWith`
ids exist) and exits 1 on any error. `tests/validate-data.test.ts` covers these rules on small inputs;
`tests/apply-meta.test.ts` covers `review/meta.json`. `tests/migrate.test.ts` runs the migration in-process on the
source file and compares it with the committed `recipes.json`; `tests/parser.golden.test.ts`
compares parser + dictionary with `tests/parser.golden.json` (`tools/gen-golden.ts`).
