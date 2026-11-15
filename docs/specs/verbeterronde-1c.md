# Spec V1c — Testronde-feedback na V1–V9 (Stijn, vanaf 9 nov 2026)

Status: punt 1 compleet (9 nov), punten 3, 7 en 8 direct gebouwd (10–15 nov), punt 9 compleet (15 nov); V1c-2 compleet (15 nov); de rest van de lijst verzamelt. Elk punt dat Stijn laat bouwen,
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
| 9b | 15 nov | "De Stuur terug-knop is er nog niet op Gabi's telefoon" (na de deploy van V1c-9). | De knop stond alleen bij een lid met een snapshot onder precies zijn id (`snapshots[m.id]`). Een kaartje dat op naam matcht vervangt het id van het lid door het id van het kaartje (`upsertMemberFromCard`), en een gewiste telefoon stuurt een nieuw profiel-id: Stijns oude, hoge voortgang stond onder zijn oude id, zijn rij had zijn nieuwe id → geen knop, en de levelregel toonde niets/het nieuwe. Zelfde oorzaak als "level werkt niet bij" (punt 7-achtig). | Direct gebouwd door Fable: `snapshotsForMember` (op id, anders telefoon-id, anders naam), de levelregel neemt de nieuwste, Stuur terug de hoogste XP; ook op Meer. Tests. | — (gebouwd 15 nov). Uitkomst: Gabi had alleen zijn kaartje (avatar), nooit een voortgang; niets terug te sturen, Stijn begint opnieuw. |
| 10 | 15 nov | Gabi (getypt op Stijns laptop): een eigen easter egg omdat ze jaloers is op goud: een panterprint-thema met meerdere kleuren en een masker voor de avatar; Stijn wil niet weten hoe het vrijspeelt. | Zelfde plumbing als het gouden thema (device-local vrijspelen, tegel op Jouw stijl → Thema); avatar-onderdelen kenden alleen level- en badge-ontgrendeling. | Blok V1c-10 in **docs/specs/ei-gabi.md** (SPOILER: Stijn, niet openen): thema Panter met vier kleuren (Klassiek, Roze, Sneeuwpanter, Paars), masker Pantermasker onder Bril, nieuw ontgrendelsoort egg. DEVICE-TEST rij 125 zonder de manier. | — (gebouwd 15 nov; lens: controle op de hele regel, testrij zonder het scherm; daarna V1c-10b, rij 11) |
| 11 | 15 nov | Gabi (via Stijn, met twee voorbeeldfoto's): "het ziet eruit als goud-modus met een schrale achtergrond; ik wil ook hot pink & black (twee panteropties); de letters zijn goud, sommige bruin en sommige geel is beter; begin opnieuw." Tijdens het bouwen: "nu ziet het eruit als tepels, blijf dichter bij mijn voorbeelden"; "die panterconfetti is echt een goed idee, ook het masker, maak wel mooi". | Het printje van V1c-10 bestond uit vier radial-gradients in lage alpha op een donker goudachtig thema; vier kleuren die alleen het accent verschoven. | V1c-10b (spec ei-gabi.md §1d–§1f): echt printje als SVG-tegel uit `tools/panter-tile.py` (kern vult de ring), één blad `panter.css`, twee smaken (Klassiek licht, Hot pink & zwart donker), zwarte balken, crème/zwarte labels zodat tekst nooit los op het printje staat, panterconfetti als eigen look, nieuw masker. | — (gebouwd 15 nov door Fable zelf, in de dev-app beoordeeld) |
| 12 | 15 nov | Stijn: "de randomizer-badge is kapot: je kunt 365 keer Verras me spammen en dan speel je alle levels vrij; beperk tot max 10 per dag voor de badge, zonder dat te laten weten; andere makkelijk te cheaten badges ook." | Feature-events (`features.log`, src/domain/features.ts) telden elke tik; de tiers van zulke badges geven XP, dus levels. Alleen badges met tiers zijn te spammen; eenmalige badges hebben aan één keer genoeg. | Blok V1c-11 hieronder: `DAILY_CAPS` per feature-id, stil, per lokale dag; verdiende badges blijven. | — (gebouwd 15 nov) |

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

## Ontwerp V1c-2 — Mensen en sturen: huisgenoten en vrienden met een wisselbare rol, één plakvak, één stuurpaneel (Stijn 15 nov: "bouw maar" → spec hieronder)

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

Status: compleet (Fable, 15 nov 2026). Twee bouwers + integrator (lichte modus). Leidend bij tegenspraak: docs/specs/README.md §2–§4,
docs/specs/xp-levels.md (§1h delen, §1i ontvangen, §2 de regels), docs/specs/badges-avatar.md, CLAUDE.md invariant 4 (het `#x=`-token
verandert niet: het blijft precies het kaartje dat `buildProgressEnvelope` al maakt) en 14 (geen backend: herstellen gaat via een bericht).
Gebouwd: 15 nov 2026 (V1c-9, lichte workflow wf_ad149019-c9f; lens: twee bevindingen, besluiten Fable: (1) `registerEarnedSilently()` direct na het schrijven van de badges — vóór de overgedragen XP en vóór de hercontrole — zodat ook de ladders van Samen stil geregistreerd worden en de hercontrole niets nieuws vindt (geen toast, geen confetti; het totaal blijft exact het kaartje); (2) bij "niets te herstellen" blijft de bestaande regel `progress.local`, de spec noemde per abuis `household.cardLocal`; integrator: rij met drie knoppen (`has-return`) zet de knoppen op een eigen regel; gate: "1 badges" in de hint is bekend en cosmetisch)

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
(r. 300: toont bij 'local' `progress.local`, "… — die voortgang zie je al."), ledenrijen met Bewerk/Verwijder en `MemberLevelLine snapshot={snapshots?.[m.id]}`, de kaart
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
  - `card.xp` ≤ huidig totaal: de bestaande regel `progress.local` ("… — die voortgang zie je al."; niets te herstellen);
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

---

## Blok V1c-2 — Mensen en sturen (spec)

Status: compleet (Fable, 15 nov 2026). Vier bouwers + integrator (lichte modus). Leidend bij tegenspraak: docs/specs/README.md §2–§4,
docs/specs/handbook.md §4, CLAUDE.md invariant 4 (de tokens `#f=` en `#x=` en hun codecs veranderen NIET; alleen de zinnen eromheen en de UI),
5 (iPhone: plakken blijft de weg), 9 (`navigator.share` met precies één veld), 14 (geen backend). Het ontwerp hierboven is de bedoeling; dit
blok is de uitwerking. Bron: Stijn 9 en 15 nov ("ik wil Voeg vriend toe én Voeg huisgenoot toe, één plakveld, Stuur voortgang / Stuur recepten
met één deelknop, elke vriend Maak huisgenoot en andersom, het woord kaartje is onduidelijk"; 15 nov: "waarom is kaartje en voortgang nou weer
iets anders 😞").
Gebouwd: 15 nov 2026 (V1c-2, lichte workflow wf_6b2995e5-10a; lens: twee bevindingen; besluiten Fable: restore draait de rollenmigratie geforceerd opnieuw (Opslag), `snapshotsForMember` niet meer op telefoon-id alleen, `buildProgressShareMessage` ongewijzigd; integrator: `household.members` (Huisgenoten) als aria-label van de Badges-tabbladen, dode keys `badges.members`/`progress.update`/`progress.friends` weg; fixer: DEVICE-TEST rij 100)

**Kritische lezer (Fable, vooraf).** (1) Twee tokens blijven bestaan omdat badges uit kunnen staan: `#x=` (voortgang: wie je bent + level,
badges, kookdagen) en `#f=` (alleen wie je bent). De gebruiker ziet één ding, **Mijn voortgang** (badges aan) of **Wie ik ben** (badges uit);
de ontvanger ziet "voortgang van Gabi" of "wie Gabi is" en kiest de rol. Niets reist anders dan nu. (2) Een vriend wordt een `Member` met
`role: 'friend'`; de oude vrienden-snapshots (`friend: true` zonder lid) migreren één keer bij boot naar zo'n lid. De vlag `friend` op de
snapshot blijft staan (oude back-ups) maar niemand leest hem meer. (3) Wie leest huisgenoten alleen: de Samen-badges (`householdMembers`),
de Badges-tabbladen, Het verhaal; wie leest iedereen: kookkalender, afzenders in In & uit, ontvangers van Stuur en van Deel je nieuwe recepten,
fotonamen op een recept, Meer (met labeltje). Lijstjes en porties kennen geen leden (het huishoudenaantal is een getal) — ongewijzigd.
(4) De rol wisselt met één tik en zonder bevestiging; de snapshot en de kookdagen blijven aan de persoon hangen (id verandert niet).
(5) Eén plakvak op Huishouden & vrienden, in het toevoeg-paneel; In & uit houdt zijn eigen vak. (6) Het Stuur-venster bouwt zijn delen uit
bestaande bouwstenen: de voortgangszin (`ProgressSharePanel.buildProgressMessage`), de wie-ik-ben-zin (`MemberCardPanel`), en de deltadelen
(`DeltaShareScreen`, V2: tot 20 KB per bericht, meerdere delen, bestand alleen als één envelop niet past). Die logica verhuist naar
`src/sendto.ts` zodat venster én scherm dezelfde code gebruiken; het scherm `/share` blijft bestaan onder Recepten & delen. (7) Het woord
"kaartje" (en "lid"/"leden") verdwijnt uit UI, deelzinnen, landing, handboek en DEVICE-TEST; de tokens, ids en bestandsnamen niet.
(8) Stuur terug (V1c-9) blijft een eigen knop op de rij van wie een bewaarde voortgang heeft; Herstel mijn voortgang blijft op een eigen
ontvangen voortgang. (9) V1c-1's blok Vrienden, typ-kaartje en plakkaart gaan op in het nieuwe scherm; de teksten van V1c-1 die blijven
(titel, huisgenoten) blijven. (10) Validator: elke `**naam**` in het handboek moet letterlijk in src/i18n staan — bouwer D levert i18n én
handboek en draait `npm run validate:data`.

**Feitencheck (Fable, in de code).** `src/domain/household.ts`: `Member { id, name, color, lang?, local, deviceId?, avatar? }`, `HouseholdSetting
{ name, members }` (alleen niet-lokale leden), `membersFrom(profiles, setting)` (profielen eerst), `memberFromProfile`, `memberFromCard(card)`,
`matchMemberForCard` (id, anders naam), `upsertMemberFromCard` (het id van het kaartje wint), `putMember`, `removeMember`, `cardFromMember`,
`MemberCard` type. `src/domain/progress.ts`: `ProgressSnapshot`, `cardOfSnapshot`, `snapshotForMember`/`bestSnapshotForMember`/`snapshotsForMember`
(V1c-9b). `src/db/repo.ts`: `getHousehold/setHousehold`, `getProgressSnapshots/putProgressSnapshot/removeProgressSnapshot`, `getLastSentTo/markSentTo`
(`share.lastSentTo` per naam), `ensureDeviceId`, `logShareEvent`. `src/screens/HouseholdScreen.tsx` (±900 r.): `applyMemberCard`, `applyProgressCard`,
`cardStatus`, `MemberCardRow`, `ProgressCardRow` (met V1c-9 restore), `FoundCards`/`scanCards` (de plakscan), `MemberForm`, de kaarten Naam, Mijn
kaartje (`MemberCardPanel` + `ProgressShareToggle`), Huisgenoten (rijen met Stuur terug/Bewerk/Verwijder), Vrienden (V1c-1 + 9b orphans), Plak een
kaartje of voortgang (`UniversalPaste` + kaartrijen), Typ een huisgenoot. `src/screens/InboxScreen.tsx`: rendert `MemberCardRow`/`ProgressCardRow`
(r. 838–850) met `addCard`/`saveProgress`/`restore`; `householdMembers` + `friendMembers()` uit snapshots voor afzenders. `src/screens/ProfileScreen.tsx`:
tegels 📇 Deel mijn kaartje (`MemberCardPanel`), 📈 Sync mijn voortgang (`ProgressSharePanel`), ✏️ Bewerk. `src/screens/ProfilesScreen.tsx`:
`MemberCardPanel` (bouwt `#f=` via `cardFromMember(p, deviceId)` + `buildMemberEnvelope` + `buildMemberShareMessage`). `src/components/ProgressSharePanel.tsx`:
`buildProgressMessage(p)`, `ProgressSharePanel`, `ProgressShareToggle`, `ProgressReturnPanel` (V1c-9). `src/screens/DeltaShareScreen.tsx`: partner
(leden eerst, dan eerder-naar-gestuurd, dan vrije naam), `DeltaSince` via repo, `planMessages` (V2), `logDeltaShared`, `markSentTo`. Lezers van
`membersFrom`: src/badges.ts r. 189 (`householdMembers`), BadgesScreen r. 560/564 (tabbladen), CalendarScreen r. 168–180 (leden + vrienden uit
snapshots), DeltaShareScreen r. 167, InboxScreen r. 418, MoreScreen r. 521–526 (huisgenoten + vrienden uit snapshots, labeltjes `more.friend`),
RecipeScreen r. 318 (fotonamen), StoryScreen r. 45. `src/domain/share.ts`: `buildMemberShareMessage` r. 919 ("👋 Kaartje van …"),
`buildProgressShareMessage` r. 936. `src/landing.ts` r. 74–75 en 140–141 (previewMember, memberOf). `src/paste.ts` `membersLabel` (paste.card/cards).
i18n met "kaartje"/"card"/"lid": settings.ts (`household.*`: fromCard, myCard, myCardHint, shareCard, copyCard, cardShared, cardCopied,
cardBuildFailed, cardIosHint, cardQrAlt, addViaLink, addViaLinkHint, noCard, cardFrom, addCard, updateCard, cardKnown, cardLocal, cardAdded,
cardUpdated, cardFailed, intro, r. 235; `profile.shareCard`), edit.ts (`paste.card/cards/cardsOne`, `paste.hint` r. 200, `inbox.hint` r. 365,
`inbox.ev.member`, `inbox.noToken`), xp.ts (`progress.saveFriend`, commentaar r. 93). Handboek met "kaartje"/"lid": 05 (wat-kun-je-delen,
ontvangen-iphone, link-iphone, in-en-uit, kaartje-delen, lid-toevoegen, vriend-toevoegen, huishouden, voortgang-delen, voortgang-ontvangen,
voortgang-terugsturen, voortgang-herstellen), 01 browsermelding, 02 tip-van-de-maker, 04 lijst-ontvangen, 07 samen/mijn-profiel/avatar-maken/
avatar-zeldzaam. DEVICE-TEST met "kaartje": rijen 52, 58, 62, 71, 88, 95, 97, 105, 106, 108, 109, 116, 120 (en 123 noemt Stuur terug); laatste rij
123, dit blok krijgt rij 124. Tests: tests/household.test.ts, tests/progress.test.ts, share-tests die `buildMemberShareMessage` controleren.

### 1. Gedrag

#### 1a. Model, migratie en lezers (bouwer A: `src/domain/household.ts`, `src/people.ts` [nieuw], `src/db/repo.ts`, `src/app.tsx` (één regel),
`src/badges.ts`, `src/screens/BadgesScreen.tsx`, `src/screens/CalendarScreen.tsx`, `src/screens/MoreScreen.tsx`, `src/screens/StoryScreen.tsx`,
`src/screens/DeltaShareScreen.tsx` (alleen de partnerlijst), `src/screens/RecipeScreen.tsx` (niets, tenzij het type het vraagt), `tests/household.test.ts`)

- `export type MemberRole = 'housemate' | 'friend'`; `Member.role?: MemberRole` (afwezig = huisgenoot; `normalizeHousehold` laat alleen de
  twee waarden door). `export function roleOf(m: Pick<Member,'local'|'role'>): MemberRole` (lokaal = altijd huisgenoot);
  `housematesOf(members)`, `friendsOf(members)`. `membersFrom` blijft iedereen teruggeven (huisgenoten eerst, dan vrienden, binnen een groep
  de bestaande volgorde). `upsertMemberFromCard(h, card, role?)`: een nieuw lid krijgt `role` (default huisgenoot); een bestaand lid HOUDT zijn
  rol (een kaart wijzigt nooit een rol). `setRole(h, id, role)` (puur). Tests: roleOf, de volgorde, rol blijft bij een update, setRole.
- `export function friendMembersFromSnapshots(snapshots, members): Member[]` (puur, in household.ts of progress.ts): voor elke snapshot met
  `friend === true` die bij geen enkel lid past (`matchMemberForCard`) een lid uit de kaartvelden (`memberFromCard`-regels: id, name, color, lang,
  deviceId?, avatar?) met `role: 'friend'`, `local: false`. Test.
- `src/people.ts` [nieuw] (app-laag, Dexie via repo):
  - `migrateFriendSnapshots()`: eenmalig (setting `household.rolesMigrated` = 1): de leden uit `friendMembersFromSnapshots` toevoegen aan de
    setting; daarna de vlag. Aangeroepen in `src/app.tsx` direct na `loadProfiles()` (één regel, bouwer A).
  - `applyPersonCard(card: MemberCard | ProgressCard, role: MemberRole): Promise<{ outcome: 'added' | 'updated' | 'local'; setting }>`:
    `cardStatus` (verhuist uit HouseholdScreen naar hier) 'local' → niets; 'known' → `upsertMemberFromCard` (rol blijft); 'new' → toevoegen met
    `role`; is het een voortgang (`'xp' in card`) → `putProgressSnapshot({ ...card, receivedAt: nu, friend: role === 'friend' && outcome === 'added' })`
    — voor een bekend lid `friend: roleOf(lid) === 'friend'`; één 'in'-logrij (kind 'member' of 'progress'). Vervangt `applyMemberCard` en
    `applyProgressCard`; bouwer B roept deze aan.
  - `setMemberRole(id: string, role: MemberRole): Promise<HouseholdSetting>` (lokale profielen nooit).
- Lezers: `src/badges.ts` r. 189 `householdMembers` = `housematesOf(...).length`; BadgesScreen r. 560/564 tabbladen = huisgenoten; StoryScreen =
  huisgenoten; MoreScreen: `housemates` = huisgenoten behalve de actieve, `friends` = vrienden (als `Member`, labeltje `more.friend`), snapshot per
  persoon via `snapshotForMember`; de losse vrienden-uit-snapshots-code verdwijnt (`FriendMenuRow` krijgt een `Member` + snapshot). CalendarScreen:
  `people` = alle leden (huisgenoten én vrienden) met `snapshotForMember` (de losse snapshot-lus met `s.friend` vervalt); DeltaShareScreen partnerlijst
  = alle leden (vrienden ook); InboxScreen: `householdMembers` = alle leden, `friendMembers()` vervalt (bouwer B doet die regel, omdat B het bestand
  bezit — A meldt het); RecipeScreen ongewijzigd.

#### 1b. Huishouden & vrienden en de ontvangen kaarten (bouwer B: `src/screens/HouseholdScreen.tsx`, `src/components/PersonCardRow.tsx` [nieuw],
`src/screens/InboxScreen.tsx`, `src/styles/settings.css`)

