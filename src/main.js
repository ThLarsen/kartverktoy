import { THEMES, getTheme } from './themes.js';
import { buildStyle } from './style.js';
import {
  FORMATS,
  FRAMES,
  getFormat,
  exportSize,
  SHAPES,
  TEXT_LAYOUTS,
  computeLayout,
  maskPath,
  formatCoords,
  rgba,
} from './layout.js';
import { search as geoSearch } from './geocode.js';
import { renderPoster, downloadCanvas } from './export.js';
import { MARKER_COLORS, MARKER_STYLES, makeMarker, syncMarkers } from './markers.js';
import * as U from './ui.js';

const LS_KEY = 'kartverktoy.key';
const LS_STATE = 'kartverktoy.state';

const DEFAULTS = {
  mode: 'poster',
  themeId: 'nordlys',
  formatId: '50x70',
  dpi: 300,
  frame: 'ramme',
  shape: 'rect',
  textLayout: 'klassisk',
  scrim: true,

  title: 'TROMSØ',
  subtitle: 'Norge',
  coords: '',
  autoCoords: true,

  titleFont: 'Montserrat',
  subFont: 'Montserrat',
  coordFont: 'Space Mono',
  titleWeight: 700,
  titleSize: 0.085,
  subSize: 0.028,
  coordSize: 0.02,
  tracking: 0.12,
  upper: true,

  margin: 0.07,
  textScale: 0.23,
  border: false,
  mapOutline: false,
  credit: true,

  labelPlaces: false,
  labelRoads: false,
  labelWater: false,
  buildings: true,
  green: true,
  landuse: true,
  water: true,
  roads: true,
  tunnels: true,
  rail: true,
  boundaries: false,
  lineScale: 1,

  markers: [],
  markerColor: MARKER_COLORS[0],
  markerShape: 'prikk',
  markerSize: 10,

  center: [18.9553, 69.6496],
  zoom: 11.5,
  bearing: 0,
  pitch: 0,
};

const state = loadState();
let apiKey = localStorage.getItem(LS_KEY) || '';
let map = null;
let styleTimer = null;
let placing = false; // en modus, ikke en innstilling — derfor ikke lagret

const dom = {
  panel: document.getElementById('panel'),
  stage: document.getElementById('stage'),
  poster: document.getElementById('poster'),
  mapFrame: document.getElementById('mapFrame'),
  posterText: document.getElementById('posterText'),
  hint: document.getElementById('stageHint'),
};

function loadState() {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(LS_STATE) || '{}');
  } catch {
    saved = {};
  }

  // Tekstlagene var én verdi ('none' | 'places' | 'full') før de ble delt i tre.
  // Uten denne oversettelsen ville lagrede oppsett fått feil avkrysninger.
  if (typeof saved.labels === 'string') {
    saved.labelPlaces = saved.labels !== 'none';
    saved.labelRoads = saved.labels === 'full';
    saved.labelWater = saved.labels !== 'none';
    delete saved.labels;
  }

  return { ...DEFAULTS, ...saved };
}

function saveState() {
  try {
    localStorage.setItem(LS_STATE, JSON.stringify(state));
  } catch {
    /* privat modus e.l. — ikke noe å gjøre med */
  }
}

/** Én vei inn for alle endringer, så vi aldri glemmer å tegne om. */
function set(patch, opts = {}) {
  Object.assign(state, patch);
  saveState();
  if (opts.style) scheduleStyle();
  if (opts.panel !== false) renderPanel();
  layoutPoster();
}

// ---------------------------------------------------------------- stil / kart

function styleOpts() {
  return {
    key: apiKey,
    // Bryterne betyr nøyaktig det de sier, i begge moduser. Her lå det en regel
    // som slo på stedsnavn av seg selv i kartmodus når ingen var valgt — den
    // gjorde at navn dukket opp med bryteren av, og forsvant igjen så snart du
    // slo på en av de andre. En bryter som ikke stemmer med kartet er verre enn
    // et navnløst kart.
    labels: {
      places: state.labelPlaces,
      roads: state.labelRoads,
      water: state.labelWater,
    },
    buildings: state.buildings,
    green: state.green,
    landuse: state.landuse,
    water: state.water,
    roads: state.roads,
    tunnels: state.tunnels,
    rail: state.rail,
    boundaries: state.boundaries,
    lineScale: state.lineScale,
  };
}

