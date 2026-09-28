# data/

Source of truth for everything the app ships with. The app bundles `recipes.json`; `source/` is
read-only history.

| File | What | Written by |
|---|---|---|
| `source/recipes-recepten2.json` | The 196 classics as exported from Recepten2 (flat Dutch records: `name`, `ingredients[]`, `instructions`). Never edited by hand. | Recepten2 export (once) |
| `recipes.json` | The same 196 classics in **schema 2** (see below). Generated — do not edit by hand; edit the migration or (from phase 2 on) the translation/structuring tools and regenerate. | `npm run migrate` |

## `recipes.json`

```
{ schema: 2, dataVersion: 1, generatedAt: "<ISO>", recipes: Recipe[] }   // sorted by name.nl
```

`Recipe` is the domain type in `src/domain/model.ts` (docs/phase-1-spec.md §1). For the classics:

- `id` = `'b:' + slug(name.nl)` (`src/domain/recipe-source.ts` `slugId`) — ids never change.
- `origin` = `{ kind: 'builtin' }`, `servings` = 4, `rev` = 1, `createdAt`/`updatedAt` = the first
  edition date (`2025-12-01`), so the output is deterministic except `generatedAt`.
- `lines[]` = the raw ingredient strings as `{ raw: { nl } }`; a line ending in `:` ("Dressing:")
  gets `kind: 'header'`; empty source lines (group separators) are dropped. Phase 2 adds the parsed
  structure next to `raw` — `raw` itself is never deleted (CLAUDE.md invariant 2).
- `steps[]` = `splitSteps(instructions)` (`src/domain/steps.ts`), each `{ text: { nl }, timers? }`
  with `timers` = `findTimers(text)` (`src/domain/timers.ts`).
- `goesWith` = the id of the main dish for side dishes named "X (voor bij Y)" / "X (bij Y)".
- `name.en`, `description`, `category`, `tags`, `time`, `servingTip`, `aliases`, `text` are filled
  in later phases (translation batches, categories).

## `dataVersion`

The app keeps a copy of the classics in its `builtins` table (`src/db/repo.ts` `ensureBuiltins`).
On start it compares `settings.dataVersion` with the bundled `dataVersion` and re-imports the whole
file when they differ. **Bump `DATA_VERSION` in `tools/migrate-from-recepten2.ts`** whenever the
bundled classics change in a way every phone must pick up (new translations, fixed text, added
recipes). Builtins are never edited in place: "Maak eigen kopie" creates a `u:` recipe with
`origin.basedOn` pointing at the classic.

## Validation

`npm run validate:data` (`tools/validate-data.ts`) checks both files and exits 1 on any error:
unique ids, `name.nl`, `servings > 0`, every line has a non-empty `raw`, at least one step per
recipe, timers well-formed, `goesWith` ids exist. `tests/migrate.test.ts` runs the migration
in-process on the source file.