- Scherm, van boven naar beneden: Header **Huishouden & vrienden**; intro `household.intro` (door D ingekort); kaart Naam van het huishouden
  (ongewijzigd); kaart **Mensen** (`people.title`): bovenaan een knoppenrij **Voeg huisgenoot toe** · **Voeg vriend toe** · **Stuur mijn voortgang**
  (badges uit: **Stuur wie ik ben**); daaronder de lijst: profielen op deze telefoon (sub `household.local`), dan de andere huisgenoten (labeltje
  **huisgenoot** zoals op Meer), dan de vrienden (labeltje **vriend**). Per rij: avatar, naam, levelregel (`MemberLevelLine` met `snapshotForMember`),
  sub (`people.viaApp` bij deviceId, anders `household.byHand`); acties (op een eigen regel onder de rij, mogen omlopen): **Stuur** (opent het
  Stuur-venster van bouwer C met deze persoon), **Maak vriend** / **Maak huisgenoot** (`setMemberRole`, één tik), **Stuur terug** (alleen met
  `bestSnapshotForMember`, V1c-9: opent `ProgressReturnPanel` onder de rij), **Bewerk** (zoals nu: niet-lokaal), **Verwijder**. Lokale profielen:
  geen acties (zoals nu). De kaarten Mijn kaartje, Vrienden, Plak een kaartje of voortgang en Typ een huisgenoot verdwijnen; `MemberCardPanel`
  en `ProgressShareToggle` worden hier niet meer gebruikt.
