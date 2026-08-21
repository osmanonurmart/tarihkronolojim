window.K = window.K || {};

/* Olay modeli, tarih biçimleri ve ağaç kurma. */
K.model = (function () {
  const MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const MAX_DEPTH = 3;

  /* ---- Tarih ---- */
  // Tarih {y, m|null, d|null}. Yalnız yıl olan bir tarih, aynı yılın günlü
  // tarihlerinden önce gelir — sıralamada bilinçli bir tercih.
  function key(dt) {
    if (!dt) return null;
    return dt.y * 10000 + (dt.m || 0) * 100 + (dt.d || 0);
  }

  function fmtOne(dt) {
    if (!dt) return '';
    if (dt.m && dt.d) return dt.d + ' ' + MONTHS[dt.m - 1] + ' ' + dt.y;
    if (dt.m) return MONTHS[dt.m - 1] + ' ' + dt.y;
    return String(dt.y);
  }

  function fmtRange(a, b) {
    if (!a) return '';
    if (!b) return fmtOne(a);

    // Yalnız yıl — aynı yüzyıldaysa bitiş iki hane: 1922-24
    if (!a.m && !b.m) {
      const sa = String(a.y), sb = String(b.y);
      const sameCentury = sa.length === sb.length && sa.slice(0, -2) === sb.slice(0, -2);
      return sa + '-' + (sameCentury ? sb.slice(-2) : sb);
    }
    // Aynı ay: 23-31 Mar 1921
    if (a.y === b.y && a.m === b.m && a.d && b.d) {
      return a.d + '-' + b.d + ' ' + MONTHS[a.m - 1] + ' ' + a.y;
    }
    // Aynı yıl, farklı ay: 23 Mar - 5 Nis 1921
    if (a.y === b.y && a.m && b.m) {
      const head = a.d ? a.d + ' ' + MONTHS[a.m - 1] : MONTHS[a.m - 1];
      return head + ' - ' + fmtOne(b);
    }
    return fmtOne(a) + ' - ' + fmtOne(b);
  }

  function fmtEvent(ev) {
    if (!ev.start) return '';
    return (ev.approx ? '~' : '') + fmtRange(ev.start, ev.end);
  }

  function parseDate(y, m, d) {
    y = parseInt(y, 10);
    if (!y || y < 1 || y > 9999) return null;
    m = parseInt(m, 10) || null;
    d = parseInt(d, 10) || null;
    if (m && (m < 1 || m > 12)) m = null;
    if (!m) d = null;
    if (d && (d < 1 || d > 31)) d = null;
    return { y: y, m: m, d: d };
  }

  /* ---- Ağaç ---- */
  const listEvents = (db) => db.events.filter((e) => e.listId === db.ui.listId);
  const listGroups = (db) => db.groups.filter((g) => g.listId === db.ui.listId);

  function isSpan(db, ev) {
    if (!ev.end) return false;
    return db.events.some((e) => e.parentId === ev.id) ||
           db.groups.some((g) => g.parentId === ev.id);
  }

  function canBeSpan(ev) { return !!ev.end; }

  // Bir kapsamın derinliği: kök 1, içindeki kapsam 2 …
  function depthOf(db, ev) {
    let d = 1, cur = ev, guard = 0;
    while (cur && cur.parentId && guard++ < 10) {
      cur = db.events.find((e) => e.id === cur.parentId);
      if (cur) d++;
    }
    return d;
  }

  // Bir kabın (kök, kapsam ya da grup) doğrudan çocukları, sıraya dizili.
  function childrenOf(db, parentId) {
    const evs = listEvents(db).filter((e) => e.parentId === parentId && !e.groupId);
    const grs = listGroups(db).filter((g) => g.parentId === parentId);
    const nodes = evs.map((e) => ({ t: 'ev', order: e.order, ev: e }))
      .concat(grs.map((g) => ({ t: 'gr', order: g.order, gr: g })));
    return nodes.sort((a, b) => a.order - b.order);
  }

  function eventsOfGroup(db, groupId) {
    return listEvents(db).filter((e) => e.groupId === groupId)
      .sort((a, b) => a.order - b.order);
  }

  // Sonuç kutusu: kaynağı olan ve tarihi olmayan olaylar kendi akışlarında
  // değil, kaynaklarının altında görünür.
  function isAttached(ev) {
    return ev.linkFrom && ev.linkFrom.length > 0 && !ev.start;
  }

  // Birden çok kaynağı olan bir sonuç, listede yalnızca en sondaki
  // kaynağının altında görünür — yoksa her kaynağın altında tekrarlanırdı.
  function anchorOf(db, ev) {
    const srcs = (ev.linkFrom || []).map((id) => byId(db, id)).filter(Boolean);
    if (!srcs.length) return null;
    return srcs.reduce((a, b) => (b.order > a.order ? b : a)).id;
  }

  function attachedTo(db, sourceId) {
    return listEvents(db).filter((e) => isAttached(e) && anchorOf(db, e) === sourceId);
  }

  /* ---- Sıra numaraları ---- */
  function orderBetween(before, after) {
    if (before == null && after == null) return 1000;
    if (before == null) return after - 1;
    if (after == null) return before + 1;
    return (before + after) / 2;
  }

  // Tarihi olan bir olayı kardeşleri arasında doğru yere yerleştirir.
  function orderForDate(db, ev) {
    const sibs = childrenOf(db, ev.parentId)
      .filter((n) => n.t === 'ev' && n.ev.id !== ev.id && n.ev.start && !isAttached(n.ev));
    if (!ev.start) {
      const last = childrenOf(db, ev.parentId).filter((n) => n.ev ? n.ev.id !== ev.id : true);
      return last.length ? last[last.length - 1].order + 1 : 1000;
    }
    const k = key(ev.start);
    let before = null, after = null;
    for (const n of sibs) {
      if (key(n.ev.start) <= k) before = n.order;
      else { after = n.order; break; }
    }
    return orderBetween(before, after);
  }

  // Tarihi olan bir olayın içine düştüğü en derin kapsamı bulur.
  function suggestParent(db, start, ignoreId) {
    if (!start) return null;
    const k = key(start);
    let best = null, bestDepth = 0;
    for (const e of listEvents(db)) {
      if (e.id === ignoreId || !e.end || !e.start) continue;
      if (k < key(e.start) || k > key(e.end)) continue;
      const d = depthOf(db, e);
      if (d >= MAX_DEPTH) continue;      // 3 seviyeden derine inmeyiz
      if (d > bestDepth) { best = e; bestDepth = d; }
    }
    return best ? best.id : null;
  }

  // Bütün ağacı, göründüğü sırayla düz bir olay dizisine çevirir.
  function flatten(db, parentId) {
    const out = [];
    for (const node of childrenOf(db, parentId === undefined ? null : parentId)) {
      if (node.t === 'gr') {
        eventsOfGroup(db, node.gr.id).forEach((e) => out.push(e));
        continue;
      }
      const ev = node.ev;
      if (isAttached(ev)) continue;      // kaynağının altında görünür
      out.push(ev);
      attachedTo(db, ev.id).forEach((a) => out.push(a));
      if (isSpan(db, ev)) flatten(db, ev.id).forEach((e) => out.push(e));
    }
    return out;
  }

  function byId(db, id) { return db.events.find((e) => e.id === id) || null; }

  return {
    MONTHS, MAX_DEPTH, key, fmtOne, fmtRange, fmtEvent, parseDate,
    listEvents, listGroups, isSpan, canBeSpan, depthOf, childrenOf, eventsOfGroup,
    isAttached, attachedTo, anchorOf, orderBetween, orderForDate, suggestParent, flatten, byId
  };
})();
