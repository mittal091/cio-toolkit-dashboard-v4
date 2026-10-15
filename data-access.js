/* The only module that knows where data comes from. Today it reads the JSON files;
   later each function can call the API, the semantic model or an AI service. */
import { evaluate } from './derive.js';
import { fmt, applyTokens } from './format.js';
import { loadStatus, saveStatus, resetStatus } from './state.js';

export const STATUS_OPTIONS = ['Open', 'In progress', 'Complete'];

const fetchJson = async path => {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`Could not load ${path}`);
  return r.json();
};

let S = null;

/* loader(path) -> parsed JSON. Defaults to fetch; tests pass a file reader. */
export async function init(loader = fetchJson) {
  const [kpis, views, roles, ask, sources, index] = await Promise.all([
    loader('config/kpis.json'), loader('config/views.json'), loader('config/roles.json'),
    loader('data/ask.json'), loader('data/sources.json'), loader('data/index.json')
  ]);
  const kpiFiles = await Promise.all(index.kpis.map(id => loader(`data/${id}.json`)));
  const dsFiles = await Promise.all(index.datasets.map(id => loader(`data/datasets/${id}.json`)));
  S = {
    meta: Object.fromEntries(kpis.map(k => [k.id, k])),
    kpi: Object.fromEntries(kpiFiles.map(k => [k.kpi, k])),
    datasets: Object.fromEntries(dsFiles.map(d => [d.id, d])),
    views, roles, ask, sources
  };
  return S;
}

/* ---------- access ---------- */
export function canSee(role, access) {
  if (Array.isArray(access)) return access.includes(role);
  const list = S.roles.domains[access];
  return !!list && list.includes(role);
}
export const domainLabel = domain => (S.roles.domainLabels && S.roles.domainLabels[domain]) || domain;
export const getRoles = () => S.roles.roles;
export const defaultRole = () => S.roles.default;
export const hasRole = id => S.roles.roles.some(r => r.id === id);
export const viewsFor = role => S.views.filter(v => v.roles.includes(role));
export const getView = id => S.views.find(v => v.id === id);

/* ---------- KPI metrics and series ---------- */
const ctxFor = k => ({
  kpi: k,
  datasets: S.datasets,
  metricValue: name => metricValue(k, name)
});

function metricValue(k, name) {
  const m = k.metrics && k.metrics[name];
  if (!m) throw new Error(`Unknown metric ${name} in ${k.kpi}`);
  return evaluate(m.value, ctxFor(k));
}

function kpiOrThrow(id) {
  const k = S.kpi[id];
  if (!k) throw new Error(`No data for ${id}`);
  return k;
}

export const aiValue = id => (S.meta[id] && S.meta[id].aiValue) || null;

/* Change against the prior period, coloured by direction (polarity), not by status.
   polarity "up" means higher is better, "down" means lower is better, missing means no judgement. */
function deltaOf(current, prior, m) {
  if (typeof current !== 'number' || typeof prior !== 'number') return null;
  const d = current - prior;
  if (Math.abs(d) < 1e-9) return { text: 'No change', tone: 'flat' };
  const abs = Math.abs(d);
  const body = m.unit === 'pct'
    ? abs.toFixed(m.decimals ?? 1) + ' pp'
    : fmt(abs, m.unit, { decimals: m.unit === 'count' ? undefined : m.decimals });
  const judged = m.polarity === 'up' || m.polarity === 'down';
  const tone = !judged ? 'flat' : ((d > 0) === (m.polarity === 'up') ? 'good' : 'bad');
  return { text: `${d > 0 ? '▲' : '▼'} ${body}`, tone };
}

const ownerOf = (id, k) => (S.meta[id] && S.meta[id].owner) || k.owner || null;

