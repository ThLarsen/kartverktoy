// Stedssøk mot MapTiler Geocoding. Samme nøkkel som flisene, så det er ingen
// ekstra konto å holde styr på. (Nominatim er gratis, men har en bruksavtale som
// forbyr autocomplete-trafikk av denne typen — derfor ikke brukt her.)

const BASE = 'https://api.maptiler.com/geocoding';

/**
 * @param {string} query
 * @param {string} key
 * @param {Object} [opts]
 * @param {AbortSignal} [opts.signal]
 * @param {number} [opts.limit]
 * @returns {Promise<Array<{name:string, context:string, country:string, center:[number,number], bbox:number[]|null}>>}
 */
export async function search(query, key, opts = {}) {
  const q = query.trim();
  if (!q || !key) return [];
  const url = `${BASE}/${encodeURIComponent(q)}.json?key=${encodeURIComponent(key)}&language=no&limit=${opts.limit || 6}`;
  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok) throw new Error(`Søket feilet (${res.status})`);
  const data = await res.json();
  return (data.features || []).map(toPlace);
}

/** Reverse geocoding — brukes når du panorerer kartet og vil ha ny stedstittel. */
export async function reverse(lng, lat, key, opts = {}) {
  if (!key) return null;
  const url = `${BASE}/${lng},${lat}.json?key=${encodeURIComponent(key)}&language=no&limit=1`;
  const res = await fetch(url, { signal: opts.signal });
  if (!res.ok) return null;
  const data = await res.json();
  const f = (data.features || [])[0];
  return f ? toPlace(f) : null;
}

function toPlace(f) {
  const ctx = f.context || [];
  const country = ctx.find((c) => String(c.id || '').startsWith('country'));
  const region = ctx.find(
    (c) => String(c.id || '').startsWith('region') || String(c.id || '').startsWith('subregion')
  );
  return {
    name: f.text || f.place_name || '',
    context: [region?.text, country?.text].filter(Boolean).join(', '),
    country: country?.text || '',
    countryCode: (f.properties && f.properties.country_code
      ? String(f.properties.country_code)
      : ''
    ).toUpperCase(),
    center: f.center,
    bbox: f.bbox || null,
  };
}
