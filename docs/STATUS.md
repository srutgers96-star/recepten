# Status — Rutgers' Recepten (bijgewerkt 1 oktober 2026)

Lees dit eerst in een nieuwe Claude Code-sessie, samen met CLAUDE.md (invarianten) en PLAN.md §0 (besluiten).

## Online (https://srutgers96-star.github.io/recepten/)
Fase 0–4 compleet + fase 5 blok A en A-bis (commit c5d23db, 1 oktober 2026). Repo: https://github.com/srutgers96-star/recepten.

## Lokaal gecommit, nog NIET gepusht
(niets — alles staat online)

## Afgerond (ter info)
Blok A-bis deel 1 (commit a3bb8b3): Amerikaanse eenheden/namen, note-phrases, parser/render (noteForeign),
translate-prompt herschreven, merge-ingredients.ts, selecteer-stand in de receptenlijst, exporthints.

## Volgende stap: blok B (kookstand+), zie docs/phase-5-spec.md "Block B"
A-bis deel 2 is af (ter info stond hier:) (spec: docs/phase-5-spec.md "Block A-bis", items 1–9)
Nog te bouwen: IngredientPicker "bestaat al"-banner (findExisting), src/screens/DictionaryScreen.tsx
(zoeken, eigen entry bewerken, Fuseer met bestaand via repo.mergeIngredient + undo, Opruimen),
route '/more/dictionary' (bestaat al in app.tsx? controleer), EditScreen: nieuwe vertaalprompt koppelen
(buildTranslationPrompt met isResolved, applyTranslationAnswer), grijze placeholder in stand "beide",
"Kies bestand" in de importsectie van Toevoegen, LineView/LineChips grijs voor noteForeign/prepForeign,
src/domain/data.ts: note-phrases.json inladen (zie integrator-notitie in het workflowverslag).
Daarna: npm run check/test/build/build:next/validate:data, smoke-test, commit, push, gh run watch, live check.
Workflow hervatten (klare agents uit cache): scriptPath
C:\Users\srutg\.claude\projects\C--Users-srutg-AndroidStudioProjects-RutgersRecepten\25432dc4-e09e-4b48-aef4-ed478a87d66c\workflows\scripts\recepten-phase5-abis-wf_3f097965-2f5.js
met resumeFromRunId wf_3f097965-2f5 — of een nieuwe workflow met alleen de resterende agent + integratie/review/fix.

## Daarna, blok voor blok, elk apart online (zie docs/phase-5-spec.md en het tijdsoverzicht)
B kookstand+ (voorlezen, spraak, timergeluid) → C badges & confetti → D foto's/print/curator/verhuizen/QR →
E groot woordenboek → F vrienden via link/QR + varianten. Stijn zegt per blok "door".

## Praktisch
- Git/gh niet in PATH van de tool-shell: `export PATH="/c/Program Files/Git/cmd:/c/Program Files/GitHub CLI:$PATH"` (Bash) of absolute paden.
- Commits in het Nederlands, afsluiten met `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Gabi (iPhone, Engels) test mee en schrijft soms zelf in de chat — in het Engels antwoorden.
- Open bugs/wensen: zie PLAN.md §0 (rijen van 29/30-09) en docs/DEVICE-TEST.md.
