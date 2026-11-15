# Spec V1c — Testronde-feedback na V1–V9 (Stijn, vanaf 9 nov 2026)

Status: punt 1 compleet (9 nov), punten 3, 7 en 8 direct gebouwd (10–15 nov), punt 9 in aanbouw (15 nov); V1c-2 ontworpen en akkoord; de rest van de lijst verzamelt. Elk punt dat Stijn laat bouwen,
krijgt hieronder een eigen blok (V1c-1, V1c-2, …) met Kritische lezer, Feitencheck, §1 Gedrag, §2 en §3, en gaat door de lichte workflow.

## Verzamellijst

| # | Gemeld | Wat Stijn zag | Feiten in de code | Voorstel Fable | Stijn beslist |
|---|---|---|---|---|---|
| 1 | 9 nov | Onder Huishouden & vrienden staan **Deel mijn kaartje** en **Voeg lid toe**, maar geen **Voeg vriend toe**; onduidelijk welke knop een vriend toevoegt, zeker omdat het kaartje naar "je huishouden" verwijst. | Er zijn twee soorten kaartjes. Het **kaartje** (`#f=`, Deel mijn kaartje) maakt de ander altijd **lid** van je huishouden. Een **vriend** bestaat alleen via een **gedeelde voortgang** (`#x=`, Mijn profiel → Sync mijn voortgang): bij het plakken kies je "Bewaar als vriend" of lid; vrienden zijn snapshots (`progress.snapshots`, `friend: true`) en staan onder **Vrienden** (alleen zichtbaar als er een is) en in de kalender. **Voeg lid toe** (naam + kleur) is voor iemand zonder de app. Het scherm heet nog **Huishouden** terwijl de rij op Meer sinds V1b **Huishouden & vrienden** heet. | Optie A (teksten + vast blok Vrienden met knop) of optie B (ook een kaartje als vriend bewaren, modelwijziging). | **Optie A** (Stijn 9 nov) → blok V1c-1 hieronder. |

| 2 | 9 nov (na V1c-1) | "Ik wil een knop Voeg vriend toe én Voeg huisgenoot toe, één plakveld is oké; dan Stuur voortgang / Stuur recepten (of allebei) met één deelknop eronder; elke vriend kun je Maak huisgenoot doen en elke huisgenoot Maak vriend; het woord kaartje is onduidelijk, ik wil duidelijkheid en makkelijkheid." | Vrienden zijn nu voortgangs-snapshots (`progress.snapshots`, `friend: true`), huisgenoten zijn `Member`s; de voortgang (`#x=`) bevat al naam, kleur, taal, avatar en deviceId (`progressCardFor`), dus het kaartje (`#f=`) is als apart begrip overbodig; "Deel je nieuwe recepten" (DeltaShareScreen, `/share`) en "Sync mijn voortgang" (ProgressSharePanel) zijn twee losse stuurpanelen; `membersFrom` wordt gelezen in badges.ts, BadgesScreen, CalendarScreen, DeltaShareScreen, HouseholdScreen, InboxScreen, MoreScreen, RecipeScreen en StoryScreen. | **Ontwerp V1c-2 hieronder** (één lijst mensen met rol, twee toevoegknoppen, één plakvak, één stuurpaneel per persoon, kaartje verdwijnt). L, 6–8 % weekbudget. | **Akkoord met het ontwerp (9 nov: "ja bewaar dit maar tot volgende keer dat ik op mn laptop zit"); bouwen zodra Stijn "bouw maar" zegt.** |
| 3 | 10 nov | "Bij recepten die geen klassiekers zijn, naast het sterretje ook gewoon een deelknop, zodat ik snel losse recepten kan delen." | De receptkop (`.detail-head`) had alleen de ster; **Deel** stond lager in de knoppenrij (Koken · ✓ Gekookt · Deel). | Direct gebouwd door Fable (klein): bij een eigen of ontvangen recept (`origin.kind !== 'builtin'`) een tweede knop naast de ster met een deel-pijltje, dezelfde stijl als de ster, naar hetzelfde deelscherm; klassiekers houden alleen de ster. Handboekzin bij Een recept bekijken, DEVICE-TEST rij 121. | — (gebouwd 10 nov, commit in STATUS) |
| 4 | 10 nov | "De labels bij aanpassen of toevoegen van een gerecht mogen ingeklapt, en in eerste instantie alleen de geselecteerde labels tonen." | De editor toont `MetaRows` (src/components/MetaRows.tsx) altijd open: drie rijen chips — Categorie (15), Keuken (±18 gewone keukens + een keuzelijst met 43 zeldzame) en Dieet & labels (de tagwoordenlijst) — plus de "waarschijnlijk"-hint van de herkenner. Er bestaat al een samenvattingsregel van de gekozen waarden (`metaSummary`, r. 113) en de app heeft sinds V1 een vouwkop (`FoldHead`). | **Ingeklapt standaard:** één rij met alleen de gekozen chips (categorie · keuken · labels, de "waarschijnlijk"-chips erbij) en een chip **Wijzig labels**; een tik klapt de drie rijen open zoals nu. Zonder enig label (nieuw recept, nog niets herkend) staat hij open. De herkenner die labels voorstelt na plakken blijft werken en toont zijn voorstel ook in de ingeklapte rij. Handboekrij `recepten.labels-editor` mee. S. | Later bouwen (Stijn 10 nov: "kunnen later gebouwd worden, maar wel alvast bekeken"). |
| 5 | 10 nov | "In de editor kun je lager scrollen dan er dingen staan: een half scherm lege ruimte." | Bewust gemaakt: `.screen.form { padding-bottom: calc(40vh + var(--sab)) }` (base.css r. 217) geeft ruimte zodat een veld boven het toetsenbord kan komen. Dezelfde klasse zit op Editor, Boodschappen, Huishouden, In & uit, Mijn profiel, Profielen, Kalender, Apparaatcheck en Onboarding, dus overal die lege ruimte. | De ruimte alleen zolang een veld de focus heeft: `.screen.form:focus-within { padding-bottom: calc(40vh + var(--sab)) }` en anders de gewone 24 px plus veilige rand. Op de telefoon blijft de focus staan zolang het toetsenbord open is, dus de bescherming blijft; zonder toetsenbord eindigt de pagina gewoon onder de laatste knop. Eén CSS-regel; DEVICE-TEST-rij op beide telefoons (iOS-toetsenbord gedraagt zich anders). S. | Later bouwen; kan mee met punt 4. |
| 6 | 10 nov | "Op een recept, naast + Deze week, ook een Voeg aan boodschappenlijst toe, zodat je zonder week dingen op je lijst zet en mensen de app ook gewoon als boodschappenlijst-app kunnen gebruiken." | De lijst wordt gebouwd uit het weekplan: `aggregate({ plan, recipes, lines, dict, pantry, extras, standing, previous })` (src/domain/aggregate.ts r. 91); recepten komen alleen via `plan.items` binnen; losse dingen zijn `extras` (handmatig, `addExtra`) en de vaste lijst (`standing`). "+ Deze week" maakt een planvak (`addToPlan`, RecipeScreen r. 654). | **Losse recepten op de lijst:** instelling `shop.loose` met `[{ id, recipeId, servings, variant?, addedAt }]`; de repo voegt ze bij het bouwen van de lijst als extra bronnen toe (zelfde pad als planvakken, `ListSource.loose: true`, zodat "Waarvoor is dit?" zegt "los toegevoegd"). Op de receptpagina naast **+ Deze week** de knop **+ Boodschappen** (met de gekozen porties en, net als bij de week, de goedgekeurde dieetversie); staat het recept al los op de lijst, dan opent de knop Boodschappen. Op het Boodschappen-scherm bovenaan een chiprij "Los: Lasagne ×4 ✕" om ze weer weg te halen; **Klaar** en **Leeg de lijst** halen de losse recepten ook weg (de lijst is dan gekocht). De bestaande feature-badge `listMade` telt mee. Handboekrij in 04 ("Een recept op de lijst zonder weekplan"), DEVICE-TEST-rij. M. | Later bouwen (Stijn 10 nov); eerst V1c-2. |
| 7 | 10 nov | Gabi kreeg "Invalid recipe code" bij Stijns aangepaste nasi-recept, gedeeld met de nieuwe deelknop (V1c-3); zij had wel geüpdatet. | De link zelf is goed: hij decodeert met de huidige code (envelop v2, `#r=`, 2607 tekens, kind recipe, ook na `cleanPastedText`). De melding `inbox.invalid` komt alleen uit `collectPaste` als er wél een `#r=`-code gevonden is maar `decodeToken`/`parseEnvelope` faalt — dus de code was bij Gabi afgebroken of veranderd (een gekopieerde link die te vroeg stopt, of de voorproefjespagina in de WhatsApp-browser). Lege of code-loze plak geeft `inbox.noToken`. | Direct gedaan door Fable: bij een gevonden maar onleesbare code zegt de app nu "De receptcode is onvolledig of beschadigd ({n} tekens gevonden). Kopieer het hele bericht opnieuw: houd het bericht in WhatsApp ingedrukt, kies Kopieer en plak het hier." (`inbox.invalidToken`, met `console.warn` van sleutel en lengte). Daarmee zien we op Gabi's telefoon meteen hoeveel tekens er aankwamen (2607 = heel). Vervolg hangt af van haar antwoord: kopieerde ze het bericht of tikte ze op de link? | Uitkomst (10 nov, screenshot Gabi): **1236 van de 2607 tekens** kwamen aan en in het vak stond alleen de link, niet het bericht — ze kopieerde de link (of tikte erop), en op de iPhone wordt zo'n lange link onderweg gebroken. Tweede reparatie: `glueToken` plakt een code die door een regeleinde of onzichtbaar teken is gebroken weer aan elkaar (In & uit én het plakvak van Huishouden & vrienden; tests). Echt afgebroken (de rest ontbreekt) blijft onherstelbaar: dan helpt alleen het hele bericht kopiëren. Afwachten of het hiermee lukt; zo niet, dan is de link in WhatsApp écht ingekort en moeten we de links voor de iPhone korter maken (bv. delen in twee berichten onder ±1.200 tekens). |
| 8 | 15 nov | "Als een gerecht hoeveelheden heeft en je drukt op het minnetje, haalt hij kleine stappen weg; ik wil hem in één keer kunnen verwijderen, en subtiel een kleiner minnetje naast het getal om wel minder te nemen. Meestal moet je hele ingrediënten verwijderen en dan moet je 20 keer klikken." | Het is de controlelijst na Maak de lijst (`ProtoRow`): `[−] aantal naam [+]` met de stapregel `adjustStep` (stuks 1; g 10/25/50; ml 10/50/100; lepels ½); 1 kg bloem = 20 tikken naar 0; een regel op 0 heet "(niet nodig)" en telt niet mee. | Direct gebouwd door Fable: links een kruisje ✕ (Niet nodig) dat de regel in één tik op 0 zet, op een doorgestreepte regel een pijltje ↺ (Zet terug) dat het uitgerekende aantal terugzet; rechts smallere − en + voor een stap minder of meer. Geldt ook in het venster Aantal aanpassen (zelfde component). Handboekrij aantal-aanpassen, DEVICE-TEST rij 122. | — (gebouwd 15 nov, commit in STATUS) |
| 9 | 15 nov | Stijn wiste zijn Chrome-geschiedenis mét site-gegevens: de hele opslag van de app is weg (levels, badges, kooklog, eigen recepten). Gabi's telefoon bewaart zijn laatst gedeelde voortgang. "Ik wil de Stuur terug-functie op Gabi's telefoon hebben." Geen back-up. | De ontvangen voortgang staat als `ProgressSnapshot` (= `ProgressCard` + `receivedAt`, `friend`) in `progress.snapshots`, met level, totaal XP (`xp`), streak, badges (`id`/`id@k`) en de kookdagen van 90 dagen (`cookDays[{d, r}]`). XP is geen opgeslagen getal maar wordt afgeleid uit feiten (`deriveXp(facts)`: kooklog, foto's, eigen recepten, badges, uitdagingen); `badges.earned` is wél opgeslagen. Een eigen voortgang die binnenkomt (`cardStatus` 'local') doet nu niets. | **Blok V1c-9 hieronder:** Stuur terug op de andere telefoon + Herstel mijn voortgang op de eigen telefoon (overgedragen XP, badges, 90 kookdagen). | Bouwen (Stijn 15 nov). |

