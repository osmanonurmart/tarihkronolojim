window.K = window.K || {};

/* Çalışma seansı: vadesi gelen olaylar, zayıflar önde. */
K.study = (function () {
  const esc = K.util.esc;
  let session = null;

  function start() {
    const db = K.store.get();
    const qs = K.srs.buildSession(db);
    if (!qs.length) {
      K.util.toast('Soru üretilecek kadar olay yok — en az 4 olay gerekiyor.');
      return false;
    }
    session = { qs: qs, i: 0, right: 0, wrong: 0, answered: null, ups: [] };
    return true;
  }

  function quit() { session = null; }
  const active = () => !!session;

  function answer(index) {
    if (!session || session.answered != null) return;
    const q = session.qs[session.i];
    const correct = index === q.correctIndex;
    session.answered = index;
    if (correct) session.right++; else session.wrong++;

    K.store.quiet((db) => {
      const r = K.srs.record(db, q.ev.id, q.kind, correct);
      session.lastLevel = r.level;
    });
  }

  function next() {
    if (!session) return;
    session.answered = null;
    session.lastLevel = null;
    session.i++;
    K.app.render();
  }

  function renderQuestion(q) {
    const answered = session.answered != null;
    const opts = q.options.map((o, i) => {
      let cls = 'opt';
      if (answered && i === q.correctIndex) cls += ' right';
      else if (answered && i === session.answered) cls += ' wrong';
      return '<button class="' + cls + '" data-act="answer" data-i="' + i + '"' + (answered ? ' disabled' : '') + '>' +
        q.render(o) + '</button>';
    }).join('');

    const kindLabel = q.kind === K.srs.KINDS.ORDER ? 'Araya yerleştirme'
      : q.kind === K.srs.KINDS.AFTER ? 'Sonucunda'
      : q.kind === K.srs.KINDS.START ? 'Kapsam' : 'Tarih';
    let verdict = '';
    if (answered) {
      const ok = session.answered === q.correctIndex;
      verdict =
        '<div class="verdict ' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓ Doğru' : '✕ Yanlış') + '</div>' +
        '<div class="levelup">' + esc(q.ev.title) + ' → seviye ' + session.lastLevel +
          ' · ' + K.srs.INTERVALS[session.lastLevel] + ' gün sonra tekrar</div>' +
        '<button class="btn primary" data-act="next" style="margin-top:.8rem">Devam</button>';
    }

    return '<div class="study-body">' +
      '<div class="q-kind">' + kindLabel + '</div>' +
      '<p class="q-text">' + q.text + '</p>' +
      '<div class="opts">' + opts + '</div>' +
      verdict +
    '</div>';
  }

  function renderSummary() {
    const total = session.right + session.wrong;
    return '<div class="summary">' +
      '<h2>Seans bitti</h2>' +
      '<div class="stats">' +
        '<div class="stat"><b style="color:var(--accent)">' + session.right + '</b><span>doğru</span></div>' +
        '<div class="stat"><b style="color:var(--bad)">' + session.wrong + '</b><span>yanlış</span></div>' +
        '<div class="stat"><b>' + total + '</b><span>soru</span></div>' +
      '</div>' +
      '<p class="hint">Yanlışların yarın tekrar karşına çıkacak.</p>' +
      '<button class="btn primary" data-act="close-study">Listeye dön</button>' +
    '</div>';
  }

  function render() {
    const done = session.i >= session.qs.length;
    const pct = Math.round((Math.min(session.i, session.qs.length) / session.qs.length) * 100);
    return '<div class="screen study">' +
      '<div class="topbar">' +
        '<button class="iconbtn" data-act="close-study" aria-label="Kapat">✕</button>' +
        '<div class="progressbar"><i style="width:' + pct + '%"></i></div>' +
        '<span class="study-count mono">' + Math.min(session.i + (done ? 0 : 1), session.qs.length) + '/' + session.qs.length + '</span>' +
      '</div>' +
      (done ? renderSummary() : renderQuestion(session.qs[session.i])) +
    '</div>';
  }

  return { start, quit, active, answer, next, render };
})();
