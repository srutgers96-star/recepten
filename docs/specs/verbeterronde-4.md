# Spec V4 — Dopamine-kick bij Gekookt!: het woord groot, een XP-balk die oploopt, Snelle vieringen (Stijn, 30 okt + 8 nov 2026)

Status: in aanbouw (Fable, 8 nov 2026). Eén blok, vier bouwers + integrator (lichte modus). Bron: docs/IDEAS.md idee 9 (Stijn 30 okt,
alle open vragen door hem beantwoord; 8 nov: "goed, gaan we zo doen"). Leidend bij tegenspraak: docs/specs/README.md §2–§4,
docs/specs/xp-levels.md (§1 "geen spoor van XP als badges uit staan", §1c–§1e pops en level-up), docs/specs/badges-avatar.md
(ontgrendelingen "rijk, niet spaarzaam"), docs/specs/handbook.md §4.

**Kritische lezer (Fable, vooraf).** (1) Twee lagen, twee schakelaars: het **woord** hoort bij de viering en volgt de
confetti-instelling (en `prefers-reduced-motion`); de **XP-strook** is XP en volgt de badges-schakelaar (badges uit = geen strook,
geen spoor). (2) "Overcooked!" is geen vieringssoort maar de crit ×5 op een pop; die komt een tel ná "Gekookt!" uit de settle.
Daarom begint het woord als "Gekookt!" en schakelt het om naar "Overcooked!" (met de bestaande schud-animatie) zodra zo'n pop
binnenkomt terwijl het woord nog staat. (3) De level-up-sheet opent nu meteen bij de settle; met de strook moet hij wachten tot de
balk vol is gelopen, anders ziet niemand het volstromen. (4) De pops van 6D-1 blijven voor foto en beoordeling (Stijn 30 okt: te
klein om een balk te tonen); voor koken, badges en uitdagingen gaat de som in de strook. (5) "Snelle vieringen" is een
ontgrendeling van de bestaande soort `feature` (geen nieuwe kind; de validator en het level-up-venster kennen die al) plus één
toestel-instelling. (6) Geen `--gold`-token in base.css: het woord krijgt zijn eigen goudtint in xp.css.

**Feitencheck (Fable, in de code).** `celebrate(kind)` (src/celebrate.ts) met `CelebrationKind = 'cooked' | 'firstRecipe' |
'milestone' | 'stars' | 'challenge'`, signal `celebration` `{ kind, at, style }`, `confettiEnabled`, `prefersReducedMotion()`;
<Confetti/> (src/components/Confetti.tsx) 1200 ms (klein 850), `durationMs`-prop, `clearCelebration` na afloop. Gekookt: src/cooklog.ts:87
en CookScreen.tsx:617 roepen `celebrate(kind)` aan bij een kookbeurt; badges.ts:475 `celebrate('milestone')` alleen als er niets
loopt; challenges.ts:280 `celebrate('challenge')`. XP: `settleXp(memberId)` → `doSettle` → `XpDelta { amount, pops, levelFrom,
levelTo, zeroReasons }` → `queuePops(delta.pops)` en `announceLevelUp(memberId, from, to, unlocked)` → signal `levelUp` →
<LevelUpSheet/>. <XpPop/>: `POP_DELAY_MS 900`, `POP_GAP_MS 350`, `POP_VISIBLE_MS 1400`, `POP_SUM_MS 600`, `SHAKE_MS 400` (shell schudt bij
crit 'overcooked'); `XpPopItem { id, xp, crit, kind, sumAfter? }`; `XpEventKind = 'cook' | 'week' | 'photo' | 'recipe' | 'badge' |
'challenge'`. <XpBar memberId compact?/> leest `xpStates`; `xpForLevel`/`levelForXp` in src/domain/xp.ts. Ontgrendelingen:
data/unlocks.json (16), `UnlockKind = 'confetti' | 'timerSound' | 'cookedSound' | 'cookFont' | 'feature'`, `isActive(id)`,
`unlockData()`, `announceUnlocks` (level-up-venster); Jouw stijl (StyleScreen.tsx) met tabs avatar/sounds/confetti/fonts/theme,
`Section`-blokken, kookletter via setting `cook.font` (`data-font` op de kookkaart). Shell (src/app.tsx:384–389): <Confetti/>,
<BadgeToast/>, <ChallengeToast/>, <XpPop/>, <LevelUpSheet/>. Handboek 07: `badges-xp.xp-verdienen` (pops), rijen over level-up en
confetti.