## Nog te verwachten
Alles uit DEVICE-TEST 109–119 dat niet klopt; de kcal-getallen bij bekende recepten (V9/V9b); de rand-veeg op de iPhone (V8).

---

## Blok V1c-1 — Huishouden & vrienden: duidelijk wie huisgenoot is en hoe een vriend erbij komt (optie A)

Status: compleet (Fable, 9 nov 2026). Eén bouwer + integrator (lichte modus). Leidend bij tegenspraak: docs/specs/README.md §2–§4,
docs/specs/handbook.md §4, CLAUDE.md invariant 5 (iPhone: plakken blijft de weg).
Gebouwd: 9 nov 2026 (V1c-1, lichte workflow wf_b1b70b08-104; lens: geen bevindingen; integrator: de blauwe regel gaat ook uit als er al tekst in het vak stond bij de tik; bouwer: `focus({ preventScroll: true })` zodat de vloeiende scroll niet overslaat, rij 120 EN zelf vertaald; Fable na de gate: de oudere DEVICE-TEST-rijen 52, 58, 97, 99, 108 en 109 en de handboekrij voortgang-ontvangen zeggen nu ook **Huishouden & vrienden** / **Housemates**)

**Kritische lezer (Fable, vooraf).** (1) Geen modelwijziging: `Member`, `HouseholdSetting` en `progress.snapshots` blijven zoals ze zijn; een
vriend blijft een voortgangs-snapshot met `friend: true`. Alleen teksten, één altijd zichtbaar blok en één knop die naar het plakvak brengt.
(2) De woorden: het scherm heet **Huishouden & vrienden** (zoals de rij op Meer), leden heten **huisgenoten** (de Meer-labeltjes zeggen al
huisgenoot/vriend), "Voeg lid toe" wordt **Typ een huisgenoot** (voor iemand zonder de app), de plakrij wordt **Plak een kaartje of voortgang**.
(3) De handboekvalidator eist dat elke `**naam**` letterlijk een i18n-waarde is: elke hernoemde knop moet in alle handboekrijen mee
(rijen `kaartje-delen`, `lid-toevoegen`, `huishouden`, `voortgang-ontvangen` noemen **Voeg lid toe via link of plak**, **Voeg lid toe**, **Leden**).
(4) `household.cardIosHint` noemt de plakrij bij naam; mee hernoemen. (5) DEVICE-TEST-rijen van eerdere blokken noemen de oude knoppen; de
bouwer vervangt die labels één op één (zoeken op de oude tekst), zodat de testlijst blijft kloppen. (6) `household.add` is nu zowel de kop van
het typ-kaartje, de knop onderaan als het opslaglabel van `MemberForm`; die krijgen eigen keys.

