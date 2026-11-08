# Spec V1b — Verbeterronde 1b (Stijn, 8 nov 2026, tweede testronde)

Status: in aanbouw (Fable, 8 nov 2026). Eén blok, zeven kleine bouwers + integrator (lichte modus). Bron: Stijns bericht van
8 nov na het bekijken van V1 (§0). Leidend bij tegenspraak: docs/specs/README.md §2–§4, CLAUDE.md, docs/specs/handbook.md §4,
docs/specs/verbeterronde-1.md (V1: `FoldHead`, `row-member`, `PICK_FILTER_TTL_MS`).

**Kritische lezer (Fable, vooraf).** (1) De groep "Jij & je huishouden" wordt opnieuw ingedeeld; V1's ledenrijen (`row-member`)
blijven, alleen hun plek en label veranderen. (2) "Verder met" op Home is de regel uit `continueWithId` (src/domain/tonight.ts:
laatst bekeken recept van vandaag), niet de kookbalk van een lopende kooksessie; Stijn ervaart "vandaag" als te lang en kan de
regel niet wegklikken. (3) Een knop ín een `<label>` activeert het schuifje niet (interactieve inhoud), maar we bouwen de rij
toch om naar een `<div class="setting">` met een losse `<label class="switch">`, zodat er geen twijfel over is. (4) De
°F-instelling is nu een boolean `units.fahrenheit` die alleen `StepView` leest; een driekeuze erbij is een nieuwe sleutel met
een eenmalige vertaling van de oude waarde, geen migratie van Dexie. (5) De voorraaddrempel is één constante
(`STAPLE_THRESHOLD`, src/domain/aggregate.ts) met tests die 250 noemen. (6) De uitdagingsbeloning schaalt met het level bij de
start en wordt in de lopende uitdaging bewaard, dus `deriveXp` en `XP_RULES_VERSION` (3) blijven ongemoeid. (7) Een knipoog
vraagt een aanspreekbare ogenlaag in de avatar-SVG; die laag krijgt een `data-layer`-attribuut (puur markup, niets in de data
of de deelcodes).

**Feitencheck (Fable, in de code).** MoreScreen: groep "you" na V1 = Mijn profiel (MenuRow met Avatar 36 px) · ledenrijen
`row-member` · rij Huishouden (hint `more.householdRowHint`, leeg `more.householdRowEmpty`) · "Profielen op deze telefoon"
(alleen >1) · 📅 Kookkalender · 🎨 Jouw stijl · stepper Aantal personen; instellingen als `<label class="setting">` met
`.label` + `.switch`. StyleScreen: tabs `StyleTab = 'avatar' | 'sounds' | 'confetti' | 'fonts' | 'theme'`, route
`/more/style?tab=<tab>`. Header: `HeaderProps { title: string; back?; backLabel?; action?; noLang?; children? }`; HomeScreen geeft
`title={todayTitle(lang)}`. RecipeScreen: meta-regel regel ±551 (`recipe.timeActive` "{n} min bezig", `recipe.timeTotal`
"{n} min totaal", `recipe.classic` "klassieker uit het boek") en dezelfde woorden in `asTextInput` (regel ±737). StepView:
`useFahrenheit()` → `getFahrenheit()` (repo `FAHRENHEIT_KEY = 'units.fahrenheit'`), `shownStep(step, l, fahrenheit, …)` →
`addFahrenheit(text)` (zelfde bestand). ProfileScreen: `.profile-hero` met `<Avatar profile big level />` en de naam; tegels
met ✏️ `profile.edit` → `toggle('edit')`. Avatar (ProfilesScreen.tsx): `Avatar({ profile, big?, level? })` →
`avatarSvgFor(profile, level, uid)` → `renderAvatarSvg(spec, parts, { color, level, uid })`; de niveauring tekent de clipvorm
met `stroke`. DeltaShareScreen: `<Avatar profile={m} />` in `.partner-chip`, gekozen = class `on`; CSS
`.delta .partner-chip.on .avatar { box-shadow: 0 0 0 2px var(--on-cobalt) }` (settings.css). aggregate.ts:
`STAPLE_THRESHOLD = { g: 250, ml: 250, count: 5, package: 1 }`, `aboveStapleThreshold`. challenges: `ActiveChallenge { id,
memberId, startedAt, deadline }`, `startChallenge` (src/challenges.ts:184), `settleChallenges` schrijft `DoneChallenge.xp`,
`ChallengeOfferSheet` toont `rewardText(c.xp)`, `ChallengeCard` `rewardText(challenge.xp)`.

