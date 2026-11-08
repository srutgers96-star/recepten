# Spec V2 — Delen zonder bestanden, en de afzender met avatar (Stijn, 8 nov 2026)

Status: in aanbouw (Fable, 8 nov 2026). Eén blok, vier bouwers + integrator (lichte modus). Bron: docs/IDEAS.md ideeën 12 en 13
(Stijn 8 nov: "daar moet een structurele oplossing voor komen"; "misschien een bericht bij de json, of de titel"; "avatar en level
kunnen net zo goed mee"). Leidend bij tegenspraak: docs/specs/README.md §2–§4, CLAUDE.md (invariant 4: deelformaat is een
contract, onbekende sleutels blijven; invariant 9: `navigator.share` met precies één veld; invariant 5: iPhone = kopiëren →
plakken), docs/specs/handbook.md §4.

**Kritische lezer (Fable, vooraf).** (1) De oorzaak van Stijns bestandsprobleem is de grens van 3.500 tekens in `planMessages`:
drie of vier recepten zijn al te veel, dus bijna elke delta van Gabi wordt een bestand. De lijst-link gebruikt sinds 13c 20.000
tekens zonder klachten; dezelfde grens voor recepten maakt bestanden zeldzaam. (2) Meerdere berichten in plaats van één: elk deel
is op zichzelf leesbaar en plakbaar (eigen kop, eigen open-regel, eigen links), en elk recept zit in precies één deel; de ontvanger
plakt op de iPhone deel voor deel, op Android tikt hij per bericht. (3) Een bericht mét een bestand kan niet (invariant 9), dus de
uitleg zit in de bestandsnaam en in een losse tweede deelactie. (4) De avatar gaat NIET in de receptcode (QR-ruimte, en een halve
code is tegen invariant 4): de ontvanger herkent de afzender in zijn huishouden en toont diens avatar; een optioneel `byId` maakt
die koppeling robuust tegen een naamsverandering, en een oude app negeert de sleutel. (5) De voortgangskaart reist al met avatar en
level; alleen de ontvangkant moet ze gebruiken.

**Feitencheck (Fable, in de code).** `planMessages(envelopes, appUrl, opts)` (src/domain/share.ts ±1013) bouwt één tekst en geeft
boven `limit` (`DEFAULT_MESSAGE_LIMIT = 3500`) een `{ file: { name, json }, reason: 'too-large' }`; `MessagePlan = { text; tokens;
chars } | { file; reason }`; `bundleFileName(name, date)` = `recepten-<slug>-YYYY-MM-DD.json`; `buildMultiShareHeader(count, by,
lang)` = "🍲 3 recepten van Gabi"; `openLine(lang)`. Gebruikers: DeltaShareScreen (`shareText(plan.text)` / `shareJsonFile`,
`MessageExample` toont de kop en de eerste link + "nog n"), RecipesScreen (selectie delen: regel ±340–396, ook `bundleFileName(by
|| 'selectie')` voor Exporteer). `share-actions.ts`: `shareText`, `copyText`, `shareJsonFile`, `downloadBlob`. Envelop: `by?: string`
via `baseEnvelope(t, by)`, `ShareContext { by: string; … }`. Inbox: `memberByName(householdMembers, plan.by)` bestaat al voor
weekplannen (regel ±699) en voor gebeurtenissen (±918); `PASTE_FILE_ACCEPT`-knop **Kies bestand** regel ±738; `isAndroid` uit
`@/pwa`. Voortgang: `applyProgressCard` (HouseholdScreen.tsx ±261) → `applyMemberCard(card)` voor een bekend lid; `ProgressCard`
heeft `avatar?`, `level`, `xp`. Kalender: legenda met `.cal-legend-dot` (12 px rondje, xp.css ±649) per persoon; `Avatar`
(ProfilesScreen.tsx) tekent 36 px, `.avatar` override per plek mogelijk. Bevroren tokens: tests/token.test.ts (45 tests,
`FROZEN_ENVELOPE_*`). Handboek 05 heeft rijen "Te groot voor één bericht: een bestand" (±151) en "Deel meerdere recepten" (±188).