**Feitencheck (Fable, in de code).** `src/screens/HouseholdScreen.tsx` r. 636–797: `<Header title={t('household.title')}>`, intro
`household.intro`, kaart Mijn kaartje (`MemberCardPanel`, `ProgressShareToggle`), kaart **Leden** (`household.members` + `count` uit
`household.memberOne/memberCount`), kaart **Vrienden** alleen `friends.length > 0` (`progress.friends`, `FriendLevelLine`, `removeFriend`),
kaart plakken (`household.addViaLink`, `household.addViaLinkHint`, `UniversalPaste` met `textareaRef={pasteBox}` en `label`), en onderaan
`adding ? <section><h2>{household.add}</h2><MemberForm submitLabel={household.add} …/></section> : <button>{household.add}</button>`.
`friends` komt uit `useMemo` (r. 491). i18n in src/i18n/settings.ts r. 155–218 (`household.*`), `progress.friends` en `progress.saveFriend`
in src/i18n/xp.ts, `more.householdFriends` = "Huishouden & vrienden" · "Household & friends", `more.friend` = "vriend" · "friend".
Handboek 05-delen-en-ontvangen: `delen-en-ontvangen.kaartje-delen`, `.lid-toevoegen`, `.huishouden`, `.voortgang-ontvangen` (teksten hierboven
geciteerd in de Feitencheck van 9 nov). DEVICE-TEST: rij 119 is de laatste; dit blok krijgt rij 120.

### 1. Gedrag (bouwer A: `src/screens/HouseholdScreen.tsx`, `src/i18n/settings.ts`, `data/handbook/05-delen-en-ontvangen.json`,
`docs/HANDLEIDING.md` + `docs/HANDBOOK.md` via `node --experimental-strip-types tools/handbook-md.ts`, `docs/DEVICE-TEST.md`)

- i18n (settings.ts), letterlijk NL · EN:
  - `household.title`: "Huishouden & vrienden" · "Household & friends".
  - `household.intro`: "Eén huishouden per telefoon: de mensen met wie je kookt en boodschappen doet. De profielen op deze telefoon zijn
    automatisch huisgenoot; wie op een andere telefoon kookt stuurt je een kaartje, of je typt de naam zelf. Een vriend staat los van je
    huishouden: je ziet alleen zijn level en kookdagen." · "One household per phone: the people you cook and shop with. The profiles on this
    phone are housemates automatically; someone who cooks on another phone sends you a card, or you type the name yourself. A friend is
    separate from your household: you only see their level and cooking days."
  - `household.members`: "Huisgenoten" · "Housemates"; `household.memberCount`: "{n} huisgenoten" · "{n} housemates"; `household.memberOne`:
    "1 huisgenoot" · "1 housemate".
  - `household.add`: "Typ een huisgenoot" · "Type a housemate" (kop van het typ-kaartje én de knop onderaan); nieuw `household.addHint`: "Voor
    iemand zonder de app, zodat die in de kookkalender kan." · "For someone without the app, so they can be in the cook calendar." (muted
    small, boven de knop onderaan én onder de kop van het typ-kaartje); nieuw `household.addSubmit`: "Voeg toe" · "Add" (het opslaglabel van
    `MemberForm`).
  - `household.addViaLink`: "Plak een kaartje of voortgang" · "Paste a card or progress"; `household.addViaLinkHint`: "Plak hier het bericht
    dat de ander je stuurde. Een kaartje maakt iemand huisgenoot. Een gedeelde voortgang kun je als huisgenoot óf als vriend bewaren: een
    vriend staat niet in je lijstjes, je ziet alleen zijn level en kookdagen. Iets anders geplakt? De app zegt wat het is en waar het heen
    kan." · "Paste the message the other person sent you here. A card makes someone a housemate. Shared progress you can keep as a housemate
    or as a friend: a friend is not in your lists, you only see their level and cooking days. Pasted something else? The app says what it is
    and where it can go."
  - `household.cardIosHint`: vervang "Huishouden → \"Voeg lid toe via link of plak\"" door "Huishouden & vrienden → \"Plak een kaartje of
    voortgang\"" en in het Engels "Household → \"Add a member via link or paste\"" door "Household & friends → \"Paste a card or progress\"".
  - Nieuw `household.friendsEmpty`: "Nog geen vrienden. Een vriend voeg je toe met zijn gedeelde voortgang: hij tikt op Mijn profiel op Sync
    mijn voortgang en stuurt je het bericht." · "No friends yet. You add a friend with their shared progress: they tap Sync my progress on My
    profile and send you the message."; nieuw `household.addFriend`: "Voeg vriend toe" · "Add friend"; nieuw `household.friendHint`: "Plak
    hier het voortgangsbericht van je vriend en kies dan Bewaar als vriend." · "Paste your friend's progress message here and then choose
    Save as a friend."
- HouseholdScreen:
  - De kaart **Vrienden** staat er altijd, direct onder Huisgenoten: met vrienden de lijst zoals nu; zonder vrienden `<p class="muted small">
    {household.friendsEmpty}</p>`. In beide gevallen daaronder `<div class="actions"><button class="btn btn-small">{household.addFriend}</button></div>`.
  - De knop **Voeg vriend toe**: zet state `friendHint` op true, scrolt het plakvak in beeld (`pasteBox.current?.scrollIntoView({ block: 'center',
    behavior: 'smooth' })`, zonder animatie bij `prefers-reduced-motion`) en zet de focus erop (`pasteBox.current?.focus()`). Zolang `friendHint`
    waar is én het plakvak leeg, staat onder `household.addViaLinkHint` een regel `<p class="small friend-hint" role="status">{household.friendHint}</p>`
    (kleur `var(--cobalt)`); zodra er tekst in het vak komt of een kaart gevonden is, gaat `friendHint` weer uit.
  - Het typ-kaartje: `<h2>{household.add}</h2><p class="muted small">{household.addHint}</p><MemberForm submitLabel={t('household.addSubmit')} …/>`;
    de knop onderaan krijgt de hint erboven: `<p class="muted small">{household.addHint}</p><button …>{household.add}</button>`.
  - Verder niets: het kaartje-plakken, "Voeg {name} toe aan je huishouden", `ProgressCardRow` met Bewaar als vriend, Mijn kaartje en Sync mijn
    voortgang blijven zoals ze zijn.
