window.K = window.K || {};

/* Alt panel altyapısı */
K.sheet = (function () {
  let onClose = null;

  function close() {
    const host = document.getElementById('sheet-host');
    host.innerHTML = '';
    if (onClose) { const f = onClose; onClose = null; f(); }
  }

  function open(html, bind, closed) {
    const host = document.getElementById('sheet-host');
    onClose = closed || null;
    host.innerHTML = '<div class="scrim" data-sheet-close></div><div class="sheet" role="dialog" aria-modal="true">' +
      '<div class="sheet-grip"></div>' + html + '</div>';
    host.querySelector('[data-sheet-close]').addEventListener('click', close);
    const first = host.querySelector('input, textarea, select, button.primary');
    if (first && first.tagName !== 'BUTTON') setTimeout(() => first.focus(), 60);
    if (bind) bind(host.querySelector('.sheet'));
  }

  return { open, close, isOpen: () => !!document.querySelector('.sheet') };
})();

/* Olay düzenleyici */
K.editor = (function () {
  const esc = K.util.esc;

  function isDescendant(db, candidateId, ancestorId) {
    let cur = K.model.byId(db, candidateId), guard = 0;
    while (cur && guard++ < 20) {
      if (cur.id === ancestorId) return true;
      cur = cur.parentId ? K.model.byId(db, cur.parentId) : null;
    }
    return false;
  }

  function spanOptions(db, ev) {
    return K.model.listEvents(db).filter((e) => {
      if (!e.end) return false;
      if (ev && (e.id === ev.id || isDescendant(db, e.id, ev.id))) return false;
      return K.model.depthOf(db, e) < K.model.MAX_DEPTH;
    });
  }

  function dateFields(prefix, dt, kind) {
    const y = dt ? dt.y : '';
    const m = dt && dt.m ? dt.m : '';
    const d = dt && dt.d ? dt.d : '';
    if (kind === 'none') return '';
    if (kind === 'year') {
      return '<input type="number" inputmode="numeric" id="' + prefix + 'y" placeholder="Yıl" value="' + esc(y) + '">';
    }
    return '<div class="row">' +
      '<input type="number" inputmode="numeric" id="' + prefix + 'd" placeholder="Gün" value="' + esc(d) + '">' +
      '<select id="' + prefix + 'm">' +
        '<option value="">Ay</option>' +
        K.model.MONTHS.map((n, i) =>
          '<option value="' + (i + 1) + '"' + (m === i + 1 ? ' selected' : '') + '>' + n + '</option>').join('') +
      '</select>' +
      '<input type="number" inputmode="numeric" id="' + prefix + 'y" placeholder="Yıl" value="' + esc(y) + '">' +
    '</div>';
  }

  function form(db, ev, preset) {
    const isNew = !ev;
    ev = ev || {
      title: '', start: null, end: null, approx: false, note: '', tags: [],
      parentId: preset.parent || null, groupId: preset.group || null, linkFrom: []
    };
    const kind = !ev.start ? 'none' : (ev.start.m ? 'full' : 'year');
    const hasRange = !!ev.end;

    const spans = spanOptions(db, isNew ? null : ev);
    const groups = K.model.listGroups(db);
    const others = K.model.listEvents(db).filter((e) => e.id !== ev.id);

    return '' +
    '<h2>' + (isNew ? 'Yeni olay' : 'Olayı düzenle') + '</h2>' +

    '<div class="field">' +
      '<label for="f-title">Başlık</label>' +
      '<input type="text" id="f-title" value="' + esc(ev.title) + '" placeholder="Malazgirt Savaşı" autocomplete="off">' +
    '</div>' +

    '<div class="field">' +
      '<label>Tarih</label>' +
      '<div class="seg" id="f-kind">' +
        '<button type="button" data-kind="none" class="' + (kind === 'none' ? 'on' : '') + '">Yok</button>' +
        '<button type="button" data-kind="year" class="' + (kind === 'year' ? 'on' : '') + '">Yıl</button>' +
        '<button type="button" data-kind="full" class="' + (kind === 'full' ? 'on' : '') + '">Tam tarih</button>' +
      '</div>' +
      '<div id="f-date">' + dateFields('f-s', ev.start, kind) + '</div>' +
      '<div id="f-extra">' +
        (kind === 'none' ? '' :
          '<label class="check"><input type="checkbox" id="f-range" ' + (hasRange ? 'checked' : '') + '> Bir aralık (başlangıç–bitiş)</label>' +
          '<div id="f-end">' + (hasRange ? dateFields('f-e', ev.end, kind) : '') + '</div>' +
          '<label class="check"><input type="checkbox" id="f-approx" ' + (ev.approx ? 'checked' : '') + '> Yaklaşık tarih (~)</label>') +
      '</div>' +
      '<div class="hint">Tarihi yoksa sadece sırası önemli demektir — listede elle taşırsın.</div>' +
    '</div>' +

    '<div class="field">' +
      '<label for="f-note">Not</label>' +
      '<textarea id="f-note" placeholder="Anadolu\'nun kapıları açıldı">' + esc(ev.note) + '</textarea>' +
    '</div>' +

    '<div class="field">' +
      '<label for="f-tags">Etiketler</label>' +
      '<input type="text" id="f-tags" value="' + esc((ev.tags || []).join(', ')) + '" placeholder="savaş, antlaşma" autocomplete="off">' +
    '</div>' +

    '<div class="row" style="margin-bottom:.85rem">' +
      '<div class="field" style="margin:0">' +
        '<label for="f-parent">Kapsam</label>' +
        '<select id="f-parent">' +
          '<option value="">— yok —</option>' +
          spans.map((s) => '<option value="' + s.id + '"' + (ev.parentId === s.id ? ' selected' : '') + '>' + esc(s.title) + '</option>').join('') +
        '</select>' +
      '</div>' +
      '<div class="field" style="margin:0">' +
        '<label for="f-group">Grup</label>' +
        '<select id="f-group">' +
          '<option value="">— yok —</option>' +
          groups.map((g) => '<option value="' + g.id + '"' + (ev.groupId === g.id ? ' selected' : '') + '>' + esc(g.name) + '</option>').join('') +
          '<option value="__new">+ Yeni grup…</option>' +
        '</select>' +
      '</div>' +
    '</div>' +

    '<div class="field">' +
      '<label>Şu olayların ardından</label>' +
      '<input type="text" id="f-linkq" placeholder="Ara…" autocomplete="off">' +
      '<div id="f-links" style="max-height:9rem;overflow-y:auto;display:flex;flex-direction:column;gap:.15rem">' +
        others.map((o) =>
          '<label class="check" data-title="' + esc(o.title.toLocaleLowerCase('tr')) + '">' +
            '<input type="checkbox" value="' + o.id + '" ' + ((ev.linkFrom || []).indexOf(o.id) >= 0 ? 'checked' : '') + '> ' +
            esc(o.title) + '</label>').join('') +
      '</div>' +
      (others.length ? '' : '<div class="hint">Henüz başka olay yok.</div>') +
    '</div>' +

    (isNew ? '' :
      '<button class="btn small" id="f-replace" type="button">Tarihe göre yerine koy</button>') +

    '<div class="sheet-actions">' +
      (isNew ? '' : '<button class="btn danger" id="f-del" type="button">Sil</button>') +
      '<button class="btn grow" data-sheet-cancel type="button">Vazgeç</button>' +
      '<button class="btn primary grow" id="f-save" type="button">Kaydet</button>' +
    '</div>';
  }

  function open(evId, preset) {
    const db = K.store.get();
    const ev = evId ? K.model.byId(db, evId) : null;
    preset = preset || {};
    let kind = !ev ? 'none' : (!ev.start ? 'none' : (ev.start.m ? 'full' : 'year'));

    K.sheet.open(form(db, ev, preset), function (root) {
      const $ = (sel) => root.querySelector(sel);

      function redrawDates() {
        $('#f-date').innerHTML = dateFields('f-s', readDate('f-s'), kind);
        const rangeOn = $('#f-range') && $('#f-range').checked;
        const prevEnd = readDate('f-e');
        $('#f-extra').innerHTML = kind === 'none' ? '' :
          '<label class="check"><input type="checkbox" id="f-range" ' + (rangeOn ? 'checked' : '') + '> Bir aralık (başlangıç–bitiş)</label>' +
          '<div id="f-end">' + (rangeOn ? dateFields('f-e', prevEnd, kind) : '') + '</div>' +
          '<label class="check"><input type="checkbox" id="f-approx" ' + (approx ? 'checked' : '') + '> Yaklaşık tarih (~)</label>';
      }

      let approx = ev ? !!ev.approx : false;

      function readDate(prefix) {
        const y = $('#' + prefix + 'y'), m = $('#' + prefix + 'm'), d = $('#' + prefix + 'd');
        if (!y) return null;
        return K.model.parseDate(y.value, m ? m.value : null, d ? d.value : null);
      }

      $('#f-kind').addEventListener('click', (e) => {
        const b = e.target.closest('[data-kind]');
        if (!b) return;
        kind = b.getAttribute('data-kind');
        Array.from($('#f-kind').children).forEach((c) => c.classList.toggle('on', c === b));
        redrawDates();
      });

      root.addEventListener('change', (e) => {
        if (e.target.id === 'f-range') {
          $('#f-end').innerHTML = e.target.checked ? dateFields('f-e', null, kind) : '';
        }
        if (e.target.id === 'f-approx') approx = e.target.checked;
        if (e.target.id === 'f-group' && e.target.value === '__new') {
          const name = prompt('Yeni grubun adı:');
          if (name && name.trim()) {
            const gid = K.util.uid();
            K.store.mutate((d) => {
              d.groups.push({
                id: gid, listId: d.ui.listId, name: name.trim(),
                parentId: $('#f-parent').value || null,
                order: (K.model.childrenOf(d, $('#f-parent').value || null).slice(-1)[0] || { order: 999 }).order + 1
              });
            });
            const sel = $('#f-group');
            const opt = document.createElement('option');
            opt.value = gid; opt.textContent = name.trim();
            sel.insertBefore(opt, sel.lastElementChild);
            sel.value = gid;
          } else {
            e.target.value = '';
          }
        }
      });

      const q = $('#f-linkq');
      if (q) q.addEventListener('input', () => {
        const needle = q.value.toLocaleLowerCase('tr');
        Array.from($('#f-links').children).forEach((lab) => {
          lab.style.display = lab.getAttribute('data-title').indexOf(needle) >= 0 ? '' : 'none';
        });
      });

      root.querySelector('[data-sheet-cancel]').addEventListener('click', K.sheet.close);

      if ($('#f-del')) $('#f-del').addEventListener('click', () => {
        if (!K.util.confirmAsk('"' + ev.title + '" silinsin mi?')) return;
        K.store.mutate((d) => {
          d.events = d.events.filter((e) => e.id !== ev.id);
          d.events.forEach((e) => {
            if (e.parentId === ev.id) e.parentId = null;
            if (e.linkFrom) e.linkFrom = e.linkFrom.filter((x) => x !== ev.id);
          });
          d.groups.forEach((g) => { if (g.parentId === ev.id) g.parentId = null; });
        });
        K.sheet.close();
        K.util.toast('Silindi', 'Geri al', () => K.store.undo());
      });

      if ($('#f-replace')) $('#f-replace').addEventListener('click', () => {
        K.store.mutate((d) => {
          const t = K.model.byId(d, ev.id);
          if (t) t.order = K.model.orderForDate(d, t);
        });
        K.util.toast('Tarihine göre yerleştirildi', 'Geri al', () => K.store.undo());
      });

      $('#f-save').addEventListener('click', () => {
        const title = $('#f-title').value.trim();
        if (!title) { $('#f-title').focus(); K.util.toast('Başlık gerekli.'); return; }

        const start = kind === 'none' ? null : readDate('f-s');
        if (kind !== 'none' && !start) { K.util.toast('Yıl gerekli.'); return; }
        const rangeOn = $('#f-range') && $('#f-range').checked;
        let end = rangeOn ? readDate('f-e') : null;
        if (end && start && K.model.key(end) < K.model.key(start)) {
          K.util.toast('Bitiş, başlangıçtan önce olamaz.'); return;
        }

        const tags = $('#f-tags').value.split(',').map((s) => s.trim()).filter(Boolean);
        const note = $('#f-note').value.trim();
        const groupId = $('#f-group').value && $('#f-group').value !== '__new' ? $('#f-group').value : null;
        const parentId = groupId ? null : ($('#f-parent').value || null);
        const linkFrom = Array.from($('#f-links').querySelectorAll('input:checked')).map((i) => i.value);

        K.store.mutate((d) => {
          if (ev) {
            const t = K.model.byId(d, ev.id);
            Object.assign(t, {
              title: title, start: start, end: end, approx: approx && !!start,
              note: note, tags: tags, groupId: groupId, parentId: parentId, linkFrom: linkFrom
            });
          } else {
            const fresh = {
              id: K.util.uid(), listId: d.ui.listId, title: title,
              start: start, end: end, approx: approx && !!start,
              note: note, tags: tags,
              parentId: parentId || (preset.parent || null),
              groupId: groupId, linkFrom: linkFrom, order: 0
            };
            if (!fresh.parentId && !fresh.groupId && start) {
              fresh.parentId = K.model.suggestParent(d, start, fresh.id);
            }
            if (preset.order != null && preset.group === (groupId || undefined)) {
              fresh.order = preset.order;
            } else if (groupId) {
              const last = K.model.eventsOfGroup(d, groupId).slice(-1)[0];
              fresh.order = last ? last.order + 1 : 1000;
            } else if (preset.order != null) {
              fresh.order = preset.order;
            } else {
              d.events.push(fresh);
              fresh.order = K.model.orderForDate(d, fresh);
              d.events.pop();
            }
            d.events.push(fresh);
          }
        });
        K.sheet.close();
      });
    });
  }

  function openGroup(gid) {
    const db = K.store.get();
    const g = db.groups.find((x) => x.id === gid);
    if (!g) return;
    K.sheet.open(
      '<h2>Grubu düzenle</h2>' +
      '<div class="field"><label for="g-name">Ad</label>' +
      '<input type="text" id="g-name" value="' + esc(g.name) + '"></div>' +
      '<div class="hint">Grup içinde tarih değil, sadece sıra önemlidir.</div>' +
      '<div class="sheet-actions">' +
        '<button class="btn danger" id="g-del" type="button">Sil</button>' +
        '<button class="btn grow" data-sheet-cancel type="button">Vazgeç</button>' +
        '<button class="btn primary grow" id="g-save" type="button">Kaydet</button>' +
      '</div>',
      function (root) {
        root.querySelector('[data-sheet-cancel]').addEventListener('click', K.sheet.close);
        root.querySelector('#g-save').addEventListener('click', () => {
          const name = root.querySelector('#g-name').value.trim();
          if (!name) return;
          K.store.mutate((d) => { d.groups.find((x) => x.id === gid).name = name; });
          K.sheet.close();
        });
        root.querySelector('#g-del').addEventListener('click', () => {
          const n = K.model.eventsOfGroup(db, gid).length;
          if (!K.util.confirmAsk('Grup silinsin mi? İçindeki ' + n + ' olay listede kalır.')) return;
          K.store.mutate((d) => {
            const grp = d.groups.find((x) => x.id === gid);
            d.events.forEach((e) => {
              if (e.groupId === gid) { e.groupId = null; e.parentId = grp ? grp.parentId : null; }
            });
            d.groups = d.groups.filter((x) => x.id !== gid);
          });
          K.sheet.close();
          K.util.toast('Grup silindi', 'Geri al', () => K.store.undo());
        });
      }
    );
  }

  return { open, openGroup };
})();
