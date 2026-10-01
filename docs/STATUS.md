# Status — Rutgers' Recepten (bijgewerkt 1 oktober 2026)

Lees dit eerst in een nieuwe Claude Code-sessie, samen met CLAUDE.md (invarianten) en PLAN.md §0 (besluiten).

## Online (https://srutgers96-star.github.io/recepten/)
Fase 0–4 compleet + fase 5 blok A, A-bis en B (1 oktober 2026). Repo: https://github.com/srutgers96-star/recepten.

## Lokaal gecommit, nog NIET gepusht
(niets — alles staat online)

## Afgerond (ter info)
Blok B (kookstand+): src/speech.ts (voorlezen, stem per taal, cancel bij navigatie), src/voice.ts +
src/domain/voice.ts (spraakcommando's: volgende/vorige/timer N/lees voor/stop, NL+EN, echo-guard
hearingOwnVoice + 'ga terug'/'go back'), src/sounds.ts (timer.sound beeps/bell/melody/off + timer.vibrate,
WebAudio), 🔊 per stap + mic-knop in CookScreen, 🔔 in de timerbalk (eigen koprij), sectie "Kookstand &
timer" in Meer, reloadSpeech/Voice/SoundSettings na restore, DEVICE-TEST rijen 41–43 (NL+EN),
tests/voice.test.ts. Gebouwd via workflow (4 bouwers → integratie → 3 reviews → verificatie → fix;
12 bevindingen gerepareerd).

## Volgende stap: blok C (badges & confetti), zie docs/phase-5-spec.md "Block C"
1. data/badges.json (~40 badges met regel-soorten, speelse namen NL+EN) + src/domain/badges.ts (puur,
   geëvalueerd over kooklog/recepten/foto's per lid en huishouden) + tests.
2. Scherm /more/badges (+ Home-kaart "Badges 7/40" als aan): grid per lid + "Samen", verdiend vs
   vergrendeld met voortgang, tik → detail; nieuwe badge → toast + confetti (milestone-soort).
3. Instellingen: badges.enabled naast confetti; beide uit = geen gamification.
4. Extra dopamine-momenten: sterren geven → kleine confetti; eerste foto; 10e/25e/50e kook groter.
Daarna: npm run check/test/build/build:next/validate:data, smoke-test, commit, push, gh run watch, live check.

## Daarna, blok voor blok, elk apart online (zie docs/phase-5-spec.md en het tijdsoverzicht)
C badges & confetti → D foto's/print/curator/verhuizen/QR → E groot woordenboek →
F vrienden via link/QR + varianten. Stijn zegt per blok "door".

## Praktisch
- Git/gh niet in PATH van de tool-shell: `export PATH="/c/Program Files/Git/cmd:/c/Program Files/GitHub CLI:$PATH"` (Bash) of absolute paden.
- Commits in het Nederlands, afsluiten met `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Gabi (iPhone, Engels) test mee en schrijft soms zelf in de chat — in het Engels antwoorden.
- Open bugs/wensen: zie PLAN.md §0 (rijen van 29/30-09) en docs/DEVICE-TEST.md.
- Blok B moet nog op beide telefoons door DEVICE-TEST rijen 41–43 (voorlezen, spraak, timergeluid).
