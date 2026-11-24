'use strict';
/* Family Flashcards — study modes and games. Uses helpers from app.js. */

/* ---------------- shared helpers ---------------- */
function sides(c) { return Prefs.answerFirst ? { front: c.a, back: c.q } : { front: c.q, back: c.a }; }
function textSize(s) { const n = String(s).length; return n > 320 ? 'xs' : n > 180 ? 'sm' : n > 80 ? 'md' : 'lg'; }

function norm(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'").replace(/&/g, ' and ')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}
function lev(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i), cur = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}
// Forgives capitals, punctuation and small typos. "A / B" in the sheet accepts either.
function isCorrect(given, answer) {
  const g = norm(given);
  if (!g) return false;
  const options = String(answer).split(/\s+\/\s+/).concat([answer]);
  return options.some(opt => {
    const a = norm(opt);
    if (!a) return false;
    if (a === g) return true;
    const sim = 1 - lev(a, g) / Math.max(a.length, g.length);
    return a.length <= 4 ? false : a.length <= 12 ? sim >= 0.8 : sim >= 0.9;
  });
}
// Marks which words of the correct answer were missing from what was typed.
function renderAnswer(given, answer, ok) {
  const words = String(answer).split(/\s+/).filter(Boolean);
  if (ok || !norm(given) || words.length < 4) return h('div', { class: 'answer-text t-' + textSize(answer) }, answer);
  const A = words.map(norm), G = norm(given).split(' ');
  const dp = Array.from({ length: A.length + 1 }, () => new Array(G.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--) for (let j = G.length - 1; j >= 0; j--)
    dp[i][j] = A[i] && A[i] === G[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const hit = new Array(A.length).fill(false);
  for (let i = 0, j = 0; i < A.length && j < G.length;) {
    if (A[i] && A[i] === G[j]) { hit[i] = true; i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return h('div', { class: 'answer-text diff t-' + textSize(answer) },
    words.map((w, i) => [h('span', { class: hit[i] || !A[i] ? '' : 'missed' }, w), ' ']));
}

function distractors(card, n) {
  const back = sides(card).back, seen = new Set([norm(back)]), out = [];
  const same = shuffle(Cards.list.filter(x => x.cat === card.cat && x.id !== card.id));
  const other = shuffle(Cards.list.filter(x => x.cat !== card.cat));
  for (const x of same.concat(other)) {
    const b = sides(x).back, k = norm(b);
    if (!k || seen.has(k)) continue;
    seen.add(k); out.push(b);
    if (out.length >= n) break;
  }
  return out;
}

function promptBlock(card, text, label) {
  return h('div', { class: 'prompt' },
    h('div', { class: 'prompt-top' }, catTag(card), h('span', { class: 'grow' }), speakBtn(text), starBtn(card.id)),
    label ? h('div', { class: 'prompt-label' }, label) : null,
    h('div', { class: 'prompt-text t-' + textSize(text) }, text));
}

function once(fn) { let called = false; return (...a) => { if (called) return; called = true; fn(...a); }; }

function resultPanel(o) {
  return h('div', { class: 'result' },
    o.big ? h('div', { class: 'result-big' }, o.big) : null,
    h('h2', null, o.title),
    o.sub ? h('p', { class: 'muted' }, o.sub) : null,
    o.extra || null,
    h('div', { class: 'stack' }, clean(o.buttons || [])));
}
function needCards(min, label) {
  const p = pool();
  if (p.length >= min) return p;
  toast(`${label} needs at least ${plural(min, 'card')}. Pick more categories.`);
  return null;
}

/* ---------------- question types ---------------- */
function askMC(card, done) {
  const { front, back } = sides(card);
  const ds = distractors(card, 3);
  if (!ds.length) return askSelf(card, done);
  const finish = once(done);
  const fb = h('div', { class: 'feedback' });
  let answered = false;
  const choices = shuffle([back].concat(ds)).map(ch => {
    const b = h('button', { type: 'button', class: 'choice t-' + textSize(ch) }, ch);
    b.onclick = () => {
      if (answered) return;
      answered = true;
      const ok = ch === back;
      choices.forEach(x => { x.b.disabled = true; if (x.ch === back) x.b.classList.add('right'); });
      if (ok) { fb.replaceChildren(h('div', { class: 'fb ok' }, pick(['Correct!', 'Nice!', 'You got it!', 'Well done!']))); setTimeout(() => finish(true), 800); }
      else {
        b.classList.add('wrong');
        fb.replaceChildren(h('div', { class: 'fb bad' }, 'Not quite. The right answer is highlighted.'), btn('Continue', () => finish(false)));
      }
      idk.remove();
    };
    return { b, ch };
  });
  const idk = h('button', { class: 'link center-block', type: 'button', onclick: () => {
    if (answered) return; answered = true; idk.remove();
    choices.forEach(x => { x.b.disabled = true; if (x.ch === back) x.b.classList.add('right'); });
    fb.replaceChildren(btn('Continue', () => finish(false)));
  } }, "I don't know");
  return h('div', { class: 'q-wrap' }, promptBlock(card, front, 'Choose the answer'),
    h('div', { class: 'choices' }, choices.map(x => x.b)), idk, fb);
}

function askWritten(card, done) {
  const { front, back } = sides(card);
  const finish = once(done);
  const long = back.length > 60;
  const input = long
    ? h('textarea', { class: 'input answer-input', rows: '4', placeholder: 'Type the answer', autocorrect: 'off', spellcheck: 'false' })
    : h('input', { class: 'input answer-input', type: 'text', placeholder: 'Type the answer', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'done' });
  const res = h('div', { class: 'feedback' });
  const check = h('button', { class: 'btn primary', type: 'submit' }, 'Check');
  const idk = h('button', { class: 'btn ghost', type: 'button', onclick: () => grade('') }, "Don't know");
  const buttons = h('div', { class: 'row-btns' }, idk, check);
  let graded = false;
  function grade(val) {
    if (graded) return;
    graded = true; input.disabled = true; buttons.remove();
    const ok = isCorrect(val, back);
    res.replaceChildren(...clean([
      h('div', { class: 'fb ' + (ok ? 'ok' : 'bad') }, ok ? 'Correct!' : val.trim() ? 'Not quite' : "Here's the answer"),
      h('div', { class: 'fb-label' }, ok ? 'Answer' : 'Correct answer' + (val.trim() && back.split(/\s+/).length >= 4 ? ' (missed words underlined)' : '')),
      renderAnswer(val, back, ok),
      h('div', { class: 'row-btns' },
        !ok && val.trim() ? h('button', { class: 'btn ghost', type: 'button', onclick: () => finish(true) }, 'I was right') : null,
        btn('Continue', () => finish(ok))),
    ]));
    if (ok) setTimeout(() => finish(true), 1100);
  }
  const form = h('form', { class: 'write-form', onsubmit: e => { e.preventDefault(); grade(input.value); } }, input, buttons);
  setTimeout(() => input.focus(), 60);
  return h('div', { class: 'q-wrap' }, promptBlock(card, front, 'Type the answer'), form, res);
}

function askSelf(card, done) {
  const { front, back } = sides(card);
  const finish = once(done);
  const ans = h('div', { class: 'reveal hidden' }, h('div', { class: 'divider' }), h('div', { class: 'answer-text t-' + textSize(back) }, back));
  const row = h('div', { class: 'row-btns hidden' },
    h('button', { class: 'btn bad', type: 'button', onclick: () => finish(false) }, "I didn't know it"),
    h('button', { class: 'btn ok', type: 'button', onclick: () => finish(true) }, 'I knew it'));
  const show = btn('Show answer', () => { ans.classList.remove('hidden'); row.classList.remove('hidden'); show.remove(); }, 'primary big');
  return h('div', { class: 'q-wrap' }, h('div', { class: 'study-card' }, promptBlock(card, front, 'Say the answer in your head'), ans), show, row);
}

/* ---------------- Flashcards ---------------- */
function swipe(el, on) {
  let x0 = 0, y0 = 0, dx = 0, dy = 0, active = false, pid = null;
  el.addEventListener('pointerdown', e => {
    if (e.target.closest('button')) return;
    active = true; pid = e.pointerId; x0 = e.clientX; y0 = e.clientY; dx = dy = 0;
    el.style.transition = 'none';
  });
  el.addEventListener('pointermove', e => {
    if (!active || e.pointerId !== pid) return;
    dx = e.clientX - x0; dy = e.clientY - y0;
    if (Math.abs(dx) > 8) {
      el.style.transform = `translateX(${dx}px) rotate(${dx / 22}deg)`;
      el.classList.toggle('lean-ok', dx > 50); el.classList.toggle('lean-bad', dx < -50);
    }
  });
  el.addEventListener('pointerup', () => {
    if (!active) return;
    active = false; el.style.transition = ''; el.classList.remove('lean-ok', 'lean-bad');
    if (Math.abs(dx) > 90) fly(el, dx > 0 ? 1 : -1, dx > 0 ? on.right : on.left);
    else { el.style.transform = ''; if (Math.abs(dx) < 8 && Math.abs(dy) < 8) on.tap(); }
  });
  el.addEventListener('pointercancel', () => { active = false; el.style.transition = ''; el.style.transform = ''; el.classList.remove('lean-ok', 'lean-bad'); });
}
function fly(el, dir, then) {
  if (el._gone) return;
  el._gone = true;
  el.style.transition = 'transform .25s ease-in, opacity .25s';
  el.style.transform = `translateX(${dir * 130}%) rotate(${dir * 16}deg)`;
  el.style.opacity = '0';
  setTimeout(then, 220);
}

MODES.flashcards = function () {
  const base = needCards(1, 'Flashcards'); if (!base) return;
  let shuffled = false;
  const shuffleBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Shuffle', onclick: () => {
    shuffled = !shuffled; shuffleBtn.classList.toggle('on', shuffled);
    toast(shuffled ? 'Shuffled' : 'Original order'); start(shuffled ? shuffle(base) : base.slice());
  } }, icon('shuffle'));
  const s = screen({ title: 'Flashcards', right: shuffleBtn });
  let deck, i, know, still, history;

  function start(cards) { deck = cards; i = 0; know = []; still = []; history = []; show(); }
  function show() {
    s.progress(i, deck.length);
    if (i >= deck.length) return summary();
    s.count(`${i + 1} / ${deck.length}`);
    const c = deck[i], { front, back } = sides(c);
    let flipped = false;
    const card = h('div', { class: 'flip' }, h('div', { class: 'flip-inner' },
      h('div', { class: 'face front' },
        h('div', { class: 'face-top' }, catTag(c), h('span', { class: 'grow' }), speakBtn(front), starBtn(c.id)),
        h('div', { class: 'face-text t-' + textSize(front) }, front),
        h('div', { class: 'face-hint' }, 'Tap to flip')),
      h('div', { class: 'face back' },
        h('div', { class: 'face-top' }, h('span', { class: 'face-label' }, 'Answer'), h('span', { class: 'grow' }), speakBtn(back)),
        h('div', { class: 'face-text t-' + textSize(back) }, back))));
    swipe(card, { tap: () => { flipped = !flipped; card.classList.toggle('flipped', flipped); }, left: () => answer(c, false), right: () => answer(c, true) });
    s.set([
      h('div', { class: 'fc-counts' }, h('span', { class: 'pill bad' }, `Still learning ${still.length}`), h('span', { class: 'pill ok' }, `Know ${know.length}`)),
      h('div', { class: 'fc-stage' }, card),
      h('div', { class: 'fc-controls' },
        h('button', { class: 'round-btn bad', type: 'button', 'aria-label': 'Still learning', onclick: () => fly(card, -1, () => answer(c, false)) }, icon('x')),
        h('button', { class: 'round-btn ghost', type: 'button', 'aria-label': 'Undo', disabled: !history.length, onclick: undo }, icon('undo')),
        h('button', { class: 'round-btn ok', type: 'button', 'aria-label': 'Know it', onclick: () => fly(card, 1, () => answer(c, true)) }, icon('check'))),
      h('p', { class: 'muted center small' }, 'Swipe right if you knew it, left if you are still learning.')]);
  }
  function answer(c, knew) {
    history.push({ i, c, prev: P.cards[c.id] ? Object.assign({}, P.cards[c.id]) : null, knew });
    recordResult(c.id, knew);
    (knew ? know : still).push(c);
    i++; show();
  }
  function undo() {
    const last = history.pop(); if (!last) return;
    restoreState(last.c.id, last.prev);
    const list = last.knew ? know : still; list.splice(list.lastIndexOf(last.c), 1);
    i = last.i; show();
  }
  function summary() {
    s.count('');
    s.set(resultPanel({
      big: `${know.length}/${deck.length}`,
      title: still.length ? 'Nice work! Keep going.' : 'You know them all!',
      sub: still.length ? `You are still learning ${plural(still.length, 'card')}.` : 'Every card in this round was a yes.',
      buttons: [
        still.length ? btn(`Keep studying ${plural(still.length, 'card')}`, () => start(shuffled ? shuffle(still) : still.slice())) : null,
        btn('Restart all cards', () => start(shuffled ? shuffle(base) : base.slice()), still.length ? 'ghost' : 'primary'),
        btn('Back home', () => goHome(), 'ghost')],
    }));
  }
  const onKey = e => {
    if (i >= deck.length) return;
    if (e.key === ' ') { e.preventDefault(); const f = document.querySelector('.flip'); if (f) f.classList.toggle('flipped'); }
    if (e.key === 'ArrowRight') { const f = document.querySelector('.flip'); if (f) fly(f, 1, () => answer(deck[i], true)); }
    if (e.key === 'ArrowLeft') { const f = document.querySelector('.flip'); if (f) fly(f, -1, () => answer(deck[i], false)); }
  };
  document.addEventListener('keydown', onKey);
  onCleanup(() => document.removeEventListener('keydown', onKey));
  start(base.slice());
};

/* ---------------- Review (check yourself, rate the difficulty) ---------------- */
MODES.review = function () {
  const base = needCards(1, 'Review'); if (!base) return;
  const s = screen({ title: 'Review' });
  let keyHandler = null;
  const onKey = e => { if (keyHandler) keyHandler(e); };
  document.addEventListener('keydown', onKey);
  onCleanup(() => document.removeEventListener('keydown', onKey));
  const now = Date.now();
  const due = base.filter(c => isDue(c.id)).sort((a, b) => P.cards[a.id].d - P.cards[b.id].d);
  const fresh = base.filter(c => mastery(c.id) === 'new').slice(0, 15);
  const queue = due.concat(fresh);
  if (!queue.length) {
    const next = base.map(c => (P.cards[c.id] || {}).d).filter(Boolean).sort((a, b) => a - b)[0];
    s.set(resultPanel({
      big: '✓', title: 'All caught up!',
      sub: 'Nothing is due right now.' + (next ? ` The next card comes back in ${fmtInterval(next - now)}.` : ''),
      buttons: [btn('Practice the hardest cards anyway', () => run(prioritize(base).slice(0, 20))), btn('Back home', () => goHome(), 'ghost')],
    }));
    return;
  }
  run(queue);

  function run(q) {
    q = q.slice();
    const total = q.length, tally = { 1: 0, 2: 0, 3: 0, 4: 0 };
    let done = 0;
    function show() {
      s.progress(done, total);
      if (!q.length) return finish();
      s.count(`${done + 1} / ${total}`);
      const c = q[0], { front, back } = sides(c);
      const ans = h('div', { class: 'reveal hidden' }, h('div', { class: 'divider' }), h('div', { class: 'answer-text t-' + textSize(back) }, back));
      const t = Date.now();
      const rateRow = h('div', { class: 'rate-row hidden' }, [1, 2, 3, 4].map(r =>
        h('button', { class: 'rate r' + r, type: 'button', onclick: () => doRate(r) },
          h('b', null, RATE_NAMES[r]), h('small', null, fmtInterval(nextState(P.cards[c.id], r, t).d - t)))));
      const hint = h('p', { class: 'muted center small' }, 'Answer in your head, then tap Show answer.');
      const showBtn = btn('Show answer', reveal, 'primary big');
      function reveal() { ans.classList.remove('hidden'); showBtn.remove(); hint.textContent = 'How hard was it? The time shows when you will see it again.'; rateRow.classList.remove('hidden'); }
      function doRate(r) {
        rate(c.id, r); tally[r]++; q.shift();
        if (r === 1) q.splice(Math.min(q.length, 3), 0, c); else done++;
        show();
      }
      s.set([h('div', { class: 'study-card' }, promptBlock(c, front, 'Question'), ans), hint, showBtn, rateRow]);
      keyHandler = e => {
        if (!rateRow.classList.contains('hidden') && '1234'.includes(e.key)) doRate(+e.key);
        else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (showBtn.isConnected) reveal(); }
      };
    }
    function finish() {
      keyHandler = null; s.count('');
      s.set(resultPanel({
        big: String(total), title: 'Review complete',
        sub: `Again ${tally[1]} · Hard ${tally[2]} · Good ${tally[3]} · Easy ${tally[4]}`,
        extra: h('p', { class: 'muted' }, 'Cards you found hard will come back sooner.'),
        buttons: [btn('Back home', () => goHome())],
      }));
    }
    show();
  }
};

