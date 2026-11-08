# Spec 13c — Opschoonronde: minder uitleg en tekst, rustiger, losse eindjes van de lenzen

Status: compleet (Fable, 8 nov 2026). Eén blok, twee bouwers + integrator (lichte modus). Bron: Stijn (30 okt 2026): "later de app
opschonen, veel te druk", "niet overal geel = niveau 1", "misschien wat rustiger"; de lijst "Opschoonronde — lijst" in docs/STATUS.md
en de "→ opschoonronde / afwerkronde"-regels onder de blokken 6D-UI, 6D-B, 6D-4b, 6D-S, 13D, 6C, 13J en 13Q. Leidend bij
tegenspraak: docs/specs/README.md §2, CLAUDE.md invarianten 3, 4, 5, 6 en 9. **Geen nieuwe functie.** Alles in dit blok haalt
tekst, dubbel werk of een los eindje weg; de vier afwerkpunten in §2B zijn kleine correcties die de lenzen al als "aanvaard voor
nu" markeerden.


**Kritische lezer.** (1) Een vertaalsleutel weghalen is alleen veilig als hij nergens letterlijk én nergens samengesteld
(`'prefix.' + x`, `` `prefix.${x}` ``) wordt gebruikt; §2A.5 noemt de zekere lijst en de regel voor de rest. (2) Een token-veld
toevoegen aan `#l=` (`variant`, §2B.2) is contract-werk: optioneel, onbekende sleutels blijven bewaard, bevroren tokens in
tests/token.test.ts veranderen niet, er komt één bevroren token bij. (3) Een hint weghalen mag de eerlijkheid niet raken:
een platformgrens (iPhone, achtergrond, geluid) blijft staan, alleen korter. (4) Escape centraal in SheetPortal mag geen sheet
raken die Escape al zelf afhandelt (dubbel sluiten, Ongedaan die wegspringt): alleen de twee sheets zonder Escape krijgen het.
(5) De landing-chunk mag niet groeien; §2B.3 meet vóór en na met `npm run build`.

**Feitencheck (8 nov).** `badges.tierLabel` + `TierDot` (6D-B) hebben "Niveau 1 · geel" al vervangen door een stipje; de
kleurnaam is alleen aria-tekst → gedaan. Het profiel-blok bovenaan Meer is weg sinds 6D-S (één rij Mijn profiel) → gedaan.
`addListLinesFromShare` geeft de lijst ongewijzigd terug als `add.length === 0` → al goed. Het 🎲-icoon van de uitdaging
"Uit je week" is op 8 nov 📅 geworden (data) → gedaan. De scan `unused-keys` (Fable, scratchpad) telt 1.580 sleutels en 195
kandidaten zonder letterlijk gebruik, waarvan de meeste samengesteld worden gebruikt (`filter.*`, `tag.*`, `avatar.layer.*`,
`badges.tier.*`, `vt.*`, `style.tab.*`, `more.timerSound.*`, `more.theme.*`, `shop.*`, `challenge.season.*`).
`src/landing.ts` leest `#l=` via `src/domain/share.ts`, waar ook de **bouwers** van envelopes staan; `vite build` meldt nu
`landing-*.js 18,9 kB │ gzip 6,4 kB` plus de gedeelde chunk die share.ts meebrengt.

## 1. Doel en gebruikersgedrag

Na dit blok ziet Stijn (NL, Android) en Gabi (EN, iPhone):

- **Meer** heeft onder de schakelaars alleen nog hints die een grens of een gevolg noemen dat je niet kunt raden; een hint die
  het label herhaalt is weg. De menurijen houden hun ondertitel alleen als die zegt wat erachter zit.
- Het **level-up-venster** noemt nieuwe avatar-onderdelen in één regel: "Nieuw voor je avatar: snor, bril +11" en pas na een tik
  op "+11" de hele lijst.