## 1. Gedrag

### 1a. Berichten in delen, bestand als laatste redmiddel (bouwer A: domein)

- `RECIPE_LINK_MESSAGE_LIMIT = 20_000` vervangt `DEFAULT_MESSAGE_LIMIT = 3500` als standaard in `planMessages` (de oude constante
  mag blijven bestaan voor wie hem nog importeert, met commentaar; `opts.limit` blijft werken).
- `MessagePlan` wordt `{ parts: string[]; tokens: number; chars: number } | { file: { name: string; json: string }; reason:
  'too-large' }`. `parts.length === 1` is het gewone geval en levert exact de tekst van nu. Boven de grens worden de enveloppen
  **gretig verdeeld** over zoveel mogelijk gevulde delen: envelop voor envelop toevoegen zolang het deel (kop + open-regel + links)
  onder de grens blijft; elk recept/patch/plan/kaartje/lijst zit in precies één deel, in de oorspronkelijke volgorde.
  Kop per deel: `buildMultiShareHeader(countInPart, by, lang, { part: i, parts: n })` → NL "🍲 3 recepten van Gabi (deel 1 van 2)" ·
  EN "🍲 3 recipes from Gabi (part 1 of 2)"; bij één deel geen toevoeging. Past één envelop op zichzelf niet onder de grens, dan
  (en alleen dan) het bestand zoals nu.
- `bundleFileName(name, date, lang)` wordt leesbaar en draagt de uitleg: NL `Recepten van Gabi 8 nov - open via Delen in Rutgers
  Recepten.json` · EN `Recipes from Gabi 8 Nov - open via Share in Rutgers Recepten.json` (datum kort zonder punt; alleen letters,
  cijfers, spaties, koppelteken en punt; `name` leeg → "Recepten 8 nov - …"). De bestaande `fileSlug` blijft voor andere gebruikers.
- Nieuw `buildFileHintMessage(lang)`: NL "Het bestand hierboven is voor Rutgers' Recepten. Android: houd het ingedrukt → Delen →
  Rutgers' Recepten. iPhone: bewaar het in Bestanden en kies het in de app onder In & uit → Kies bestand." · EN "The file above is
  for Rutgers' Recepten. Android: press and hold it → Share → Rutgers' Recepten. iPhone: save it to Files and pick it in the app under
  In & out → Choose file."
- **`byId`:** `ShareContext.byId?: string` (het profiel-id van de afzender, `activeProfile.value?.id`); `baseEnvelope` schrijft
  `byId` als het er is; `Envelope.byId?: string`; lezers accepteren het en laten het staan (invariant 4: onbekende sleutels blijven
  toch al). Eén nieuw bevroren token `FROZEN_ENVELOPE_R_BYID` in tests/token.test.ts (toevoegen, nooit bestaande tokens wijzigen).
- Tests (tests/share.test.ts, tests/message.test.ts): 12 enveloppen van ±2.500 tekens → 2 delen, elk ≤ 20.000, samen alle 12 één
  keer, koppen "deel 1 van 2"/"deel 2 van 2"; 3 kleine enveloppen → 1 deel zonder "deel"; één envelop van 25.000 → bestand;
  `bundleFileName` NL en EN; `buildFileHintMessage` beide talen; `byId` reist mee en ontbreekt zonder context.

### 1b. Deelschermen (bouwer B: UI)

- **Deel je nieuwe recepten** (DeltaShareScreen.tsx): bij `parts.length > 1` zegt de kaart boven de knop `delta.parts` NL "Dit gaat
  in {n} berichten." · EN "This goes in {n} messages."; de knop **Deel** deelt deel 1 (`shareText(parts[0])`); na `shared` wordt de
  knop `delta.shareNext` NL "Deel deel {i} van {n}" · EN "Share part {i} of {n}" en de statusregel `delta.partSent` NL "Deel {i} van
  {n} verstuurd" · EN "Part {i} of {n} sent"; pas na het laatste deel: `markSent`, de teller en de gebeurtenis zoals nu. **Kopieer**
  kopieert alle delen achter elkaar met een lege regel ertussen (de ontvanger plakt ze één voor één of in één keer; het plakvak
  herkent meerdere codes al). `MessageExample` toont deel 1 en, bij meer delen, de regel `delta.moreParts` NL "+ {n} bericht(en)
  erna" → enkelvoud `delta.morePartsOne` NL "+ 1 bericht erna" · EN "+ 1 more message", meervoud EN "+ {n} more messages".