- **Toevoeg-paneel** (één tegelijk, inline onder de knoppenrij, met een Sluit-knop): bovenaan `Segmented` **Huisgenoot | Vriend** (vooraf gezet
  door de knop die het paneel opende); dan `people.pasteHint` + het ENE plakvak (`UniversalPaste`, `defaultAction="member"`, zoals de huidige
  plakkaart, inclusief de doorgeefknoppen naar In & uit/editor voor andere plaksels); gevonden personen als `PersonCardRow` met knop
  **Voeg {name} toe als {rol}** (de rol van de Segmented; `people.addAs`) of **Werk {name} bij**; dan een regel "of" (`people.or`) en **Typ een naam**
  (`people.typeName`, de `MemberForm`: naam + kleur, opslaan = `people.addAs` zonder naam-variant: knop **Voeg toe**, `household.addSubmit`) die
  het lid met de gekozen rol toevoegt. De V1c-1-aanwijzing (blauwe regel) vervalt: het paneel zegt het zelf.
- `src/components/PersonCardRow.tsx` [nieuw] vervangt `MemberCardRow` én `ProgressCardRow` (beide weg uit HouseholdScreen; InboxScreen gebruikt
  de nieuwe): props `{ card: MemberCard | ProgressCard; sentAt?; members; role?: MemberRole; done?: 'added' | 'updated' | 'local' | 'restored';
  restored?: RestoredInfo; busy?; onAdd: (card, role) => void; onRestore?: (card, profileId) => void }`. Kop: avatar + **{name}** + subregel:
  wie-ik-ben → `people.cardIdentity` ("wie {name} is"); voortgang → `progress.from`-stijl regel met level · streak/badges · kookdagen · datum (zoals
  nu in ProgressCardRow). Knoppen: status 'new' → met `role` gegeven (toevoeg-paneel): één knop **Voeg {name} toe als {rol}**; zonder `role` (In &
  uit): twee knoppen **Voeg toe als huisgenoot** (primair) en **Voeg toe als vriend**; status 'known' → **Werk {name} bij**; status 'local' → de
  V1c-9-logica (Herstel mijn voortgang / `progress.local` / badges-uit-regel) voor een voortgang, en `people.cardLocal` voor wie-ik-ben. Uitkomsten:
  `people.addedHousemate` / `people.addedFriend` / `progress.updated` / V1c-9 `progress.restored`; na added/updated de knop `household.toHousehold`
  zoals nu.
