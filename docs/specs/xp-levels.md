# Spec 6D — XP, levels, streak, titels, ontgrendelingen en "Sync mijn voortgang"

Status: compleet (Fable, 22 okt 2026)

**Besluit Stijn (24 okt 2026) — ontgrendelingen rijk, niet spaarzaam.** Het level-up-overzicht en de pagina
Vrijgespeeld moeten een "rijk scala" tonen: bij elke level-up minstens één ding, liefst meer. Daarom groeit
data/unlocks.json mee met de avatar-rondes (badges-avatar.md, besluit 24 okt): confetti-stijlen (dubbel, groente,
kippen en taartjes, T-rex …), timergeluiden en het Gekookt!-geluid, kookstand-lettertypes (krijtbord, handschrift …),
avatar-achtergronden en -randen, en **gouden modus** (naast licht en donker) op een hoog level; **challenges komen
vrij op level 20** (eigen klein blok ná 6D-4, Fable ontwerpt de eerste set). 6D-3/6D-4a bouwen het raamwerk met de
eerste set uit §2e; uitbreidingsrondes zijn alleen data. Klein beginnen mag, kaal mag niet: Stijn wil "gewoon veel
opties daar".

Kritische lezer (Fable, 22 okt 2026): gelezen naast de acht andere specs, vooral docs/specs/badges-avatar.md
(besluiten over specs heen in docs/specs/README.md §2; bij tegenspraak wint README.md). De pins (hash32,
94/505, curve, uitgewerkt voorbeeld 491/level 5, 273, 54/83/164) zijn opnieuw nagerekend en kloppen. Voor
deze spec:
- **Bloknamen (canoniek, README §1):** 6D-1 = "Blok 6D-1" hier; 6D-2a/2b = badges-avatar §3a/§3b;
  6D-3 = avatar (badges-avatar §3c); **6D-4a = "Blok 6D-3" hier (ontgrendelingen)**; **6D-4b = "Blok 6D-4"
  hier (sync + kalender)**. DEVICE-TEST-rijen definitief: 92–93 (6D-1), 98 (6D-4a), 99–100 (6D-4b);
  badges-avatar heeft 94–97.
- **Badge-model = dat van badges-avatar.md**: `Badge.tiers?: number[]` (8 drempels) en `BadgeStatus.tier`
  (0..8), niet `levels`/`level`. `XpBadgeFact.level` wordt gevuld met `status.tier`, `secret` met
  `badge.hidden`. **XP per badge** volgt `badgeXp` van badges-avatar: ladder → per bereikt niveau k één
  event `badge:<id>|<k>` met base `50·k`; eenmalige badge → één event `badge:<id>|1` met base
  `badge.xp ?? (hidden ? 250 : 50)` (het fase-5-veld `tier` telt NIET mee). Vóór 6D-2 (6D-1 alleen) geeft
  elke verdiende badge één event base 50 (`level: 1, secret: false`). Omdat 6D-2a de catalogus en de
  badge-XP verandert, zet **6D-2a `XP_RULES_VERSION` op 2** (eerlijke eenmalige melding §1e). §2f is
  herschreven.
- `src/domain/xp.ts` exporteert ook `longestDayStreak(cookDays: readonly number[], rules?): number`
  (= `best` van de streak-doorloop over alle kookdagen) voor de badge `streakDays`; er komt géén
  src/domain/streak.ts.
- Avatar-maker ontgrendelt op **level 3** (`by: { level: 3 }` in data/unlocks.json; badges-avatar
  `AVATAR_MAKER_LEVEL = 3`). Open vraag van badges-avatar (3 of 5) blijft; standaard 3.
- De badge "Overcooked!" leest uit `BadgeFacts.xp?: XpState` (`events.filter((e) => e.crit ===
  'overcooked').length`); er is geen `recordFeature('overcooked')` en 'overcooked' staat niet in FEATURE_IDS.
  `buildFacts` (src/badges.ts, 6D-2a) vult `xp` via `xpStateFor(memberId)`; op 'all' blijft het leeg.
- `#x=`: `badges` gebruikt hetzelfde formaat als `badges.earned`: `id` of `id@k` (regex
  `/^[a-z0-9]+(?:-[a-z0-9]+)*(?:@[1-8])?$/`), niet `id:k`; `avatar?: AvatarSpec` (`{ v: 1, parts, tone?,
  hair? }` uit badges-avatar; via `normalizeAvatarSpec`, ongeldig = weg).
- Home A+ is gebouwd: `LevelLine` vult `src/components/HomeLevelRow.tsx` (6D-1 bouwer C bezit dat bestand,
  niet HomeScreen.tsx). Na 6D-1 toont Home geen badge-telling meer.
- **Anti-valsspeel aanvulling (gat uit de kritische lezing):** het dagplafond geldt óók per
  invoerdag: een kookbeurt krijgt `min(plafondfactor op de kookdag (at), plafondfactor op de invoerdag
  (loggedAt))`; zonder `loggedAt` geldt `at` voor beide. Zo levert in één avond 7 dagen × 3 kookbeurten
  terugdateren hooguit 3 volle + 2 halve op. §2b regel 1b, §6a-test erbij. De 30-jaar-pins en het
  uitgewerkte voorbeeld veranderen niet (hun kookbeurten hebben geen `loggedAt`).
- `ownRecipes` (XP voor een eigen recept) sluit ook recepten met `origin.basedOn` uit (kopieën en eigen
  versies van een klassieker), niet alleen `variantOf`.
- `settleXp` ook na een foto via CookScreen.onPhotoPicked en RecipeScreen.onPhotoFile (zeven
  beloningsmomenten, §3/§5 aangepast). Foto-XP kent geen 7-dagenregel (foto's hebben geen `loggedAt`;
  max 1 beloonde foto per recept per dag blijft de rem; aanvaard).
- `unlocks.disabled` is toestel-lokaal → in `DEVICE_LOCAL_SETTINGS` (§2g aangepast; anders klopt
  `unlocks.phoneWide` niet na een herstel).
- "Probeer" bij het Gekookt!-geluid: `previewCookedSound()` in src/sounds.ts (zelfde `previewCtx`-patroon
  als `previewTimerSound`).
- `src/styles/xp.css` wordt in src/main.tsx geïmporteerd ná badges.css en vóór print.css.
- Na een toekomstige aliasronde (13F-stijl) verandert de seed `cook:<recipeId>|<at>` van omgezette
  kookbeurten mee; dat is een kleine herberekening, geen regelwijziging (geen versiebump nodig).
- De `#x=`-sleutel vraagt om twee regels in CLAUDE.md (invariant 7 en de regel "share tokens are …") en
  één in docs/adr/0004-share-token.md; de integrator van 6D-4b doet dat.
- De drie open vragen voor Stijn blijven (titels; tempo; vrienden); standaard = zoals hier.

Feitencheck Opus, 22 okt 2026: 28 correcties (ontwerpkeuzes ongemoeid; waar een keuze op een verkeerd
feit rust staat een regel "⚠ Feitencheck" direct eronder). Alle pins (hash32, 94/505 crits, curve, titels,
uitgewerkt voorbeeld, anti-valsspeel, streak, week, foto's, 30-jaar 1.259.039) zijn onafhankelijk
nagerekend en kloppen.
- §1a: voorbeeld "922 / 1.500 · nog 578" → "922 / 970 · nog 48" (curve: level 7 = 970).
- §1b: `Avatar` = export uit src/screens/ProfilesScreen.tsx (signatuur erbij).
- §1f, §1j: de Meer-groep heet "Jij & je huishouden" (`more.group.you`), niet "Jij".
- §1g: "Kookstand & timer" is een kopje binnen de groep Instellingen, geen eigen groep.
- §1g: `ensureAudio()` bestaat niet → `unlockAudio()`; de AudioContext in timers.ts is privé.
- §2b: actieve kooktijd ligt niet op alle 196 tussen 20 en 30 min (147 van 196; 5–45).
- §2b: gemiddelde zonder crit is 100,02, niet 100,2.
- §2b, §8: één op tien overslaan → level 95 na 30 jaar (eigen pin), niet 94.
- §2b: robot 17,6 jaar (niet 19), 2×/week na 3 jaar level 25 (niet 24), 5/week 80–84 (niet 91).
- §2c: `b:uiensoep` bestaat niet; echte `b:afwasmachinezalm` heeft 10 regels (fixture-waarden).
- §2g: verwijzing "§1j" voor de regelversie-melding → §1e.
- §2g, §6b.7: back-up is standaard zonder foto's → foto-XP weg na herstel.
- §2h, §3: token-sleutels staan op vijf plekken; `src/pwa.ts` `urlForChrome` ontbrak.
- §2h, §3: boot.ts gebruikt `/^#(r|p|w|b|f)=/` (alternatie), geen tekenklasse.
- §2h, §6a: ook tests/token.test.ts r. ~166 (`{ v: 2, t: 'x' }`) moet naar `'z'`; share.test r. ~251.
- §2h: `ShareEvent` staat in src/db/model.ts, niet in src/domain/model.ts.
- §3 (6D-1): foto's worden ook in CookScreen.onPhotoPicked en RecipeScreen.onPhotoFile opgeslagen.
- §3 (6D-3): `note()` in sounds.ts is privé en altijd sine: golfvorm-parameter nodig.
- §5: een app van vóór 6D-4 ziet `#x=` niet als code (Home / iPhone Safari volle app), niet "ongeldig".
- §5: `more.timerSoundIOSHint` gaat over de stil-schakelaar, niet over de voorgrond.
- §6a: `diffXp`-verwachting met `toEqual` faalt (crit/zeroReasons) → `toMatchObject`.
- §6a: geheime-badge-pin 273 = `{ id: 'geheim', level: 1, secret: true }` (id ontbrak).
- §6a: 30-jaar-pins gelden alleen met `pool++` ná de vakantie-/skip-test.
- §6a: `extractTokens` geeft `{ key, token }`-objecten, geen `['x']`.
- §6b.1, rij 92, §7.15: eerste kook geeft ook badge Eerste hap → soms "Level 4!", niet altijd 3.
- Rij 92, 99 (NL+EN): de rij heet "Profielen beheren" / "Manage profiles".
- Rij 98 (NL+EN): Meer → Instellingen → kopje Kookstand & timer.
- Rij 93: na rij 92 op dezelfde dag komt de dagplafond-melding al na de vijfde.
- Bevestigd zonder wijziging: Dexie v7; alle "nieuwe" bestanden, settings-keys en i18n-prefixen bestaan
  nog niet; badge-ids eerste-hap/huiskok/proever/op-dreef bestaan; woff2 staat al in `globPatterns`.

Bouwspec door Fable (22 okt 2026) voor Opus 5.5. Bron: docs/phase-6-spec.md blok 6D (hele sectie, incl.
"Samen", "Ontgrendelingen", "Anti-valsspeel (Stijn 13 + 16 okt)" en "Level en avatar op Home") plus de
Besluiten van Stijn (6 okt: XP per persoon, elkaars level zien, kookkalender, level 100 = "Best Chef of
the Universe", T-rex op 2, doneer-badge = hartje zonder XP). De badge-catalogus en de avatar-onderdelen
staan in een APARTE spec (docs/specs/badges-avatar.md); hier staat het raamwerk waar die in passen.
Alles wat een keuze is, staat hier gekozen; bij twijfel §5. Code en namen gecontroleerd op 22 okt 2026.

## 1. Doel en gebruikersgedrag

**In één zin:** koken levert XP op, XP maakt levels met een titel, levels en badges spelen leuke
dingen vrij (confetti, geluiden, lettertypes, avatar-onderdelen), en via één linkje zien huisgenoten
en vrienden elkaars level en kookdagen. Alles valt onder de bestaande schakelaar **Badges**
(`badges.enabled`): staat die uit, dan is er nergens XP, level, pop of ontgrendeling te zien. Confetti
uit = geen schudden, geen confetti (de "+12"-pop is tekst en blijft). **Rustig:** XP verschijnt alleen
op beloningsmomenten (koken, beoordelen, foto, eigen recept, badge), nooit tijdens bladeren; geen enkel
scherm toont XP "live oplopen". Waarom XP varieert legt de app niet uit (handleiding blok Z wel).

Alle teksten staan in een nieuw woordenboek `src/i18n/xp.ts` (prefixen `xp.`, `levelup.`, `unlocks.`,
`progress.`, `calendar.`), gemerged in `src/i18n/index.ts` ná `badges`. Getallen met duizendtallen via
`Intl.NumberFormat(lang === 'nl' ? 'nl-NL' : 'en-GB')` ("1.500" / "1,500").

### 1a. XP-balk op het profiel (Meer → Profielen; blok 6D-1)
Elke profielkaart in `ProfilesScreen` krijgt onder naam + taal een `<XpBar memberId={p.id} />`:
- Regel 1 (vet): `xp.levelTitle` — NL "Level {level} · {title}" · EN "Level {level} · {title}"; rechts
  klein `xp.ofNext` — NL "{xp} / {next} XP" · EN "{xp} / {next} XP" (xp = totaal binnen dit level,
  next = `nextAt`). Op level 100: `xp.maxLevel` — NL "MAX LEVEL · {xp} XP" · EN "MAX LEVEL · {xp} XP".
- Balk (`.xp-bar` met `.xp-bar-fill`, breedte = (total − levelStart)/(nextAt − levelStart); 100 % op
  level 100), kleur `var(--cobalt)`; `role="progressbar"` met aria-valuenow/-max.
- Regel 2 (muted small): streak + rest: `xp.streak` — NL "🔥 {n} dagen op rij" · EN "🔥 {n} days in a
  row" (n ≥ 2; bij n = 1 `xp.streakOne` — NL "🔥 vandaag gekookt" · EN "🔥 cooked today"; 0 → geen
  streak-tekst), gevolgd door `xp.toNext` — NL "nog {n} XP tot level {level}" · EN "{n} XP to level
  {level}". Als de vrije dag gebruikt is (`freeDayUsed`): `xp.streakFree` — NL "🔥 {n} dagen op rij ·
  vrije dag gebruikt" · EN "🔥 {n} days in a row · free day used".
Voorbeeld: "Level 6 · Oma" rechts "922 / 970 XP"; onder: "🔥 12 dagen op rij · nog 48 XP tot level
7". Badges uit → de hele XpBar is weg (geen lege ruimte). Laden: `common.loading`.
⚠ Feitencheck: het voorbeeld stond op "922 / 1.500 XP … nog 578 XP" (het getal uit het plan, van vóór de
curve); volgens de curve van §2b begint level 7 bij 970, dus bij 922 XP is het "922 / 970" en "nog 48".
Zoals §6b.2 ("… / 171 XP") laat zien, zijn beide getallen totalen (xp = totaal, next = `nextAt`).

### 1b. Levelregel op Home (blok 6D-1)
`<LevelLine memberId />` (zelfde bestand als XpBar): één rij onder de begroeting: het bestaande
`<Avatar/>`-rondje (export uit `src/screens/ProfilesScreen.tsx`: `Avatar(props: { profile: Pick<Profile,
'name' | 'color'>; big?: boolean })`; de avatar-spec vervangt dit component later), tekst `xp.levelTitle`, een dunne balk
(`.xp-bar.thin`), en een › ; tik → `/more/profiles`. Badges uit of geen profiel → niets. Home A+ is al
gebouwd: `LevelLine` vervangt de inhoud van `src/components/HomeLevelRow.tsx` (nu "🏆 Badges x/y ›");
dat bestand is van 6D-1 bouwer C, HomeScreen.tsx verandert niet. Geen "+12" op Home; geen XP tijdens
bladeren; geen badge-telling meer op Home (Meer → Badges is de ingang).

### 1c. De "+12"-pop en crits (blok 6D-1)
`<XpPop/>` staat één keer in de shell (app.tsx, naast `<Confetti/>` en `<BadgeToast/>`). Na een
beloningsmoment roept de app-laag `settleXp(memberId)` aan; die vergelijkt de nieuwe stand met de vorige
(`diffXp`) en zet pops in een wachtrij. De pop verschijnt **900 ms** na de aanroep (de confetti is dan
op de terugweg) rechtsboven onder de header (`.xp-pop`, blauw pilletje, 16 px, `aria-live="polite"`):
- één beloning: "+12", 1,4 s zichtbaar, dan weg (CSS-fade);
- meerdere beloningen bij één handeling (kook + badge + weekbonus): pops **350 ms na elkaar** ("+12",
  "+43", "+11"), daarna 600 ms de som eronder in muted: `xp.sum` — NL "samen +{n} XP" · EN "+{n} XP in
  total"; één pop → geen somregel;
- **Cooked!** (×2): de pop in goud (`--gold: #c9a227` licht / `#f2d16b` donker, nieuw token in base.css)
  met `xp.cooked` — NL "+{n} · Cooked!" · EN "+{n} · Cooked!";
- **Overcooked!** (×5): tomaatrood, `xp.overcooked` — NL "+{n} · OVERCOOKED!" · EN "+{n} · OVERCOOKED!"
  én de shell schudt 400 ms (`.shell.shake`, 4 px links-rechts) — niet bij `prefers-reduced-motion` en
  niet als Confetti uit staat (dan alleen de tekst).
Een pop wordt nooit getoond voor een stille herberekening (opstarten, herstel, regelwijziging, 13F).

### 1d. Level-up-overzicht (blok 6D-1; ontgrendelingen erin vanaf 6D-3)
Stijgt het level bij een handeling, dan opent **na de laatste pop** een sheet (`SheetPortal`, `.sheet`,
`.sheet-head.with-actions` met alleen rechts `common.close`): titel `levelup.title` — NL "🎉 Level
{level}!" · EN "🎉 Level {level}!", daaronder groot de titel (`titleFor`), eronder muted de `note` als
die er is, dan (6D-3) de kop `levelup.unlocked` — NL "Ontgrendeld" · EN "Unlocked" met per
ontgrendeling icoon, naam en beschrijving; onderaan `levelup.seeUnlocks` — NL "Bekijk Vrijgespeeld" ·
EN "See Unlocked" (→ `/more/unlocks`, alleen als er iets ontgrendeld werd) en `common.close`. Meerdere
levels in één keer (eerste kook: 1 → 3) = één sheet voor het hoogste level met de ontgrendelingen van
alle tussenliggende levels. Wegvegen/ernaast tikken sluit (er valt niets te bewaren). Ontgrendelingen
die al in `unlocks.announced` staan, worden niet nog eens aangekondigd. Geen sheet bij een stille
herberekening; wat je dan miste staat gewoon op Vrijgespeeld.

### 1e. Eerlijke meldingen over 0 XP (blok 6D-1)
- CookedSheet, bij "Andere datum" meer dan 7 dagen terug (alleen met badges aan), muted onder de
  datum: `xp.backdated` — NL "Langer dan een week geleden: telt voor je badges en de kalender, niet
  voor XP." · EN "More than a week ago: counts for your badges and the calendar, not for XP."
- Toast (zelfde opmaak als de badge-toast, class `xp-toast`, 5 s, niet tikbaar) als de zojuist
  gelogde kookbeurt 0 XP kreeg door `busyWeek`: `xp.busyWeek` — NL "Drukke keukenweek! Morgen weer XP."
  · EN "Busy kitchen week! XP again tomorrow."; door `dayCap`: `xp.dayCap` — NL "Genoeg gekookt voor
  vandaag — morgen weer XP." · EN "That's plenty for today — XP again tomorrow." Bij `sameRecipe` en
  `backdated` geen toast (stil 0; de sheet zei het al).
- Regelversie (§2g): staat `xp.seenRulesVersion` in de database en is hij lager dan
  `XP_RULES_VERSION`, dan één keer bij het opstarten de toast `xp.rulesChanged` — NL "De XP-regels zijn
  vernieuwd; je level is opnieuw berekend." · EN "The XP rules were updated; your level has been
  recalculated." en de setting wordt bijgewerkt. Eerste start: alleen de setting zetten.

### 1f. Vrijgespeeld (`#/more/unlocks`; blok 6D-3)
MenuRow in Meer → groep "Jij & je huishouden" (`more.group.you`), onder de Badges-rij, alleen met badges
aan, label `🎁 ${t('more.unlocks')}` (zoals de Badges-rij `🏆 ${t('more.badges')}`): `more.unlocks` — NL "Vrijgespeeld" · EN "Unlocked", sub `more.unlocksHint` — NL
"Confetti, geluiden en lettertypes die je hebt verdiend" · EN "Confetti, sounds and typefaces you have
earned". Het scherm (`UnlocksScreen`,
Header met terugknop, titel `unlocks.title` — NL "Vrijgespeeld" · EN "Unlocked"):
1. Bovenaan de XpBar van het actieve profiel.
2. Per soort een kaart met kop: `unlocks.kind.confetti` "Confetti" · "Confetti"; `unlocks.kind.timerSound`
   "Timergeluiden" · "Timer sounds"; `unlocks.kind.cookedSound` "Geluid bij Gekookt!" · "Sound on
   Cooked!"; `unlocks.kind.cookFont` "Lettertype kookstand" · "Cook-mode typeface"; `unlocks.kind.feature`
   "Extra's" · "Extras". Per ontgrendeling een rij: icoon · naam · beschrijving ·
   - ontgrendeld: een `.switch` (aan = niet in `unlocks.disabled`) en voor confetti/geluiden een knop
     `unlocks.try` — NL "Probeer" · EN "Try" (speelt het geluid via `previewTimerSound` resp. vuurt
     `celebrate('cooked', { style })`);
   - nog niet: slotje 🔒 en muted `unlocks.atLevel` — NL "Level {level}" · EN "Level {level}" of
     `unlocks.atBadge` — NL "Badge: {name}" · EN "Badge: {name}" (naam uit badges.json).
   De `feature`-rij avatar-maker linkt naar de pagina van de avatar-spec; vóór die bestaat toont hij
   `unlocks.soon` — NL "Binnenkort" · EN "Coming soon".
