import * as D from './data-access.js';
import { fmt } from './format.js';
import { color } from './colors.js';
import { tile, tiles } from './components/tile.js';
import { panel } from './components/panel.js';
import { table } from './components/table.js';
import { line } from './components/line.js';
import { bars } from './components/bars.js';
import { hbars } from './components/hbars.js';
import { note } from './components/note.js';
import { ask } from './components/ask.js';
import { briefing } from './components/briefing.js';
import { doc } from './components/doc.js';
import { services } from './components/services.js';

const text = t => (t ? D.resolveText(t) : '');
const deniedText = domain => `This is not available for your role. Data owner: ${D.domainLabel(domain)}.`;
const deniedPanel = (block, domain) =>
  panel({ title: text(block.title) || 'Not available', subtitle: deniedText(domain), body: '' });

function renderTile(item, ctx) {
  const m = D.getMetric(item.kpi, item.metric, ctx.role);
  if (m.denied) {
    return tile({ denied: true, label: item.label || item.kpi, valueText: '-', sub: 'Not available for your role' });
  }
  /* catalogue IDs such as K17 stay in the evidence dialog; the tile shows plain-language context only */
  const sub = item.sub ? text(item.sub) : '';
  return tile({
    ref: `${item.kpi}:${item.metric}`,
    label: item.label || m.label,
    valueText: m.valueText,
    sub,
    status: item.status || m.status,
    delta: m.delta,
    foot: m.targetText || (m.owner ? 'Owner: ' + m.owner : ''),
    trend: m.trend
  });
}

function renderChart(block, role) {
  const o = block.options || {};
  if (block.kind === 'hbar') {
    const ds = D.getDataset(block.dataset, role);
    if (ds.denied) return deniedPanel(block, ds.domain);
    const target = o.target ? D.getMetric(o.target.kpi, o.target.metric, role).value : null;
    /* the status is also written out for screen readers, so colour is never the only signal */
    const word = r => (target == null ? '' : r.value >= target ? 'meets target' : 'below target');
    const body = hbars({
      rows: ds.rows.map(r => [r.service, r.value, color(r.tone), word(r)]),
      max: o.max, base: o.base, target,
      fmt: v => fmt(v, o.unit || 'pct', { decimals: o.decimals })
    });
    return panel({ title: text(block.title), subtitle: text(block.subtitle), body });
  }
  const s = D.getSeries(block.kpi, block.series, role);
  if (s.denied) return deniedPanel(block, s.domain);
  const f = v => fmt(v, s.unit, { decimals: s.decimals });
  let body;
  if (block.kind === 'line') {
    const m = o.marker && s.markers[0];
    body = line({
      labels: s.labels, series: [{ name: s.name, color: color(o.color), values: s.values }],
      min: o.min, max: o.max, step: o.step, fmt: f, area: !!o.area,
      marker: m ? { i: m.index, text: m.text } : null, aria: o.aria,
      /* mark the first, peak and latest points with their numbers, not only the line */
      labelAt: [s.values.length - 1, ...(m ? [m.index] : [])]
    });
  } else {
    const hi = new Set(o.highlight === 'markers' ? s.markers.map(m => m.index) : []);
    const base = color(o.color);
    body = bars({
      labels: s.labels,
      series: [{ name: s.name, color: base, values: s.values, colors: s.values.map((v, i) => (hi.has(i) ? color(o.highlightColor) : base)) }],
      min: o.min, max: o.max, step: o.step, fmt: f, aria: o.aria,
      labelAt: [...hi, s.values.length - 1]
    });
  }
  return panel({ title: text(block.title), subtitle: text(block.subtitle), body });
}

function renderServices(block, role) {
  const ds = D.getDataset(block.dataset, role);
  if (ds.denied) return deniedPanel(block, ds.domain);
  const o = block.options || {};
  const list = ds.rows.map(r => ({ name: r.service, valueText: fmt(r.value, o.unit || 'pct', { decimals: o.decimals }), tone: r.tone }));
  return panel({ title: text(block.title), subtitle: text(block.subtitle), body: services(list) });
}

function renderTable(block, role) {
  const ds = D.getDataset(block.dataset, role);
  if (ds.denied) return deniedPanel(block, ds.domain);
  const columns = block.columns ? block.columns.map(k => ds.columns.find(c => c.key === k)) : ds.columns;
  const rows = block.limit ? ds.rows.slice(0, block.limit) : ds.rows;
  return panel({
    title: text(block.title), subtitle: text(block.subtitle),
    body: table({ columns, rows, footnote: text(block.footnote), footer: block.footer })
  });
}

function renderDoc(block, role) {
  const sections = block.sections.map(s => {
    let list = [];
    if (s.decisions) {
      const ds = D.getDataset(s.decisions.dataset, role);
      if (!ds.denied) {
        list = ds.rows.slice(0, s.decisions.limit).map(r => ({
          strong: r.step + '.',
          text: `${r.owner} to own follow-through by ${r.due}. Intended outcome: ${r.outcome}.`
        }));
      }
    }
    return { heading: s.heading, paragraphs: (s.paragraphs || []).map(text), list };
  });
  return doc({ title: block.title, sub: block.sub, note: block.note, sections });
}

export function renderBlock(block, ctx) {
  const { role, viewId } = ctx;
  switch (block.type) {
    case 'tiles': return tiles(block.items.map(it => renderTile(it, ctx)));
    case 'briefing':
      return briefing({
        eyebrow: block.eyebrow, headline: block.headline, text: text(block.text),
        stat: block.stat ? { value: text(block.stat.value), label: text(block.stat.label), note: text(block.stat.note) } : null
      });
    case 'chart': return renderChart(block, role);
    case 'services': return renderServices(block, role);
    case 'table': return renderTable(block, role);
    case 'doc': return renderDoc(block, role);
    case 'row': return `<div class="grid2">${block.blocks.map(b => renderBlock(b, ctx)).join('')}</div>`;
    case 'note': return note({ tone: block.tone, text: text(block.text) });
    case 'ask': return ask({ viewId, suggested: D.suggestedFor(viewId) });
    default: throw new Error(`Unknown block type ${block.type}`);
  }
}

export const renderView = (view, role) =>
  view.blocks.map(b => renderBlock(b, { role, viewId: view.id })).join('');

/* True when a view shows tiles, so the page can hint that tiles open their evidence. */
export function hasTiles(view) {
  const walk = blocks => blocks.some(b => b.type === 'tiles' || (b.blocks && walk(b.blocks)));
  return walk(view.blocks);
}