- Overal **enkelvoud waar het 1 is**: "1 badge", "1 kookdag", "1 regel" (geen "1 badges").
- De **kookkalender** zegt onder aan niets over "bijgewerkt" als badges uit staan en heeft geen inline stijlen meer.
- **Escape** sluit op de PC ook het houd-menu op de boodschappenlijst en het labels-venster bij Selecteer, zoals elke andere sheet.
- Een lange **boodschappenlijst** (meer dan één bericht aan tekst) krijgt tóch een link en QR-regel; alleen de **tekst** valt
  terug op een bestand.
- Een gedeelde lijstregel **"rode ui"** komt bij de ander aan als "rode ui", niet als "ui".
- Niets anders verandert zichtbaar. Geen nieuwe schermen, geen nieuwe instellingen, geen nieuwe sleutels in het register
  behalve het optionele tokenveld `variant` in `#l=`.

## 2. Besluiten

### 2A. Tekst en rust (bouwer A)

1. **Hints onder schakelaars in Meer** (`src/screens/MoreScreen.tsx`, `<small>{t('more.*Hint')}</small>` bij de toggles). Regel:
   een hint blijft alleen als hij een grens of gevolg noemt dat de gebruiker niet uit het label kan afleiden (platformgrens,
   wat er wordt opgeslagen of gedeeld, wat je kwijtraakt). Besluit per hint:
   - weg: `more.languageHint` ("Wordt onthouden op je profiel"), `more.confettiHint`, `more.fahrenheitHint`, `more.householdHint`,
     `more.feedbackHint`, `more.badgesRowHint` (de rij heet al Badges), `more.calendarHint` ("Wie kookte wat, per dag").
   - blijft, maar één zin van ten hoogste ±60 tekens, NL én EN, geen dubbele punt midden in: `more.badgesHint` (wat je kwijtraakt
     als je badges uitzet — niets; alleen de weergave), `more.readAloudHint`, `more.voiceCommandsHint`, `more.timerVibrateHint`,
     `more.timerSoundIOSHint`, `more.experimentsHint`, `more.storageHint`, `more.sendNewHint`, `more.dictHint`, `more.linksHint`,
     `more.styleHint`, `more.householdRowHint`, `more.checkRecipesHint`, `more.inboxHint`, `more.donateHint`.
   - De bouwer leest elke blijvende hint en kort hem waar hij langer is; de letterlijke nieuwe teksten komen in het rapport (Fable
     leest ze). De weggehaalde sleutels verdwijnen uit `src/i18n/settings.ts` (invariant: elke sleutel in beide talen; een sleutel
     die weg is, is in beide talen weg).
2. **Level-up-venster** (`src/components/LevelUpSheet.tsx`, regel "Nieuw voor je avatar: …"): toon ten hoogste twee namen, dan
   een knop "+{n}" (`<button class="link-btn">`, 44 px hoog, aria-label `levelup.moreParts` = NL "Toon alle {n} nieuwe
   avatar-onderdelen" / EN "Show all {n} new avatar parts") die de volledige lijst in dezelfde regel uitklapt (state in de sheet,
   niet bewaard). Bij ≤ 2 onderdelen geen knop. Nieuwe sleutel alleen `levelup.moreParts` (src/i18n/xp.ts).
3. **Enkelvoud.** Elke `{n}`-tekst in `src/i18n/*.ts` met een meervoudig zelfstandig naamwoord krijgt een zustersleutel `…One`
   voor n = 1, NL én EN (bestaand voorbeeld: `shop.lineOne` naast `shop.lines`), en de aanroep kiest op `n === 1`. Zeker:
   `progress.cookDays30` ("1 kookdag"), de badge-tellingen op Mijn profiel/Badges/het voortgangskaartje ("1 badge"),
   `storage.withPhotosHint` ("1 foto"), `more.dictCounts` als dat meervoud bevat. De bouwer zoekt met
   `grep -n "{n} [a-z]*s'" src/i18n/*.ts` (EN) en de NL-tegenhangers en meldt de volledige lijst. Geen pluralisatie-bibliotheek
   (geen dependency, geen `Intl.PluralRules`-laag: twee talen, twee vormen).