/* ---------------- Learn (adaptive rounds) ---------------- */
MODES.learn = function () {
  const base = needCards(2, 'Learn'); if (!base) return;
  const s = screen({ title: 'Learn' });
  let candidates = prioritize(base.filter(c => mastery(c.id) !== 'mastered'));
  if (candidates.length < 2) candidates = prioritize(base);
  const items = candidates.slice(0, 20).map(c => ({ c, stage: 0 }));
  let round = 0;
  const prog = () => { s.progress(items.reduce((a, x) => a + x.stage, 0), items.length * 2); s.count(`${items.filter(x => x.stage >= 2).length} / ${items.length} learned`); };

  function nextRound() {
    const pending = items.filter(x => x.stage < 2);
    if (!pending.length) return finished();
    round++;
    const batch = pending.slice(0, 7), results = [];
    let qi = 0;
    const ask = () => {
      prog();
      if (qi >= batch.length) return roundSummary(batch, results);
      const it = batch[qi];
      const handler = ok => { recordResult(it.c.id, ok); if (ok) it.stage++; results.push({ it, ok }); qi++; ask(); };
      const long = sides(it.c).back.length > 80;
      s.set(it.stage === 0 ? askMC(it.c, handler) : long ? askSelf(it.c, handler) : askWritten(it.c, handler));
    };
    ask();
  }
  function roundSummary(batch, results) {
    const right = results.filter(r => r.ok).length;
    s.set(resultPanel({
      big: `${right}/${results.length}`, title: `Round ${round} done`,
      sub: `${items.filter(x => x.stage >= 2).length} of ${items.length} cards learned so far.`,
      extra: h('div', { class: 'list compact' }, batch.map(it => h('div', { class: 'row' },
        h('span', { class: 'dot ' + (it.stage >= 2 ? 'mastered' : it.stage === 1 ? 'learning' : 'new') }),
        h('div', { class: 'row-text' }, h('div', { class: 'row-q' }, sides(it.c).front), h('div', { class: 'row-a' }, sides(it.c).back))))),
      buttons: [btn('Continue', nextRound), btn('Back home', () => goHome(), 'ghost')],
    }));
  }
  function finished() {
    s.count('');
    s.set(resultPanel({
      big: '★', title: `You learned ${plural(items.length, 'card')}!`,
      sub: 'Each card was answered right as multiple choice and then from memory.',
      buttons: [btn('Learn more cards', () => MODES.learn()), btn('Back home', () => goHome(), 'ghost')],
    }));
  }
  nextRound();
};