- CSS (settings.css, bij de bestaande household-regels): `.friend-hint { color: var(--cobalt); margin: 4px 0 8px; }`. Niets anders.
- Handboek 05 (`node --experimental-strip-types tools/handbook-md.ts` erna):
  - `delen-en-ontvangen.lid-toevoegen`: `where[3]` nl "Scrol naar **Plak een kaartje of voortgang**." · en "Scroll to **Paste a card or
    progress**."; `see` nl "… Daarna staat de persoon bij **Huisgenoten**, met “via kaartje”." · en "… Afterwards the person is under
    **Housemates**, with “via card”."; titel wordt "Een huisgenoot toevoegen met een kaartje" · "Add a housemate with a card".
  - `delen-en-ontvangen.huishouden`: `where[2]` nl "Tik onderaan op **Typ een huisgenoot**." · en "Tap **Type a housemate** at the bottom.";
    `where[5]` nl "Tik op **Voeg toe** om te bewaren." · en "Tap **Add** to save."; `see` nl "Elke huisgenoot staat bij **Huisgenoten** …" ·
    en "Each housemate is under **Housemates** …" (de rest van de zin ongewijzigd); titel "Je huishouden: huisgenoten en kleuren" · "Your
    household: housemates and colours".
  - Nieuwe rij direct ná `delen-en-ontvangen.lid-toevoegen`, id `delen-en-ontvangen.vriend-toevoegen`, `route: "/more/household"`, `platform:
    "all"`: title "Een vriend toevoegen" · "Add a friend"; what "Een vriend is iemand met wie je niet samen kookt, maar van wie je wel het
    level en de kookdagen wilt zien. Een vriend komt niet in je boodschappenlijst of je porties." · "A friend is someone you do not cook with,
    but whose level and cooking days you want to see. A friend does not appear in your shopping list or your servings."; where nl ["Vraag je
    vriend om op **Mijn profiel** op **Sync mijn voortgang** te tikken en je het bericht te sturen.", "Kopieer dat bericht.", "Tik onderaan op
    **Meer** en dan op **Huishouden & vrienden**.", "Tik onder **Vrienden** op **Voeg vriend toe**.", "Tik op **Plak van klembord**.", "Tik onder
    de kaart op **Bewaar als vriend**."] · en ["Ask your friend to tap **Sync my progress** on **My profile** and send you the message.", "Copy
    that message.", "Tap **More** at the bottom, then **Household & friends**.", "Under **Friends**, tap **Add friend**.", "Tap **Paste from
    clipboard**.", "Under the card, tap **Save as a friend**."]; see "De app springt naar het plakvak met een blauwe regel die zegt wat je
    plakt. Na **Bewaar als vriend** staat de persoon onder **Vrienden**, met level en kookdagen." · "The app jumps to the paste box with a blue
    line saying what to paste. After **Save as a friend** the person is under **Friends**, with level and cooking days."; know "Een gewoon
    kaartje (**Deel mijn kaartje**) maakt iemand altijd huisgenoot, geen vriend. Wil je een vriend later toch als huisgenoot? Plak zijn
    voortgang nog eens en kies dan de andere knop." · "A plain card (**Share my card**) always makes someone a housemate, not a friend. Want a
    friend as a housemate after all? Paste their progress once more and choose the other button."; keywords nl ["vriend", "vriend toevoegen",
    "voortgang", "level van een ander", "huisgenoot"] · en ["friend", "add friend", "progress", "someone's level", "housemate"].
  - Controleer met `npm run validate:data` dat elke **naam** (ook **Sync mijn voortgang**, **Mijn profiel**, **Plak van klembord**, **Bewaar als
    vriend**, **Vrienden**) letterlijk in src/i18n staat; ontbreekt er een, meld het.
- DEVICE-TEST: zoek de oude labels "Voeg lid toe via link of plak", "Add a member via link or paste", "**Voeg lid toe**", "**Add member**",
  "**Leden**", "**Members**" in bestaande rijen en vervang ze door de nieuwe (respectievelijk **Plak een kaartje of voortgang**, **Paste a card
  or progress**, **Typ een huisgenoot**, **Type a housemate**, **Huisgenoten**, **Housemates**); noem in je rapport welke rijen. Nieuwe rij
  120, NL én EN, in de stijl van rij 119: **Huisgenoot of vriend (V1c-1).** 1. Tik op **Meer** → **Huishouden & vrienden** en lees de kop en de
  uitleg bovenaan. 2. Kijk naar de kaarten: Mijn kaartje, Huisgenoten, Vrienden, Plak een kaartje of voortgang, en de knop onderaan. 3. Tik onder
  **Vrienden** op **Voeg vriend toe**. 4. Typ iets in het plakvak en wis het weer. 5. Tik onderaan op **Typ een huisgenoot**, typ *Oma*, kies een
  kleur en tik op **Voeg toe**. Verwijder Oma daarna weer. 6. Zet de app op Engels en doe stap 1–3 nog eens. | 1. De kop zegt **Huishouden &
  vrienden**; de uitleg noemt huisgenoten (koken en boodschappen samen) en vrienden (alleen level en kookdagen). 2. De kaart **Vrienden** staat
  er ook zonder vrienden, met de uitleg hoe je er een krijgt en de knop **Voeg vriend toe**; onder de huisgenoten staat "… huisgenoten"; de
  plakrij heet **Plak een kaartje of voortgang** en legt uit dat een kaartje iemand huisgenoot maakt en een voortgang ook als vriend kan. 3. Het
  scherm schuift naar het plakvak, het vak krijgt focus en er staat een blauwe regel "Plak hier het voortgangsbericht van je vriend en kies dan
  Bewaar als vriend." 4. Zodra je typt verdwijnt de blauwe regel; na het wissen komt hij niet terug. 5. Oma staat bij **Huisgenoten** met "met
  de hand toegevoegd"; de knop in het kaartje heet **Voeg toe**. 6. In het Engels: **Household & friends**, **Housemates**, **Friends**, **Add
  friend**, **Paste a card or progress**, **Type a housemate**, **Add**.

### 2. Opus mag dit NIET zelf beslissen
- Geen modelwijziging; een vriend blijft een voortgangs-snapshot. Geen nieuwe knop die een kaartje als vriend bewaart (dat was optie B).
- De teksten letterlijk; de kaart Vrienden altijd zichtbaar; de knop brengt alleen naar het plakvak (geen eigen venster).

### 3. Bestandsverdeling
| Bouwer | Bestanden |
|---|---|
| A | `src/screens/HouseholdScreen.tsx`, `src/i18n/settings.ts`, `src/styles/settings.css` (één regel), `data/handbook/05-delen-en-ontvangen.json`, `docs/HANDLEIDING.md` + `docs/HANDBOOK.md`, `docs/DEVICE-TEST.md` |
| Integrator | check/test/build/validate groen, acceptatie in de dev-app (NL/EN: kop, blok Vrienden leeg, knop → plakvak met blauwe regel, typ-kaartje met Voeg toe), `docs/STATUS.md`, de regel "Gebouwd" in dit blok |


---

## Ontwerp V1c-2 — Mensen en sturen: huisgenoten en vrienden met een wisselbare rol, één plakvak, één stuurpaneel (wacht op "bouw maar")

Status: ontwerp akkoord (Stijn 9 nov), nog niet gebouwd; wordt een gewone spec (Kritische lezer, Feitencheck, §1–§3) zodra Stijn het zegt.
Vervangt een deel van V1c-1 (de teksten blijven de basis; het blok Vrienden en het typ-kaartje gaan op in de nieuwe knoppen).

