// Bygger et komplett MapLibre-stilark ut fra en palett.
//
// Alternativet er å vedlikeholde ett stilark per tema (svipper har 112 lag i sitt).
// Her defineres laggeometrien én gang, og temaet er bare farger. Et nytt tema
// koster fire linjer i themes.js i stedet for en ny 2000-linjers JSON.
//
// Kildeskjemaet er OpenMapTiles (det MapTiler v3 leverer), samme skjema som
// kart.svipper.no bruker. Bytter du flisleverandør er det bare `sources` og
// `glyphs` som må endres, så lenge den nye kilden følger samme skjema.

const OMT_TILES = (key) =>
  `https://api.maptiler.com/tiles/v3/tiles.json?key=${encodeURIComponent(key)}`;
const OMT_GLYPHS = (key) =>
  `https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=${encodeURIComponent(key)}`;

/** Interpolér linjebredde på zoom, skalert av detaljnivået. */
function w(stops, scale = 1) {
  const out = ['interpolate', ['linear'], ['zoom']];
  for (const [z, px] of stops) out.push(z, px * scale);
  return out;
}

/**
 * @param {import('./themes.js').Palette} p
 * @param {Object} [opts]
 * @param {string} opts.key            MapTiler-nøkkel
 * @param {{places?:boolean, roads?:boolean, water?:boolean}} [opts.labels]
 *        Hvert tekstlag skrus av og på for seg. Veinavn uten stedsnavn er en
 *        vanlig plakatkombinasjon, så de kan ikke henge sammen.
 * @param {boolean} [opts.buildings]
 * @param {boolean} [opts.green]
 * @param {boolean} [opts.landuse]
 * @param {boolean} [opts.water]
 * @param {boolean} [opts.roads]
 * @param {boolean} [opts.rail]
 * @param {boolean} [opts.tunnels]     stiplede veier i tunnel
 * @param {boolean} [opts.boundaries]
 * @param {number}  [opts.lineScale]   1 = normal, <1 tynnere, >1 tykkere
 * @returns {Object} MapLibre style spec
 */