- InboxScreen: `MemberCardRow`/`ProgressCardRow` → `PersonCardRow`; `addCard`/`saveProgress` → één `addPerson(card, role)` via `applyPersonCard`;
  `restore` blijft; `householdMembers` = alle leden, `friendMembers()` weg (zie 1a).
- CSS (settings.css): `.people-actions` (knoppenrij bovenaan, omlopend, 8 px gap), `.member-row.many .actions` (acties op een eigen regel,
  omlopend, rechts uitgelijnd — generaliseer de V1c-9 `has-return`-regel), `.add-panel` (kaart-in-kaart, 12 px padding, `.or`-regel gecentreerd
  muted). Alles werkt op 360 px.

#### 1c. Sturen (bouwer C: `src/sendto.ts` [nieuw], `src/components/SendSheet.tsx` [nieuw], `src/components/ProgressSharePanel.tsx`,
`src/screens/DeltaShareScreen.tsx` (alles behalve de partnerlijst), `src/screens/ProfileScreen.tsx`, `src/screens/ProfilesScreen.tsx`, `tests/sendto.test.ts`)

- `src/sendto.ts`:
  - `buildProgressMessage(p: Profile)` verhuist hierheen (geëxporteerd; ProgressSharePanel importeert het); nieuw `buildIdentityMessage(p: Profile)`
    (uit `MemberCardPanel`: `cardFromMember(p, deviceId)` → `buildMemberEnvelope` → token → url → `buildMemberShareMessage`).
  - `planDeltaFor(name: string): Promise<{ delta: DeltaSince; plan: MessagePlan | null; lastSent: string | null; count: number }>` — de
    deltaberekening en `planMessages`-aanroep uit DeltaShareScreen, één op één verhuisd; DeltaShareScreen gebruikt deze functie.
  - `export function joinParts(first: string, deltaPlan: MessagePlan | null, limit = RECIPE_LINK_MESSAGE_LIMIT): string[]` (puur, test): deel 1 =
    `first`; past `deltaPlan.parts[0]` met een lege regel ertussen binnen `limit`, dan plakt hij achter deel 1 en volgen de overige delen; anders
    volgen alle deltadelen als eigen delen. Een `{ file }`-plan (te groot) → de delen tot het bestand + de bestandsweg zoals DeltaShareScreen
    die nu afhandelt (het venster toont dan dezelfde knop Kies bestand/Stuur ook de uitleg; mag naar het scherm `/share` doorverwijzen met
    `send.tooBig` "Te veel nieuwe recepten voor berichten; ga naar Deel je nieuwe recepten." — besluit Fable: doorverwijzen, geen dubbele bestandscode).
  - `export async function logSent(i: { profile: Profile; recipient: string | null; progress: boolean; identity: boolean; delta: DeltaSince | null })`:
    'out'-rijen zoals ProgressSharePanel (kind 'progress'), MemberCardPanel (kind 'member') en `logDeltaShared` (recepten) nu doen; `markSentTo(name)`
    alleen als er recepten meegingen; daarna `recheckActiveBadges()`.