- **Als het toch een bestand is:** na `shared` van het bestand verschijnt onder de knop een tweede knop `share.fileHint` NL "Stuur
  ook de uitleg" · EN "Also send the explanation" die `shareText(buildFileHintMessage(lang))` doet (eigen tik, invariant 9); na
  `downloaded` dezelfde knop met de bestaande hint erbij. Dit geldt in DeltaShareScreen én bij Deel van een selectie
  (RecipesScreen.tsx) en op het recept-deelscherm (ShareScreen.tsx `shareFile`).
- **Deel bij een selectie** (RecipesScreen.tsx ±340–396): zelfde delen-flow (knop wordt "Deel deel 2 van 2"); Exporteer gebruikt
  de nieuwe `bundleFileName(by, undefined, lang)`.
- i18n (src/i18n/phase2.ts voor `delta.*`, src/i18n/edit.ts voor `share.fileHint`): NL én EN letterlijk; enkelvoudzusters waar `{n}`
  1 kan zijn.

### 1c. Ontvangkant: afzender met avatar, hint bij Kies bestand, avatar uit de voortgang (bouwer C)

- **Afzender op de inbox-kaarten:** waar een ontvangen recept, patch, bundel of weekplan de afzender toont (`plan.by` /
  `received.by`), komt vóór de naam een `<Avatar>` (28 px via class `inbox-from-avatar`) van het huishoudlid of de vriend die
  past: eerst `memberById(members, env.byId)` als `byId` er is, anders `memberByName(members, by)` (vrienden uit
  `getProgressSnapshots()` met `friend: true` tellen mee, zij hebben `avatar` in hun snapshot). Geen match → geen avatar, de
  naam als tekst zoals nu. De bestaande regel `inbox.fromMember` blijft.
- **Hint onder Kies bestand**, alleen op Android (`isAndroid()` uit `@/pwa`): `inbox.fileAndroidHint` NL "Kreeg je een bestand in
  WhatsApp? Houd het daar ingedrukt → Delen → Rutgers' Recepten." · EN "Got a file in WhatsApp? Press and hold it there → Share →
  Rutgers' Recepten." als `muted small` regel direct onder de knop.
- **Voortgang → avatar en level overnemen:** controleer `applyMemberCard` (waar die ook staat): neemt hij `avatar`, `color` en
  `name` van de kaart over in het huishoudlid? Zo niet, dan hier toevoegen (een lid "via kaartje" krijgt de nieuwste avatar van elke
  voortgangskaart; een lokaal profiel nooit). De knop **Werk {naam} bij** krijgt als sub-regel `progress.updateHint` NL "Level,
  streak, badges, kookdagen en avatar" · EN "Level, streak, badges, cook days and avatar".
- **Kalenderlegenda:** per persoon een mini-avatar (`<Avatar profile={p} />` met override `.cal-legend .avatar { width: 20px;
  height: 20px; font-size: 11px }`) in plaats van `.cal-legend-dot`; de stippen onder de dagen blijven stippen. Een persoon zonder
  getekende avatar krijgt het letterrondje in zijn kleur (dat doet `Avatar` al).
- Bestanden: `src/screens/InboxScreen.tsx`, `src/screens/CalendarScreen.tsx`, `src/styles/xp.css`, `src/styles/edit.css` (inbox-
  avatar), `src/i18n/edit.ts` (inbox.*), `src/i18n/xp.ts` (progress.updateHint), en het bestand met `applyMemberCard`.

### 1d. Handboek (bouwer D)