## 0. Wat Stijn vroeg (8 nov 2026, ingekort maar letterlijk)

- "'jouw stijl' kan nog uit meer, omdat het al in profiel staat."
- "gabi mag onder een soort uitklapkopje huishouden, staat nu verkeerd om. dat er eigenlijk mijn profiel staat, mag gecentreerd,
  daaronder Huishouden en vrienden-knop & kopje, en daaronder al mn vrienden en huishouden in profiel, en dat het duidelijk is
  wie er in mijn huishouden zit."
- "In home staat er: verder met lasagne, maar die heb ik lang geleden al weggeklikt, dus die mag daar ook weg."
- "Bij specifieke recepten staat nu 20 min bezig · 55 min totaal · klassieker uit het boek. dit kan in minder woorden en wat
  netter, een klokje ofzo. niet te kleurrijk maar subtiel, wel compact."
- "als je nu op confetti klikt in meer, mag hij wel de meerdere confetti's openen. het schuifje daar laten. mag ook bij badges."
- "Als ik op mijn profiel-avatar klik als mijn profiel geopend is, gebeurt er niks: idee: kleine animatie: knipoogje ofzo. en
  een bewerk-knop gewoon rechtsonder, scheelt een klik."
- "trillen bij afloop in meer mag worden: trillen, zonder ondertekst."
- "F (fahrenheit) mag worden gewoon °F. of dat je kan kiezen: fahrenheit of celsius of allebei. geen schuifje is beter."
- "uitdagingen meegroeien, doe maar 1% per level."
- "200 gram bloem stond tussen de heb-ik-al-producten, maar 200 gram is geen 2 eetlepels: dat mag op de boodschappenlijst.
  geldt ook voor suiker bij grotere hoeveelheden (meer dan 100 gram op de normale lijst, minder is prima daaronder)."
- "het ronde randje: als iemand het randje vierkant maakt, moet die vorm meereizen? ik vind van wel."
- "als je op de datum op home klikt mag je wel naar kookkalender gaan."

## 1. Gedrag

### 1a. Meer (bouwer A: `src/screens/MoreScreen.tsx`, `src/styles/settings.css`, `src/i18n/settings.ts`, `tests/i18n.test.ts`)

Groep **Jij & je huishouden**, van boven naar beneden:

1. **Profielblok, gecentreerd:** één `<button type="button" class="more-profile">` met `<Avatar profile={active} level={level} />`
   (48 px via een override `.more-profile .avatar { width: 48px; height: 48px }`), eronder de naam (17 px, 700) en, met badges
   aan, de levelregel (`levelTitleText`, muted small). Alles gecentreerd; min-height 44 px; `:active` → `var(--press)`. Tik →
   `/more/profile`. Vervangt de MenuRow Mijn profiel (de `ariaLabel`-opbouw blijft: "Mijn profiel: Stijn, Level 33 · …").
2. **Tussenkop-rij "Huishouden & vrienden":** een `MenuRow` met extra class `row-subhead`: label `more.householdFriends` NL
   "Huishouden & vrienden" · EN "Household & friends" in de `.more-sub`-stijl (12 px, 700, kleine hoofdletters, letter-spacing
   0,04em, muted), › rechts, min-height 40 px; tik → `/more/household`. Dit vervangt de rij Huishouden mét hint uit V1.