- `SendSheet.tsx` (`SheetPortal`, opbouw als `CookedSheet`): props `{ profile: Profile; recipient: Member | null; onClose }`. Titel `send.title`
  ("Stuur naar {name}") of `send.titleMine`. Twee vinkjes: **Mijn voortgang** (`send.progress`, sub `send.progressSub`; badges uit: **Wie ik ben**,
  `send.identity`/`send.identitySub`), standaard aan; **Nieuwe recepten** (`send.recipes`, sub `send.recipesSub` "{n} nieuw sinds {date}" /
  `send.recipesAll` als nooit gestuurd / `send.recipesNone` + uitgeschakeld als 0), alleen mét ontvanger, standaard aan als n > 0. Onderaan **Deel**
  (primair; bij meerdere delen na elke share `send.sharePart` "Deel deel {i} van {n}", zoals DeltaShareScreen/V2; `navigator.share({ text })` binnen de
  tik, tekst vooraf gebouwd bij openen en bij elke vinkwijziging), **Kopieer** (alle delen achter elkaar met een lege regel), statusregel
  (`send.copied`, `send.done`, `send.nothing`), de iPhone-regel `send.iosHint`. Na de laatste share: `logSent` en `send.done`; een geslaagde share
  sluit het venster niet (Stijn wil zien dat het klaar is), Sluit doet dat.
- ProfileScreen: de tegels 📇 Deel mijn kaartje en 📈 Sync mijn voortgang worden één tegel 📤 **Stuur mijn voortgang** (badges uit: **Stuur wie ik
  ben**) die `SendSheet` opent zonder ontvanger. ProfilesScreen: `MemberCardPanel` verdwijnt; per profielkaart een knop met dezelfde tekst die
  `SendSheet` voor dát profiel opent. `ProgressSharePanel`/`ProgressShareToggle` verdwijnen als componenten (`ProgressReturnPanel` blijft).
- DeltaShareScreen: blijft het scherm "Deel je nieuwe recepten" (route `/share`), gebruikt `planDeltaFor` en `logSent`; de partnerlijst = alle
  leden (A). Tests: `joinParts` (past wel/niet in deel 1; meerdere delen; leeg plan).

#### 1d. Woorden, deelzinnen, landing, handboek, testrijen (bouwer D: `src/i18n/settings.ts`, `src/i18n/edit.ts`, `src/i18n/xp.ts`, `src/domain/share.ts`
(alleen de twee zinnen), `src/landing.ts` (alleen teksten), `src/paste.ts` (alleen `membersLabel`), `data/handbook/*.json`, `docs/HANDLEIDING.md` +
`docs/HANDBOOK.md`, `docs/DEVICE-TEST.md`, de share-tests die de zinnen controleren)