function currentStyle() {
  return buildStyle(getTheme(state.themeId), styleOpts());
}

/**
 * Venter til stilen faktisk er ferdig lastet.
 *
 * 'styledata' fyrer for tidlig. Legger man markørlagene inn på den halvbygde
 * stilen, krasjer MapLibres etikettplassering med en TypeError inne i biblioteket,
 * og markørene blir borte. isStyleLoaded() er det eneste som svarer ærlig.
 */
function whenStyleReady(fn) {
  if (!map) return;
  if (map.isStyleLoaded()) return fn();
  const t = setInterval(() => {
    if (!map || map.isStyleLoaded()) {
      clearInterval(t);
      if (map) fn();
    }
  }, 80);
}

/** setStyle fjerner alle kilder, så markørene må legges inn igjen etterpå. */
function applyStyle() {
  if (!map) return;
  map.setStyle(currentStyle());
  whenStyleReady(() => syncMarkers(map, state.markers, getTheme(state.themeId)));
}

function scheduleStyle() {
  clearTimeout(styleTimer);
  styleTimer = setTimeout(applyStyle, 120);
}

function initMap() {
  map = new maplibregl.Map({
    container: 'map',
    style: currentStyle(),
    center: state.center,
    zoom: state.zoom,
    bearing: state.bearing,
    pitch: state.pitch,
    attributionControl: false,
    dragRotate: true,
    // Uten denne er WebGL-bufferet tomt når eksporten leser av canvaset.
    preserveDrawingBuffer: true,
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');

  map.on('load', () => syncMarkers(map, state.markers, getTheme(state.themeId)));

  map.on('moveend', () => {
    const c = map.getCenter();
    state.center = [c.lng, c.lat];
    state.zoom = map.getZoom();
    state.bearing = map.getBearing();
    state.pitch = map.getPitch();
    saveState();
    updateReadout();
    if (state.autoCoords) {
      state.coords = formatCoords(c.lng, c.lat);
      layoutPoster();
    }
  });

  map.on('click', (e) => {
    if (!placing) return;
    state.markers = [
      ...state.markers,
      makeMarker(e.lngLat.lng, e.lngLat.lat, {
        color: state.markerColor,
        shape: state.markerShape,
        size: state.markerSize,
      }),
    ];
    saveState();
    syncMarkers(map, state.markers, getTheme(state.themeId));
    renderPanel();
  });

  map.on('error', (e) => {
    const msg = String(e?.error?.message || '');
    console.error('[kart]', msg, e?.error);
    if (/401|403/.test(msg)) U.toast('MapTiler avviste nøkkelen. Sjekk den under «Nøkkel».');
  });

  // Som mapposter: hjulet skal rulle siden, ikke zoome kartet, med mindre du
  // holder Shift. Uten dette blir det umulig å scrolle forbi kartet.
  dom.mapFrame.addEventListener(
    'wheel',
    (e) => {
      if (state.mode === 'poster' && !e.shiftKey) e.stopPropagation();
    },
    { capture: true }
  );
}

function setPlacing(on) {
  placing = on;
  if (map) map.getCanvas().style.cursor = on ? 'crosshair' : '';
  renderPanel();
}

// ------------------------------------------------------------ plakatoppsett

// map.resize() fyrer moveend, og moveend tegner om plakaten. Uten denne vakten
// kaller de to hverandre til stacken tar slutt. Størrelsen endrer seg sjelden,
// så det holder å hoppe over resize når den faktisk er uendret.
let lastMapSize = { w: -1, h: -1 };

function syncMapSize() {
  if (!map) return;
  const w = dom.mapFrame.clientWidth;
  const h = dom.mapFrame.clientHeight;
  if (w === lastMapSize.w && h === lastMapSize.h) return;
  lastMapSize = { w, h };
  map.resize();
}

/** Koordinatavlesningen i panelet, uten å bygge hele panelet på nytt. */
function updateReadout() {
  const node = dom.panel.querySelector('.coord-readout');
  if (!node) return;
  const [a, b] = node.children;
  if (a) a.textContent = formatCoords(state.center[0], state.center[1], 4);
  if (b) b.textContent = `zoom ${state.zoom.toFixed(2)}`;
}

function posterCfg() {
  return {
    frame: state.frame,
    // Maskeformer gir ikke mening når kartet skal dekke hele arket.
    shape: state.frame === 'helside' ? 'rect' : state.shape,
    scrim: state.scrim,
    textLayout: state.textLayout,
    title: state.title,
    subtitle: state.subtitle,
    coords: state.coords,
    titleFont: state.titleFont,
    subFont: state.subFont,
    coordFont: state.coordFont,
    titleWeight: state.titleWeight,
    titleSize: state.titleSize,
    subSize: state.subSize,
    coordSize: state.coordSize,
    tracking: state.tracking,
    upper: state.upper,
    margin: state.margin,
    textScale: state.textScale,
    border: state.border,
    mapOutline: state.mapOutline,
    credit: state.credit,
  };
}

function layoutPoster() {
  const theme = getTheme(state.themeId);
  const isMap = state.mode === 'map';
  dom.poster.classList.toggle('is-map', isMap);
  dom.hint.hidden = isMap;

  const box = dom.stage.getBoundingClientRect();
  const pad = isMap ? 0 : 36;
  const availW = box.width - pad * 2;
  const availH = box.height - pad * 2;

  if (isMap) {
    dom.poster.style.cssText = `width:${box.width}px;height:${box.height}px;background:${theme.paper}`;
    dom.mapFrame.style.cssText = 'left:0;top:0;width:100%;height:100%;clip-path:none';
    dom.posterText.innerHTML = '';
    syncMapSize();
    return;
  }

  const fmt = getFormat(state.formatId);
  const ratio = fmt.wmm / fmt.hmm;
  let W = availW;
  let H = W / ratio;
  if (H > availH) {
    H = availH;
    W = H * ratio;
  }

  const cfg = posterCfg();
  const L = computeLayout(W, H, cfg);

  dom.poster.style.cssText =
    `width:${W}px;height:${H}px;background:${theme.paper};color:${theme.ink}`;
  dom.mapFrame.style.cssText =
    `left:${L.map.x}px;top:${L.map.y}px;width:${L.map.w}px;height:${L.map.h}px;` +
    `clip-path:path('${maskPath(cfg.shape, L.map.w, L.map.h)}')`;

  dom.posterText.innerHTML = '';

  if (L.scrim) {
    dom.posterText.appendChild(
      U.el('div', {
        class: 'poster-scrim',
        style:
          `left:${L.scrim.x}px;top:${L.scrim.y}px;width:${L.scrim.w}px;height:${L.scrim.h}px;` +
          `background:linear-gradient(to bottom, ${rgba(theme.paper, 0)} 0%, ` +
          `${rgba(theme.paper, 0.72)} 55%, ${rgba(theme.paper, 0.92)} 100%)`,
      })
    );
  }

  if (L.border) {
    dom.posterText.appendChild(
      U.el('div', {
        class: 'poster-border',
        style: `left:${L.border.x}px;top:${L.border.y}px;width:${L.border.w}px;height:${L.border.h}px;border-width:${L.border.width}px;border-color:${theme.ink}`,
      })
    );
  }

  if (state.mapOutline && !L.fullBleed) {
    dom.posterText.appendChild(
      U.el('div', {
        class: 'map-outline',
        html: `<svg width="${L.map.w}" height="${L.map.h}" viewBox="0 0 ${L.map.w} ${L.map.h}"><path d="${maskPath(cfg.shape, L.map.w, L.map.h)}" fill="none" stroke="${theme.ink}" stroke-width="${Math.max(1, W * 0.0018)}"/></svg>`,
        style: `left:${L.map.x}px;top:${L.map.y}px;width:${L.map.w}px;height:${L.map.h}px`,
      })
    );
  }

  for (const l of L.text.lines) {
    if (l.rule) {
      dom.posterText.appendChild(
        U.el('div', {
          class: 'poster-rule',
          style: `left:${l.x}px;top:${l.y}px;width:${l.w}px;height:${l.thickness}px;background:${theme.ink}`,
        })
      );
      continue;
    }
    const tracking = l.size * l.tracking;
    // CSS legger sperring også etter siste tegn; canvas gjør det ikke. Skyv
    // tilbake så forhåndsvisning og eksport havner på samme sted.
    const nudge = l.align === 'center' ? tracking / 2 : l.align === 'right' ? tracking : 0;
    const shift =
      l.align === 'center' ? 'translateX(-50%)' : l.align === 'right' ? 'translateX(-100%)' : '';
    dom.posterText.appendChild(
      U.el('div', {
        class: 'poster-line',
        text: l.upper ? l.text.toLocaleUpperCase('nb-NO') : l.text,
        style:
          `left:${l.x + nudge}px;top:${l.y}px;font-family:"${l.font}",sans-serif;` +
          `font-weight:${l.weight};font-size:${l.size}px;letter-spacing:${tracking}px;` +
          `transform:${shift};color:${theme.ink}`,
      })
    );
  }

  if (state.credit) {
    dom.posterText.appendChild(
      U.el('div', {
        class: 'poster-credit',
        text: '© OpenStreetMap-bidragsytere',
        style: `top:${H - L.margin * 0.75}px;font-size:${W * 0.0075}px;color:${theme.ink}`,
      })
    );
  }

  syncMapSize();
}

// ---------------------------------------------------------------- søkefelt

let searchAbort = null;

function searchBox() {
  const results = U.el('div', { class: 'results', hidden: true });
  const input = U.el('input', {
    type: 'text',
    class: 'input',
    placeholder: 'Søk etter sted…',
    spellcheck: 'false',
    oninput: (e) => run(e.target.value),
    onkeydown: (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        results.querySelector('.result')?.click();
      }
    },
  });

  let timer = null;
  function run(q) {
    clearTimeout(timer);
    searchAbort?.abort();
    if (q.trim().length < 2) {
      results.hidden = true;
      return;
    }
    timer = setTimeout(async () => {
      if (!apiKey) {
        U.toast('Legg inn MapTiler-nøkkel først (knappen oppe til høyre).');
        return;
      }
      searchAbort = new AbortController();
      try {
        const places = await geoSearch(q, apiKey, { signal: searchAbort.signal });
        results.innerHTML = '';
        if (!places.length) {
          results.appendChild(U.el('div', { class: 'result-empty', text: 'Ingen treff' }));
        }
        for (const p of places) {
          results.appendChild(
            U.el('button', { type: 'button', class: 'result', onclick: () => pick(p) }, [
              U.el('strong', { text: p.name }),
              U.el('span', { text: p.context }),
            ])
          );
        }
        results.hidden = false;
      } catch (err) {
        if (err.name !== 'AbortError') U.toast(err.message);
      }
    }, 280);
  }

  function pick(p) {
    results.hidden = true;
    input.value = p.name;
    const patch = {
      title: p.name,
      subtitle: p.context || p.country || state.subtitle,
      center: p.center,
    };
    if (state.autoCoords) patch.coords = formatCoords(p.center[0], p.center[1]);
    Object.assign(state, patch);
    saveState();

    // MapTiler gir ofte et bbox som er selve punktet (bredde og høyde 0) for
    // første treff. fitBounds på det zoomer til maks og lander på en grå flekk,
    // så vi bruker det bare når det faktisk har utstrekning.
    const b = p.bbox;
    const hasExtent = b && Math.abs(b[2] - b[0]) > 1e-6 && Math.abs(b[3] - b[1]) > 1e-6;
    if (hasExtent) {
      map.fitBounds([[b[0], b[1]], [b[2], b[3]]], { padding: 20, duration: 0 });
    } else {
      map.jumpTo({ center: p.center, zoom: Math.max(state.zoom, 11.5) });
    }
    renderPanel();
    layoutPoster();
  }

  return U.el('div', { class: 'searchbox' }, [input, results]);
}

// ---------------------------------------------------------------- markører

function markerSection() {
  const kids = [
    U.el('button', {
      type: 'button',
      class: `${placing ? 'primary-btn' : 'ghost-btn'} wide`,
      onclick: () => setPlacing(!placing),
      text: placing ? 'Ferdig — klikk i kartet for flere' : 'Plassér markør',
    }),
    U.field(
      'Farge på neste markør',
      U.colorPicker(MARKER_COLORS, state.markerColor, (v) => set({ markerColor: v }))
    ),
    U.field('Form', U.segmented(MARKER_STYLES, state.markerShape, (v) => set({ markerShape: v }))),
    U.field(
      'Størrelse',
      U.slider(state.markerSize, 3, 30, 1, (v) => set({ markerSize: v }), (v) => `${v} px`)
    ),
  ];

  if (!state.markers.length) {
    kids.push(U.el('p', { class: 'empty-note', text: 'Ingen markører ennå.' }));
    return U.section('3 · Markører', kids);
  }

  kids.push(
    U.el(
      'div',
      { class: 'marker-list' },
      state.markers.map((m, i) =>
        U.el('div', { class: 'marker-row' }, [
          U.el('span', { class: `marker-dot shape-${m.shape}`, style: `--c:${m.color}` }),
          U.el('input', {
            type: 'text',
            class: 'marker-name',
            value: m.label || '',
            placeholder: `${i + 1}. ${m.lat.toFixed(3)}, ${m.lng.toFixed(3)}`,
            title: 'Navn på markøren — la stå tomt for ingen tekst',
            spellcheck: 'false',
            // Ingen renderPanel() her. Å bygge panelet om for hvert tastetrykk
            // ville rive ut feltet du skriver i og miste markøren.
            oninput: (e) => {
              m.label = e.target.value;
              saveState();
              syncMarkers(map, state.markers, getTheme(state.themeId));
            },
          }),
          U.el('button', {
            type: 'button',
            class: 'icon-btn',
            title: 'Sentrer kartet her',
            text: '⌖',
            onclick: () => map.jumpTo({ center: [m.lng, m.lat] }),
          }),
          U.el('button', {
            type: 'button',
            class: 'icon-btn danger',
            title: 'Slett',
            text: '✕',
            onclick: () => removeMarker(m.id),
          }),
        ])
      )
    )
  );

  kids.push(
    U.el('button', {
      type: 'button',
      class: 'ghost-btn wide',
      text: `Fjern alle (${state.markers.length})`,
      onclick: () => {
        state.markers = [];
        saveState();
        syncMarkers(map, state.markers, getTheme(state.themeId));
        renderPanel();
      },
    })
  );

  return U.section('3 · Markører', kids);
}

function removeMarker(id) {
  state.markers = state.markers.filter((x) => x.id !== id);
  saveState();
  syncMarkers(map, state.markers, getTheme(state.themeId));
  renderPanel();
}

// ---------------------------------------------------------------- panelet

function renderPanel() {
  const p = dom.panel;
  const scroll = p.scrollTop;
  p.innerHTML = '';

  const isPoster = state.mode === 'poster';

  p.appendChild(
    U.section('1 · Sted', [
      searchBox(),
      U.el('div', { class: 'coord-readout' }, [
        U.el('span', { text: formatCoords(state.center[0], state.center[1], 4) }),
        U.el('span', { class: 'dim', text: `zoom ${state.zoom.toFixed(2)}` }),
      ]),
      isPoster &&
        U.toggle('Koordinater følger kartet', state.autoCoords, (v) => {
          const patch = { autoCoords: v };
          if (v) patch.coords = formatCoords(state.center[0], state.center[1]);
          set(patch);
        }),
    ])
  );

  p.appendChild(
    U.section('2 · Utseende', [
      U.swatches(THEMES, state.themeId, (v) => set({ themeId: v }, { style: true })),
      U.field(
        'Linjetykkelse',
        U.slider(state.lineScale, 0.4, 2.5, 0.05, (v) => {
          state.lineScale = v;
          saveState();
          scheduleStyle();
        }, (v) => `${v.toFixed(2)}×`)
      ),
      U.el('span', { class: 'field-label', text: 'Navn på kartet' }),
      U.el('div', { class: 'toggles' }, [
        U.toggle('Stedsnavn', state.labelPlaces, (v) => set({ labelPlaces: v }, { style: true })),
        U.toggle('Veinavn', state.labelRoads, (v) => set({ labelRoads: v }, { style: true })),
        U.toggle('Vannavn', state.labelWater, (v) => set({ labelWater: v }, { style: true })),
      ]),
      U.el('span', { class: 'field-label', text: 'Kartlag' }),
      U.el('div', { class: 'toggles' }, [
        U.toggle('Vann', state.water, (v) => set({ water: v }, { style: true })),
        U.toggle('Grønt', state.green, (v) => set({ green: v }, { style: true })),
        U.toggle('Arealbruk', state.landuse, (v) => set({ landuse: v }, { style: true })),
        U.toggle('Bygninger', state.buildings, (v) => set({ buildings: v }, { style: true })),
        U.toggle('Veier', state.roads, (v) => set({ roads: v }, { style: true })),
        U.toggle('Tunneler', state.tunnels, (v) => set({ tunnels: v }, { style: true })),
        U.toggle('Jernbane', state.rail, (v) => set({ rail: v }, { style: true })),
        U.toggle('Grenser', state.boundaries, (v) => set({ boundaries: v }, { style: true })),
      ]),
    ])
  );

  p.appendChild(markerSection());

  if (isPoster) {
    const fullBleed = state.frame === 'helside';

    p.appendChild(
      U.section('4 · Format', [
        U.field('Størrelse', U.select(FORMATS, state.formatId, (v) => set({ formatId: v }))),
        U.field(
          'Oppsett',
          U.segmented(FRAMES, state.frame, (v) => set({ frame: v })),
          fullBleed ? 'Kartet dekker hele arket, teksten ligger oppå.' : null
        ),
        !fullBleed &&
          U.field(
            'Kartform',
            U.segmented(SHAPES, state.shape, (v) => set({ shape: v }), { wrap: true })
          ),
        U.field(
          fullBleed ? 'Tekstmarg' : 'Marg',
          U.slider(state.margin, 0.02, 0.16, 0.005, (v) => {
            state.margin = v;
            saveState();
            layoutPoster();
          }, (v) => `${Math.round(v * 100)} %`)
        ),
        U.field(
          'Tekstfelt',
          U.slider(state.textScale, 0.08, 0.45, 0.01, (v) => {
            state.textScale = v;
            saveState();
            layoutPoster();
          }, (v) => `${Math.round(v * 100)} %`)
        ),
        U.el('div', { class: 'toggles' }, [
          U.toggle('Ytre ramme', state.border, (v) => set({ border: v })),
          !fullBleed &&
            U.toggle('Kontur rundt kart', state.mapOutline, (v) => set({ mapOutline: v })),
          fullBleed && U.toggle('Slør bak tekst', state.scrim, (v) => set({ scrim: v })),
          U.toggle('OSM-kreditering', state.credit, (v) => set({ credit: v })),
        ]),
      ])
    );

    p.appendChild(
      U.section('5 · Tekst', [
        U.field(
          'Oppsett',
          U.segmented(TEXT_LAYOUTS, state.textLayout, (v) => set({ textLayout: v }), { wrap: true })
        ),
        U.field('Tittel', U.textInput(state.title, 'Tromsø', (v) => {
          state.title = v;
          saveState();
          layoutPoster();
        })),
        U.field('Undertekst', U.textInput(state.subtitle, 'Troms, Norge', (v) => {
          state.subtitle = v;
          saveState();
          layoutPoster();
        })),
        U.field('Koordinatlinje', U.textInput(state.coords, '69.6° N / 18.9° E', (v) => {
          state.coords = v;
          state.autoCoords = false;
          saveState();
          layoutPoster();
        })),
        U.field('Tittelfont', U.select(U.FONTS, state.titleFont, (v) => set({ titleFont: v }))),
        U.field('Undertekstfont', U.select(U.FONTS, state.subFont, (v) => set({ subFont: v }))),
        U.field('Koordinatfont', U.select(U.FONTS, state.coordFont, (v) => set({ coordFont: v }))),
        U.field(
          'Tittelstørrelse',
          U.slider(state.titleSize, 0.03, 0.18, 0.002, (v) => {
            state.titleSize = v;
            saveState();
            layoutPoster();
          }, (v) => `${Math.round(v * 1000)}`)
        ),
        U.field(
          'Sperring',
          U.slider(state.tracking, 0, 0.5, 0.01, (v) => {
            state.tracking = v;
            saveState();
            layoutPoster();
          }, (v) => v.toFixed(2))
        ),
        U.field(
          'Tittelvekt',
          U.segmented(
            [
              { id: '300', name: 'Lett' },
              { id: '400', name: 'Normal' },
              { id: '700', name: 'Fet' },
            ],
            String(state.titleWeight),
            (v) => set({ titleWeight: Number(v) })
          )
        ),
        U.toggle('VERSALER', state.upper, (v) => set({ upper: v })),
      ])
    );

    const fmt = getFormat(state.formatId);
    const size = exportSize(fmt, state.dpi);
    p.appendChild(
      U.section('6 · Eksport', [
        U.field(
          'Oppløsning',
          U.segmented(
            [
              { id: '150', name: '150 dpi' },
              { id: '300', name: '300 dpi' },
              { id: '600', name: '600 dpi' },
            ],
            String(state.dpi),
            (v) => set({ dpi: Number(v) })
          )
        ),
        U.el('div', { class: 'export-info' }, [
          U.el('span', { text: `${size.width} × ${size.height} px` }),
          U.el('span', {
            class: 'dim',
            text: size.clamped
              ? 'nedskalert til nettleserens tak'
              : `${fmt.name} @ ${state.dpi} dpi`,
          }),
        ]),
        U.el('button', { class: 'primary-btn wide', onclick: doExport }, ['Last ned PNG']),
        U.el('button', { class: 'ghost-btn wide', onclick: doExportJpeg }, ['Last ned JPG']),
      ])
    );
  }

  p.scrollTop = scroll;
}

// ---------------------------------------------------------------- eksport

let exporting = false;

async function doExport() {
  await runExport('image/png', 'png');
}
async function doExportJpeg() {
  await runExport('image/jpeg', 'jpg');
}

async function runExport(type, ext) {
  if (exporting) return;
  if (!apiKey) return U.toast('Legg inn MapTiler-nøkkel først.');
  exporting = true;
  document.body.classList.add('busy');
  U.toast('Rendrer plakat i full oppløsning…', 60000);
  try {
    const canvas = await renderPoster({
      map,
      format: getFormat(state.formatId),
      dpi: state.dpi,
      cfg: posterCfg(),
      palette: getTheme(state.themeId),
    });
    const slug = (state.title || 'kart')
      .toLowerCase()
      .replace(/[^a-z0-9æøå]+/gi, '-')
      .replace(/^-|-$/g, '');
    await downloadCanvas(canvas, `${slug || 'kart'}-${state.formatId}.${ext}`, type);
    U.toast(canvas.__clamped ? 'Ferdig — nedskalert til nettleserens maksgrense.' : 'Ferdig.');
  } catch (err) {
    console.error(err);
    U.toast(`Eksport feilet: ${err.message || err}`);
  } finally {
    exporting = false;
    document.body.classList.remove('busy');
  }
}

// ---------------------------------------------------------------- nøkkelmodal

function setupKeyModal() {
  const modal = document.getElementById('keyModal');
  const input = document.getElementById('keyInput');
  const open = () => {
    input.value = apiKey;
    modal.hidden = false;
    input.focus();
  };
  document.getElementById('keyBtn').addEventListener('click', open);
  document.getElementById('keyCancel').addEventListener('click', () => (modal.hidden = true));
  document.getElementById('keySave').addEventListener('click', () => {
    apiKey = input.value.trim();
    localStorage.setItem(LS_KEY, apiKey);
    modal.hidden = true;
    applyStyle();
    U.toast(apiKey ? 'Nøkkel lagret.' : 'Nøkkel fjernet.');
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.hidden = true;
  });
  if (!apiKey) open();
}

// ---------------------------------------------------------------- oppstart

function setupModes() {
  for (const btn of document.querySelectorAll('.mode-btn')) {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      set({ mode: btn.dataset.mode }, { style: true });
    });
  }
  document.querySelector(`.mode-btn[data-mode="${state.mode}"]`)?.click();
}

function init() {
  setupKeyModal();
  initMap();
  setupModes();
  renderPanel();
  layoutPoster();
  new ResizeObserver(() => layoutPoster()).observe(dom.stage);
  document.fonts?.ready.then(() => layoutPoster());

  // Feilsøkingshåndtak — koster ingenting og sparer mye tid i konsollen.
  window.kartverktoy = {
    get map() {
      return map;
    },
    state,
    currentStyle,
  };
}

init();