**Model.** `Member.role?: 'housemate' | 'friend'` (afwezig = huisgenoot; profielen op deze telefoon altijd huisgenoot). Een vriend wordt een
`Member` met `role: 'friend'` (naam, kleur, taal, avatar, deviceId uit zijn voortgang); zijn snapshot blijft in `progress.snapshots` onder zijn id,
de vlag `friend` daar verliest haar betekenis (blijft staan voor oude back-ups). Eenmalige migratie bij boot: elke snapshot met `friend: true`
zonder bijpassend lid wordt een vriend-lid. Helpers `housemates(members)` en `friendsOf(members)`. Wie wat leest: lijstjes, porties, weekplan,
"wie kookte", badges Samen en de Badges-tabbladen → huisgenoten; kookkalender, afzenders in In & uit, ontvangers van Stuur → allebei; Meer toont
beide met de bestaande labeltjes huisgenoot/vriend.

**Rol wisselen.** Bij elke persoon behalve een profiel op deze telefoon: **Maak vriend** of **Maak huisgenoot** (één tik, geen bevestiging; de
snapshot en de kookdagen blijven).

**Toevoegen.** Bovenaan de lijst twee knoppen: **Voeg huisgenoot toe** en **Voeg vriend toe**. Beide openen hetzelfde venstertje met de rol al
gekozen (en wisselbaar): (a) **Plak wat hij je stuurde** — het ene plakvak; een geplakte voortgang of oud kaartje toont "Gabi stuurde haar
voortgang" met de knop **Voeg Gabi toe als vriend/huisgenoot** (of **Werk Gabi bij** als ze al in de lijst staat); (b) **Of typ een naam** — naam +
kleur voor iemand zonder de app, met de gekozen rol. Het losse typ-kaartje en de losse plakkaart van V1c-1 verdwijnen; de universele plakbox
blijft intern dezelfde (recepten en lijstjes die hier geplakt worden gaan door naar In & uit zoals nu).

**Sturen.** Bij elke persoon een knop **Stuur** → venster "Stuur naar Gabi" met twee vinkjes: **Mijn voortgang** (level, badges, kookdagen én wie
je bent; met badges uit heet het **Wie ik ben** en gaat alleen naam, kleur, taal en avatar mee, technisch het `#f=`-token) en **Nieuwe recepten**
("12 nieuwe sinds 3 nov"; uit als er niets nieuws is), daaronder **Deel** en **Kopieer**. Eén WhatsApp-bericht: de voortgangszin met haar link,
dan de receptdelen zoals DeltaShareScreen ze nu maakt (V2-regels: tot 20 KB per bericht, anders meerdere delen; de voortgang zit in deel 1). Na
een geslaagde share: `share.lastSentTo` voor die persoon bijgewerkt en de 'out'-rijen gelogd zoals nu. Bovenaan het scherm **Stuur mijn
voortgang** voor iemand die nog niet in de lijst staat (zelfde venster zonder ontvanger, alleen het eerste vinkje). Mijn profiel houdt zijn knop
Sync mijn voortgang maar die opent hetzelfde venster. De techniek achter DeltaShareScreen (`/share`) blijft en wordt een module (`src/sendto.ts`)
die het venster en het bestaande scherm allebei gebruiken; het scherm zelf blijft bereikbaar via Recepten & delen.

