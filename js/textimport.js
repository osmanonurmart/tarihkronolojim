window.K = window.K || {};

/* Metinden olay okuma.

   İki tür metni de kabul eder: uygulamanın kendi "Metni kopyala" çıktısını
   (girintiler, gruplar, kapsamlar, sonuç satırları dahil) ve elle ya da yapay
   zekaya yazdırılmış düz listeleri. Amaç, kopyala–kontrol ettir–geri yapıştır
   döngüsünün kapanması. */
K.textimport = (function () {
  const MONTHS = {};
  K.model.MONTHS.forEach((m, i) => { MONTHS[m.toLocaleLowerCase('tr')] = i + 1; });
  K.model.MONTHS_LONG.forEach((m, i) => { MONTHS[m.toLocaleLowerCase('tr')] = i + 1; });

  const month = (w) => MONTHS[String(w).toLocaleLowerCase('tr')] || null;
  const SEP = /^\s*(?:[-–—:]|\t|\s{2,})\s*/;

  /* Satırın başındaki tarihi tanır. Sırası önemli: uzun kalıplar önce. */
  function matchDate(text) {
    let s = text;
    const approx = /^~/.test(s.trim());
    s = s.trim().replace(/^~\s*/, '');
    let m;

    // 23 Ağu - 13 Eyl 1921
    m = s.match(/^(\d{1,2})\s+(\p{L}+)\s*[-–]\s*(\d{1,2})\s+(\p{L}+)\s+(\d{3,4})/u);
    if (m && month(m[2]) && month(m[4])) {
      return done(m[0], approx,
        { y: +m[5], m: month(m[2]), d: +m[1] },
        { y: +m[5], m: month(m[4]), d: +m[3] });
    }

    // 23-31 Mar 1921
    m = s.match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})\s+(\p{L}+)\s+(\d{3,4})/u);
    if (m && month(m[3])) {
      return done(m[0], approx,
        { y: +m[4], m: month(m[3]), d: +m[1] },
        { y: +m[4], m: month(m[3]), d: +m[2] });
    }

    // 19 May 1919
    m = s.match(/^(\d{1,2})\s+(\p{L}+)\s+(\d{3,4})/u);
    if (m && month(m[2])) return done(m[0], approx, { y: +m[3], m: month(m[2]), d: +m[1] }, null);

    // 19.05.1919
    m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{3,4})/);
    if (m) return done(m[0], approx, { y: +m[3], m: +m[2], d: +m[1] }, null);

    // 1919-22 · 1919-1922
    m = s.match(/^(\d{3,4})\s*[-–]\s*(\d{2,4})(?!\d)/);
    if (m) {
      const from = +m[1];
      let to = +m[2];
      if (m[2].length < String(from).length) {                 // 1919-22
        to = +(String(from).slice(0, String(from).length - m[2].length) + m[2]);
      }
      return done(m[0], approx, { y: from, m: null, d: null }, { y: to, m: null, d: null });
    }

    // May 1919
    m = s.match(/^(\p{L}+)\s+(\d{3,4})/u);
    if (m && month(m[1])) return done(m[0], approx, { y: +m[2], m: month(m[1]), d: null }, null);

    // 1071
    m = s.match(/^(\d{3,4})(?!\d)/);
    if (m) return done(m[0], approx, { y: +m[1], m: null, d: null }, null);

    return null;

    function done(matched, isApprox, start, end) {
      return { matched: matched, approx: isApprox, start: start, end: end };
    }
  }

  /* Tarih başta yoksa sonda olabilir: "II. Meşrutiyet 1908" */
  function splitDate(line) {
    const head = matchDate(line);
    if (head) {
      let rest = line.trim().replace(/^~\s*/, '').slice(head.matched.length);
      rest = rest.replace(SEP, '').trim();
      if (rest) return { date: head, title: rest };
    }
    const tail = line.match(/^(.*?)[\s(,-]+(~?\s*\d{3,4}(?:\s*[-–]\s*\d{2,4})?)\)?\s*$/);
    if (tail && tail[1].trim() && !/^\d/.test(tail[1].trim())) {
      const d = matchDate(tail[2]);
      if (d) return { date: d, title: tail[1].trim().replace(/[\s,-]+$/, '') };
    }
    return { date: null, title: line.trim() };
  }

  function parse(text) {
    const result = { events: [], groups: [], skipped: 0 };
    const spans = [];                 // { indent, id } kapsam yığını
    let group = null;                 // { indent, id }
    let last = null;
    let order = 1000;

    String(text).split(/\r?\n/).forEach((raw) => {
      if (!raw.trim()) return;
      const indent = raw.replace(/\t/g, '  ').match(/^ */)[0].length;
      let line = raw.trim();

      if (line[0] === '#' || /^[-–—_=]{3,}$/.test(line)) return;

      // Sonuç satırı: bir önceki olaya iliştirilir.
      const after = line.match(/^(?:↳|->|=>|»)\s*(?:sonucunda|sonuç|ardından)\s*[:：]?\s*(.+)$/i);
      if (after) {
        if (last) last.after = after[1].trim();
        else result.skipped++;
        return;
      }

      // Yığınları girintiye göre daralt.
      while (spans.length && indent <= spans[spans.length - 1].indent) spans.pop();
      if (group && indent <= group.indent) group = null;

      // Grup satırı: [Cepheler]
      const g = line.match(/^[-*•]?\s*\[(.+?)\]/);
      if (g) {
        const rec = {
          id: K.util.uid(), name: g[1].trim(),
          parentId: spans.length ? spans[spans.length - 1].id : null,
          order: order += 10
        };
        result.groups.push(rec);
        group = { indent: indent, id: rec.id };
        last = null;
        return;
      }

      const isSpan = /\(\s*kapsam/i.test(line);
      line = line.replace(/\s*\(\s*kapsam[^)]*\)\s*/i, ' ').trim();
      // Baştaki "1." sıra numarasını at — ama "19.05.1919" gibi tarihleri değil.
      line = line.replace(/^[-*•]\s*/, '').replace(/^\d{1,2}[.)]\s+(?=\D)/, '');
      if (!line) { result.skipped++; return; }

      const parsed = splitDate(line);
      // Not, başlıktan uzun tire veya dik çizgiyle ayrılır. Düz tire ayırmaz:
      // "Meclis-i Mebusan" gibi başlıkları ikiye bölerdi.
      const bits = parsed.title.split(/\s+[—–]\s+|\s+--\s+|\s*\|\s*/);
      const title = bits[0].trim();
      if (!title) { result.skipped++; return; }

      const ev = {
        id: K.util.uid(), title: title,
        start: parsed.date ? parsed.date.start : null,
        end: parsed.date ? parsed.date.end : null,
        approx: parsed.date ? parsed.date.approx : false,
        note: bits.length > 1 ? bits.slice(1).join(' — ').trim() : '',
        after: '',
        isSpan: isSpan,
        parentId: group ? null : (spans.length ? spans[spans.length - 1].id : null),
        groupId: group ? group.id : null,
        order: order += 10
      };
      result.events.push(ev);
      last = ev;
      if (isSpan) { spans.push({ indent: indent, id: ev.id }); group = null; }
    });

    return result;
  }

  return { parse, splitDate, matchDate };
})();
