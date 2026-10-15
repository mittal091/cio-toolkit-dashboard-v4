import { escapeHtml as esc } from '../format.js';
import { badge } from './badge.js';
import { statusBadge, deltaChip } from './tile.js';

const row = (k, v) => (v ? `<b>${esc(k)}:</b> ${esc(v)}<br>` : '');

/* The AI position of a KPI in plain words. It comes from the KPI catalogue (the "AI value" column). */
const AI_TEXT = {
  High: 'High. AI does real work here, such as detecting, ranking or summarising. A person still decides.',
  Medium: 'Medium. AI helps, and a person checks the result.',
  Low: 'Low. AI plays only a small part.',
  None: 'None. A direct measurement, with no AI involved.'
};

/* e: result of getEvidence() */
export function evidenceDialog(e) {
  const head = [e.valueText, e.targetText].filter(Boolean).join(' · ');
  const delta = e.delta
    ? `<p class="muted">${deltaChip(e.delta)} since the previous week or month${e.priorText ? ` (was ${esc(e.priorText)})` : ''}.</p>`
    : '';
  return `<div class="eyebrow">KPI EVIDENCE · SIMULATED</div><h2 id="detail-title">${esc(e.label)}</h2>` +
    `<div>${statusBadge(e.status)}</div>` +
    `<h3>${esc(head)}</h3>${delta}` +
    (e.note ? `<p>${esc(e.note)}</p>` : '') +
    `<h3>Source and accountability</h3><div class="source">` +
    row('KPI', e.kpi) + row('Simulated record', e.source) + row('Owner', e.owner) +
    row('Refresh', e.refresh) + row('Definition', e.definition) +
    row('AI value', AI_TEXT[e.aiValue]) + row('AI role', e.aiRole) + row('How AI helps', e.aiHelp) + row('Data as of', e.asOf) +
    row('Visible to', e.visibleTo && e.visibleTo.join(', ')) +
    `</div><p class="muted">No live source is connected. A production version should show how fresh and complete the source data is.</p>`;
}

/* a: one row of the attention dataset */
export function decisionDialog(a) {
  return `<div class="eyebrow">EXECUTIVE DECISION</div><h2 id="detail-title">${esc(a.step)}</h2>` +
    `<div>${badge({ tone: a.item.tone, text: a.item.badge })}</div>` +
    `<p>${esc(a.item.text)}</p>` +
    `<div class="source">${row('Owner', a.owner)}${row('Due', a.due)}${row('Intended outcome', a.outcome)}${row('Status', a.status)}</div>` +
    `<div class="note info">Check the supporting source records with the accountable owner. Record the approval and track the outcome in the decision log.</div>` +
    `<p class="muted">Sample decision. No notification or external action is sent.</p>`;
}