3. **De ledenrijen** (`row-member` uit V1, ongewijzigd formaat): eerst de huisgenoten, dan de vrienden. Achter de naam een klein
   label `<span class="who-tag">`: huisgenoot → `more.tagHousemate` NL "huisgenoot" · EN "housemate"; vriend → `more.friend`
   (bestaat: "Vriend"/"Friend", wordt NL "vriend" · EN "friend", kleine letter). De sub-regel houdt alleen de levelregel
   ("Level n · titel", badges aan) of "via kaartje"/"met de hand". Tik → `/more/household`.
4. **Lege staat** (geen andere huisgenoot én geen vriend): onder de tussenkop één `MenuRow` met label `more.householdRowEmpty`
   (bestaat: "Voeg een huisgenoot toe" / "Add a housemate") → `/more/household`.
5. **Profielen op deze telefoon** (alleen bij meer dan één profiel), 📅 **Kookkalender**, stepper **Aantal personen**: zoals V1.
6. **Weg:** de rij 🎨 Jouw stijl (tegel op Mijn profiel). Sleutels `more.style`, `more.styleHint`, `more.householdRow`,
   `more.householdRowHint` verwijderen als niets ze meer gebruikt (grep; de test "no unused i18n keys" bewaakt het);
   `SHORT_HINTS` in tests/i18n.test.ts bijwerken.

Groep **Instellingen**:

7. **Confetti** en **Badges**: de rij wordt `<div class="setting">` met links `<button type="button" class="label label-link">`
   (tekst + de bestaande `<small>`-hint bij Badges) en rechts `<label class="switch">` om het bestaande `<input type="checkbox">`.
   Tik op de tekst: Confetti → `navigate('/more/style?tab=confetti')`; Badges → `navigate('/more/badges')`. Het schuifje werkt
   als voorheen. `.label-link` krijgt na de titeltekst een muted › (`::after { content: ' ›'; color: var(--muted) }`).
8. **Trillen:** `more.timerVibrate` → NL "Trillen" · EN "Vibrate"; de `<small>` en de sleutel `more.timerVibrateHint` verdwijnen
   (ook uit `SHORT_HINTS`).
9. **Temperatuur** in plaats van "°F erbij": rij `more.temperature` NL "Temperatuur" · EN "Temperature" met een `<Segmented>`
   (zoals de taalkeuze) met drie opties: `°C`, `°F`, `more.temperatureBoth` NL "beide" · EN "both"; waarde uit
   `getTemperatureMode()` en schrijven met `setTemperatureMode(mode)` (bouwer B, §1b; importeer uit `@/db/repo`). Bij een keuze
   ≠ 'c' blijft `recordFeature('fahrenheit')`. Sleutel `more.fahrenheit` verwijderen.

CSS in settings.css: `.more-profile`, `.row-subhead .name` (de more-sub-stijl), `.who-tag` (11 px, padding 1px 6px, border 1px
solid var(--line), border-radius 999px, color var(--muted), margin-left 6px, vertical-align middle), `.label-link` (knop zonder
rand/achtergrond, tekst links, font inherit, zelfde maat als `.label`). En voor §1f: vervang
`.delta .partner-chip.on .avatar { box-shadow: 0 0 0 2px var(--on-cobalt); }` door
`.delta .partner-chip.on .avatar { color: var(--on-cobalt); }` plus `.delta .partner-chip.on .avatar:not(.has-svg) { box-shadow:
0 0 0 2px var(--on-cobalt); }` (het letterrondje blijft rond).

### 1b. Temperatuurkeuze (bouwer B: `src/db/repo.ts`, `src/components/StepView.tsx`, `tests/steps.test.ts`)

- `export type TemperatureMode = 'c' | 'f' | 'both'`; `TEMPERATURE_KEY = 'units.temperature'`. `getTemperatureMode()`: de
  sleutel als die geldig is; anders `units.fahrenheit === true` → `'both'`, anders `'c'` (niets terugschrijven).
  `setTemperatureMode(m)` schrijft de nieuwe sleutel. `getFahrenheit`/`setFahrenheit`/`FAHRENHEIT_KEY` blijven bestaan (de oude
  sleutel wordt nog gelezen voor de vertaling) maar krijgen een commentaarregel dat `units.temperature` leidend is.
