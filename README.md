# 1TD – Tower Defense prototípus

Egyszerű, böngészőben futó tower defense demó. A pályát canvas rajzolja ki, a tornyokat a rácsmezőkre kattintva lehet elhelyezni, a hullámok pedig manuálisan indíthatók.

## Futás
1. Nyisd meg a `index.html` fájlt a böngésződben (nem igényel buildet vagy külső csomagokat).
2. A **Start** gomb az első hullámot indítja el, a **Következő hullám** gombbal léptetheted a következőket.
3. A jobb oldali listából válassz tornyot, majd kattints a pályán egy szabad rácsra a lerakáshoz.
4. Billentyűk: **P** (pause), **+/-** (sebesség), **S/Enter** (start), **N** (következő hullám), **R** (reset), **1-3** (torony választása), **ESC** (kijelölés törlése). A beállítások panelen saját kiosztás is megadható.

## Főbb adatok
- Hullámok: új ellenségtípusok a felderítőtől a páncélozott rajokig és egy záró "Gépintelligencia" főellenség.
- Tornyok: rail ágyú (gyors), plazma (nagy sebzés), kriotron (lassító hatás).
- Induló erőforrások: 250 kredit és 20 életerő.
- Fejlesztés: a lerakott tornyok egyszer fejleszthetők (szint 2), ami +20% sebzést ad nagyobb áron.
