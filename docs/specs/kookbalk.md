# Spec 13K — "Nu aan het koken"-balk (kookbalk)

Status: compleet (Fable, 22 okt 2026)
Gebouwd: 23 okt 2026 (blok 1, workflow wf_9aae1dc0-8e3)
Gebouwd: 23 okt 2026 (blok 2, workflow wf_4ee57980-28c)

Kritische lezer (Fable, 22 okt 2026): gelezen naast de acht andere specs (besluiten over specs heen in
docs/specs/README.md §2; bij tegenspraak wint README.md). Voor deze spec:
- DEVICE-TEST-rijen zijn definitief **72–74** (Home A+ heeft 70–71). De bestaande **rij 66** (NL+EN)
  beschrijft de oude timerbalk en wordt in blok 1 door de integrator aangepast: stap 4 "Tik bovenaan in de
  kookbalk op de rij **Afwasmachinezalm · stap 3 van 7**" / "In the cooking bar at the top, tap the row
  **Dishwasher salmon · step 3 of 7**"; goed 3 "Bovenaan staat 'Nu aan het koken' met de rij
  'Afwasmachinezalm · stap 3 van 7' en eronder de timerrij 'stap 3'" / "The top says 'Cooking now' with the
  row 'Dishwasher salmon · step 3 of 7' and the timer row 'step 3' under it".
- Blokverdeling (de feitencheck vond §3/§4 dubbelzinnig): **blok 1** = bouwer 1 + bouwer 2 + van bouwer 3
  alleen app.tsx, repo.ts (`DEVICE_LOCAL_SETTINGS`), CookScreen.tsx, StepView.tsx (de prop) en cooklog.ts.
  **Blok 2** = RecipeScreen `onTimerStart`, ShoppingScreen, `endCooking` bij de drie verwijderplekken,
  `reloadCooking` in StorageScreen, rij 74.
- CookScreen geeft `onTimerStart` **wél** mee: `onTimerStart={() => void touchCooking(recipe, page, chosen)}`
  (zelfde pagina, alleen `lastActiveAt` schuift), anders verloopt het slowcooker-voorbeeld uit §1a zodra
  de 8-uurstimer afloopt. §3 bouwer 3 is daarop aangepast.
- In de kookstand krijgen de timerrijen van `current` het korte label `cook.stepShort` ("stap 3"), niet
  genest (`.nested` alleen onder een receptrij); losse timers houden hun volledige `tm.label`.
- §6b check 7 (IndexedDB bewerken in devtools) vervalt: het vervallen wordt door tests/cooking.test.ts
  bewezen en op de telefoon door "een rij van gisteravond is 's ochtends weg" (rij 72 stap 5 blijft).
- 13D voegt later `variant?: VariantDiet | null` toe aan `CookingSession` en `&v=` aan `cookPath`
  (varianten-tabs.md blok 3); nu niets daarvan bouwen, `normalizeSessions` laat onbekende velden staan.
- 13F migreert `cook.sessions` niet (vangnet `getRecipe` in `loadCooking` schrapt een sessie op een
  omgezet u:-id; een sessie leeft hooguit 8 uur). Geen actie.
- 6C raakt ShoppingScreen.tsx ná dit blok (tabbladen); de balk staat direct onder de Header, boven de
  tabbladen van 6C.
- De twee open vragen voor Stijn blijven (Gekookt stopt lopende timers; 8 uur); standaard = zoals hier.

Feitencheck Opus, 22 okt 2026: 21 correcties (alleen feiten; ontwerpkeuzes onaangeroerd, "⚠ Feitencheck"
staat waar een keuze op een feit leunt dat anders is):
- §1b schets: de koprij heeft geen hoofdletters (`.timerbar-head-label` heeft geen `text-transform`).
- §1b: `pickText(session.name, lang.value)`; `pickText` (src/domain/model.ts) neemt een `Lang`, geen signal.
- §1b ⚠: elke timer krijgt nu een `recipeId` (StepView-chips, spraak); een timer zonder recept bestaat niet.
- §2/§3: domeinimport is `'./model.ts'` (met extensie, zoals de andere modules in src/domain/).
- §3 importrichting: ook EditScreen, RecipesScreen en StorageScreen importeren `@/cooking`; app.tsx
  importeert relatief (`./cooking`, zoals `./timers`).
- §3 bouwer 3: StorageScreen.tsx, EditScreen.tsx en RecipesScreen.tsx aan zijn bestandenlijst toegevoegd
  (de punten eronder gaven ze hem al).
- §3 ⚠: `now` (src/timers.ts) tikt alleen met een lopende timer of bij terugkeer naar de app.
- §3, §6b punt 8, §7 punt 11: print.css verbergt de balk alleen onder `html[data-print]` (Print-knop van de
  app via `printPage()`), niet bij een gewone browserprint.
- §3 ⚠: CookScreen is in app.tsx gekeyed op id (`<CookScreen key={id} …/>`): ander id = nieuwe mount.
- §3 en §6b punt 4 ⚠: Koken geeft altijd `?srv=` mee (RecipeScreen.tsx ±717) en `rememberedServings` is
  een Map in het geheugen; sessieporties gelden via Koken dus nooit.
- §3 verwijderplekken: de id heet `existing.id` in EditScreen en `r.id` in RecipesScreen.
- §5 ⚠: 360 px-rekensom: 5 gaps (niet 3) en `.nested` 12 px → 56 px voor het label, niet ≥ 60.
- §6b punt 7 ⚠: Chrome-devtools kan IndexedDB-waarden niet bewerken; `loadCooking` leest één keer.
- §6c rij 73 punt 4 (NL+EN): na Gekookt! ben je terug op Home (`goBack` = `history.back()`), niet op het recept.
- §6c rij 74 stap 3 ⚠: na de tab Boodschappen leidt "terug" niet naar het recept (`navigateTab` vervangt).
- §6c: "Bewaar" bovenaan het Gekookt-venster is `common.save`; `cooked.save` is de knop onderaan.
- §6c ⚠: bestaande DEVICE-TEST-rij 66 beschrijft de oude timerbalk en klopt na 13K niet meer.
- §3 importrichting: `src/cooking.ts` heeft voor het vangnet in `loadCooking()` ook `getRecipe` uit
  `@/db/repo` nodig (bestaat: `getRecipe(id: string): Promise<Recipe | undefined>`).
- §3 ⚠ `now`: ook −1/+1/↻ (`adjustTimer`, `resetTimer`) zetten `now`; §5 ⚠ 360 px: of "stap 12" past,
  hangt af van het lettertype (de eerdere zin "wordt afgekapt" was te stellig).
- §5 ⚠ (invariant 13, iPhone vs Android): volgens ADR-0001 is op Android alleen het geluid bewezen;
  meldingen zijn daar niet getest, dus "Android bewezen" klopt niet voor de melding-tik.