- StepView: `useFahrenheit()` → `useTemperatureMode(): TemperatureMode` ('c' tot de waarde gelezen is); `shownStep(step, l,
  mode, lines, dict)`; `addFahrenheit(text)` → `formatTemperatures(text, mode)`: `'c'` = tekst ongewijzigd, `'both'` = het
  huidige gedrag ("180 °C (350 °F)"), `'f'` = elke °C-waarde vervangen door de °F-waarde ("350 °F"), zelfde herkenning en
  afronding als nu. Alle aanroepers (RecipeScreen, CookScreen, …) volgen de nieuwe signatuur; buiten StepView verandert niets
  aan gedrag.
- Tests: "Verwarm de oven voor op 180 °C" in de drie modi; een tekst zonder temperatuur blijft in elke modus gelijk; de
  vertaling van de oude sleutel (true → 'both', ontbrekend → 'c') als de repo-laag testbaar is zonder Dexie (anders alleen de
  pure functie).

### 1c. Home en receptkop (bouwer C: `src/domain/tonight.ts`, `tests/tonight.test.ts`, `src/screens/HomeScreen.tsx`,
`src/components/Header.tsx`, `src/screens/RecipeScreen.tsx`, `src/i18n/browse.ts`, `src/styles/home.css`, `src/styles/browse.css`)

- **"Verder met"**: `continueWithId(last, now, known, hideId, cookedTodayAt, dismissedId, totalMinutes)`: de regel toont alleen
  als `last.at` minder dan **de totale bereidingstijd van het recept plus 3 uur** vóór `now` ligt (`CONTINUE_GRACE_MS = 3 *
  3_600_000`; `totalMinutes` = `recipe.time.total ?? recipe.time.active ?? 0`, door Home meegegeven als functie
  `(id) => number | null` of als getal voor `last.id`; vervangt "zelfde lokale dag". Stijn 8 nov: "soms moet je iets een dag
  laten rusten", dus een recept van 24 uur blijft 27 uur staan) en `last.id !== dismissedId`. Op Home krijgt de regel rechts een kleine × (`<button class="icon-btn home-continue-x">`, 32 px, aria-label
  `common.close`) die het id in localStorage `recepten.home.continueDismissed` zet en de regel meteen verbergt; een later
  bekeken ander recept toont de regel weer. tests/tonight.test.ts: recept van 55 min: na 2 uur ja, na 4 uur nee (ook al is het dezelfde dag); recept met
  totaaltijd 24 uur: na 20 uur ja, na 28 uur nee; zonder tijden: 3 uur; weggeklikt nee, ander id na wegklikken ja.
- **Datum → kookkalender:** `HeaderProps` krijgt `titleTo?: string`; met die prop rendert de Header de titel als
  `<a class="header-title header-title-link" href={'#' + titleTo}>` (zelfde opmaak als de gewone titel, geen onderstreping,
  `:active` → press-kleur) met `aria-label` uit een nieuwe prop `titleLabel?: string`. HomeScreen: `titleTo="/more/calendar"`,
  `titleLabel={t('home.openCalendar')}` → NL "Open de kookkalender" · EN "Open the cooking calendar".
- **Receptkop compact:** de meta-regel wordt `<p class="recipe-meta">` met vooraan een klokje als inline SVG
  (`class="meta-clock"`, 14 px, `viewBox 0 0 24 24`, cirkel r 9 + wijzers "12 7v5l3 2", stroke currentColor 2, fill none,
  aria-hidden) en daarna de delen gescheiden door " · ": `recipe.timeActive` → NL "{n} min" · EN "{n} min"; `recipe.timeTotal`
  blijft "{n} min totaal" / "{n} min total"; `recipe.classic` → NL "klassieker" · EN "classic". Voorbeelden: "⏱ 20 min · 55 min
  totaal · klassieker"; alleen een totaal of active == total: "⏱ 55 min"; geen tijden: alleen "klassieker" zonder klokje. Kleur:
  `var(--muted)`, 14 px, `display: inline-flex; align-items: center; gap: 6px`; geen andere kleur. `asTextInput` (regel ±737)
  gebruikt dezelfde sleutels (dus "20 min · 55 min totaal" in de tekstversie, zonder klokje).