## 0. Wat Stijn vroeg (30 okt, letterlijk) en besliste

"Cooked en Overcooked mogen vóór of in de confetti pontificaal in beeld, en misschien een fractie langer; de dopamine-kick kan iets
beter. En dan een soort XP-balkje in beeld dat je level optelt: je profiel-XP-balk waarbij je hem omhoog ziet gaan, zodat je ziet
wat voor verschil het maakt." Besluiten Stijn (30 okt): tikken tijdens de viering versnelt ×2 (altijd); ontgrendeling op level 30
**Snelle vieringen** = schakelaar die alles standaard op dubbele snelheid zet; de XP-balk NIET bij een foto of beoordeling, WEL bij
koken en bij badges. 8 nov: "goed, gaan we zo doen."

## 1. Gedrag

### 1a. Het woord (bouwer B)

- Nieuwe component `src/components/CelebrationWord.tsx`, één keer gemount in de shell direct ná <Confetti/>. Hij luistert naar
  `celebration`: bij `kind === 'cooked'` toont hij **Gekookt!** (`celebrate.cooked` NL "Gekookt!" · EN "Cooked!") groot en
  gecentreerd over het scherm (48 px, 800, goud `--celebrate-gold: #c9a227` met een donkere tekstschaduw voor leesbaarheid op licht
  én donker), in de kookletter als die aanstaat (`data-font` = de waarde van de setting `cook.font`, dezelfde CSS-regels als de
  kookkaart), met een korte schaal-animatie (0,8 → 1,0 in 180 ms) en vervagen aan het eind; totaal **1,4 s** (`WORD_MS = 1400`).
  Bij `'challenge'`: **Gehaald!** (`celebrate.challenge` NL "Gehaald!" · EN "Done!"). Bij `'milestone'`, `'firstRecipe'` en
  `'stars'`: geen woord (de badge-toast en de pop zeggen het al).
- **Overcooked:** komt tijdens het woord een pop met `crit === 'overcooked'` binnen (bouwer A geeft dat door via het signal
  `celebrationCrit`, §1b), dan wordt het woord **Overcooked!** (`celebrate.overcooked`, NL en EN gelijk) in de rode crit-kleur van de
  pop, de bestaande schud-animatie van de shell speelt (al in XpPop; niet dubbel), en het woord blijft 1,0 s langer. Een crit
  `'cooked'` (×2) geeft het woord een gouden gloed (`text-shadow` groter), geen andere tekst.
- Het woord volgt `confettiEnabled` (uit = geen woord) en `prefersReducedMotion()` (dan 1,4 s statisch, geen schaal, geen gloei).
  `pointer-events: none`, `aria-hidden` (de toast/pop blijven de toegankelijke melding).

### 1b. De XP-strook (bouwer A: XP-laag; bouwer B: component)

- **XP-laag (src/xp.ts, bouwer A):** `XpDelta` krijgt `totalFrom` en `totalTo` (het totaal vóór en ná deze settle; `totalFrom =
  totalTo − amount`). `queuePops` splitst: pops met `kind` `'photo'` of `'recipe'` gaan zoals nu naar `xpPops` (<XpPop/>); alle
  andere (`'cook'`, `'week'`, `'badge'`, `'challenge'`) gaan samen naar een nieuw signal `xpRise: Signal<XpRiseInfo | null>` met
  `{ memberId, totalFrom, totalTo, amount, levelFrom, levelTo, crit: Crit | null, at: number }` (`crit` = de zwaarste crit in die
  pops: overcooked > cooked > null). Bovendien zet `queuePops` het signal `celebrationCrit: Signal<{ crit: Crit; at: number } | null>`
  bij een crit (voor het woord, §1a). Is er al een `xpRise` open (nog niet door de strook gewist), dan telt de nieuwe erbij op
  (totalFrom blijft, totalTo en amount nemen de nieuwe waarden, levelTo het hoogste, crit het zwaarste).