4. **Kookkalender** (`src/screens/CalendarScreen.tsx`): de onderste regel (`calendar.honest`/legenda) laat "bijgewerkt"/"last
   shared" weg als `badgesEnabled` false is (dan is er geen sync) — de bouwer kijkt welke sleutel het zegt en maakt een variant
   zonder, of laat de regel weg als hij dan leeg is. De drie `style={{ ...S.dot, background }}` worden klassen in
   `src/styles/xp.css` (`.cal-dot`, `.cal-legend-dot`) met de kleur als custom property `style={{ '--dot': color }}`; het
   object `S` verdwijnt. Niets aan de data of de maandnavigatie.
5. **Ongebruikte vertaalsleutels weg.** Zeker ongebruikt (geen letterlijk en geen samengesteld gebruik; Fable heeft gegrept):
   `home.title`, `home.greeting`, `home.badges`, `more.profile`, `more.switchTo`, `more.unlocks`, `more.unlocksHint`,
   `more.cookFont`, `more.cookFont.chalk`, `more.cookFont.default`, `more.cookFont.hand`, `more.cookedSound`,
   `more.cookedSoundHint`, `more.dictDelete`, `more.dictDeleteConfirm`, `more.dictNone`, `more.timerSoundPreview`,
   `profiles.intro`, `profiles.use`, `profiles.edit`, `profiles.active`, `profiles.nameRequired`, `variant.onlyCheck`,
   `recipe.variants`, `badges.secretHint`, `share.qrShow`, `share.qrHide`, `household.cardQrHint`, `check.notifGranted`,
   `nav.add`, `nav.inbox`, `edit.lang`, `edit.translateDone`, `edit.translateLinesMismatch`, `common.confirm`, `common.edit`,
   `common.ok`, `recipe.addedToWeek`, `pick.deselect`, `pick.select`, `pick.surpriseHint`, `share.message`, `filter.clear`,
   `filter.label`, `search.category`, `search.ingredient`, `search.name`, `search.tag`, `shop.collapse`, `shop.expand`,
   `shop.for`, `cook.readAloudList`, `cook.cmd.*Say` (negen), `more.theme`, `more.timerSound`, `badges.progress`,
   `badges.unlocksTier`, `inbox.field.*` (vier), `dict.missingField.*` (zes). **Vóór elke verwijdering** grept de bouwer zelf op
   de sleutel én op zijn voorvoegsel met `.${`, `.' +` en `` `prefix. `` in src/ (buiten src/i18n) en in tests/; staat hij
   ergens, dan blijft hij en komt hij in het rapport als "toch gebruikt via …". Samengestelde families (`filter.<tag>`,
   `tag.<tag>`, `meta.tag.<tag>`, `avatar.layer.*`, `avatar.rarity.*`, `badges.group.*`, `badges.tier.*`, `vt.*`, `style.*`,
   `more.timerSound.<id>`, `more.theme.<id>`, `challenge.season.*`, `shop.lineOne`/`shop.lines`) blijven ongemoeid. Een test die
   een verwijderde sleutel noemt, verliest die regel (niet de test).
6. **CSS-restanten.** `.profile-chip`/`.profile-chips`-regels in `src/styles/settings.css` en `src/styles/avatar.css` weg (de
   chips bestaan niet meer sinds 6D-S; `git grep profile-chip src` moet daarna leeg zijn). De `--rarity-*`-tokens in avatar.css
   (regels ±80–99) weg: `src/styles/base.css` definieert ze al, licht en donker; de `.rarity-*`-klassen in avatar.css blijven en
   gebruiken de tokens uit base.css. Oude avatar-maten in settings.css/edit.css die door 6D-UI/6D-S zijn vervangen (de bouwer
   zoekt `.avatar` met vaste `width`/`height` die nergens meer rendert, bv. maten die `.profile-hero .avatar.big` overschrijft en
   die niet meer in een component voorkomen) weg; twijfel = laten staan en melden. De regel `.home-hello .avatar` /
   `.home-hello + .home-level` uit avatar.css naar `src/styles/home.css`. Visueel niets anders: de integrator vergelijkt Home, Meer,
   Mijn profiel, Badges en Jouw stijl op 375 px licht/donker vóór en na.

### 2B. Losse eindjes (bouwer B)

1. **Lange lijst houdt een link** (`src/screens/ShoppingScreen.tsx`, effect rond `buildListEnvelope`/`planMessages`): de
   link-tekst wordt gebouwd met `planMessages([env], appUrl, { …, limit: LIST_LINK_MESSAGE_LIMIT })` waarbij
   `LIST_LINK_MESSAGE_LIMIT = 20000` (nieuwe constante in het lijst-deelmodule, zie B.3) — de link is één `{ text }` (invariant 9)
   en een WhatsApp-bericht mag veel langer dan 3.500 tekens; de **tekst**-deling ("Deel als tekst") houdt `DEFAULT_MESSAGE_LIMIT`
   en valt bij een lange lijst op het bestand terug zoals nu. De QR-regel blijft eerlijk op `QR_MAX_URL_CHARS` (1.600): een
   lange lijst toont "te groot voor een QR, deel de link". Test: 150 regels → link aanwezig, `qrFits` false; 12 regels → beide.
2. **Kwalificatie reist mee** (`ListShareLine` in het lijst-deelmodule): optioneel veld `variant?: string` (de kwalificatie uit
   het item, bv. "rode" bij ui; alleen als niet-lege string, zoals `ing`/`unit`/`aisle`). `buildListEnvelope` vult het uit het
   item als dat een kwalificatie heeft (de bouwer kijkt hoe `ListItem` die draagt — hetzelfde veld dat de lijstregel toont als
   "rode ui"); de lezer (`readListShare`/tolerant lezen) neemt het mee en laat onbekende sleutels staan; `listShareAdditions`
   matcht op `ing` + `variant` (lege variant = geen variant), zodat "rode ui" naast "ui" wordt toegevoegd en niet als dubbel
   wordt overgeslagen; het toegevoegde item krijgt de kwalificatie terug, zodat de regel "rode ui" toont. De iPhone-landing
   (`src/landing.ts`) toont de regel als "rode ui" als `variant` aanwezig is (variant vóór de naam in NL, en in EN: de bouwer
   gebruikt dezelfde volgorde als de lijstregel zelf). **Contract:** bevroren tokens in tests/token.test.ts blijven byte-gelijk;
   er komt één nieuw bevroren `#l=`-token bij met een `variant`; een `#l=` zonder `variant` leest als nu. Geen nieuwe
   fragmentsleutel (invariant 4: een optioneel extra veld is geen codec-wijziging).
