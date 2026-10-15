import * as D from './data-access.js';
import { renderView, hasTiles } from './render.js';
import { wireAsk } from './components/ask.js';
import { evidenceDialog, decisionDialog } from './components/dialog.js';
import { escapeHtml as esc } from './format.js';

const tabsEl = document.getElementById('tabs');
const viewEl = document.getElementById('view');
const roleEl = document.getElementById('role');
const metaEl = document.getElementById('meta');
const dialogEl = document.getElementById('detail');
const toastEl = document.getElementById('toast');
const ROLE_KEY = 'cio-toolkit-role';

let role = null;
let currentId = '';
let toastTimer = null;

const storedRole = () => { try { return localStorage.getItem(ROLE_KEY); } catch (e) { return null; } };
const storeRole = id => { try { localStorage.setItem(ROLE_KEY, id); } catch (e) { /* storage unavailable */ } };

function toast(message) {
  toastEl.textContent = message;
  toastEl.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.style.display = 'none'; }, 3000);
}

function openDialog(html) {
  document.getElementById('detail-body').innerHTML = html;
  if (typeof dialogEl.showModal === 'function') dialogEl.showModal();
  else dialogEl.setAttribute('open', '');
}
const closeDialog = () => (dialogEl.close ? dialogEl.close() : dialogEl.removeAttribute('open'));

function show(id) {
  const views = D.viewsFor(role);
  const v = views.find(x => x.id === id) || views[0];
  currentId = v.id;

  let lastGroup = null;
  tabsEl.innerHTML = views.map((x, i) => {
    const sep = i > 0 && (x.group || '') !== lastGroup ? '<span class="tabsep" aria-hidden="true"></span>' : '';
    lastGroup = x.group || '';
    /* WAI-ARIA tabs: the active tab is the only one in the Tab sequence, arrow keys move between tabs */
    return `${sep}<button class="tab${x.id === v.id ? ' on' : ''}" role="tab" id="tab-${esc(x.id)}" aria-selected="${x.id === v.id}" aria-controls="view" tabindex="${x.id === v.id ? 0 : -1}" data-id="${esc(x.id)}">${esc(x.name)}</button>`;
  }).join('');
  viewEl.setAttribute('aria-labelledby', `tab-${v.id}`);
  tabsEl.querySelectorAll('.tab').forEach(b => { b.onclick = () => openView(b.dataset.id); });

  /* one quiet line of context instead of a row of pills, with a jump to the Ask panel where there is one */
  const asOf = D.dataAsOf();
  metaEl.innerHTML =
    `<span><b>Access:</b> ${esc(v.accessText)} · last 12 weeks</span>` +
    (asOf ? `<span><b>Data as of:</b> ${esc(asOf)} · simulated</span>` : '') +
    (hasTiles(v) ? '<span>▲▼ change since the previous week or month</span>' : '') +
    (v.blocks.some(b => b.type === 'ask') ? '<button type="button" class="link askjump" data-askjump>Ask a question ↓</button>' : '');
  viewEl.innerHTML = renderView(v, role);

  wireAsk(viewEl, {
    ask: (viewId, question) => D.answer(question, role, viewId),
    getSource: D.getSource
  });
}

function openView(id, focusTab) {
  show(id);
  try { history.replaceState(null, '', '#' + currentId); } catch (e) { /* ignore */ }
  if (focusTab) { const t = document.getElementById('tab-' + currentId); if (t) t.focus(); }
}

tabsEl.addEventListener('keydown', e => {
  const tabs = [...tabsEl.querySelectorAll('.tab')];
  const i = tabs.indexOf(document.activeElement);
  if (i < 0) return;
  const next = { ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i - 1 + tabs.length) % tabs.length, Home: 0, End: tabs.length - 1 }[e.key];
  if (next === undefined) return;
  e.preventDefault();
  openView(tabs[next].dataset.id, true); // content is preloaded, so arrow keys activate as they move
});

document.addEventListener('click', e => {
  const t = e.target;
  if (t === dialogEl) return closeDialog(); // click on the backdrop
  const b = t.closest && t.closest('button');
  if (!b) return;

  if (b.dataset.go) { show(b.dataset.go); window.scrollTo(0, 0); return; }
  if (b.dataset.askjump !== undefined) {
    const input = viewEl.querySelector('[data-ask] input');
    if (input) {
      const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      input.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
      input.focus({ preventScroll: true });
    }
    return;
  }
  if (b.dataset.ev) {
    const [kpi, metric] = b.dataset.ev.split(':');
    const ev = D.getEvidence(kpi, metric, role);
    if (!ev.denied) openDialog(evidenceDialog(ev));
    return;
  }
  if (b.dataset.action) {
    const a = D.getAction(b.dataset.action, role);
    if (a && !a.denied) openDialog(decisionDialog(a));
    return;
  }
  if (b.id === 'close') return closeDialog();
  if (b.id === 'print-pack') return window.print();
  if (b.id === 'download-pack') {
    const pack = document.querySelector('.pack');
    if (!pack) return;
    const url = URL.createObjectURL(new Blob([pack.innerText], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CIO-Toolkit-Briefing-Draft.txt';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Draft downloaded');
    return;
  }
  if (b.id === 'reset-actions') {
    D.resetActionStatuses();
    show(currentId);
    toast('Demo statuses reset');
  }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset && t.dataset.status) {
    const saved = D.setActionStatus(t.dataset.status, t.value);
    toast(saved ? 'Status saved in this browser' : 'Updated for this session. Browser storage is unavailable');
  }
});

async function main() {
  try {
    await D.init();
  } catch (e) {
    viewEl.innerHTML = '<div class="note">The data files could not be loaded. Open this page from a web server, not directly from the file.</div>';
    return;
  }
  const saved = storedRole();
  role = saved && D.hasRole(saved) ? saved : D.defaultRole();
  roleEl.innerHTML = D.getRoles().map(r => `<option value="${esc(r.id)}"${r.id === role ? ' selected' : ''}>${esc(r.label)}</option>`).join('');
  roleEl.onchange = () => {
    role = roleEl.value;
    storeRole(role);
    show(currentId);
  };
  show((location.hash || '').slice(1));
}

main();
