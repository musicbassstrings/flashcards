'use strict';
/* Family Flashcards — core: cards, accounts, progress, sync, home and browse screens.
   Study modes live in modes.js. */

const CFG = Object.assign({
  appName: 'Family Flashcards',
  scriptUrl: '',
  categories: ['Scripture Memory', 'Apologetics', 'History', 'Westminster Shorter Catechism', 'Miscellaneous'],
}, window.APP_CONFIG || {});
const DEMO = !String(CFG.scriptUrl || '').trim();
const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const CAT_COLORS = ['#6D5BD0', '#D9822B', '#2F8F6B', '#2B6CB0', '#9A6B4F', '#C2417A', '#3E8E9E', '#7A8B2E'];
const MODES = {};

/* ---------------- small helpers ---------------- */
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { } },
};

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const s in v) { if (s.startsWith('--')) el.style.setProperty(s, v[s]); else el.style[s] = v[s]; }
    } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v; // only ever used with our own static markup
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}
const clean = arr => [].concat(arr).flat(Infinity).filter(x => x != null && x !== false);

function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
function hashId(s) { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193); } return (x >>> 0).toString(36); }
function todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function plural(n, w) { return n + ' ' + w + (n === 1 ? '' : 's'); }
function fmtInterval(ms) {
  if (ms < HOUR) return Math.max(1, Math.round(ms / MIN)) + ' min';
  if (ms < DAY) return Math.round(ms / HOUR) + ' hr';
  const d = Math.round(ms / DAY);
  if (d < 31) return plural(d, 'day');
  if (d < 365) return Math.round(d / 30) + ' mo';
  return (d / 365).toFixed(1) + ' yr';
}
function timeAgo(t) {
  if (!t) return 'never';
  const ms = Date.now() - t;
  if (ms < MIN) return 'just now';
  if (ms < HOUR) return Math.round(ms / MIN) + ' min ago';
  if (ms < DAY) return Math.round(ms / HOUR) + ' hr ago';
  return new Date(t).toLocaleDateString();
}

const ICONS = {
  close: 'M6 6l12 12M18 6L6 18',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
  speaker: 'M4 9v6h4l5 4V5L8 9H4z M16 9.5a3.5 3.5 0 010 5 M18.5 7a7 7 0 010 10',
  undo: 'M9 14L4 9l5-5 M4 9h10a6 6 0 010 12h-3',
  shuffle: 'M3 6h4l10 12h4 M3 18h4l3-3.6 M14 9.6L17 6h4 M18 3l3 3-3 3 M18 15l3 3-3 3',
  refresh: 'M20 11a8 8 0 10-2.3 5.7 M20 4v7h-7',
  check: 'M5 12.5l4.5 4.5L19 7',
  x: 'M7 7l10 10M17 7L7 17',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14z M20 20l-4.2-4.2',
  cards: 'M4 8h12v12H4z M8 4h12v12',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z M12 9a3 3 0 100 6 3 3 0 000-6z',
  target: 'M12 3a9 9 0 100 18 9 9 0 000-18z M12 8a4 4 0 100 8 4 4 0 000-8z M12 12h.01',
  pencil: 'M4 20h4L19 9l-4-4L4 16v4z M13 7l4 4',
  clipboard: 'M9 3h6v3H9z M7 4.5H5V21h14V4.5h-2 M8.5 13l2 2 4-4',
  grid: 'M4 4h7v7H4z M13 4h7v7h-7z M4 13h7v7H4z M13 13h7v7h-7z',
  drop: 'M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z',
  book: 'M4 5a2 2 0 012-2h13v15H6a2 2 0 00-2 2V5z M4 20a2 2 0 012-2h13v3H6',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8z M4 21a8 8 0 0116 0',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  bulb: 'M9 18h6 M10 21h4 M12 3a6 6 0 00-4 10.5c.8.8 1 1.6 1 2.5h6c0-.9.2-1.7 1-2.5A6 6 0 0012 3z',
};
function icon(name) {
  const filled = name === 'starFill';
  const d = ICONS[filled ? 'star' : name] || '';
  return h('span', { class: 'ico', 'aria-hidden': 'true', html:
    `<svg viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>` });
}