3. **Landing-chunk kleiner**: de lijst-deelcode die alleen de volledige app nodig heeft (`buildListEnvelope`, `ListEnvelopeOptions`,
   de lijst-berichtopbouw in `planMessages` voor zover die te scheiden is, `LIST_LINK_MESSAGE_LIMIT`) verhuist naar
   `src/domain/share-list.ts`; `src/domain/share.ts` houdt het **lezen** (`ListShareLine`, `LIST_MAX_LINES`, de tolerante lezer)
   dat de landing nodig heeft, en re-exporteert niets dat de landing weer zou meeslepen. Alle importeurs (ShoppingScreen, Inbox,
   tests) volgen. Meting in het rapport: de regels van `npm run build` voor `landing-*.js` en de chunk(s) die landing importeert,
   vóór en na (gzip); doel: niet groter, liefst terug richting de 24,7 kB van 13D blok 2 als dat de som is die toen werd gemeten.
   Lukt het scheiden van `planMessages` niet zonder dubbele code, dan alleen `buildListEnvelope` + opties verhuizen en dat melden.
4. **Escape op de laatste twee sheets**: `src/components/SheetPortal.tsx` krijgt een optionele prop `onEscape?: () => void`; als
   die er is, luistert de portal op `keydown` Escape (document, alleen zolang gemount) en roept hem aan. Alleen het houd-menu in
   `ShoppingScreen.tsx` (sluit het menu: `setMenu(null)`, of de bestaande sluitfunctie) en `MetaSheet` in
   `src/components/SelectBar.tsx` (`onClose`) geven hem mee. Geen andere sheet verandert (die hebben Escape al zelf).