- **Level-up wachten:** `announceLevelUp` wordt bij een rise niet meteen aangeroepen: `doSettle` geeft de level-up mee in
  `xpRise.levelUp = { from, to, unlocked }` en de strook roept `announceLevelUp` aan als de balk vol is (bouwer A exporteert
  `releaseLevelUp(info)`); zonder rise (alleen foto/beoordeling, of badges uit) gedraagt alles zich als nu. Quiet settles: niets.
- **Component `src/components/XpRise.tsx` (bouwer B):** gemount in de shell vóór <LevelUpSheet/>. Bij een `xpRise`: een strook
  schuift van onder in, boven de navigatiebalk (`bottom: calc(var(--nav-h, 64px) + env(safe-area-inset-bottom) + 8px)`), met de
  inhoud van de XpBar: regel 1 "Level 5 · Boterhamsmeerder" met rechts "+42 XP" (`xp.rise.plus` NL "+{xp} XP" · EN "+{xp} XP"), de
  kobaltbalk eronder. Start op `totalFrom` (balkvulling binnen het level van `totalFrom`), telt in **1,2 s** (`RISE_MS = 1200`,
  `requestAnimationFrame`, ease-out) op naar `totalTo`; het getal rechts telt mee. **Level-up:** de balk loopt vol, springt leeg
  naar het nieuwe level, de titelregel verandert, de balk loopt door tot `totalTo`; daarna `releaseLevelUp` → het bestaande
  level-up-venster. De strook blijft 1,2 s staan na het oplopen, schuift dan weg en wist `xpRise`. Tikken op de strook sluit hem
  direct (en releaset een wachtende level-up). Alleen met badges aan (`badgesEnabled`; anders rendert hij niets en releaset hij
  meteen). `prefers-reduced-motion`: geen oplopen, de balk staat direct op `totalTo`, 1,8 s zichtbaar. Geluid: de tadaa van 6D-4a
  blijft waar hij is.
- <XpPop/> (bouwer B): toont alleen nog pops van `'photo'` en `'recipe'`; de somregel en de schud-animatie blijven voor wat er door
  komt; de schud-animatie bij `overcooked` verhuist naar de strook (`XpRise` schudt de shell met dezelfde class `.shell.shake`).

### 1c. Snelheid: tik = ×2, en de ontgrendeling Snelle vieringen (bouwer B: celebrate.ts, Confetti; bouwer C: data, Jouw stijl)

- **Tik = ×2 (altijd):** één tik ergens tijdens de viering (woord, confetti of strook) zet voor die ene viering alle resterende
  duren op de helft (`celebrationSpeed` signal 1 | 2 in src/celebrate.ts, terug naar 1 als alles klaar is). Woord, strook en
  <Confetti/> (`durationMs` gedeeld door de snelheid) lezen het.