function toast(msg, ms) {
  let t = document.getElementById('toast');
  if (!t) { t = h('div', { id: 'toast', role: 'status' }); document.body.append(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms || 2400);
}

function speak(text) {
  if (!('speechSynthesis' in window)) return toast('Read-aloud is not available on this device');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95; u.lang = 'en-US';
  speechSynthesis.speak(u);
}
function stopSpeaking() { try { speechSynthesis.cancel(); } catch (e) { } }

function btn(label, onclick, cls) { return h('button', { class: 'btn ' + (cls || 'primary'), type: 'button', onclick }, label); }

function sheet(title, build) {
  const close = () => wrap.remove();
  const wrap = h('div', { class: 'modal', onclick: e => { if (e.target === wrap) close(); } },
    h('div', { class: 'sheet', role: 'dialog', 'aria-label': title },
      h('div', { class: 'sheet-head' }, h('h3', null, title),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: close }, icon('close'))),
      build(close)));
  document.body.append(wrap);
  return close;
}

function toggleRow(label, checked, onchange, sub) {
  const input = h('input', { type: 'checkbox', checked: !!checked, onchange: e => onchange(e.target.checked) });
  return h('label', { class: 'switch-row' },
    h('span', { class: 'switch-text' }, label, sub ? h('small', null, sub) : null),
    h('span', { class: 'switch' }, input, h('span', { class: 'slider' })));
}

/* ---------------- screens ---------------- */
let cleanupFn = null, currentView = '';
function render(node, keepScroll) {
  if (cleanupFn) { const f = cleanupFn; cleanupFn = null; try { f(); } catch (e) { } }
  stopSpeaking();
  document.getElementById('app').replaceChildren(node);
  if (!keepScroll) window.scrollTo(0, 0);
}
function onCleanup(fn) { const prev = cleanupFn; cleanupFn = () => { if (prev) prev(); fn(); }; }

// A study screen: header with close button + title + counter, progress bar, body.
function screen(opts) {
  currentView = opts.view || 'mode';
  const body = h('main', { class: 'body ' + (opts.cls || '') });
  const fill = h('div', { class: 'prog-fill' });
  const counter = h('span', { class: 'counter' });
  const root = h('div', { class: 'screen' },
    h('header', { class: 'bar' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: opts.back || (() => goHome()) }, icon(opts.backIcon || 'close')),
      h('div', { class: 'bar-title' }, h('span', null, opts.title), counter),
      opts.right || h('span', { class: 'icon-spacer' })),
    h('div', { class: 'prog' + (opts.noProgress ? ' hidden' : '') }, fill),
    body);
  render(root);
  return {
    root, body,
    set(content) { body.replaceChildren(...clean(content)); },
    progress(done, total) { fill.style.width = (total ? Math.min(100, Math.round(done / total * 100)) : 0) + '%'; },
    count(text) { counter.textContent = text || ''; },
  };
}

/* ---------------- cards ---------------- */
const Cards = { list: [], byId: {}, updated: 0 };

function matchCategory(c) {
  c = String(c || '').trim();
  if (!c) return 'Miscellaneous';
  const f = CFG.categories.find(x => x.toLowerCase() === c.toLowerCase());
  return f || c;
}
function setCards(raw) {
  const seen = {}, list = [];
  for (const r of raw || []) {
    const q = String(r.q || '').trim(), a = String(r.a || '').trim();
    if (!q || !a) continue;
    const cat = matchCategory(r.c);
    let id = hashId(cat.toLowerCase() + '|' + q.toLowerCase());
    if (seen[id]) { seen[id]++; id += '-' + seen[id]; } else seen[id] = 1;
    list.push({ id, cat, q, a });
  }
  Cards.list = list;
  Cards.byId = {};
  list.forEach(c => { Cards.byId[c.id] = c; });
}
function allCategories() {
  const extra = [...new Set(Cards.list.map(c => c.cat))].filter(c => !CFG.categories.includes(c));
  return CFG.categories.concat(extra);
}
function catColor(c) { const i = allCategories().indexOf(c); return CAT_COLORS[(i < 0 ? 0 : i) % CAT_COLORS.length]; }

function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function csvToCards(text) {
  const rows = parseCSV(text).filter(r => r.some(c => c.trim()));
  if (!rows.length) return [];
  const head = rows[0].map(x => x.trim().toLowerCase());
  let ci = head.indexOf('category'), qi = head.indexOf('question'), ai = head.indexOf('answer'), start = 1;
  if (ci < 0 || qi < 0 || ai < 0) { ci = 0; qi = 1; ai = 2; start = 0; }
  return rows.slice(start).map(r => ({ c: r[ci] || '', q: r[qi] || '', a: r[ai] || '' }));
}