**Ontvangen.** De ontvanger plakt het bericht in In & uit of in het plakvak van Huishouden & vrienden; `extractTokens` vindt `#x=`/`#f=` én de
receptlinks. De persoonskaart heet "Gabi stuurde haar voortgang" (of "… wie ze is") met **Voeg toe als huisgenoot**, **Voeg toe als vriend** of
**Werk bij**; de recepten gaan zoals nu naar de inbox-voorvertoning. De rol die de ontvanger kiest staat los van wat de zender deed (Stijn: "de
ontvanger weet dan al of het een vriend of huisgenoot is").

**Woorden.** "Kaartje", "lid", "Mijn kaartje", "Deel mijn kaartje" en "Voeg toe aan je huishouden" verdwijnen uit UI, handboek (rijen
kaartje-delen, lid-toevoegen, vriend-toevoegen, huishouden, voortgang-ontvangen, in-en-uit) en DEVICE-TEST (rijen 52, 58, 97, 99, 108–110,
120). Het scherm blijft **Huishouden & vrienden** heten.

**Niet veranderen.** Tokens en hun codecs (invariant 4: `#f=` en `#x=` blijven leesbaar), iPhone-plakweg (invariant 5), de kookkalender, de
badge-regels (Samen telt huisgenoten), de Profielen-pagina.

**Grootte en verdeling (schatting).** L: bouwer A domein + repo (rol, helpers, migratie, tests), bouwer B HouseholdScreen + venstertjes + sendto.ts
+ DeltaShareScreen-koppeling + i18n, bouwer C MoreScreen/Inbox/Calendar/Badges-lezers + handboek + DEVICE-TEST; integrator, lens, gate. 6–8 %
weekbudget.

**Stijn beslist bij de bouw.** Niets meer; alles hierboven is op 9 nov besproken. Open blijft alleen de exacte Nederlandse zin op de
ontvangen persoonskaart ("Gabi stuurde haar voortgang" versus "Voortgang van Gabi"); voorstel Fable: de eerste.


---

## Blok V1c-9 — Voortgang terugsturen en je eigen voortgang terugzetten

Status: in aanbouw (Fable, 15 nov 2026). Twee bouwers + integrator (lichte modus). Leidend bij tegenspraak: docs/specs/README.md §2–§4,
docs/specs/xp-levels.md (§1h delen, §1i ontvangen, §2 de regels), docs/specs/badges-avatar.md, CLAUDE.md invariant 4 (het `#x=`-token
verandert niet: het blijft precies het kaartje dat `buildProgressEnvelope` al maakt) en 14 (geen backend: herstellen gaat via een bericht).
Gebouwd: 15 nov 2026 (V1c-9, lichte workflow; run-id in STATUS)

**Kritische lezer (Fable, vooraf).** (1) Het token blijft hetzelfde: "Stuur terug" verpakt een bewaarde snapshot opnieuw als `#x=`; de velden
`receivedAt` en `friend` van de snapshot mogen niet meereizen (pure helper `cardOfSnapshot`). De envelop krijgt `at` = `receivedAt` van de
snapshot (het moment waarop die telefoon hem kreeg ≈ het deelmoment), zodat de ontvanger "gedeeld op 3 nov" ziet en de 30-dagenregel klopt.
(2) XP wordt afgeleid, niet opgeslagen. Herstellen = de feiten terugzetten die we hebben (badges, de 90 kookdagen) plus een **overgedragen
XP** (`xp.carried`) voor de rest, zó berekend dat het totaal precies op het XP van het kaartje uitkomt: `carried = max(0, cardXp −
(afgeleid totaal zonder carried))`. Daardoor is dubbeltellen onmogelijk: wat de teruggezette kookdagen en badges aan XP opleveren, gaat van
de overdracht af. (3) Teruggezette kookdagen krijgen `loggedAt` = nu en `at` = die dag 18:00 lokale tijd; regel 3 van §2b (meer dan 7 dagen na
`at` ingevoerd = 0 XP) maakt ze vanzelf XP-loos, en de overdracht vangt de laatste 7 dagen op. Ze tellen wél voor streak, kalender en de
badges die kookdagen lezen. Een dag met een recept dat al in de kooklog staat (zelfde dag, zelfde recept) wordt overgeslagen. (4) Badges:
de strings van het kaartje worden stil bij `badges.earned[profielId]` gevoegd (vereniging), zonder toast of confetti; de XP van one-off
badges zit daarmee in het afgeleide totaal en dus niet dubbel (zie 2). (5) Het herstel is stil: `settleXp(id, { quiet: true })`, geen
pops, geen level-up-venster; daarna `refreshUnlocks()` zodat de avatar-onderdelen van de badges en het level weer vrij zijn. (6) Alleen voor
een kaartje dat een profiel op deze telefoon is (`cardStatus` 'local', op id óf naam) én met badges aan én met `card.xp` hoger dan het huidige
totaal; anders geen knop (badges uit: één regel die zegt Badges eerst aan te zetten). (7) `xp.carried` reist mee in de back-up (geen
device-local setting). (8) Niets hiervan raakt de deellink van recepten of het weekplan.

**Feitencheck (Fable, in de code).** `src/domain/share.ts`: `ProgressCard { id, name, color, lang, deviceId?, rv, level, xp, streak, badges:
string[], cookDays: [{ d: dagsleutel, r: receptIds[] }], avatar? }`, `buildProgressEnvelope(card)` (r. 541: spreidt `card`, `baseEnvelope('x',
name)` zet `at` = nu), `buildProgressShareMessage({ name, level, title, url, lang })` (r. 936), `PROGRESS_BADGE_RE`. `src/domain/progress.ts`:
`ProgressSnapshot extends ProgressCard { receivedAt; friend }`, `progressCardFor`, `cookDaysIn30`, `normalizeSnapshots`; `src/domain/days.ts`:
`dayFromKey`, `dayKey`, `dayIndexOfIso`. `src/domain/xp.ts`: `XpFacts { log, recipes, photos, ownRecipes, badges, challenges? }`, `XpEventKind =
'cook' | 'week' | 'photo' | 'recipe' | 'badge' | 'challenge'`, `XpEvent { kind, key, base, factor, xp, crit, reason, at?, day?, recipeId? }`,
`deriveXp(facts, rules, today)` (r. 346: `total` = som van de events), `XpState { total, level, levelStart, nextAt, streak, cookDays, events, byKey }`.
`src/xp.ts`: `buildXpFacts(memberId)`, `xpStateFor(memberId)` (gememoiseerd), `markXpDirty`, `settleXp(memberId, { quiet })`, `XP_SEEN_RULES_SETTING`;
`src/components/XpPop.tsx` `POP_KINDS` (photo, recipe). `src/badges.ts`: `BADGES_EARNED_SETTING = 'badges.earned'` (Record<memberId | 'all',
string[]>), `normalizeEarned`, `registerSilently`, `registerEarnedSilently`, `recheckActiveBadges`; `src/unlocks.ts` `refreshUnlocks()`.
`src/db/repo.ts`: `logCooked(entry)` (r. 812; `CookLogEntry { recipeId, profileId, at, stars?, note?, loggedAt?, variant? }`), `getProgressSnapshots`,
`putProgressSnapshot`, `getSetting`/`setSetting`, `exportBundle`/`importBundle` (settings reizen mee behalve `DEVICE_LOCAL_SETTINGS`).
`src/components/ProgressSharePanel.tsx`: `buildProgressMessage(p: Profile)` (bouwt kaart + token + url + zin), `ProgressSharePanel` (intro,
Deel, Kopieer link, Toon QR, status; `shareText` met één veld, logt 'out' kind 'progress'), `ProgressShareToggle`. `src/screens/HouseholdScreen.tsx`:
`applyProgressCard(card, asFriend)` (r. 261; 'local' → niets), `ProgressOutcome = 'added' | 'updated' | 'friend' | 'local'`, `ProgressCardRow`
(r. 300: toont bij 'local' `household.cardLocal`), ledenrijen met Bewerk/Verwijder en `MemberLevelLine snapshot={snapshots?.[m.id]}`, de kaart
Vrienden met `removeFriend`; `src/screens/InboxScreen.tsx` rendert dezelfde `ProgressCardRow` (r. 666 `saveProgress`). i18n progress.* in
src/i18n/xp.ts, household.* in src/i18n/settings.ts. Handboek 05: `delen-en-ontvangen.voortgang-delen`, `.voortgang-ontvangen`. DEVICE-TEST: rij
122 is de laatste; dit blok krijgt rij 123.

### 1. Gedrag

#### 1a. Domein en app-laag (bouwer A: `src/domain/progress.ts`, `src/domain/xp.ts`, `src/xp.ts`, `src/progress-restore.ts` [nieuw],
`src/db/repo.ts` (één setting-sleutel + één bulk-schrijver), `tests/progress.test.ts`, `tests/xp.test.ts` (of de bestaande xp-testbestanden))

- `src/domain/progress.ts`:
  - `export function cardOfSnapshot(s: ProgressSnapshot): ProgressCard` — alle kaartvelden, zonder `receivedAt` en `friend` (test: de sleutels).
  - `export interface RestorePlan { cooks: Array<{ recipeId: string; at: string }>; badges: string[]; cookDaysAdded: number; badgesAdded: number }`
  - `export function planProgressRestore(card: ProgressCard, existing: { cooks: ReadonlyArray<{ recipeId: string; at: string }>; earned: readonly string[] }): RestorePlan`
    — per `cookDays[{d, r}]` en per recept-id in `r`: een kook op dag `d` om 18:00 lokale tijd (`at` = ISO van `dayFromKey(d)` + 18 uur; ongeldige
    `d` overslaan), tenzij `existing.cooks` al een kook van dat recept op diezelfde lokale dag heeft; `badges` = vereniging van `existing.earned`
    en `card.badges` (volgorde: bestaande eerst, dan nieuwe; alleen strings die `PROGRESS_BADGE_RE` haalt). Tests: dubbele dag/recept overgeslagen,
    twee recepten op één dag = twee koks, ongeldige dagsleutel weg, badges-vereniging zonder dubbelen.
  - `export function carriedXpFor(cardXp: number, derivedTotalWithoutCarried: number): number` — `max(0, round(cardXp − derived))`; test.
- `src/domain/xp.ts`: `XpFacts.carried?: number` (overgedragen XP, ≥ 0); `XpEventKind` krijgt `'carried'`; `deriveXp` voegt, als `carried > 0`,
  ná alle andere events één event toe `{ kind: 'carried', key: 'carried', base: carried, factor: 1, xp: carried, crit: null, reason: null }` zodat
  `total`, level, `levelStart` en `nextAt` het meetellen. Tests: zonder carried identiek aan nu; met carried 5000 stijgt total met 5000 en volgt het
  level de curve; het event staat in `events` en `byKey`.
- `src/xp.ts`: `buildXpFacts(memberId)` leest de setting `xp.carried` (Record<memberId, number>, `XP_CARRIED_SETTING`) en zet `facts.carried`;
  een ongeldig getal = 0. `POP_KINDS` (xp.ts én XpPop.tsx) blijft zonder 'carried'; bestaat er een vertaaltabel per soort (`xp.kind.*`), dan
  `'carried'`: "Overgedragen" · "Carried over" (bouwer B voegt de key toe als bouwer A hem meldt).
