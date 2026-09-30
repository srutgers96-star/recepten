# Apparaatcheck / Device check

Fase-0-test op de echte telefoons. Resultaten komen in `docs/adr/0001-runtime.md`.
Phase-0 test on the real phones. Results go into `docs/adr/0001-runtime.md`.

- [Nederlands](#nederlands)
- [English](#english)

---

## Nederlands

### Wat je nodig hebt

- De link naar de app (Stijn stuurt hem; hij eindigt op `/recepten/`).
- WhatsApp met een chat naar jezelf of naar elkaar.
- Ongeveer 20 minuten. Je hoeft niet alles in één keer te doen: de Check-pagina onthoudt wat je al
  hebt aangevinkt.

### Stap 1 — installeer de app

**Android (Stijn):** open de link in Chrome → **Installeren** (of menu ⋮ → App installeren). Daarna
altijd openen via het icoon in de app-lade.

**iPhone:** open de link in **Safari** → deelknop (vierkant met pijl omhoog) → **Zet op beginscherm**
→ laat "Open als webapp" aan staan → **Voeg toe**. Daarna altijd openen via het icoon op het
beginscherm, nooit in Safari.

### Stap 2 — open het tabblad Check

Open de app via het icoon. Tik onderaan op het tabblad **Check** (kop: *Apparaatcheck*). Kies
rechtsboven je taal (**NL / EN**). De pagina toont de lijst hieronder; sommige regels vullen zichzelf
in, bij andere staat een knop en doe jij iets. Vink na elke regel **pass** of **fail** aan, of typ
kort wat er gebeurde.

> **Testversie (NEXT):** krijg je een link die eindigt op `/recepten/next/`, open die dan eerst één
> keer in een gewone browsertab (Chrome of Safari) zodat de NEXT-app zijn eigen service worker en
> icoon kan installeren; installeer daarna vanuit die tab. NEXT heeft een eigen icoon en eigen
> opslag en raakt je echte recepten niet.

### Stap 3 — loop de lijst af

| # | Wat je doet | Wat "goed" is |
|---|---|---|
| 1 | *Android:* kijk of het icoon in de app-lade staat en of de app in Instellingen → Apps voorkomt. | Ja. |
| 2 | Kijk naar het scherm: geen adresbalk; statusbalk in de kleur van de app; niets valt onder de notch of de onderrand. | Ja. |
| 3 | Zet vliegtuigmodus aan, herstart de telefoon, open de app via het icoon. | De lijst staat er binnen 2 seconden. |
| 4 | Scroll snel door de lijst van 196 recepten; trek bovenaan verder naar beneden. | Vloeiend; letterkoppen blijven plakken; geen "vernieuw pagina"-gevoel. |
| 5 | Open het toevoegformulier, tik in elk veld, typ iets. | Toetsenbord bedekt geen invoerveld; het scherm zoomt niet in. |
| 6 | Open een recept, gebruik het terug-gebaar (of de terugknop) een paar keer. | Je gaat terug naar de lijst; de app sluit pas als je vanaf Home teruggaat. |
| 7 | Druk lang op een knop en op een lijstregel. | Er verschijnt geen tekstselectie of browser-menu. |
| 8 | Tabblad **Delen**: vul je naam in, vink **Tweetalig (test 2 KB)** aan (het langste recept staat al gekozen; kijk naar **URL-lengte**), tik op **Deel via WhatsApp**, stuur het naar jezelf, tik dan op de link in WhatsApp. | Eén klikbare link. *Android:* opent in de app, of in een Chrome-tab met werkende "Bewaar in mijn recepten" — noteer welke. *iPhone:* opent een voorproefpagina in Safari met "Copy recipe code". |
| 9 | *Android:* druk lang op de WhatsApp-bubbel uit test 8 → Delen → **Recepten**. Daarna met een document: maak op de pc een bestand `test.json` met de inhoud `{"name":"Test","ingredients":["1 ei"],"instructions":"Kook."}`, stuur het via WhatsApp (paperclip → Document) naar jezelf, druk lang op het document → Delen → **Recepten**. | Beide keren opent de app op het Import-scherm met "Ontvangen via het deelmenu" en een voorproefje. |
| 10 | Tik op **Deel via WhatsApp** (moet WhatsApp openen met tekst). Kopieer een bericht in WhatsApp, terug in de app: **Plak van klembord** (*iPhone:* tik op de "Plak"-ballon). Plak ook een keer met lang drukken in het grote tekstvak. | Alle drie werken. |
| 11 | Start de **timer van 30 s** drie keer: (a) app open laten; (b) scherm vergrendelen; (c) naar een andere app gaan. Schrijf per keer op: melding? geluid? trilling? niets? | Alleen (a) hoeft te werken. De rest is informatie, geen fout. |
| 12 | Kijk op de Check-pagina onder *Automatisch gemeten* naar de regel **storage.persisted()**. | ja (na installatie). |
| 13 | **Lange timer op de achtergrond (fase 1):** open een recept, start een timer van 10 minuten (of tik in de timerbalk een paar keer op **+1**), zet meldingen aan als daarom wordt gevraagd, en ga dan naar een andere app (of vergrendel het scherm) tot de tijd om is. Kijk tussendoor één keer naar je meldingen. | De melding met "nog N min" telt af terwijl de app dicht is, en na 10 min hoor je de piepjes / komt de melding "Timer klaar". Stopt het aftellen na een paar minuten, of komen het geluid en de melding pas als je de app weer opent? Noteer het: dan bevriest Android de app en moet je voor lange timers óók de timer van je telefoon zetten. |
| 14 | **Aangepaste klassieker delen (fase 3):** open een klassieker, bewerk hem (bv. een stap), tik op **Deel**. Het bericht begint met "🍲 <naam> (aangepast)". Stuur het naar de ander. | *Ontvanger:* Inbox toont "Aanpassing van <naam> · door <jij>", na **Importeer** staat het recept één keer in de lijst met het label "aangepast door <jij>" — geen dubbel recept. |
| 15 | **Stuur nieuwe naar … (fase 3):** Meer → **Stuur nieuwe naar …** → kies de ander. Je ziet "N recepten · N aangepaste klassiekers · N nieuwe ingrediënten". Tik op **Deel via WhatsApp**. | Eén bericht met meerdere links (of één bestand als het te veel is). Daarna staat bij de naam "Laatst verzonden: nu" en verdwijnt de kaart "nog niet gedeeld" op Home. |
| 16 | *Android:* druk lang op het bericht uit test 15 (met twee of meer links) → Delen → **Recepten**. | De Inbox toont ALLE recepten uit het bericht, elk met Nieuw / Heb je al / Bijgewerkt door …; **Importeer** slaat ze in één keer op. |
| 17 | *Android:* laat de ander een bundel-bestand sturen (Meer → Opslag → **Exporteer eigen recepten**, of test 15 met veel recepten), druk lang op het document → Delen → **Recepten**. | De Inbox toont de lijst uit de bundel met status per recept; **Importeer** werkt; **Maak ongedaan** zet alles terug. |
| 18 | *iPhone:* kopieer het bericht uit test 15 (twee of meer links) in WhatsApp → app → Inbox → **Plak van klembord**. | Alle recepten uit het bericht staan in het voorproefje, niet alleen de eerste. |
| 19 | *iPhone:* bewaar een bundel-bestand (.json of .txt) uit WhatsApp in Bestanden → app → Inbox → **Kies bestand**. | Het voorproefje toont de recepten uit de bundel; **Importeer** werkt. |
| 20 | *iPhone:* tik in Safari (niet in de app) op een link uit test 14 en op een link met `#b=`. | De voorproefpagina toont "Aanpassing van <naam> door <by>" met de gewijzigde velden, resp. de lijst met recepten uit de bundel, met **Kopieer receptcode** en **Open de app**. Er wordt niets opgeslagen. |
| 21 | **Back-up-herinnering (fase 3):** Meer → Opslag: zie "Sinds de laatste back-up: N wijzigingen". Maak een back-up. | De teller staat op 0; de rode regel (en de kaart op Home en het badge op Meer) verschijnt alleen als er wijzigingen zijn én de laatste back-up ouder is dan 30 dagen. |
| 22 | **Conflict (fase 3):** bewerk op BEIDE telefoons hetzelfde ontvangen recept (bv. de een de naam, de ander een stap), deel het daarna naar de ander. | De Inbox toont het label **Conflict** met per veld (naam / ingrediënten / stappen / overige) de keuze *van mij* / *van <naam>* / *allebei*; op een smal scherm passen de drie knopjes naast elkaar. **Importeer** past alleen de gekozen velden toe; **Maak ongedaan** zet ze terug. |
| 23 | **Engels toevoegen:** open een eigen recept dat alleen Nederlands heeft en tik onder de tijd/herkomst-regel op **Engels ontbreekt — toevoegen**. | De editor opent en scrollt vanzelf naar de sectie **Engels toevoegen** onderaan (de knop **Kopieer voor vertaling** is in beeld zonder zelf te scrollen). Na **Plak vertaling** → **Vul in** springt de taalkeuze naar **beide** en staat het Nederlands er nog. |
| 24 | **Kies 7 (fase 4):** onderaan staan nu vijf tabbladen (Home · Recepten · Week · Boodschappen · Meer); **Toevoegen** is de **+** rechtsboven in Recepten, de **Inbox** staat bovenaan in Meer. Tik op **Week** → zet het getal op 7 → **Kies 7**. Typ in het zoekveld, tik een paar filterchips aan (bv. *Vegetarisch* of *Pasta*), tik op **Verras me** en daarna op **Voeg … toe**. | De lijst in het venster begint met gerechten die je het langst niet hebt gegeten; **Verras me** vult aan tot 7 (hoogstens 2 pasta, hoogstens 2 rijst, minstens 1 vegetarisch, niets van de laatste 6 weken); na **Voeg toe** staan er 7 regels met elk *4 pers.* |
| 25 | **Slotje, dobbelsteen, Gekookt (fase 4):** tik bij één gerecht op 🔒, tik bij een ander op 🎲, tik dan op **Verras me** onder de lijst. Open daarna een gerecht uit de week → **Koken** → doorlopen tot **Gekookt!**. | 🎲 vervangt alleen die ene regel (nooit door iets dat al in de week staat); **Verras me** laat de regel met het slotje staan; na **Gekookt!** staat het gerecht doorgestreept in de Week-tab en in de kaart **Deze week** op Home, en de detailpagina toont **✓ Staat in je week**. |
| 26 | **Weekplan delen (fase 4):** Week → **Deel weekplan** → WhatsApp → naar de ander. *Android:* tik op de link. *iPhone:* kopieer het bericht → app → Meer → Inbox → **Plak van klembord**. | Het bericht begint met "🗓️ Weekplan van <naam>: 7 gerechten" en heeft één link. De Inbox van de ander toont "Weekplan van <naam>: 7 gerechten" met **Overnemen** / **Toevoegen**; eigen recepten uit het plan komen mee als Nieuw. |
| 27 | **Boodschappenlijst maken (fase 4):** Week (met 7 gerechten) → **Boodschappenlijst maken**. Tik bij een regel op **−** en **+**; tik in het blok **Voorraad** op een regel (bv. boter); tik op een regel om te zien waarvoor het is; typ onderin *wc-papier, 2 citroenen* → **Toevoegen**. Dan **Bevestig lijst**. | Het tabblad Boodschappen opent in de stap **Controleer de lijst**, per gangpad. **−/+** veranderen het aantal (stuks per 1, grammen per 10/25/50); de voorraadregel wordt "1 pak boter" en bij nog een tik weer 0; onder de regel staan de gerechten waar het voor is; de twee extra regels staan erbij (citroenen met 2). Na **Bevestig lijst** staat de lijst per gangpad, met per gangpad *0/N*. |
| 28 | **Afvinken (fase 4):** tik op een regel; tik binnen 5 s op **Ongedaan**; tik weer. Houd een andere regel ≈ ½ s vast. | Een tik streept de regel door en hij blijft op zijn plek; **Ongedaan** haalt het vinkje weg; als een gangpad compleet is klapt het vanzelf in (*N/N*). Vasthouden opent het menu (Heb ik al · Aantal aanpassen · Waarvoor is dit? · Elke week · Verwijder) zonder het contextmenu van de browser of de iOS-tekstballon. |
| 29 | **Heb ik al (fase 4):** houd een houdbare regel vast (bv. sojasaus) → **Heb ik al**; doe hetzelfde met iets vers (bv. paprika). Ga naar Week, wissel één gerecht (🎲), terug naar Boodschappen → banner **Weekplan gewijzigd** → **Bijwerken**. | Beide regels verhuizen naar **In huis**. Na **Bijwerken** blijft de sojasaus in huis (3 weken onthouden), de paprika staat weer gewoon op de lijst; je vinkjes en aangepaste aantallen zijn er nog; nieuwe regels hebben het label *nieuw*. |
| 30 | **Lijst delen (fase 4):** **Deel lijst** → kies NL of EN → deelknop → WhatsApp → naar de ander. Vink daarna één regel af en zet **Zonder afgevinkt** uit en weer aan. | Het deelmenu toont tekst die begint met "🛒 Boodschappen wk NN · 7 gerechten · 4 pers.", kopjes per gangpad en ☐ per regel; wat *in huis* is gaat niet mee. De ander krijgt gewone tekst (geen code). Daarna staat er "gedeeld om hh:mm"; na een wijziging komt "gewijzigd sinds delen" erbij. Met **Zonder afgevinkt** uit staat de afgevinkte regel als ☑ in de voorvertoning; aan (standaard) ontbreekt hij. |
| 31 | **Winkelstand en Klaar (fase 4):** zet **Winkelstand** aan, leg de telefoon 2 minuten neer. Vink daarna alles af → **Klaar** → **Ongedaan**. | *Android:* het scherm blijft aan ("Scherm blijft aan"). *iPhone (beginscherm-app):* wat ADR-0001 zegt; anders staat er eerlijk "Scherm-aan kan niet op dit toestel". **Klaar** wist alle vinkjes, **Ongedaan** zet ze terug. |
| 32 | **Dieet-chips (fase 5):** Home, Recepten en Week → **Kies 7**: bovenaan staat de rij **Dieet** met *Vegetarisch · Vegan · Glutenvrij* en de knop **ook als optie**. Tik op *Vegetarisch*, dan op **ook als optie**. Open daarna *Ratatouille*. | De lijst wordt korter (alleen vegetarisch); met **ook als optie** komen de recepten met een vega-optie erbij. De receptpagina toont onder de titel de chips *vegetarisch · vegan · glutenvrij*; bij een eigen recept met een onbekend ingrediënt staat er "waarschijnlijk" bij. |
| 33 | **Categorie en dieet in de editor (fase 5):** Recepten → **+** → typ een naam en een paar regels (bv. *300 g penne*, *1 courgette*, *150 ml room*). Kijk naar de rijen **Categorie** en **Dieet & labels**. Tik zelf op een chip. Daarna: Meer → **Controleer mijn recepten**. | De rijen vullen zich vanzelf (Pasta; vegetarisch) en veranderen mee terwijl je typt, tot je zelf iets kiest. De controlepagina toont per eigen recept *Nu* en *Voorstel* met **Overnemen** / **Zelf kiezen** / **Sla over**; na **Alles overnemen** is de lijst leeg. |
| 34 | **App resetten (fase 5):** Meer → Opslag → **App resetten** → **Ja, maar exporteer eerst mijn recepten** → deel het bestand naar jezelf (of annuleer een keer om te zien dat er niets gebeurt). | Annuleren: de app blijft zoals hij was. Na het delen: de app start opnieuw op het welkomstscherm (nieuw profiel), de 196 klassiekers staan er weer, eigen recepten, week en geschiedenis zijn weg; het gedeelde bestand kun je via Opslag → **Herstel** weer inlezen. |

### Stap 4 — kopieer en verstuur

Onderaan de Check-pagina staat **Kopieer resultaten**. Tik erop: de hele lijst met jouw antwoorden
staat nu als tekst op je klembord. Open WhatsApp, plak het in de chat met Stijn en verstuur. Stijn zet
het in `docs/adr/0001-runtime.md`. Vermeld ook je telefoonmodel en iOS/Android-versie (de Check-pagina
zet die er zelf bij).

### Extra voor Stijn (Android, alleen met pc)

`adb shell pm get-app-links <webapk-pakketnaam>` laat zien of de links van de site aan de WebAPK zijn
gekoppeld ("verified"). Noteer de uitkomst bij test 8.

---

## English

### What you need

- The link to the app (Stijn sends it; it ends in `/recepten/`).
- WhatsApp with a chat to yourself or to each other.
- About 20 minutes. You do not have to do everything at once: the Check page remembers what you have
  ticked so far.

### Step 1 — install the app

**Android (Stijn):** open the link in Chrome → **Install** (or menu ⋮ → Install app). From then on
always open it from the icon in the app drawer.

**iPhone:** open the link in **Safari** → Share button (the square with the arrow pointing up) →
**Add to Home Screen** → leave "Open as Web App" on → **Add**. From then on always open it from the
icon on your home screen, never in Safari.

### Step 2 — open the Check tab

Open the app from its icon. Tap the **Check** tab at the bottom (heading: *Device check*). Pick your
language at the top right (**NL / EN**). The page shows the list below; some rows fill themselves in,
others have a button and need you to do something. After each row tick **pass** or **fail**, or type
a few words about what happened.

> **Test version (NEXT):** if your link ends in `/recepten/next/`, first open it once in a normal
> browser tab (Chrome or Safari) so the NEXT app can install its own service worker and icon; then
> install from that tab. NEXT has its own icon and its own storage and never touches your real
> recipes.

### Step 3 — go through the list

| # | What you do | What "good" looks like |
|---|---|---|
| 1 | *Android:* check that the icon is in the app drawer and that the app appears in Settings → Apps. | Yes. |
| 2 | Look at the screen: no address bar; the status bar has the app's colour; nothing sits under the notch or the bottom edge. | Yes. |
| 3 | Turn on flight mode, restart the phone, open the app from its icon. | The list is there within 2 seconds. |
| 4 | Scroll fast through the list of 196 recipes; at the top, keep pulling down. | Smooth; letter headers stick; no "refresh the page" feeling. |
| 5 | Open the add form, tap into every field, type something. | The keyboard never covers an input; the screen does not zoom in. |
| 6 | Open a recipe, use the back gesture (or back button) a few times. | You go back to the list; the app only closes when you go back from Home. |
| 7 | Long-press a button and a list row. | No text selection or browser menu appears. |
| 8 | **Share** tab: enter your name, tick **Bilingual (2 KB test)** (the longest recipe is preselected; look at **URL length**), tap **Share via WhatsApp**, send it to yourself, then tap the link in WhatsApp. | One tappable link. *Android:* opens in the app, or in a Chrome tab with a working "Save to my recipes" — note which. *iPhone:* opens a preview page in Safari with "Copy recipe code". |
| 9 | *Android only:* long-press the WhatsApp bubble from test 8 → Share → **Recepten**. Then with a document: on a PC create a file `test.json` containing `{"name":"Test","ingredients":["1 ei"],"instructions":"Kook."}`, send it to yourself in WhatsApp (paperclip → Document), long-press the document → Share → **Recepten**. | Both times the app opens on the Import screen with "Received via the share sheet" and a preview. |
| 10 | Tap **Share via WhatsApp** (should open WhatsApp with text). Copy a message in WhatsApp, back in the app: **Paste from clipboard** (*iPhone:* tap the "Paste" bubble). Also paste once by long-pressing in the big text box. | All three work. |
| 11 | Start the **30-second timer** three times: (a) keep the app open; (b) lock the screen; (c) switch to another app. Each time write down: notification? sound? vibration? nothing? | Only (a) has to work. The rest is information, not a failure. |
| 12 | On the Check page, under *Detected automatically*, look at the row **storage.persisted()**. | yes (after installation). |
| 13 | **Long timer in the background (phase 1):** open a recipe, start a 10-minute timer (or tap **+1** a few times in the timer bar), allow notifications if asked, then switch to another app (or lock the screen) until the time is up. Glance at your notifications once in between. | The "N min left" notification counts down while the app is away, and after 10 min you hear the beeps / get the "Timer done" notification. If the countdown stops after a few minutes, or the sound and notification only arrive when you reopen the app, write that down: the phone freezes the app, and for long timers you should also set your phone's own timer. |
| 14 | **Share an adjusted classic (phase 3):** open a classic, edit it (e.g. one step), tap **Share**. The message starts with "🍲 <name> (adjusted)". Send it to the other person. | *Receiver:* the Inbox shows "Adjustment of <name> · by <you>"; after **Import** the recipe is in the list ONCE with the label "adjusted by <you>" — no duplicate. |
| 15 | **Send new to … (phase 3):** More → **Send new to …** → pick the other person. You see "N recipes · N adjusted classics · N new ingredients". Tap **Share via WhatsApp**. | One message with several links (or one file when it is too much). Afterwards the name shows "Last sent: now" and the "not shared yet" card on Home disappears. |
| 16 | *Android:* long-press the message from test 15 (two or more links) → Share → **Recepten**. | The Inbox shows ALL recipes from the message, each as New / Already have / Updated by …; **Import** saves them in one go. |
| 17 | *Android:* have the other person send a bundle file (More → Storage → **Export own recipes**, or test 15 with many recipes), long-press the document → Share → **Recepten**. | The Inbox lists the bundle with a status per recipe; **Import** works; **Undo** puts everything back. |
| 18 | *iPhone:* copy the message from test 15 (two or more links) in WhatsApp → app → Inbox → **Paste from clipboard**. | All recipes from the message are in the preview, not only the first one. |
| 19 | *iPhone:* save a bundle file (.json or .txt) from WhatsApp to Files → app → Inbox → **Choose file**. | The preview shows the recipes from the bundle; **Import** works. |
| 20 | *iPhone:* in Safari (not in the app) tap a link from test 14 and a link containing `#b=`. | The preview page shows "Adjustment of <name> by <by>" with the changed fields, resp. the list of recipes in the bundle, with **Copy recipe code** and **Open the app**. Nothing is stored. |
| 21 | **Backup reminder (phase 3):** More → Storage: see "Since the last backup: N changes". Make a backup. | The counter is 0; the red line (and the card on Home and the badge on More) only appears when there are changes AND the last backup is older than 30 days. |
| 22 | **Conflict (phase 3):** edit the SAME received recipe on BOTH phones (e.g. one the name, the other a step), then share it to the other person. | The Inbox shows the **Conflict** label with a per-field choice (name / ingredients / steps / other) *mine* / *<name>'s* / *both*; on a narrow screen the three pills fit side by side. **Import** applies only the chosen fields; **Undo** puts them back. |
| 23 | **Add English:** open an own recipe that only has Dutch and tap **English missing — add** under the time/origin line. | The editor opens and scrolls by itself to the **Add English** section at the bottom (the **Copy for translation** button is in view without scrolling). After **Paste translation** → **Fill in** the language choice jumps to **both** and the Dutch is still there. |
| 24 | **Pick 7 (phase 4):** the bottom bar now has five tabs (Home · Recipes · Week · Shopping · More); **Add** is the **+** at the top right of Recipes, the **Inbox** is the first row under More. Tap **Week** → set the number to 7 → **Pick 7**. Type in the search field, tap a few filter chips (e.g. *Vegetarian* or *Pasta*), tap **Surprise me** and then **Add …**. | The list in the sheet starts with the dishes you have not eaten for the longest time; **Surprise me** fills up to 7 (at most 2 pasta, at most 2 rice, at least 1 vegetarian, nothing from the last 6 weeks); after **Add** there are 7 rows, each *4 serv.* |
| 25 | **Lock, dice, Cooked (phase 4):** tap 🔒 on one dish, tap 🎲 on another, then tap **Surprise me** under the list. Then open a dish from the week → **Cook** → go through to **Cooked!**. | 🎲 replaces only that one row (never with something already in the week); **Surprise me** leaves the locked row alone; after **Cooked!** the dish is struck through in the Week tab and in the **This week** card on Home, and the detail page shows **✓ In your week**. |
| 26 | **Share the week plan (phase 4):** Week → **Share week plan** → WhatsApp → to the other person. *Android:* tap the link. *iPhone:* copy the message → app → More → Inbox → **Paste from clipboard**. | The message starts with "🗓️ Week plan from <name>: 7 dishes" and has one link. The other person's Inbox shows "Week plan from <name>: 7 dishes" with **Take over** / **Add**; own recipes in the plan arrive as New. |
| 27 | **Make the shopping list (phase 4):** Week (with 7 dishes) → **Make the shopping list**. Tap **−** and **+** on a line; tap a line in the **Staples** block (e.g. butter); tap a line to see what it is for; type *loo roll, 2 lemons* at the bottom → **Add**. Then **Confirm list**. | The Shopping tab opens in the **Check the list** step, per aisle. **−/+** change the amount (pieces by 1, grams by 10/25/50); the staple line becomes "1 pack butter" and another tap sets it back to 0; the dishes it is for appear under the line; the two extra lines are there (lemons with 2). After **Confirm list** the list is per aisle, each with *0/N*. |
| 28 | **Ticking off (phase 4):** tap a line; tap **Undo** within 5 s; tap it again. Hold another line for ≈ ½ s. | A tap strikes the line through and it stays in place; **Undo** removes the tick; a complete aisle collapses by itself (*N/N*). Holding opens the menu (Already have it · Adjust amount · What is this for? · Every week · Remove) without the browser's context menu or the iOS text callout. |
| 29 | **Already have it (phase 4):** hold a long-life line (e.g. soy sauce) → **Already have it**; do the same with something fresh (e.g. a pepper). Go to Week, swap one dish (🎲), back to Shopping → banner **Week plan changed** → **Update**. | Both lines move to **In stock**. After **Update** the soy sauce stays in stock (remembered for 3 weeks), the pepper is back on the list; your ticks and adjusted amounts are still there; new lines carry the label *new*. |
| 30 | **Share the list (phase 4):** **Share list** → choose NL or EN → share button → WhatsApp → to the other person. Then tick one line and switch **Without ticked lines** off and on again. | The share sheet shows text starting with "🛒 Shopping wk NN · 7 dishes · 4 people", a heading per aisle and ☐ per line; what is *in stock* is left out. The other person receives plain text (no code). Afterwards it says "shared at hh:mm"; after a change "changed since sharing" is added. With **Without ticked lines** off the ticked line shows as ☑ in the preview; on (the default) it is missing. |
| 31 | **Shop mode and Done (phase 4):** switch **Shop mode** on, put the phone down for 2 minutes. Then tick everything → **Done** → **Undo**. | *Android:* the screen stays on ("Screen stays on"). *iPhone (Home Screen app):* whatever ADR-0001 says; otherwise it honestly says "Keep-awake is not available on this device". **Done** clears all ticks, **Undo** restores them. |
| 32 | **Diet chips (phase 5):** Home, Recipes and Week → **Pick 7**: at the top there is a **Diet** row with *Vegetarian · Vegan · Gluten-free* and the button **options too**. Tap *Vegetarian*, then **options too**. Then open *Ratatouille*. | The list gets shorter (vegetarian only); with **options too** the recipes with a vegetarian option are added. The recipe page shows the chips *vegetarian · vegan · gluten-free* under the title; on an own recipe with an unknown ingredient it says "probably". |
| 33 | **Category and diet in the editor (phase 5):** Recipes → **+** → type a name and a few lines (e.g. *300 g penne*, *1 courgette*, *150 ml cream*). Look at the rows **Category** and **Diet & labels**. Tap a chip yourself. Then: More → **Check my recipes**. | The rows fill in by themselves (Pasta; vegetarian) and follow what you type until you choose something yourself. The check page lists per own recipe *Now* and *Suggestion* with **Adopt** / **Choose myself** / **Skip**; after **Adopt all** the list is empty. |
| 34 | **Reset the app (phase 5):** More → Storage → **Reset app** → **Yes, but export my recipes first** → share the file to yourself (or cancel once to see that nothing happens). | Cancel: the app stays as it was. After sharing: the app restarts on the welcome screen (new profile), the 196 classics are back, own recipes, week and history are gone; the shared file can be read back via Storage → **Restore**. |

### Step 4 — copy and send

At the bottom of the Check page is **Copy results** (Dutch: *Kopieer resultaten*). Tap it: the whole
list with your answers is now on your clipboard as text. Open WhatsApp, paste it into your chat with
Stijn and send. Stijn puts it into `docs/adr/0001-runtime.md`. Your phone model and iOS/Android version
are added by the Check page itself.

### Extra for Stijn (Android, PC only)

`adb shell pm get-app-links <webapk-package>` shows whether the site's links are bound to the WebAPK
("verified"). Note the outcome next to test 8.