05: rij "Te groot voor één bericht: een bestand" → "Te veel voor één bericht: meerdere berichten" (hoe de delen eruitzien, dat je
ze één voor één plakt; een bestand alleen bij een extreem lang recept of via Exporteer); rij "Deel meerdere recepten" en de rij
over "Deel je nieuwe recepten" (02/05) idem; nieuwe rij `delen-en-ontvangen.bestand-openen` "Een bestand uit WhatsApp openen"
(Android: ingedrukt houden → Delen → Rutgers' Recepten; iPhone: Bestanden → In & uit → Kies bestand; en de knop Stuur ook de
uitleg aan de kant van de afzender); rij `voortgang-delen`/`huishouden`: de avatar reist mee en wordt bijgewerkt; 07
kalender-rij: de legenda toont avatars; rij over In & uit: de afzender met avatar. Daarna `npm run validate:data` en
`node --experimental-strip-types tools/handbook-md.ts`.

## 2. Opus mag dit NIET zelf beslissen

De grens van 20.000 tekens · de gretige verdeling en de kop "deel i van n" · de bestandsnaam en de hint-tekst (letterlijk) · geen
avatar in de receptcode · `byId` optioneel en nooit verplicht · bestaande bevroren tokens nooit wijzigen · de avatar-maat in de
inbox (28) en de legenda (20) · nieuwe dependencies (nee).

## 3. Bestandsverdeling

**A — Domein:** `src/domain/share.ts`, `src/domain/message.ts`, `tests/share.test.ts`, `tests/message.test.ts`, `tests/token.test.ts`
(alleen toevoegen).
**B — Deelschermen:** `src/screens/DeltaShareScreen.tsx`, `src/screens/RecipesScreen.tsx` (alleen de deel/exporteer-flow), `src/screens/ShareScreen.tsx`
(alleen de knop na een bestandsdeling), `src/i18n/phase2.ts`, `src/i18n/edit.ts` (alleen `share.fileHint`), `src/styles/settings.css`
(alleen `.delta`-regels, als nodig).
**C — Ontvangkant:** `src/screens/InboxScreen.tsx`, `src/screens/CalendarScreen.tsx`, `src/styles/xp.css`, `src/styles/edit.css`,
`src/i18n/edit.ts` (alleen `inbox.*`), `src/i18n/xp.ts`, het bestand met `applyMemberCard`, `src/screens/HouseholdScreen.tsx` (alleen
de sub-regel van Werk bij).
**D — Handboek:** `data/handbook/*.json`, `docs/HANDLEIDING.md`, `docs/HANDBOOK.md`. Raakt geen src.
**Integrator:** check/test/build/build:next/validate groen; acceptatie in de dev-app (375 px, NL én EN): maak 8 eigen testrecepten
met lange stappen (of gebruik testdata) zodat de delta boven 20.000 tekens komt → "Dit gaat in 2 berichten", Deel → deel 1, knop
"Deel deel 2 van 2"; Kopieer geeft beide delen; onder de grens één bericht zoals voorheen; een geforceerd bestand (opts.limit klein
via een tijdelijke probe, daarna weghalen) toont na delen de knop "Stuur ook de uitleg"; In & uit: op Android (user-agent emuleren)
de hint onder Kies bestand; een ontvangen recept van een huisgenoot toont diens avatar voor de naam; een voortgangskaart met avatar
werkt het lid bij; de kalenderlegenda toont mini-avatars. DEVICE-TEST: nieuwe rij 111 "Delen zonder bestanden en afzender met
avatar (V2)" NL én EN na rij 110 (twee telefoons: Gabi deelt ≥ 8 nieuwe recepten → twee berichten; Stijn tikt ze één voor één;
bestandsroute via Exporteer + Stuur ook de uitleg; legenda met avatars); rijen 15/17/19 en 39/40 bijwerken waar ze "als bestand"
beloven. STATUS-alinea en de regel "Gebouwd: …".

## 4. Niet in dit blok

V4 (dopamine-kick), V6, V7, V8, V9 — docs/IDEAS.md. Een ander lid groot bekijken (idee 5-rest) wacht.
