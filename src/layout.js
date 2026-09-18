// Plakatgeometri. Alt her regnes ut i *plakatpiksler*, og både forhåndsvisningen
// (HTML/CSS) og eksporten (canvas) kaller de samme funksjonene med hver sin bredde.
// Det er hele poenget: én kilde til sannhet, så det du ser er det du får. Legger du
// en ny formvariant her, dukker den opp begge steder uten videre.

/** Trykkformater. wmm/hmm i millimeter — px regnes ut fra dpi ved eksport. */
export const FORMATS = [
  { id: 'a4', name: 'A4', wmm: 210, hmm: 297 },
  { id: 'a3', name: 'A3', wmm: 297, hmm: 420 },
  { id: 'a2', name: 'A2', wmm: 420, hmm: 594 },
  { id: '30x40', name: '30×40 cm', wmm: 300, hmm: 400 },
  { id: '50x70', name: '50×70 cm', wmm: 500, hmm: 700 },
  { id: '70x100', name: '70×100 cm', wmm: 700, hmm: 1000 },
  { id: '24x36', name: '24×36″', wmm: 609.6, hmm: 914.4 },
  { id: 'kvadrat', name: 'Kvadrat', wmm: 300, hmm: 300 },
  { id: 'liggende', name: 'A4 liggende', wmm: 297, hmm: 210 },
];

export const FORMATS_BY_ID = Object.fromEntries(FORMATS.map((f) => [f.id, f]));

export function getFormat(id) {
  return FORMATS_BY_ID[id] || FORMATS[0];
}

/** Eksportstørrelse i piksler ved gitt dpi, med tak så nettleseren ikke gir opp. */
export function exportSize(format, dpi, maxPx = 9000) {
  const mmToPx = dpi / 25.4;
  let w = Math.round(format.wmm * mmToPx);
  let h = Math.round(format.hmm * mmToPx);
  const over = Math.max(w, h) / maxPx;
  if (over > 1) {
    w = Math.round(w / over);
    h = Math.round(h / over);
  }
  return { width: w, height: h, clamped: over > 1 };
}

export const SHAPES = [
  { id: 'rect', name: 'Rektangel' },
  { id: 'rounded', name: 'Avrundet' },
  { id: 'circle', name: 'Sirkel' },
  { id: 'hexagon', name: 'Heksagon' },
  { id: 'heart', name: 'Hjerte' },
  { id: 'arch', name: 'Portal' },
];

/**
 * SVG-path for kartmasken, i en boks w×h med origo i (0,0).
 * Returverdien brukes både i CSS `clip-path: path(...)` og `new Path2D(...)`,
 * så den må være gyldig begge steder — hold deg til M/L/C/A/Z.
 */