3. Onderaan muted `unlocks.phoneWide` — NL "Wat iemand op deze telefoon vrijspeelt, kan iedereen hier
   gebruiken. Aan/uit geldt voor deze telefoon." · EN "Whatever anyone unlocks on this phone, everyone here
   can use. On/off applies to this phone."
Badges uit → alleen `badges.disabled` (bestaande key). Uitgezet = niet in de confetti-rotatie, niet in de
geluidenkiezer, lettertype terug naar standaard als het uit gaat.

### 1g. Hoe de ontgrendelingen in de bestaande instellingen komen (blok 6D-3)
- **Confetti**: `celebrate('cooked' | 'milestone' | 'firstRecipe')` kiest een stijl uit {standaard} ∪
  ontgrendelde-en-aangezette confetti-stijlen, deterministisch per burst (`hash32(String(at)) % n`), zodat
  het afwisselt zonder willekeur-gevoel; 'stars' (sterren geven) blijft altijd de kleine standaardburst.
  Stijlen in `Confetti.tsx`: `double` 160 snippers; `veggies` 🥕🥦🍅🌽🧄 als tekst-snippers; `party`
  🐔🧁🎂🍰; `trex` 🦖; `fire` 🔥; `stars` ⭐✨; `gold` snippers in `#f2d16b/#c9a227/#fff3b0`.
- **Timergeluiden**: de `Segmented` onder Meer → Instellingen, kopje "Kookstand & timer" (`more.cookTimer`,
  een `<h3 class="more-sub">` binnen de groep Instellingen, geen eigen groep) toont de vier bestaande + de
  ontgrendelde, aangezette geluiden: `more.timerSound.cowbell` "Koebel" · "Cowbell", `.gong` "Gong" ·
  "Gong", `.kitchen` "Keukenwekker" · "Kitchen timer", `.fanfare` "Fanfare" · "Fanfare". "Luister" werkt
  ervoor. Een gekozen geluid dat later uitgezet wordt, valt terug op 'beeps' (zet `timer.sound`).
- **Geluid bij Gekookt!**: schakelaar in dezelfde groep, alleen zichtbaar als `sound-cooked-tada`
  ontgrendeld is: `more.cookedSound` — NL "Geluid bij Gekookt!" · EN "Sound on Cooked!", sub
  `more.cookedSoundHint` — NL "Een kort tadaa als je een kookbeurt opslaat" · EN "A short ta-da when you
  save a cook". Speelt in `recordCooked`/CookScreen.onCooked ná het opslaan, via de tap-ontgrendelde
  AudioContext van `src/timers.ts` (`unlockAudio()`-patroon) — werkt daardoor ook op de iPhone.
  ⚠ Feitencheck: in `src/timers.ts` heet de functie `unlockAudio()` (er is geen `ensureAudio`), en de
  context zelf (`let audio`) is module-privé, zonder export of getter. `playCookedSound(ctx)` heeft dus een
  kleine getter in timers.ts nodig, of het `previewCtx`-patroon van `previewTimerSound` in src/sounds.ts.