Bron: docs/phase-6-spec.md 13K (Stijn 16 okt: "nu zie ik een timer maar lijkt het alsof ik helemaal niet
aan het koken ben; ik moet dat recept weer fysiek zoeken"; twee recepten tegelijk moet kunnen) plus het
al gebouwde deel (tik op een timer → kookstand op die stap, `timerPath`/`?step=`). Bouwspec door Fable
(22 okt 2026) voor Opus 5.5; code gecontroleerd op 22 okt (TimerBar.tsx, timers.ts, CookScreen.tsx,
cooklog.ts, repo.ts, db.ts, browse.css, i18n/browse.ts). Alles wat een keuze is, staat hier gekozen;
bij twijfel §5.

## 1. Doel en gebruikersgedrag

**Idee in één zin:** zodra je in de kookstand op **Begin** tikt, ben je "aan het koken"; de app onthoudt
per recept bij welke stap je bent (ook na herstart) en toont dat bovenaan de hoofdschermen als één rij
per recept, met de timers van dat recept eronder. Tik op de rij = terug naar die stap. Twee recepten
tegelijk = twee rijen. De bestaande timerbalk wordt deze kookbalk; er komt geen tweede balk bij.

### 1a. Wanneer begint en eindigt "aan het koken" (gekozen)
- **Begint** bij **Begin** in de kookstand (pagina 0 → stap 1), en ook zodra je op een stap van de
  kookstand belandt via `?step=N` of een spraakcommando. Daarnaast begint het als je een **timer van een
  recept** start terwijl er nog geen sessie is: een ⏱-chip op de receptpagina (stap N → sessie bij stap N)
  of een spraaktimer op de Klaarzetten-pagina (sessie bij "klaarzetten", pagina 0). Een timer = je kookt.
- **Eindigt** (de rij verdwijnt, de timers van dát recept ook, lopend of klaar):
  1. **Gekookt!** op de laatste pagina van de kookstand (`onCooked`).
  2. **✓ Gekookt** op de receptpagina (CookedSheet → `recordCooked`) — alleen als de kookbeurt **vandaag**
     is (`isToday(input.at)`, dezelfde voorwaarde als het weekplan-vinkje); "gisteren" raakt de sessie niet.
  3. **×** op de rij in de balk. Dat kruisje staat er **alleen als geen timer van dat recept nog loopt**
     (geen timers, of alleen afgelopen timers: die gaan dan mee weg). Loopt er nog een timer, dan is er
     geen × op de rij: eerst de timer stoppen (× op de timerrij). Zo kan één tik nooit per ongeluk een
     oventimer van 40 minuten doden.
  4. **Vanzelf** na **8 uur zonder activiteit** (activiteit = een stapwissel in de kookstand of het starten
     van een timer van dat recept), en nooit zolang er nog een timer van dat recept loopt. Motivatie: een
     vergeten avondmaaltijd (18:00–20:00) is om 04:00 weg, dus 's ochtends is de balk leeg; een slowcooker-
     dag (stap 3 om 9:00, timer 8 uur) blijft staan omdat de timer loopt. Korter (bv. 3 uur) breekt stoof-
     en rijsrecepten; langer (12 uur) laat de maaltijd van gisteravond bij het ontbijt nog staan.
- Het recept verwijderen (eigen recept) eindigt de sessie ook (de rij zou anders naar niets wijzen).

### 1b. De balk (component blijft `TimerBar` in src/components/TimerBar.tsx)
Op 360 px, voorbeeld met twee recepten en één losse timer:

```
Nu aan het koken                                      🔔     ← koprij (12 px, bestaand; geen hoofdletters)
Afwasmachinezalm · stap 3 van 7                        ›     ← receptrij, 44 px, tikbaar
    stap 3                   4:32   −1   +1   ↻   ×          ← timerrij van dat recept (48 px)
Spaghetti Bolognese · stap 1 van 3                 ›   ×     ← receptrij zonder lopende timer
Losse timers                                                 ← alleen als er een losse timer is
    Eieren                   7:00   −1   +1   ↻   ×
```

- **Koprij**: de bestaande `.timerbar-head` met de 🔔/🔕-schakelaar (ongewijzigd). Het label is
  `cooking.title` zodra er minstens één sessie is, anders het bestaande `timer.title` ("Timers").
- **Receptrij** (`.timerbar-recipe`): één knop over de hele breedte: de naam (`pickText(session.name, lang.value)`,
  vet, afgekapt met …) gevolgd door ` · ` en `cooking.stepOf` of `cooking.prepare`, en rechts het › in
  cobalt (bestaande `.timerbar-chev`). Tik → `openTimerPath(cookPath(session))`: de kookstand van dat recept
  op die stap, met de gekozen porties (`?srv=`). Rechts van het › staat de × (`.timerbar-btn.x`, 44 px)
  alleen als `stoppable` (zie 1a punt 3); `aria-label`/`title` = `cooking.stop`.
- **Timerrij onder een recept**: dezelfde rij als nu (`.timerbar-row`: tijd, −1, +1, ↻, ×), maar het label
  is kort: `cook.stepShort` ("stap 3") als de timer een stap heeft, anders `cooking.timerNoStep`
  ("timer"). De naam van het recept staat niet meer naast de knoppen (dat was te krap). Het label blijft
  een knop naar die stap (bestaand `timer.openStep`), licht ingesprongen (`.timerbar-row.nested`).
- **Losse timers**: timers zonder `recipeId`, én timers met een `recipeId` waarvoor geen sessie bestaat
  (timers van vóór deze versie, of een randgeval): kop `cooking.loose` (`.timerbar-head-label`-stijl, geen
  knop) en daaronder de bestaande rijen met hun volledige label. Niets gaat verloren.
  ⚠ Feitencheck: vandaag geeft elke `startTimer`-aanroep een `recipeId` mee (alleen StepView.tsx
  `TimerChips` en de spraak-`case 'timer'` in CookScreen.tsx starten timers). Een timer zónder
  `recipeId` (zoals "Eieren" in de schets) kan nu dus niet ontstaan; in de praktijk vangt "Losse timers"
  alleen recepttimers zonder sessie.
- **Volgorde**: sessies op `startedAt` oplopend (wat je het eerst begon staat bovenaan; rijen springen niet);
  timers binnen een recept op `endAt`; losse timers onderaan.
- **Lege staat**: geen sessie en geen timer → de balk rendert `null` (zoals nu). Het eenmalige
  "Meldingen aanzetten?"-blok (`timerbar-ask`) blijft precies zoals het is.
- **In de kookstand zelf** (`<TimerBar current={id} />`): de rij van het recept dat je op dat scherm kookt
  wordt **niet** getoond (de kop "Stap 3 van 7" staat er al); zijn timers staan direct onder de koprij,
  met het korte label `cook.stepShort` ("stap 3"; `cooking.timerNoStep` zonder stap) en zonder `.nested`
  (er is geen receptrij om onder te hangen). Rijen van ándere recepten staan er wel: zo zie je tijdens het
  koken van de zalm dat de pannenkoeken bij stap 1 wachten.

### 1c. Schermen
De balk staat waar `<TimerBar />` nu staat — Home, Recepten, recept, Week, kookstand — **plus
Boodschappen** (ShoppingScreen.tsx, direct onder `<Header title={t('shop.title')} />`; ook in de
`?proto=1`-tussenstap). Niet op Meer en zijn subpagina's, niet in de editor, niet op Delen/In & uit.

### 1d. Kookstand opent weer op de onthouden stap (gekozen: direct, geen keuzevenster)
- Via de balk of een melding: `?step=N` zoals nu → direct die stap.
- Via **Koken** op de receptpagina (geen `?step=`) terwijl er een levende sessie is: de kookstand opent
  **direct op de onthouden stap** (ook pagina 0 = Klaarzetten als de sessie daar staat). Terug naar
  Klaarzetten kan altijd met ‹ Vorige of naar rechts vegen. Geen "Verder bij stap 3?"-venster: binnen 8 uur
  hetzelfde recept openen ís verdergaan, en de kop "Stap 3 van 7" zegt waar je bent.
- Elke stapwissel (tik, veeg, spraak, `?step=`) schrijft de stap weg; de Gekookt!-pagina schrijft niets
  (de sessie blijft op de laatste stap staan tot je op Gekookt! tikt of weggaat).

### 1e. Melding-tik en spraak
Ongewijzigd: de notificatie opent via `timerPath` de kookstand op de stap van de timer (sw.ts NAVIGATE).
Spraakcommando "timer N minuten" maakt (als het moet) de sessie aan, zie 1a.

### 1f. Teksten (nieuw, in src/i18n/browse.ts naast de `timer.*`-keys)
- `cooking.title` — NL "Nu aan het koken" · EN "Cooking now"
- `cooking.stepOf` — NL "stap {n} van {total}" · EN "step {n} of {total}"
- `cooking.prepare` — NL "klaarzetten" · EN "getting ready"
- `cooking.open` — NL "{name} — verder bij stap {n}" · EN "{name} — continue at step {n}" (aria-label rij)
- `cooking.openPrepare` — NL "{name} — naar klaarzetten" · EN "{name} — back to getting ready"
- `cooking.stop` — NL "Klaar met {name}" · EN "Done with {name}" (× op de rij; aria-label en title)
- `cooking.loose` — NL "Losse timers" · EN "Other timers"
- `cooking.timerNoStep` — NL "timer" · EN "timer"
Bestaand en hergebruikt: `timer.title`, `timer.openStep`, `timer.minus/plus/reset/stop`, `cook.stepShort`.

## 2. Datamodel en migraties

**Geen Dexie-wijziging** (blijft v7). De sessies zijn klein (hooguit een paar) en gaan in één settings-rij,
key **`cook.sessions`**, waarde `CookingSession[]`. Geen tabel: geen migratie, geen nummer-conflict met
de andere specs (v8 inbouwen, v9 varianten).

```ts
// src/domain/cooking.ts (framework-vrij; Node-testbaar)
import type { RunningTimer, Text } from './model.ts';

/** One recipe you are cooking right now. Lives in the settings row `cook.sessions`. */
export interface CookingSession {
  recipeId: string;
  /** Page as CookScreen counts it: 0 = Klaarzetten, 1..stepCount = that step. Never the Gekookt page. */
  page: number;
  /** Snapshot of the recipe name ({nl,en}; invariant 3) so the bar renders without a db read. */
  name: Text;
  stepCount: number;
  /** Servings chosen in cook mode (passed back as ?srv=); null = the recipe's own. */
  servings: number | null;
  /** Epoch ms. `lastActiveAt` moves on every step change and every timer start of this recipe. */
  startedAt: number;
  lastActiveAt: number;
}

export const COOKING_SETTING = 'cook.sessions';
/** A session without activity for this long, and without a running timer, is over. */
export const COOKING_EXPIRE_MS = 8 * 60 * 60_000;
```

Voorbeeld van de opgeslagen waarde:
```json
[{ "recipeId": "b:afwasmachinezalm", "page": 3, "name": { "nl": "Afwasmachinezalm",
   "en": "Dishwasher salmon" }, "stepCount": 7, "servings": 2,
   "startedAt": 1792694400000, "lastActiveAt": 1792695300000 }]
```
(`b:afwasmachinezalm` is de echte id, 7 stappen; Spaghetti Bolognese = `b:spaghetti-bolognese`, 3 stappen.)

**Back-up/herstel (src/db/repo.ts):** `cook.sessions` hoort bij deze telefoon, niet bij de persoon.
Voeg `'cook.sessions'` toe aan `DEVICE_LOCAL_SETTINGS` (regel ±1229: `new Set(['theme', 'backup.lastAt'])`),
zodat `importBundle` hem nooit overschrijft. `exportBundle` blijft zoals hij is (hij exporteert alle
settings behalve dataVersion; een meegenomen `cook.sessions` wordt bij herstel genegeerd, net als `theme`).
De `timers`-tabel zit al niet in de back-up: sessies en timers gedragen zich dus hetzelfde.
`resetEverything` wist de settings-tabel en daarmee de sessies: niets extra nodig.

**Deelformaat:** niet geraakt. Geen nieuw veld op `Recipe`, geen token-wijziging, geen nieuwe fixtures.

**Lezen is tolerant:** `normalizeSessions(v: unknown): CookingSession[]` laat alleen rijen door met
`recipeId: string`, `page` een geheel getal ≥ 0, `stepCount` geheel ≥ 0, `name` een object (ontbrekende
kant → ''), `startedAt`/`lastActiveAt` eindige getallen (ontbrekend `lastActiveAt` → `startedAt`),
`servings` een getal 1–24 anders `null`. Dubbele `recipeId` → de laatste wint. Eén rij per recept.

## 3. Bestandsverdeling en contracten

Importrichting (geen kringen): `src/domain/cooking.ts` importeert alleen `./model.ts` (domeinmodules
importeren elkaar met `.ts`-extensie, zoals src/domain/timers.ts). `src/cooking.ts`
importeert `@/domain/cooking`, `@/db/repo` (getSetting/setSetting, en `getRecipe` voor het vangnet in
`loadCooking`, zie bouwer 3), `@/timers` (timers, now, stopTimer).
**`src/timers.ts` importeert NOOIT `@/cooking`.** TimerBar, CookScreen, RecipeScreen, cooklog.ts,
EditScreen, RecipesScreen en StorageScreen importeren `@/cooking`; app.tsx importeert relatief
(`./cooking`, zoals `./timers`).

### Bouwer 1 — domein + store (nieuw: src/domain/cooking.ts, src/cooking.ts, tests/cooking.test.ts)

```ts
// src/domain/cooking.ts — pure functions, no preact/dexie
export function normalizeSessions(v: unknown): CookingSession[];
/** Upsert by recipeId (one row per recipe); keeps startedAt of an existing row. */
export function upsertSession(list: CookingSession[], s: CookingSession): CookingSession[];
/** True when `now > lastActiveAt + COOKING_EXPIRE_MS` and no timer of this recipe has endAt > now. */
export function isExpired(s: CookingSession, timers: readonly Pick<RunningTimer, 'recipeId' | 'endAt'>[],
  now: number): boolean;
export function pruneSessions(list: CookingSession[], timers: readonly Pick<RunningTimer, 'recipeId' | 'endAt'>[],
  now: number): CookingSession[];
/** '/cook/<id>' + '?step=<page>' when page ≥ 1 + ('&' or '?') 'srv=<n>' when servings is set. */
export function cookPath(s: Pick<CookingSession, 'recipeId' | 'page' | 'servings'>): string;

export interface BarRecipeGroup { kind: 'recipe'; session: CookingSession; timers: RunningTimer[];
  /** No timer of this recipe is still running (none, or all finished): the row may show ×. */
  stoppable: boolean; }
export interface BarLooseGroup { kind: 'loose'; timers: RunningTimer[] }
export interface BarModel {
  /** Timers of `currentId` (cook mode hides that recipe's own row); [] when no currentId. */
  current: RunningTimer[];
  groups: Array<BarRecipeGroup | BarLooseGroup>; // recipes by startedAt asc, loose group last (if any)
  hasSessions: boolean;
}
export function groupBar(sessions: readonly CookingSession[], timers: readonly RunningTimer[], now: number,
  currentId?: string | null): BarModel;
```
Regels voor `groupBar`: een timer hoort bij de groep van `timer.recipeId` als daar een sessie voor is;
anders (geen recipeId, of geen sessie) bij `loose`. Een sessie zonder timers krijgt een groep met
`timers: []`, `stoppable: true`. De groep van `currentId` komt niet in `groups` maar zijn timers in
`current`. Timers binnen een groep op `endAt` oplopend. `loose` ontbreekt als hij leeg is.

```ts
// src/cooking.ts — app-level store, same shape as src/step-amounts.ts + src/timers.ts
export const cookingSessions = signal<CookingSession[]>([]);
export const cookingLoaded = signal(false);
/** Reads cook.sessions once (idempotent), prunes expired rows (writes back when something went),
 *  and re-prunes on every visibilitychange → 'visible'. app.tsx calls it next to startTimerEngine(). */
export function loadCooking(): Promise<void>;
export function reloadCooking(): Promise<void>; // after a restore, like reloadShowAmounts
/** Upsert: creates the session (startedAt = now) or moves it to `page`; lastActiveAt = now. */
export function touchCooking(recipe: Pick<Recipe, 'id' | 'name' | 'steps'>, page: number,
  servings: number | null): Promise<void>;
/** Removes the session and stops EVERY timer of that recipe (stopTimer per id). No-op without session. */
export function endCooking(recipeId: string): Promise<void>;
export function sessionFor(recipeId: string): CookingSession | undefined; // from the signal, live
/** Derived: pruneSessions(cookingSessions, timers, now) — what the bar and CookScreen read. */
export const liveSessions: ReadonlySignal<CookingSession[]>;
```
`touchCooking` wacht eerst op `loadCooking()` (anders maakt een late `.then` de wijziging ongedaan,
zelfde valkuil als in step-amounts.ts) en schrijft met `setSetting(COOKING_SETTING, list)`.
`touchCooking` met `page > steps.length` (de Gekookt-pagina) doet niets.
⚠ Feitencheck: het `now`-signal in src/timers.ts loopt alleen zolang er een timer telt (`syncInterval`,
500 ms) en bij `visibilitychange` → `visible` (`tick()` in `startTimerEngine`). Zonder lopende timer is
`now.value` dus de tijd van de laatste tick; `liveSessions` herberekent het vervallen dan pas bij
terugkeer naar de app of bij een timerknop (`startTimer`, en +1/↻ via `adjustTimer`/`resetTimer`, die
`now` ook zetten).

### Bouwer 2 — de balk (bestaand: src/components/TimerBar.tsx, src/styles/browse.css, src/i18n/browse.ts)
- `TimerBar(props: { current?: string })`. Bovenin: `useEffect(() => { void startTimerEngine();
  void loadSoundSettings(); void loadCooking(); }, [])`. Leest `groupBar(liveSessions.value, timers.value,
  now.value, props.current)`. Rendert `null` als `!model.current.length && !model.groups.length && !ask`.
- Koplabel: `model.hasSessions ? t('cooking.title') : t('timer.title')`.
- Receptrij: `<div class="timerbar-recipe"><button class="timerbar-open timerbar-recipe-btn" aria-label=…
  onClick={() => openTimerPath(cookPath(session))}><span class="timerbar-label-text">{name}</span>
  <span class="timerbar-recipe-step">· {stepText}</span><span class="timerbar-chev">›</span></button>
  {stoppable && <button class="timerbar-btn x" aria-label={t('cooking.stop',{name})}
  onClick={() => void endCooking(id)}>×</button>}</div>`.
- Timerrij: de bestaande rij-JSX in een functie `TimerRow({ tm, at, label, nested })`, zodat `current`,
  recept-groepen (label kort, `nested`) en losse timers (label = `tm.label`) dezelfde rij gebruiken.
- CSS (achter `/* ---------- Timer bar ---------- */`): `.timerbar-recipe { display:flex; align-items:center;
  gap:6px; min-height:44px; }`, `.timerbar-recipe + .timerbar-recipe, .timerbar-row + .timerbar-recipe
  { border-top:1px solid var(--line); }`, `.timerbar-recipe-btn { flex:1; min-width:0; font-size:15px; }`,
  `.timerbar-recipe-step { flex:none; color: var(--muted); font-weight:500; white-space:nowrap; }`,
  `.timerbar-row.nested { padding-left:12px; }`, `.timerbar-row.nested .timerbar-label,
  .timerbar-row.nested .timerbar-open { font-weight:500; color: var(--muted); }`,
  `.timerbar-loose { font-size:12px; font-weight:700; color:var(--muted); padding:6px 0 0; }`.
  Donker thema volgt via tokens; print.css verbergt `.timerbar` al, maar alleen onder `@media print` én
  `html[data-print]` — dat attribuut zet `printPage()` (src/print.ts) via de Print-knop op het recept en
  op Boodschappen; een gewone browserprint (Ctrl+P) toont de balk wel.
- De acht i18n-keys uit §1f, NL én EN, naast `timer.soundOff`.

### Bouwer 3 — aanhaken (bestaand: CookScreen.tsx, RecipeScreen.tsx, StepView.tsx, cooklog.ts,
repo.ts, app.tsx, ShoppingScreen.tsx, en voor de punten hieronder ook StorageScreen.tsx, EditScreen.tsx,
RecipesScreen.tsx)
- **app.tsx**: na `void startTimerEngine();` → `void loadCooking();` (import `./cooking`: app.tsx
  importeert relatief, ook `./timers`).
