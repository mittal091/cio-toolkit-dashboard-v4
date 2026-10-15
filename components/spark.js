/* A word-sized trend glyph: no axes, no labels, the last point marked.
   It is decorative. The value, change and evidence dialog carry the meaning. */
export function spark(values) {
  if (!values || values.length < 2) return '';
  const w = 64, h = 24, pad = 3;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const x = i => pad + (w - 2 * pad) * i / (values.length - 1);
  const y = v => h - pad - (h - 2 * pad) * (v - min) / span;
  const d = 'M' + values.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('L');
  const last = values.length - 1;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false"><path d="${d}"/><circle cx="${x(last).toFixed(1)}" cy="${y(values[last]).toFixed(1)}" r="2.4"/></svg>`;
}