async function loadCards() {
  const cached = LS.get('ff.cards');
  let raw;
  try {
    if (DEMO) {
      const r = await fetchT('sample-cards.csv', { cache: 'no-store' });
      raw = csvToCards(await r.text());
    } else {
      const res = await apiGet({ action: 'cards' });
      if (!res.ok) throw new Error(res.error || 'Could not read the Google Sheet');
      raw = res.cards;
    }
  } catch (e) {
    if (!Cards.list.length) throw e;
    return false;
  }
  const changed = !cached || JSON.stringify(raw) !== JSON.stringify(cached.cards);
  setCards(raw);
  Cards.updated = Date.now();
  LS.set('ff.cards', { cards: raw, at: Cards.updated });
  return changed;
}
async function ensureCards() {
  if (!Cards.list.length) {
    const c = LS.get('ff.cards');
    if (c && c.cards) { setCards(c.cards); Cards.updated = c.at; }
  }
  if (!Cards.list.length) await loadCards();
  else loadCards().then(changed => { if (changed && currentView === 'home') goHome(true); }).catch(() => { });
}

/* ---------------- server ---------------- */
function fetchT(url, opts, ms) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms || 25000);
  return fetch(url, Object.assign({ signal: ctl.signal }, opts)).finally(() => clearTimeout(t));
}
async function apiGet(params) {
  const base = CFG.scriptUrl.trim();
  const url = base + (base.includes('?') ? '&' : '?') + new URLSearchParams(Object.assign({ t: Date.now() }, params));
  const r = await fetchT(url, {});
  return r.json();
}
async function apiPost(body, keepalive) {
  const r = await fetchT(CFG.scriptUrl.trim(), {
    method: 'POST', redirect: 'follow', keepalive: !!keepalive,
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  return r.json();
}

/* ---------------- accounts ---------------- */
let Session = { name: '', key: '', pin: '' };

function demoUsers() { return LS.get('ff.demoUsers', {}); }
function demoAuth(name, pin, create) {
  const users = demoUsers(), key = name.toLowerCase();
  if (create) {
    if (users[key]) throw new Error('That name is already taken. Sign in instead.');
    users[key] = { name, pin, progress: emptyProgress() };
    LS.set('ff.demoUsers', users);
  } else if (!users[key] || users[key].pin !== pin) throw new Error('Name or PIN is not right.');
  return { ok: true, name: users[key].name, progress: users[key].progress };
}

async function signIn(name, pin, create) {
  let res;
  if (DEMO) res = demoAuth(name, pin, create);
  else {
    res = await apiPost({ action: create ? 'signup' : 'login', username: name, pin });
    if (!res.ok) throw new Error(res.error || 'Could not sign in');
  }
  Session = { name: res.name, key: res.name.toLowerCase(), pin };
  LS.set('ff.session', { name: res.name, pin });
  const local = LS.get('ff.progress.' + Session.key);
  P = mergeProgress(local || emptyProgress(), res.progress);
  LS.set('ff.progress.' + Session.key, P);
  rememberName(res.name);
  loadPrefs();
  await ensureCards();
  goHome();
  if (local) saveProgress();
}

async function signOut(msg) {
  clearTimeout(syncTimer);
  if (dirty) { try { await syncNow(); } catch (e) { } }
  LS.del('ff.session');
  Session = { name: '', key: '', pin: '' };
  P = emptyProgress();
  showLogin(msg);
}

function rememberName(n) {
  const k = LS.get('ff.known', []).filter(x => x.toLowerCase() !== n.toLowerCase());
  k.unshift(n); LS.set('ff.known', k.slice(0, 10));
}

function showLogin(msg) {
  currentView = 'login';
  let mode = 'signin';
  const name = h('input', { class: 'input', type: 'text', placeholder: 'Your name', autocomplete: 'username', autocapitalize: 'words', maxlength: '30' });
  const pin = h('input', { class: 'input', type: 'password', inputmode: 'numeric', pattern: '[0-9]*', placeholder: 'PIN (4 to 8 digits)', autocomplete: 'current-password', maxlength: '8' });
  const err = h('p', { class: 'error', role: 'alert' }, msg || '');
  const title = h('h2');
  const submit = h('button', { class: 'btn primary big', type: 'submit' });
  const switcher = h('button', { class: 'link', type: 'button', onclick: () => { mode = mode === 'signin' ? 'signup' : 'signin'; err.textContent = ''; update(); } });
  function update() {
    title.textContent = mode === 'signin' ? 'Sign in' : 'Create an account';
    submit.textContent = mode === 'signin' ? 'Sign in' : 'Create account';
    switcher.textContent = mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in';
    pin.setAttribute('autocomplete', mode === 'signin' ? 'current-password' : 'new-password');
  }
  const chipLabel = h('p', { class: 'label hidden' }, 'Tap your name');
  const chips = h('div', { class: 'chips' });
  const fillChips = names => {
    chipLabel.classList.toggle('hidden', !names.length);
    chips.replaceChildren(...names.map(n => h('button', { type: 'button', class: 'chip', onclick: () => {
      name.value = n; mode = 'signin'; update(); pin.focus();
    } }, n)));
  };
  const known = LS.get('ff.known', []);
  fillChips(known);

  const form = h('form', { class: 'login-form', onsubmit: async e => {
    e.preventDefault(); err.textContent = '';
    const n = name.value.trim().replace(/\s+/g, ' '), p = pin.value.trim();
    if (!n) { err.textContent = 'Please enter your name.'; return; }
    if (!/^\d{4,8}$/.test(p)) { err.textContent = 'Your PIN should be 4 to 8 digits.'; return; }
    submit.disabled = true; submit.textContent = 'Please wait…';
    try { await signIn(n, p, mode === 'signup'); }
    catch (ex) {
      err.textContent = ex.name === 'AbortError' || ex instanceof TypeError
        ? 'Could not reach the server. Check your internet connection.' : (ex.message || String(ex));
      submit.disabled = false; update();
    }
  } }, title, name, pin, err, submit, switcher);

  render(h('div', { class: 'screen login' },
    h('div', { class: 'login-hero' },
      h('div', { class: 'logo' }, icon('cards')),
      h('h1', null, CFG.appName),
      h('p', { class: 'muted' }, 'Learn it together. Remember it for life.')),
    DEMO ? h('div', { class: 'notice' }, 'Preview mode: this copy is not connected to your Google Sheet yet, so it shows sample cards and saves accounts on this device only.') : null,
    h('div', { class: 'card-box' }, chipLabel, chips, form)));
  update();

  if (!DEMO) apiGet({ action: 'users' }).then(r => {
    if (r && r.ok && Array.isArray(r.users)) {
      const all = known.slice();
      r.users.forEach(u => { if (!all.some(x => x.toLowerCase() === u.toLowerCase())) all.push(u); });
      if (currentView === 'login') fillChips(all);
    }
  }).catch(() => { });
}

/* ---------------- progress & spaced repetition ----------------
   Each card's state:  e = ease, i = interval (days), d = next due time,
   r = correct reviews in a row, l = lapses, k = times right, w = times wrong,
   s = starred, t = last changed (used to merge devices). */
let P = emptyProgress();
const RATE_NAMES = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };

function emptyProgress() { return { v: 1, cards: {}, best: {}, days: [] }; }
function normalizeProgress(p) {
  p = p && typeof p === 'object' ? p : {};
  return { v: 1, cards: p.cards && typeof p.cards === 'object' ? p.cards : {}, best: p.best && typeof p.best === 'object' ? p.best : {}, days: Array.isArray(p.days) ? p.days : [] };
}
function mergeProgress(a, b) {
  a = normalizeProgress(a); b = normalizeProgress(b);
  const out = { v: 1, cards: Object.assign({}, a.cards), best: Object.assign({}, a.best),
    days: [...new Set(a.days.concat(b.days))].sort().slice(-400) };
  for (const id in b.cards) { const s = b.cards[id], o = out.cards[id]; if (!o || (s.t || 0) >= (o.t || 0)) out.cards[id] = s; }
  for (const k in b.best) {
    const v = b.best[k], o = out.best[k];
    out.best[k] = o == null ? v : (k.startsWith('max:') ? Math.max(o, v) : Math.min(o, v));
  }
  return out;
}

function nextState(prev, rating, now) {
  const s = Object.assign({ e: 2.5, i: 0, r: 0, l: 0, k: 0, w: 0 }, prev || {});
  if (rating === 1) {
    s.l++; s.w++; s.r = 0; s.i = 0; s.e = Math.max(1.3, s.e - 0.2); s.d = now + 10 * MIN;
  } else {
    let i;
    if (s.r === 0) i = rating === 2 ? 0.5 : rating === 3 ? 1 : 3;
    else if (s.r === 1) i = rating === 2 ? Math.max(1, s.i * 1.2) : rating === 3 ? Math.max(3, s.i * 2.5) : Math.max(6, s.i * 3.5);
    else i = rating === 2 ? s.i * 1.2 : rating === 3 ? s.i * s.e : s.i * s.e * 1.3;
    if (rating === 2) s.e = Math.max(1.3, s.e - 0.15);
    if (rating === 4) s.e = Math.min(3.5, s.e + 0.15);
    s.i = Math.round(Math.min(i, 365) * 100) / 100;
    s.r++; s.k++; s.d = now + s.i * DAY;
  }
  s.e = Math.round(s.e * 100) / 100;
  s.t = now;
  return s;
}
function rate(id, rating) { P.cards[id] = nextState(P.cards[id], rating, Date.now()); touchDay(); saveProgress(); }

// Results from games and quizzes: a miss always brings the card back soon;
// a correct answer only moves the schedule forward if the card was due.
function recordResult(id, ok) {
  const now = Date.now(), s = P.cards[id];
  if (!ok) P.cards[id] = nextState(s, 1, now);
  else if (!s || !s.d || s.d <= now) P.cards[id] = nextState(s, 3, now);
  else P.cards[id] = Object.assign({}, s, { k: (s.k || 0) + 1, t: now });
  touchDay(); saveProgress();
}
function restoreState(id, prev) {
  P.cards[id] = prev ? Object.assign({}, prev, { t: Date.now() }) : { t: Date.now() };
  saveProgress();
}
function toggleStar(id) {
  const s = Object.assign({}, P.cards[id] || {});
  s.s = !s.s; s.t = Date.now();
  P.cards[id] = s; saveProgress();
}
function isStarred(id) { return !!(P.cards[id] && P.cards[id].s); }
function touchDay() { const d = todayStr(); if (!P.days.includes(d)) { P.days.push(d); P.days = P.days.slice(-400); } }
function streak() {
  const set = new Set(P.days); let n = 0; const d = new Date();
  if (!set.has(todayStr(d))) d.setDate(d.getDate() - 1);
  while (set.has(todayStr(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function mastery(id) {
  const s = P.cards[id];
  if (!s || !s.d) return 'new';
  return s.i >= 7 ? 'mastered' : 'learning';
}
function isDue(id) { const s = P.cards[id]; return !!(s && s.d && s.d <= Date.now()); }
function difficulty(id) {
  const s = P.cards[id];
  if (!s) return 0.5;
  const w = s.w || 0, k = s.k || 0;
  return (w + 1) / (w + k + 2) + (2.5 - (s.e || 2.5)) * 0.5;
}
// Order cards so due and difficult ones come first, then new ones, then the rest.
function prioritize(cards) {
  const now = Date.now();
  return cards.map(c => {
    const s = P.cards[c.id];
    let score = Math.random() * 0.3;
    if (!s || !s.d) score += 1;
    else if (s.d <= now) score += 1.5 + difficulty(c.id);
    else score += difficulty(c.id) * 0.8;
    return { c, score };
  }).sort((a, b) => b.score - a.score).map(x => x.c);
}

/* ---------------- sync ---------------- */
let syncTimer = null, syncing = false, dirty = false, syncState = 'saved', lastPull = 0;

function saveProgress() {
  if (!Session.key) return;
  LS.set('ff.progress.' + Session.key, P);
  dirty = true; setSyncStatus('pending');
  clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 3000);
}
async function syncNow(keepalive) {
  if (!Session.key) return;
  if (syncing) { clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 2000); return; }
  syncing = true; dirty = false; setSyncStatus('saving');
  try {
    let server;
    if (DEMO) {
      const users = demoUsers(), u = users[Session.key];
      if (u) { u.progress = mergeProgress(u.progress, P); LS.set('ff.demoUsers', users); server = u.progress; }
      else server = P;
    } else {
      const res = await apiPost({ action: 'save', username: Session.name, pin: Session.pin, progress: P }, keepalive);
      if (!res.ok) { if (res.auth) { syncing = false; return signOut('Please sign in again.'); } throw new Error(res.error); }
      server = res.progress;
    }
    P = mergeProgress(P, server);
    LS.set('ff.progress.' + Session.key, P);
    setSyncStatus(dirty ? 'pending' : 'saved');
  } catch (e) {
    dirty = true; setSyncStatus('offline');
    clearTimeout(syncTimer); syncTimer = setTimeout(syncNow, 30000);
  } finally { syncing = false; }
}
async function pullProgress() {
  if (!Session.key || DEMO) return;
  lastPull = Date.now();
  try {
    const r = await apiPost({ action: 'load', username: Session.name, pin: Session.pin });
    if (!r.ok) { if (r.auth) signOut('Please sign in again.'); return; }
    const before = JSON.stringify(P.cards);
    P = mergeProgress(P, r.progress);
    LS.set('ff.progress.' + Session.key, P);
    if (JSON.stringify(P.cards) !== before && currentView === 'home') goHome(true);
  } catch (e) { /* offline: keep local copy */ }
}
function setSyncStatus(st) { syncState = st; const el = document.getElementById('sync'); if (el) paintSync(el); }
function paintSync(el) {
  const map = { saved: ['Saved', 'ok'], pending: ['Saving…', 'wait'], saving: ['Saving…', 'wait'], offline: ['Offline', 'bad'] };
  const [label, cls] = map[syncState] || map.saved;
  el.className = 'sync ' + cls;
  el.textContent = DEMO && syncState === 'saved' ? 'This device' : label;
}

/* ---------------- preferences ---------------- */
let Prefs = { cats: null, starred: false, answerFirst: false };
function loadPrefs() { Prefs = Object.assign({ cats: null, starred: false, answerFirst: false }, LS.get('ff.prefs.' + Session.key, {})); }
function savePrefs() { LS.set('ff.prefs.' + Session.key, Prefs); }
function selectedCats() { const all = allCategories(); return Prefs.cats ? Prefs.cats.filter(c => all.includes(c)) : all; }
function pool() {
  const sel = selectedCats();
  let list = Cards.list.filter(c => sel.includes(c.cat));
  if (Prefs.starred) list = list.filter(c => isStarred(c.id));
  return list;
}

/* ---------------- shared bits ---------------- */
function starBtn(id) {
  const b = h('button', { class: 'icon-btn star', type: 'button', 'aria-label': 'Star this card' });
  const paint = () => { const on = isStarred(id); b.classList.toggle('on', on); b.replaceChildren(icon(on ? 'starFill' : 'star')); };
  b.addEventListener('click', e => { e.stopPropagation(); toggleStar(id); paint(); });
  paint();
  return b;
}
function speakBtn(text) {
  return h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Read aloud', onclick: e => {
    e.stopPropagation(); speak(typeof text === 'function' ? text() : text);
  } }, icon('speaker'));
}
function catTag(c) { return h('span', { class: 'cat-tag', style: { '--c': catColor(c.cat) } }, c.cat); }

