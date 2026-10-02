# Status — Rutgers' Recepten (bijgewerkt 2 oktober 2026)

Lees dit eerst in een nieuwe Claude Code-sessie, samen met CLAUDE.md (invarianten) en PLAN.md §0 (besluiten).

## Online (https://srutgers96-star.github.io/recepten/)
Fase 0–4 compleet + fase 5 blok A, A-bis, B, C en D (2 oktober 2026). Repo: https://github.com/srutgers96-star/recepten.

## Lokaal gecommit, nog NIET gepusht
(niets — alles staat online)

## Afgerond (ter info)
Blok D: Dexie v6 photos-tabel + src/photo.ts (canvas ≤1024px WebP/JPEG, EXIF-rotatie), foto-hero +
galerij + overlay op het recept, "Foto toevoegen" bij Gekookt!, back-up "Met foto's" (default uit),
fotobadges live; src/print.ts + print.css (recept 1×A4 / ingrediënten / lijst met gangpad-kolommen+☐)
+ "Kopieer als tekst" (domain/recipe-text.ts, iOS-hint i.p.v. dode printknop); StoryScreen met
huishoudleden; CuratorScreen /more/curator (status machine/gecontroleerd/ontbreekt, EN-only patches
via saveOverride + text{en:'human',reviewedBy}, "Stuur correcties" via bestaande patch-envelopes);
Experimenten-switch; QR op het recept-deelscherm (qrcode-dependency, ADR-0007, lazy chunk);
DEVICE-TEST rijen 46–49. Eerder: blok C badges (commit e7298d8), blok B kookstand+ (4e4519e).

## Volgende stap: blok E (groot woordenboek), zie docs/phase-5-spec.md "Block E"
1. Data-agents vullen ±1500 courante supermarktproducten aan (NL/EN, gangpad, defaultUnit,
   veg/vegan/gluten-vlaggen, perishable, staple) in alfabetische plakken, met dedupe tegen de
   bestaande 378+; npm run validate:data moet groen blijven (let op de bestaande naam-claims).
2. Scherm /more/dictionary uitbreiden: zoeken bestaat; erbij: filter op gangpad, entry-weergave
   (namen, gangpad, vlaggen), eigen entries bewerken bestaat, nieuw toevoegen (hergebruik
   IngredientPicker-formulier), tellers; boodschappen-extra's en editor-chips gebruiken het.
Daarna: npm run check/test/build/build:next/validate:data, smoke-test, commit, push, gh run watch, live check.

## Daarna, blok voor blok, elk apart online (zie docs/phase-5-spec.md en het tijdsoverzicht)
E groot woordenboek → F vrienden via link/QR + varianten. Stijn zegt per blok "door".

## Praktisch
- Git/gh niet in PATH van de tool-shell: `export PATH="/c/Program Files/Git/cmd:/c/Program Files/GitHub CLI:$PATH"` (Bash) of absolute paden.
- Commits in het Nederlands, afsluiten met `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Gabi (iPhone, Engels) test mee en schrijft soms zelf in de chat — in het Engels antwoorden.
- Open bugs/wensen: zie PLAN.md §0 (rijen van 29/30-09) en docs/DEVICE-TEST.md.
- Blok B+C+D moeten nog op beide telefoons door DEVICE-TEST rijen 41–49 (voorlezen, spraak, timergeluid, badges, gamification-uit, foto's, print/kopieer, curator, QR).
