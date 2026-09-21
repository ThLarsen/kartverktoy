// Kontrollpanelet. Byggeklossene under er med vilje små og dumme — panelet
// tegnes om i sin helhet når noe endres, og all tilstand bor i store.js.

export function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'style') n.style.cssText = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') n.value = v;
    else if (v === true) n.setAttribute(k, '');
    else n.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null || c === false) continue;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return n;
}

export function section(title, children, opts = {}) {
  const body = el('div', { class: 'sec-body' }, children);
  const head = el('button', {
    class: 'sec-head',
    type: 'button',
    onclick: () => wrap.classList.toggle('collapsed'),
  }, [el('span', { text: title }), el('span', { class: 'chev', html: '&#9662;' })]);
  const wrap = el('div', { class: `sec${opts.collapsed ? ' collapsed' : ''}` }, [head, body]);
  return wrap;
}

export function field(label, control, hint) {
  return el('label', { class: 'field' }, [
    el('span', { class: 'field-label', text: label }),
    control,
    hint ? el('span', { class: 'field-hint', text: hint }) : null,
  ]);
}

export function segmented(options, value, onChange, opts = {}) {
  return el(
    'div',
    { class: `segmented${opts.wrap ? ' wrap' : ''}` },
    options.map((o) =>
      el('button', {
        type: 'button',
        class: `seg${o.id === value ? ' is-active' : ''}`,
        title: o.title || o.name,
        onclick: () => onChange(o.id),
        text: o.name,
      })
    )
  );
}

export function select(options, value, onChange) {
  return el(
    'select',
    { class: 'input', onchange: (e) => onChange(e.target.value) },
    options.map((o) => el('option', { value: o.id, selected: o.id === value, text: o.name }))
  );
}

export function slider(value, min, max, step, onChange, fmt) {
  const out = el('span', { class: 'slider-val', text: fmt ? fmt(value) : String(value) });
  const input = el('input', {
    type: 'range',
    class: 'slider',
    min,
    max,
    step,
    value,
    oninput: (e) => {
      const v = Number(e.target.value);
      out.textContent = fmt ? fmt(v) : String(v);
      onChange(v);
    },
  });
  return el('div', { class: 'slider-row' }, [input, out]);
}

export function toggle(label, value, onChange) {
  return el('label', { class: `toggle${value ? ' is-on' : ''}` }, [
    el('input', {
      type: 'checkbox',
      checked: value,
      onchange: (e) => onChange(e.target.checked),
    }),
    el('span', { class: 'toggle-track' }, [el('span', { class: 'toggle-knob' })]),
    el('span', { class: 'toggle-label', text: label }),
  ]);
}

export function textInput(value, placeholder, onChange) {
  return el('input', {
    type: 'text',
    class: 'input',
    value: value || '',
    placeholder: placeholder || '',
    spellcheck: 'false',
    oninput: (e) => onChange(e.target.value),
  });
}

/**
 * Faste farger pluss en fri fargevelger. Den frie står til slutt og viser
 * gjeldende verdi, slik at et valg utenfor rekka ikke ser ubesvart ut.
 */
export function colorPicker(colors, value, onChange, opts = {}) {
  const { custom: withCustom = true } = opts;
  const custom =
    withCustom &&
    el('input', {
      type: 'color',
      class: 'color-custom',
      value,
      title: 'Egen farge',
      oninput: (e) => onChange(e.target.value),
    });
  return el('div', { class: 'color-row' }, [
    ...colors.map((c) =>
      el('button', {
        type: 'button',
        class: `color-chip${c.toLowerCase() === String(value).toLowerCase() ? ' is-active' : ''}`,
        style: `background:${c}`,
        title: c,
        onclick: () => onChange(c),
      })
    ),
    custom,
  ]);
}

export function swatches(themes, value, onChange) {
  return el(
    'div',
    { class: 'swatches' },
    themes.map((t) =>
      el(
        'button',
        {
          type: 'button',
          class: `swatch${t.id === value ? ' is-active' : ''}`,
          title: t.name,
          onclick: () => onChange(t.id),
        },
        [
          el('span', {
            class: 'swatch-chip',
            style: `background:${t.background};border-color:${t.buildingLine}`,
          }, [
            el('span', { class: 'sw-water', style: `background:${t.water}` }),
            el('span', { class: 'sw-green', style: `background:${t.green}` }),
            el('span', { class: 'sw-road', style: `background:${t.roadMajor}` }),
            el('span', { class: 'sw-road2', style: `background:${t.roadMinor}` }),
          ]),
          el('span', { class: 'swatch-name', text: t.name }),
        ]
      )
    )
  );
}

export const FONTS = [
  { id: 'Inter', name: 'Inter' },
  { id: 'Montserrat', name: 'Montserrat' },
  { id: 'Oswald', name: 'Oswald' },
  { id: 'Bebas Neue', name: 'Bebas Neue' },
  { id: 'Playfair Display', name: 'Playfair' },
  { id: 'Cormorant Garamond', name: 'Cormorant' },
  { id: 'Space Mono', name: 'Space Mono' },
];

export function toast(msg, ms = 2600) {
  const node = document.getElementById('toast');
  node.textContent = msg;
  node.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    node.hidden = true;
  }, ms);
}