/* ---------------- home ---------------- */
const MODE_LIST = [
  { id: 'flashcards', name: 'Flashcards', desc: 'Flip and swipe', icon: 'cards' },
  { id: 'review', name: 'Review', desc: 'Check yourself and rate it', icon: 'eye' },
  { id: 'learn', name: 'Learn', desc: 'Adaptive rounds', icon: 'target' },
  { id: 'write', name: 'Write', desc: 'Type the answer', icon: 'pencil' },
  { id: 'test', name: 'Test', desc: 'Scored practice test', icon: 'clipboard' },
  { id: 'match', name: 'Match', desc: 'Race the clock', icon: 'grid' },
  { id: 'dunk', name: 'Dunk Tank', desc: 'Guess letters, stay dry', icon: 'drop' },
  { id: 'memorize', name: 'Memorize', desc: 'Verses and catechism', icon: 'book' },
];

function goHome(keepScroll) {
  currentView = 'home';
  const cats = allCategories(), sel = new Set(selectedCats()), now = Date.now();
  const stats = cat => {
    const cs = Cards.list.filter(x => x.cat === cat);
    let m = 0, l = 0, d = 0;
    for (const x of cs) { const k = mastery(x.id); if (k === 'mastered') m++; else if (k === 'learning') l++; if (isDue(x.id)) d++; }
    return { total: cs.length, m, l, n: cs.length - m - l, d };
  };
  const toggleCat = c => {
    const cur = selectedCats();
    const next = cur.includes(c) ? cur.filter(x => x !== c) : cur.concat(c);
    Prefs.cats = next.length === cats.length ? null : next;
    savePrefs(); goHome(true);
  };
  const catEls = cats.map(c => {
    const st = stats(c), on = sel.has(c);
    const pct = x => (st.total ? x / st.total * 100 : 0) + '%';
    return h('button', { type: 'button', class: 'cat' + (on ? ' on' : '') + (st.total ? '' : ' empty'), style: { '--c': catColor(c) }, 'aria-pressed': on ? 'true' : 'false', onclick: () => toggleCat(c) },
      h('div', { class: 'cat-head' },
        h('span', { class: 'check' }, on ? icon('check') : null),
        h('span', { class: 'cat-name' }, c),
        h('span', { class: 'cat-count' }, String(st.total))),
      st.total
        ? h('div', { class: 'mbar' }, h('span', { class: 'm', style: { width: pct(st.m) } }), h('span', { class: 'l', style: { width: pct(st.l) } }))
        : h('div', { class: 'cat-empty' }, 'No cards yet'),
      st.total ? h('div', { class: 'cat-foot' }, `${st.m} mastered · ${st.l} learning · ${st.n} new`, st.d ? h('b', null, ` · ${st.d} due`) : null) : null);
  });

  const p = pool();
  const dueCount = p.filter(c => isDue(c.id)).length;
  const starCount = Cards.list.filter(c => sel.has(c.cat) && isStarred(c.id)).length;
  const st = streak();

  const syncEl = h('span', { id: 'sync' }); paintSync(syncEl);
  const userBtn = h('button', { class: 'avatar', type: 'button', 'aria-label': 'Account', onclick: openMenu }, (Session.name[0] || '?').toUpperCase());

  const modeEls = MODE_LIST.map(m => h('button', { type: 'button', class: 'mode', disabled: !p.length, onclick: () => MODES[m.id]() },
    h('span', { class: 'mode-ico' }, icon(m.icon)),
    h('span', { class: 'mode-name' }, m.name),
    h('span', { class: 'mode-desc' }, m.desc),
    m.id === 'review' && dueCount ? h('span', { class: 'badge' }, String(dueCount)) : null));

  render(h('div', { class: 'screen home' },
    h('header', { class: 'bar' }, h('div', { class: 'bar-title left' }, h('span', null, CFG.appName)), syncEl, userBtn),
    h('main', { class: 'body' },
      h('section', { class: 'hello' },
        h('h2', null, `Hi, ${Session.name}`),
        h('p', { class: 'muted' },
          st ? `${plural(st, 'day')} in a row. ` : '',
          dueCount ? `${plural(dueCount, 'card')} ready to review.` : 'Nothing due for review right now.')),
      DEMO ? h('div', { class: 'notice small' }, 'Preview mode with sample cards. See README.md to connect your Google Sheet.') : null,
      h('div', { class: 'section-head' }, h('h3', null, 'Categories'),
        h('button', { class: 'link', type: 'button', onclick: () => { Prefs.cats = sel.size === cats.length ? [] : null; savePrefs(); goHome(true); } },
          sel.size === cats.length ? 'Clear all' : 'Select all')),
      h('div', { class: 'cats' }, catEls),
      h('div', { class: 'legend' }, h('span', { class: 'lg m' }, 'Mastered'), h('span', { class: 'lg l' }, 'Learning'), h('span', { class: 'lg n' }, 'New')),
      h('div', { class: 'options' },
        toggleRow('Starred cards only', Prefs.starred, v => { Prefs.starred = v; savePrefs(); goHome(true); }, plural(starCount, 'starred card')),
        toggleRow('Show answer first', Prefs.answerFirst, v => { Prefs.answerFirst = v; savePrefs(); }, 'Swap the front and back of each card')),
      h('div', { class: 'section-head' }, h('h3', null, 'Study'), h('span', { class: 'muted small' }, plural(p.length, 'card') + ' selected')),
      !p.length ? h('p', { class: 'notice small' }, Prefs.starred ? 'No starred cards in these categories yet. Tap the star on any card to add it.' : 'Pick at least one category that has cards.') : null,
      h('div', { class: 'modes' }, modeEls),
      h('button', { class: 'btn ghost wide', type: 'button', onclick: goBrowse }, icon('list'), ' Browse all cards'),
      h('p', { class: 'foot muted small' },
        `${plural(Cards.list.length, 'card')} · updated ${timeAgo(Cards.updated)} · `,
        h('button', { class: 'link', type: 'button', onclick: refreshCards }, 'Refresh')))), keepScroll);
}