export function getMetric(id, key, role) {
  const k = kpiOrThrow(id);
  const m = k.metrics && k.metrics[key];
  if (!m) throw new Error(`Unknown metric ${key} in ${id}`);
  const access = m.access || k.domain;
  if (!canSee(role, access)) return { denied: true, domain: k.domain };
  const current = metricValue(k, key);
  const prior = m.prior === undefined ? null : evaluate(m.prior, ctxFor(k));
  const opts = { decimals: m.decimals, signed: m.signed };
  return {
    kpi: id, key, label: m.label, unit: m.unit, value: current, current, prior,
    hasPrior: prior !== null,
    valueText: fmt(current, m.unit, opts),
    priorText: prior === null ? null : fmt(prior, m.unit, opts),
    delta: deltaOf(current, prior, m),
    targetText: m.targetText ? resolveText(m.targetText) : null,
    status: m.status || 'neutral',
    owner: ownerOf(id, k),
    trend: m.trend && k.series && k.series[m.trend.series] ? k.series[m.trend.series].values : null
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
/* The latest "data as of" date across the KPI files, for example "12 Oct 2026". */
export function dataAsOf() {
  const dates = Object.values(S.kpi).map(k => k.asOf).filter(Boolean).sort();
  return dates.length ? fmtDate(dates[dates.length - 1]) : null;
}

/* Role labels that may see a data domain. Shown in the evidence dialog as the access rule. */
export function visibleTo(domain) {
  const allowed = (S.roles.domains[domain] || []);
  return S.roles.roles.filter(r => allowed.includes(r.id)).map(r => r.label);
}

/* Everything the evidence dialog shows. Catalogue fields win over the demo fields when present. */
export function getEvidence(id, key, role) {
  const m = getMetric(id, key, role);
  if (m.denied) return m;
  const k = kpiOrThrow(id);
  const cat = S.meta[id] || {};
  return {
    ...m,
    note: k.metrics[key].note ? resolveText(k.metrics[key].note) : '',
    source: cat.dataSource || k.source || null,
    definition: cat.definition || null,
    refresh: cat.refresh || null,
    aiValue: cat.aiValue || null,
    aiRole: cat.aiRole || null,
    aiHelp: cat.aiHelp || null,
    asOf: k.asOf ? fmtDate(k.asOf) : null,
    visibleTo: visibleTo(k.domain)
  };
}

export function getSeries(id, key, role) {
  const k = kpiOrThrow(id);
  const s = k.series && k.series[key];
  if (!s) throw new Error(`Unknown series ${key} in ${id}`);
  if (!canSee(role, k.domain)) return { denied: true, domain: k.domain };
  const markers = (k.markers || []).filter(m => m.series === key)
    .map(m => ({ index: m.index, text: resolveText(m.text) }));
  return { name: s.name, unit: s.unit, decimals: s.decimals, labels: s.labels, values: s.values, markers };
}

export function getKpi(id, role) {
  const k = kpiOrThrow(id);
  if (!canSee(role, k.domain)) return { denied: true, domain: k.domain };
  const metrics = {};
  for (const key of Object.keys(k.metrics || {})) metrics[key] = getMetric(id, key, role);
  const series = {};
  for (const key of Object.keys(k.series || {})) series[key] = getSeries(id, key, role);
  return { kpi: S.meta[id] || { id }, metrics, series, markers: k.markers || [] };
}

export function getDataset(id, role) {
  const d = S.datasets[id];
  if (!d) throw new Error(`Unknown dataset ${id}`);
  const access = d.access || d.domain;
  if (!canSee(role, access)) return { denied: true, domain: Array.isArray(access) ? 'cio' : access };
  const saved = loadStatus();
  const rows = d.rows.map(r => {
    const row = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, resolveDeep(v)]));
    if (row.id && row.status && STATUS_OPTIONS.includes(saved[row.id])) row.status = saved[row.id];
    return row;
  });
  return { id: d.id, columns: d.columns, rows };
}

/* ---------- decisions ---------- */
export function getAction(id, role) {
  const ds = getDataset('attention', role);
  if (ds.denied) return ds;
  return ds.rows.find(r => r.id === id) || null;
}

/* Returns true when the status was also saved in browser storage. */
export function setActionStatus(id, status) {
  const known = S.datasets.attention.rows.some(r => r.id === id);
  if (!known || !STATUS_OPTIONS.includes(status)) throw new Error(`Cannot set ${id} to ${status}`);
  return saveStatus(id, status);
}
export const resetActionStatuses = () => resetStatus();

