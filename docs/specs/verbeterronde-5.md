# Spec V5 — Vrijspeel-rijkdom: confetti-ladder en -ontwerpen, herkenbare timergeluiden, gouden thema (Stijn, 8 nov 2026)

Status: in aanbouw (Fable, 8 nov 2026). Eén blok, vijf bouwers + integrator (lichte modus). Bron: docs/IDEAS.md idee 15 (Stijn 8 nov:
"een hoop meer confetti dingen in hogere levelklassen: dubbel, trippel, quadruppel … steeds grappigere/leukere dingen; mag ook bij
geluidjes voor de timer: herkenbaar, progressief grappig; en 33 keer op Versie → gold-theme, want ik ben de maker: mooi, goed
leesbaar, donkere achtergrond, gouden accenten"). Leidend bij tegenspraak: docs/specs/README.md §2–§4, docs/specs/xp-levels.md
(§1g confetti, §3 geluiden, ontgrendelingen "rijk, niet spaarzaam"; "geen spoor van ontgrendelingen met badges uit"),
docs/specs/badges-avatar.md (zeldzaamheid), docs/specs/handbook.md §4.

**Kritische lezer (Fable, vooraf).** (1) Geen opnames en geen beschermde melodieën: alle geluiden zijn oscillator-recepten zoals de
bestaande zeven (Web Audio), en "klassieke telefoon" wordt een eigen marimba-vierklank, niet de Apple-melodie. Ode an die Freude
(Beethoven) en het Nachtmusik-motief (Mozart) zijn publiek domein. (2) Confetti-stijlen zijn code (`look` in Confetti.tsx) plus een
regel in unlocks.json; het aantal snippers bij quadruppel (320) vraagt om golven, anders slaat het scherm dicht op een oude telefoon.
(3) Het gouden thema is een vierde thema naast systeem/licht/donker; het tegeltje bestaat alleen als het vrij is, via de
ontgrendeling op level 100 (de gereserveerde "gouden modus") of via het makers-ei. Het ei schrijft alleen een toestel-instelling;
geen XP, geen badge, geen regel in de handleiding (wel in ACHTER-DE-SCHERMEN). (4) Leesbaarheid gaat voor glans: goud is de
accentkleur (knoppen, actieve tab, balken, bijschriften), de tekst blijft licht op donker; contrast ruim boven AA. (5) Eén bouwer
schrijft unlocks.json, zodat drie bouwers niet hetzelfde bestand raken.

**Feitencheck (Fable, in de code).** Confetti.tsx: `look` = `current.style`; `'double'` = 160 snippers (`DOUBLE_PIECES`), emoji-
stijlen via `EMOJI[look]` (<i> met tekst, 18 px): veggies, party, trex, fire, stars; `'gold'` = drie goudtinten; anders de gewone 80;
`durationMs` (1200, klein 850), zwaartekracht `dy = sin(angle)·dist + 140`; V4: snelheid via `celebrationSpeed`. Unlocks (17):
confetti double 3 · veggies 7 · party 12 · trex 25 · gold 40 · stars 50 · fire (badge); timerSound cowbell 5 · gong 10 · kitchen 15 ·
fanfare 30; cookedSound tada 20; cookFont chalk 8 · hand 18; feature avatar-maker 3 · challenges 20 · fast-celebrations 30.
`UnlockKind = 'confetti' | 'timerSound' | 'cookedSound' | 'cookFont' | 'feature'`. sounds.ts: `TimerSound = 'beeps' | 'bell' | 'melody' |
'cowbell' | 'gong' | 'kitchen' | 'fanfare' | 'off'`, `playTimerSound(ctx, kind)` met een switch, helpers `note(ctx, freq, at, dur, peak,
decay)` en `chord(…)`, pieken ≤ 0,5. Jouw stijl (StyleScreen.tsx): tabs avatar/sounds/confetti/fonts/theme; `THEME_TILES =
['system','light','dark']`, swatch `data-theme-swatch`; met badges uit alleen sounds en theme. theme.ts: `Theme = 'system' | 'light' |
'dark'`, `PAPER` voor de theme-color-meta, `data-theme` op <html>; base.css `:root[data-theme='dark']` tokenblok (paper, card, ink,
muted, cobalt, tomato, rosemary, orange, line, press, on-cobalt, on-rosemary, diet-*, rarity-*). Meer → Hulp & over → Over:
`<dl>` met Versie/Kanaal/Build (MoreScreen.tsx ±709). Validator: unlocks.json (kind, by, value, rarity; `validateUnlocks`).

## 1. Gedrag

### 1a. Confetti (bouwer A: `src/components/Confetti.tsx`, `tests/confetti.test.ts` als die bestaat, anders geen test)

Nieuwe `look`-waarden, elk één blok in Confetti.tsx (vorm, kleuren, aantal, beweging), allemaal met de bestaande snelheidsregel:

| value | level | wat je ziet |
|---|---|---|
| `triple` | 22 | 240 papiersnippers in de gewone kleuren, in twee golven (0 en 250 ms) |
| `quadruple` | 45 | 320 snippers in drie golven (0, 200, 400 ms), iets kleinere stukjes (14 px) zodat het niet dichtslaat |
| `hearts` | 17 | emoji ❤️ 🧡 💛 💗, 70 stuks, iets trager omlaag |
| `leaves` | 33 | emoji 🍂 🍁 🍃, 60 stuks, zwevend: horizontale wieg (translateX ±14 px via een extra keyframe), 1,6× zo lang |
| `snow` | 38 | 90 witte rondjes (6–9 px, `#fff` met een rand `rgba(0,0,0,.18)` zodat ze ook op licht papier zichtbaar zijn), langzaam, 1,8× zo lang |
| `pasta` | 56 | 60 getekende vormpjes als inline SVG in de snipper: strikje (farfalle), buisje (penne) en spiraal (fusilli) in drie pasta-tinten (#e8c56a, #d9a441, #f2dc9b) |
| `fireworks` | 62 | drie barsten vanuit drie punten (x 25 %, 50 %, 75 %, y 30 %) met elk 50 snippers in één kleur per barst, 150 ms na elkaar |
| `bubbles` | 68 | 50 doorzichtige cirkels (`rgba(255,255,255,.35)` met lichte rand, 10–22 px) die omhóóg gaan (negatieve zwaartekracht), 1,6× zo lang |
| `lanterns` | 77 | 24 rood-gouden rechthoekjes (12×18 px, gloed via box-shadow) die langzaam omhoog zweven, 2× zo lang |
| `aurora` | 88 | 10 lange doorschijnende slierten (6×120 px, groen `rgba(60,220,160,.45)` en paars `rgba(170,110,240,.45)`, blur 2 px) die langzaam golven; 2× zo lang |

Een stijl die het apparaat zwaar vindt (`prefers-reduced-motion`) toont zoals nu niets. De snelheidsregel van V4 blijft (duur gedeeld
door de snelheid, tik = ×2). Geen nieuwe dependency; alles CSS/inline SVG.

### 1b. Timergeluiden (bouwer B: `src/sounds.ts`, `tests/sounds.test.ts` als die bestaat)

Nieuwe `TimerSound`-waarden met een `playX(ctx)` naast de bestaande, allemaal ≤ 4 s, pieken ≤ 0,5, zelfde helpers:

| value | level | recept |
|---|---|---|
| `marimba` | 8 | eigen vierklank "à la klassieke telefoon": sinus met korte aanzet, noten E5 C5 G4 C5 (0,22 s elk), twee keer; géén bestaande melodie |
| `ode` | 21 | Ode an die Freude (Beethoven, publiek domein), acht maten van de melodie in E-majeur-achtige toonhoogtes (E E F G G F E D C C D E E D D), driehoek, 0,3 s per noot |
| `mozart` | 27 | openingsmotief Eine kleine Nachtmusik (publiek domein): G D G D G D G B D (gepuncteerd ritme), zaagtand zacht, 2,6 s |
| `cuckoo` | 34 | koekoek: twee tonen (E5 → C5, sinus met vibrato 6 Hz) drie keer met 0,7 s ertussen |
| `rooster` | 42 | haan: glissando 600 → 1100 → 800 Hz met vibrato en drie "lettergrepen", zaagtand, 1,8 s; grappig bedoeld |
| `baby` | 48 | huilende baby: formant-wah (twee gefilterde zaagtanden 300 Hz + 500 Hz met een sweep 400 → 900 → 400 Hz), drie uithalen van 0,8 s |
| `modem` | 55 | inbelmodem: 0,6 s toonkiezen (DTMF-paren), 1,2 s wisselende sinussen 1200/2400 Hz met ruis (witte-ruisbuffer), 0,8 s "carrier"-brom; 3 s |
| `foghorn` | 60 | misthoorn: lage zaagtand 110 Hz + 165 Hz met langzame aanzet en uitloop, 2 keer 1,4 s |

Namen (NL · EN, voor bouwer C in unlocks.json): Marimba · Marimba; Ode an die Freude · Ode to Joy; Kleine Nachtmusik · A Little Night
Music; Koekoeksklok · Cuckoo clock; Haan · Rooster; Huilende baby · Crying baby; Inbelmodem · Dial-up modem; Misthoorn · Foghorn.

### 1c. Data en validator (bouwer C: `data/unlocks.json`, `tools/validate-data.ts`, `src/i18n/xp.ts`, tests met het aantal ontgrendelingen)

- unlocks.json (17 → 36): tien confetti-regels (§1a; kind `confetti`, `by: { level }`, `icon` passend, `value` = de look, `rarity`
  volgens `rarityForLevel`: hearts common; triple, leaves, snow, quadruple rare; pasta, fireworks, bubbles, lanterns epic; aurora
  legendary; NL/EN naam en één zin beschrijving), acht geluiden (§1b; kind `timerSound`, zelfde regel: marimba common; ode, mozart,
  cuckoo, rooster, baby rare; modem, foghorn epic), en `{ id: 'gold-theme', kind: 'feature', by: { level: 100 }, icon: '🏆', value:
  'gold', rarity: 'legendary', nl: { name: 'Gouden thema', description: 'Donker met goud: het thema voor wie level 100 haalde.' }, en: {
  name: 'Gold theme', description: 'Dark with gold: the theme for reaching level 100.' } }`.
- Validator: als `validateUnlocks` een lijst bekende `value`s per kind heeft, de nieuwe waarden erin; anders niets.
- i18n in src/i18n/xp.ts (alle sleutels van dit blok, NL én EN): `style.theme.gold` NL "Goud" · EN "Gold"; `style.goldUnlockedMaker`
  NL "vrijgespeeld als maker" · EN "unlocked as the maker"; `more.goldCount` NL "nog {n} keer…" · EN "{n} more…" met zuster
  `more.goldCountOne` NL "nog 1 keer…" · EN "1 more…"; `more.goldUnlocked` NL "🏆 Gouden thema vrijgespeeld — jij bent de maker."
  · EN "🏆 Gold theme unlocked — you are the maker."; `more.goldAlready` NL "Het gouden thema is al vrij." · EN "The gold theme is
  already unlocked."

### 1d. Gouden thema en het makers-ei (bouwer D: `src/theme.ts`, `src/styles/base.css`, `src/screens/StyleScreen.tsx`, `src/screens/MoreScreen.tsx`,
`src/styles/settings.css`, `tests/theme.test.ts` [nieuw, pure functies])

- `Theme` krijgt `'gold'`; `PAPER.gold = '#15120c'`; `isTheme` kent 'gold'. Bij het toepassen van een opgeslagen 'gold' terwijl het niet
  vrij is (`isActive('gold-theme')` noch de instelling hieronder): val terug op 'system' (geen vergrendeld thema).
- base.css, nieuw blok `:root[data-theme='gold']` (`color-scheme: dark`): `--paper: #15120c; --card: #1f1a10; --ink: #f3e9c8; --muted:
  #c9b98a; --cobalt: #d4a72c; --tomato: #ef6a55; --rosemary: #9fcf8a; --orange: #e9a852; --line: rgba(212,167,44,.22); --press:
  rgba(212,167,44,.16); --on-cobalt: #1a1406; --on-rosemary: #15120c;` plus de diet-* en rarity-* tokens van het donkere blok (kopie), met
  `--rarity-legendary: #ffd75e`. Contrast: inkt op papier ≈ 14:1, goud op papier ≈ 8:1, on-cobalt op goud ≈ 7:1. Nergens goud als
  tekstkleur op kaarten behalve koppen/bijschriften (`.fold-head` erft `--cobalt`, dus die worden vanzelf goud).
- Jouw stijl → Thema: `THEME_TILES` krijgt `'gold'` erbij, alleen getoond als `isActive('gold-theme') || goldUnlockedByMaker.value`;
  swatch `data-theme-swatch="gold"` (donker vlak met gouden rand); onder het tegeltje bij het makers-ei de regel `style.goldUnlockedMaker`.
- **Makers-ei** (MoreScreen.tsx, Over): de `<dd>` met de versie wordt een `<button type="button" class="about-version">` (zelfde
  uiterlijk, geen knopstijl); een tik telt mee zolang de vorige tik minder dan 2 s geleden was (anders begint de teller opnieuw op 1).
  Vanaf tik 25 verschijnt onder de `<dl>` een muted regel `more.goldCount` ("nog 8 keer…"); bij tik 33: toestel-instelling
  `theme.goldUnlocked = true` (`getSetting`/`setSetting`, signal `goldUnlockedByMaker` in theme.ts, geladen bij `initTheme`), de regel wordt
  `more.goldUnlocked` (role="status", blijft staan tot je het scherm verlaat) en het thema zelf wordt NIET automatisch gezet (Stijn kiest
  het in Jouw stijl → Thema). Is het al vrij: bij tik 33 `more.goldAlready`. Geen XP, geen badge, geen melding elders. Pure functie
  `tapCounter(prev, nowMs)` met test: reset na > 2 s, telling, 33 → vrij.
- Geen regel in de handleiding over het ei; wel één alinea in docs/ACHTER-DE-SCHERMEN.md (Fable, na de bouw).

### 1e. Handboek (bouwer E: `data/handbook/07-badges-xp.json`, `docs/HANDLEIDING.md`, `docs/HANDBOOK.md`)

`badges-xp.stijl-confetti` (17 stijlen, ladder dubbel → trippel → quadruppel, de ontwerpen met hun levels), `badges-xp.stijl-geluiden`
(15 geluiden; de nieuwe met hun levels; dat ze gemaakt zijn met toontjes, geen opnames), `badges-xp.stijl-thema` (vierde thema Goud
op level 100; niets over het ei), de rij over Vrijgespeeld als die aantallen noemt. Daarna `npm run validate:data` en
`node --experimental-strip-types tools/handbook-md.ts`.

## 2. Opus mag dit NIET zelf beslissen

De tabellen van §1a en §1b (waarden, levels, recepten) · geen opnames, geen beschermde melodieën · de goudtokens van §1d · 33 tikken
en de 2 s-regel · het ei zonder XP/badge/handleiding · de thema-naam "Goud" · nieuwe dependencies (nee).

## 3. Bestandsverdeling

**A — Confetti:** `src/components/Confetti.tsx`, `src/styles/xp.css` of waar `.confetti` staat (alleen nieuwe keyframes/klassen), `tests/confetti.test.ts` (als die bestaat).
**B — Geluiden:** `src/sounds.ts`, `tests/sounds.test.ts` (als die bestaat).
**C — Data en teksten:** `data/unlocks.json`, `tools/validate-data.ts`, `src/i18n/xp.ts`, `tests/validate-badges.test.ts` (aantal 17 → 36), `tests/unlocks.test.ts` (als die bestaat).
**D — Thema en ei:** `src/theme.ts`, `src/styles/base.css`, `src/screens/StyleScreen.tsx`, `src/screens/MoreScreen.tsx`, `src/styles/settings.css`, `tests/theme.test.ts` [nieuw].
Gebruikt de sleutels van C (bestaan ze nog niet bij jouw check: meld als open).
**E — Handboek:** `data/handbook/07-badges-xp.json`, `docs/HANDLEIDING.md`, `docs/HANDBOOK.md`. Raakt geen src.
**Integrator:** check/test/build/build:next/validate groen; dev-app (375 px): elke nieuwe confetti-stijl via "Probeer" op Jouw stijl →
Confetti (testdata: een profiel op level 90), elk nieuw geluid via de test-knop; Thema Goud: alle schermen leesbaar (Home, Recepten,
een recept, kookstand, Boodschappen, Meer, handleiding), knoppen en balken goud, geen onleesbare combinatie; het ei: 33 tikken op
Versie → melding, tegeltje Goud verschijnt; 32 tikken en 3 s wachten → teller herstart. DEVICE-TEST: nieuwe rij 114 "Vrijspeel-rijkdom
(V5)" NL én EN na rij 113 (confetti-ladder en ontwerpen, geluiden, thema Goud via level 100 — het ei NIET in DEVICE-TEST). STATUS-alinea
en de regel "Gebouwd: …".

## 4. Niet in dit blok

V6, V7, V8, V9. Een gouden avatar-lijst of gouden badge-rand bij het thema: niet nu.