- **repo.ts**: `DEVICE_LOCAL_SETTINGS = new Set(['theme', 'backup.lastAt', 'cook.sessions'])`; in de
  JSDoc van `importBundle` "reloadCooking" toevoegen aan de lijst mirrors; StorageScreen roept na een
  geslaagd herstel `reloadCooking()` aan waar het nu `reloadShowAmounts()`/`reloadSpeechSettings()` doet.
- **CookScreen.tsx**:
  1. `<TimerBar current={id} />` in plaats van `<TimerBar />`.
  2. Onthouden stap toepassen, één keer: `const applied = useRef(false);` + effect op
     `[loadedId, cookingLoaded.value]`: als `recipe` geladen, `stepParam === null`, `!applied.current`,
     `page === 0` en `sessionFor(id)` bestaat met `0 < s.page <= steps.length` → `applied.current = true;
     setPage(s.page)`; bestaat de sessie met `page 0`, dan ook `applied.current = true` (niets te doen).
     Als `?step=` wél aanwezig is, zet het bestaande `?step=`-effect `applied.current = true`.
     Reset `applied.current = false` in het bestaande `useEffect(..., [id])` dat `setPage(0)` doet.
     ⚠ Feitencheck: app.tsx rendert `<CookScreen key={id} id={id} />`; een ander id is dus een nieuwe
     mount met een verse ref. De reset is onschadelijk maar in de praktijk niet nodig.
     Porties: heeft de sessie `servings` en is er geen `?srv=` en geen `rememberedServings`, gebruik
     `s.servings` als startwaarde van `chosen` (CookScreen leest `sessionFor(id)` in de useState-init;
     is de store nog niet geladen, dan blijft het de bestaande volgorde — geen extra wachtlus).
     ⚠ Feitencheck: de Koken-knop op de receptpagina geeft altijd `?srv=${servings}` mee
     (RecipeScreen.tsx regel ±717, `navigate('/cook/' + id + '?srv=' + servings)` in template-vorm), en `rememberedServings` is
     een Map in het geheugen (src/components/ServingsPicker.tsx: weg na F5 of herstart). Via Koken geldt
     `s.servings` dus nooit: na een herstart opent Koken met de porties van de receptpagina (de eigen
     porties van het recept). Alleen de rij in de balk (`cookPath` met `&srv=`) brengt de sessieporties mee.
  3. Wegschrijven: effect op `[page, loadedId, servings]`: `if (recipe && page >= 1 && page <= steps.length)
     void touchCooking(recipe, page, chosen);` (pagina 0 en de Gekookt-pagina schrijven niets).
  4. Spraak `case 'timer'`: vóór `startTimer` → `void touchCooking(recipe, page <= steps.length ? page :
     steps.length, chosen)` (op Klaarzetten dus pagina 0).
  5. `onCooked`: na `markRecipeCookedInPlan` en vóór `goBack()` → `await endCooking(id)` in een eigen
     try/catch (console.error, nooit blokkerend).