- **Snelle vieringen (level 30):** nieuwe ontgrendeling in data/unlocks.json: `{ id: 'fast-celebrations', kind: 'feature', by:
  { level: 30 }, icon: '⚡', value: 'fast', rarity: 'rare', nl: { name: 'Snelle vieringen', description: 'Woord, confetti en
  XP-balk standaard op dubbele snelheid.' }, en: { name: 'Fast celebrations', description: 'Word, confetti and XP bar at double speed
  by default.' } }` (bouwer C). Toestel-instelling `celebrate.fast` (boolean, standaard uit) in src/celebrate.ts (bouwer B:
  `celebrateFast` signal, `loadCelebrateSettings` leest hem mee, `setCelebrateFast(on)`). Staat hij aan én is `isActive('fast-celebrations')`,
  dan is de standaardsnelheid 2 (een tik maakt er dan geen 4 van: maximum 2). Jouw stijl (bouwer C, StyleScreen.tsx, tabblad
  confetti, onder de stijlen): een `Section` met een schakelaar **Snelle vieringen** (`style.fast` NL "Snelle vieringen" · EN "Fast
  celebrations", hint `style.fastHint` NL "Alles op dubbele snelheid. Tikken tijdens een viering kan altijd." · EN "Everything at
  double speed. Tapping during a celebration always works."), alleen zichtbaar als de ontgrendeling actief is. De tegel in
  Vrijgespeeld komt vanzelf uit unlocks.json; het level-up-venster noemt hem op level 30 via het bestaande mechanisme.
- i18n (bouwer B schrijft ALLE sleutels van dit blok in src/i18n/xp.ts, NL én EN letterlijk): `celebrate.cooked`,
  `celebrate.overcooked`, `celebrate.challenge`, `xp.rise.plus`, `style.fast`, `style.fastHint`.

### 1d. Handboek (bouwer D: `data/handbook/07-badges-xp.json`, `docs/HANDLEIDING.md`, `docs/HANDBOOK.md`)

`badges-xp.xp-verdienen` (bij koken, badges en uitdagingen schuift onderaan een strook in met je XP-balk die oploopt en "+42 XP";
bij een foto of beoordeling het kleine "+n"), een nieuwe rij `badges-xp.gekookt-woord` ("Gekookt! groot in beeld": het woord in de
confetti, Overcooked! bij een ×5, tikken versnelt), een nieuwe rij `badges-xp.snelle-vieringen` (ontgrendeling op level 30,
schakelaar in Jouw stijl onder Confetti), en de level-up-rij: het venster opent pas als de balk vol is. Daarna `npm run validate:data`
en `node --experimental-strip-types tools/handbook-md.ts`.

## 2. Opus mag dit NIET zelf beslissen

De duren (woord 1,4 s, +1,0 s bij Overcooked, strook 1,2 s oplopen + 1,2 s staan, confetti 1,2 s) · welke pops in de strook gaan
(cook, week, badge, challenge) en welke pop blijven (photo, recipe) · het woord volgt confetti, de strook volgt badges · level 30 en
de soort `feature` voor Snelle vieringen · maximumsnelheid 2 · nieuwe dependencies (nee) · de goudtint (#c9a227).

## 3. Bestandsverdeling

**A — XP-laag:** `src/xp.ts` (XpDelta totalFrom/totalTo, splitsing in `queuePops`, signals `xpRise` en `celebrationCrit`,
`releaseLevelUp`, uitgestelde `announceLevelUp`), `tests/xp.test.ts` (alleen toevoegen: totalFrom/totalTo, splitsing, samenvoegen
van twee rises, crit-keuze).
**B — Vieringslaag en componenten:** `src/celebrate.ts` (`celebrationSpeed`, `celebrateFast`, `setCelebrateFast`, laden), `src/components/CelebrationWord.tsx`
[nieuw], `src/components/XpRise.tsx` [nieuw], `src/components/XpPop.tsx`, `src/components/Confetti.tsx` (alleen `durationMs` / snelheid),
`src/app.tsx` (twee mounts), `src/styles/xp.css`, `src/i18n/xp.ts`.
**C — Ontgrendeling en Jouw stijl:** `data/unlocks.json`, `src/screens/StyleScreen.tsx` (de Section met de schakelaar; importeer
`celebrateFast`/`setCelebrateFast` uit `@/celebrate` — bestaan ze bij jouw check nog niet, meld dat als open), `tests/validate-badges.test.ts`
of waar het aantal ontgrendelingen (16 → 17) gepind staat, `tests/unlocks.test.ts` als die bestaat.
**D — Handboek:** `data/handbook/07-badges-xp.json`, `docs/HANDLEIDING.md`, `docs/HANDBOOK.md`. Raakt geen src.
**Integrator:** check/test/build/build:next/validate groen; acceptatie in de dev-app (375 px, NL én EN, badges aan): Gekookt! →
het woord groot in de confetti, daarna de strook die oploopt met "+n XP"; een profiel vlak onder een levelgrens (testdata) →
balk vol, nieuw level, dan pas het level-up-venster; foto maken → alleen de kleine pop; badges uit → wel het woord en de confetti,
geen strook; confetti uit → geen woord, wel de strook; tik tijdens de viering → alles sneller; profiel op level 30 → tegel Snelle
vieringen in Vrijgespeeld en de schakelaar in Jouw stijl → Confetti; `prefers-reduced-motion` (emuleren) → statisch woord, balk
direct vol. DEVICE-TEST: nieuwe rij 113 "Dopamine-kick bij Gekookt! (V4)" NL én EN na rij 112; de bestaande rijen over de "+12"-pop bij
koken (zoek "+12" en "pop") bijwerken naar de strook. STATUS-alinea en de regel "Gebouwd: …".

## 4. Niet in dit blok

V6, V7, V8, V9 (docs/IDEAS.md). Geluid en de badge-toast veranderen niet.
