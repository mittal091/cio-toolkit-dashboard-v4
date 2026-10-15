import { escapeHtml as esc } from '../format.js';

/* A printable draft. sections: [{heading, paragraphs[], list[{strong,text}]}] */
export function doc({ title, sub, note, sections }) {
  const body = sections.map(s =>
    `<h3>${esc(s.heading)}</h3>` +
    (s.paragraphs || []).map(p => `<p>${esc(p)}</p>`).join('') +
    (s.list && s.list.length ? `<ol>${s.list.map(i => `<li><b>${esc(i.strong)}</b> ${esc(i.text)}</li>`).join('')}</ol>` : '')
  ).join('');
  return `<div class="sh no-print"><span>Draft from sample data · Human approval required</span><div><button type="button" class="secondary" id="download-pack">Download draft</button> <button type="button" class="primary" id="print-pack">Print / save PDF</button></div></div>` +
    `<article class="panel pack"><div class="eyebrow">EXECUTIVE BRIEFING · SAMPLE DATA</div><h2>${esc(title)}</h2><p class="muted">${esc(sub)}</p><div class="note">${esc(note)}</div>${body}</article>`;
}
