/* Browser test runner (no Node needed). Serve the project folder and open tests/browser.html. */
import * as D from '../data-access.js';
import { renderView, hasTiles } from '../render.js';
import { evidenceDialog, decisionDialog } from '../components/dialog.js';
import { escapeHtml } from '../format.js';

const lines = [];
let failed = 0;
const ok = (name, cond, detail = '') => {
  if (cond) lines.push('PASS  ' + name);
  else { failed++; lines.push('FAIL  ' + name + (detail ? '\n        ' + detail : '')); }
};
const text = html => new DOMParser().parseFromString(html, 'text/html');

try {
  const read = async p => (await fetch('../' + p)).json();
  await D.init(read);
  const views = await read('config/views.json');
  const roles = (await read('config/roles.json')).roles.map(r => r.id);
  const ROLE = 'cio';

  /* ---- every tile has what the new tile needs ---- */
  const tileRefs = [];
  const walk = (blocks, viewId) => blocks.forEach(b => {
    if (b.type === 'tiles') b.items.forEach(i => tileRefs.push({ ...i, view: viewId }));
    if (b.blocks) walk(b.blocks, viewId);
  });
  views.forEach(v => walk(v.blocks, v.id));
  ok('there are 24 tiles across the six role views', tileRefs.length === 24, String(tileRefs.length));
  const missing = [];
  for (const t of tileRefs) {
    const m = D.getMetric(t.kpi, t.metric, ROLE);
    const e = D.getEvidence(t.kpi, t.metric, ROLE);
    if (!m.hasPrior) missing.push(`${t.kpi}:${t.metric} has no prior value`);
    if (!e.owner) missing.push(`${t.kpi}:${t.metric} has no owner`);
    if (!e.source) missing.push(`${t.kpi}:${t.metric} has no source`);
    if (!e.note) missing.push(`${t.kpi}:${t.metric} has no note`);
  }
  ok('every tile metric has a prior value, owner, source and note', missing.length === 0, missing.join('; '));

  /* ---- deltas: direction colouring ---- */
  const d = (k, m) => D.getMetric(k, m, ROLE).delta;
  const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got));
  eq('K17 incidents ▲1 is bad (lower is better)', d('K17', 'incidentsW12'), { text: '▲ 1', tone: 'bad' });
  eq('K17 MTTR ▼0.3h is good', d('K17', 'mttrW12'), { text: '▼ 0.3h', tone: 'good' });
  eq('K06 variance ▲0.9 pp is bad', d('K06', 'budgetYtd'), { text: '▲ 0.9 pp', tone: 'bad' });
  eq('K20 patched ▼2 pp is bad (higher is better)', d('K20', 'patchedInSla'), { text: '▼ 2 pp', tone: 'bad' });
  eq('K11 deployments ▲5 is good', d('K11', 'deploysLastWeek'), { text: '▲ 5', tone: 'good' });
  eq('K20 criticals ▼1 is good', d('K20', 'criticalOpen'), { text: '▼ 1', tone: 'good' });
  eq('K05 IT spend ▲0.1 pp is bad', d('K05', 'itSpendPct'), { text: '▲ 0.1 pp', tone: 'bad' });
  eq('text metrics have no delta', d('K09', 'renewals'), null);

  /* ---- previous-period values behind the change arrows ---- */
  const p = (k, m) => D.getMetric(k, m, ROLE);
  ok('previous values: incidents 13, MTTR 3.4h, deployments 41, LLM $44k',
    p('K17', 'incidentsW12').priorText === '13' && p('K17', 'mttrW12').priorText === '3.4h' &&
    p('K11', 'deploysLastWeek').priorText === '41' && p('K35', 'llmSpendWeek').priorText === '$44k');
  ok('previous values: variance +1.4%, on time 80%, renewals text', p('K06', 'budgetYtd').priorText === '+1.4%' && p('K03', 'onTime').priorText === '80%' && p('K09', 'renewals').priorText === '21 · $16.9M');
  ok('tiles always show the current value', p('K17', 'incidentsW12').valueText === '14' && p('K17', 'incidentsW12').delta !== null);

  /* ---- rendering: every role x view ---- */
  let threw = 0;
  for (const r of roles) for (const v of views) {
    try { if (!renderView(v, r).length) threw++; } catch (e) { threw++; lines.push('   ' + r + '/' + v.id + ': ' + e.message); }
  }
  ok('every role x view renders without error', threw === 0, String(threw));
  ok('cio opens eight views, in two groups', D.viewsFor('cio').length === 8 && D.viewsFor('cio').filter(v => v.group === 'Act').length === 2);
  ok('other roles do not see the Act views', roles.filter(r => r !== 'cio').every(r => !D.viewsFor(r).some(v => v.group === 'Act')));

  /* ---- DOM structure of tiles ---- */
  for (const v of views.filter(x => hasTiles(x))) {
    const doc = text(renderView(D.getView(v.id), ROLE));
    const tiles = [...doc.querySelectorAll('.tiles .tile')];
    ok(`${v.id}: four tiles, all buttons that open evidence`, tiles.length === 4 && tiles.every(t => t.tagName === 'BUTTON' && t.dataset.ev && t.getAttribute('aria-label')));
    ok(`${v.id}: every tile shows a status pill and a footer`, tiles.every(t => t.querySelector('.tf .b') && t.querySelector('.tf span').textContent.trim().length > 0));
    ok(`${v.id}: has a briefing banner with a headline`, !!doc.querySelector('.briefing h2'));
  }
  ok('tiles carry no AI badge (the AI position is explained in the evidence dialog)', views.every(v => text(renderView(D.getView(v.id), ROLE)).querySelectorAll('.tile .ai').length === 0));
  ok('no duplicate ids in any view', views.every(v => { const ids = [...text(renderView(v, ROLE)).querySelectorAll('[id]')].map(e => e.id); return new Set(ids).size === ids.length; }));

  /* ---- evidence and decision dialogs ---- */
  const ev = D.getEvidence('K17', 'incidentsW12', ROLE);
  const html = evidenceDialog(ev);
  ok('evidence dialog shows value, status, source, owner and note', ['14', 'Watch', 'Incident ledger', 'Operations', 'release R-214'].every(s => html.includes(s)), html.slice(0, 200));
  ok('evidence is denied for a role without the domain', D.getEvidence('K20', 'criticalOpen', 'finance').denied === true);
  ok('evidence dialog escapes markup', !evidenceDialog({ ...ev, label: '<img src=x onerror=alert(1)>', note: '<b>x</b>' }).includes('<img'));
  ok('decision dialog escapes markup', !decisionDialog({ ...D.getAction('A1', ROLE), step: '<script>alert(1)</script>' }).includes('<script>'));

  /* ---- decisions: status is saved and reset ---- */
  D.resetActionStatuses();
  const status = id => D.getDataset('attention', ROLE).rows.find(r => r.id === id).status;
  ok('decision log starts with the data defaults', status('A1') === 'In progress' && status('A2') === 'Open');
  D.setActionStatus('A2', 'Complete');
  ok('changing a status is reflected', status('A2') === 'Complete');
  const log = text(renderView(D.getView('actions'), ROLE));
  ok('decision log shows an editable status and a reset button', log.querySelectorAll('select.stsel').length === 5 && !!log.querySelector('#reset-actions') && log.querySelector('select[data-status="A2"]').value === 'Complete');
  const cockpit = text(renderView(D.getView('cockpit'), ROLE));
  ok('cockpit shows the same status as a read-only badge', cockpit.body.textContent.includes('Complete') && cockpit.querySelectorAll('select.stsel').length === 0);
  D.resetActionStatuses();
  ok('reset restores the defaults', status('A2') === 'Open');
  let threwBad = false; try { D.setActionStatus('A2', 'Hacked'); } catch (e) { threwBad = true; }
  let threwId = false; try { D.setActionStatus('ZZ', 'Open'); } catch (e) { threwId = true; }
  ok('invalid status or id is rejected', threwBad && threwId);
  ok('decision log is closed to other roles', D.getDataset('attention', 'finance').denied === true && D.getAction('A1', 'security').denied === true);

  /* ---- board pack ---- */
  const pack = text(renderView(D.getView('pack'), ROLE));
  const body = pack.querySelector('.pack').textContent;
  ok('board pack carries the draft label, buttons and the key numbers',
    !!pack.querySelector('#print-pack') && !!pack.querySelector('#download-pack') && /Human approval required/.test(pack.body.textContent) &&
    ['4.6h', '3.1h', '38%', '$73k', '7%', '99.88%', '2 of 4', '17 critical', '88%'].every(s => body.includes(s)), body.slice(0, 300));
  ok('board pack lists three decisions from the log', pack.querySelectorAll('.pack ol li').length === 3 && body.includes('Confirm patch window this week'));
  ok('no unresolved tokens anywhere in a rendered page', views.every(v => !renderView(v, ROLE).includes('{{')));

  /* ---- access ---- */
  const secForFinance = renderView(D.getView('sec'), 'finance');
  ok('finance sees locked tiles and denied blocks on the security view', secForFinance.includes('tile locked') && secForFinance.includes('Not available for your role'));
  ok('locked tiles are not buttons', text(secForFinance).querySelectorAll('button.tile').length === 0);

  /* ---- research-driven refinements ---- */
  const withSpark = views.flatMap(v => [...text(renderView(D.getView(v.id), ROLE)).querySelectorAll('.tiles .tile')].filter(t => t.querySelector('svg.spark')).map(t => t.dataset.ev)).sort();
  ok('sparklines appear on the tiles that have a series (7 KPIs, 8 tiles)', JSON.stringify(withSpark) === JSON.stringify(['K03:onTime', 'K07:spend12w', 'K11:deploysLastWeek', 'K17:incidentsW12', 'K17:incidentsW12', 'K17:mttrW12', 'K20:criticalOpen', 'K35:llmSpendWeek'].sort()), withSpark.join());
  ok('sparklines are decorative (hidden from screen readers)', [...text(renderView(D.getView('ops'), ROLE)).querySelectorAll('svg.spark')].every(s => s.getAttribute('aria-hidden') === 'true'));

  const cockpitDoc = text(renderView(D.getView('cockpit'), ROLE));
  const svc = [...cockpitDoc.querySelectorAll('.svcs .svc')];
  ok('cockpit shows four critical services, each with a text status', svc.length === 4 && svc.every(s => /On target|Watch|At risk/.test(s.textContent)) && svc[0].textContent.includes('99.88%') && svc[0].textContent.includes('At risk'));
  const ops = text(renderView(D.getView('ops'), ROLE));
  ok('availability bars say meets or below target in text for screen readers', [...ops.querySelectorAll('.hb .sr')].map(e => e.textContent.trim()).join('|') === ', below target|, below target|, meets target|, meets target');
  ok('highlighted incident bar and latest bar carry their numbers', [...ops.querySelectorAll('.chart svg text')].some(t => t.textContent === '19') && [...ops.querySelectorAll('.chart svg text')].some(t => t.textContent === '14'));
  const fin = text(renderView(D.getView('fin'), ROLE));
  ok('line chart labels the peak and latest points', ['$265k', '$205k'].every(v => [...fin.querySelectorAll('.chart svg text')].some(t => t.textContent === v)));
  ok('data as-of date is available', D.dataAsOf() === '12 Oct 2026');
  const evq = D.getEvidence('K20', 'criticalOpen', ROLE);
  ok('evidence lists who can see the KPI (access rule) and a formatted as-of date', evq.visibleTo.join('|') === 'CIO office|CISO, Risk and Compliance' && evq.asOf === '12 Oct 2026', JSON.stringify(evq.visibleTo));
  ok('evidence dialog shows the access rule', evidenceDialog(evq).includes('Visible to'));
  /* one KPI per AI level: High (K17), Medium (K06), Low (K16), None (K05) */
  const aiCases = [['K17', 'incidentsW12', 'AI does real work here'], ['K06', 'budgetYtd', 'a person checks the result'], ['K16', 'servicesMeetingSla', 'only a small part'], ['K05', 'itSpendPct', 'no AI involved']];
  ok('evidence dialog explains the AI position in plain words (High, Medium, Low, None)', aiCases.every(([k, m, s]) => evidenceDialog(D.getEvidence(k, m, ROLE)).includes(s)));

  /* ---- WCAG contrast of the colour tokens in styles.css (1.4.3 text 4.5:1, 1.4.11 controls 3:1) ---- */
  const cs = getComputedStyle(document.documentElement);
  const tok = n => cs.getPropertyValue('--' + n).trim();
  const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const low = [];
  for (const n of ['ink', 'muted', 'dim', 'cyan', 'amber', 'green', 'red', 'blue', 'purple-text']) for (const bg of ['panel', 'panel2']) {
    if (!tok(n) || !tok(bg)) { low.push(`token missing: ${n}/${bg}`); continue; }
    const r = ratio(tok(n), tok(bg));
    if (r < 4.5) low.push(`${n} on ${bg} is ${r.toFixed(2)}:1`);
  }
  ok('text colours meet 4.5:1 on panel backgrounds', low.length === 0, low.join('; '));
  ok('control borders meet 3:1 against the panel background', ratio(tok('ctrl'), tok('panel2')) >= 3 && ratio(tok('ctrl'), tok('panel')) >= 3, `${ratio(tok('ctrl'), tok('panel')).toFixed(2)}`);
  ok('chart series colours meet 3:1 (blue, cyan, purple on the panel)', ['blue', 'cyan', 'purple'].every(n => ratio(tok(n), tok('panel')) >= 3));

  /* ---- v4: simpler, decision-first ---- */
  const allSubs = views.flatMap(v => [...text(renderView(D.getView(v.id), ROLE)).querySelectorAll('.tile .s')].map(e => e.textContent));
  ok('tile sub-lines carry no catalogue IDs (K05, K17 ...)', allSubs.every(s => !/\bK\d{2}\b/.test(s)), allSubs.filter(s => /\bK\d{2}\b/.test(s)).join('|'));
  ok('the evidence dialog still shows the KPI ID for analysts', evidenceDialog(D.getEvidence('K05', 'itSpendPct', ROLE)).includes('K05'));
  D.resetActionStatuses();
  const stat = () => text(renderView(D.getView('cockpit'), ROLE)).querySelector('.briefing .summary');
  ok('cockpit banner number is the count of open decisions, not a repeat of a tile', stat().querySelector('strong').textContent === '5' && stat().textContent.includes('2 critical, 3 due soon'), stat().textContent);
  D.setActionStatus('A1', 'Complete');
  ok('completing a decision updates the banner count', stat().querySelector('strong').textContent === '4' && stat().textContent.includes('1 critical, 3 due soon'), stat().textContent);
  D.resetActionStatuses();
  ok('role-view banners are one narrative with no number that repeats a tile', ['fin', 'ops', 'del', 'sec', 'ai'].every(id => { const b = text(renderView(D.getView(id), ROLE)).querySelector('.briefing'); return b && b.classList.contains('solo') && !b.querySelector('.summary'); }));
  const order = [...text(renderView(D.getView('cockpit'), ROLE)).body.children].map(e => e.className.split(' ')[0] + ':' + ((e.querySelector('h3') || {}).textContent || '')).join(' | ');
  ok('cockpit order: banner, tiles, decisions, critical services, one event, Ask', /briefing.*tiles.*Needs your attention.*Critical services.*One event.*Ask the dashboard/.test(order), order);
  let badTok = false; try { D.resolveText('{{ds:nope:open}}'); } catch (e) { badTok = true; }
  ok('unknown dataset tokens are rejected', badTok);
  /* ---- no em dash / token leaks in UI text ---- */
  const dash = String.fromCharCode(0x2014);
  ok('no em dash in any rendered view', views.every(v => !renderView(v, ROLE).includes(dash)));
  ok('escapeHtml neutralises markup', !escapeHtml('<img src=x onerror=alert(1)>').includes('<'));
} catch (e) {
  failed++;
  lines.push('FAIL  runner error: ' + e.message + '\n' + e.stack);
}
lines.push(failed ? `\n${failed} FAILED` : '\nALL PASSED');
document.getElementById('out').textContent = lines.join('\n');
document.title = failed ? 'FAILED' : 'PASSED';
