# Status — Rutgers' Recepten (bijgewerkt 2 oktober 2026)

Lees dit eerst in een nieuwe Claude Code-sessie, samen met CLAUDE.md (invarianten) en PLAN.md §0 (besluiten).

## Online (https://srutgers96-star.github.io/recepten/)
Fase 0–4 compleet + fase 5 blok A, A-bis, B en C (2 oktober 2026). Repo: https://github.com/srutgers96-star/recepten.

## Lokaal gecommit, nog NIET gepusht
(niets — alles staat online)

## Afgerond (ter info)
Blok C (gamification): data/badges.json (43 badges NL+EN, gevalideerd door validateBadges in
tools/validate-data.ts), src/domain/badges.ts (pure evaluatie: cookCount/distinct/letters/streakWeeks/
category/tag/ingredient/allClassics/…; fotobadges verborgen tot blok D) + 28 tests, src/badges.ts
(badges.enabled, badges.earned, toast-wachtrij, checkNewBadges na koken/opslaan/import/delen),
BadgesScreen op /more/badges (tabs per lid + Samen, ?tab=), Home-kaart "Badges N/M", toast in de shell,
Badges-switch + rij in Meer, celebrate 'stars' (kleine burst) + milestones 10/25/50, share-teller
stats.sharedRecipes, DEVICE-TEST rijen 44–45. Blok B (kookstand+): voorlezen, spraakcommando's,
timergeluid — zie commit 4e4519e.

## Volgende stap: blok D (foto's, print/kopieer, verhaal, curator, QR), zie docs/phase-5-spec.md "Block D"
1. Eigen foto per recept (photos-tabel: recipeId, memberId, blob ≤1024px WebP/JPEG via canvas, at);
   detail toont nieuwste foto als hero + galerij; "Gekookt!" biedt "Foto toevoegen". Nooit in tokens;
   in back-ups optioneel (standaard zonder, met schakelaar). Fotobadges (blok C) gaan dan live:
   badgeData() toont ze weer en badgeStatuses telt echte foto's.
2. Print/PDF/kopieer: window.print() met print-stylesheets voor recept (één pagina), ingrediënten per
   recept, boodschappenlijst (A4, gangpad-kolommen); "Kopieer als tekst" voor dezelfde drie.
3. Verhaalpagina compleet: cover-hero, beide talen, "Samen al N van de 196", huishoudleden.
4. Curator-scherm voor Gabi (/more/curator): 196 met status machine/reviewed/missing, EN naast NL,
   override text.en='human' + reviewedBy, "Stuur correcties" = bundel overrides via share.
5. QR: ADR-regel voor 'qrcode' óf eigen encoder in src/domain/qr.ts; "Toon QR" achter Experimenten-flag.
Daarna: npm run check/test/build/build:next/validate:data, smoke-test, commit, push, gh run watch, live check.

## Daarna, blok voor blok, elk apart online (zie docs/phase-5-spec.md en het tijdsoverzicht)
D foto's/print/curator/QR → E groot woordenboek → F vrienden via link/QR + varianten.
Stijn zegt per blok "door".

## Praktisch
- Git/gh niet in PATH van de tool-shell: `export PATH="/c/Program Files/Git/cmd:/c/Program Files/GitHub CLI:$PATH"` (Bash) of absolute paden.
- Commits in het Nederlands, afsluiten met `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Gabi (iPhone, Engels) test mee en schrijft soms zelf in de chat — in het Engels antwoorden.
- Open bugs/wensen: zie PLAN.md §0 (rijen van 29/30-09) en docs/DEVICE-TEST.md.
- Blok B+C moeten nog op beide telefoons door DEVICE-TEST rijen 41–45 (voorlezen, spraak, timergeluid, badges, gamification-uit).