### 1d. Mijn profiel en de selectie-ring (bouwer D: `src/domain/avatar.ts`, `tests/avatar.test.ts`, `src/screens/ProfilesScreen.tsx`,
`src/screens/ProfileScreen.tsx`, `src/screens/DeltaShareScreen.tsx`, `src/styles/avatar.css`, en het stylesheet waar `.profile-hero` staat)

- **Potlood rechtsonder:** in `.profile-hero` (wordt `position: relative; display: inline-block` rond de avatar) voor het ACTIEVE
  profiel een ronde knop `<button type="button" class="profile-edit-fab" aria-label={t('profile.edit')}>` (40 px, rechtsonder op
  de avatar: `position: absolute; right: 0; bottom: 0`, achtergrond `var(--card)`, rand `1px solid var(--line)`, schaduw
  `0 2px 8px rgba(0,0,0,.15)`) met een potlood-SVG (currentColor, 18 px). Tik → hetzelfde als de tegel ✏️ (`toggle('edit')`) en
  daarna `scrollIntoView({ block: 'nearest' })` van het paneel. De tegel blijft.
- **Knipoog:** `renderAvatarSvg` wikkelt elke laag in `<g data-layer="<laag-id>">…</g>` (de bestaande markup van het onderdeel
  erin ongewijzigd; `tests/avatar.test.ts` aanpassen waar hij de structuur letterlijk vergelijkt; de validator van de data
  verandert niet). ProfileScreen: tik op de grote avatar (geen navigatie) → class `wink` op de `.avatar` gedurende 700 ms
  (useState + setTimeout; geen nieuwe knipoog zolang er een loopt). CSS in avatar.css: `.avatar.wink [data-layer="<ogen-id>"] {
  transform-box: fill-box; transform-origin: center; animation: av-wink 600ms ease-in-out }` met `@keyframes av-wink { 0%,100% {
  transform: scaleY(1) } 40%,60% { transform: scaleY(0.08) } }`, en `.avatar.wink .avatar-svg { animation: av-tilt 600ms
  ease-in-out }` met `@keyframes av-tilt { 30% { transform: rotate(-5deg) } 70% { transform: rotate(4deg) } }`; onder
  `prefers-reduced-motion: reduce` geen van beide. De ogen-laag-id staat in data/avatar-parts.json (bouwer D zoekt hem op en
  noemt hem in het rapport). Zonder getekende avatar (letterrondje) alleen de tilt.
- **Selectie-ring langs de lijstvorm** (Stijn: "die vorm moet meereizen"): `Avatar` krijgt `highlight?: boolean` en geeft het door
  (`avatarSvgFor(profile, level, uid, highlight)` → `renderAvatarSvg(…, { color, level, uid, highlight })`). Met `highlight`
  tekent `renderAvatarSvg` ná `frameSvg` de clipvorm nog eens met `fill="none" stroke="currentColor" stroke-width="3"` (zoals de
  niveauring; zonder lijst de cirkel r 48, stroke-width 4). DeltaShareScreen: `<Avatar profile={m} highlight={chosen ===
  foldName(m.name)} />`. De kleur komt uit CSS (`color: var(--on-cobalt)` op `.partner-chip.on .avatar`, bouwer A). tests/
  avatar.test.ts: met `highlight` bevat de uitvoer de extra stroke, zonder niet.

### 1e. Voorraaddrempel (bouwer E: `src/domain/aggregate.ts`, `tests/aggregate.test.ts`)

