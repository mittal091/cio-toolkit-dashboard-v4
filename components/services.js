import { escapeHtml as esc } from '../format.js';
import { badge } from './badge.js';

const STATUS = { green: 'On target', amber: 'Watch', red: 'At risk' };

/* services: [{ name, valueText, tone }]. Each service gets a text status, so colour is never the only signal. */
export function services(list) {
  return `<div class="svcs">${list.map(s =>
    `<div class="svc"><div class="n">${esc(s.name)}</div><div class="r"><span class="a">${esc(s.valueText)}</span>${badge({ tone: s.tone, text: STATUS[s.tone] || 'Tracking' })}</div></div>`
  ).join('')}</div>`;
}