- **StepView.tsx**: `TimerChips` en `StepView` krijgen een optionele prop `onTimerStart?: (stepIndex: number)
  => void`, aangeroepen direct na `void startTimer({...})` in de chip-onClick. CookScreen geeft hem **wél**
  mee: `onTimerStart={() => void touchCooking(recipe, page, chosen)}` (zelfde pagina; alleen `lastActiveAt`
  schuift, zodat een lange timer de sessie levend houdt — kritische lezer). **RecipeScreen.tsx** geeft bij
  regel ±814 mee (blok 2):
  `onTimerStart={(i) => void touchCooking(recipe, i + 1, servings)}` — maar alleen als er nog geen sessie
  is óf de sessie op een lagere stap staat (`!s || s.page < i + 1`), anders alleen `lastActiveAt` bumpen
  via `touchCooking(recipe, s.page, servings)`. Een timer bij stap 2 mag je dus niet terugzetten van stap 5.
- **cooklog.ts** `recordCooked`: in het bestaande `if (isToday(input.at)) { … }`-blok na het weekplan-vinkje
  → `try { await endCooking(input.recipeId); } catch (e) { console.error('endCooking', e); }`.
- **Recept verwijderd**: repo.ts mag `@/cooking` niet importeren (richting is UI → repo), dus de drie
  aanroepers van `deleteUserRecipe(` doen het: RecipeScreen.tsx (±regel 432), EditScreen.tsx (±671) en
  RecipesScreen.tsx (±461, in de lus per recept) → direct erna `void endCooking(<id>)`, met de id zoals
  die daar heet: `id` in RecipeScreen, `existing.id` in EditScreen (`remove()`), `r.id` in RecipesScreen
  (`deleteSelected`, `for (const r of own)`). Vangnet in
  `loadCooking()`: per sessie `getRecipe(recipeId)`; is het recept weg, dan wordt de sessie geschrapt
  (dekt herstel, reset en toekomstige verwijderpaden).