- `src/db/repo.ts`: `export const XP_CARRIED_SETTING = 'xp.carried'`; `getCarriedXp(): Promise<Record<string, number>>`, `setCarriedXp(memberId, xp)`;
  `addCookEntries(entries: Omit<CookLogEntry, 'id'>[]): Promise<void>` (bulkAdd in één transactie; `loggedAt` = nu als het ontbreekt). Niet in
  `DEVICE_LOCAL_SETTINGS`.
- `src/progress-restore.ts` [nieuw]: `export async function restoreProgress(profileId: string, card: ProgressCard): Promise<{ level: number; total: number;
  cookDaysAdded: number; badgesAdded: number }>`:
  1. `existing` = kooklog van dit profiel (`recipeId`, `at`) + `badges.earned[profileId]` → `plan = planProgressRestore(card, existing)`;
  2. `addCookEntries(plan.cooks.map(c => ({ ...c, profileId, loggedAt: now, note: null })))`; `badges.earned[profileId] = plan.badges` (via `setSetting`
     met `normalizeEarned`, zoals `registerSilentlyFor`);
  3. `setCarriedXp(profileId, 0)`; `markXpDirty(profileId)`; `derived = await xpStateFor(profileId)`; `carried = carriedXpFor(card.xp, derived.total)`;
     `setCarriedXp(profileId, carried)`; `markXpDirty(profileId)`; `state = await xpStateFor(profileId)`;
  4. `await settleXp(profileId, { quiet: true })`; `await refreshUnlocks()`; `recheckActiveBadges()`; log één 'in'-rij (kind 'progress', who =
     card.name, count 1) zoals `applyProgressCard`;
  5. geef `{ level: state.level, total: state.total, cookDaysAdded, badgesAdded }` terug. Fouten gooien door (de UI toont `common.error`).

#### 1b. UI, teksten, handboek, testrij (bouwer B: `src/components/ProgressSharePanel.tsx`, `src/screens/HouseholdScreen.tsx`,
`src/screens/InboxScreen.tsx`, `src/i18n/xp.ts`, `src/styles/settings.css` (alleen als nodig), `data/handbook/05-delen-en-ontvangen.json`,
`docs/HANDLEIDING.md` + `docs/HANDBOOK.md`, `docs/DEVICE-TEST.md`)

- **Stuur terug** (de andere telefoon). In `ProgressSharePanel.tsx` een tweede paneel `ProgressReturnPanel({ snapshot })`, dezelfde opbouw als
  `ProgressSharePanel` (intro, **Deel**, **Kopieer link**, de iPhone-regel, status) maar gebouwd uit `cardOfSnapshot(snapshot)`: envelop via
  `buildProgressEnvelope`, daarna `env.at = snapshot.receivedAt`, token, url, zin via `buildProgressShareMessage({ name, level, title:
  titleFor(level, lang), url, lang })` met `lang` van de snapshot. Geen QR. Na een share via het deelvenster één 'out'-rij (kind 'progress',
  who = de naam). In HouseholdScreen: op elke ledenrij van een lid van een andere telefoon mét snapshot (`snapshots?.[m.id]`) en op elke
  vriendenrij een knop **Stuur terug** (`progress.returnBtn`, btn-small, naast Bewerk/Verwijder resp. Verwijder) die het paneel onder die rij
  open- en dichtklapt (één tegelijk). Met badges uit: geen knop (de voortgang is dan onzichtbaar, zoals de hele kaart).
- **Herstel mijn voortgang** (de eigen telefoon). `ProgressCardRow` krijgt `onRestore?: (card, profileId) => void` en `ProgressOutcome` de waarde
  `'restored'`. Bij status 'local' (de kaart hoort bij een profiel op deze telefoon, op id óf naam — `matchMemberForCard` geeft het lid; zijn
  `id` is het profiel-id): lees het huidige totaal (`xpStateFor(profileId)`, in een effect) en toon:
  - badges uit: `progress.restoreBadgesOff`;
  - `card.xp` ≤ huidig totaal: de bestaande regel `household.cardLocal` (niets te herstellen);
  - anders: `progress.restoreHint` + knop **Herstel mijn voortgang** (`progress.restoreBtn`, btn-primary). Tik → `confirm(progress.restoreConfirm)`
    → `onRestore(card, profileId)`; de schermen roepen `restoreProgress` aan (busy-stand zoals `cardBusy`), zetten `done` op 'restored' en tonen
    `progress.restored` met het nieuwe level; bij een fout `common.error`. Beide schermen (In & uit en Huishouden & vrienden) wiren het.
- i18n (xp.ts), letterlijk NL · EN:
  `progress.returnBtn`: "Stuur terug" · "Send back";
  `progress.returnIntro`: "Stuur {name} de voortgang terug die je van hem bewaarde: level {level}, bewaard op {date}. Handig als zijn telefoon leeg is: hij kan er zijn level, badges en kookdagen mee terugzetten." · "Send {name} back the progress you kept: level {level}, saved on {date}. Useful when their phone is empty: they can restore their level, badges and cooking days from it.";
  `progress.restoreBtn`: "Herstel mijn voortgang" · "Restore my progress";
  `progress.restoreHint`: "Dit is jouw eigen voortgang van {date}: level {cardLevel} met {xp} XP, {badges} badges en {days} kookdagen. Hier staat nu level {level}. Je kunt hem terugzetten." · "This is your own progress from {date}: level {cardLevel} with {xp} XP, {badges} badges and {days} cooking days. This phone is at level {level}. You can restore it.";
  `progress.restoreConfirm`: "Je voortgang terugzetten naar level {cardLevel}? Je badges en de kookdagen van die 90 dagen komen terug; wat je sindsdien kookte blijft staan." · "Restore your progress to level {cardLevel}? Your badges and the cooking days of those 90 days come back; what you cooked since stays.";
  `progress.restored`: "Voortgang hersteld: level {level}, {days} kookdagen en {badges} badges teruggezet." · "Progress restored: level {level}, {days} cooking days and {badges} badges put back.";
  `progress.restoreBadgesOff`: "Dit is jouw eigen voortgang. Zet eerst Badges aan onder Meer om hem terug te zetten." · "This is your own progress. Switch Badges on under More first to restore it.";
  (`xp.kind.carried` alleen als bouwer A die tabel meldt.)
