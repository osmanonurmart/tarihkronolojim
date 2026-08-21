window.K = window.K || {};

/* Beş basamaklı tekrar sistemi ve soru üretimi. */
K.srs = (function () {
  const INTERVALS = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };   // seviye -> kaç gün sonra
  const SESSION_MAX = 20;
  const KINDS = { DATE: 'date', ORDER: 'order', AFTER: 'after', START: 'start' };

  const pkey = (profileId, eventId, kind) => profileId + '|' + eventId + '|' + kind;

  function rec(db, eventId, kind) {
    const k = pkey(db.ui.profileId, eventId, kind);
    return db.progress[k] || { level: 1, due: null, right: 0, wrong: 0 };
  }

  function levelOf(db, eventId) {
    const ev = K.model.byId(db, eventId);
    // Kapsamın tek sorusu var: ne ile başladığı.
    if (ev && K.model.isSpan(ev)) return rec(db, eventId, KINDS.START).level;
    // Kartın rengi puanların en düşüğünü gösterir: zayıf taraf öne çıksın.
    let level = rec(db, eventId, KINDS.ORDER).level;
    if (ev && ev.start) level = Math.min(level, rec(db, eventId, KINDS.DATE).level);
    if (ev && ev.after) level = Math.min(level, rec(db, eventId, KINDS.AFTER).level);
    return level;
  }

  function record(db, eventId, kind, correct) {
    const k = pkey(db.ui.profileId, eventId, kind);
    const r = Object.assign({ level: 1, due: null, right: 0, wrong: 0 }, db.progress[k]);
    if (correct) { r.level = Math.min(5, r.level + 1); r.right++; }
    else { r.level = Math.max(1, r.level - 1); r.wrong++; }
    r.due = K.util.addDays(K.util.todayISO(), INTERVALS[r.level]);
    db.progress[k] = r;
    return r;
  }

  /* Bugün sorulabilecek (olay, tip) çiftleri. Hiç çalışılmamışlar da dahil. */
  function dueItems(db) {
    const flat = K.model.cards(db);            // kapsamlar kart değil
    const today = K.util.todayISO();
    const items = [];
    const withAfter = flat.filter((e) => e.after).length;

    // Kapsamlar yalnız "ne ile başladı" sorusunun öznesi olabilir.
    if (flat.length >= 4) {
      K.model.listEvents(db).filter((e) => K.model.isSpan(e)).forEach((sp) => {
        if (!firstInside(db, sp)) return;
        const r = rec(db, sp.id, KINDS.START);
        if (!r.due || r.due <= today) items.push({ ev: sp, kind: KINDS.START, level: r.level, due: r.due });
      });
    }

    flat.forEach((ev, i) => {
      // Sıra sorusu için etrafında yeterli olay olmalı.
      if (flat.length >= 4) {
        const r = rec(db, ev.id, KINDS.ORDER);
        if (!r.due || r.due <= today) items.push({ ev: ev, kind: KINDS.ORDER, level: r.level, due: r.due, idx: i });
      }
      if (ev.start) {
        const r = rec(db, ev.id, KINDS.DATE);
        if (!r.due || r.due <= today) items.push({ ev: ev, kind: KINDS.DATE, level: r.level, due: r.due, idx: i });
      }
      // Sonuç sorusu için başka kartlarda da sonuç metni olmalı — yanlış
      // şıklar oradan geliyor.
      if (ev.after && withAfter >= 4) {
        const r = rec(db, ev.id, KINDS.AFTER);
        if (!r.due || r.due <= today) items.push({ ev: ev, kind: KINDS.AFTER, level: r.level, due: r.due, idx: i });
      }
    });

    // Zayıf olan önce, sonra en uzun süredir bekleyen.
    items.sort((a, b) => (a.level - b.level) || String(a.due || '').localeCompare(String(b.due || '')));
    return items;
  }

  function dueCount(db) { return dueItems(db).length; }

  /* ---- Soru üretimi ---- */

  function firstInside(db, span) {
    const inside = K.model.flatten(db, span.id).filter((e) => !K.model.isSpan(e));
    return inside.length ? inside[0] : null;
  }

  function buildStartQuestion(db, span, flat) {
    const first = firstInside(db, span);
    if (!first) return null;

    const pool = flat.filter((e) => e.id !== first.id);
    if (pool.length < 3) return null;
    const wrong = K.util.shuffle(pool).slice(0, 3).map((e) => e.title);
    const options = K.util.shuffle([first.title].concat(wrong));

    return {
      kind: KINDS.START,
      ev: span,
      text: '<span class="subject">' + K.util.esc(span.title) + '</span> ne ile başladı?',
      options: options,
      correctIndex: options.indexOf(first.title),
      render: (o) => K.util.esc(o)
    };
  }

  function neighborLabel(ev) {
    if (!ev) return null;
    return { id: ev.id, title: ev.title, date: K.model.fmtEvent(ev) };
  }

  function buildOrderQuestion(db, ev, flat) {
    const i = flat.findIndex((e) => e.id === ev.id);
    if (i < 0 || flat.length < 4) return null;

    const pairAt = (n) => ({
      before: neighborLabel(flat[n - 1]),
      after: neighborLabel(flat[n + 1])
    });

    const correct = pairAt(i);
    const seen = new Set([i]);
    const wrong = [];
    const spots = K.util.shuffle(flat.map((_, n) => n).filter((n) => n !== i));

    for (const n of spots) {
      if (wrong.length >= 3) break;
      if (Math.abs(n - i) < 1) continue;
      const p = pairAt(n);
      if (!p.before && !p.after) continue;
      const sig = (p.before ? p.before.id : '-') + '/' + (p.after ? p.after.id : '-');
      if (seen.has(sig)) continue;
      seen.add(sig);
      wrong.push(p);
    }
    if (wrong.length < 2) return null;

    const options = K.util.shuffle([correct].concat(wrong));
    return {
      kind: KINDS.ORDER,
      ev: ev,
      text: '<span class="subject">' + K.util.esc(ev.title) + '</span> hangi iki olay arasında oldu?',
      options: options,
      correctIndex: options.indexOf(correct),
      render: (o) => {
        const b = o.before ? K.util.esc(o.before.title) : 'en başta';
        const a = o.after ? K.util.esc(o.after.title) : 'en sonda';
        if (!o.before) return '<span class="between"><span class="arrow">↑</span> en başta, <b>' + a + '</b>\'dan önce</span>';
        if (!o.after) return '<span class="between"><b>' + b + '</b>\'dan sonra, <span class="arrow">↓</span> en sonda</span>';
        return '<span class="between"><b>' + b + '</b><span class="arrow">→</span><b>' + a + '</b></span>';
      }
    };
  }

  function buildDateQuestion(db, ev, flat) {
    if (!ev.start) return null;
    const correct = K.model.fmtEvent(ev);

    const pool = flat.filter((e) => e.id !== ev.id && e.start)
      .map((e) => K.model.fmtEvent(e));

    // Sahte şıklar, doğru cevapla aynı biçimde olmalı: tek "yıl" şıkkının
    // arasında durduğu bir soru kendini ele verir.
    const made = [];
    const shift = (dt, dy, dm) => {
      if (!dt) return null;
      let m = dt.m ? dt.m + (dm || 0) : dt.m;
      let y = dt.y + (dy || 0);
      if (m != null) { while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } }
      return { y: y, m: m, d: dt.d };
    };
    const variants = ev.start.m
      ? [[1, 0], [-1, 0], [2, 0], [-2, 0], [0, 1], [0, -1], [0, 2], [3, 0], [-3, 0]]
      : [[1, 0], [-1, 0], [2, 0], [-2, 0], [3, 0], [-3, 0], [5, 0], [-5, 0], [10, 0]];
    variants.forEach((v) => {
      const s2 = shift(ev.start, v[0], v[1]);
      if (!s2 || s2.y < 1) return;
      const e2 = ev.end ? shift(ev.end, v[0], v[1]) : null;
      made.push((ev.approx ? '~' : '') + K.model.fmtRange(s2, e2));
    });

    const seen = new Set([correct]);
    const wrong = [];
    for (const cand of K.util.shuffle(made).concat(K.util.shuffle(pool))) {
      if (wrong.length >= 3) break;
      if (seen.has(cand)) continue;
      seen.add(cand);
      wrong.push(cand);
    }
    if (wrong.length < 3) return null;

    const options = K.util.shuffle([correct].concat(wrong));
    return {
      kind: KINDS.DATE,
      ev: ev,
      text: '<span class="subject">' + K.util.esc(ev.title) + '</span> ne zaman oldu?',
      options: options,
      correctIndex: options.indexOf(correct),
      render: (o) => '<span class="mono">' + K.util.esc(o) + '</span>'
    };
  }

  function buildAfterQuestion(db, ev, flat) {
    if (!ev.after) return null;
    const correct = ev.after;

    const pool = flat.filter((e) => e.id !== ev.id && e.after).map((e) => e.after);
    const seen = { };
    seen[correct] = true;
    const wrong = [];
    for (const cand of K.util.shuffle(pool)) {
      if (wrong.length >= 3) break;
      if (seen[cand]) continue;
      seen[cand] = true;
      wrong.push(cand);
    }
    if (wrong.length < 3) return null;

    const options = K.util.shuffle([correct].concat(wrong));
    return {
      kind: KINDS.AFTER,
      ev: ev,
      text: '<span class="subject">' + K.util.esc(ev.title) + '</span> sonucunda ne oldu?',
      options: options,
      correctIndex: options.indexOf(correct),
      render: (o) => K.util.esc(o)
    };
  }

  /* Bir seans: en fazla 20 soru, zayıflar önde. */
  function buildSession(db) {
    const flat = K.model.cards(db);
    const items = dueItems(db);
    const qs = [];
    const used = new Set();

    for (const it of items) {
      if (qs.length >= SESSION_MAX) break;
      const sig = it.ev.id + '|' + it.kind;
      if (used.has(sig)) continue;
      const q = it.kind === KINDS.ORDER ? buildOrderQuestion(db, it.ev, flat)
        : it.kind === KINDS.AFTER ? buildAfterQuestion(db, it.ev, flat)
        : it.kind === KINDS.START ? buildStartQuestion(db, it.ev, flat)
        : buildDateQuestion(db, it.ev, flat);
      if (!q) continue;
      used.add(sig);
      qs.push(q);
    }
    // Seçim zayıftan güçlüye, ama soruluş sırası karışık: liste sırasına göre
    // gelen sorular ezberi sahteleştiriyor.
    return K.util.shuffle(qs);
  }

  return { KINDS, INTERVALS, SESSION_MAX, rec, levelOf, record, dueItems, dueCount, buildSession };
})();