5. **Pure kernen voor tests** (`src/db/repo.ts` → het domeinmodule dat `listShareAdditions` al bevat): `clearChecksIn(list)` en
   `adoptStandingAdjustmentIn(list, key)` als pure functies met exact het huidige gedrag; `clearChecks()`/`adoptStandingAdjustment()`
   in repo.ts roepen ze aan binnen `updateList`. Tests: Klaar reset een vaste regel (checked, inHouse, adjusted, section) en laat
   een gewone regel met alleen `checked` schoon; Ook voortaan neemt het aangepaste aantal over. Gedrag ongewijzigd.
6. **Kleine restjes**: `VariantSheet` geeft `variant.checkSwap` geen `{from}`/`{to}` meer mee (de tekst gebruikt ze niet).

## 3. Bestandsverdeling

| Bouwer | Raakt alleen |
|---|---|
| A (tekst en rust) | `src/screens/MoreScreen.tsx`, `src/components/LevelUpSheet.tsx`, `src/screens/CalendarScreen.tsx`, `src/screens/ProfileScreen.tsx`/`BadgesScreen.tsx` alleen voor enkelvoud-aanroepen, `src/i18n/*.ts` (behalve `shopping.ts`), `src/styles/settings.css`, `src/styles/avatar.css`, `src/styles/edit.css`, `src/styles/home.css`, `src/styles/xp.css`, `tests/i18n*.test.ts`, `tests/levelup*.test.ts` |
| B (losse eindjes) | `src/screens/ShoppingScreen.tsx`, `src/components/SheetPortal.tsx`, `src/components/SelectBar.tsx`, `src/components/VariantSheet.tsx`, `src/domain/share.ts`, nieuw `src/domain/share-list.ts`, het domeinmodule met `listShareAdditions`, `src/db/repo.ts` (alleen `clearChecks`, `adoptStandingAdjustment`, `addListLinesFromShare`), `src/landing.ts`, `src/screens/InboxScreen.tsx` alleen voor imports, `src/i18n/shopping.ts`, `tests/token.test.ts` (alleen toevoegen), `tests/share*.test.ts`, `tests/list*.test.ts`, `tests/qr-fit.test.ts` |
| Integrator | samenvoegen, groen, visuele vergelijking (§2A.6), docs/STATUS.md, één regel "Gebouwd" hieronder; README §2b krijgt het tokenveld `variant` (optioneel, `#l=`) bij de `#l=`-regel |

Nieuwe i18n-sleutels: alleen `levelup.moreParts` en de `…One`-zusters uit §2A.3 — elk NL én EN. Geen dependency, geen
Dexie-versie, geen fragmentsleutel, `XP_RULES_VERSION` en `DATA_VERSION` ongewijzigd.

## 4. Testplan en acceptatie

- `npm run check`, `npm test`, `npm run build`, `npm run build:next`, `npm run validate:data` groen; `git diff package.json` leeg.
- tests/token.test.ts: alle bestaande bevroren tokens ongewijzigd; één nieuw `#l=`-token met `variant` leest terug als "rode ui";
  een lijstregel zonder `variant` leest als voorheen.
- share-tests: 150 regels → `planMessages` met `LIST_LINK_MESSAGE_LIMIT` geeft tekst (geen bestand) en `qrFits(url)` is false;
  12 regels → tekst en `qrFits` true; `listShareAdditions` voegt "rode ui" toe naast een bestaande "ui" en slaat een tweede
  "rode ui" over.