export function maskPath(shape, w, h) {
  const r = (n) => Math.round(n * 100) / 100;
  switch (shape) {
    case 'rounded': {
      const k = Math.min(w, h) * 0.06;
      return `M ${r(k)} 0 L ${r(w - k)} 0 A ${r(k)} ${r(k)} 0 0 1 ${r(w)} ${r(k)} L ${r(w)} ${r(h - k)} A ${r(k)} ${r(k)} 0 0 1 ${r(w - k)} ${r(h)} L ${r(k)} ${r(h)} A ${r(k)} ${r(k)} 0 0 1 0 ${r(h - k)} L 0 ${r(k)} A ${r(k)} ${r(k)} 0 0 1 ${r(k)} 0 Z`;
    }
    case 'circle': {
      const rad = Math.min(w, h) / 2;
      const cx = w / 2;
      const cy = h / 2;
      return `M ${r(cx - rad)} ${r(cy)} A ${r(rad)} ${r(rad)} 0 1 0 ${r(cx + rad)} ${r(cy)} A ${r(rad)} ${r(rad)} 0 1 0 ${r(cx - rad)} ${r(cy)} Z`;
    }
    case 'hexagon': {
      const rad = Math.min(w / 2, h / 2);
      const cx = w / 2;
      const cy = h / 2;
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i - 90); // spiss topp
        pts.push(`${r(cx + rad * Math.cos(a))} ${r(cy + rad * Math.sin(a))}`);
      }
      return `M ${pts.join(' L ')} Z`;
    }
    case 'heart': {
      // Klassisk parametrisk hjerte, samplet og skalert inn i boksen.
      const raw = [];
      const steps = 180;
      for (let i = 0; i <= steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        const x = 16 * Math.sin(t) ** 3;
        const y =
          -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        raw.push([x, y]);
      }
      const xs = raw.map((pt) => pt[0]);
      const ys = raw.map((pt) => pt[1]);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const scale = Math.min(w / (maxX - minX), h / (maxY - minY));
      const ox = (w - (maxX - minX) * scale) / 2 - minX * scale;
      const oy = (h - (maxY - minY) * scale) / 2 - minY * scale;
      const pts = raw.map(([x, y]) => `${r(x * scale + ox)} ${r(y * scale + oy)}`);
      return `M ${pts.join(' L ')} Z`;
    }
    case 'arch': {
      const rad = w / 2;
      return `M 0 ${r(h)} L 0 ${r(rad)} A ${r(rad)} ${r(rad)} 0 0 1 ${r(w)} ${r(rad)} L ${r(w)} ${r(h)} Z`;
    }
    case 'rect':
    default:
      return `M 0 0 L ${r(w)} 0 L ${r(w)} ${r(h)} L 0 ${r(h)} Z`;
  }
}

export const FRAMES = [
  { id: 'ramme', name: 'Innrammet' },
  { id: 'helside', name: 'Helside' },
];

/** '#RRGGBB' → 'rgba(r,g,b,a)'. Brukes til sløret bak helside-teksten. */
export function rgba(hex, alpha) {
  const h = hex.replace('#', '');
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16
  );
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export const TEXT_LAYOUTS = [
  { id: 'klassisk', name: 'Klassisk' },
  { id: 'stablet', name: 'Stablet' },
  { id: 'linje', name: 'Linjedelt' },
  { id: 'ingen', name: 'Uten tekst' },
];

/**
 * Regner ut all plakatgeometri for en gitt bredde/høyde i piksler.
 *
 * @param {number} W
 * @param {number} H
 * @param {Object} cfg
 * @returns {{
 *   W:number, H:number, margin:number,
 *   map:{x:number,y:number,w:number,h:number},
 *   border:null|{x:number,y:number,w:number,h:number,width:number},
 *   text:{block:{x:number,y:number,w:number,h:number}, lines:Array<Object>}
 * }}
 */
export function computeLayout(W, H, cfg) {
  const margin = W * cfg.margin;
  const hasText = cfg.textLayout !== 'ingen';
  const fullBleed = cfg.frame === 'helside';

  // Teksthøyden skaleres med bredden, ikke høyden — ellers blir tekstblokka
  // absurd høy på 70×100 og klemt flat på liggende A4.
  const textH = hasText ? W * cfg.textScale : 0;
  const gap = hasText ? W * 0.035 : 0;

  let map;
  let block;
  let scrim = null;

  if (fullBleed) {
    // Kartet dekker hele arket og teksten ligger oppå, nede ved foten.
    map = { x: 0, y: 0, w: W, h: H };
    block = { x: margin, y: H - margin - textH, w: W - margin * 2, h: textH };
    if (hasText && cfg.scrim) {
      // Sløret starter et godt stykke over teksten så overgangen ikke synes
      // som en kant. Fargen settes av den som tegner, ut fra paletten.
      const top = Math.max(0, block.y - W * 0.18);
      scrim = { x: 0, y: top, w: W, h: H - top };
    }
  } else {
    map = { x: margin, y: margin, w: W - margin * 2, h: H - margin * 2 - textH - gap };
    block = { x: margin, y: map.y + map.h + gap, w: map.w, h: textH };
  }

  const border = cfg.border
    ? {
        x: margin * 0.45,
        y: margin * 0.45,
        w: W - margin * 0.9,
        h: H - margin * 0.9,
        width: Math.max(1, W * 0.0022),
      }
    : null;

  const lines = hasText ? textLines(block, cfg) : [];

  return { W, H, margin, fullBleed, map, border, scrim, text: { block, lines } };
}

