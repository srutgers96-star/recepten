# tools/

Standalone scripts for the data pipeline. The TypeScript ones run directly on Node 22 with
type stripping (no build step, no dependencies beyond `node:*`):

```powershell
node --experimental-strip-types tools/<name>.ts
```

Type-stripping rules: type-only syntax only (interfaces, type aliases, `as`, `satisfies`,
`import type`), no enums, no parameter properties, no namespaces, plain ESM with explicit
`.ts` extensions on relative imports, paths via `import.meta.url` + `fileURLToPath`.

| Script | npm script | What it does |
|---|---|---|
| `measure-parse.ts` | `npm run measure-parse` | Regex-only measurement of the ingredient-line corpus in `data/source/recipes-recepten2.json`. Prints the report and writes `docs/measure-parse.md`. Exports `classifyLine()` (unit-tested in `tests/measure-parse.test.ts`). |
| `validate-data.ts` | `npm run validate:data` | Data guard. Validates the schema-1 source export today; schema-2 (`data/recipes.json`) rules are stubbed with a TODO. Exit 1 on errors, 0 otherwise; warnings never fail. |
| `make-icons.py` | `npm run icons` | Renders the PWA icons from `assets/cover.png` (Python + Pillow). |
| `apply-llm-batch.ts` | — | Validates and merges the LLM batches `data/llm/batch-*.json` (`--check <file>`, `--apply <file|all>`); `--apply all` also applies the review layer. |
| `apply-review.ts` | — | The human review layer `data/review/lines.json` (`readReview`, `checkReview`, `applyReview`); used by `migrate` and `apply-llm-batch --apply all`, no CLI of its own. |
| `gen-golden.ts` | — | Regenerates `tests/parser.golden.json` (every unique corpus line parsed + rendered NL/EN). |

## measure-parse.ts

- `classifyLine(line)` returns `{ kind, unit?, qty?, hasPrep, hasParen }` with `kind` one of
  `header` (trailing `:`), `empty`, `qty-known-unit`, `qty-count-or-name`, `no-qty`.
- Quantity grammar (optional `ca.`/`circa`/`±` prefix): ranges `2-3`, `2–3`, `1 of 2`, `2 tot 3`,
  `60 à 70`; mixed `1 1/2`, `1½`, `1 ½`; bare fractions `1/2`; decimals `1,5`/`1.5`; vulgar `½¼¾⅓⅔`.
- Known units: the Dutch list from PLAN.md §5 (`g kg ml dl l ltr el tl mp kop … stuk stuks`);
  matched as the first whole word after the quantity, case-insensitive, trailing `.` allowed.
- Kind counts are reported for unique (trimmed) lines and for all lines; unit table shows both.
- Samples are evenly spaced over the alphabetically sorted unique lines of a kind, so the report is
  byte-for-byte reproducible.
- This is an estimate of the corpus *shape*, not parse success. The dictionary hit rate is measured
  by the phase-2 golden fixture (`parser.golden.json`).

## validate-data.ts

- `validateSource(data)` — schema 1: top level array; each recipe has a non-empty `name` (unique,
  case-insensitive), `ingredients: string[]` (warn on empty strings), `instructions: string`;
  unexpected keys are warnings (the export contains one stray `""` key).
- `validateSchema2(data)` — placeholder; the rule list from PLAN.md §5 "Guards in CI" sits in a
  TODO block in the file. Runs automatically once `data/recipes.json` exists.
- Both return `{ errors, warnings, stats }`; the CLI prints them and exits 1 if any error.