- domein-tests voor `clearChecksIn` en `adoptStandingAdjustmentIn` (§2B.5).
- i18n-test (bestaand): elke sleutel in beide talen; geen test noemt nog een verwijderde sleutel.
- Dev-app (integrator, 375 px, NL én EN, licht en donker): Meer heeft onder Taal, Confetti, Fahrenheit geen hint meer en de
  blijvende hints zijn één korte zin; Mijn profiel met 1 badge zegt "1 badge"; kalender zonder "bijgewerkt" bij badges uit en
  de stippen in de kleur van de persoon; boodschappenlijst → lang-indrukken → Escape sluit het menu; Recepten → Selecteer →
  labels-venster → Escape sluit; Home, Meer, Mijn profiel, Badges, Jouw stijl zien er hetzelfde uit als vóór dit blok.
- Geen nieuwe rij in docs/DEVICE-TEST.md (niets hiervan vraagt een echte telefoon; de handleiding Z vervangt die lijst).

## 5. Opus mag dit NIET zelf beslissen

- Welke hint blijft of gaat buiten de lijst in §2A.1; welke sleutel "toch gebruikt" is → laten staan en melden.
- Een sheet buiten het houd-menu en MetaSheet aan de Escape-prop hangen.
- Een nieuwe fragmentsleutel, een bevroren token wijzigen, een dependency (ook geen pluralisatie-hulp).
- `DEFAULT_MESSAGE_LIMIT` of `QR_MAX_URL_CHARS` veranderen; de tekst-deling anders laten terugvallen.
- Iets visueels veranderen dat niet in §1 staat (kleuren, maten, volgorde van rijen).

**Na de lens (besluit Fable, 8 nov):** (1) Enkelvoud centraal: `t()` en `tIn()` kiezen bij `vars.n === 1` de zuster `<key>One`
als die bestaat (src/i18n/index.ts); zusters zijn daarmee woordenboekwerk, de losse branches van bouwers en fixer blijven werken.
Een Opus-afronder voegde de zusters toe voor de zichtbare teksten die buiten bouwer A vielen (`challenge.daysLeft` "nog 1 dag",
"{n} wijzigingen", `delta.*`, `week.*`, `list.count`, `inbox.*`, `shop.*` enz.) en herformuleerde `shop.list.putSnack` zonder
werkwoord in de bijzin ("…, {m} al aanwezig"), zodat `{m}` = 1 ook klopt; DEVICE-TEST rij 106 volgt die tekst. (2) `filter.clear`
en `filter.label` weg (geen tag heet zo). (3) Escape op het labels-venster sluit alleen de sheet, de selectie blijft
(`stopPropagation` in SheetPortal): akkoord, één Escape = één laag. (4) Het nieuwe bevroren `#l=`-token staat inline in
tests/token.test.ts: akkoord (CLAUDE.md invariant 4 noemt dat bestand). (5) `adoptStandingAdjustment` houdt zijn eigen transactie
over lists én settings: akkoord, gedrag gelijk. (6) Een ontvangen `variant`-id wordt niet aan het woordenboek getoetst: aanvaard
(lijsten komen uit dezelfde app; toetsen zou kwalificaties stil laten vallen). (7) Kalender: met badges uit vervalt de hele
sync-regel, niet alleen "bijgewerkt": akkoord. (8) Tegen terugkerende dode sleutels bewaakt tests/i18n.test.ts voortaan dat elke
sleutel letterlijk, samengesteld of als `…One`-zuster wordt gebruikt (kleine allowlist in de test). (9) De beeldvergelijking van
§2A.6 is niet als screenshots gedaan (berekende maten en kleuren gelijk; elke weggehaalde regel was al overschreven): Stijn kijkt
mee bij het testen. (10) README §2b: tokenveld `variant` op `#l=` (Fable).
Gebouwd: 8 nov 2026 (13c, workflow wf_8661b993-08c; fixer-ronde en Opus-afronder (enkelvoud-regel, zusters, dode-sleuteltest), docs door Fable)

## 6. Niet in dit blok

De handleiding (Z), 6D-F frames, de IDEAS-punten (dopamine-kick, swipe-tabs, ingrediëntenherkenner, boodschappen-badges),
een algemene i18n-pluralisatielaag, het opruimen van `docs/DEVICE-TEST.md` (vervalt met Z).