- Nieuwe keys (NL · EN, letterlijk): `people.title` "Mensen" · "People"; `people.addHousemate` "Voeg huisgenoot toe" · "Add housemate";
  `people.addFriend` "Voeg vriend toe" · "Add friend"; `people.sendMine` "Stuur mijn voortgang" · "Send my progress"; `people.sendMineIdentity`
  "Stuur wie ik ben" · "Send who I am"; `people.housemate` "Huisgenoot" · "Housemate"; `people.friend` "Vriend" · "Friend"; `people.roleHousemate`
  "huisgenoot" · "housemate"; `people.roleFriend` "vriend" · "friend"; `people.makeFriend` "Maak vriend" · "Make friend"; `people.makeHousemate` "Maak
  huisgenoot" · "Make housemate"; `people.send` "Stuur" · "Send"; `people.pasteHint` "Plak hier het bericht dat de ander je stuurde: zijn voortgang,
  of wie hij is. Iets anders geplakt? De app zegt wat het is en waar het heen kan." · "Paste the message the other person sent you here: their
  progress, or who they are. Pasted something else? The app says what it is and where it can go."; `people.or` "of" · "or"; `people.typeName` "Typ een
  naam (voor iemand zonder de app)" · "Type a name (for someone without the app)"; `people.addAs` "Voeg {name} toe als {role}" · "Add {name} as {role}";
  `people.addAsHousemate` "Voeg toe als huisgenoot" · "Add as housemate"; `people.addAsFriend` "Voeg toe als vriend" · "Add as friend"; `people.update`
  "Werk {name} bij" · "Update {name}"; `people.addedHousemate` "{name} staat nu bij je huisgenoten." · "{name} is now one of your housemates.";
  `people.addedFriend` "{name} staat nu bij je vrienden." · "{name} is now one of your friends."; `people.cardIdentity` "wie {name} is" · "who {name}
  is"; `people.cardLocal` "Dat ben jij zelf (een profiel op deze telefoon)." · "That is you (a profile on this phone)."; `people.viaApp` "via de app"
  · "via the app"; `people.close` "Sluit" · "Close" (of hergebruik `common.close` als die bestaat — dan geen nieuwe key).
  `send.title` "Stuur naar {name}" · "Send to {name}"; `send.titleMine` "Stuur mijn voortgang" · "Send my progress"; `send.progress` "Mijn voortgang"
  · "My progress"; `send.progressSub` "wie ik ben, mijn level, badges en kookdagen" · "who I am, my level, badges and cooking days"; `send.identity`
  "Wie ik ben" · "Who I am"; `send.identitySub` "naam, kleur, taal en avatar" · "name, colour, language and avatar"; `send.recipes` "Nieuwe recepten"
  · "New recipes"; `send.recipesSub` "{n} nieuw sinds {date}" · "{n} new since {date}"; `send.recipesAll` "alles wat je zelf maakte ({n})" ·
  "everything you made yourself ({n})"; `send.recipesNone` "niets nieuws sinds {date}" · "nothing new since {date}"; `send.share` "Deel" · "Share";
  `send.sharePart` "Deel deel {i} van {n}" · "Share part {i} of {n}"; `send.copy` "Kopieer" · "Copy"; `send.copied` "Gekopieerd — plak het in WhatsApp."
  · "Copied — paste it into WhatsApp."; `send.done` "Verstuurd." · "Sent."; `send.nothing` "Vink iets aan om te sturen." · "Tick something to send.";
  `send.tooBig` "Te veel nieuwe recepten voor berichten; ga naar Deel je nieuwe recepten." · "Too many new recipes for messages; go to Share your new
  recipes."; `send.iosHint` "Android: de ander tikt op de link. iPhone: de link opent de app niet — de ander kopieert het bericht en plakt het in de
  app (Huishouden & vrienden → Voeg huisgenoot toe of Voeg vriend toe, of In & uit)." · "Android: the other person taps the link. iPhone: the link
  does not open the app — they copy the message and paste it into the app (Household & friends → Add housemate or Add friend, or In & out).";
  `profile.send` "Stuur mijn voortgang" · "Send my progress"; `profile.sendIdentity` "Stuur wie ik ben" · "Send who I am".
- Gewijzigde keys: `household.intro` → "Eén huishouden per telefoon: de mensen met wie je kookt en boodschappen doet. Een vriend staat los van je
  huishouden: je ziet alleen zijn level en kookdagen. Iemand toevoegen kan met zijn bericht (voortgang of wie hij is) of door een naam te typen." ·
  EN gelijkwaardig; `household.fromCard` → "via de app" · "via the app"; `inbox.noToken` → "Geen recept of persoon gevonden in deze tekst." · "No recipe
  or person found in this text."; `inbox.ev.member` → "Wie je bent" · "Who you are"; `paste.card` → "wie {name} is" · "who {name} is"; `paste.cards` →
  "{n} personen" · "{n} people"; `paste.cardsOne` → "1 persoon" · "1 person"; `paste.hint` (r. 200) en `inbox.hint` (r. 365): "een kaartje" → "wie iemand
  is of zijn voortgang" · EN; settings.ts r. 235: zonder "lid"/"kaartje" ("Huisgenoten staan vooraan. Iemand op een andere telefoon voeg je toe met
  zijn bericht, of je typt een naam."); `progress.updated` blijft.
- Verwijderde keys (en hun gebruik, dat door A/B/C al weg is): `household.myCard`, `myCardHint`, `shareCard`, `copyCard`, `cardShared`, `cardCopied`,
  `cardBuildFailed`, `cardIosHint` (→ `send.iosHint`), `cardQrAlt`, `addViaLink`, `addViaLinkHint`, `noCard`, `cardFrom`, `addCard`, `updateCard`,
  `cardKnown`, `cardLocal`, `cardAdded`, `cardUpdated`, `cardFailed` (→ `common.error`), `friendsEmpty`, `addFriend`, `friendHint`, `addHint`, `add`;
  `profile.shareCard`, `profile.sync`; `progress.saveFriend`, `progress.share` (de knoptekst "Sync mijn voortgang"; `progress.intro`/`honest`/
  `copied`/`shared` blijven als het venster ze gebruikt, anders ook weg — D stemt af met wat C gebruikt: C noemt in zijn rapport welke keys hij
  gebruikt). Laat `household.addSubmit` ("Voeg toe"), `household.byHand`, `household.local`, `household.edit`, `household.remove`, `household.toHousehold`,
  `household.saved`, `household.title`, `household.members`/`memberCount`/`memberOne` staan.
