import { escapeHtml as esc } from '../format.js';

/* The answer in five seconds: a headline, one paragraph and one number. */
export function briefing({ eyebrow, headline, text, stat }) {
  const side = stat
    ? `<div class="summary"><strong>${esc(stat.value)}</strong><span>${esc(stat.label)}</span>${stat.note ? `<small>${esc(stat.note)}</small>` : ''}</div>`
    : '';
  return `<section class="briefing${stat ? '' : ' solo'}"><div><div class="eyebrow">${esc(eyebrow)}</div><h2>${esc(headline)}</h2><p>${esc(text)}</p></div>${side}</section>`;
}