async function refreshCards() {
  toast('Checking for new cards…');
  try { const changed = await loadCards(); toast(changed ? 'Cards updated' : 'Cards are up to date'); }
  catch (e) { toast('Could not reach the Google Sheet'); }
  if (currentView === 'home') goHome(true);
}

function openMenu() {
  sheet('Account', close => h('div', { class: 'stack' },
    h('p', null, 'Signed in as ', h('b', null, Session.name)),
    h('p', { class: 'muted small' }, DEMO ? 'Preview mode: progress is saved on this device.' : 'Your progress is saved to the family Google Sheet, so you can sign in on any iPhone.'),
    btn('Refresh cards now', () => { close(); refreshCards(); }, 'ghost'),
    btn('Add this app to your Home Screen', () => { close(); showInstallHelp(); }, 'ghost'),
    btn('Sign out / switch person', () => { close(); signOut(); }, 'danger')));
}
function showInstallHelp() {
  sheet('Add to Home Screen', () => h('ol', { class: 'steps' },
    h('li', null, 'Open this page in ', h('b', null, 'Safari'), '.'),
    h('li', null, 'Tap the ', h('b', null, 'Share'), ' button (the square with an arrow).'),
    h('li', null, 'Scroll down and tap ', h('b', null, 'Add to Home Screen'), '.'),
    h('li', null, 'Tap ', h('b', null, 'Add'), '. The app now opens full screen like a regular app.')));
}