`STAPLE_THRESHOLD = { g: 100, ml: 100, count: 5, package: 1 }`. Een voorraadproduct (bloem, suiker, olie, melk, …) met in totaal
≥ 100 g of ≥ 100 ml komt met zijn hoeveelheid op de gewone lijst; eronder blijft het onder Voorraad op 0 (tik = 1). Commentaar
bij `aboveStapleThreshold` en alle tests die 250 noemen bijwerken; één test erbij: "200 g bloem" in één recept → gewone lijst,
"2 el bloem" → Voorraad.

### 1f. Uitdagingen +1 % per level (bouwer F: `src/domain/challenges.ts`, `src/challenges.ts`, `src/components/ChallengeOfferSheet.tsx`,
`src/components/ChallengeCard.tsx`, `tests/challenges.test.ts`)

- `export function rewardFor(baseXp: number, level: number): number` = `Math.round((baseXp * (1 + 0.01 * Math.max(0, level - 20))) / 10) * 10`.
  Voorbeelden (tests): (250, 20) → 250 · (250, 30) → 280 (275 → 280) · (250, 50) → 330 (325 → 330) · (250, 100) → 450 ·
  (1500, 100) → 2700 · (250, 5) → 250.
- `ActiveChallenge.xp?: number` (de beloning zoals bij de start berekend; ontbreekt bij uitdagingen van vóór V1b).
  `startChallenge` berekent het level van het lid op dat moment (de bestaande XP-stand via `xpStateFor(memberId)`; is die er
  niet, dan level 1 → factor 1) en bewaart `xp: rewardFor(challenge.xp, level)`. `settleChallenges` schrijft in `DoneChallenge.xp`
  `active.xp ?? challenge.xp`. `deriveXp` en `XP_RULES_VERSION` ongemoeid.
- UI: de aanbodkaarten tonen `rewardFor(c.xp, levelNu)` (het huidige level van het lid, zelfde bron); de lopende kaart toont
  `active.xp ?? challenge.xp`; de geschiedenis toont `d.xp` (al zo). De omschrijvingen in data/challenges.json blijven het
  basisbedrag noemen; nergens een tweede getal.

### 1g. Handboek (bouwer G: `data/handbook/*.json`, `docs/HANDLEIDING.md`, `docs/HANDBOOK.md`)

Rijen bijwerken (schrijfregels handbook.md §4; knopnamen letterlijk): 08 `instellingen` (lijst onder Instellingen: Taal, Confetti,
Badges, Temperatuur, blok Kookstand & timer) · 08 `fahrenheit` → "Temperatuur: °C, °F of beide" (segment, geen schuifje) · 08
`trillen` ("Trillen") · 08 `confetti` (tik op het woord Confetti opent de confetti-stijlen in Jouw stijl) · 07 `uitzetten`/
`badges-bekijken` (tik op het woord Badges opent Badges) · 07 rijen over Jouw stijl: pad via Mijn profiel → Jouw stijl, niet meer
via Meer · 05 `huishouden`, `lid-toevoegen`, `kaartje-delen`, `voortgang-delen`: pad "Meer → Huishouden & vrienden" (onder je
profielblok) · 01 `wat-home-laat-zien`/Home-rijen: de datum bovenaan opent de kookkalender; de regel "Verder met" verdwijnt na
drie uur of met het kruisje · 02 rij over de receptpagina: het klokje met "20 min · 55 min totaal · klassieker" · 04 rij over
Voorraad/"Heb ik al": vanaf 100 g of 100 ml op de gewone lijst · 07 `uitdagingen`-rijen: de beloning groeit met 1 % per level
boven 20, vast bij de start · 07/01 `mijn-profiel`: potlood rechtsonder op de avatar, tik op de avatar = knipoog. Daarna
`npm run validate:data` en `node --experimental-strip-types tools/handbook-md.ts`.

## 2. Opus mag dit NIET zelf beslissen

Het venster van "Verder met" (totaaltijd + 3 uur) en het wegklik-gedrag · de 100 g/100 ml-drempel · de 1 %-regel en het moment (start) ·
de volgorde en labels op Meer (§1a) · de drie temperatuurmodi en hun teksten · de knipoog (600 ms, ogen + tilt) · de ring
in currentColor langs de clipvorm · nieuwe dependencies (nee) · teksten in de handleiding schrappen buiten §1g.