- **Lettertype kookstand**: `Segmented` `more.cookFont` — NL "Lettertype kookstand" · EN "Cook-mode
  typeface" met `more.cookFont.default` "Standaard" · "Default", `.chalk` "Krijtbord" · "Chalkboard",
  `.hand` "Handschrift" · "Handwriting"; alleen zichtbaar als ≥ 1 lettertype ontgrendeld is; alleen
  ontgrendelde opties. CookScreen zet `data-font` op `.cook-card`; `chalk` geeft de kaart bovendien een
  schoolbordgroene achtergrond (`#2f4f3a`) met gebroken-witte letters (beide thema's).
- Alles wat ontgrendeld is maar waarvan badges later uitgaan, blijft gewoon werken als het al gekozen
  was (de timer mag niet ineens anders klinken); er komt alleen niets nieuws bij.

### 1h. Sync mijn voortgang (blok 6D-4)
Op de actieve profielkaart (ProfilesScreen) naast "Deel mijn kaartje" een knop `progress.share` — NL
"Sync mijn voortgang" · EN "Sync my progress"; dezelfde knop in Huishouden → "Mijn kaartje". Hij klapt een
`<ProgressSharePanel/>` uit (zelfde opbouw als `MemberCardPanel`): intro `progress.intro` — NL "Stuur je
level, badges en kookdagen van de laatste 90 dagen naar je huishouden of een vriend. Geen notities, geen
sterren, geen foto's." · EN "Send your level, badges and the cooking days of the last 90 days to your
household or a friend. No notes, no stars, no photos."; knoppen `progress.send` — NL "Deel" · EN
"Share" (`shareText` met één veld) en `progress.copy` — NL "Kopieer link" · EN "Copy link"; statussen
`progress.shared` — NL "Voortgang gedeeld." · EN "Progress shared.", `progress.copied` — NL "Gekopieerd
— plak het in WhatsApp." · EN "Copied — paste it into WhatsApp."; iPhone-regel hergebruikt
`household.cardIosHint`. Eerlijk eronder: `progress.honest` — NL "Dit is een momentopname: de ander ziet
wat je nú deelt, niet wat je daarna kookt. Deel het af en toe opnieuw." · EN "This is a snapshot: the
other person sees what you share now, not what you cook afterwards. Share it again now and then." Een
gedeelde voortgang logt een 'out'-rij (`inbox.ev.progress` — NL "Mijn voortgang" · EN "My progress").

### 1i. Ontvangst: In & uit en Huishouden (blok 6D-4)
Een `#x=`-link (geopend in de app of geplakt) komt in In & uit als kaart (`.inbox-member`-stijl):
avatar met kleur, `progress.from` — NL "Voortgang van {name}" · EN "{name}'s progress", regel 2
`xp.levelTitle` + `progress.streakBadges` — NL "🔥 {streak} · {badges} badges" · EN "🔥 {streak} ·
{badges} badges", regel 3 `progress.cookDays30` — NL "{n} kookdagen in de laatste 30 dagen" · EN "{n}
cooking days in the last 30 days", en `progress.sentAt` — NL "gedeeld op {date}" · EN "shared on {date}"
(`formatShortDate`). Knoppen:
- afzender is al lid (id of naam, `matchMemberForCard`): `progress.update` — NL "Werk {name} bij" · EN
  "Update {name}" → snapshot opslaan (+ kaartvelden via `upsertMemberFromCard`); daarna `progress.updated`
  — NL "{name} is bijgewerkt." · EN "{name} was updated.";
- afzender is een profiel op deze telefoon: `progress.local` — NL "{name} is een profiel op deze
  telefoon — die voortgang zie je al." · EN "{name} is a profile on this phone — you already see that
  progress." (niets opslaan);
- onbekend: twee knoppen `household.addCard` (bestaand: lid worden + snapshot) en `progress.saveFriend` —
  NL "Bewaar als vriend" · EN "Save as a friend" (snapshot met `friend: true`, geen lid).
Opslaan logt een 'in'-rij (kind 'progress', who = naam). In het Huishouden-scherm toont elke ledenrij onder
de naam `xp.levelTitle` (lokaal: live; via snapshot: plus `progress.updatedAgo` — NL "· bijgewerkt
{date}" · EN "· updated {date}"); zonder gegevens niets. Onder de leden een kaart `progress.friends` —
NL "Vrienden" · EN "Friends" met de vriend-snapshots (avatar, naam, level, bijgewerkt, knop
`household.remove`); leeg → de kaart ontbreekt. De paste-box op Huishouden ("Voeg lid toe via link of
plak") herkent `#x=` ook en toont dezelfde kaart. iPhone: een link opent Safari met de landingspagina
(§1k); ontvangen blijft kopiëren → app → plakken (invariant 5).

### 1j. Kookkalender (`#/more/calendar`; blok 6D-4)
MenuRow in Meer → groep "Jij & je huishouden" (`more.group.you`; altijd, ook met badges uit — het is een
logboek), label `📅 ${t('more.calendar')}`:
`more.calendar` — NL "Kookkalender" · EN "Cooking calendar", sub `more.calendarHint` — NL "Wie kookte wat, per dag" · EN
"Who cooked what, by day". Scherm `CalendarScreen`: Header (terug), maandnaam met ‹ › knoppen
(`calendar.prev`/`calendar.next` als aria-labels — NL "Vorige maand"/"Volgende maand" · EN "Previous
month"/"Next month"), rooster ma–zo (`calendar.weekdays` — NL "ma di wo do vr za zo" · EN "Mo Tu We Th
Fr Sa Su"), per dag het nummer en max 3 stipjes in ledenkleur (lokaal uit de kooklog; op afstand uit
snapshots; dezelfde persoon lokaal én snapshot → lokaal wint), vandaag omrand, toekomst muted. Tik op een
dag → lijst eronder: "{name} — {recipe}" (naam uit `allRecipes()`; onbekend id → `calendar.someRecipe` —
NL "een recept" · EN "a recipe"); dag zonder kookbeurt → `calendar.nothing` — NL "Niets gekookt." · EN
"Nothing cooked.". Legenda onder het rooster: alle leden en vrienden met stip, naam en (badges aan)
`xp.levelTitle`; snapshot-rijen met `progress.updatedAgo`. Lege maand → `calendar.emptyMonth` — NL "Nog
niets gekookt deze maand." · EN "Nothing cooked this month yet.". Eerlijk, muted onderaan:
`calendar.honest` — NL "Anderen zie je zoals ze het laatst deelden via Sync mijn voortgang." · EN "You
see others as they last shared with Sync my progress."

### 1k. Landingspagina (iPhone Safari, blok 6D-4)
`landing.ts` kent `#x=`: `previewProgress` — NL "Voorproefje van gedeelde voortgang" · EN "Preview of
shared progress"; kop `progressOf(name)` — NL "Voortgang van {name}" · EN "{name}'s progress"; regel
"Level {level} · {title}" (titels uit data/levels.json via `import()` zoals de dictionary — de bundel
schrijft nooit storage); `progressHint` — NL "In de app zie je {name} in de kookkalender en bij
Huishouden." · EN "In the app you see {name} in the cooking calendar and under Household."; dezelfde
kopieer-knop en overdrachtskaart als het kaartje (`copyCard`/`stepsCard`).

### 1l. Wat NIET verandert
De badgepagina en de badge-toast (de badges-spec), de week- en boodschappenschermen, de kookstand (op het
lettertype en het Gekookt!-geluid na). Geen XP voor bladeren, zoeken, delen, plannen of boodschappen.

## 2. Datamodel en migraties

### 2a. Kern: XP wordt AFGELEID, nooit opgeteld
Er bestaat geen teller "922 XP" in de database. `deriveXp(facts, rules)` (nieuw, `src/domain/xp.ts`,
framework-vrij) rekent de hele XP-stand opnieuw uit uit wat er toch al staat: kooklog, foto's, eigen
recepten en verdiende badges. Het resultaat wordt in het geheugen gememoiseerd per lid (`src/xp.ts`) en
opnieuw berekend bij elk beloningsmoment en bij het openen van een scherm dat XP toont. Gevolg: na
back-up/herstel, op een nieuwe telefoon en na de id-migratie van 13F is het level precies wat de feiten
zeggen; "nog eens laden" geeft nooit een nieuwe worp. De afleiding werkt op de recipeIds zoals ze in de
log staan (na 13F dus op de omgezette ids; een id dat de app niet kent, krijgt moeilijkheidsbonus 0).

### 2b. De regels (`XP_RULES`, regelversie 1) — alle getallen hier, nergens anders
```ts
export const XP_RULES_VERSION = 1 as const;
export interface XpRules {
  version: number;
  cookFirst: number;        // 100: 1e keer dít recept
  cookStep: number;         // 10: 2e keer 90, 3e 80 …
  cookFloor: number;        // 50: nooit lager
  difficultyPer: number;    // 5 per ingrediëntregel boven difficultyFromLines
  difficultyFromLines: number; // 7
  difficultyMax: number;    // 30
  starsBonus: number;       // 5 (sterren, ook achteraf)
  photoFirst: number;       // 30: eerste foto van dit gerecht
  photoNext: number;        // 20: elke volgende (max 1 beloonde foto per recept per dag)
  ownRecipe: number;        // 10: eigen recept; 15 als tweetalig
  ownRecipeBilingual: number;
  badgePerLevel: number;    // 50 × niveau (niveau 1 = 50 … 8 = 400)
  badgeSecret: number;      // 250, vast
  fullWeek: number;         // 50: 7 van 7 dagen gekookt in een ISO-week
  capFull: number;          // 3: kookbeurt 1–3 van een dag vol
  capHalf: number;          // 5: kookbeurt 4–5 de helft; 6+ niets
  busyDayFrom: number;      // 4: een dag met ≥ 4 XP-gevende kookbeurten is "druk"
  busyRunDays: number;      // 3: vanaf de 4e drukke dag op rij geen kook-XP
  backdateDays: number;     // 7: meer dan 7 dagen terug gelogd = geen XP
  streak: ReadonlyArray<readonly [minDays: number, mult: number]>; // [[365,2],[100,1.75],[30,1.5],[14,1.3],[7,1.2],[3,1.1]]
  variation: number;        // 0.2 → ±20 %
  critCooked: number;       // 0.05
  critOvercooked: number;   // 0.01
  curveK: number;           // 11
  curveP: number;           // 2.5
  maxLevel: number;         // 100
}
```
**Moeilijkheidsbonus: ingrediëntregels, niet stappen.** Het plan stelde "+5 per stap boven de 4" voor.
Gemeten op de 196 klassiekers: 165 hebben ≤ 4 stappen (lange alinea's), de bonus zou vrijwel nooit
vallen en geplakte websiterecepten (8–12 korte stappen) zouden structureel meer opleveren. Daarom: **+5
per ingrediëntregel (geen koppen) boven de 7, max +30**. Verdeling over de klassiekers: 56× 0, 20× 5,
23× 10, 27× 15, 21× 20, 15× 25, 34× 30 (gemiddeld 13). Actieve kooktijd telt niet mee (staat op
alle 196 op 20–30 min: geen onderscheid).
⚠ Feitencheck: `time.active` staat niet op alle 196 op 20–30 min: 147 van de 196 liggen in 20–30, de rest
ligt tussen 5 en 45 min (5: 1×, 10: 5×, 15: 22×, 35: 10×, 40: 7×, 45: 4×). De keuze (niet meetellen)
blijft staan; alleen de reden klopt zo niet. (De verdeling 56/20/23/27/21/15/34 en "165 met ≤ 4
stappen" zijn nagerekend en kloppen.)

**Per kookbeurt (één event, één worp):**
```
base   = max(50, 100 − 10·(k−1)) + min(30, 5·max(0, regels−7)) + (sterren ? 5 : 0)
         k = hoeveelste kookbeurt van dit recept door dit lid (alle kookbeurten, op `at`-volgorde)
factor = plafond (1 · 0,5 · 0) × streakvermenigvuldiger van de kookdag
xp     = round(base × factor × variatie) × crit        variatie ∈ [0,8; 1,2], crit ∈ {1, 2, 5}
```
Sterren achteraf veranderen `base` van dát event (+5); de worp blijft dezelfde (seed = identiteit van
de kookbeurt), dus de gebruiker ziet een kleine "+5"-pop (±streak), nooit een nieuwe dobbelsteen.

**Anti-valsspeel (keuze uit de lijst in het plan, met motivatie):**
1. **Dagplafond met afnemende opbrengst** (Stijn: "niet meer dan 5 per dag"): per lokale kalenderdag
   krijgen kookbeurten 1–3 (op `at`, dan `id`) factor 1, nummer 4–5 factor 0,5, vanaf 6 factor 0.
   1b. **Hetzelfde plafond per invoerdag** (kritische lezer): rangschik de XP-gevende kookbeurten óók per
   lokale kalenderdag van `loggedAt` (ontbreekt `loggedAt`, dan geldt `at`); de plafondfactor van een
   kookbeurt is `min(factor op de kookdag, factor op de invoerdag)`. Zo levert zeven dagen terugdateren
   met elk drie kookbeurten in één avond hooguit 3 volle + 2 halve op. Een `sameRecipe`-beurt bezet op
   geen van beide dagen een plek.
2. **Per recept één keer per dag**: hetzelfde recipeId nog eens op dezelfde dag → 0 XP en het bezet
   géén plafondplek. Telt wél als kookbeurt (k loopt op) en voor de kookdag.
3. **Terugdateren begrensd**: `CookLogEntry.loggedAt` (nieuw, optioneel) is het moment van invoeren;
   is `loggedAt` meer dan 7 kalenderdagen na `at`, dan 0 XP (reden `backdated`), wel streak/badges/
   kalender. Een kookbeurt zonder `loggedAt` (ouder dan 6D) telt gewoon. Een teruggedateerde kookbeurt
   binnen 7 dagen valt onder het plafond van de dag waarop hij gekookt is (`at`).
4. **Verdacht patroon → rustregel**: een dag is "druk" als hij ≥ 4 kookbeurten heeft die een plafondplek
   innemen (verschillende recepten, niet teruggedateerd; de 6e+ telt dus ook als plek). Vanaf
   de **4e drukke dag op rij** leveren de kookbeurten van die dag 0 op (reden `busyWeek`) tot er een
   kalenderdag met ≤ 3 kookbeurten (of zonder) is geweest; die kalme dag telt zelf gewoon. Kerst (drie
   dagen vijf gerechten) kost dus niets. Vriendelijke melding (§1), nooit beschuldigend, nooit XP
   afpakken: de regel raakt alleen dagen ná het patroon.
5. **Streak en badges tellen dagen en verschillende recepten**, niet het ruwe aantal kookbeurten
   (streak: kookdagen; weekbonus: 7 van 7 dagen; de badges-spec kiest `cookDays`/`distinctRecipes` voor
   nieuwe getrapte badges). Spammen op één dag levert zo niets extra's op.
Niet gekozen: een weekplafond (dubbelop met 1 + 4) en XP afpakken (nooit).

**Streak (kookdagen op rij, één vrije dag per week).** Een kookdag = lokale kalenderdag met ≥ 1
kookbeurt van dit lid (ook een 0-XP-beurt). Loop de kookdagen op volgorde af met `streak`, `lastSkip`:
gat van 1 dag → `streak++`; gat van 2 dagen (één dag overgeslagen) én (`lastSkip` leeg of de
overgeslagen dag ligt ≥ 7 dagen na `lastSkip`) → `streak++`, `lastSkip = overgeslagen dag`; anders
`streak = 1`, `lastSkip` leeg. De streak telt kookdagen (de vrije dag telt niet mee). Vermenigvuldiger
van een kookdag = `streakMultiplier(streak op die dag)`: 1–2 → ×1 · 3–6 → ×1,1 · 7–13 → ×1,2 ·
14–29 → ×1,3 · 30–99 → ×1,5 · 100–364 → ×1,75 · ≥ 365 → ×2. Alleen kookbeurten krijgen de
vermenigvuldiger (foto's, recepten, badges, weekbonus niet). `currentStreak(cookDays, today)` voor de
UI: laatste kookdag = vandaag of gisteren → de streak; eergisteren én de vrije dag nog beschikbaar →
de streak (met `freeDayUsed: true`); anders 0.
**Weekbonus**: elke ISO-week (ma–zo, lokale dagen) met alle 7 dagen een kookbeurt → één event
`week:<dagindex van de maandag>` met base 50 (variatie + crit, geen streakfactor).

**Seeded random (geen dependency).** Elke beloning krijgt een seed-string; twee uniforme getallen
komen uit `hash32(seed + '|v')` (variatie) en `hash32(seed + '|c')` (crit). Deze code letterlijk
overnemen (gepind door tests, §6):
```ts
/** FNV-1a 32 bit over UTF-16 code units, met murmur3-fmix32 als afsluiter (buurseeds delen geen bits). */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return h >>> 0;
}
export function unitFromSeed(seed: string): number { return hash32(seed) / 4294967296; } // [0, 1)
export type Crit = 'cooked' | 'overcooked';
export function rollReward(base: number, seed: string, r: XpRules = XP_RULES): { xp: number; crit: Crit | null } {
  const variation = 1 - r.variation + 2 * r.variation * unitFromSeed(seed + '|v'); // 0,8 … 1,2
  const c = unitFromSeed(seed + '|c');
  const crit: Crit | null = c < r.critOvercooked ? 'overcooked' : c < r.critOvercooked + r.critCooked ? 'cooked' : null;
  return { xp: Math.round(base * variation) * (crit === 'overcooked' ? 5 : crit === 'cooked' ? 2 : 1), crit };
}
```
Seeds: kookbeurt `cook:<recipeId>|<at>` (dezelfde identiteit als de herstel-dedupe recipeId+profileId+
at, dus gelijk op elke telefoon); foto `photo:<recipeId>|<at>`; eigen recept `recipe:<id>`; badge
`badge:<badgeId>|<niveau>`; weekbonus `week:<maandag-dagindex>`. Gepinde waarden: `hash32('')` =
2872998923 · `hash32('a')` = 444641715 · `hash32('cook:b:uiensoep|2026-10-22T17:30:00.000Z')` =
2188135396 (unit 0,509465) · `…|v` = 2945243029 · `…|c` = 711956350 · `hash32('week:20748')` =
3827384507 · `hash32('badge:eerste-hap|1')` = 1574489043. Over de 10.000 seeds
`cook:b:test|2026-01-01T12:00:00.000Z#<i>` (i = 0…9999): **94 Overcooked en 505 Cooked**; base 100
zonder crit valt altijd in 80…120 (gemiddeld 100,02). Bekende crits voor tests: seed
`cook:b:test|2026-03-03T18:00:00.000Z#2` → cooked; `cook:b:test|2026-03-04T18:00:00.000Z#115` →
overcooked; `photo:b:p|2026-04-01T12:00:00.000Z` → overcooked (base 30 → 175).

**Levelcurve.** `xpForLevel(L) = round(11 · (L−1)^2,5)`, `levelForXp(total)` = hoogste L ≤ 100 met
`xpForLevel(L) ≤ total`. Alle 100 waarden (totaal XP om dat level te hebben):

| L | XP | L | XP | L | XP | L | XP |
|---|---|---|---|---|---|---|---|
| 1 | 0 | 26 | 34375 | 51 | 194454 | 76 | 535853 |
| 2 | 11 | 27 | 37916 | 52 | 204323 | 77 | 553894 |
| 3 | 62 | 28 | 41668 | 53 | 214487 | 78 | 572294 |
| 4 | 171 | 29 | 45634 | 54 | 224948 | 79 | 591057 |
| 5 | 352 | 30 | 49818 | 55 | 235709 | 80 | 610183 |
| 6 | 615 | 31 | 54225 | 56 | 246774 | 81 | 629677 |
| 7 | 970 | 32 | 58857 | 57 | 258144 | 82 | 649539 |
| 8 | 1426 | 33 | 63719 | 58 | 269824 | 83 | 669773 |
| 9 | 1991 | 34 | 68814 | 59 | 281814 | 84 | 690380 |
| 10 | 2673 | 35 | 74146 | 60 | 294119 | 85 | 711362 |
| 11 | 3479 | 36 | 79719 | 61 | 306740 | 86 | 732723 |
| 12 | 4414 | 37 | 85536 | 62 | 319681 | 87 | 754465 |
| 13 | 5487 | 38 | 91600 | 63 | 332945 | 88 | 776588 |
| 14 | 6703 | 39 | 97916 | 64 | 346533 | 89 | 799097 |
| 15 | 8067 | 40 | 104485 | 65 | 360448 | 90 | 821992 |
| 16 | 9586 | 41 | 111312 | 66 | 374693 | 91 | 845277 |
| 17 | 11264 | 42 | 118400 | 67 | 389271 | 92 | 868953 |
| 18 | 13107 | 43 | 125752 | 68 | 404185 | 93 | 893022 |
| 19 | 15121 | 44 | 133372 | 69 | 419435 | 94 | 917487 |
| 20 | 17309 | 45 | 141262 | 70 | 435026 | 95 | 942350 |
| 21 | 19677 | 46 | 149425 | 71 | 450960 | 96 | 967613 |
| 22 | 22230 | 47 | 157866 | 72 | 467238 | 97 | 993278 |
| 23 | 24972 | 48 | 166586 | 73 | 483865 | 98 | 1019347 |
| 24 | 27907 | 49 | 175588 | 74 | 500841 | 99 | 1045822 |
| 25 | 31040 | 50 | 184877 | 75 | 518170 | 100 | 1072706 |

**Claims nagerekend met deze regels** (simulatie in de tests, §6; pool van 40 recepten dat groeit met
10 per jaar, de helft van de kookbeurten met sterren, elke 5e met foto, moeilijkheidsbonus volgens de
echte verdeling):
- "Level 3 na de eerste kook": klopt altijd (minimum 100 × 0,8 = 80 ≥ 62).
- "Level 20 na ±half jaar dagelijks": sneller — level 20 na ±4 maanden, na een half jaar level 22–25
  (de streakvermenigvuldiger doet dat; het plan rekende zonder).
- Twee keer per week (di + vr, geen streak): na 1 jaar level 17, na 3 jaar level 24 (plan: 14 en 22).
- Level 50: na 4,5 jaar dagelijks met vakanties, 6 jaar als je af en toe een dag overslaat (plan: ±5 jaar).
- "100 na ±30 jaar": dagelijks koken met drie vakanties van tien dagen per jaar → level 100 na ±26
  jaar; wie daarnaast één op de tien dagen overslaat eindigt na 30 jaar op level 95; vijf dagen per week
  → level 91. Een robot die 30 jaar geen dag mist, haalt 100 na 19 jaar. Conclusie: de claim staat, en
  level 100 blijft wat het moet zijn: bijna onhaalbaar.
⚠ Feitencheck (onafhankelijk nagerekend met precies de regels en de `simulate()`-generator van §6a):
"één op de tien overslaan → level 94" stond hier, maar de eigen pin in §6a (`skipEvery: 10` → 967.012
XP) is level 95 (942.350 ≤ 967.012 < 967.613); daarom 95. Level 20 na ±111 dagen, half jaar → 24, 1 jaar
→ 29, level 50 na ±4,4 jaar (overslaan: ±5,6 jaar), level 100 na ±25,5 jaar: kloppen. Wat NIET
uitkomt (niet gepind, keuzes blijven staan): de robot (`holidaysPerYear: 0`) haalt 100 na ±17,6 jaar,
niet 19; twee keer per week (di + vr) staat na 3 jaar op level 25 (31.532 XP, net boven 31.040), niet
24; vijf dagen per week (ma–vr of twee losse vrije dagen, met vakanties) eindigt na 30 jaar op level
80–84, niet 91 — twee vrije dagen per week breken de streak elke week, dus de hoge trappen vallen weg.

### 2c. Types van de afleiding (`src/domain/xp.ts`)
```ts
export interface XpCookFact { id?: number; recipeId: string; at: string; stars?: number | null; loggedAt?: string }
export interface XpRecipeFact { lines: number }                 // ingrediëntregels zonder kind 'header'
export interface XpPhotoFact { recipeId: string; at: string }
export interface XpOwnRecipeFact { id: string; bilingual: boolean }
export interface XpBadgeFact { id: string; level: number; secret: boolean } // level ≥ 1; eenmalig = tier ?? 1
export interface XpFacts {
  log: XpCookFact[];                                 // alleen dit lid
  recipes: ReadonlyMap<string, XpRecipeFact>;        // alle recepten (klassiekers + eigen + ontvangen)
  photos: XpPhotoFact[];                             // alleen dit lid (Photo.memberId)
  ownRecipes: XpOwnRecipeFact[];                     // origin.kind 'user', author = dit lid (gevouwen naam), geen variantOf
  badges: XpBadgeFact[];                             // verdiend op het EIGEN tabblad (Samen telt niet)
}
export type XpEventKind = 'cook' | 'week' | 'photo' | 'recipe' | 'badge';
export type XpZeroReason = 'dayCap' | 'sameRecipe' | 'backdated' | 'busyWeek' | 'samePhotoDay';
export interface XpEvent {
  kind: XpEventKind; key: string;                    // key = seed (uniek per event)
  at?: string; day?: number; recipeId?: string;      // cook/photo: at + lokale dagindex
  base: number; factor: number;                      // factor = plafond × streak (1 voor niet-cook)
  xp: number; crit: Crit | null; reason: XpZeroReason | null;
}
export interface XpStreak { current: number; best: number; lastDay: number | null; freeDayUsed: boolean }
export interface XpState {
  rulesVersion: number; total: number; level: number;
  levelStart: number; nextAt: number | null;         // nextAt null op level 100
  streak: XpStreak; cookDays: number[];              // oplopende lokale dagindexen
  events: XpEvent[]; byKey: ReadonlyMap<string, XpEvent>;
}
export function deriveXp(facts: XpFacts, rules?: XpRules, today?: number): XpState; // today = localDayIndex(new Date())
export function xpForLevel(level: number, rules?: XpRules): number;
export function levelForXp(total: number, rules?: XpRules): number;
export function streakMultiplier(days: number, rules?: XpRules): number;
export function currentStreak(cookDays: readonly number[], today: number, rules?: XpRules): XpStreak;
/** Langste streak over alle kookdagen (zelfde vrije-dag-regel); voor de badge `streakDays` (badges-avatar.md). */
export function longestDayStreak(cookDays: readonly number[], rules?: XpRules): number;
export interface XpDelta { amount: number; pops: Array<{ xp: number; crit: Crit | null; kind: XpEventKind }>;
  levelFrom: number; levelTo: number; zeroReasons: XpZeroReason[] }
/** Verschil tussen twee standen: nieuwe keys → pops; gewijzigde xp op een bestaande key → pop van het verschil (> 0). */
export function diffXp(prev: XpState | null, next: XpState): XpDelta;
```
Datumhelpers in een nieuw `src/domain/days.ts` (badges.ts houdt zijn eigen kopieën; later samenvoegen):
`localDayIndex(d: Date): number` (lokale kalenderdag als dagen sinds 1970-01-01, zoals badges.ts),
`dayIndexOfIso(iso: string): number | null`, `isoWeekMondayOf(day: number): number`,
`dayKey(day: number): string` ('yyyy-mm-dd' lokaal), `dayFromKey(key: string): number | null`.

**Uitgewerkt voorbeeld** (fixture in tests/xp.test.ts "worked example"): recepten uiensoep (10 regels),
afwasmachinezalm (5 regels); log: (1) uiensoep 2026-10-20T17:30Z ★4, (2) zalm 2026-10-21T18:00Z,
(3) uiensoep 2026-10-22T18:10Z ★5; foto uiensoep 2026-10-22T19:00Z; eigen recept u:abc12345 tweetalig;
badge eerste-hap niveau 1. Events: cook 1 base 120 (100+15+5) → 131 · cook 2 base 100 → 103 · cook 3
base 110 (90+15+5) × streak 1,1 → 138 · foto 30 → **54 (Cooked!)** · recept 15 → 13 · badge 50 → 52.
Totaal **491, level 5** (352 ≤ 491 < 615, nextAt 615). Geef kookbeurt 2 achteraf 3 sterren: event 2
wordt 108, totaal 496, `diffXp` geeft één pop van +5.
⚠ Feitencheck: de getallen zijn nagerekend en kloppen. Let op: het zijn fixture-waarden; de test bouwt
zijn eigen `recipes`-Map. In data/recipes.json bestaat `b:uiensoep` niet, en de echte
`b:afwasmachinezalm` heeft 10 ingrediëntregels (en 7 stappen), niet 5. Zoek ze dus niet in de echte data.

### 2d. Titels: `data/levels.json` (nieuw) + `src/domain/levels.ts`
Bestand: array van precies 100 objecten `{ level, nl: { title, note? }, en: { title, note? } }`, level
1…100 aaneengesloten, titels per taal uniek en niet leeg; `note` is de grap/toelichting die het
level-up-overzicht toont. Domein: `normalizeLevels(data: unknown): LevelTitle[]` (ongeldig → de
ontbrekende levels krijgen `{ title: 'Level N' }`), `titleFor(level: number, lang: Lang, levels?): string`,
`noteFor(level, lang, levels?): string | null`. Validator `validateLevels` in tools/validate-data.ts
(zelfde patroon als validateBadges; geregistreerd in `main()` na badges). Alle 100 titels:

| L | NL | EN |
|---|---|---|
| 1 | Keukenpiep | Kitchen Chick |
| 2 | T-rex | T-rex |
| 3 | Aardappelschiller | Potato Peeler |
| 4 | Afwasser | Dishwasher |
| 5 | Boterhamsmeerder | Sandwich Spreader |
| 6 | Oma | Grandma |
| 7 | Uiensnipperaar | Onion Chopper |
| 8 | Eierbakker | Egg Flipper |
| 9 | Pastakoker | Pasta Boiler |
| 10 | Hulpkok | Kitchen Hand |
| 11 | Pannenlikker | Pan Licker |
| 12 | Soepkoker | Soup Stirrer |
| 13 | Roerbakker | Stir-fryer |
| 14 | Sauzenroerder | Sauce Whisker |
| 15 | Commis | Commis |
| 16 | Kruidenkenner | Spice Scout |
| 17 | Ovenheld | Oven Hero |
| 18 | Deegkneder | Dough Kneader |
| 19 | Bakkersmaatje | Baker's Mate |
| 20 | Sous-chef | Sous-chef |
| 21 | Grillmeester | Grill Master |
| 22 | Stoofpotstrateeg | Stew Strategist |
| 23 | Wokvirtuoos | Wok Virtuoso |
| 24 | Marinadewonder | Marinade Wizard |
| 25 | Chef de partie | Chef de partie |
| 26 | Smaakmaker | Flavour Maker |
| 27 | Fornuisfluisteraar | Hob Whisperer |
| 28 | Vlijmscherp | Razor Sharp |
| 29 | Mise-en-place-meester | Mise en Place Master |
| 30 | Chef | Chef |
| 31 | Timingtalent | Timing Talent |
| 32 | Kok zonder recept | Freestyle Cook |
| 33 | Restjesredder | Leftover Rescuer |
| 34 | Bouillonbaas | Stock Boss |
| 35 | Saucier | Saucier |
| 36 | Rôtisseur | Rôtisseur |
| 37 | Pâtissier | Pâtissier |
| 38 | Keukengeneraal | Kitchen General |
| 39 | Tafelheld | Table Hero |
| 40 | Chefkok | Head Chef |
| 41 | Brigadeleider | Brigade Leader |
| 42 | Menu-architect | Menu Architect |
| 43 | Seizoenskenner | Season Sage |
| 44 | Fermentatiefanaat | Fermentation Fan |
| 45 | Umami-jager | Umami Hunter |
| 46 | Kookboekschrijver | Cookbook Author |
| 47 | Smaakcomponist | Flavour Composer |
| 48 | Keukenkampioen | Kitchen Champion |
| 49 | Culinair kunstenaar | Culinary Artist |
| 50 | Masterchef | Masterchef |
| 51 | Streetfoodlegende | Street Food Legend |
| 52 | Bistrobaas | Bistro Boss |
| 53 | Brasseriebrein | Brasserie Brain |
| 54 | Trattoriatalent | Trattoria Talent |
| 55 | Tapasmeester | Tapas Master |
| 56 | Curryconnaisseur | Curry Connoisseur |
| 57 | Dimsum-dynamo | Dim Sum Dynamo |
| 58 | Barbecuebaron | Barbecue Baron |
| 59 | Tv-kok | TV Cook |
| 60 | Jamie Oliver | Jamie Oliver |
| 61 | Pukka! | Pukka! |
| 62 | Keukenster | Kitchen Star |
| 63 | Bestsellerkok | Bestseller Cook |
| 64 | Smaakicoon | Flavour Icon |
| 65 | Keukengoeroe | Kitchen Guru |
| 66 | Eetfilosoof | Food Philosopher |
| 67 | Receptenfluisteraar | Recipe Whisperer |
| 68 | Culinair columnist | Food Columnist |
| 69 | Dinerheld | Dinner Hero |
| 70 | Nigella | Nigella |
| 71 | Genotskok | Pleasure Cook |
| 72 | Koelkastplunderaar | Fridge Raider |
| 73 | Boterkampioen | Butter Champion |
| 74 | Dessertdirigent | Dessert Conductor |
| 75 | Chocoladechef | Chocolate Chef |
| 76 | Comfortfoodkenner | Comfort Food Connoisseur |
| 77 | Feestmaalmeester | Feast Master |
| 78 | Keukenpoëet | Kitchen Poet |
| 79 | Culinair geweten | Culinary Conscience |
| 80 | Gordon Ramsay | Gordon Ramsay |
| 81 | Hell's Kitchen-overlever | Hell's Kitchen Survivor |
| 82 | Perfectionist | Perfectionist |
| 83 | Keukeninspecteur | Kitchen Inspector |
| 84 | Sterrenjager | Star Hunter |
| 85 | Grand chef | Grand Chef |
| 86 | Chef-eigenaar | Chef-Patron |
| 87 | Keukenlegende | Kitchen Legend |
| 88 | Smaakmeester | Master of Flavour |
| 89 | Bijna een ster | Almost a Star |
| 90 | Michelinster | Michelin Star |
| 91 | Twee sterren | Two Stars |
| 92 | Drie sterren | Three Stars |
| 93 | Gastronomisch genie | Gastronomic Genius |
| 94 | Keukenorakel | Kitchen Oracle |
| 95 | Keukenheilige | Kitchen Saint |
| 96 | Wereldkok | World Cook |
| 97 | Grootmeester | Grandmaster |
| 98 | Smaakuniversum | Flavour Universe |
| 99 | Sterrenstof | Stardust |
| 100 | Best Chef of the Universe | Best Chef of the Universe |

Notes (`note`, alleen deze levels): 2 — NL "Te korte armpjes: kan nog niet bij het fornuis." · EN "Arms
too short to reach the hob."; 6 — NL "Iedereen kent er één die beter kookt dan jij." · EN "Everyone
knows one who cooks better than you."; 61 — NL "Zoals Jamie zou zeggen." · EN "As Jamie would say.";
72 — NL "Om middernacht, in het donker, met een lepel." · EN "At midnight, in the dark, with a spoon.";
81 — NL "En nooit meer 'IT'S RAW!' hoeven horen." · EN "And never hearing 'IT'S RAW!' again.";
100 — NL "Maximaal level. Er is niets boven dit." · EN "Maximum level. There is nothing above this."
(De namen van echte chefs: besluit Stijn, privégebruik; vervangen als de app ooit breder gaat.)

### 2e. Ontgrendelingen: `data/unlocks.json` (nieuw) + `src/domain/unlocks.ts`
```ts
export type UnlockKind = 'confetti' | 'timerSound' | 'cookedSound' | 'cookFont' | 'feature';
export type UnlockBy = { level: number } | { badge: string; level?: number }; // badge-niveau optioneel (getrapte badge)
export interface Unlock { id: string; kind: UnlockKind; by: UnlockBy; icon: string; value: string;
  nl: { name: string; description: string }; en: { name: string; description: string } }
export function normalizeUnlocks(data: unknown): Unlock[];        // ongeldige items vallen weg, zoals normalizeBadges
export function unlockedIds(unlocks: readonly Unlock[], who: { level: number; badges: readonly XpBadgeFact[] }): Set<string>;
export function unlocksForLevels(unlocks: readonly Unlock[], fromExclusive: number, toInclusive: number): Unlock[];
export function unlocksForBadge(unlocks: readonly Unlock[], badge: XpBadgeFact): Unlock[];
```
`value` is de id die de motor gebruikt (confetti-stijl, `TimerSound`, lettertype). Validator
`validateUnlocks(data, badgeIds)`: unieke kebab-case ids, kind uit de lijst, `by.level` geheel 2…100
óf `by.badge` een id uit data/badges.json, beide talen gevuld, `value` niet leeg. De lijst (vast):

| id | kind | by | value | NL · EN |
|---|---|---|---|---|
| confetti-double | confetti | level 3 | double | Dubbele confetti · Double confetti |
| avatar-maker | feature | level 3 | avatar | Avatar-maker · Avatar maker (bouwt de avatar-spec; level 3 = `AVATAR_MAKER_LEVEL`, kritische lezer) |
| sound-cowbell | timerSound | level 5 | cowbell | Koebel · Cowbell |
| confetti-veggies | confetti | level 7 | veggies | Groenteconfetti · Veggie confetti |
| font-chalk | cookFont | level 8 | chalk | Krijtbord · Chalkboard |
| sound-gong | timerSound | level 10 | gong | Gong · Gong |
| confetti-party | confetti | level 12 | party | Kippen en taartjes · Chickens and cakes |
| sound-kitchen | timerSound | level 15 | kitchen | Keukenwekker · Kitchen timer |
| font-hand | cookFont | level 18 | hand | Handschrift · Handwriting |
| sound-cooked-tada | cookedSound | level 20 | tada | Tadaa bij Gekookt! · Ta-da on Cooked! |
| confetti-trex | confetti | level 25 | trex | T-rex-confetti · T-rex confetti |
| sound-fanfare | timerSound | level 30 | fanfare | Fanfare · Fanfare |
| confetti-gold | confetti | level 40 | gold | Gouden confetti · Golden confetti |
| confetti-stars | confetti | level 50 | stars | Sterrenregen · Star shower |
| confetti-fire | confetti | badge op-dreef | fire | Vlammetjes · Flames |

Beschrijvingen (één zin, NL · EN): double "Twee keer zoveel snippers bij Gekookt!" · "Twice the pieces
on Cooked!"; avatar "Maak je eigen gezichtje; elk level geeft nieuwe onderdelen." · "Make your own face;
every level adds parts."; cowbell/gong/kitchen/fanfare "Een extra timergeluid, te kiezen onder Meer." ·
"An extra timer sound, pick it under More."; veggies "🥕🥦🍅🌽 in plaats van snippers." · "🥕🥦🍅🌽
instead of pieces."; chalk/hand "Een ander lettertype in de kookstand." · "Another typeface in cook
mode."; party "🐔🧁🎂 regenen uit de lucht." · "🐔🧁🎂 rain from the sky."; tada "Een kort geluidje als
je Gekookt! tikt." · "A short sound when you tap Cooked!"; trex "🦖 Het leven vindt een weg." · "🦖
Life finds a way."; gold "Alles goud bij Gekookt!" · "All gold on Cooked!"; stars "⭐✨ voor een
sterrenkok." · "⭐✨ for a star cook."; fire "🔥 Zo heet als je streak." · "🔥 As hot as your streak."
Gereserveerd, NIET bouwen: gouden modus (thema), challenges op level 20, stickers, kaartthema's.
Levels zonder ontgrendeling hier (4, 6, 9, 11, 13, 14, 16, 17, 19, 21–24, 26–29, 31–39, 41–49, 51+)
krijgen waar mogelijk avatar-onderdelen uit badges-avatar.md (L4, L6, L9, L12, L15, L18, L20, L30, L50,
L60); niet elk level geeft iets, dat is aanvaard. Ontgrendelen is per lid, maar een
telefoon biedt de **vereniging** van wat zijn lokale profielen ontgrendelden (één huishouden, één
telefoon: iedereen profiteert); de aan/uit-schakelaars zijn per telefoon.

### 2f. Badge-raamwerk (interface voor docs/specs/badges-avatar.md; herschreven door de kritische lezer)
Het badge-model is dat van badges-avatar.md §2a: `Badge.tiers?: number[]` (precies 8 drempels; een
ladder), `Badge.hidden?`, `Badge.xp?` (alleen eenmalig), `Badge.group`, en `BadgeStatus.tier` (0..8 voor
een ladder, 0/1 eenmalig) met `BadgeStatus.maxTier`. **XP per badge** = `badgeXp` uit badges-avatar.md,
hier uitgesplitst in events (seed `badge:<id>|<k>`):
- ladder: per bereikt niveau k (1 ≤ k ≤ `status.tier`) één event met base `50 · k`; van niveau 2 naar 3
  popt alleen niveau 3 (nieuwe key);
- eenmalige badge (geen `tiers`): één event `badge:<id>|1` met base `badge.xp ?? (hidden ? 250 : 50)`;
  het fase-5-veld `tier` (1–3) telt niet mee; `xp: 0` (het hartje) geeft een event van 0 XP, dus geen pop.
`XpBadgeFact` = `{ id, level: status.tier, secret: badge.hidden === true, xp?: badge.xp }` (`level` ≥ 1).
Alleen badges op het eigen tabblad tellen (`badgeStatuses(memberId)`); "Samen"-badges geven geen
persoonlijke XP. **Vóór 6D-2** (alleen 6D-1 gebouwd) mapt `src/xp.ts` elke verdiende badge op
`{ id, level: 1, secret: false }` → base 50. Omdat 6D-2a de catalogus en de badge-XP verandert, zet
6D-2a `XP_RULES_VERSION` op **2** (eenmalige melding §1e). Een badge ontgrendelt iets via
`data/unlocks.json` (`by: { badge, level? }`) of een avatar-onderdeel via `data/avatar-parts.json`
(`unlock: { badge }` + `Badge.unlock.part`) — de badge zelf weet daar niets van. Regelsoorten die de
badges-spec uit de XP-stand leest (`overcooked`: `events` met `crit === 'overcooked'`) krijgt zij via
`BadgeFacts.xp?: XpState` (`buildFacts` vult hem met `xpStateFor(memberId)`; leeg op 'all'); de badge
`streakDays` gebruikt `longestDayStreak(cookDays)` uit src/domain/xp.ts. De afleiding hier verandert daar
niet voor. De doneer-badge is cosmetisch (hartje, `xp: 0`).

### 2g. Settings-keys, back-up, Dexie
Geen Dexie-versie nodig (XP is afgeleid; alles hieronder is een setting of een optioneel veld zonder
index). v8/v9 blijven voor inbouwen en varianten-tabs.
- `CookLogEntry.loggedAt?: string` (src/domain/model.ts; `logCooked` in repo.ts vult `nowIso()` als het
  ontbreekt). Reist mee in de back-up (hele rijen); dedupe blijft recipeId+profileId+at.
- `xp.seenRulesVersion: number` — laatst getoonde regelversie (melding bij verschil, §1e).
- `xp.lastSeen: Record<memberId, { total: number; level: number }>` — laatst getoonde stand per lid,
  zodat pops en level-up alleen bij een handeling verschijnen en nooit bij herstel/opstarten.
- `unlocks.disabled: string[]` — door de gebruiker uitgezette ontgrendelingen (nieuw = aan);
  **toestel-lokaal**: in `DEVICE_LOCAL_SETTINGS` (repo.ts), want "Aan/uit geldt voor deze telefoon" (§1f).
- `unlocks.announced: Record<memberId, string[]>` — al in een level-up-overzicht getoond.
- `cook.font: 'default' | 'chalk' | 'hand'` (default 'default'); `cooked.sound: boolean` (default true,
  werkt alleen als `sound-cooked-tada` ontgrendeld is).
- `timer.sound` accepteert extra ids `'cowbell' | 'gong' | 'kitchen' | 'fanfare'` (`normalizeSound`).
- `progress.snapshots: Record<id, ProgressSnapshot>` (6D-4, §2h).
Back-up: settings reizen al mee (exportBundle neemt de hele tabel); alleen `unlocks.disabled` komt in
`DEVICE_LOCAL_SETTINGS` (kritische lezer), de rest niet.
⚠ Feitencheck: `exportBundle()` is standaard ZONDER foto's (`exportBundle({ withPhotos: true })` alleen
als de schakelaar "Met foto's" op Opslag & back-up aan staat; die staat standaard uit). Wie een gewone
back-up terugzet, mist dus de foto's en daarmee de foto-XP: het level is dan lager dan vóór de reset.
Dat volgt uit "XP = afgeleid"; de keuze blijft staan, maar §6b.7 en §7.4 gelden alleen met foto's. Na herstel roept StorageScreen `reloadXp()` aan (stil herberekenen, `xp.lastSeen` overschrijven,
geen pops). `resetEverything` wist alles, dus ook XP (zoals het plan zegt).

### 2h. Deelformaat: nieuwe sleutel `#x=` "Sync mijn voortgang" (6D-4)
Nieuwe `TokenKey` `'x'` (token.ts `TOKEN_KEYS` + `TOKEN_RE` → `[rpwbfx]`; dezelfde regex in router.ts,
boot.ts en landing.ts).
⚠ Feitencheck: de sleutels staan op VIJF plekken, niet vier, en niet overal als tekenklasse:
`src/domain/token.ts` (`TOKEN_RE` `([rpwbf])`), `src/router.ts` (`TOKEN_RE` `([rpwbf])`), `src/landing.ts`
(r. ~414, `([rpwbf])`), `src/boot.ts` (`/^#(r|p|w|b|f)=/` — een alternatie: wordt `(r|p|w|b|f|x)`) en
`src/pwa.ts` `urlForChrome()` (`/^#[rpwbf]=/`, ontbrak in deze spec: zonder `x` geeft "Open in Chrome" de
voortgangslink niet door). Envelop: `{ v: 2, t: 'x', by, at, x: ProgressCard }`:
```ts
export interface ProgressCard {
  id: string; name: string; color: string; lang: Lang; deviceId?: string; // = MemberCard-velden
  rv: number;            // regelversie van de afzender (XP_RULES_VERSION)
  level: number;         // 1…100
  xp: number;            // totaal, geheel ≥ 0
  streak: number;        // huidige streak in kookdagen
  badges: string[];      // verdiende badge-ids op het eigen tabblad; ladderniveau als 'id@3' (zelfde
                         // formaat als badges.earned, kritische lezer)
  cookDays: Array<{ d: string; r: string[] }>; // 'yyyy-mm-dd' lokaal, laatste 90 dagen met ≥ 1 kookbeurt,
                                               // oplopend; r = recipeIds van die dag (uniek, max 5)
  avatar?: AvatarSpec;   // { v: 1, parts, tone?, hair? } uit badges-avatar.md (normalizeAvatarSpec);
                         // weg vóór 6D-3
  [k: string]: unknown;
}
```
Alleen aggregaten: geen notities, geen sterren, geen foto's. `readProgressPayload(v)` tolerant: id+name
verplicht (regels van `readMemberPayload`), level geheel 1…100 anders 1, xp geheel ≥ 0 anders 0, rv
geheel ≥ 1 anders 1, streak geheel ≥ 0 anders 0, badges alleen `/^[a-z0-9]+(?:-[a-z0-9]+)*(?:@[1-8])?$/`
(max 400), cookDays alleen geldige dagen (`dayFromKey`), max 90, r max 5 geldige ids (`SAFE_ID`),
onbekende sleutels blijven. `parseEnvelope` → `kind: 'progress'`, `progress?: ProgressCard`, `by` =
naam als `by` leeg. Een `x` zonder object = `invalid-token` (zoals `f`). WhatsApp-tekst
(`buildProgressShareMessage({ name, level, title, url, lang })`): NL "📈 Voortgang van Stijn — Level 12 ·
Soepkoker. Open de link in de app of plak hem bij In & uit." · EN "📈 Stijn's progress — Level 12 · Soup
Stirrer. Open the link in the app or paste it into In & out.", URL alleen op de laatste regel.
`combineEnvelopes` laat een `x` vallen (zoals een kaartje); `envelopeItemCount` → 0.
**Bevroren token** (tests/fixtures/frozen-share-tokens.ts: `FROZEN_TOKEN_X`, `FROZEN_TOKEN_X_FFLATE`,
`FROZEN_ENVELOPE_X`; eenmalig maken met beide engines, daarna nooit meer wijzigen) voor precies deze
envelop:
```ts
{ v: 2, t: 'x', by: 'Stijn', at: '2026-10-22T10:00:00.000Z',
  x: { id: 'p:k3x9w2qa', name: 'Stijn', color: '#2b4fa8', lang: 'nl', deviceId: 'd:7m4qz81c',
       rv: 1, level: 12, xp: 4512, streak: 5, badges: ['eerste-hap', 'huiskok', 'proever'],
       cookDays: [{ d: '2026-10-19', r: ['b:uiensoep'] }, { d: '2026-10-20', r: ['b:afwasmachinezalm', 'u:abc12345'] },
                  { d: '2026-10-22', r: ['b:uiensoep'] }] },
  future: { keep: true } }
```
LET OP: tests/token.test.ts "a v2 envelope with an unknown kind is invalid-token" gebruikt nu `t: 'x'`
als onbekende soort; die test wisselt naar `t: 'z'` (zelfde strekking), anders faalt hij terecht.
⚠ Feitencheck: er zijn nog twee plekken met `t: 'x'` als "onbekend". (1) tests/token.test.ts r. ~166,
in "throws invalid-token for anything that is not a v2 envelope": `deflatedJson({ v: 2, t: 'x' },
'fflate') // unknown key`. `decodeToken` controleert alleen `isTokenKey(t)`, niet de payload, dus na 6D-4
gooit dit niet meer: ook die regel wisselt naar `t: 'z'`. (2) tests/share.test.ts r. ~251
`parseEnvelope({ v: 2, t: 'x' })` → `invalid-token` blijft groen (een `x` zonder object = invalid-token),
maar test dan iets anders. Zet hem ook op `'z'` en dek "x zonder object" af in het nieuwe progress-blok.
Ontvangst slaat op als `ProgressSnapshot = ProgressCard & { receivedAt: string; friend: boolean }` in
`progress.snapshots` (sleutel = card.id); `ShareEvent.kind` krijgt `'progress'` (de union in
`src/db/model.ts`, niet src/domain/model.ts, en `SHARE_EVENT_KINDS` in src/db/repo.ts). Dexie: ongewijzigd.

## 3. Bestandsverdeling en contracten

Elk bouwblok past in één Opus-workflow: drie bouwers + integrator. Bestandsnamen zijn gecontroleerd op
22 okt 2026. Een bouwer raakt alleen zijn eigen bestanden; wat anderen nodig hebben staat als signatuur.

### Blok 6D-1 — domein, profielbalk, Home-regel, pops, level-up
**Bouwer A — domein (nieuw):** `src/domain/days.ts`, `src/domain/xp.ts`, `src/domain/levels.ts`,
`data/levels.json`, `tools/validate-data.ts` (alleen `validateLevels` + registratie in `main()` ná
badges), `tests/xp.test.ts`, `tests/levels.test.ts`, `tests/fixtures/xp-sim.ts`. Exports: §2b/§2c/§2d.
Extra in `src/domain/levels.ts`: `export const MAX_LEVEL = 100`. Prestatie-eisen voor `deriveXp` (de
30-jaar-test, §6): één sortering van de log, per dag één `Map`, geen object-spreads per event, geen
`Date`-parsing per event behalve één `dayIndexOfIso`, `byKey` gevuld tijdens het bouwen van `events`.
**Bouwer B — app-laag:** `src/xp.ts` (nieuw), `src/domain/model.ts` (alleen `CookLogEntry.loggedAt?`),
`src/db/repo.ts` (`logCooked` vult `loggedAt`; nieuw `listAllPhotosMeta(): Promise<Array<Pick<Photo,
'recipeId' | 'memberId' | 'at'>>>` zonder blobs in het resultaat), `src/cooklog.ts`,
`src/screens/CookScreen.tsx` (`onCooked`: na `checkNewBadges` → `settleXp`; én `onPhotoPicked`: na
`addPhoto`/`checkNewBadges` → `settleXp`), `src/screens/RecipeScreen.tsx` (alleen `onPhotoFile`: idem),
`src/components/CookedSheet.tsx` (settle na beoordelen/foto + de >7-dagen-regel), `src/screens/EditScreen.tsx`
(settle na het opslaan van een eigen recept), `src/badges.ts` (na `setSetting(BADGES_EARNED_SETTING)` →
`settleXp(memberId)` zodat de badge-XP in dezelfde reeks popt), `src/screens/StorageScreen.tsx`
(`reloadXp()` in de `Promise.all` na herstel), `src/i18n/xp.ts` (nieuw) + één regel in `src/i18n/index.ts`.
⚠ Feitencheck: foto's worden op DRIE plekken opgeslagen, niet alleen in CookedSheet: `CookedSheet.onSave`
(`addPhoto` bij Bewaar), `CookScreen.onPhotoPicked` (Gekookt!-pagina van de kookstand, `addPhoto` direct
na kiezen) en `RecipeScreen.onPhotoFile` (foto op de receptpagina). Alle drie roepen daarna
`checkNewBadges` aan. **Besluit (kritische lezer):** alle drie zijn beloningsmomenten; `settleXp` volgt
direct na `checkNewBadges` in CookScreen.onPhotoPicked en RecipeScreen.onPhotoFile (zeven momenten, §5.11).
```ts
// src/xp.ts — app-laag (patroon src/badges.ts; alles no-op als badges uit staan)
export const xpStates: Signal<ReadonlyMap<string, XpState>>;     // per memberId, gememoiseerd
export const xpPops: Signal<XpPopItem[]>;                         // wachtrij voor <XpPop/>
export interface XpPopItem { id: number; xp: number; crit: Crit | null; kind: XpEventKind; sumAfter?: number }
export const levelUp: Signal<LevelUpInfo | null>;                 // voor <LevelUpSheet/>
export interface LevelUpInfo { memberId: string; from: number; to: number; unlocked: Unlock[] } // unlocked leeg in 6D-1
export const xpToast: Signal<string | null>;                      // i18n-key van de 0-XP-melding
export async function buildXpFacts(memberId: string): Promise<XpFacts>; // log/photos gefilterd, recipes → lines, ownRecipes, badges (badgeStatuses)
export async function xpStateFor(memberId: string): Promise<XpState>;   // memo; herberekent als een "dirty"-vlag staat
export function markXpDirty(memberId?: string): void;             // na elke schrijfactie die XP raakt (cooklog, photo, recipe, badges)
/** Beloningsmoment: herbereken, vergelijk met xp.lastSeen, vul pops/levelUp/toast, schrijf lastSeen. quiet = alleen bijwerken. */
export async function settleXp(memberId: string, opts?: { quiet?: boolean }): Promise<XpDelta | null>;
export async function reloadXp(): Promise<void>;                  // na herstel: alles dirty + settle quiet voor alle lokale profielen
export async function checkRulesVersion(): Promise<void>;         // §1e, één keer bij boot (app.tsx)
export function dismissXpPop(id: number): void;
export function clearLevelUp(): void;
```
Volgorde binnen `recordCooked` (src/cooklog.ts): `logCooked` → `markXpDirty` → bestaande confetti/plan →
`void checkNewBadges(...)` → `void settleXp(profileId)`. Omdat `checkNewBadges` geserialiseerd is en zelf
`settleXp` aanroept na nieuwe badges, komen kook- en badge-pops kort na elkaar; `settleXp` is óók
geserialiseerd (zelfde `checking`-ketting-patroon) en voegt pops die binnen 2 s vallen samen in één reeks
met één somregel. `buildXpFacts.ownRecipes`: `origin.kind === 'user'`, `origin.author` gevouwen (NFKD,
accenten weg, lowercase, trim — kopie van `foldName` uit household.ts) gelijk aan de profielnaam, geen
`variantOf` én geen `origin.basedOn` (kopieën en eigen versies van een klassieker tellen niet, kritische
lezer); `bilingual` = `hasLang(name,'nl') && hasLang(name,'en')` én elke stap beide talen.
`buildXpFacts.badges`: vóór 6D-2 `{ id, level: 1, secret: false }` per verdiende badge; vanaf 6D-2a
`{ id, level: status.tier, secret: badge.hidden === true, xp: badge.xp }` (§2f).
**Bouwer C — UI:** `src/components/XpBar.tsx` (exports `XpBar`, `LevelLine`), `src/components/XpPop.tsx`,
`src/components/LevelUpSheet.tsx`, `src/styles/xp.css` (nieuw; import toevoegen in `src/main.tsx` ná
badges.css en vóór print.css), `src/screens/ProfilesScreen.tsx` (XpBar per kaart),
`src/components/HomeLevelRow.tsx` (Home A+: de inhoud wordt `<LevelLine memberId={profileId} />`; null bij
badges uit; HomeScreen.tsx blijft ongemoeid), `src/app.tsx` (mount `<XpPop/>` en `<LevelUpSheet/>` naast
`<BadgeToast/>`; `checkRulesVersion()` na `loadBadgeSettings()`). Props: `XpBar({ memberId, compact? })`,
`LevelLine({ memberId })`; beide lezen `xpStates` en roepen `xpStateFor(memberId)` aan bij mount (stil).
**Integrator:** `npm run check/test/build/validate:data`, DEVICE-TEST rijen 92–93, STATUS.md.

### Blok 6D-2 — badge-catalogus (andere spec)
Uit deze spec alleen, in 6D-2a: `buildXpFacts` mapt een verdiende badge op `{ id, level: status.tier,
secret: badge.hidden === true, xp: badge.xp }` (was `level: 1`), `deriveXp` gebruikt de badge-XP-regel van
§2f (ladder 50·k per niveau; eenmalig `xp ?? (hidden ? 250 : 50)`), en `XP_RULES_VERSION` gaat naar **2**
(melding §1e). `src/badges.ts` vult `BadgeFacts.xp` met `xpStateFor(memberId)`. Staat in badges-avatar.md
§3a (bouwer C bezit daarvoor ook src/xp.ts en src/domain/xp.ts, alleen deze regels).

### Blok 6D-3 — ontgrendelingen
**Bouwer A — domein + app-laag:** `src/domain/unlocks.ts`, `data/unlocks.json`, `tools/validate-data.ts`
(`validateUnlocks`, na levels; krijgt de badge-ids), `tests/unlocks.test.ts`, `src/unlocks.ts` (nieuw):
```ts
export const unlockData: () => Unlock[];                           // genormaliseerde data/unlocks.json (module-cache)
export const unlockedOnPhone: Signal<ReadonlySet<string>>;         // vereniging over de lokale profielen (§2e)
export const disabledUnlocks: Signal<ReadonlySet<string>>;         // setting unlocks.disabled
export async function refreshUnlocks(): Promise<void>;             // na settleXp (xp.ts roept dit aan) en bij boot
export function isActive(id: string): boolean;                     // ontgrendeld én niet uitgezet
export async function setUnlockEnabled(id: string, on: boolean): Promise<void>;
export function activeConfettiStyles(): string[];                  // ['default', …values van actieve confetti-unlocks]
export function activeTimerSounds(): TimerSound[];                 // basis vier + actieve
export function activeFonts(): Array<'default' | 'chalk' | 'hand'>;
export async function announceUnlocks(memberId: string, from: number, to: number, badges: XpBadgeFact[]): Promise<Unlock[]>; // nog niet in unlocks.announced; schrijft de setting
```
**Bouwer B — motoren:** `src/sounds.ts` (`TimerSound` + 'cowbell' | 'gong' | 'kitchen' | 'fanfare';
`playCookedSound(ctx)` en `previewCookedSound()` (voor "Probeer", zelfde `previewCtx`-patroon als
`previewTimerSound`); `COOKED_SOUND_SETTING = 'cooked.sound'` met signal + load/set zoals
`timerVibrate`), `src/celebrate.ts` (`celebrate(kind, opts?: { style?: string })`; `Celebration.style`;
kiest anders via `activeConfettiStyles()` met `hash32(String(at)) % n`), `src/components/Confetti.tsx`
(stijlen §1g; emoji-snippers als `<i>` met tekst, `font-size: 18px`), `src/screens/CookScreen.tsx`
(`data-font` op `.cook-card`; `playCookedSound` na opslaan als `cooked.sound` aan en ontgrendeld),
`src/cooklog.ts` (idem voor de CookedSheet-route), `public/fonts/patrick-hand.woff2` en
`public/fonts/cabin-sketch.woff2` (OFL; latin-subset van Google Fonts, samen < 120 kB; `@font-face` in
`src/styles/browse.css` bij `.cook-card`), `src/styles/browse.css` (`.cook-card[data-font='chalk']` /
`[data-font='hand']`). Geluidsrecepten (WebAudio, zelfde `note()`-helper, pieken ≤ 0,5):
⚠ Feitencheck: de bestaande `note(ctx, freq, at, peak, decay, stop?)` in src/sounds.ts is privé en zet
altijd `osc.type = 'sine'`; er is geen golfvorm-parameter. Voor 'square'/'triangle' hieronder krijgt
`note()` een extra optionele parameter `type: OscillatorType = 'sine'` (achteraan), zodat beeps/bell/
melody precies hetzelfde blijven klinken. **cowbell** =
twee tegelijk klinkende tonen 587 + 845 Hz, square-achtig (type 'square', peak 0,25), decay 0,25 s, drie
slagen om 0,35 s, twee rondes om 1,5 s; **gong** = 180 Hz sine peak 0,35 decay 3 s + partials 432 Hz
(0,12) en 558 Hz (0,08), één slag, tweede slag na 2,5 s; **kitchen** = 10 tikjes (type 'square',
2000 Hz, 0,03 s, peak 0,15, om 0,08 s) gevolgd door een bel 1000 Hz peak 0,4 decay 1 s; **fanfare** =
triangle C5 E5 G5 C6 (0,22 s elk, peak 0,35) daarna akkoord C5+E5+G5+C6 1,2 s; **tada** (cooked) =
triangle C5 G5 C6 om 0,12 s + akkoord C5+E5+G5 0,5 s, totaal < 1 s.
**Bouwer C — UI:** `src/screens/UnlocksScreen.tsx` (nieuw), `src/screens/MoreScreen.tsx` (rij
Vrijgespeeld; uitgebreide geluidenkiezer; Lettertype-kiezer; Gekookt!-geluid-schakelaar),
`src/components/LevelUpSheet.tsx` (toont `LevelUpInfo.unlocked`), `src/app.tsx` (route
`/more/unlocks`), `src/i18n/xp.ts` + `src/i18n/settings.ts` (`more.unlocks*`, `more.timerSound.*`,
`more.cookFont*`, `more.cookedSound*`). `src/xp.ts` vult `LevelUpInfo.unlocked` via `announceUnlocks`.
**Avatar-maker** (feature-unlock op level 3) wordt gebouwd door de avatar-spec; deze spec levert alleen de
rij en de link. **Integrator:** check/test/build/validate, DEVICE-TEST rij 98, STATUS.

### Blok 6D-4 — Sync mijn voortgang + kookkalender
**Bouwer A — contract:** `src/domain/token.ts` (`TokenKey` + 'x', `TOKEN_KEYS`, `TOKEN_RE`),
`src/domain/share.ts` (`ProgressCard`, `buildProgressEnvelope(card: ProgressCard): Envelope`,
`readProgressPayload(v: unknown): ProgressCard | null`, `parseEnvelope` tak `t === 'x'` → `kind:
'progress'`, `ParsedShare.progress?`, `ShareKind` + 'progress', `buildProgressShareMessage`,
`planMessages`-tak voor één `x`, `combineEnvelopes` laat `x` vallen), `src/domain/progress.ts` (nieuw):
```ts
export interface ProgressSnapshot extends ProgressCard { receivedAt: string; friend: boolean }
export function progressCardFor(i: { member: Pick<Member,'id'|'name'|'color'|'lang'>; deviceId?: string; state: XpState; badges: XpBadgeFact[]; log: XpCookFact[]; today: number; avatar?: ProgressCard['avatar'] }): ProgressCard; // cookDays = laatste 90 dagen
export function normalizeSnapshots(v: unknown): Record<string, ProgressSnapshot>;
export interface CalendarDay { day: number; cooks: Array<{ memberId: string; recipeId: string | null }> }
export function calendarMonth(i: { year: number; month: number; local: Array<{ memberId: string; recipeId: string; at: string }>; snapshots: readonly ProgressSnapshot[]; localMemberIds: ReadonlySet<string> }): CalendarDay[];
```
plus `tests/share.test.ts` (progress-blok), `tests/token.test.ts` (frozen X; onbekende soort → 'z'),
`tests/fixtures/frozen-share-tokens.ts`, `tests/progress.test.ts`.
**Bouwer B — ontvangst:** `src/router.ts`, `src/boot.ts`, `src/landing.ts` (regex `[rpwbfx]` +
§1k), `src/pwa.ts` (alleen de regex in `urlForChrome()`: `/^#[rpwbfx]=/`; boot.ts is een alternatie:
`/^#(r|p|w|b|f|x)=/` — zie de feitencheck in §2h), `src/paste.ts` (`Collected.progress: ProgressCard[]`, `summarizePaste`-label `paste.progress` —
NL "Voortgang van {name}" · EN "{name}'s progress"), `src/domain/paste-classify.ts` (ongewijzigd: `x`
valt onder 'tokens'; alleen de regex in `extractTokens` telt), `src/screens/InboxScreen.tsx` (kaart
§1i), `src/screens/HouseholdScreen.tsx` (`readMemberCards` accepteert `progress` als kaart; levelregel
per lid; Vrienden-kaart), `src/db/model.ts` (`ShareEvent.kind` + 'progress'; re-export
`ProgressSnapshot`), `src/db/repo.ts` (`SHARE_EVENT_KINDS` + 'progress'; `PROGRESS_KEY =
'progress.snapshots'`; `getProgressSnapshots()`, `putProgressSnapshot(s)`, `removeProgressSnapshot(id)`).
**Bouwer C — UI:** `src/components/ProgressSharePanel.tsx` (nieuw; gebruikt `progressCardFor` +
`encodeToken` + `buildShareUrl(appInfo.appUrl, 'x', token)` + `shareText`; logt 'out'),
`src/screens/ProfilesScreen.tsx` en `HouseholdScreen.tsx` (knop + paneel), `src/screens/CalendarScreen.tsx`
(nieuw), `src/screens/MoreScreen.tsx` (rij Kookkalender), `src/app.tsx` (route `/more/calendar`),
`src/i18n/xp.ts` (`progress.*`, `calendar.*`), `src/i18n/edit.ts` (`inbox.ev.progress`, `paste.progress`).
**Integrator:** check/test/build, DEVICE-TEST rijen 99–100, STATUS, `docs/adr/0004-share-token.md` één
regel: "22 okt 2026: sleutel `x` (voortgang) toegevoegd; bevroren token in tests".

## 4. Stappenplan

Volgorde vast; elk blok gaat apart online (eerst `/next/`, dan `main`). Geen vlag nodig: alles valt al
onder de schakelaar Badges, en een blok zonder UI (6D-1 bouwer A alleen) is onzichtbaar.

1. **6D-1 — domein + profielbalk + Home-regel + pops + level-up (zonder ontgrendelingen).** Klaar als:
   `deriveXp` met alle tests uit §6a groen (incl. 30-jaar-simulatie < 50 ms); `data/levels.json` met 100
   titels gevalideerd; XpBar op Profielen, LevelLine op Home, XpPop en LevelUpSheet in de shell;
   `loggedAt` wordt geschreven; de drie eerlijke meldingen (§1e); `reloadXp` na herstel; badges uit = geen
   spoor. Eerst op `/next/` (eigen database, Stijn en Gabi kijken een paar dagen mee), dan `main`.
   Zwaarte: drie bouwers + integrator, ±1 workflow; de domeinbouwer is het grootste deel.
2. **6D-2 — badge-catalogus, niveaus, groepen, verborgen (docs/specs/badges-avatar.md).** Hier alleen
   de één-regel-koppeling uit §3 ("BadgeStatus.level"). Pas na 6D-1, zodat elke nieuwe badge meteen XP
   popt.
3. **6D-3 — ontgrendelingen (+ avatar-maker uit de andere spec).** Klaar als: `data/unlocks.json`
   gevalideerd; Vrijgespeeld-pagina; confetti-stijlen, vier timergeluiden, Gekookt!-geluid, twee
   lettertypes; keuzes in Meer; level-up-overzicht toont wat vrijkwam; per stuk aan/uit; `unlocks.announced`
   voorkomt dubbele aankondigingen. Fonts (woff2) in de precache (vite-plugin-pwa neemt `public/` mee —
   controleren in de build-output). Eerst `/next/`.
4. **6D-4 — Sync mijn voortgang + kookkalender.** Klaar als: sleutel `x` in token/router/boot/landing;
   bevroren token in de tests; In & uit-kaart met de drie uitkomsten; Huishouden met levels en Vrienden;
   Kookkalender; 'progress'-rijen in In & uit; landingspagina. **Korte Fable-blik vóór livegang** op
   share.ts/token.ts (deelformaat, invariant 4), zoals STATUS.md voor 13D afspreekt.
5. **Later (niet nu):** challenges op level 20, gouden modus, stickers, kaartthema's, doneer-hartje; een
   server voor automatische sync (ADR, raakt invariant 14).

## 5. Regels en eerlijkheid

**Invarianten.** (1) ids: de afleiding leest ids, verandert er geen; `loggedAt` is een nieuw optioneel
veld, geen id. (2) raw-regels: onaangeraakt. (3) `{nl,en}`: titels, notes, unlock-namen en alle UI-teksten
in beide talen; `data/levels.json` en `data/unlocks.json` worden daarop gevalideerd. (4) deelformaat:
nieuwe sleutel `x`, bevroren tokens op beide engines, onbekende sleutels blijven, een app van vóór 6D-4
zegt bij `#x=` "ongeldige code" (v blijft 2) — precies zoals bij `#f=`, gepind in tests.
⚠ Feitencheck: een app van vóór 6D-4 herkent `#x=` helemaal niet als code. router.ts, boot.ts en
`extractTokens` matchen alleen `[rpwbf]`: een geopende `#x=`-link is geen token, `parseHash` maakt er
route `/` van (Home), en op de iPhone opent Safari de volle app in plaats van de landingspagina (boot.ts
ziet geen token). Een geplakte link geeft "geen code gevonden". Alleen een kale JSON-envelop met
`t: 'x'` geeft `invalid-token`. Zo staat het voor `#f=` ook in tests/token.test.ts (r. ~180–191: "the
pre-block-F key set never matched #f= at all"). (5/6/7) iPhone:
geen share target, ontvangen = kopiëren → app → plakken; de landingsbundel toont voortgang zonder storage;
boot.ts kent `x`. (8) persist: ongewijzigd. (9) `navigator.share` met alleen `{text}`. (12) alles in
settings/Dexie → automatisch per kanaal (`/next/` heeft eigen XP). (13) geluiden spelen via de
tap-ontgrendelde AudioContext; nergens een belofte over achtergrondgeluid. (14) geen server: "Sync" is een
momentopname via een linkje en de UI zegt dat (§1h, §1j). (15) geen npm-dependency: hash, geluiden en
confetti zijn eigen code; de twee woff2-lettertypes zijn assets onder OFL — één regel in
docs/adr/0001-runtime.md of een nieuwe ADR-0008 "fonts" (licentie + herkomst), door de integrator.

**Eerlijk.** XP wordt herberekend, dus een latere regelwijziging verandert levels; daarom de regelversie
en de melding (§1e) — nooit stil. Anti-valsspeelregels pakken nooit iets af binnen een regelversie en zijn
niet beschuldigend geformuleerd. Vrienden en huisgenoten op een andere telefoon zie je alleen zoals ze
het laatst deelden; de kalender en het Huishouden-scherm zeggen dat letterlijk. Timers en achtergrond:
niets nieuws beloofd.

**iPhone vs Android.** Geen verschil in XP of ontgrendelingen. Delen: één tekstveld (werkt op beide).
Ontvangen: Android opent de link in de app (als link capture werkt) of in Chrome; iPhone altijd Safari →
landingspagina → kopiëren → plakken. Geluiden: op iOS alleen hoorbaar met de app op de voorgrond, en met
de stil-schakelaar aan helemaal niet (dat laatste zegt `more.timerSoundIOSHint` nu al; die tekst gaat
over de stil-schakelaar, niet over de voorgrond). Schudden bij Overcooked! respecteert `prefers-reduced-motion` op beide.

**Opus mag dit NIET zelf beslissen (zo doen als hier staat, anders vragen aan Stijn/Fable):**
1. Alle getallen in `XP_RULES` (§2b), de curve 11·(L−1)^2,5, max level 100, de streaktrappen, ±20 %,
   5 %/1 % crits ×2/×5, het dagplafond 3/5/6, de rustregel 4-op-rij, 7 dagen terugdateren, de
   moeilijkheidsbonus op ingrediëntregels (niet stappen), weekbonus 7 van 7.
2. De hash (FNV-1a + fmix32, UTF-16 code units) en de seed-strings letterlijk; geen `Math.random`
   ergens in XP.
3. XP afleiden, nooit optellen of opslaan; geen Dexie-versie, geen tabel; de genoemde settings-keys.
4. De 100 titels en 6 notes letterlijk (§2d); "Best Chef of the Universe" in beide talen gelijk.
5. De ontgrendelingenlijst (ids, soorten, levels, badge), de confetti-stijlen, de geluidsrecepten, de twee
   lettertypes (Patrick Hand, Cabin Sketch) en de schoolbordkleur `#2f4f3a`; het goudtoken.
6. Alle UI-teksten en i18n-keys letterlijk uit §1 (NL en Brits-Engels); nieuwe teksten alleen met beide
   talen in `src/i18n/xp.ts`.
7. De envelop `x` precies zoals §2h (velden, limieten 90/5/400, tolerantie), het bevroren token exact de
   gegeven envelop, en de wijziging van de "unknown kind"-test naar `z`.
8. Pop-timing (900 ms, 350 ms, 1,4 s, 600 ms som), schudden 400 ms/4 px, toast 5 s; sheet via
   `SheetPortal` met de bestaande `.sheet`-klassen.
9. Badges uit = geen enkel spoor van XP; Confetti uit = geen schudden maar wél de tekstpop.
10. Samen-badges geven geen XP; ontgrendelingen zijn per lid verdiend, per telefoon gebruikt (vereniging),
    aan/uit per telefoon.
11. Geen XP tijdens bladeren: `settleXp` alleen op de zeven beloningsmomenten (recordCooked,
    CookScreen.onCooked, CookedSheet beoordelen/foto, CookScreen.onPhotoPicked, RecipeScreen.onPhotoFile,
    EditScreen eigen recept opslaan, checkNewBadges na een nieuwe badge); nooit vanuit een `useEffect`
    bij mount, nooit vanuit `useLive`.
12. Kookkalender altijd zichtbaar (ook met badges uit), levels erin alleen met badges aan.
13. Geen nieuwe npm-dependency; geen Google-Fonts-link in de HTML (offline-first: de woff2-bestanden
    lokaal).
14. Het 50 ms-prestatiedoel niet oprekken; optimaliseren.

## 6. Testplan

### 6a. Unit tests (Vitest, node)
**tests/xp.test.ts** (nieuw; blok 6D-1). Helpers zoals tests/badges.test.ts (`entry(recipeId, at,
stars)`; dagen via `Date.UTC`-middagen zodat de lokale dag niet verschuift op Stijns pc).
- `hash32` pins: `''` → 2872998923; `'a'` → 444641715; `'cook:b:uiensoep|2026-10-22T17:30:00.000Z'` →
  2188135396 en `unitFromSeed` ≈ 0,509465 (toBeCloseTo 5); `'week:20748'` → 3827384507;
  `'badge:eerste-hap|1'` → 1574489043.
- `rollReward(100, 'x'+i)` voor i < 10.000: zonder crit altijd 80 ≤ xp ≤ 120; gemiddelde 99,5–100,5.
- Crit-verdeling over seeds `cook:b:test|2026-01-01T12:00:00.000Z#<i>`, i < 10.000: exact **94**
  overcooked en **505** cooked (determinisme), én binnen de marges 60–140 / 420–580 (documentatie).
- Bekende crits: `cook:b:test|2026-03-03T18:00:00.000Z#2` → cooked; `cook:b:test|2026-03-04T18:00:00.000Z#115`
  → overcooked (base 100 → xp in 400…600); `photo:b:p|2026-04-01T12:00:00.000Z` → base 30 → **175**.
- Curve: `xpForLevel` 1→0, 2→11, 3→62, 4→171, 5→352, 6→615, 7→970, 10→2673, 20→17309, 30→49818,
  50→184877, 100→1072706; `levelForXp` 0→1, 10→1, 11→2, 61→2, 62→3, 2672→9, 2673→10, 1072705→99,
  1072706→100, 9e9→100. `streakMultiplier` 1→1, 2→1, 3→1,1, 6→1,1, 7→1,2, 13→1,2, 14→1,3, 29→1,3,
  30→1,5, 99→1,5, 100→1,75, 364→1,75, 365→2, 1000→2.
- Eerste kook → level 3 voor elke seed: 500 seeds `cook:b:r<i>|2026-01-01T12:00:00.000Z`, base 100:
  minimum 80, `levelForXp(min)` = 3.
- **Uitgewerkt voorbeeld** (§2c): events in deze volgorde met xp 131, 103, 138, 54 (crit 'cooked'), 13,
  52; totaal 491; level 5; levelStart 352; nextAt 615. Daarna sterren 3 op kookbeurt 2: event 2 → 108,
  totaal 496; `diffXp(prev, next)` → `{ amount: 5, pops: [{ xp: 5, kind: 'cook' }], levelFrom: 5, levelTo: 5 }`.
  ⚠ Feitencheck: met `toEqual` faalt deze verwachting op het type van §2c: elke pop heeft ook `crit`
  (hier `null`, en `null` ≠ ontbrekend) en `XpDelta` heeft ook `zeroReasons`. Gebruik `toMatchObject` met
  dit object, of schrijf `pops: [{ xp: 5, crit: null, kind: 'cook' }]` en `zeroReasons: []` erbij.
- Streak: kookdagen [0..5, 7..14, 16, 17, 18] (vanaf 2026-01-05 12:00 UTC) → `streak.best` 17 en de
  vermenigvuldigers per event `1,1,1.1,1.1,1.1,1.1,1.2,1.2,1.2,1.2,1.2,1.2,1.2,1.3,1.3,1.3,1.3`; dagen
  [0,1,2,3,5,7,8] → best 5 (tweede vrije dag binnen 7 dagen breekt). `currentStreak`: vandaag =
  laatste dag + 1 → zelfde waarde; + 2 met vrije dag beschikbaar → zelfde waarde, `freeDayUsed` true;
  + 3 → 0.
- **Anti-valsspeel** (recepten `b:x0`…`b:x5` met 5 regels; per dag 1–5 juni 2026 zes kookbeurten om
  10:00…15:00 UTC, plus `b:x0` nog eens op 1 juni 20:00): dag 1 xp `[103, 87, 236, 53, 40, 0, 0]` met
  reasons `[null, null, null, null, null, 'dayCap', 'sameRecipe']` (236 = crit cooked), dag 2 `[64, 93,
  97, 52, 51, 0]`, dag 3 `[75, 88, 105, 40, 37, 0]`, dag 4 en 5: alle vijf `busyWeek` + één `dayCap`;
  totaal 1221. Variant: dag 4 vervangen door één kookbeurt → dag 5 heeft reasons `[null×5, 'dayCap']`.
- Terugdateren: `loggedAt` 10 dagen na `at` → `backdated`, base blijft 100; 7 dagen → telt.
- Invoerdag-plafond (regel 1b): zeven recepten `b:y0`…`b:y6`, elk gekookt op een andere dag (1–7 juni
  2026, 18:00 UTC) maar alle zeven met `loggedAt` 2026-06-08T20:00:00.000Z → factoren
  `[1, 1, 1, 0.5, 0.5, 0, 0]` op `at`-volgorde met reasons `[null, null, null, null, null, 'dayCap',
  'dayCap']`; zonder `loggedAt` alle zeven factor 1.
- `longestDayStreak([0,1,2,3,5,7,8])` → 5; `([0..5, 7..14, 16, 17, 18])` → 17; `([])` → 0.
- Weekbonus: 7 kookdagen vanaf ma 2026-01-05 → één `week`-event, key `week:20458`, xp 41; 6 dagen → geen.
- Foto's: `b:p` 2026-04-01 12:00 en 13:00 en 2026-04-02 13:00 → xp 175 (overcooked), 0 `samePhotoDay`,
  34 (cooked); eigen recept `u:m` eentalig → 10; badge `kok` niveau 3 → 54, 83, 164; geheime badge
  `{ id: 'geheim', level: 1, secret: true }` (seed `badge:geheim|1`) → 273. (Feitencheck: zonder die id
  was 273 niet na te rekenen; alle getallen in dit blok zijn nagerekend en kloppen.)
- `deriveXp` is deterministisch (twee keer dezelfde facts → `toEqual`), log-volgorde in de input doet
  er niet toe (geschud → zelfde `total` en `events` na sorteren op key).
- **30-jaar-simulatie** (`tests/fixtures/xp-sim.ts` exporteert `simulate({ years, holidaysPerYear = 3,
  holidayDays = 10, skipEvery = 0 }): XpFacts`, letterlijk zo: dag d = 0 … round(years · 365,25) − 1
  vanaf ma 2026-01-05, `at` = `Date.UTC(2026,0,5) + d·86400000 + 18·3600000` als ISO; dag-van-het-jaar
  `doy = d mod 365`; vakantie h (0 … holidaysPerYear−1) begint op `floor((h + 0,5) · 365 /
  holidaysPerYear)` en duurt holidayDays dagen → geen kookbeurt; `skipEvery > 0 && hash32('skip' + d) %
  skipEvery === 0` → geen kookbeurt; pool start 40 en `d % 37 === 0` → pool++; recept `'b:r' + ((d·7 +
  ⌊d/11⌋) mod pool)`; regels `[5,7,9,10,12,14,16][hash32(recipeId) % 7]`; `stars: 5` op even d, anders
  null; `id` oplopend vanaf 1; foto van dat recept op dezelfde `at` als `d % 5 === 0`; geen eigen
  recepten, geen badges). Asserts voor `years: 30`: 10.058 kookbeurten, 2.012 foto's, 1.360 weekbonussen,
  `events.length` 13.430, totaal **1.259.039** (exact; wijkt het af, dan zit het verschil in de regels —
  meestal de volgorde binnen een dag of de plafondtelling — en wordt het getal NIET aangepast), level
  **100**; twee runs geven `toEqual`-gelijke standen. **Prestatie**: één warm-up, daarna mediaan van 5
  runs < **50 ms** (`performance.now()`; referentie-implementatie: 35 ms); haalt een implementatie dat
  niet, dan optimaliseren (§3), de grens niet verhogen. `skipEvery: 10` → 9.039 kookbeurten, totaal
  967.012, level 95; `years: 0.5` → level 24; `years: 1` → level 29 (alle vier als pins).
  ⚠ Feitencheck (onafhankelijk nagebouwd: alle pins hierboven kloppen exact, ook 10.058 / 2.012 / 1.360 /
  13.430): ze kloppen ALLEEN als de stappen per dag in deze volgorde lopen: eerst de vakantie- en de
  skip-test (`continue`), pas daarna `if (d % 37 === 0) pool++`, dus de pool groeit alleen op kookdagen.
  Wie `pool++` vóór de vakantie-/skip-test zet (op elke dag), krijgt 1.264.313 (skipEvery 10: 972.178,
  level 96; 1 jaar: 50.606, level 30). Dat is dan een fout in `simulate()`, niet in `deriveXp`.
**tests/levels.test.ts**: 100 items, levels 1…100 aaneengesloten, titels beide talen niet leeg en uniek
per taal, level 2 = 'T-rex' (beide), 6 = 'Oma'/'Grandma', 100 = 'Best Chef of the Universe' (beide);
`normalizeLevels([])` → 100 keer 'Level N'; `titleFor(101)` → 'Level 101' nooit een exception.
**tests/unlocks.test.ts** (6D-3): `normalizeUnlocks` laat items zonder `by`/`value` weg; `unlockedIds` op
level 3 → {confetti-double}; level 25 zonder badges → 11 ids; badge `op-dreef` → confetti-fire erbij;
`unlocksForLevels(1, 3)` → [confetti-double]; `unlocksForLevels(3, 8)` → avatar-maker, sound-cowbell,
confetti-veggies, font-chalk (in de volgorde van het bestand). Validator: dubbele id, `by.level`
1 of 101, onbekende badge, lege `value` → fouten.
**tests/share.test.ts** (6D-4, nieuw blok "progress (#x=)"): `buildProgressEnvelope` → `t: 'x'`, `by` =
naam; round-trip via codec → `kind 'progress'`, `progress` toEqual; tolerantie: level 0/101/'12' → 1,
badges met vreemde tekens weggefilterd, 95 cookDays → 90 (de laatste), `r` > 5 → eerste 5, ongeldige
dag weg; `x` zonder object → invalid-token; `{ v:2, t:'x', x:{} }` → kind 'progress' zonder `progress`;
`buildProgressShareMessage` NL/EN exacte zinnen (§2h) met de URL op de laatste regel; `planMessages` met
één `x` → die tekst, 1 token, `extractTokens(text).map((t) => t.key)` → ['x'] (`extractTokens` geeft
`Array<{ key, token }>` terug, geen strings); `combineEnvelopes([x, r])` → bundel met 1 recept,
`parseEnvelope(out).progress` undefined.
**tests/token.test.ts**: `FROZEN_TOKEN_X` / `_FFLATE` decoderen op beide engines naar `FROZEN_ENVELOPE_X`
én `encodeToken(FROZEN_ENVELOPE_X)` is byte-gelijk aan het bevroren token (zoals bij F); `extractTokens`
vindt `#x=`; "unknown kind" gebruikt voortaan `t: 'z'` — in de test "a v2 envelope with an unknown
kind…" (r. ~184–186) én in de lijst van "throws invalid-token for anything that is not a v2 envelope"
(r. ~166, `{ v: 2, t: 'x' }`; zie de feitencheck in §2h); `isTokenKey('x')` true.
**tests/progress.test.ts**: `progressCardFor` neemt alleen de laatste 90 dagen, uniek per dag, max 5 ids,
geen sterren/notities in het object (sleutels exact: id, name, color, lang, deviceId?, rv, level, xp,
streak, badges, cookDays, avatar?); `normalizeSnapshots` met rommel → leeg; `calendarMonth`: lokaal en
snapshot van dezelfde memberId → één stip (lokaal wint), snapshot zonder recept → `recipeId: null`,
dagen buiten de maand ontbreken, `cooks` per dag op memberId-volgorde van invoer.
**Bestaande tests** die mee moeten: tests/badges.test.ts ongewijzigd; tests/share-events.test.ts krijgt
één geval met kind 'progress' (decodeShareEvent accepteert het).

### 6b. Acceptatiechecks in de dev-app (`npm run dev`, 375 px, badges aan)
1. Nieuw profiel, één kookbeurt via ✓ Gekookt → confetti, dan rechtsboven "+1xx" (80–120 of een crit),
   dan de sheet "🎉 Level 3!" met "Aardappelschiller" en (6D-3) "Ontgrendeld: Dubbele confetti".
   ⚠ Feitencheck: de eerste kookbeurt verdient ook meteen de badge `eerste-hap` (data/badges.json:
   cookCount 1, tier 1) → via `checkNewBadges` → `settleXp` nog een pop van base 50 (40–60). De kook zelf
   is base 100 + moeilijkheid (0–30) + sterren (5): 80–162 zonder crit. Samen 120–222 XP, en level 4
   begint bij 171: bij een recept met veel ingrediëntregels of een gunstige worp wordt het "Level 4!"
   (Afwasser) in plaats van 3. Hetzelfde geldt voor stap 2 hieronder, DEVICE-TEST 92 en §7.15.
2. Meer → Profielen: "Level 3 · Aardappelschiller — … / 171 XP", balk, "🔥 vandaag gekookt · nog … XP
   tot level 4". Home: dezelfde regel onder de begroeting; tik → Profielen.
3. Zelfde recept nog eens vandaag → confetti, géén pop (0 XP, stil). Zes verschillende recepten op één
   dag → vanaf de 6e de toast "Genoeg gekookt voor vandaag — morgen weer XP."
4. ✓ Gekookt met "Andere datum" 10 dagen terug → de muted regel onder de datum; na Bewaar geen pop.
5. Beoordeel een kookbeurt achteraf (★) → kleine pop (+5 à +12).
6. Badges uit (Meer) → geen XpBar, geen Home-regel, geen pops, geen rij Vrijgespeeld; weer aan → alles
   terug met dezelfde stand (niets "kwijt").
7. Back-up maken, app resetten, back-up terugzetten → zelfde level en XP, geen pops, geen sheet.
   ⚠ Feitencheck: alleen met "Met foto's" aan (standaard uit, zie §2g); zonder foto's in de back-up is
   de foto-XP na het herstel weg en het level dus lager.
8. (6D-3) Vrijgespeeld: schakel Dubbele confetti uit → volgende Gekookt! toont de standaardburst;
   "Probeer" bij Koebel speelt het geluid; Lettertype Krijtbord → kookstand toont de groene kaart.
9. (6D-4) "Sync mijn voortgang" → Kopieer link → plak in In & uit → kaart "Voortgang van <naam>" met
   "… is een profiel op deze telefoon"; plak dezelfde link in een tweede browserprofiel (andere database)
   → "Bewaar als vriend" → Kookkalender toont de stipjes van de vriend op de juiste dagen; Huishouden toont
   de kaart Vrienden.
10. `#x=`-link openen in de iPhone-simulator of met een iOS-UA in Safari → landingspagina "Voortgang van
    <naam>" met Kopieer-knop (geen storage).

### 6c. DEVICE-TEST-rijen (definitief 92, 93, 98, 99, 100; 94–97 zijn van badges-avatar.md; NL én EN in docs/DEVICE-TEST.md)
De integrator zet deze vijf rijen in de tabel van docs/DEVICE-TEST.md (kolommen "Wat je doet" / "Wat
"goed" is"); hier als lijst, één handeling per zin.

**92 — XP en levels (fase 6, 6D-1).**
Doe: 1. Tik op een recept en op **✓ Gekookt**. Tik bovenaan op **Bewaar**. Kijk rechtsboven. 2. Tik op
**Meer** → **Profielen beheren**. Kijk onder je naam. 3. Ga naar **Home**. Kijk onder de begroeting. Tik erop.
4. Open hetzelfde recept en tik nog eens **✓ Gekookt** → **Bewaar**.
Goed: 1. Confetti, en daarna verschijnt rechtsboven kort een blauw blokje "+1xx" (soms in goud met
"Cooked!"). Daarna schuift een venster omhoog: "🎉 Level 3!" met de titel **Aardappelschiller**.
2. "Level 3 · Aardappelschiller" met een balk en "… / 171 XP"; eronder "🔥 vandaag gekookt · nog … XP
tot level 4". 3. Dezelfde regel met je avatar; de tik opent Profielen. 4. Wel confetti, geen blauw
blokje (hetzelfde recept telt één keer per dag).
⚠ Feitencheck: de rij in de app heet "Profielen beheren" (`more.manageProfiles`; EN "Manage
profiles"); het scherm zelf heet "Profielen". Bij 1.: zie de feitencheck in §6b.1 (de eerste kook
geeft ook de badge Eerste hap: soms "Level 4!" / **Afwasser**).

**93 — Eerlijk over 0 XP (6D-1).**
Doe: 1. Tik op een recept → **✓ Gekookt** → **Andere datum**, kies een dag van twee weken geleden. Lees
onder de datum. Tik op **Bewaar**. 2. Kook (via ✓ Gekookt) zes verschillende recepten achter elkaar.
Let op na de zesde.
Goed: 1. "Langer dan een week geleden: telt voor je badges en de kalender, niet voor XP." Na Bewaar:
confetti, geen blauw blokje. 2. Na de zesde verschijnt onderaan de melding "Genoeg gekookt voor vandaag
— morgen weer XP."
⚠ Feitencheck: doe je rij 93 op dezelfde dag als rij 92, dan bezet het recept uit rij 92 al plek 1 van
het dagplafond (§2b): bij zes ANDERE recepten komt de melding dan al na de vijfde. Hij komt pas na de
zesde als de eerste van de zes het recept uit rij 92 is (dat telt dan als "zelfde recept", 0 XP, geen
plek), of als je rij 93 op een andere dag doet.

**98 — Vrijgespeeld (6D-3).**
Doe: 1. Tik op **Meer** → **🎁 Vrijgespeeld**. 2. Zet **Dubbele confetti** uit. Kook iets (✓ Gekookt →
Bewaar). 3. Tik bij een geluid met een slotje. 4. Heb je **Koebel** vrijgespeeld (level 5)? Tik op
**Probeer**. Ga naar **Meer** → **Instellingen** en scrol naar het kopje **Kookstand & timer**. 5. Heb je
**Krijtbord** (level 8)? Kies het onder
**Lettertype kookstand** en open de kookstand van een recept.
Goed: 1. Bovenaan je levelbalk; daaronder kaarten Confetti, Timergeluiden, …; wat je nog niet hebt,
heeft een slotje met "Level 5", "Level 7" …. 2. De confetti is weer de gewone (minder snippers). 3. Er
gebeurt niets (geen geluid). 4. Je hoort een koebel; onder Timergeluid staat nu ook **Koebel**. 5. De
stapkaart is schoolbordgroen met krijtletters.

**99 — Sync mijn voortgang (6D-4).**
Doe: 1. Tik op **Meer** → **Profielen beheren** → **Sync mijn voortgang** → **Deel** en stuur het via WhatsApp
naar de ander. 2. *Op de andere telefoon:* tik op de link (Android) of kopieer het bericht en plak het in
**Meer** → **In & uit** (iPhone). 3. Tik op **Werk … bij** (of **Voeg … toe aan je huishouden**). 4. Tik
op **Meer** → **Huishouden**.
Goed: 1. Het WhatsApp-bericht begint met "📈 Voortgang van <naam> — Level … · …" en eindigt met één
link. 2. Een kaart "Voortgang van <naam>" met "Level … · …", "🔥 … · … badges", "… kookdagen in de
laatste 30 dagen" en "gedeeld op <datum>". 3. "<naam> is bijgewerkt." 4. Onder de naam van de ander
staat "Level … · …" met "· bijgewerkt <datum>".

**100 — Kookkalender (6D-4).**
Doe: 1. Tik op **Meer** → **📅 Kookkalender**. 2. Tik op een dag met stipjes. 3. Tik op ‹ en weer op ›.
4. Lees de onderste regel.
Goed: 1. Een maandrooster ma–zo; dagen waarop iemand kookte hebben stipjes in de kleur van die persoon;
vandaag heeft een rand. 2. Eronder: "<naam> — <gerecht>" per kookbeurt; van iemand op een andere
telefoon staat er "een recept" als jij dat recept niet hebt. 3. De vorige maand en weer terug; een lege
maand zegt "Nog niets gekookt deze maand." 4. "Anderen zie je zoals ze het laatst deelden via Sync mijn
voortgang."

EN (zelfde nummers; in het Engelse deel van docs/DEVICE-TEST.md): 92 **XP and levels** — Tap a recipe → **✓
Cooked** → **Save** at the top; look top right (confetti, then a blue "+1xx" chip, sometimes gold with
"Cooked!"; then a sheet "🎉 Level 3!" with **Potato Peeler**). **More → Manage profiles**: "Level 3 · Potato
Peeler", bar, "… / 171 XP", "🔥 cooked today · … XP to level 4". **Home**: the same line under the
greeting; tapping it opens Profiles. Cook the same recipe again → confetti, no chip. 93 **Honest about 0
XP** — **✓ Cooked → Another date** two weeks back: "More than a week ago: counts for your badges and
the calendar, not for XP."; after Save no chip. Six different recipes in one day → after the sixth: "That's
plenty for today — XP again tomorrow." 98 **Unlocked** — **More → 🎁 Unlocked**: level bar on top, cards
Confetti, Timer sounds …, locks with "Level 5", "Level 7"; switch **Double confetti** off → the next
Cooked! shows the plain burst; **Try** at **Cowbell** plays it and **More → Settings**, heading **Cook mode &
timer**, lists
**Cowbell**; **Chalkboard** → the step card turns board-green with chalk letters. 99 **Sync my progress**
— **More → Manage profiles → Sync my progress → Share** → WhatsApp message starts "📈 <name>'s progress — Level …
· …" and ends with one link; other phone: tap (Android) or copy → **More → In & out** → paste (iPhone) →
card "<name>'s progress" with level, "🔥 … · … badges", "… cooking days in the last 30 days", "shared on
<date>"; **Update <name>** → "<name> was updated."; **Household** shows "Level … · …" with "· updated
<date>" under their name. 100 **Cooking calendar** — **More → 📅 Cooking calendar**: Mo–Su grid, dots in
member colours, today outlined; tap a day → "<name> — <dish>" ("a recipe" for a dish you do not have); ‹ ›
move months, empty month says "Nothing cooked this month yet."; bottom line "You see others as they last
shared with Sync my progress."

## 7. Controlelijst voor Fable (eindcontrole)

1. `grep -rn "Math.random" src/domain/xp.ts src/xp.ts` is leeg; `hash32('')` in een test = 2872998923.
2. De crit-test pint exact 94/505 én de marges; de 30-jaar-test eindigt op level 100 en de mediaan ligt
   onder 50 ms op Stijns pc (één keer handmatig draaien met `npx vitest run tests/xp.test.ts`).
3. Nergens een opgeslagen XP-totaal: `grep -rn "xp.total\|'xp.total'\|xpTotal" src/db` is leeg; alleen
   `xp.lastSeen` (weergave) en `xp.seenRulesVersion`.
4. `logCooked` schrijft `loggedAt`; een back-up van vóór 6D herstelt zonder fouten en zonder pops; na
   herstel klopt het level met de log (steekproef: tel de kookbeurten, vergelijk met `deriveXp`).
5. Badges uit → `document.querySelector('.xp-bar, .xp-pop, .xp-toast')` is null op Home, Profielen, Meer;
   de rij Vrijgespeeld ontbreekt; `settleXp` keert vroeg terug.
6. `data/levels.json`: 100 regels, anchors 2/6/10/15/20/25/30/40/50/60/70/80/90/100 exact zoals §2d;
   `npm run validate:data` meldt "100 levels" en "15 unlocks".
7. Elke i18n-key uit §1 bestaat in NL én EN (`hasKey`-steekproef in een test of met grep op `xp.`,
   `levelup.`, `unlocks.`, `progress.`, `calendar.`); geen Engelse tekst hardcoded in componenten.
8. `#x=`: `TOKEN_RE` in token.ts, router.ts, boot.ts, landing.ts bevat `x`; het bevroren token decodeert
   op beide engines en `encodeToken(FROZEN_ENVELOPE_X)` is byte-gelijk; de oude test gebruikt `z`.
9. Het `x`-payload bevat geen `note`, `stars`, `photos` (test "sleutels exact"), max 90 dagen, max 5 ids.
10. In & uit toont bij een eigen `#x=` "… is een profiel op deze telefoon" en slaat niets op; een vriend
    verschijnt in de kalenderlegenda en onder Huishouden → Vrienden, met Verwijder.
11. Overcooked! schudt niet onder `prefers-reduced-motion` (DevTools emulatie) en niet met Confetti uit.
12. De dag-/streaklogica gebruikt lokale kalenderdagen (`localDayIndex`), getest met een UTC-middernacht
    rond 00:30 lokale tijd (zelfde valkuil als badges.ts).
13. `npm run check`, `npm test`, `npm run build`, `npm run build:next` groen; de build-output bevat beide
    woff2-bestanden in de precache-manifest.
14. docs/DEVICE-TEST.md rijen 92–100 in NL én EN; STATUS.md bijgewerkt; ADR-regel voor sleutel `x` en
    voor de fonts.
15. Steekproef op de telefoon (Stijn): eerste kook op een vers `/next/`-profiel → "+1xx", "Level 3!",
    "Aardappelschiller"; zelfde recept nog eens → geen pop.

## 8. Open vragen voor Stijn

1. **Titels 61, 72 en 81** ("Pukka!", "Koelkastplunderaar", "Hell's Kitchen-overlever") zijn grappen op
   de drie chefs; ook de 100 tussentitels zijn mijn invulling. Goed zo, of wil je een lijst om zelf te
   schrappen/vervangen vóór 6D-1 bouwt? (Vervangen kost later niets: data/levels.json.)
2. **Tempo**: met streak komt level 20 na ±4 maanden dagelijks koken en level 100 na ±26 jaar
   (dagelijks met vakanties; wie af en toe een dag overslaat eindigt na 30 jaar rond level 95). Akkoord,
   of wil je dat trager (dan verlaag ik `cookFloor` of de ×2-trap — vóór 6D-1, want daarna is het een
   regelwijziging met melding)?
3. **Vrienden**: een onbekende afzender van "Sync mijn voortgang" kan "vriend" worden zonder lid van het
   huishouden te zijn (zichtbaar in de kalender en onder Huishouden → Vrienden). Is die tweedeling
   gewenst, of mag iedereen die je toevoegt gewoon lid zijn (dan vervalt "Bewaar als vriend")?
