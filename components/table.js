import { escapeHtml as esc } from '../format.js';
import { badge } from './badge.js';

const STATUS_TONE = { Open: 'amber', 'In progress': 'blue', Complete: 'green' };
const STATUS_OPTIONS = ['Open', 'In progress', 'Complete'];

/* Column types: text (default), badge {text,tone}, link {text,view}, badge_text {badge,tone,text},
   status (read-only status badge) and status_select (editable status, saved by the page).
   A column with opens:"action" turns badge_text into a button that opens the decision dialog. */
function cell(col, v, row) {
  switch (col.type) {
    case 'badge': return badge(v);
    case 'link': return `<button class="link" data-go="${esc(v.view)}">${esc(v.text)}</button>`;
    case 'badge_text': {
      const text = col.opens === 'action'
        ? `<button type="button" class="rowbtn" data-action="${esc(row.id)}">${esc(v.text)}</button>`
        : esc(v.text);
      return badge({ tone: v.tone, text: v.badge }) + ' ' + text;
    }
    case 'status': return badge({ tone: STATUS_TONE[v] || 'blue', text: v });
    case 'status_select':
      return `<select class="stsel" data-status="${esc(row.id)}" aria-label="Status for ${esc(row.step || row.id)}">${STATUS_OPTIONS.map(s => `<option${s === v ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>`;
    default: return esc(v);
  }
}

/* footer: [{kind:"go", view, text} | {kind:"button", id, text}] */
function footerHtml(footer) {
  if (!footer || !footer.length) return '';
  const parts = footer.map(f => (f.kind === 'go'
    ? `<button class="link" data-go="${esc(f.view)}">${esc(f.text)}</button>`
    : `<button type="button" class="secondary" id="${esc(f.id)}">${esc(f.text)}</button>`));
  return `<p class="src tfoot">${parts.join(' ')}</p>`;
}

export function table({ columns, rows, footnote, footer }) {
  const cls = c => [c.align === 'right' ? 'r' : '', c.hideSmall ? 'hs' : ''].filter(Boolean).join(' ');
  const head = columns.map(c => `<th class="${cls(c)}">${esc(c.label)}</th>`).join('');
  const body = rows.map(r => `<tr>${columns.map(c => `<td class="${cls(c)}">${cell(c, r[c.from || c.key], r)}</td>`).join('')}</tr>`).join('');
  return `<div class="tw"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>` +
    (footnote ? `<p class="src" style="margin:12px 0 0">${esc(footnote)}</p>` : '') + footerHtml(footer);
}