function textLines(block, cfg) {
  const W = block.w;
  const cx = block.x + W / 2;
  const lines = [];
  const title = (cfg.title || '').trim();
  const sub = (cfg.subtitle || '').trim();
  const coords = (cfg.coords || '').trim();

  if (cfg.textLayout === 'stablet') {
    let y = block.y + W * 0.055;
    if (title) {
      lines.push({
        text: title,
        x: block.x,
        y,
        align: 'left',
        size: W * cfg.titleSize,
        font: cfg.titleFont,
        weight: cfg.titleWeight,
        tracking: cfg.tracking,
        upper: cfg.upper,
      });
      y += W * cfg.titleSize * 1.15;
    }
    if (sub) {
      lines.push({
        text: sub,
        x: block.x,
        y,
        align: 'left',
        size: W * cfg.subSize,
        font: cfg.subFont,
        weight: 400,
        tracking: cfg.tracking * 1.6,
        upper: cfg.upper,
      });
      y += W * cfg.subSize * 1.6;
    }
    if (coords) {
      lines.push({
        text: coords,
        x: block.x + W,
        y: block.y + W * 0.055,
        align: 'right',
        size: W * cfg.coordSize,
        font: cfg.coordFont,
        weight: 400,
        tracking: cfg.tracking * 1.2,
        upper: false,
      });
    }
    return lines;
  }

  if (cfg.textLayout === 'linje') {
    const y = block.y + W * 0.06;
    if (title) {
      lines.push({
        text: title,
        x: cx,
        y,
        align: 'center',
        size: W * cfg.titleSize,
        font: cfg.titleFont,
        weight: cfg.titleWeight,
        tracking: cfg.tracking,
        upper: cfg.upper,
      });
    }
    const y2 = y + W * cfg.titleSize * 1.0;
    lines.push({ rule: true, x: block.x, y: y2, w: W, thickness: Math.max(1, W * 0.0018) });
    const parts = [sub, coords].filter(Boolean);
    if (parts.length) {
      lines.push({
        text: parts.join('   ·   '),
        x: cx,
        y: y2 + W * 0.045,
        align: 'center',
        size: W * cfg.subSize,
        font: cfg.subFont,
        weight: 400,
        tracking: cfg.tracking * 1.8,
        upper: cfg.upper,
      });
    }
    return lines;
  }

  // klassisk: tittel stort og sentrert, undertekst og koordinater under
  let y = block.y + W * 0.065;
  if (title) {
    lines.push({
      text: title,
      x: cx,
      y,
      align: 'center',
      size: W * cfg.titleSize,
      font: cfg.titleFont,
      weight: cfg.titleWeight,
      tracking: cfg.tracking,
      upper: cfg.upper,
    });
    y += W * cfg.titleSize * 1.05;
  }
  if (sub) {
    lines.push({
      text: sub,
      x: cx,
      y,
      align: 'center',
      size: W * cfg.subSize,
      font: cfg.subFont,
      weight: 400,
      tracking: cfg.tracking * 2.2,
      upper: cfg.upper,
    });
    y += W * cfg.subSize * 1.9;
  }
  if (coords) {
    lines.push({
      text: coords,
      x: cx,
      y,
      align: 'center',
      size: W * cfg.coordSize,
      font: cfg.coordFont,
      weight: 400,
      tracking: cfg.tracking * 1.5,
      upper: false,
    });
  }
  return lines;
}

/** 59.9127 → "59.9127° N". Formatet mapposter bruker, og det folk forventer. */
export function formatCoords(lng, lat, decimals = 4) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(decimals)}° ${ns} / ${Math.abs(lng).toFixed(decimals)}° ${ew}`;
}