/* ---------------- Write ---------------- */
MODES.write = function () {
  const base = needCards(1, 'Write'); if (!base) return;
  const s = screen({ title: 'Write' });
  function run(cards) {
    let i = 0, right = 0; const missed = [];
    const next = () => {
      s.progress(i, cards.length);
      if (i >= cards.length) return summary();
      s.count(`${i + 1} / ${cards.length}`);
      const c = cards[i];
      s.set(askWritten(c, ok => { recordResult(c.id, ok); if (ok) right++; else missed.push(c); i++; next(); }));
    };
    const summary = () => {
      s.count('');
      s.set(resultPanel({
        big: Math.round(right / cards.length * 100) + '%', title: missed.length ? 'Round complete' : 'Perfect round!',
        sub: `${right} of ${cards.length} correct.`,
        buttons: [missed.length ? btn(`Practice the ${plural(missed.length, 'missed card')}`, () => run(shuffle(missed))) : null,
          btn('Start over', () => MODES.write(), missed.length ? 'ghost' : 'primary'), btn('Back home', () => goHome(), 'ghost')],
      }));
    };
    next();
  }
  run(prioritize(base));
};

/* ---------------- Test ---------------- */
const TYPE_NAMES = { mc: 'Multiple choice', tf: 'True or false', wr: 'Written' };
MODES.test = function () {
  const base = needCards(2, 'Test'); if (!base) return;
  const s = screen({ title: 'Test', noProgress: true });
  const opts = [5, 10, 20].filter(n => n < base.length).concat(base.length);
  let n = opts.includes(10) ? 10 : opts[opts.length - 1];
  const types = { mc: true, tf: true, wr: true };
  const seg = h('div', { class: 'seg' });
  const drawSeg = () => seg.replaceChildren(...opts.map(o => h('button', { type: 'button', class: 'seg-btn' + (o === n ? ' on' : ''), onclick: () => { n = o; drawSeg(); } }, o === base.length && !([5, 10, 20].includes(o)) ? `All ${o}` : String(o))));
  drawSeg();
  s.set(h('div', { class: 'setup' },
    h('h2', null, 'Set up your test'),
    h('p', { class: 'label' }, 'Number of questions'), seg,
    h('p', { class: 'label' }, 'Question types'),
    h('div', { class: 'options' }, Object.keys(TYPE_NAMES).map(k => toggleRow(TYPE_NAMES[k], types[k], v => { types[k] = v; }))),
    btn('Start test', () => {
      if (!Object.values(types).some(Boolean)) return toast('Pick at least one question type');
      runTest(s, shuffle(prioritize(base).slice(0, n)), types);
    }, 'primary big')));
};
function runTest(s, cards, types) {
  const enabled = Object.keys(types).filter(k => types[k]);
  const qs = cards.map(c => {
    const { front, back } = sides(c);
    let t = pick(enabled);
    if (t === 'wr' && back.length > 100 && enabled.length > 1) t = pick(enabled.filter(x => x !== 'wr'));
    const ds = distractors(c, 3);
    if (t !== 'wr' && !ds.length) t = 'wr';
    const q = { c, t, front, back, answer: null };
    if (t === 'mc') q.choices = shuffle([back].concat(ds));
    if (t === 'tf') { q.truth = Math.random() < 0.5; q.shown = q.truth ? back : ds[0]; }
    return q;
  });
  s.count(plural(qs.length, 'question'));
  const sections = qs.map((q, i) => {
    const body = h('div', { class: 'tq-body' });
    if (q.t === 'mc' || q.t === 'tf') {
      const opts = q.t === 'mc' ? q.choices.map(ch => [ch, ch]) : [['True', true], ['False', false]];
      if (q.t === 'tf') body.append(h('div', { class: 'tf-shown' }, h('span', { class: 'fb-label' }, 'Is this the answer?'), h('div', { class: 't-' + textSize(q.shown) }, q.shown)));
      q.btns = opts.map(([label, val]) => {
        const b = h('button', { type: 'button', class: 'choice' + (q.t === 'tf' ? ' tf' : ' t-' + textSize(label)) }, label);
        b._v = val;
        b.onclick = () => { if (q.locked) return; q.answer = val; q.btns.forEach(x => x.classList.toggle('picked', x === b)); };
        return b;
      });
      body.append(h('div', { class: q.t === 'tf' ? 'tf-row' : 'choices' }, q.btns));
    } else {
      q.input = q.back.length > 60
        ? h('textarea', { class: 'input', rows: '3', placeholder: 'Type the answer', autocorrect: 'off', spellcheck: 'false' })
        : h('input', { class: 'input', type: 'text', placeholder: 'Type the answer', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false' });
      body.append(q.input);
    }
    q.sec = h('section', { class: 'tq' },
      h('div', { class: 'tq-head' }, h('span', null, `${i + 1} of ${qs.length}`), h('span', null, TYPE_NAMES[q.t])),
      h('div', { class: 'tq-prompt t-' + textSize(q.front) }, q.front), body);
    return q.sec;
  });
  const banner = h('div', { class: 'test-banner hidden' });
  const after = h('div', { class: 'stack' });
  const submit = btn('Submit test', grade, 'primary big');
  s.set([banner, sections, submit, after]);

  function grade() {
    const blank = qs.filter(q => q.t === 'wr' ? !q.input.value.trim() : q.answer === null).length;
    if (blank && !confirm(`${plural(blank, 'question')} not answered. Submit anyway?`)) return;
    let right = 0; const missed = [];
    qs.forEach(q => {
      q.locked = true;
      let ok;
      if (q.t === 'mc') ok = q.answer !== null && q.answer === q.back;
      else if (q.t === 'tf') ok = q.answer === q.truth;
      else { ok = isCorrect(q.input.value, q.back); q.input.disabled = true; }
      recordResult(q.c.id, ok);
      if (ok) right++; else missed.push(q.c);
      q.sec.classList.add(ok ? 'right' : 'wrong');
      if (q.btns) q.btns.forEach(b => {
        b.disabled = true;
        if (q.t === 'mc' && b._v === q.back) b.classList.add('right');
        if (q.t === 'tf' && b._v === q.truth) b.classList.add('right');
        if (b.classList.contains('picked') && !b.classList.contains('right')) b.classList.add('wrong');
      });
      if (!ok) q.sec.append(h('div', { class: 'tq-correct' }, h('span', { class: 'fb-label' }, 'Correct answer'), h('div', null, q.back)));
    });
    const pct = Math.round(right / qs.length * 100);
    banner.classList.remove('hidden');
    banner.replaceChildren(h('div', { class: 'result-big' }, pct + '%'), h('div', null, `${right} of ${qs.length} correct`),
      h('p', { class: 'muted' }, pct >= 90 ? 'Excellent work!' : pct >= 70 ? 'Nice job. Keep it up.' : 'Keep practicing. You will get there.'));
    submit.remove();
    after.replaceChildren(...clean([
      missed.length ? btn(`Retest the ${plural(missed.length, 'missed question')}`, () => { runTest(s, shuffle(missed), types); window.scrollTo(0, 0); }) : null,
      btn('New test', () => MODES.test(), 'ghost'), btn('Back home', () => goHome(), 'ghost')]));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

/* ---------------- Match ---------------- */
MODES.match = function () {
  const base = needCards(2, 'Match'); if (!base) return;
  const s = screen({ title: 'Match', noProgress: true });
  const key = 'match:' + selectedCats().slice().sort().join('|') + (Prefs.starred ? ':starred' : '') + (Prefs.answerFirst ? ':swap' : '');
  let raf = null;
  onCleanup(() => cancelAnimationFrame(raf));
  const fmt = ms => (ms / 1000).toFixed(1) + 's';

  function intro() {
    const best = P.best[key];
    s.count('');
    s.set(resultPanel({
      big: icon('grid'), title: 'Match',
      sub: 'Tap a question, then tap its answer. Clear the board as fast as you can. A wrong match adds 1 second.',
      extra: best ? h('p', { class: 'pill ok' }, `Your best: ${fmt(best)}`) : null,
      buttons: [btn('Start game', play, 'primary big'), btn('Back home', () => goHome(), 'ghost')],
    }));
  }
  function play() {
    const chosen = [], fronts = new Set(), backs = new Set();
    for (const c of prioritize(base)) {
      const { front, back } = sides(c), f = norm(front), b = norm(back);
      if (fronts.has(f) || backs.has(b) || fronts.has(b) || backs.has(f)) continue;
      fronts.add(f); backs.add(b); chosen.push(c);
      if (chosen.length >= 6) break;
    }
    const tiles = shuffle(chosen.flatMap(c => [{ id: c.id, side: 'q', text: sides(c).front }, { id: c.id, side: 'a', text: sides(c).back }]));
    let sel = null, left = chosen.length, penalty = 0, finished = false;
    const t0 = performance.now();
    const tick = () => { s.count(fmt(performance.now() - t0 + penalty)); raf = requestAnimationFrame(tick); };
    tick();
    tiles.forEach(t => {
      const len = t.text.length;
      t.el = h('button', { type: 'button', class: 'tile ' + (len > 110 ? 'xs' : len > 60 ? 'sm' : len > 25 ? 'md' : 'lg') + (t.side === 'q' ? ' q' : '') }, h('span', null, t.text));
      t.el.onclick = () => tap(t);
    });
    function tap(t) {
      if (t.gone || finished) return;
      if (sel === t) { t.el.classList.remove('sel'); sel = null; return; }
      if (!sel) { sel = t; t.el.classList.add('sel'); return; }
      const a = sel; sel = null; a.el.classList.remove('sel');
      if (a.id === t.id) {
        a.gone = t.gone = true;
        a.el.classList.add('ok'); t.el.classList.add('ok');
        setTimeout(() => { a.el.classList.add('gone'); t.el.classList.add('gone'); }, 250);
        if (--left === 0) done(performance.now() - t0 + penalty);
      } else {
        penalty += 1000;
        [a, t].forEach(x => { x.el.classList.add('bad'); setTimeout(() => x.el.classList.remove('bad'), 450); });
      }
    }
    function done(ms) {
      finished = true; cancelAnimationFrame(raf);
      const prev = P.best[key], record = !prev || ms < prev;
      if (record) { P.best[key] = Math.round(ms); touchDay(); saveProgress(); }
      setTimeout(() => {
        s.count(fmt(ms));
        s.set(resultPanel({
          big: fmt(ms), title: record ? (prev ? 'New record!' : 'Board cleared!') : 'Board cleared!',
          sub: prev ? (record ? `You beat your old best of ${fmt(prev)}.` : `Your best is ${fmt(prev)}.`) : 'This is your best time to beat.',
          extra: penalty ? h('p', { class: 'muted small' }, `Includes ${penalty / 1000}s of penalties.`) : null,
          buttons: [btn('Play again', play, 'primary big'), btn('Back home', () => goHome(), 'ghost')],
        }));
      }, 450);
    }
    s.set(h('div', { class: 'match-grid' }, tiles.map(t => t.el)));
  }
  intro();
};

/* ---------------- Dunk Tank (letter guessing game) ---------------- */
const DUNK_MAX = 6;
const DUNK_HITS = [[-15, -12], [14, 13], [-13, 12], [12, -14], [-5, 6], [0, 0]];
const STOP = new Set(['which', 'their', 'there', 'these', 'those', 'about', 'would', 'could', 'should', 'shall', 'unto', 'where', 'while', 'being', 'thine', 'other']);
const DUNK_SVG = `
<svg viewBox="0 0 240 200" class="dunk-svg" role="img" aria-label="A man sitting over a dunk tank">
  <rect x="20" y="104" width="148" height="90" rx="8" class="tank-back"/>
  <rect x="24" y="126" width="140" height="64" rx="4" class="water"/>
  <rect x="166" y="28" width="8" height="166" rx="2" class="post"/>
  <rect x="174" y="91" width="22" height="5" class="post"/>
  <g class="target">
    <circle cx="214" cy="94" r="21" class="ring-w"/>
    <circle cx="214" cy="94" r="15" class="ring-r"/>
    <circle cx="214" cy="94" r="9" class="ring-w"/>
    <circle cx="214" cy="94" r="4" class="ring-r"/>
  </g>
  <g class="hits"></g>
  <g class="man">
    <path d="M90 98 L108 100 L110 124" class="leg"/>
    <path d="M88 98 L100 104 L98 126" class="leg"/>
    <path d="M90 72 L90 98" class="torso"/>
    <path d="M90 78 L76 94" class="arm arm-l"/>
    <path d="M90 78 L104 94" class="arm arm-r"/>
    <circle cx="90" cy="59" r="12" class="skin"/>
    <circle cx="86" cy="57" r="1.5" class="eye"/>
    <circle cx="94" cy="57" r="1.5" class="eye"/>
    <path d="M85 63 Q90 67 95 63" class="mouth"/>
    <path d="M85 63 Q90 60 95 63" class="mouth worried"/>
    <path d="M76 49 H104" class="hat-brim"/>
    <rect x="81" y="40" width="18" height="9" rx="1.5" class="hat"/>
  </g>
  <g class="seat"><rect x="58" y="98" width="110" height="7" rx="2"/></g>
  <rect x="24" y="126" width="140" height="64" rx="4" class="water-front"/>
  <rect x="20" y="104" width="148" height="90" rx="8" class="tank-front"/>
  <g class="splash">
    <circle cx="90" cy="128" r="4" style="--dx:-34px;--dy:-46px"/>
    <circle cx="90" cy="128" r="3" style="--dx:-14px;--dy:-62px"/>
    <circle cx="90" cy="128" r="5" style="--dx:10px;--dy:-58px"/>
    <circle cx="90" cy="128" r="3" style="--dx:32px;--dy:-44px"/>
    <circle cx="90" cy="128" r="4" style="--dx:-50px;--dy:-20px"/>
    <circle cx="90" cy="128" r="3" style="--dx:48px;--dy:-24px"/>
  </g>
  <circle cx="12" cy="186" r="6" class="ball"/>
</svg>`;

function pickPuzzle(card) {
  const { front, back } = sides(card);
  const letters = (back.match(/[a-z]/gi) || []).length;
  if (letters <= 24) return { clue: front, text: back, start: 0, end: back.length, whole: true };
  const re = /[A-Za-z][A-Za-z']*[A-Za-z]/g, words = [];
  let m;
  while ((m = re.exec(back))) {
    const w = m[0].replace(/'/g, '');
    if (w.length >= 5 && !STOP.has(w.toLowerCase())) words.push({ s: m.index, e: m.index + m[0].length, len: w.length });
  }
  if (!words.length) return { clue: front, text: back, start: 0, end: back.length, whole: true };
  const longer = words.filter(w => w.len >= 6);
  const w = pick(longer.length ? longer : words);
  return { clue: front, text: back, start: w.s, end: w.e, whole: false };
}

MODES.dunk = function () {
  const base = needCards(1, 'Dunk Tank'); if (!base) return;
  const s = screen({ title: 'Dunk Tank', noProgress: true });
  let order = prioritize(base), idx = 0, run = 0, guessFn = null;
  const onKey = e => { if (guessFn && /^[a-z]$/i.test(e.key) && !e.metaKey && !e.ctrlKey) guessFn(e.key.toLowerCase()); };
  document.addEventListener('keydown', onKey);
  onCleanup(() => document.removeEventListener('keydown', onKey));

  function game() {
    if (idx >= order.length) { order = prioritize(base); idx = 0; }
    const c = order[idx++], pz = pickPuzzle(c);
    const inRange = i => i >= pz.start && i < pz.end;
    const need = new Set();
    for (let i = pz.start; i < pz.end; i++) if (/[a-z]/i.test(pz.text[i])) need.add(pz.text[i].toLowerCase());
    const used = new Set(), keys = {};
    let misses = 0, over = false;
    const best = P.best['max:dunk'] || 0;
    s.count(run ? `${run} in a row` : '');

    const art = h('div', { class: 'dunk-art', html: DUNK_SVG });
    const svg = art.firstElementChild;
    const balls = h('div', { class: 'balls', 'aria-label': 'Balls thrown' });
    const paintBalls = () => balls.replaceChildren(...Array.from({ length: DUNK_MAX }, (_, i) => h('span', { class: 'b' + (i < misses ? ' used' : '') })));
    const puzzle = h('div', { class: 'puzzle' + (pz.whole ? '' : ' ctx') });
    function paintPuzzle() {
      const parts = []; let i = 0;
      for (const tok of pz.text.split(/(\s+)/)) {
        if (!tok) continue;
        if (/^\s+$/.test(tok)) { parts.push(' '); i += tok.length; continue; }
        const word = h('span', { class: 'pw' });
        for (const ch of tok) {
          if (inRange(i) && /[a-z]/i.test(ch)) {
            const shown = used.has(ch.toLowerCase());
            word.append(h('span', { class: 'slot' + (shown ? ' shown' : over ? ' missed' : '') }, shown || over ? ch : ' '));
          } else word.append(h('span', { class: inRange(i) ? 'fixed' : 'ctx-ch' }, ch));
          i += ch.length;
        }
        parts.push(word);
      }
      puzzle.replaceChildren(...parts);
    }
    const msg = h('p', { class: 'dunk-msg' }, `Guess the ${pz.whole ? 'answer' : 'missing word'} one letter at a time. ${DUNK_MAX} misses and he gets dunked!`);
    const kb = h('div', { class: 'kb' }, 'abcdefghijklmnopqrstuvwxyz'.split('').map(l => {
      const b = h('button', { type: 'button', class: 'key' }, l.toUpperCase());
      b.onclick = () => guess(l); keys[l] = b; return b;
    }));
    const actions = h('div', { class: 'row-btns' }, h('button', { class: 'btn ghost', type: 'button', onclick: () => lose(true) }, 'Give up'));

    function guess(l) {
      if (over || used.has(l)) return;
      used.add(l);
      const b = keys[l]; b.disabled = true;
      if (need.has(l)) {
        b.classList.add('hit'); paintPuzzle();
        if ([...need].every(x => used.has(x))) win();
      } else {
        b.classList.add('miss'); misses++; paintBalls(); throwBall(misses);
        if (misses >= DUNK_MAX) setTimeout(() => lose(false), 450);
        else { svg.classList.remove('wobble'); void svg.getBoundingClientRect(); svg.classList.add('wobble'); }
      }
    }
    function throwBall(n) {
      const [ox, oy] = DUNK_HITS[n - 1], tx = 214 + ox, ty = 94 + oy;
      const ball = svg.querySelector('.ball');
      const mark = () => {
        const m = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        m.setAttribute('cx', tx); m.setAttribute('cy', ty); m.setAttribute('r', n === DUNK_MAX ? 4 : 2.6);
        m.setAttribute('class', 'hitmark');
        svg.querySelector('.hits').append(m);
      };
      if (ball.animate) {
        const a = ball.animate([
          { transform: 'translate(0px,0px)', opacity: 1 },
          { transform: `translate(${(tx - 12) / 2}px,${ty - 186 - 50}px)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${tx - 12}px,${ty - 186}px)`, opacity: 1 }], { duration: 420, easing: 'ease-out' });
        a.onfinish = mark;
      } else mark();
    }
    function win() {
      over = true; guessFn = null; run++;
      if (run > best) { P.best['max:dunk'] = run; }
      recordResult(c.id, true);
      svg.classList.add('cheer');
      s.count(`${run} in a row`);
      msg.replaceChildren(h('b', { class: 'ok-text' }, 'Safe and dry!'), ` ${run > 1 ? `That's ${run} in a row.` : ''}${run > best && best ? ' New record!' : ''}`);
      actions.replaceChildren(btn('Next card', game, 'primary big'));
      kb.classList.add('done');
    }
    function lose(gaveUp) {
      if (over) return;
      over = true; guessFn = null; run = 0;
      recordResult(c.id, false);
      paintPuzzle();
      svg.classList.add('dunked');
      s.count('');
      msg.replaceChildren(h('b', { class: 'bad-text' }, 'SPLASH!'), gaveUp ? ' He went in anyway. The answer is shown above.' : ' The answer is shown above.');
      actions.replaceChildren(btn('Next card', game, 'primary big'));
      kb.classList.add('done');
    }
    guessFn = guess;
    paintBalls(); paintPuzzle();
    s.set([
      h('div', { class: 'prompt dunk-clue' }, h('div', { class: 'prompt-top' }, catTag(c), h('span', { class: 'grow' }), speakBtn(pz.clue), starBtn(c.id)),
        h('div', { class: 'prompt-text t-' + textSize(pz.clue) }, pz.clue)),
      art, balls, puzzle, msg, kb, actions,
      best ? h('p', { class: 'muted center small' }, `Best run: ${best} in a row`) : null]);
  }
  game();
};

/* ---------------- Memorize (scripture and catechism helps) ---------------- */
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function tokenize(text) {
  return String(text).split(/(\s+)/).filter(x => x !== '').map(t => {
    if (/^\s+$/.test(t)) return { space: true };
    const m = t.match(/^([^a-z0-9]*)([a-z0-9]?)(.*)$/i);
    return { t, lead: m[1], first: m[2], rest: m[3], key: m[2].toLowerCase() };
  });
}
function maskedWord(tok, showFirst) {
  return h('span', { class: 'mw masked', onclick: e => e.currentTarget.classList.toggle('peek') },
    tok.lead, h('span', { class: showFirst ? 'mw-first' : 'mw-hide' }, tok.first), h('span', { class: 'mw-hide' }, tok.rest));
}

MODES.memorize = function () {
  const base = needCards(1, 'Memorize'); if (!base) return;
  const s = screen({ title: 'Memorize' });
  const LEVELS = [['Read', 0], ['25%', 0.25], ['50%', 0.5], ['75%', 0.75], ['All', 1]];
  let i = 0, level = 0, firstLetters = true, seed = 1;

  function view() {
    s.progress(i, base.length - 1);
    s.count(`${i + 1} / ${base.length}`);
    const c = base[i], { front, back } = sides(c);
    const toks = tokenize(back);
    const wordIdx = toks.map((t, k) => t.key ? k : -1).filter(k => k >= 0);
    const rnd = mulberry(seed * 7919 + i * 131 + level);
    const hideN = Math.round(wordIdx.length * LEVELS[level][1]);
    const order = wordIdx.slice();
    for (let a = order.length - 1; a > 0; a--) { const b = Math.floor(rnd() * (a + 1)); [order[a], order[b]] = [order[b], order[a]]; }
    const hidden = new Set(order.slice(0, hideN));
    const text = h('div', { class: 'mem-text t-' + textSize(back) },
      toks.map((t, k) => t.space ? ' ' : hidden.has(k) ? maskedWord(t, firstLetters) : h('span', { class: 'mw' }, t.t)));
    const seg = h('div', { class: 'seg' }, LEVELS.map(([l], k) => h('button', { type: 'button', class: 'seg-btn' + (k === level ? ' on' : ''), onclick: () => { level = k; view(); } }, l)));
    s.set([
      promptBlock(c, front, null),
      h('div', { class: 'study-card mem' }, text, level ? h('p', { class: 'muted small center' }, 'Tap a blank to peek at the word.') : null),
      h('p', { class: 'label' }, 'Hide words'), seg,
      h('div', { class: 'options' }, toggleRow('Show first letters', firstLetters, v => { firstLetters = v; view(); })),
      h('div', { class: 'row-btns' },
        level ? btn('New blanks', () => { seed++; view(); }, 'ghost') : null,
        btn('Type first letters', () => typeIt(c), 'primary')),
      h('div', { class: 'mem-nav' },
        h('button', { class: 'btn ghost', type: 'button', disabled: i === 0, onclick: () => { i--; view(); } }, icon('left'), ' Prev'),
        h('select', { class: 'input select', 'aria-label': 'Choose a card', onchange: e => { i = +e.target.value; view(); } },
          base.map((x, k) => h('option', { value: String(k), selected: k === i }, `${k + 1}. ${sides(x).front.slice(0, 40)}`))),
        h('button', { class: 'btn ghost', type: 'button', disabled: i >= base.length - 1, onclick: () => { i++; view(); } }, 'Next ', icon('right')))]);
  }

  // Type the first letter of each word; the word appears when you get it right.
  function typeIt(c) {
    const { front, back } = sides(c);
    const toks = tokenize(back);
    const words = [];
    const text = h('div', { class: 'mem-text typing t-' + textSize(back) }, toks.map(t => {
      if (t.space) return ' ';
      if (!t.key) return h('span', { class: 'mw' }, t.t);
      const el = h('span', { class: 'mw masked' }, t.lead, h('span', { class: 'mw-hide' }, t.first), h('span', { class: 'mw-hide' }, t.rest));
      words.push({ t, el }); return el;
    }));
    let pos = 0, tries = 0, clean1 = 0, slips = 0, finished = false;
    const stat = h('p', { class: 'muted center small' }, `0 / ${words.length} words`);
    const input = h('input', { class: 'input type-input', type: 'text', placeholder: 'Type the first letter of each word', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', 'aria-label': 'First letters' });
    const after = h('div', { class: 'stack' });
    const mark = () => { words.forEach((w, k) => w.el.classList.toggle('cur', k === pos && !finished)); stat.textContent = `${pos} / ${words.length} words · ${slips} slip${slips === 1 ? '' : 's'}`; };
    function reveal(w, cls) { w.el.classList.remove('masked', 'cur'); w.el.classList.add(cls); }
    function handle(ch) {
      if (finished || !/[a-z0-9]/.test(ch)) return;
      const w = words[pos];
      if (ch === w.t.key) { reveal(w, tries ? 'late' : 'good'); if (!tries) clean1++; tries = 0; pos++; }
      else {
        slips++; tries++;
        w.el.classList.remove('err'); void w.el.offsetWidth; w.el.classList.add('err');
        if (tries >= 3) { reveal(w, 'bad'); tries = 0; pos++; }
      }
      if (pos >= words.length) complete();
      mark();
    }
    function complete() {
      finished = true; input.disabled = true; hintBtn.remove();
      const acc = words.length ? Math.round(clean1 / words.length * 100) : 100;
      recordResult(c.id, acc >= 90);
      after.replaceChildren(...clean([
        h('div', { class: 'fb ' + (acc >= 90 ? 'ok' : 'bad') }, `${acc}% on the first try. ` + (acc === 100 ? 'Perfect!' : acc >= 90 ? 'Great job!' : 'Keep practicing.')),
        btn('Try again', () => typeIt(c)),
        i < base.length - 1 ? btn('Next card', () => { i++; typeIt(base[i]); }, 'ghost') : null,
        btn('Back to Memorize', view, 'ghost')]));
    }
    input.addEventListener('input', () => { const v = input.value; input.value = ''; for (const ch of v) handle(ch.toLowerCase()); });
    const hintBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => { if (finished) return; slips++; reveal(words[pos], 'bad'); tries = 0; pos++; if (pos >= words.length) complete(); mark(); input.focus(); } }, icon('bulb'), ' Show word');
    s.set([promptBlock(c, front, 'Type the first letter of each word'), h('div', { class: 'study-card mem' }, text), stat, input,
      h('div', { class: 'row-btns' }, btn('Back', view, 'ghost'), hintBtn), after]);
    if (!words.length) complete();
    mark();
    setTimeout(() => input.focus(), 60);
  }
  view();
};
