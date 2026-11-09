# Spec V1c — Testronde-feedback na V1–V9 (Stijn, vanaf 9 nov 2026)

Status: punt 1 in aanbouw (optie A, Stijn 9 nov: "doe maar optie a"); de rest van de lijst verzamelt. Elk punt dat Stijn laat bouwen,
krijgt hieronder een eigen blok (V1c-1, V1c-2, …) met Kritische lezer, Feitencheck, §1 Gedrag, §2 en §3, en gaat door de lichte workflow.

## Verzamellijst

| # | Gemeld | Wat Stijn zag | Feiten in de code | Voorstel Fable | Stijn beslist |
|---|---|---|---|---|---|
| 1 | 9 nov | Onder Huishouden & vrienden staan **Deel mijn kaartje** en **Voeg lid toe**, maar geen **Voeg vriend toe**; onduidelijk welke knop een vriend toevoegt, zeker omdat het kaartje naar "je huishouden" verwijst. | Er zijn twee soorten kaartjes. Het **kaartje** (`#f=`, Deel mijn kaartje) maakt de ander altijd **lid** van je huishouden. Een **vriend** bestaat alleen via een **gedeelde voortgang** (`#x=`, Mijn profiel → Sync mijn voortgang): bij het plakken kies je "Bewaar als vriend" of lid; vrienden zijn snapshots (`progress.snapshots`, `friend: true`) en staan onder **Vrienden** (alleen zichtbaar als er een is) en in de kalender. **Voeg lid toe** (naam + kleur) is voor iemand zonder de app. Het scherm heet nog **Huishouden** terwijl de rij op Meer sinds V1b **Huishouden & vrienden** heet. | Optie A (teksten + vast blok Vrienden met knop) of optie B (ook een kaartje als vriend bewaren, modelwijziging). | **Optie A** (Stijn 9 nov) → blok V1c-1 hieronder. |

## Nog te verwachten
Alles uit DEVICE-TEST 109–119 dat niet klopt; de kcal-getallen bij bekende recepten (V9/V9b); de rand-veeg op de iPhone (V8).

---

## Blok V1c-1 — Huishouden & vrienden: duidelijk wie huisgenoot is en hoe een vriend erbij komt (optie A)

Status: in aanbouw (Fable, 9 nov 2026). Eén bouwer + integrator (lichte modus). Leidend bij tegenspraak: docs/specs/README.md §2–§4,
docs/specs/handbook.md §4, CLAUDE.md invariant 5 (iPhone: plakken blijft de weg).
Gebouwd: 9 nov 2026 (V1c-1, lichte workflow; run-id in STATUS)

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
