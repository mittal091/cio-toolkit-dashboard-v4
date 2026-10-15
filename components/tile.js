import { escapeHtml as esc } from '../format.js';
import { badge } from './badge.js';
import { spark } from './spark.js';

/* Status words shown on tiles and in the evidence dialog. */
export const STATUS = {
  good: { text: 'On track', tone: 'green' },
  warn: { text: 'Watch', tone: 'amber' },
  bad: { text: 'At risk', tone: 'red' },
  neutral: { text: 'Tracking', tone: 'blue' }
};
export const statusBadge = status => badge({ tone: (STATUS[status] || STATUS.neutral).tone, text: (STATUS[status] || STATUS.neutral).text });

export const deltaChip = delta =>
  delta ? `<span class="dl dl-${delta.tone === 'good' || delta.tone === 'bad' ? delta.tone : 'flat'}" title="Change since the previous week or month">${esc(delta.text)}</span>` : '';

/* ref is "KPI:metric" and opens the evidence dialog. foot is the target, or the owner when there is no target.
   The AI position of a KPI is explained in the evidence dialog, not on the tile. */
export function tile({ ref, label, valueText, sub, status, delta, foot, denied, trend }) {
  if (denied) {
    return `<div class="tile locked"><div class="l">${esc(label)}</div><div class="v">${esc(valueText)}</div><div class="s">${esc(sub)}</div></div>`;
  }
  return `<button type="button" class="tile" data-ev="${esc(ref)}" aria-label="View evidence for ${esc(label)}"><div class="l">${esc(label)}</div><div class="v"><span>${esc(valueText)}</span>${deltaChip(delta)}${spark(trend)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}<div class="tf"><span>${esc(foot)}</span>${statusBadge(status)}</div></button>`;
}

export const tiles = items => `<div class="tiles">${items.join('')}</div>`;