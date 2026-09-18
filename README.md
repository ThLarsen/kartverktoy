# Kartverktøy

Lag egne kart og trykkeklare kartplakater fra OpenStreetMap-data. Utseendet er
inspirert av [kart.svipper.no](https://kart.svipper.no), plakatfunksjonene av
[mapposter.xyz](https://mapposter.xyz).

To moduser i samme app:

- **Plakat** — sted, tema, format, ramme og tekst → PNG/JPG i trykkoppløsning.
- **Kart** — det samme stilsystemet som et vanlig interaktivt kart, uten plakatramme.

## Kom i gang

Ingen `npm install`, ingen byggesteg. Det eneste du trenger er Python.

```bash
python serve.py
```

Nettleseren åpnes på <http://localhost:8777>. Første gang blir du bedt om en
**MapTiler-nøkkel** — lag en gratis på
[cloud.maptiler.com/account/keys](https://cloud.maptiler.com/account/keys/).

Nøkkelen lagres i nettleserens `localStorage`, ikke i noen fil i prosjektet.
Den ligger altså ikke i repoet og blir ikke med hvis du deler mappa. Bytt nøkkel
når som helst med **Nøkkel**-knappen oppe til høyre.

Serveren er bare en statisk filserver. Grunnen til at den trengs i det hele tatt
er at ES-moduler blokkeres over `file://`.

## Hvordan det henger sammen

| Fil | Ansvar |
|---|---|
| `src/themes.js` | Fargepaletter. Ett objekt per tema. |
| `src/style.js` | Bygger et komplett MapLibre-stilark ut fra en palett. |
| `src/layout.js` | Plakatgeometri: formater, maskeformer, tekstoppsett. |
| `src/markers.js` | Markørene og hvordan de blir til kartlag. |
| `src/export.js` | Høyoppløst rendring og nedlasting. |
| `src/geocode.js` | Stedssøk mot MapTiler. |
| `src/ui.js` | Byggeklosser for kontrollpanelet. |
| `src/main.js` | Tilstand og all sammenkobling. |

### Temaer er farger, ikke stilark

kart.svipper.no har 112 håndskrevne lag i sin `dark.json`. Her er laggeometrien
definert én gang i `style.js`, og et tema er bare en palett. Et nytt tema koster
ett objekt i `themes.js`:

```js
{
  id: 'tundra',
  name: 'Tundra',
  background: '#E9EDEA',
  water: '#AFC4CC',
  // ... resten av feltene, se Palette-typedefinisjonen øverst i themes.js
}
```

Vil du farge et kartelement som ikke finnes fra før, må feltet legges til i
paletten **og** tas i bruk i `style.js`. Det er den eneste koblingen mellom de to.

### Én layout, to tegnemåter

`computeLayout()` regner ut all plakatgeometri i plakatpiksler.
Forhåndsvisningen kaller den med skjermbredden og tegner HTML; eksporten kaller
den med trykkbredden og tegner canvas. Samme funksjon, samme tall — derfor blir
eksporten lik det du ser.

Det samme gjelder maskeformene: `maskPath()` returnerer én SVG-path som brukes
både i CSS `clip-path` og i `new Path2D()`.

### Markører er kartlag, ikke HTML

Markørene tegnes som et `circle`-lag i MapLibre. Det er ikke en detalj: eksporten
leser av kartets WebGL-canvas, så markører lagt på som HTML-elementer over kartet
ville vært usynlige i den ferdige plakaten. Som kartlag ligger de i samme bilde
som resten og skaleres med `pixelRatio` helt av seg selv.

Konsekvensen å huske på: `map.setStyle()` fjerner alle kilder og lag. Derfor
kalles `syncMarkers()` på nytt etter hvert stilbytte i `applyStyle()` — men først
når `isStyleLoaded()` sier at stilen faktisk er ferdig. `styledata`-hendelsen
fyrer for tidlig, og legger man lagene inn da, krasjer MapLibres etikett-
plassering med en TypeError inne i biblioteket og markørene forsvinner.

De tre formene — prikk, donut og ring — er samme lag med ulike tall for radius og
omrissbredde. Tallene er valgt slik at alle tre får samme ytre størrelse, så
markøren ikke hopper når du bytter form.

**Navn** skriver du rett i markørlista: raden viser koordinatene som plassholder
til du skriver noe. Navnet legges under markøren i markørens egen farge, med
glorie i temaets `textHalo` så det er lesbart på både lyse og mørke kart.
Avstanden ned til teksten følger markørstørrelsen, ellers legger navnet seg oppå
en stor prikk.

Skrivefeltet oppdaterer tilstanden og kartet direkte, uten å bygge panelet om.
Gjorde det det, ville feltet blitt revet ut under fingrene på deg for hvert
tastetrykk.

### Tekstlagene styres hver for seg

Stedsnavn, veinavn og vannavn er tre uavhengige brytere, ikke ett nivå fra
«ingen» til «alt». Veinavn uten stedsnavn er en helt vanlig plakatkombinasjon, og
den er umulig hvis lagene henger sammen.

Bryterne betyr nøyaktig det de sier, i begge moduser. Her lå det en stund en
regel som slo på stedsnavn av seg selv i kartmodus når ingen var valgt. Den ga
navn på kartet med bryteren av, og navnene forsvant igjen så snart du slo på en
av de andre. Legg ikke inn den slags igjen: en bryter som ikke stemmer med
kartet er verre enn et navnløst kart.

### Eksport

Eksporten hever `pixelRatio` på det kartet som allerede står på skjermen, venter
til alle fliser er inne, kopierer ut canvaset og setter oppløsningen tilbake.
CSS-størrelse og zoom er uendret, så utsnittet blir identisk, mens veier og
tekst skaleres proporsjonalt — som å skrive ut en vektor.

Taket er 16384 px i hver retning (WebGL-grensen for teksturer). 50×70 cm ved
300 dpi ligger godt under. Går du over, skaleres bildet ned i stedet for å bli
svart, og panelet sier fra.

Regn med noen sekunder: hele kartet tegnes på nytt i full oppløsning. 50×70 cm
ved 300 dpi tar rundt 10–15 sekunder på en vanlig kontormaskin.

## Plakatoppsett

**Innrammet** setter kartet inne på arket med tekstblokka under, slik de fleste
kartplakater ser ut. Her kan kartet maskeres til sirkel, heksagon, hjerte eller
portal.

**Helside** lar kartet dekke hele arket helt ut i kanten, med teksten liggende
oppå. Maskeformene slås av her — de gir ikke mening når kartet er arket. Til
gjengjeld kommer «slør bak tekst», en myk gradient i papirfargen som gjør teksten
lesbar uansett hva som ligger under.

## Kjente begrensninger

- **PDF mangler.** Eksporten er PNG og JPG. Trykkerier tar som regel PNG i 300
  dpi, men vil du ha ekte PDF/CMYK må det et bibliotek til.
- **Markørnavn kan ikke flyttes.** Navnet legger seg alltid under markøren. Ligger
  to markører tett, kan navnene overlappe — de er satt til å vises uansett, siden
  et navn som flyttes unna peker på feil punkt.
- **Ingen ruter eller flater.** Markører er punkter; linjer og polygoner fra
  GeoJSON er ikke på plass ennå.
- **MapTilers gratisnivå har kvote.** Slår den inn, blir kartet tomt. Alternativet
  er å selvhoste vektorfliser (Protomaps/PMTiles) — da bytter du bare `sources`
  og `glyphs` i `style.js`, siden flisskjemaet er det samme (OpenMapTiles).

## Data

Kartdata er © OpenStreetMap-bidragsytere, distribuert under ODbL. Plakater du
lager må beholde krediteringen — den er på som standard, og du bør la den stå.