- Deelzinnen (`src/domain/share.ts`): `buildMemberShareMessage` → NL "👋 Dit is {name} voor Rutgers' Recepten — open de link in de app of plak hem
  bij In & uit om {name} toe te voegen als huisgenoot of vriend." · EN "👋 This is {name} for Rutgers' Recipes — open the link in the app or paste it
  into In & out to add {name} as a housemate or friend."; `buildProgressShareMessage`: de zin eindigt op "… om {name} toe te voegen of bij te werken."
  (controleer de huidige zin en pas alleen "huishouden"/"lid" aan). Tests mee.
- `src/landing.ts`: previewMember "Voorproefje: wie iemand is" · "Preview: who someone is"; memberOf "Dit is {name}" · "This is {name}"; "ledenkaartje"
  nergens meer; de hand-off-kaart zegt "Huishouden & vrienden → Voeg huisgenoot toe of Voeg vriend toe → Plak" waar nu de plakrij staat.
- Handboek: herschrijf in 05 `kaartje-delen` → titel "Je voortgang sturen" · "Send your progress" (Stuur mijn voortgang; wat erin zit; badges uit =
  wie ik ben), `lid-toevoegen` → "Iemand toevoegen die de app heeft" · "Add someone who has the app" (Voeg huisgenoot toe / Voeg vriend toe → Plak van
  klembord → Voeg … toe als …), `vriend-toevoegen` → "Huisgenoot of vriend, en wisselen" · "Housemate or friend, and switching" (het verschil,
  Maak vriend / Maak huisgenoot), `huishouden` → "Iemand zonder de app toevoegen" · "Add someone without the app" (Typ een naam), `voortgang-delen`
  → "Sturen naar één persoon" · "Send to one person" (Stuur op de rij: vinkjes Mijn voortgang en Nieuwe recepten, één Deel), `voortgang-ontvangen`
  (knoppen Voeg toe als huisgenoot / Voeg toe als vriend / Werk … bij), `voortgang-terugsturen`/`voortgang-herstellen` (Stuur terug blijft; tekst
  zonder kaartje), `wat-kun-je-delen`, `in-en-uit`, `ontvangen-iphone`, `link-iphone`; en de losse vermeldingen in 01 browsermelding, 02
  tip-van-de-maker, 04 lijst-ontvangen, 07 samen/mijn-profiel/avatar-maken/avatar-zeldzaam ("kaartje" → "wie je bent"/"je voortgang"; "lid"/"leden"
  → "huisgenoot"/"huisgenoten"). Ids blijven. `npm run validate:data` (elke **naam** letterlijk in i18n) en `node --experimental-strip-types
  tools/handbook-md.ts`.
- DEVICE-TEST: in de rijen 52, 58, 62, 71, 88, 95, 97, 105, 106, 108, 109, 116, 120 en 123 de oude knoppen en woorden vervangen door de nieuwe
  (Deel mijn kaartje → Stuur mijn voortgang; Voeg lid toe via link of plak / Plak een kaartje of voortgang → Voeg huisgenoot toe → plakvak; Voeg …
  toe aan je huishouden → Voeg … toe als huisgenoot; Bewaar als vriend → Voeg toe als vriend; kaartje → wie je bent / voortgang; leden →
  huisgenoten); noem in je rapport per rij wat je veranderde. Nieuwe rij 124 (NL én EN), twee telefoons: **Mensen en sturen (V1c-2).** 1. *A:* Meer →
  Huishouden & vrienden; tik op **Voeg vriend toe**, kijk naar het paneel; tik op **Sluit**. 2. *A:* tik bij de huisgenoot op **Stuur**; laat beide
  vinkjes aan en tik op **Deel**; stuur het via WhatsApp naar B. 3. *B:* kopieer het bericht, Meer → In & uit → **Plak van klembord**. 4. *B:* tik op
  **Voeg toe als vriend** (als A nieuw is) of **Werk … bij**. 5. *B:* Huishouden & vrienden: tik bij A op **Maak huisgenoot** en daarna op **Maak vriend**.
  6. *B:* tik op **Voeg huisgenoot toe**, kies **Typ een naam**, typ *Oma*, kleur, **Voeg toe**; verwijder Oma weer. 7. *A:* Mijn profiel → **Stuur mijn
  voortgang** → **Deel**. 8. Zet beide apps op Engels en kijk naar het scherm. | 1. Een paneel met **Huisgenoot | Vriend** (Vriend gekozen), de uitleg
  en het plakvak, daaronder "of" en **Typ een naam**. 2. Het venster "Stuur naar …" met **Mijn voortgang** (badges aan) en **Nieuwe recepten** met
  het aantal; na Deel opent WhatsApp met één bericht: de voortgangszin met link en daaronder de recepten (of "Deel deel 2 van 2" bij veel recepten);
  daarna "Verstuurd.". 3. In & uit toont "A · voortgang van A" (level, badges, kookdagen) en de recepten eronder in de voorvertoning; nergens het woord
  kaartje. 4. "A staat nu bij je vrienden." of "A is bijgewerkt."; op Huishouden & vrienden staat A met labeltje vriend en levelregel. 5. Het labeltje
  wisselt meteen; de levelregel blijft; de rij staat bij de huisgenoten resp. vrienden. 6. Oma staat bij de huisgenoten met "met de hand toegevoegd".
  7. Het venster zonder recepten-vinkje; WhatsApp opent met de voortgangszin. 8. People, Add housemate, Add friend, Send my progress, Housemate |
  Friend, Make friend, Send; nowhere "card".

### 2. Opus mag dit NIET zelf beslissen
- Tokens en codecs blijven; een vriend is een `Member` met `role`; een kaart wijzigt nooit een rol; de migratie is eenmalig en voegt alleen toe.
- Wie huisgenoten leest en wie iedereen (1a); Samen-badges tellen huisgenoten.
- Het Stuur-venster: twee vinkjes, één Deel, delen zoals V2; te groot → doorverwijzen naar het scherm; geen QR in het venster; het venster sluit
  niet vanzelf.
- Woorden: "kaartje", "lid", "leden" en "Sync mijn voortgang" verdwijnen uit alles wat de gebruiker ziet; de teksten letterlijk zoals in 1d.
- Geen nieuwe dependency; `SheetPortal` voor het venster; alles werkt op 360 px.