/* ---------------- browse ---------------- */
function goBrowse() {
  const s = screen({ title: 'All cards', view: 'browse', backIcon: 'left', noProgress: true });
  let q = '', filter = 'all';
  const search = h('input', { class: 'input search', type: 'search', placeholder: 'Search questions and answers', oninput: e => { q = e.target.value.toLowerCase().trim(); draw(); } });
  const filters = h('div', { class: 'seg' });
  const drawFilters = () => filters.replaceChildren(...[['all', 'All'], ['starred', 'Starred'], ['hard', 'Difficult'], ['new', 'New']].map(([k, l]) =>
    h('button', { type: 'button', class: 'seg-btn' + (k === filter ? ' on' : ''), onclick: () => { filter = k; drawFilters(); draw(); } }, l)));
  const list = h('div', { class: 'list' });
  function draw() {
    let cards = Cards.list.filter(c => !q || c.q.toLowerCase().includes(q) || c.a.toLowerCase().includes(q) || c.cat.toLowerCase().includes(q));
    if (filter === 'starred') cards = cards.filter(c => isStarred(c.id));
    if (filter === 'new') cards = cards.filter(c => mastery(c.id) === 'new');
    if (filter === 'hard') cards = cards.filter(c => (P.cards[c.id] || {}).w > 0).sort((a, b) => difficulty(b.id) - difficulty(a.id));
    s.count(String(cards.length));
    const out = [];
    let last = null;
    cards.slice(0, 500).forEach(c => {
      if (filter !== 'hard' && c.cat !== last) { last = c.cat; out.push(h('h4', { class: 'list-head', style: { '--c': catColor(c.cat) } }, c.cat)); }
      const st = P.cards[c.id] || {};
      out.push(h('div', { class: 'row' },
        h('span', { class: 'dot ' + mastery(c.id), title: mastery(c.id) }),
        h('div', { class: 'row-text' },
          h('div', { class: 'row-q' }, c.q),
          h('div', { class: 'row-a' }, c.a),
          filter === 'hard' ? h('div', { class: 'row-meta' }, `${c.cat} · missed ${st.w || 0}, right ${st.k || 0}`) : null),
        h('div', { class: 'row-side' }, speakBtn(() => c.q + '. ' + c.a), starBtn(c.id))));
    });
    if (!out.length) out.push(h('p', { class: 'muted center' }, filter === 'hard' ? 'No missed cards yet.' : 'No cards found.'));
    list.replaceChildren(...out);
  }
  drawFilters();
  s.set([search, filters, list]);
  draw();
}

/* ---------------- start up ---------------- */
function showError(e) {
  currentView = 'error';
  render(h('div', { class: 'screen' }, h('main', { class: 'body center' },
    h('h2', null, 'Could not load the cards'),
    h('p', { class: 'muted' }, DEMO ? 'The sample cards file is missing.' : 'The app could not reach your Google Sheet. Check your internet connection, and check that the web app URL in config.js is right.'),
    h('p', { class: 'muted small' }, String(e && e.message || e)),
    btn('Try again', boot))));
}

async function boot() {
  document.title = CFG.appName;
  const sess = LS.get('ff.session');
  if (sess && sess.name) {
    Session = { name: sess.name, key: sess.name.toLowerCase(), pin: sess.pin };
    P = normalizeProgress(LS.get('ff.progress.' + Session.key));
    loadPrefs();
    try { await ensureCards(); } catch (e) { return showError(e); }
    goHome();
    pullProgress();
  } else {
    showLogin();
    ensureCards().catch(() => { });
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    if (dirty && Session.key) { clearTimeout(syncTimer); syncNow(true); }
  } else if (Session.key && Date.now() - lastPull > 30000) {
    ensureCards().catch(() => { });
    pullProgress();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  boot();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
});
