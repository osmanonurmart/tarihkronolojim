window.K = window.K || {};

/* Alt panel altyapısı. Panel açıkken arkadaki liste kilitlenir — yoksa
   panelin kaydırması sonuna gelince sayfaya devrediliyor. */
K.sheet = (function () {
  let lockedAt = 0;

  function lock() {
    lockedAt = window.scrollY || 0;
    document.body.style.position = 'fixed';
    document.body.style.top = -lockedAt + 'px';
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
  }

  function unlock() {
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.left = '';
    document.body.style.right = '';
    document.body.style.width = '';
    window.scrollTo(0, lockedAt);
  }

  function close() {
    const host = document.getElementById('sheet-host');
    if (!host.innerHTML) return;
    host.innerHTML = '';
    unlock();
  }

  function open(html, bind) {
    const host = document.getElementById('sheet-host');
    const wasOpen = !!host.innerHTML;
    host.innerHTML =
      '<div class="scrim" data-sheet-close></div>' +
      '<div class="sheet" role="dialog" aria-modal="true">' +
        '<button class="sheet-x" data-sheet-close aria-label="Kapat">✕</button>' +
        '<div class="sheet-grip"></div>' + html +
      '</div>';
    if (!wasOpen) lock();
    Array.prototype.forEach.call(host.querySelectorAll('[data-sheet-close]'),
      (el) => el.addEventListener('click', close));
    if (bind) bind(host.querySelector('.sheet'));
  }

  return { open, close, isOpen: () => !!document.querySelector('.sheet') };
})();

