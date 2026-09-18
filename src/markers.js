// Markører på kartet.
//
// De tegnes som MapLibre-lag, ikke som HTML-elementer over kartet. Det er
// avgjørende for eksporten: `circle`-lag ligger i det samme WebGL-bildet som
// resten av kartet og skaleres med `pixelRatio`, så de blir med i plakaten i
// full oppløsning helt av seg selv. HTML-markører ville vært usynlige i
// eksporten, siden den leser av kartets canvas.

export const SRC_ID = 'markers-src';
export const LAYER_ID = 'markers-layer';
export const LABEL_LAYER_ID = 'markers-label';

/** Punktstørrelse på markørnavnene. Etikettavstanden regnes ut fra denne. */
const LABEL_SIZE = 13;

/** Ferdige farger som står seg mot både lyse og mørke paletter. */
export const MARKER_COLORS = [
  '#FF3B30',
  '#FF9500',
  '#FFCC00',
  '#34C759',
  '#00C7BE',
  '#0A84FF',
  '#5E5CE6',
  '#FF2D95',
  '#FFFFFF',
  '#111111',
];

export const MARKER_STYLES = [
  { id: 'prikk', name: 'Prikk' },
  { id: 'donut', name: 'Donut' },
  { id: 'ring', name: 'Ring' },
];

let nextId = 1;

export function makeMarker(lng, lat, overrides = {}) {
  return {
    id: `m${Date.now().toString(36)}${nextId++}`,
    lng,
    lat,
    color: MARKER_COLORS[0],
    shape: 'prikk',
    size: 10,
    label: '',
    ...overrides,
  };
}

/**
 * Oversetter markørlista til GeoJSON. All utseendelogikk ligger i egenskapene
 * her, slik at stilarket under kan være datastyrt og uforanderlig.
 */
export function toGeoJSON(markers) {
  return {
    type: 'FeatureCollection',
    features: markers.map((m) => {
      // MapLibre tegner omrisset *utenpå* radien, så ytre kant blir alltid
      // radius + strokeWidth. Tallene under er valgt slik at alle tre formene
      // får nøyaktig samme ytre størrelse — bytter du form, hopper ikke
      // markøren i størrelse.
      const shape = {
        prikk: { radius: m.size, strokeWidth: 0, fillOpacity: 1 },
        donut: { radius: m.size * 0.45, strokeWidth: m.size * 0.55, fillOpacity: 0 },
        ring: { radius: m.size * 0.8, strokeWidth: m.size * 0.2, fillOpacity: 0 },
      }[m.shape] || { radius: m.size, strokeWidth: 0, fillOpacity: 1 };

      // Navnet skyves ned under markøren. Avstanden må følge markørstørrelsen,
      // ellers legger teksten seg oppå en stor prikk. text-offset regnes i em,
      // derfor delingen på tekststørrelsen.
      //
      // Forskyvningen ligger her som et ferdig [x, y]-par, ikke som ett tall.
      // Grunnen er at `text-radial-offset` — det opplagte valget — krever
      // `text-variable-anchor`, og den kombinasjonen krasjer MapLibres
      // etikettplassering når `text-allow-overlap` står på.
      const outer = shape.radius + shape.strokeWidth;

      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
        properties: {
          id: m.id,
          color: m.color,
          label: (m.label || '').trim(),
          offset: [0, (outer + 6) / LABEL_SIZE],
          ...shape,
        },
      };
    }),
  };
}

/**
 * Legger markørlagene inn i kartet, eller oppdaterer dem hvis de finnes.
 *
 * Må kalles på nytt etter hver setStyle() — et nytt stilark fjerner alle
 * kilder og lag, inkludert disse.
 */
export function syncMarkers(map, markers, palette) {
  if (!map || !map.style) return;
  const data = toGeoJSON(markers);

  const src = map.getSource(SRC_ID);
  if (src) {
    src.setData(data);
    return;
  }

  map.addSource(SRC_ID, { type: 'geojson', data });

  map.addLayer({
    id: LAYER_ID,
    type: 'circle',
    source: SRC_ID,
    paint: {
      'circle-radius': ['get', 'radius'],
      'circle-color': ['get', 'color'],
      'circle-opacity': ['get', 'fillOpacity'],
      'circle-stroke-width': ['get', 'strokeWidth'],
      'circle-stroke-color': ['get', 'color'],
    },
  });

  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: SRC_ID,
    // Navnløse markører skal ikke reservere plass i etikettplasseringen.
    filter: ['!=', ['get', 'label'], ''],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Open Sans Semibold', 'Noto Sans Regular'],
      'text-size': LABEL_SIZE,
      'text-anchor': 'top',
      'text-offset': ['array', 'number', 2, ['get', 'offset']],
      'text-letter-spacing': 0.04,
      'text-max-width': 9,
      // Navnet hører til markøren. Skyves det unna for å unngå kollisjon,
      // peker det på feil punkt — da er det bedre at det står der det står.
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': ['get', 'color'],
      // Glorien tas fra paletten, ikke fra markørfargen — den skal skille
      // teksten fra kartet under, uansett hvilken farge markøren har.
      'text-halo-color': palette ? palette.textHalo : '#000000',
      'text-halo-width': 1.6,
    },
  });
}
