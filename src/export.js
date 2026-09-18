// Høyoppløst eksport.
//
// Trikset er `setPixelRatio`. Kartet beholder nøyaktig samme CSS-størrelse og
// samme zoom som forhåndsvisningen, men tegner til et mye større bilde-buffer.
// Da blir utsnittet identisk ned til pikselen, mens veibredder, tekst og alt
// annet skaleres proporsjonalt opp — som å skrive ut en vektor.
//
// To alternativer ble forkastet underveis:
//   * Større container + økt zoom: veiene beholder bredden i piksler og blir
//     hårtynne på en 70×100-plakat.
//   * Et eget kart utenfor skjermen: ny WebGL-kontekst og ny stillasting som
//     må fullføre før noe kan tegnes. Her er kartet allerede lastet, så
//     eksporten har ingen oppstart å vente på.

import { computeLayout, maskPath, exportSize, rgba } from './layout.js';

// WebGL garanterer ikke teksturer over dette. Går vi forbi, får vi en svart
// eller avkortet plakat i stedet for en feilmelding.
const MAX_GL_DIM = 16384;

/**
 * Tegner kartet til et eget canvas på `targetW`×`targetH` piksler.
 * Kartet settes tilbake til vanlig oppløsning før funksjonen returnerer.
 */
async function captureMap(map, targetW, targetH) {
  const el = map.getCanvas();
  const cssW = el.clientWidth;
  const cssH = el.clientHeight;
  if (!cssW || !cssH) throw new Error('kartet har ingen størrelse å eksportere fra');

  const wanted = targetW / cssW;
  const ceiling = MAX_GL_DIM / Math.max(cssW, cssH);
  const ratio = Math.max(1, Math.min(wanted, ceiling));

  const previous =
    typeof map.getPixelRatio === 'function'
      ? map.getPixelRatio()
      : window.devicePixelRatio || 1;

  map.setPixelRatio(ratio);
  try {
    await waitForIdle(map);
    const src = map.getCanvas();
    const out = document.createElement('canvas');
    out.width = targetW;
    out.height = targetH;
    // Én skalering her dekker både avrundingen i ratio og taket over.
    out.getContext('2d').drawImage(src, 0, 0, targetW, targetH);
    return out;
  } finally {
    map.setPixelRatio(previous);
  }
}

/** 'idle' fyrer for tidlig; vent til kartet faktisk har alle fliser inne. */
function waitForIdle(map, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      if (map.loaded() && map.areTilesLoaded()) {
        map.triggerRepaint();
        // La siste bilde faktisk tegnes før vi leser ut bufferet.
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error('kartet ble ikke ferdig lastet i tide'));
        return;
      }
      setTimeout(check, 120);
    };
    check();
  });
}

/** Sørg for at plakatfontene er lastet før canvas tegner tekst med dem. */
async function ensureFonts(lines) {
  if (!document.fonts) return;
  const specs = new Set();
  for (const l of lines) {
    if (l.rule) continue;
    specs.add(`${l.weight || 400} ${Math.round(l.size)}px "${l.font}"`);
  }
  await Promise.all([...specs].map((s) => document.fonts.load(s).catch(() => {})));
  await document.fonts.ready;
}

/** Canvas har ikke letter-spacing i alle nettlesere — tegn tegn for tegn. */
function drawTracked(ctx, text, x, y, align, tracking) {
  if (!tracking) {
    ctx.textAlign = align;
    ctx.fillText(text, x, y);
    return;
  }
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width + tracking);
  const total = widths.reduce((a, b) => a + b, 0) - tracking;
  let cx = x;
  if (align === 'center') cx = x - total / 2;
  else if (align === 'right') cx = x - total;
  ctx.textAlign = 'left';
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i];
  });
}

/**
 * Tegner hele plakaten til et canvas.
 * @param {Object} args
 * @param {Object} args.map  det synlige kartet, allerede lastet
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderPoster({ map, format, dpi, cfg, palette }) {
  const { width: W, height: H, clamped } = exportSize(format, dpi);
  const L = computeLayout(W, H, cfg);

  const mapCanvas = await captureMap(map, Math.round(L.map.w), Math.round(L.map.h));

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(L.map.x, L.map.y);
  ctx.clip(new Path2D(maskPath(cfg.shape, L.map.w, L.map.h)));
  ctx.drawImage(mapCanvas, 0, 0, L.map.w, L.map.h);
  ctx.restore();

  if (cfg.mapOutline) {
    ctx.save();
    ctx.translate(L.map.x, L.map.y);
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = Math.max(1, W * 0.0018);
    ctx.stroke(new Path2D(maskPath(cfg.shape, L.map.w, L.map.h)));
    ctx.restore();
  }

  // Sløret bak helside-teksten, med samme gradient som forhåndsvisningen.
  if (L.scrim) {
    const g = ctx.createLinearGradient(0, L.scrim.y, 0, L.scrim.y + L.scrim.h);
    g.addColorStop(0, rgba(palette.paper, 0));
    g.addColorStop(0.55, rgba(palette.paper, 0.72));
    g.addColorStop(1, rgba(palette.paper, 0.92));
    ctx.fillStyle = g;
    ctx.fillRect(L.scrim.x, L.scrim.y, L.scrim.w, L.scrim.h);
  }

  if (L.border) {
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = L.border.width;
    ctx.strokeRect(L.border.x, L.border.y, L.border.w, L.border.h);
  }

  await ensureFonts(L.text.lines);

  ctx.fillStyle = palette.ink;
  ctx.textBaseline = 'top';
  for (const l of L.text.lines) {
    if (l.rule) {
      ctx.fillRect(l.x, l.y, l.w, l.thickness);
      continue;
    }
    ctx.font = `${l.weight || 400} ${l.size}px "${l.font}", sans-serif`;
    const text = l.upper ? l.text.toLocaleUpperCase('nb-NO') : l.text;
    drawTracked(ctx, text, l.x, l.y, l.align, l.size * l.tracking);
  }

  if (cfg.credit) {
    const size = W * 0.0075;
    ctx.font = `400 ${size}px "Inter", sans-serif`;
    ctx.globalAlpha = 0.55;
    drawTracked(
      ctx,
      '© OPENSTREETMAP-BIDRAGSYTERE',
      W / 2,
      H - L.margin * 0.62,
      'center',
      size * 0.12
    );
    ctx.globalAlpha = 1;
  }

  canvas.__clamped = clamped;
  return canvas;
}

export function downloadCanvas(canvas, filename, type = 'image/png', quality = 0.95) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('nettleseren klarte ikke å lage bildefilen'));
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        resolve();
      },
      type,
      quality
    );
  });
}