- **ShoppingScreen.tsx**: `<TimerBar />` direct onder de Header (import toevoegen).

### Integrator
Zet alles samen, `npm run check`, `npm test`, `npm run build`, `npm run build:next`; test in de dev-app
op 375 px de acceptatiechecks van §6; voegt de DEVICE-TEST-rijen toe (NL + EN) en een STATUS.md-regel.

## 4. Stappenplan

**Blok 1 — kookbalk compleet** (één Opus-workflow: bouwers 1, 2, 3 parallel → integrator → Haiku-gate).
Omvat alles uit §3 behalve de receptpagina-chips en Boodschappen. Klaar als: Begin in de kookstand maakt
een rij; stapwissel verandert "stap N van M"; Home/Recepten/recept/Week tonen de balk met rijen; tik op
een rij opent de kookstand op die stap met de porties; × op een rij zonder lopende timer haalt hem weg;
Gekookt! (kookstand) en ✓ Gekookt (vandaag) halen hem weg met zijn timers; de app herstarten houdt de
rij en de stap; na 8 uur stilte is hij weg; losse timers staan onder "Losse timers"; `check`, `test`,
`build`, `build:next` groen. **Geen vlag nodig**: zonder sessie gedraagt de balk zich precies als
vandaag. Eerst op **/next/** (één kookavond, DEVICE-TEST rijen 72–73), daarna `main`.

**Blok 2 — randen** (klein; Haiku-formaat na blok 1): ⏱-chip op de receptpagina maakt/bumpt de sessie
(`onTimerStart`), `<TimerBar />` op Boodschappen, `endCooking` bij de drie verwijderplekken,
`reloadCooking` na herstel, DEVICE-TEST rij 74, STATUS.md. Klaar als: een timer vanaf de receptpagina
geeft een rij "… · stap N van M"; de balk staat op Boodschappen; een verwijderd recept laat geen rij
achter. Direct naar `main` (geen nieuw risico).

Mag blok 1 te zwaar blijken voor één run: splits bouwer 3 af als blok 1b (de store en de balk zijn zonder
CookScreen-aanhaak al onschuldig: er ontstaan dan nog geen sessies).

## 5. Regels en eerlijkheid

**Invarianten die geraakt worden**
- 1 (ids): de sessie wijst met `recipeId` naar een recept; ids veranderen niet. Bij 13F (id-migratie van
  ingebouwde recepten) hoeft `cook.sessions` niet gemigreerd te worden: een sessie leeft hooguit 8 uur,
  en het vangnet in `loadCooking` schrapt een sessie waarvan het recept niet meer bestaat.
- 3 ({nl,en}): `session.name` is een `Text`-snapshot; de balk kiest met `pickText(name, lang)`. Geen
  eentalige string. Wordt het recept hernoemd tijdens het koken, dan toont de rij de oude naam tot de
  volgende `touchCooking` (die het snapshot ververst) — aanvaard.
- 4 (deeltoken): niet geraakt. 8 (`persist()`): ongewijzigd. 12 (db-naam per kanaal): de settings-rij
  leeft per database, dus /next/ heeft zijn eigen sessies.
- 13 (timers beloven niets onbewezens): de kookbalk zegt alleen wat de app zelf weet (de stap waar je was
  en de wandkloktijd van de timers). Hij belooft niet dat de telefoon je roept: dat blijft de melding, met
  de bestaande eerlijkheid uit ADR-0001 (Android bewezen; iPhone (a)/(b)/(c) nog "pending").
  ⚠ Feitencheck: ADR-0001 (rij 11, rij 13 en "Timer behaviour Android") legt op Android alleen het
  geluid vast: (a) voorgrond en (c) achtergrond geven geluid, (b) vergrendeld is niet genoteerd,
  meldingen zijn niet getest ("notification permission not granted (untested)") en de 10-minutentimer
  op de achtergrond (rij 13) staat nog open. "Android bewezen" geldt dus voor het geluid, niet voor de
  melding of de melding-tik.
- 14 (geen backend): alles lokaal in de settings-rij.
- Huisregels: 44 px tikdoelen (receptrij 44 px, × 44 px), 16 px-regel geldt alleen voor inputs (geen
  input in de balk), alles werkt op 360 px (meetbaar: 4 knoppen × 44 + 3 × 6 + tijd 62 + marges laat voor
  "stap 3" ≥ 60 px over).
  ⚠ Feitencheck: een timerrij heeft 6 flex-kinderen (label, tijd, −1, +1, ↻, ×) en dus 5 gaps van 6 px
  (30 px), niet 3. Rekensom op 360 px: 360 − 2 × 12 (padding `.timerbar`) − 12 (`.nested`) − 176 − 62 −
  30 = **56 px** voor het label (tekst + 2 px gap + › + 4 px padding van `.timerbar-open`), niet ≥ 60.
  "stap 3" past; of "stap 12" nog heel past, hangt af van het lettertype van de telefoon (het scheelt
  een paar pixels).

**iPhone vs Android**: geen verschil in gedrag. De melding-tik werkt alleen waar meldingen werken
(Android bewezen; iPhone pending in ADR-0001) — de balk zelf is op beide gelijk en is op de iPhone juist
de enige weg terug naar de stap. Wake lock, geluid en trillen: ongewijzigd.
⚠ Feitencheck: "Android bewezen" voor de melding-tik staat niet in ADR-0001; daar zijn meldingen op
Android niet getest (zie de ⚠ bij invariant 13 hierboven).

**Ruimte op het scherm (eerlijk benoemd)**: twee recepten met elk één timer kosten ±220 px bovenaan Home.
Dat is wat Stijn vraagt ("twee recepten tegelijk"); de rijen zijn zo compact als 44 px toelaat. Een
inklapbare balk is bewust niet ontworpen (extra staat, extra tikken); als het in de praktijk stoort, is
dat een idee voor docs/IDEAS.md, geen onderdeel van dit blok.

**Gekookt stopt de timers van dat recept**: "Gekookt" betekent "klaar met dit gerecht"; wat er nog van
in de balk stond, verdwijnt. Wie een rusttimer nog nodig heeft, tikt nog niet op Gekookt! (de knop
ernaast heet niet voor niets "Nog niet klaar").

**Opus mag dit NIET zelf beslissen** (zo doen als hier staat, anders vragen aan Stijn/Fable):
1. De vervaltijd (8 uur na laatste activiteit; nooit zolang een timer van dat recept loopt).
2. Het begin van een sessie (Begin/stapwissel in de kookstand; een recepttimer) en de vier eindes (§1a).
3. De × op de receptrij alleen zonder lopende timer; géén bevestigingsvenster, géén snackbar met Ongedaan.
4. Kookstand opent direct op de onthouden stap; geen "Verder bij stap 3?"-venster.
5. Opslag als settings-rij `cook.sessions` (geen Dexie-versie, geen tabel), device-local in de back-up.
6. De rij van het huidige recept wordt in de kookstand verborgen; zijn timers blijven zichtbaar.
7. `src/timers.ts` importeert `@/cooking` niet; `RunningTimer` krijgt geen nieuw veld; timerlabels worden
   niet geparseerd om een receptnaam terug te vinden.
8. Volgorde van de rijen (startedAt oplopend) en de plek van "Losse timers" (onderaan).
9. De schermen (Home, Recepten, recept, Week, Boodschappen, kookstand) en de letterlijke teksten uit §1f.
10. Geen nieuwe npm-dependency (er is er geen nodig); geen nieuwe route; `cook.sessions` niet in het
    deelformaat of in `ShareEvent`.

## 6. Testplan

### 6a. Unit tests — nieuw bestand tests/cooking.test.ts (importeert alleen ../src/domain/cooking en model)
Hulpjes: `const H = 3_600_000; const T0 = 1_792_694_400_000;` en een `mk(over)`-fabriek voor sessies en
timers (`{ id:'t:1', recipeId:'b:afwasmachinezalm', stepIndex:2, label:'…', endAt, durationMs, createdAt }`).
- `normalizeSessions`: `undefined`/`null`/`'x'`/`{}` → `[]`; een geldige rij komt ongeschonden terug;
  ontbrekende `lastActiveAt` → `startedAt`; `page: -1`, `page: 1.5`, `recipeId: 7` → rij weg;
  `servings: 0`/`30`/`'4'` → `null`; `name: { nl: 'A' }` → `{ nl:'A', en:'' }`; twee rijen met dezelfde
  `recipeId` → één (de laatste).
- `upsertSession`: nieuw → toegevoegd achteraan; bestaand → `page`, `lastActiveAt`, `name`, `stepCount`,
  `servings` vervangen maar `startedAt` van de oude rij behouden; volgorde van de andere rijen gelijk.
- `isExpired` / `pruneSessions`: `lastActiveAt = T0`, geen timers: `now = T0 + 8H - 1` → blijft,
  `now = T0 + 8H + 1` → weg; `now = T0 + 9H` maar een timer van dat recept met `endAt = T0 + 10H` → blijft;
  dezelfde timer afgelopen (`endAt = T0 + 8H + 30 min`, `now = T0 + 9H`) → weg; een lopende timer van een
  ánder recept redt de sessie niet; `pruneSessions` houdt de volgorde.
- `cookPath`: `{ recipeId:'b:x', page:3, servings:null }` → `'/cook/b:x?step=3'`;
  `page:0, servings:2` → `'/cook/b:x?srv=2'`; `page:3, servings:6` → `'/cook/b:x?step=3&srv=6'`;
  `page:0, servings:null` → `'/cook/b:x'`.
- `groupBar`: (1) twee sessies (startedAt T0+1H en T0) en drie timers (twee van de eerste, één zonder
  recipeId) → `groups[0]` is de sessie met startedAt T0, `groups[1]` de andere met twee timers op `endAt`
  oplopend, `groups[2]` `kind:'loose'` met één timer; `hasSessions` true. (2) `stoppable`: sessie zonder
  timers → true; met een lopende timer → false; met alleen een afgelopen timer → true. (3) een timer met
  `recipeId:'b:onbekend'` zonder sessie → in `loose`. (4) `currentId` = eerste sessie → niet in `groups`,
  zijn timers in `current`; `currentId` zonder sessie → `current: []`. (5) geen sessies, geen timers →
  `groups: []`, `hasSessions: false`, geen `loose`-groep. (6) geen sessies, één losse timer → alleen
  `loose`, `hasSessions: false` (de balk toont dan "Timers").

### 6b. Acceptatiechecks in de dev-app (npm run dev, 375 px, Chrome devtools, NL en EN)
1. Afwasmachinezalm → Koken → Begin → Home: koprij "Nu aan het koken", rij "Afwasmachinezalm · stap 1
   van 7 ›" met een × (geen timer). Tik op de rij → kookstand op stap 1, URL zonder `?step=`.
2. Ga naar stap 3, tik ⏱ 5 min → Home: onder de rij een timerrij "stap 3  4:5x −1 +1 ↻ ×"; de × op de
   receptrij is weg. Tik op "stap 3" → kookstand stap 3. In de kookstand: geen eigen receptrij, wel de
   timerrij onder de kop.
3. Open Spaghetti Bolognese → Koken → Begin → Home: twee rijen, zalm boven (eerder begonnen), spaghetti
   eronder met ×. Tik × bij spaghetti → rij weg; de zalm-rij blijft.
4. Herlaad de pagina (F5) → de zalm-rij staat er nog met dezelfde stap; Recept → Koken opent direct op
   stap 3 (met dezelfde porties als gekozen).
   ⚠ Feitencheck: na F5 is `rememberedServings` leeg (Map in het geheugen) en Koken geeft altijd
   `?srv=<porties van de receptpagina>` mee; "dezelfde porties" klopt via Koken dus alleen als je de
   standaardporties koos. Via een tik op de rij in de balk (`&srv=`) kloppen ze wel.
5. Tik in de timerrij × (timer weg) → de receptrij krijgt weer een ×. Ga naar de laatste pagina →
   Gekookt! → terug op het recept: balk leeg (geen koprij).
6. Spraaktimer is op de pc niet testbaar; wel: op het recept (niet in de kookstand) ⏱ 15 min bij stap 4
   → Home toont "Afwasmachinezalm · stap 4 van 7" met de timer eronder (blok 2).
7. (Vervallen, kritische lezer.) Het vervallen na 8 uur is in de dev-app niet na te spelen (het
   Application-paneel van Chrome kan een IndexedDB-waarde niet bewerken en `loadCooking()` leest één keer).
   Het wordt bewezen door tests/cooking.test.ts (`isExpired`/`pruneSessions`, §6a) en op de telefoon door
   rij 72 stap 5 plus "een rij van gisteravond is de volgende ochtend weg".
8. Boodschappen toont de balk (blok 2); Meer niet. Donker thema: lees de balk na; print-preview: geen balk.
   ⚠ Feitencheck: alleen via de Print-knop van de app (`printPage()` zet `html[data-print]`); een gewone
   Ctrl+P-preview toont de balk wel (print.css werkt alleen met dat attribuut).

### 6c. DEVICE-TEST-rijen (definitief 72–74; in beide taalsecties als één tabelrij per nummer met de
kolommen nummer · wat je doet · goed als; rij 72–73 bij blok 1, rij 74 bij blok 2)

Rij 72 — NL: **Kookbalk: je ziet waar je bent (13K).** 1. Open **Afwasmachinezalm**. Tik op **Koken**
en op **Begin**. Ga naar stap 3. 2. Tik onderaan op **Home**. 3. Tik bovenaan op de rij
**Afwasmachinezalm · stap 3 van 7**. 4. Tik op **⏱ 5 min**. Tik onderaan op **Recepten**. 5. Sluit de
app helemaal af en open hem opnieuw. 6. Open **Afwasmachinezalm** en tik op **Koken**. | Goed als:
2. Bovenaan staat "Nu aan het koken" met de rij "Afwasmachinezalm · stap 3 van 7" en een › rechts.
3. Je bent terug in de kookstand op stap 3. 4. Onder de rij staat een timerrij "stap 3" met de tijd en
−1 +1 ↻ ×; de rij zelf heeft geen ×. 5. De rij en de timer staan er nog. 6. De kookstand opent meteen
op stap 3, niet op Klaarzetten.
Rij 72 — EN: **Cooking bar: you can see where you are (13K).** 1. Open **Dishwasher salmon**. Tap
**Cook** and **Start**. Go to step 3. 2. Tap **Home** at the bottom. 3. At the top, tap the row
**Dishwasher salmon · step 3 of 7**. 4. Tap **⏱ 5 min**. Tap **Recipes** at the bottom. 5. Close the app
completely and open it again. 6. Open **Dishwasher salmon** and tap **Cook**. | Good when: 2. The top
says "Cooking now" with the row "Dishwasher salmon · step 3 of 7" and a › on the right. 3. You are back
in cook mode on step 3. 4. Under the row there is a timer row "step 3" with the time and −1 +1 ↻ ×; the
row itself has no ×. 5. The row and the timer are still there. 6. Cook mode opens straight on step 3,
not on Get ready.

Rij 73 — NL: **Kookbalk: twee recepten, klaar met koken (13K).** 1. Open **Spaghetti Bolognese**. Tik op
**Koken** en op **Begin**. Tik onderaan op **Home**. 2. Tik bij de rij van de spaghetti op **×**. 3. Tik
bij de timer van de zalm op **×**. 4. Tik op de rij van de zalm. Ga door naar de laatste pagina en tik
op **Gekookt!**. | Goed als: 1. Twee rijen: de zalm boven, "Spaghetti Bolognese · stap 1 van 3" eronder
met een ×. 2. De spaghetti-rij is weg; de zalm blijft. 3. De timer is weg; de zalm-rij heeft een × (die
stond er misschien al, als de timer van rij 72 al was afgelopen). 4. Na Gekookt! sta je weer op Home en is
de balk helemaal weg.
Rij 73 — EN: **Cooking bar: two recipes, done cooking (13K).** 1. Open **Spaghetti Bolognese**. Tap
**Cook** and **Start**. Tap **Home** at the bottom. 2. Tap **×** on the spaghetti row. 3. Tap **×** on the
salmon's timer. 4. Tap the salmon row. Go on to the last page and tap **Cooked!**. | Good when: 1. Two
rows: the salmon on top, "Spaghetti Bolognese · step 1 of 3" under it with a ×. 2. The spaghetti row is
gone; the salmon stays. 3. The timer is gone; the salmon row has a × (it may have been there already if
the timer from row 72 had finished). 4. After Cooked! you are back on Home and the bar is gone completely.
⚠ Feitencheck (rij 73, NL en EN, punt 4): `onCooked` eindigt met `goBack()` = `history.back()`
(src/router.ts). In stap 4 open je de kookstand met een tik op de rij op Home (`openTimerPath` pusht), dus
na Gekookt! kom je terug op Home, niet op het recept. Het "goed als" is daarop aangepast.

Rij 74 — NL: **Kookbalk: timer vanaf het recept, ✓ Gekookt (13K, blok 2).** 1. Open **Afwasmachinezalm**
(niet Koken). Scrol naar stap 4 en tik op **⏱ 15 min**. 2. Tik onderaan op **Boodschappen**. 3. Ga terug
naar het recept en tik op **✓ Gekookt** → **Vandaag** → bovenaan **Bewaar**. | Goed als: 1. Bovenaan
verschijnt "Afwasmachinezalm · stap 4 van 7" met de timer eronder. 2. Ook op Boodschappen staat de balk.
3. De rij én de timer zijn weg.
Rij 74 — EN: **Cooking bar: a timer from the recipe page, ✓ Cooked (13K, block 2).** 1. Open
**Dishwasher salmon** (not Cook). Scroll to step 4 and tap **⏱ 15 min**. 2. Tap **Shopping** at the
bottom. 3. Go back to the recipe and tap **✓ Cooked** → **Today** → **Save** at the top. | Good when:
1. The top shows "Dishwasher salmon · step 4 of 7" with the timer under it. 2. The bar is on Shopping
too. 3. The row and the timer are both gone.
⚠ Feitencheck (rij 74, NL en EN, stap 3): een tik op de tab Boodschappen vervangt het recept in de
geschiedenis (`navigateTab` doet `replace` behalve bij de eerste stap weg van Home), dus "terug" komt
niet op het recept uit. De tester moet het recept opnieuw openen (bv. via Recepten); de zin zegt nu niet
waar je tikt.

Gecontroleerd op 22 okt: Afwasmachinezalm heeft 7 stappen, stap 3 een chip "5 min", stap 4 "15 min"
(een kwartier); Spaghetti Bolognese 3 stappen; CookedSheet kent `cooked.today` "Vandaag"/"Today" en
"Bewaar"/"Save" bovenaan (dat is `common.save` in de `.sheet-head.with-actions`; `cooked.save` is de
knop onderaan, zelfde tekst). De bouwer kijkt dit na als data/recipes.json intussen veranderd is.
Rij 66 (NL en EN) beschrijft de oude balk ("Tik bovenaan in de timerbalk op de naam van de timer"; "de
timerbalk met 'Afwasmachinezalm · stap 3' en een › erachter"). De integrator van blok 1 past rij 66 aan
zoals de kritische lezer bovenaan deze spec voorschrijft (stap 4 → de receptrij "Afwasmachinezalm · stap 3
van 7"; goed 3 → "Nu aan het koken" met die rij en de timerrij "stap 3" eronder).

## 7. Controlelijst voor Fable (eindcontrole)

1. `src/timers.ts` importeert `@/cooking` niet; `RunningTimer` is ongewijzigd; nergens wordt een
   timerlabel geparseerd (Grep op `split(' · ')` en `label.split` in src/ levert niets nieuws op).
2. `cook.sessions` staat in `DEVICE_LOCAL_SETTINGS`; `BackupBundle` en `exportBundle` zijn niet veranderd;
   `db.ts` staat nog op `version(7)`; tests/token.test.ts en fixtures onaangeroerd.
3. `touchCooking` wacht op `loadCooking()` vóór het schrijven (geen late-`.then`-overschrijving); de
   Gekookt-pagina (page === last) schrijft niets; pagina 0 schrijft alleen via een spraaktimer.
4. `isExpired`: 8 uur na `lastActiveAt` én geen lopende timer van dat recept; getest met de drie
   gevallen uit §6 (net ervoor, net erna, erna-maar-timer-loopt).
5. De receptrij-× staat er niet zolang `timers.some(t => t.endAt > now)` voor dat recept; `endCooking`
   roept `stopTimer` aan voor elke timer van het recept (ook afgelopen) en sluit zo de meldingen.
6. `onCooked` roept `endCooking` aan vóór `goBack()`, in een eigen try/catch; `recordCooked` alleen binnen
   `isToday(input.at)`.
7. In de kookstand ontbreekt de rij van `current`, maar zijn timers staan onder de koprij; op Home staat
   dezelfde rij wél, met "stap N van M" gelijk aan de kop in de kookstand.
8. Tik op de rij: `openTimerPath(cookPath(s))` → `/cook/<id>?step=N&srv=S`; op dezelfde kookstand een
   `replace` (geen extra terug-stap); CookScreen laat `?step=` daarna uit de URL vallen (bestaand gedrag).
9. Koken-knop op het recept zonder `?step=` opent op de onthouden stap, precies één keer per bezoek
   (`applied`-ref); na `setPage(0)` bij een ander id wordt de ref gereset.
10. Alle acht `cooking.*`-keys bestaan in NL en EN; `t('cooking.stop', { name })` interpoleert de naam;
    aria-labels op de receptrij (`cooking.open`/`cooking.openPrepare`) en op de × zijn gezet.
11. 360 px: receptrij één regel (naam afgekapt, steptekst heel), timerrij toont "stap 3" + tijd + vier
    knoppen zonder overloop; donker thema leesbaar (alleen tokens gebruikt); de Print-knop van de app
    (`printPage`, `html[data-print]`) verbergt de balk.
12. Losse timers (zonder recipeId én met recipeId zonder sessie) staan onder "Losse timers" met hun
    volledige label; een oude timer uit de `timers`-tabel van vóór deze versie raakt niet kwijt.
13. ShoppingScreen toont de balk (ook bij `?proto=1`); Meer/editor/Delen/In & uit niet.
14. DEVICE-TEST rijen 72–74 in NL én EN, hernummerd in bouwvolgorde over alle specs; STATUS.md noemt
    13K als gebouwd en verwijst naar deze spec.

## 8. Open vragen voor Stijn

1. **Gekookt stopt ook de nog lopende timers van dat recept** (§5). Fable kiest dit omdat "Gekookt" =
   "klaar met dit gerecht" en omdat een rij zonder sessie anders weer een "zwevende" timer zou geven.
   Alternatief: timers laten lopen onder "Losse timers". Zeg het als je dat liever hebt; de bouw verandert
   dan alleen in `endCooking` (één parameter).
2. **8 uur** als vervaltijd — akkoord, of liever 6 of 12? (Alleen de constante `COOKING_EXPIRE_MS`.)
Geen andere open punten: alles overige is in deze spec gekozen.