## 3. Bestandsverdeling

**A — Meer:** `src/screens/MoreScreen.tsx`, `src/styles/settings.css`, `src/i18n/settings.ts`, `tests/i18n.test.ts`.
**B — Temperatuur:** `src/db/repo.ts`, `src/components/StepView.tsx`, `tests/steps.test.ts` (of waar `addFahrenheit` al getest wordt),
en de aanroepers van `shownStep`/`useFahrenheit` buiten MoreScreen (alleen de signatuur).
**C — Home en receptkop:** `src/domain/tonight.ts`, `tests/tonight.test.ts`, `src/screens/HomeScreen.tsx`, `src/components/Header.tsx`,
`src/screens/RecipeScreen.tsx`, `src/i18n/browse.ts`, `src/styles/home.css`, `src/styles/browse.css`.
**D — Profiel en ring:** `src/domain/avatar.ts`, `tests/avatar.test.ts`, `src/screens/ProfilesScreen.tsx` (alleen `Avatar`/`avatarSvgFor`),
`src/screens/ProfileScreen.tsx`, `src/screens/DeltaShareScreen.tsx`, `src/styles/avatar.css`, het stylesheet van `.profile-hero`
(NIET settings.css).
**E — Voorraad:** `src/domain/aggregate.ts`, `tests/aggregate.test.ts`.
**F — Uitdagingen:** `src/domain/challenges.ts`, `src/challenges.ts`, `src/components/ChallengeOfferSheet.tsx`, `src/components/ChallengeCard.tsx`,
`tests/challenges.test.ts`.
**G — Handboek:** `data/handbook/*.json`, `docs/HANDLEIDING.md`, `docs/HANDBOOK.md`. Raakt geen src.
**Integrator:** check/test/build/build:next/validate groen; acceptatie in de dev-app (375 px, NL én EN): Meer → gecentreerd
profielblok, tussenkop Huishouden & vrienden, ledenrijen met label (maak via `#/more/profiles` even een tweede profiel voor een
huisgenoot-rij en verwijder het weer), geen rij Jouw stijl; tik op het woord Confetti → Jouw stijl op het tabblad confetti, tik op
Badges → Badges, schuifjes werken nog; Trillen zonder hint; Temperatuur °C | °F | beide en een stap met "180 °C" in de kookstand in
de drie modi; Home: datum tikbaar → kalender, "Verder met" met × (na wegklikken weg; een recept van 55 min met `last.at` 4 uur geleden → geen regel);
receptpagina: klokje + "20 min · 55 min totaal · klassieker"; Mijn profiel: potlood rechtsonder opent Naam & kleur, tik op de
avatar knipoogt; Deel je nieuwe recepten: de ring van de gekozen chip volgt een zeshoek-lijst (zet via Jouw stijl → Lijst een
zeshoek); Boodschappen: recept met "200 g bloem" → bloem op de gewone lijst, "2 el bloem" → Voorraad; Uitdagingen: aanbod toont
het geschaalde bedrag voor een profiel op level 30 (testdata). DEVICE-TEST: nieuwe rij 110 "Verbeterronde 1b (V1b)" NL én EN na
rij 109 met deze stappen; rij 55 stap 1–2 bijwerken (profielblok, Huishouden & vrienden, geen Jouw stijl; onder Instellingen:
Taal, Confetti, Badges, Temperatuur, Kookstand & timer met Voorlezen, Spraakcommando's, Timergeluid, Trillen); elke rij die
"°F erbij", "Trillen bij afloop" of "Meer → **Jouw stijl**" noemt bijwerken (NL én EN). STATUS-alinea en de regel "Gebouwd: …".

## 4. Niet in dit blok

V2 (delen zonder bestanden, avatars aan de ontvangkant), V4 (dopamine-kick), V6, V7, V9 — zie docs/IDEAS.md.
