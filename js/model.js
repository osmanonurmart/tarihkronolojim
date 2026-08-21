window.K = window.K || {};

/* Olay modeli, tarih biçimleri ve ağaç kurma. */
K.model = (function () {
  const MONTHS = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const MONTHS_LONG = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
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
    if (a.y === b.y && a.m === b.m && a.d && b.d) {
      return a.d + '-' + b.d + ' ' + MONTHS[a.m - 1] + ' ' + a.y;
    }
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

  // Boş bırakılan kutular yok sayılır: hiçbiri dolu değilse olay tarihsizdir.
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

  // Kapsam artık kendiliğinden oluşmuyor: yalnızca işaretlenmiş olaylar kapsamdır.
  function isSpan(ev) { return !!(ev && ev.isSpan); }

  function depthOf(db, ev) {
    let d = 1, cur = ev, guard = 0;
    while (cur && cur.parentId && guard++ < 10) {
      cur = db.events.find((e) => e.id === cur.parentId);
      if (cur) d++;
    }
    return d;
  }

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

  /* ---- Sıra numaraları ---- */
  function orderBetween(before, after) {
    if (before == null && after == null) return 1000;
    if (before == null) return after - 1;
    if (after == null) return before + 1;
    return (before + after) / 2;
  }

  function orderForDate(db, ev) {
    const siblings = childrenOf(db, ev.parentId);
    if (!ev.start) {
      const rest = siblings.filter((n) => !n.ev || n.ev.id !== ev.id);
      return rest.length ? rest[rest.length - 1].order + 1 : 1000;
    }
    const dated = siblings.filter((n) => n.t === 'ev' && n.ev.id !== ev.id && n.ev.start);
    const k = key(ev.start);
    let before = null, after = null;
    for (const n of dated) {
      if (key(n.ev.start) <= k) before = n.order;
      else { after = n.order; break; }
    }
    return orderBetween(before, after);
  }

  // Kapsam kutusunda gösterilecek olanlar: kendisi ve altındakiler hariç.
  function spanOptions(db, ev) {
    return listEvents(db).filter((s) => {
      if (!isSpan(s)) return false;
      if (ev && (s.id === ev.id || isDescendant(db, s.id, ev.id))) return false;
      return depthOf(db, s) < MAX_DEPTH;
    });
  }

  function isDescendant(db, candidateId, ancestorId) {
    let cur = byId(db, candidateId), guard = 0;
    while (cur && guard++ < 20) {
      if (cur.id === ancestorId) return true;
      cur = cur.parentId ? byId(db, cur.parentId) : null;
    }
    return false;
  }

  // Bütün ağacı, göründüğü sırayla düz bir olay dizisine çevirir.
  function flatten(db, parentId) {
    const out = [];
    for (const node of childrenOf(db, parentId === undefined ? null : parentId)) {
      if (node.t === 'gr') {
        eventsOfGroup(db, node.gr.id).forEach((e) => out.push(e));
        continue;
      }
      out.push(node.ev);
      if (isSpan(node.ev)) flatten(db, node.ev.id).forEach((e) => out.push(e));
    }
    return out;
  }

  function byId(db, id) { return db.events.find((e) => e.id === id) || null; }

  function blank(listId) {
    return {
      id: K.util.uid(), listId: listId, title: '',
      start: null, end: null, approx: false,
      note: '', after: '',
      isSpan: false, parentId: null, groupId: null, order: 1000
    };
  }

  return {
    MONTHS, MONTHS_LONG, MAX_DEPTH, key, fmtOne, fmtRange, fmtEvent, parseDate,
    listEvents, listGroups, isSpan, depthOf, childrenOf, eventsOfGroup,
    orderBetween, orderForDate, spanOptions, isDescendant, flatten, byId, blank
  };
})();