- Handboek 05: nieuwe rij ná `voortgang-ontvangen`, id `delen-en-ontvangen.voortgang-terugsturen`, route `/more/household`, platform all: title
  "Iemands voortgang terugsturen" · "Send someone's progress back"; what "Deelde iemand zijn voortgang met jou, dan bewaart je telefoon die. Is zijn
  telefoon leeg, dan stuur je hem die voortgang terug en kan hij zijn level, badges en kookdagen terugzetten." · "If someone shared their progress
  with you, your phone keeps it. If their phone is empty, you send that progress back and they can restore their level, badges and cooking days.";
  where nl ["Tik onderaan op **Meer** en dan op **Huishouden & vrienden**.", "Zoek de persoon onder Huisgenoten of Vrienden.", "Tik op **Stuur terug**.",
  "Tik op **Deel** en kies WhatsApp."] · en ["Tap **More** at the bottom, then **Household & friends**.", "Find the person under Housemates or
  Friends.", "Tap **Send back**.", "Tap **Share** and choose WhatsApp."]; see "WhatsApp opent met een zin over het level van die persoon en één
  link, net als bij Sync mijn voortgang." · "WhatsApp opens with a sentence about that person's level and one link, just like Sync my progress.";
  know "Het is de voortgang zoals jij hem kreeg, niet van dit moment. Wat de ander sindsdien kookte, zit er niet in." · "It is the progress as you
  received it, not of this moment. What the other person cooked since is not in it."; keywords nl ["terugsturen", "voortgang", "level kwijt",
  "telefoon leeg", "herstellen"] · en ["send back", "progress", "lost level", "empty phone", "restore"].
  Tweede nieuwe rij erna, id `delen-en-ontvangen.voortgang-herstellen`, route `/inbox`, platform all: title "Je eigen voortgang terugzetten" ·
  "Restore your own progress"; what "Is je telefoon leeg (nieuwe telefoon, of de opslag van de app gewist), dan kun je je level, badges en kookdagen
  terugzetten uit de voortgang die iemand anders van je bewaarde." · "If your phone is empty (a new phone, or the app's storage cleared), you can
  restore your level, badges and cooking days from the progress someone else kept of you."; where nl ["Vraag die persoon om **Stuur terug** te
  tikken bij jouw naam.", "Kopieer het bericht.", "Tik onderaan op **Meer** en dan op **In & uit**.", "Tik op **Plak van klembord**.", "Tik op
  **Herstel mijn voortgang**.", "Bevestig."] · en ["Ask that person to tap **Send back** next to your name.", "Copy the message.", "Tap **More** at
  the bottom, then **In & out**.", "Tap **Paste from clipboard**.", "Tap **Restore my progress**.", "Confirm."]; see "Je level en XP staan weer
  op wat ze waren, je badges zijn terug en de kookdagen van de laatste 90 dagen staan weer in de kalender. Geen confetti: het is herstel, geen
  prestatie." · "Your level and XP are back to what they were, your badges are back and the cooking days of the last 90 days are in the calendar
  again. No confetti: it is a repair, not an achievement."; know "Het werkt alleen als de bewaarde voortgang hoger is dan wat er nu staat, en
  alleen met **Badges** aan. Kookdagen van langer dan 90 dagen geleden tellen mee in je XP, maar staan niet als losse dagen in de kalender. Notities,
  sterren en foto's komen niet terug; eigen recepten kan de ander je apart terugsturen. Maak daarom af en toe een back-up onder **Opslag**." · "It
  only works when the kept progress is higher than what is there now, and only with **Badges** on. Cooking days from more than 90 days ago count in
  your XP but are not in the calendar as separate days. Notes, stars and photos do not come back; your own recipes the other person can send back
  separately. So make a backup under **Storage** now and then."; keywords nl ["herstellen", "voortgang", "level kwijt", "badges kwijt", "opslag gewist"]
  · en ["restore", "progress", "lost level", "lost badges", "storage cleared"]. Controleer met `npm run validate:data` dat elke **naam** letterlijk in
  src/i18n staat (**Opslag**/**Storage**, **Badges**, **In & uit**/**In & out**, **Plak van klembord**/**Paste from clipboard**); ontbreekt er een, meld
  het. Daarna `node --experimental-strip-types tools/handbook-md.ts`.
- DEVICE-TEST rij 123, NL én EN, in de stijl van rij 122, met twee telefoons: **Voortgang terugsturen en terugzetten (V1c-9).** 1. *Telefoon A
  (Gabi):* tik op **Meer** → **Huishouden & vrienden**, zoek Stijn en tik op **Stuur terug**; tik op **Deel** en stuur het via WhatsApp naar Stijn.
  2. *Telefoon B (Stijn, met badges aan en een lager level dan in het bericht):* kopieer het hele bericht, tik op **Meer** → **In & uit** → **Plak
  van klembord**. 3. Tik op **Herstel mijn voortgang** en bevestig. 4. Kijk op Home, Mijn profiel, Badges en de Kookkalender. 5. Plak hetzelfde
  bericht nog eens. | 1. Onder de rij van Stijn klapt een paneel open met "Stuur Stijn de voortgang terug …, level N, bewaard op <datum>" en
  Deel/Kopieer link; WhatsApp opent met de levelzin en één link. 2. De kaart zegt "Voortgang van Stijn" met daaronder "Dit is jouw eigen
  voortgang van <datum>: level N met … XP, … badges en … kookdagen. Hier staat nu level M." en de knop **Herstel mijn voortgang**. 3. Een vraag om
  te bevestigen; daarna "Voortgang hersteld: level N, … kookdagen en … badges teruggezet." zonder confetti of pops. 4. Home en Mijn profiel tonen
  level N met het bijbehorende XP; de badges staan op Badges als behaald; de kookdagen staan in de kalender; de avatar-onderdelen van die badges
  en dat level zijn vrij. 5. De kaart zegt nu alleen dat je dit zelf bent (niets te herstellen): het totaal is niet lager meer.

### 2. Opus mag dit NIET zelf beslissen
- Het `#x=`-token en `buildProgressEnvelope` veranderen niet; `receivedAt`/`friend` reizen niet mee; `at` = `receivedAt`.
- Overgedragen XP als `xp.carried` (één getal per profiel) met de formule uit 1a; geen opgeslagen "level"; geen aanpassing van de curve of de regels.
- Teruggezette kookdagen: 18:00 lokale tijd, `loggedAt` nu, dubbele dag/recept overgeslagen; badges als vereniging, stil; herstel zonder pops of
  level-up-venster; alleen bij 'local', badges aan en een hoger totaal op het kaartje.
- Teksten letterlijk; geen nieuwe dependency.

### 3. Bestandsverdeling
| Bouwer | Bestanden |
|---|---|
| A | `src/domain/progress.ts`, `src/domain/xp.ts`, `src/xp.ts`, `src/progress-restore.ts` [nieuw], `src/db/repo.ts`, `src/components/XpPop.tsx` (alleen als het type het vraagt), `tests/progress.test.ts`, de bestaande xp-tests |
| B | `src/components/ProgressSharePanel.tsx`, `src/screens/HouseholdScreen.tsx`, `src/screens/InboxScreen.tsx`, `src/i18n/xp.ts`, `src/styles/settings.css` (alleen als nodig), `data/handbook/05-delen-en-ontvangen.json`, `docs/HANDLEIDING.md` + `docs/HANDBOOK.md`, `docs/DEVICE-TEST.md` (rij 123 NL + EN) |
| Integrator | samenvoegen, check/test/build/validate groen, acceptatie in de dev-app (NL/EN: Stuur terug-paneel onder een lid met snapshot — maak er een door een `#x=` te plakken; Herstel-knop op een eigen kaart met hoger XP: plak een `#x=` met de naam van het dev-profiel en een hoog `xp`, controleer level, badges en kalender; nogmaals plakken = niets te herstellen), `docs/STATUS.md`, de regel "Gebouwd" in dit blok |

Bouwer B bouwt tegen de handtekeningen van 1a (`cardOfSnapshot`, `restoreProgress`); ontbreken ze nog, dan een minimale stub en melden; de
integrator houdt A's versie.
