# Spec V1c — Testronde-feedback na V1–V9 (Stijn, vanaf 9 nov 2026)

Status: verzamelen (Fable). Stijn test de negen V-blokken op zijn telefoon en meldt wat opvalt; elk punt komt hier als rij met Fables
voorstel. Zodra Stijn zegt "bouw V1c", wordt dit een gewone spec (Kritische lezer, Feitencheck, §1 Gedrag, §2, §3) en gaat hij door de
lichte workflow. Tot die tijd: alleen verzamelen, niets bouwen.

## Verzamellijst

| # | Gemeld | Wat Stijn zag | Feiten in de code | Voorstel Fable | Stijn beslist |
|---|---|---|---|---|---|
| 1 | 9 nov | Onder Huishouden & vrienden staan **Deel mijn kaartje** en **Voeg lid toe**, maar geen **Voeg vriend toe**; onduidelijk welke knop een vriend toevoegt, zeker omdat het kaartje naar "je huishouden" verwijst. | Er zijn twee soorten kaartjes. Het **kaartje** (`#f=`, Deel mijn kaartje) maakt de ander altijd **lid** van je huishouden (HouseholdScreen: "Voeg {name} toe aan je huishouden"). Een **vriend** bestaat alleen via een **gedeelde voortgang** (`#x=`, Mijn profiel → Sync mijn voortgang): bij het plakken kies je "Bewaar als vriend" (`progress.saveFriend`) of lid; vrienden zijn snapshots (`progress.snapshots`, `friend: true`) en staan onder **Vrienden** op het Huishouden-scherm (alleen zichtbaar als er een is) en in de kalender. **Voeg lid toe** (naam + kleur) is voor iemand zonder de app. Het scherm heet nog **Huishouden** (`household.title`) terwijl de rij op Meer sinds V1b **Huishouden & vrienden** heet. | **Optie A (S, alleen teksten):** titel van het scherm wordt Huishouden & vrienden; **Voeg lid toe** → **Typ een huisgenoot** (hint: "voor iemand zonder de app"); de plakrij heet **Plak een kaartje of voortgang** met de uitleg "Een kaartje maakt iemand huisgenoot. Een gedeelde voortgang kun je ook als vriend bewaren: dan zie je zijn level en kookdagen, maar hij staat niet in je lijstjes."; het blok **Vrienden** staat er altijd, ook leeg, met één regel hoe je er een krijgt en een knop **Voeg vriend toe** die de plakrij opent met die uitleg. **Optie B (M, model):** een vriend kan óók met een gewoon kaartje: bij het plakken van een `#f=` kies je **Huisgenoot** of **Vriend**; een vriend wordt een `Member` met `friend: true` die niet meetelt in lijstjes en porties, wel in de kalender en als afzender. Vraagt een migratie van de bestaande vrienden-snapshots naar leden en een check van elke plek die `members` leest. | A of B? Fable raadt **A** aan: de vraag was welke knop, niet een ander model; B kan later als vrienden vaker voorkomen. |

## Nog te verwachten
Alles uit DEVICE-TEST 109–119 dat niet klopt; de kcal-getallen bij bekende recepten (V9); de rand-veeg op de iPhone (V8).