### 3. Bestandsverdeling
| Bouwer | Bestanden |
|---|---|
| A | `src/domain/household.ts`, `src/domain/progress.ts` (alleen `friendMembersFromSnapshots` als die daar past), `src/people.ts`, `src/db/repo.ts`, `src/app.tsx` (één regel), `src/badges.ts`, `src/screens/BadgesScreen.tsx`, `src/screens/CalendarScreen.tsx`, `src/screens/MoreScreen.tsx`, `src/screens/StoryScreen.tsx`, `src/screens/DeltaShareScreen.tsx` (alleen de partnerlijst, r. 164–175), `tests/household.test.ts` |
| B | `src/screens/HouseholdScreen.tsx`, `src/components/PersonCardRow.tsx`, `src/screens/InboxScreen.tsx`, `src/styles/settings.css` |
| C | `src/sendto.ts`, `src/components/SendSheet.tsx`, `src/components/ProgressSharePanel.tsx`, `src/screens/DeltaShareScreen.tsx` (alles behalve de partnerlijst), `src/screens/ProfileScreen.tsx`, `src/screens/ProfilesScreen.tsx`, `src/styles/xp.css` of `settings.css`-regels voor het venster (alleen `.send-sheet*`), `tests/sendto.test.ts` |
| D | `src/i18n/settings.ts`, `src/i18n/edit.ts`, `src/i18n/xp.ts`, `src/domain/share.ts` (twee zinnen), `src/landing.ts` (teksten), `src/paste.ts` (`membersLabel`), `data/handbook/*.json`, `docs/HANDLEIDING.md` + `docs/HANDBOOK.md`, `docs/DEVICE-TEST.md`, share-tests |
| Integrator | samenvoegen (B en C bouwen tegen A's handtekeningen en D's keys; ontbrekende keys toevoegen volgens 1d; dode componenten/keys weghalen), check/test/build/validate groen, acceptatie in de dev-app (NL/EN: paneel, Stuur-venster met beide vinkjes en Deel, rolwissel, ontvangen voortgang met beide knoppen, Herstel blijft, Stuur terug blijft, Mijn profiel-tegel, 360 px), `docs/STATUS.md`, de regel "Gebouwd" in dit blok |

Afspraken tussen bouwers: A exporteert `MemberRole`, `roleOf`, `housematesOf`, `friendsOf`, `setRole`, `friendMembersFromSnapshots` (domein) en
`applyPersonCard`, `setMemberRole`, `migrateFriendSnapshots`, `cardStatus` (src/people.ts); C exporteert `SendSheet`, `buildProgressMessage`,
`buildIdentityMessage`, `planDeltaFor`, `joinParts`, `logSent`; D levert de keys uit 1d. Een bouwer die iets mist, maakt een minimale stub met
precies die handtekening en meldt het; de integrator houdt de echte versie.

## Blok V1c-11 — Dagplafonds voor de badges die je kunt spammen (Stijn 15 nov: "max 10 per dag, zonder dat te laten weten")

Status: compleet (Fable zelf, 15 nov 2026). Leidend: docs/specs/badges-avatar.md §2c (feature-events), §5b ("geen beloning voor kijken").

### 1. Gedrag (`src/domain/features.ts`, `src/features.ts`, `tests/features.test.ts`)
- `DAILY_CAPS: Partial<Record<FeatureId, number>>` — alleen de feature-badges met tiers: surprise 10 (Verras me), timer 10, cookMode 5, planCook 5,
  listMade 3, standingList 10, dictEdit 25, variant 5, planShared 5, listShared 5, deltaShared 5. Eenmalige badges (voice, print, theme, …) hebben
  geen plafond nodig.
- `FeatureCount.day?: { d: 'yyyy-mm-dd'; n }` — de LOKALE dag (days.ts `dayIndexOfIso` + `dayKey`; `featureDayOf(at)`) van de laatst getelde
  gebeurtenis en het aantal van die dag. `bumpFeature(log, id, member, at, caps = DAILY_CAPS)`: dezelfde dag én `day.n >= cap` → geeft het
  ONGEWIJZIGDE log terug (`===`); anders n + 1, `day` bijgewerkt (nieuwe dag → n 1). Het plafond geldt per telefoon (twee profielen delen de dag);
  de badge telt per lid zoals altijd.
- `src/features.ts` `doRecordFeature`: `next === log` → niets schrijven, geen `checkNewBadges`.
- `normalizeFeatureLog`: een geldige `day` blijft, een kapotte valt weg (het tellertje zelf blijft). `mergeFeatureLogs` (restore, §2g): de latere
  dag wint, bij dezelfde dag het hoogste aantal. Een log van vóór de plafonds (zonder `day`) begint bij de volgende tik met tellen.
- Niets in de UI, geen handboekrij, geen snackbar: stil. Bestaande (opgeblazen) tellers blijven staan en verdiende badges blijven verdiend.

### 2. Beslist (Fable)
- Per lokale dag (niet per 24 uur): simpel en voorspelbaar; een klok die terugloopt kan hooguit één extra dag opleveren.
- Kookbeurten zelf hebben al hun eigen XP-plafonds (xp.ts `capFull`/`capHalf`/busy days); de cook-log-badges (reviews, sterren) blijven zoals ze
  zijn: een kookbeurt loggen kost meer dan een tik, en de XP erachter is al begrensd. Delen/ontvangen van recepten (`shared`/`received`) komt uit het
  deellog en is niet aangepakt: het vraagt een echte deelactie of een ontvangen bericht.

### 3. Test
`tests/features.test.ts` "daily caps (V1c-11)": plafond 10 op surprise en hetzelfde log voorbij het plafond (ook voor een tweede lid), de volgende dag
telt weer, ids zonder plafond onbeperkt + eigen tabel, oud log zonder `day`, normalize/merge van `day`. DEVICE-TEST rij 126.
