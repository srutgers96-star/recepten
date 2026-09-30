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

Diet flags follow the conventional Dutch reading, not the strictest one: hard cheeses made with
animal rennet (`parmezaanse-kaas`, `blauwe-kaas`, …) and `pesto` count as `veg: true`, as they do on
Dutch supermarket labels; a strict vegetarian reads the ingredient list. Products that come in a
gluten-free and a wheat variant (`taco`, `tomatensoep`, stock cubes) are `gluten: false,
glutenUnsure: true`, so a recipe with them shows "waarschijnlijk glutenvrij" instead of a sure tag.
| `categories.json`, `aisles.json` | Recipe categories and the fixed supermarket aisle order. | hand |
| `llm/batch-NN.json` | The answers of the translation/structuring sessions (schema: docs/phase-2-spec.md §4 "Batch file schema"). Committed as provenance; merged by `tools/apply-llm-batch.ts` and replayed by `npm run migrate`. | Claude Code sessions |
| `review/lines.json` | Human-reviewed corrections for single ingredient lines (`{ id, i, raw, ing?, qual?, note?, prep?, optional?, why }`), applied **last** by `npm run migrate` and `--apply all` (`tools/apply-review.ts`). For what neither the parser nor a batch can express (a batch never overrides a parser hit). Never quantities. | hand (review sessions) |
| `work/name-parts.json` | Unique name parts of the corpus (parser without ingredient resolution) — the seed the dictionary was written from. | `tools/build-dictionary-seed.ts` |
| `work/batches/batch-NN.input.json` | The 20 batch inputs for the translation sessions (~10 recipes each, recipe-id order). | `tools/make-batch-inputs.ts` |
| `work/dictionary-ids.json` | `[{ id, nl, en, aisle }]` sorted by id — the ingredient ids a batch answer may use. | `tools/make-batch-inputs.ts` |
| `work/vocab.json` | `{ categories, tags, aisles, units }` — the closed vocabularies a batch answer must stay inside. | `tools/make-batch-inputs.ts` |
| `work/ingredients-slice-*.json`, `work/_slice2-names.json` | Provenance of the first dictionary merge. | dictionary agents (once) |

## `recipes.json`

```
{ schema: 2, dataVersion: 3, generatedAt: "<ISO>", recipes: Recipe[] }   // sorted by name.nl
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

## How `npm run migrate` composes `recipes.json` (raw → parser → LLM batches)

`tools/migrate-from-recepten2.ts` `migrate()` is a pure function of three inputs and is
deterministic except `generatedAt` (`tests/migrate.test.ts` asserts this and compares with the
committed file):

1. **raw** — `source/recipes-recepten2.json` → one `Recipe` per record: `id`, `name.nl`, the raw
   ingredient strings, `steps` from `splitSteps` + `findTimers`, `goesWith`. Quantities and units
   exist only here and are never altered by a later stage.
2. **parser** — every raw string goes through `parseLine(raw, dict, 'nl')` with the dictionary built
   from `units/qualifiers/prep-phrases/ingredients/aisles/categories.json`. This yields `qty`,
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
4. **review** — `review/lines.json` is applied last (`tools/apply-review.ts`): one patch per line,
   identified by recipe id + index + the raw text (a mismatch refuses the whole file). It wins over the
   parser and the batches (e.g. "400 g rode zalm" → `zalm-uit-blik` + `rode`, because the steps drain the
   tin), and is the place for a note's English when the parser drops the Dutch note as a synonym.

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
(phase 5 block A). Builtins are never edited in place: "Maak eigen
kopie" creates a `u:` recipe with `origin.basedOn` pointing at the classic.

## Validation

`npm run validate:data` (`tools/validate-data.ts`) checks the source export, the six dictionary
files (unique slug ids, aisle/unit references, no Dutch name claimed by two ingredients) and
`recipes.json` (unique ids, `name.nl`, `servings > 0`, every line has a non-empty `raw`, structured
line fields well-formed, `unit`/`ing`/`qual`/`category` ids exist, tags inside the vocabulary,
`name.en` and every `steps[].text.en` present when `text.en` is set, timers well-formed, `goesWith`
ids exist) and exits 1 on any error. `tests/migrate.test.ts` runs the migration in-process on the
source file and compares it with the committed `recipes.json`; `tests/parser.golden.test.ts`
compares parser + dictionary with `tests/parser.golden.json` (`tools/gen-golden.ts`).