/* Olay düzenleyici */
K.editor = (function () {
  const esc = K.util.esc;

  function monthOptions(m) {
    return '<option value="">Ay</option>' + K.model.MONTHS_LONG.map((n, i) =>
      '<option value="' + (i + 1) + '"' + (m === i + 1 ? ' selected' : '') + '>' + n + '</option>').join('');
  }

  // Tarih hep gün / ay / yıl olarak sorulur; boş bırakılanlar yok sayılır.
  function dateRow(prefix, dt) {
    const y = dt ? dt.y : '', m = dt && dt.m ? dt.m : '', d = dt && dt.d ? dt.d : '';
    return '<div class="row date-row">' +
      '<input type="number" inputmode="numeric" id="' + prefix + 'd" placeholder="Gün" value="' + esc(d) + '">' +
      '<select id="' + prefix + 'm">' + monthOptions(m) + '</select>' +
      '<input type="number" inputmode="numeric" id="' + prefix + 'y" placeholder="Yıl" value="' + esc(y) + '">' +
    '</div>';
  }

  function pickerOptions(items, selected, newLabel) {
    return '<option value="">— yok —</option>' +
      '<option value="__new">' + newLabel + '</option>' +
      (items.length ? '<option disabled>──────────</option>' : '') +
      items.map((x) => '<option value="' + x.id + '"' + (selected === x.id ? ' selected' : '') + '>' +
        esc(x.title || x.name) + '</option>').join('');
  }

  function form(db, ev, isNew) {
    const spans = K.model.spanOptions(db, isNew ? null : ev);
    const groups = K.model.listGroups(db);

    return '' +
    '<h2>' + (isNew ? 'Yeni olay' : 'Olayı düzenle') + '</h2>' +

    '<div class="field">' +
      '<label for="f-title">Başlık</label>' +
      '<input type="text" id="f-title" value="' + esc(ev.title) + '" placeholder="Malazgirt Savaşı" autocomplete="off">' +
    '</div>' +

    '<div class="field">' +
      '<label>Tarih</label>' +
      dateRow('f-s', ev.start) +
      '<label class="check"><input type="checkbox" id="f-approx" ' + (ev.approx ? 'checked' : '') + '> Yaklaşık tarih (~)</label>' +
      '<label class="check"><input type="checkbox" id="f-range" ' + (ev.end ? 'checked' : '') + '> Bir aralık (başlangıç–bitiş)</label>' +
      '<div id="f-end">' + (ev.end ? dateRow('f-e', ev.end) : '') + '</div>' +
      '<div class="hint">Boş bırakırsan tarihsiz olur — listede elle taşırsın.</div>' +
    '</div>' +

    '<div class="field">' +
      '<label for="f-note">Not</label>' +
      '<textarea id="f-note" placeholder="Anadolu\'nun kapıları açıldı">' + esc(ev.note) + '</textarea>' +
    '</div>' +

    '<div class="field">' +
      '<label for="f-after">Sonucunda</label>' +
      '<input type="text" id="f-after" value="' + esc(ev.after) + '" placeholder="İsmet Bey Dışişleri Bakanı oldu" autocomplete="off">' +
      '<div class="hint">Kartın altında görünür, çalışırken de sorulur.</div>' +
    '</div>' +

    '<div class="row" style="margin-bottom:.85rem">' +
      '<div class="field" style="margin:0">' +
        '<label for="f-parent">Kapsam</label>' +
        '<select id="f-parent">' + pickerOptions(spans, ev.parentId, '+ Yeni kapsam…') + '</select>' +
        '<div id="f-newspan"></div>' +
      '</div>' +
      '<div class="field" style="margin:0">' +
        '<label for="f-group">Grup</label>' +
        '<select id="f-group">' + pickerOptions(groups, ev.groupId, '+ Yeni grup…') + '</select>' +
        '<div id="f-newgroup"></div>' +
      '</div>' +
    '</div>' +

    (isNew || !K.model.isSpan(ev) ? '' :
      '<div class="hint" style="margin-bottom:.6rem">Bu olay bir kapsam — listede soldaki parantez olarak görünüyor.</div>') +

    '<div class="sheet-actions">' +
      (isNew ? '' : '<button class="btn danger" id="f-del" type="button">Sil</button>') +
      '<button class="btn primary grow" id="f-save" type="button">Kaydet</button>' +
    '</div>';
  }

  function open(evId, preset) {
    const db = K.store.get();
    const existing = evId ? K.model.byId(db, evId) : null;
    const isNew = !existing;
    preset = preset || {};

    const ev = existing || Object.assign(K.model.blank(db.ui.listId), {
      parentId: preset.parent || null,
      groupId: preset.group || null
    });

    K.sheet.open(form(db, ev, isNew), function (root) {
      const $ = (sel) => root.querySelector(sel);

      function readDate(prefix) {
        const y = $('#' + prefix + 'y');
        if (!y) return null;
        const m = $('#' + prefix + 'm'), d = $('#' + prefix + 'd');
        return K.model.parseDate(y.value, m ? m.value : null, d ? d.value : null);
      }

      $('#f-range').addEventListener('change', (e) => {
        $('#f-end').innerHTML = e.target.checked ? dateRow('f-e', null) : '';
      });

      /* Yeni kapsam / grup, panelden çıkmadan burada oluşturuluyor —
         yarım kalan form kaybolmasın diye ayrı bir ekran açmıyoruz. */
      function inlineCreate(selectId, boxId, fields, onCreate) {
        const sel = $('#' + selectId), box = $('#' + boxId);
        sel.addEventListener('change', () => {
          if (sel.value !== '__new') { box.innerHTML = ''; return; }
          box.innerHTML = '<div class="inline-new">' + fields +
            '<button class="btn small primary" type="button" data-create>Oluştur</button></div>';
          const first = box.querySelector('input');
          if (first) first.focus();
          box.querySelector('[data-create]').addEventListener('click', () => {
            const made = onCreate(box);
            if (!made) return;
            const opt = document.createElement('option');
            opt.value = made.id;
            opt.textContent = made.title || made.name;
            sel.appendChild(opt);
            sel.value = made.id;
            box.innerHTML = '';
          });
        });
      }

      inlineCreate('f-parent', 'f-newspan',
        '<input type="text" data-name placeholder="Kapsam adı" autocomplete="off">' +
        '<div class="row"><input type="number" inputmode="numeric" data-from placeholder="Başlangıç yılı">' +
        '<input type="number" inputmode="numeric" data-to placeholder="Bitiş yılı"></div>',
        (box) => {
          const name = box.querySelector('[data-name]').value.trim();
          const from = parseInt(box.querySelector('[data-from]').value, 10);
          const to = parseInt(box.querySelector('[data-to]').value, 10);
          if (!name) { K.util.toast('Kapsam adı gerekli.'); return null; }
          if (!from) { K.util.toast('Başlangıç yılı gerekli.'); return null; }
          if (to && to < from) { K.util.toast('Bitiş, başlangıçtan önce olamaz.'); return null; }

          const span = Object.assign(K.model.blank(db.ui.listId), {
            title: name,
            start: { y: from, m: null, d: null },
            end: to ? { y: to, m: null, d: null } : null,
            isSpan: true
          });
          const ok = K.store.mutate((d) => {
            span.order = K.model.orderForDate(d, span);
            d.events.push(span);
          }, { action: 'kapsam eklendi', title: name });
          return ok ? span : null;
        });

      inlineCreate('f-group', 'f-newgroup',
        '<input type="text" data-name placeholder="Grup adı" autocomplete="off">',
        (box) => {
          const name = box.querySelector('[data-name]').value.trim();
          if (!name) { K.util.toast('Grup adı gerekli.'); return null; }
          const group = {
            id: K.util.uid(), listId: db.ui.listId, name: name,
            parentId: $('#f-parent').value && $('#f-parent').value !== '__new' ? $('#f-parent').value : null,
            order: 0
          };
          const ok = K.store.mutate((d) => {
            const siblings = K.model.childrenOf(d, group.parentId);
            group.order = siblings.length ? siblings[siblings.length - 1].order + 1 : 1000;
            d.groups.push(group);
          }, { action: 'grup eklendi', title: name });
          return ok ? group : null;
        });

      if ($('#f-del')) $('#f-del').addEventListener('click', () => {
        const title = existing.title;
        const ok = K.store.mutate((d) => {
          d.events = d.events.filter((e) => e.id !== existing.id);
          d.events.forEach((e) => { if (e.parentId === existing.id) e.parentId = null; });
          d.groups.forEach((g) => { if (g.parentId === existing.id) g.parentId = null; });
        }, { action: 'silindi', title: title });
        if (!ok) return;
        K.sheet.close();
        K.util.toast('Silindi', 'Geri al', () => K.store.undo());
      });

      $('#f-save').addEventListener('click', () => {
        const title = $('#f-title').value.trim();
        if (!title) { $('#f-title').focus(); K.util.toast('Başlık gerekli.'); return; }

        const start = readDate('f-s');
        const end = ($('#f-range').checked && start) ? readDate('f-e') : null;
        if (end && K.model.key(end) < K.model.key(start)) {
          K.util.toast('Bitiş, başlangıçtan önce olamaz.'); return;
        }

        const groupId = pick($('#f-group'));
        const parentId = groupId ? null : pick($('#f-parent'));
        const fields = {
          title: title, start: start, end: end,
          approx: $('#f-approx').checked && !!start,
          note: $('#f-note').value.trim(),
          after: $('#f-after').value.trim(),
          groupId: groupId, parentId: parentId
        };

        const ok = K.store.mutate((d) => {
          if (existing) {
            Object.assign(K.model.byId(d, existing.id), fields);
            return;
          }
          const fresh = Object.assign(K.model.blank(d.ui.listId), fields);
          if (preset.order != null) fresh.order = preset.order;
          else if (groupId) {
            const last = K.model.eventsOfGroup(d, groupId).slice(-1)[0];
            fresh.order = last ? last.order + 1 : 1000;
          } else {
            d.events.push(fresh);
            fresh.order = K.model.orderForDate(d, fresh);
            d.events.pop();
          }
          d.events.push(fresh);
        }, { action: existing ? 'değiştirildi' : 'eklendi', title: title });

        if (ok) K.sheet.close();
      });

      function pick(sel) {
        return sel.value && sel.value !== '__new' ? sel.value : null;
      }
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
        '<button class="btn primary grow" id="g-save" type="button">Kaydet</button>' +
      '</div>',
      function (root) {
        root.querySelector('#g-save').addEventListener('click', () => {
          const name = root.querySelector('#g-name').value.trim();
          if (!name) return;
          if (K.store.mutate((d) => { d.groups.find((x) => x.id === gid).name = name; },
                             { action: 'grup değiştirildi', title: name })) K.sheet.close();
        });
        root.querySelector('#g-del').addEventListener('click', () => {
          const ok = K.store.mutate((d) => {
            const grp = d.groups.find((x) => x.id === gid);
            d.events.forEach((e) => {
              if (e.groupId === gid) { e.groupId = null; e.parentId = grp ? grp.parentId : null; }
            });
            d.groups = d.groups.filter((x) => x.id !== gid);
          }, { action: 'grup silindi', title: g.name });
          if (!ok) return;
          K.sheet.close();
          K.util.toast('Grup silindi', 'Geri al', () => K.store.undo());
        });
      }
    );
  }

  return { open, openGroup };
})();