export function buildStyle(p, opts = {}) {
  const {
    key = '',
    labels = {},
    buildings = true,
    green = true,
    landuse = true,
    water = true,
    roads = true,
    tunnels = true,
    rail = true,
    boundaries = false,
    lineScale = 1,
  } = opts;

  const s = lineScale;
  const src = 'omt';
  const layers = [];

  layers.push({
    id: 'background',
    type: 'background',
    paint: { 'background-color': p.background },
  });

  if (landuse) {
    layers.push({
      id: 'landuse',
      type: 'fill',
      source: src,
      'source-layer': 'landuse',
      filter: ['all', ['==', ['geometry-type'], 'Polygon']],
      paint: { 'fill-color': p.landuse },
    });
  }

  if (green) {
    layers.push({
      id: 'landcover-green',
      type: 'fill',
      source: src,
      'source-layer': 'landcover',
      filter: [
        'all',
        ['==', ['geometry-type'], 'Polygon'],
        ['in', ['get', 'class'], ['literal', ['wood', 'grass', 'farmland', 'wetland']]],
      ],
      paint: { 'fill-color': p.green },
    });
    layers.push({
      id: 'park',
      type: 'fill',
      source: src,
      'source-layer': 'park',
      filter: ['==', ['geometry-type'], 'Polygon'],
      paint: { 'fill-color': p.green },
    });
  }

  if (water) {
    layers.push({
      id: 'water',
      type: 'fill',
      source: src,
      'source-layer': 'water',
      filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['!=', ['get', 'brunnel'], 'tunnel']],
      paint: { 'fill-color': p.water },
    });
    layers.push({
      id: 'waterway',
      type: 'line',
      source: src,
      'source-layer': 'waterway',
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': p.waterway,
        'line-width': w([[8, 0.4], [12, 1.2], [16, 3.5], [20, 12]], s),
      },
    });
  }

  if (buildings) {
    layers.push({
      id: 'building',
      type: 'fill',
      source: src,
      'source-layer': 'building',
      minzoom: 13,
      paint: {
        'fill-color': p.building,
        'fill-outline-color': p.buildingLine,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, 1],
      },
    });
  }

  if (rail) {
    layers.push({
      id: 'rail',
      type: 'line',
      source: src,
      'source-layer': 'transportation',
      filter: ['in', ['get', 'class'], ['literal', ['rail', 'transit']]],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': p.rail,
        'line-width': w([[9, 0.4], [13, 0.9], [16, 2], [20, 5]], s),
      },
    });
  }

  if (roads) {
    // Kantlinje først, så fyll — gir veikryss som ser ut som veikryss.
    const roadDefs = [
      {
        id: 'path',
        classes: ['path', 'track'],
        minzoom: 13,
        color: p.path,
        casing: null,
        width: [[13, 0.3], [15, 0.7], [17, 1.4], [20, 4]],
        dash: [2, 2],
      },
      {
        id: 'minor',
        classes: ['minor', 'service'],
        minzoom: 11,
        color: p.roadMinor,
        casing: p.roadMinorLine,
        width: [[11, 0.3], [13, 0.8], [15, 1.8], [17, 4], [20, 16]],
      },
      {
        id: 'secondary',
        classes: ['secondary', 'tertiary'],
        minzoom: 8,
        color: p.roadMinor,
        casing: p.roadMinorLine,
        width: [[8, 0.4], [11, 1], [13, 2], [15, 3.5], [17, 7], [20, 24]],
      },
      {
        id: 'primary',
        classes: ['primary'],
        minzoom: 6,
        color: p.roadMajor,
        casing: p.roadMajorLine,
        width: [[6, 0.5], [9, 1.2], [12, 2.4], [15, 5], [17, 10], [20, 30]],
      },
      {
        id: 'trunk',
        classes: ['trunk', 'motorway'],
        minzoom: 4,
        color: p.roadMajor,
        casing: p.roadMajorLine,
        width: [[4, 0.5], [8, 1.2], [11, 2.4], [14, 5], [16, 9], [20, 36]],
      },
    ];

    // Tunneler tegnes først, altså under veiene på bakken, stiplet, tynnere og
    // halvgjennomsiktige. Da henger veinettet sammen uten at det ser ut som om
    // veien går oppå husene. Filtrert helt bort ga det hull i hovedveien overalt
    // i en by som Tromsø.
    if (tunnels) {
      for (const r of roadDefs) {
        if (!r.casing) continue; // stier i tunnel er støy
        layers.push({
          id: `tunnel-${r.id}`,
          type: 'line',
          source: src,
          'source-layer': 'transportation',
          minzoom: r.minzoom,
          filter: [
            'all',
            ['==', ['geometry-type'], 'LineString'],
            ['in', ['get', 'class'], ['literal', r.classes]],
            ['==', ['get', 'brunnel'], 'tunnel'],
          ],
          layout: { 'line-join': 'round' },
          paint: {
            'line-color': r.color,
            'line-width': w(r.width.map(([z, px]) => [z, px * 0.75]), s),
            'line-opacity': 0.55,
            'line-dasharray': [2, 1.5],
          },
        });
      }
    }

    for (const r of roadDefs) {
      const base = {
        source: src,
        'source-layer': 'transportation',
        minzoom: r.minzoom,
        filter: [
          'all',
          ['==', ['geometry-type'], 'LineString'],
          ['in', ['get', 'class'], ['literal', r.classes]],
          ['!=', ['get', 'brunnel'], 'tunnel'],
        ],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      };
      if (r.casing) {
        layers.push({
          ...base,
          id: `road-${r.id}-casing`,
          type: 'line',
          paint: {
            'line-color': r.casing,
            'line-width': w(r.width.map(([z, px]) => [z, px + 1.2]), s),
          },
        });
      }
      layers.push({
        ...base,
        id: `road-${r.id}`,
        type: 'line',
        paint: {
          'line-color': r.color,
          'line-width': w(r.width, s),
          ...(r.dash ? { 'line-dasharray': r.dash } : {}),
        },
      });
    }
  }

  if (boundaries) {
    layers.push({
      id: 'boundary',
      type: 'line',
      source: src,
      'source-layer': 'boundary',
      filter: ['<=', ['get', 'admin_level'], 6],
      layout: { 'line-join': 'round' },
      paint: {
        'line-color': p.boundary,
        'line-width': w([[3, 0.5], [8, 1], [14, 2]], s),
        'line-dasharray': [3, 2],
      },
    });
  }

  const font = ['Open Sans Semibold', 'Noto Sans Regular'];
  const labelPaint = {
    'text-color': p.text,
    'text-halo-color': p.textHalo,
    'text-halo-width': 1.2,
  };

  if (labels.water) {
    layers.push({
      id: 'label-water',
      type: 'symbol',
      source: src,
      'source-layer': 'water_name',
      minzoom: 9,
      layout: {
        'text-field': ['coalesce', ['get', 'name:no'], ['get', 'name']],
        'text-font': font,
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 10, 16, 14],
        'text-letter-spacing': 0.1,
      },
      paint: labelPaint,
    });
  }

  if (labels.roads) {
    layers.push({
      id: 'label-road',
      type: 'symbol',
      source: src,
      'source-layer': 'transportation_name',
      minzoom: 12,
      layout: {
        'text-field': ['coalesce', ['get', 'name:no'], ['get', 'name']],
        'text-font': font,
        'text-size': ['interpolate', ['linear'], ['zoom'], 12, 9, 17, 12],
        'symbol-placement': 'line',
        'text-rotation-alignment': 'map',
      },
      paint: labelPaint,
    });
  }

  if (labels.places) {
    layers.push({
      id: 'label-place',
      type: 'symbol',
      source: src,
      'source-layer': 'place',
      filter: [
        'in',
        ['get', 'class'],
        ['literal', ['city', 'town', 'village', 'suburb', 'neighbourhood']],
      ],
      layout: {
        'text-field': ['coalesce', ['get', 'name:no'], ['get', 'name']],
        'text-font': font,
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          4,
          ['match', ['get', 'class'], 'city', 12, 9],
          14,
          ['match', ['get', 'class'], 'city', 22, 13],
        ],
        'text-letter-spacing': 0.08,
        'text-max-width': 8,
      },
      paint: { ...labelPaint, 'text-halo-width': 1.4 },
    });
  }

  return {
    version: 8,
    name: `Kartverktøy – ${p.name}`,
    glyphs: OMT_GLYPHS(key),
    sources: {
      [src]: { type: 'vector', url: OMT_TILES(key) },
    },
    layers,
  };
}