/* ---------- text with number tokens ---------- */
function resolveDeep(v) {
  if (typeof v === 'string') return resolveText(v);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resolveDeep(x)]));
  return v;
}

/* {{ds:attention:open}} -> number of decisions not yet complete. Follows the saved statuses, so it matches the decision log.
   Ops: count, open, openCritical, openSoon. */
function datasetToken(name, op, expr) {
  const d = S.datasets[name];
  if (!d) throw new Error(`Unknown token ${expr}`);
  const saved = loadStatus();
  const rows = d.rows.map(r => ({ ...r, status: STATUS_OPTIONS.includes(saved[r.id]) ? saved[r.id] : r.status }));
  const open = rows.filter(r => r.status !== 'Complete');
  const n = {
    count: rows.length,
    open: open.length,
    openCritical: open.filter(r => r.item && r.item.badge === 'Critical').length,
    openSoon: open.filter(r => r.item && r.item.badge === 'Soon').length
  }[op];
  if (n === undefined) throw new Error(`Unknown token op ${expr}`);
  return String(n);
}

/* {{K17:mttr:last}} -> series value formatted by the series unit.  {{K07:vsW8}} -> metric value formatted. */
export function resolveText(text) {
  return applyTokens(text, expr => {
    const [id, name, op] = expr.split(':');
    if (id === 'ds') return datasetToken(name, op, expr);
    const k = kpiOrThrow(id);
    if (op === undefined) {
      if (!k.metrics || !k.metrics[name]) throw new Error(`Unknown token ${expr}`);
      const m = k.metrics[name];
      return fmt(metricValue(k, name), m.unit, { decimals: m.decimals, signed: m.signed });
    }
    const s = k.series && k.series[name];
    if (!s) throw new Error(`Unknown token ${expr}`);
    const call = /^(\w+)(?:\((\d+)\))?$/.exec(op);
    if (!call) throw new Error(`Bad token ${expr}`);
    const v = s.values;
    let n;
    switch (call[1]) {
      case 'last': n = v[v.length - 1]; break;
      case 'first': n = v[0]; break;
      case 'max': n = Math.max(...v); break;
      case 'sum': n = v.reduce((a, b) => a + b, 0); break;
      case 'at': n = v[Number(call[2])]; break;
      default: throw new Error(`Unknown token op ${expr}`);
    }
    if (n === undefined) throw new Error(`Token out of range ${expr}`);
    return fmt(n, s.unit, { decimals: s.decimals });
  });
}

/* ---------- Ask ---------- */
export const getSource = name => S.sources[name] || null;
export const suggestedFor = viewId => S.ask.filter(e => (e.suggestedIn || []).includes(viewId));

const NO_SOURCE = {
  status: 'no_source', title: 'No answer',
  text: 'No source found for this question, so there is no answer.', sources: []
};

/* Keyword match for typed questions: words longer than 3 characters, at least 2 shared words.
   Kept in one function so it can be replaced by a real service. */
function matchTyped(text, entries) {
  const words = text.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  let best = null, score = 0;
  for (const e of entries) {
    const hay = e.q.toLowerCase();
    const ans = resolveText(e.answer).toLowerCase();
    const s = words.filter(w => hay.includes(w) || ans.includes(w)).length;
    if (s > score) { score = s; best = e; }
  }
  return best && score >= 2 ? best : null;
}

/* question: { id } for a suggested question, or { text } for a typed one. */
export function answer(question, role, viewId) {
  const entry = question.id
    ? S.ask.find(e => e.id === question.id)
    : matchTyped(question.text || '', suggestedFor(viewId));
  if (!entry) return NO_SOURCE;
  if (!canSee(role, entry.domain)) {
    return {
      status: 'denied', title: 'Not available in this view',
      text: entry.denyText || `This is not available for your role. Data owner: ${domainLabel(entry.domain)}.`,
      sources: ['Access rule: ' + domainLabel(entry.domain)]
    };
  }
  return { status: 'answered', title: 'Answer', text: resolveText(entry.answer), sources: entry.sources || [] };
}
