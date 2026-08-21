window.K = window.K || {};

/* Alt panel altyapısı.

   Paneller üst üste binebiliyor: her açılış bir "açıcı" işlev olarak yığına
   yazılır, geri tuşu bir öncekini yeniden çizer. Böylece Kart → Kapsam seç →
   Kapsam ekranı gidip gelirken hiçbir form kaybolmuyor.

   Panel açıkken arkadaki liste kilitlenir — yoksa panelin kaydırması sonuna
   gelince sayfaya devrediliyor. */
K.sheet = (function () {
  let stack = [];
  let lockedAt = 0;

  function lock() {
    if (document.body.style.position === 'fixed') return;
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
    stack = [];
    if (!host.innerHTML) return;
    host.innerHTML = '';
    unlock();
  }

  function back() {
    stack.pop();
    if (stack.length) stack[stack.length - 1]();
    else close();
  }

  /* Panellerin kendisi bunu çağırır; yığını show/push yönetir. */
  function open(html, bind) {
    const host = document.getElementById('sheet-host');
    const deep = stack.length > 1;
    host.innerHTML =
      '<div class="scrim" data-sheet-close></div>' +
      '<div class="sheet" role="dialog" aria-modal="true">' +
        (deep ? '<button class="sheet-back" data-sheet-back aria-label="Geri">‹</button>' : '') +
        '<button class="sheet-x" data-sheet-close aria-label="Kapat">✕</button>' +
        '<div class="sheet-grip"></div>' + html +
      '</div>';
    lock();
    Array.prototype.forEach.call(host.querySelectorAll('[data-sheet-close]'),
      (el) => el.addEventListener('click', close));
    const b = host.querySelector('[data-sheet-back]');
    if (b) b.addEventListener('click', back);
    if (bind) bind(host.querySelector('.sheet'));
  }

  function show(fn) { stack = [fn]; fn(); }
  function push(fn) { stack.push(fn); fn(); }
  function reopen() { if (stack.length) stack[stack.length - 1](); }

  return { open, show, push, back, close, reopen, isOpen: () => !!document.querySelector('.sheet') };
})();

/* Olay ve kapsam düzenleyicileri */
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

  function spanName(db, id) {
    const s = id ? K.model.byId(db, id) : null;
    return s ? s.title : '— yok —';
  }

  /* ---------- Kart ---------- */

  function open(evId, preset) {
    const db = K.store.get();
    const existing = evId ? K.model.byId(db, evId) : null;
    const isNew = !existing;
    preset = preset || {};

    // Kapsam seçimi ayrı panelde yapıldığı için form kapanıp açılırken
    // yazdıkların kaybolmasın diye taslak burada tutuluyor.
    const mine = K.editor._draftFor === (evId || 'new');
    const draft = (mine && K.editor._draft) || Object.assign(
      existing ? {
        title: existing.title, start: existing.start, end: existing.end,
        approx: existing.approx, note: existing.note, after: existing.after,
        parentId: existing.parentId, groupId: existing.groupId
      } : {
        title: '', start: null, end: null, approx: false, note: '', after: '',
        parentId: preset.parent || null, groupId: preset.group || null
      });
    K.editor._draft = null;
    K.editor._draftFor = null;

    const groups = K.model.listGroups(db);

    const html = '' +
      '<h2>' + (isNew ? 'Yeni olay' : 'Olayı düzenle') + '</h2>' +

      '<div class="field">' +
        '<label for="f-title">Başlık</label>' +
        '<input type="text" id="f-title" value="' + esc(draft.title) + '" placeholder="Malazgirt Savaşı" autocomplete="off">' +
      '</div>' +

      '<div class="field">' +
        '<label>Tarih</label>' +
        dateRow('f-s', draft.start) +
        '<label class="check"><input type="checkbox" id="f-approx" ' + (draft.approx ? 'checked' : '') + '> Yaklaşık tarih (~)</label>' +
        '<label class="check"><input type="checkbox" id="f-range" ' + (draft.end ? 'checked' : '') + '> Bir aralık (başlangıç–bitiş)</label>' +
        '<div id="f-end">' + (draft.end ? dateRow('f-e', draft.end) : '') + '</div>' +
        '<div class="hint">Boş bırakırsan tarihsiz olur — listede elle taşırsın.</div>' +
      '</div>' +

      '<div class="field">' +
        '<label for="f-note">Not</label>' +
        '<textarea id="f-note" placeholder="Anadolu\'nun kapıları açıldı">' + esc(draft.note) + '</textarea>' +
      '</div>' +

      '<div class="field">' +
        '<label for="f-after">Sonucunda</label>' +
        '<input type="text" id="f-after" value="' + esc(draft.after) + '" placeholder="İsmet Bey Dışişleri Bakanı oldu" autocomplete="off">' +
        '<div class="hint">Kartın altında görünür, çalışırken de sorulur.</div>' +
      '</div>' +

      '<div class="field">' +
        '<label>Kapsam</label>' +
        '<button class="rowbtn" id="f-parent" type="button">' +
          '<span>' + esc(spanName(db, draft.parentId)) + '</span><span class="chev">›</span>' +
        '</button>' +
      '</div>' +

      '<div class="field">' +
        '<label for="f-group">Grup</label>' +
        '<select id="f-group">' +
          '<option value="">— yok —</option>' +
          '<option value="__new">+ Yeni grup</option>' +
          (groups.length ? '<option disabled>──────────</option>' : '') +
          groups.map((g) => '<option value="' + g.id + '"' + (draft.groupId === g.id ? ' selected' : '') + '>' +
            esc(g.name) + '</option>').join('') +
        '</select>' +
        '<div id="f-newgroup"></div>' +
      '</div>' +

      '<div class="sheet-actions">' +
        (isNew ? '' : '<button class="btn danger" id="f-del" type="button">Sil</button>') +
        '<button class="btn primary grow" id="f-save" type="button">Kaydet</button>' +
      '</div>';

    K.sheet.open(html, function (root) {
      const $ = (sel) => root.querySelector(sel);

      function readDate(prefix) {
        const y = $('#' + prefix + 'y');
        if (!y) return null;
        const m = $('#' + prefix + 'm'), d = $('#' + prefix + 'd');
        return K.model.parseDate(y.value, m ? m.value : null, d ? d.value : null);
      }

      function collect() {
        const start = readDate('f-s');
        return {
          title: $('#f-title').value.trim(),
          start: start,
          end: ($('#f-range').checked && start) ? readDate('f-e') : null,
          approx: $('#f-approx').checked && !!start,
          note: $('#f-note').value.trim(),
          after: $('#f-after').value.trim(),
          parentId: draft.parentId,
          groupId: $('#f-group').value && $('#f-group').value !== '__new' ? $('#f-group').value : null
        };
      }

      $('#f-range').addEventListener('change', (e) => {
        $('#f-end').innerHTML = e.target.checked ? dateRow('f-e', null) : '';
      });

      // Kapsam seçimi ayrı panelde: taslağı saklayıp oraya geçiyoruz.
      $('#f-parent').addEventListener('click', () => {
        K.editor._draft = collect();
        K.editor._draftFor = evId || 'new';
        K.sheet.push(() => pickSpan(evId, preset));
      });

      $('#f-group').addEventListener('change', (e) => {
        const box = $('#f-newgroup');
        if (e.target.value !== '__new') { box.innerHTML = ''; return; }
        box.innerHTML = '<div class="inline-new">' +
          '<input type="text" data-name placeholder="Grup adı" autocomplete="off">' +
          '<button class="btn small primary" type="button" data-create>Oluştur</button></div>';
        box.querySelector('input').focus();
        box.querySelector('[data-create]').addEventListener('click', () => {
          const name = box.querySelector('[data-name]').value.trim();
          if (!name) { K.util.toast('Grup adı gerekli.'); return; }
          const group = { id: K.util.uid(), listId: db.ui.listId, name: name, parentId: draft.parentId, order: 0 };
          const ok = K.store.mutate((d) => {
            const sib = K.model.childrenOf(d, group.parentId);
            group.order = sib.length ? sib[sib.length - 1].order + 1 : 1000;
            d.groups.push(group);
          }, { action: 'grup eklendi', title: name });
          if (!ok) return;
          const opt = document.createElement('option');
          opt.value = group.id; opt.textContent = name;
          $('#f-group').appendChild(opt);
          $('#f-group').value = group.id;
          box.innerHTML = '';
        });
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
        const fields = collect();
        if (!fields.title) { $('#f-title').focus(); K.util.toast('Başlık gerekli.'); return; }
        if (fields.end && K.model.key(fields.end) < K.model.key(fields.start)) {
          K.util.toast('Bitiş, başlangıçtan önce olamaz.'); return;
        }
        if (fields.groupId) fields.parentId = null;

        const details = existing ? changeList(db, existing, fields) : [];
        // Hiçbir şey değişmediyse kaydetmiyoruz: kayıt defteri boş satırla dolmasın.
        if (existing && !details.length) { K.sheet.close(); return; }

        const ok = K.store.mutate((d) => {
          if (existing) {
            Object.assign(K.model.byId(d, existing.id), fields);
            return;
          }
          const fresh = Object.assign(K.model.blank(d.ui.listId), fields);
          if (preset.order != null) fresh.order = preset.order;
          else if (fields.groupId) {
            const last = K.model.eventsOfGroup(d, fields.groupId).slice(-1)[0];
            fresh.order = last ? last.order + 1 : 1000;
          } else {
            d.events.push(fresh);
            fresh.order = K.model.orderForDate(d, fresh);
            d.events.pop();
          }
          d.events.push(fresh);
        }, {
          action: existing ? 'değiştirildi' : 'eklendi',
          title: fields.title,
          details: details
        });

        if (ok) K.sheet.close();
      });
    });
  }

  /* Bir düzenlemede neyin neye döndüğü — kayıt defterinin detayı. */
  function changeList(db, before, after) {
    const out = [];
    const add = (k, a, b) => { if (a !== b) out.push({ k: k, from: a || '—', to: b || '—' }); };
    add('Başlık', before.title, after.title);
    add('Tarih', K.model.fmtEvent(before), K.model.fmtEvent(after));
    add('Not', before.note, after.note);
    add('Sonucunda', before.after, after.after);
    add('Kapsam', spanName(db, before.parentId), spanName(db, after.parentId));
    const gname = (id) => {
      const g = id ? db.groups.find((x) => x.id === id) : null;
      return g ? g.name : '— yok —';
    };
    add('Grup', gname(before.groupId), gname(after.groupId));
    return out;
  }

  /* ---------- Kapsam seçici ---------- */

  function pickSpan(evId, preset) {
    const db = K.store.get();
    const draft = K.editor._draft;
    if (!draft) { K.sheet.back(); return; }
    const spans = K.model.spanOptions(db, evId ? K.model.byId(db, evId) : null);

    function backToCard() {
      K.sheet.back();
    }

    K.sheet.open(
      '<h2>Kapsam</h2>' +
      '<div class="pick">' +
        '<button class="pick-row ' + (!draft.parentId ? 'on' : '') + '" data-pick="">— yok —</button>' +
        spans.map((s) => '<button class="pick-row ' + (draft.parentId === s.id ? 'on' : '') + '" data-pick="' + s.id + '">' +
          esc(s.title) + '</button>').join('') +
      '</div>' +
      '<button class="btn primary" id="p-new" type="button" style="margin-top:.7rem;width:100%">+ Yeni kapsam</button>',
      function (root) {
        root.addEventListener('click', (e) => {
          const b = e.target.closest('[data-pick]');
          if (!b) return;
          draft.parentId = b.getAttribute('data-pick') || null;
          K.editor._draft = draft;
          backToCard();
        });
        root.querySelector('#p-new').addEventListener('click', () => {
          K.sheet.push(() => openSpan(null, { firstId: evId }));
        });
      }
    );
  }

  /* ---------- Kapsam ekranı ---------- */

  function openSpan(spanId, opts) {
    opts = opts || {};
    const db = K.store.get();
    const existing = spanId ? K.model.byId(db, spanId) : null;

    // Seçili üyeler: varolan kapsamın içindekiler, ya da yeni kapsam için
    // buraya hangi karttan geldiysek o.
    const state = (K.editor._spanStateFor === (spanId || 'new') && K.editor._spanState) || {
      title: existing ? existing.title : '',
      parentId: existing ? existing.parentId : null,
      picked: existing
        ? K.model.membersOf(db, existing.id).map((e) => e.id)
        : (opts.firstId ? [opts.firstId] : []),
      query: ''
    };
    K.editor._spanState = null;
    K.editor._spanStateFor = null;

    // Geldiğimiz kart listenin başında dursun.
    const all = K.model.cards(db).filter((e) => !existing || e.id !== existing.id);
    if (opts.firstId) {
      const i = all.findIndex((e) => e.id === opts.firstId);
      if (i > 0) all.unshift(all.splice(i, 1)[0]);
    }

    const numbers = K.model.numbering(db);

    function rows(query) {
      const q = query.toLocaleLowerCase('tr');
      const shown = q ? all.filter((e) => e.title.toLocaleLowerCase('tr').indexOf(q) >= 0) : all;
      if (!shown.length) return '<div class="hint" style="padding:.6rem">Eşleşen kart yok.</div>';
      return shown.map((e) => {
        const on = state.picked.indexOf(e.id) >= 0;
        return '<button class="member ' + (on ? 'on' : '') + '" data-member="' + e.id + '" type="button">' +
          '<span class="box">' + (on ? '✓' : '') + '</span>' +
          '<span class="mono num">' + (numbers[e.id] || '') + '</span>' +
          '<span class="m-title">' + esc(e.title) + '</span>' +
          '<span class="mono m-date">' + esc(K.model.fmtEvent(e)) + '</span>' +
        '</button>';
      }).join('');
    }

    K.sheet.open(
      '<h2>' + (existing ? 'Kapsamı düzenle' : 'Yeni kapsam') + '</h2>' +

      '<div class="field">' +
        '<label for="s-title">Başlık</label>' +
        '<input type="text" id="s-title" value="' + esc(state.title) + '" placeholder="Kurtuluş Savaşı" autocomplete="off">' +
        '<div class="hint">Yıl sorulmuyor — önemliyse adına yazabilirsin.</div>' +
      '</div>' +

      '<div class="field">' +
        '<label>Kapsam</label>' +
        '<button class="rowbtn" id="s-parent" type="button">' +
          '<span>' + esc(spanName(db, state.parentId)) + '</span><span class="chev">›</span>' +
        '</button>' +
      '</div>' +

      '<div class="field">' +
        '<label>İçindekiler <span class="badge" id="s-count">' + state.picked.length + ' / ' + all.length + '</span></label>' +
        '<div class="memberbox">' +
          '<div class="member-search"><input type="text" id="s-q" placeholder="Ara…" autocomplete="off" value="' + esc(state.query) + '"></div>' +
          '<div class="member-list" id="s-list">' + rows(state.query) + '</div>' +
        '</div>' +
        '<div class="hint">İki kart işaretle, arasındakiler kendiliğinden girer.</div>' +
      '</div>' +

      '<div class="sheet-actions">' +
        (existing ? '<button class="btn danger" id="s-del" type="button">Sil</button>' : '') +
        '<button class="btn primary grow" id="s-save" type="button">Kaydet</button>' +
      '</div>',

      function (root) {
        const $ = (sel) => root.querySelector(sel);
        const list = $('#s-list');

        function redraw() {
          list.innerHTML = rows($('#s-q').value);
          $('#s-count').textContent = state.picked.length + ' / ' + all.length;
        }

        $('#s-q').addEventListener('input', () => { state.query = $('#s-q').value; redraw(); });

        list.addEventListener('click', (e) => {
          const b = e.target.closest('[data-member]');
          if (!b) return;
          const id = b.getAttribute('data-member');
          const at = state.picked.indexOf(id);
          if (at >= 0) { state.picked.splice(at, 1); redraw(); return; }

          state.picked.push(id);
          // İkinci işaretten sonra aradakileri de doldur.
          if (state.picked.length >= 2) {
            const order = all.map((e2) => e2.id);
            const marks = state.picked.map((x) => order.indexOf(x)).filter((i) => i >= 0);
            const lo = Math.min.apply(null, marks), hi = Math.max.apply(null, marks);
            for (let i = lo; i <= hi; i++) {
              if (state.picked.indexOf(order[i]) < 0) state.picked.push(order[i]);
            }
          }
          redraw();
        });

        $('#s-parent').addEventListener('click', () => {
          state.title = $('#s-title').value;
          K.editor._spanState = state;
          K.editor._spanStateFor = spanId || 'new';
          K.sheet.push(() => pickSpanParent(spanId, state, opts));
        });

        if ($('#s-del')) $('#s-del').addEventListener('click', () => {
          const ok = K.store.mutate((d) => {
            d.events = d.events.filter((e) => e.id !== existing.id);
            d.events.forEach((e) => { if (e.parentId === existing.id) e.parentId = null; });
            d.groups.forEach((g) => { if (g.parentId === existing.id) g.parentId = null; });
          }, { action: 'kapsam silindi', title: existing.title });
          if (!ok) return;
          K.sheet.close();
          K.util.toast('Kapsam silindi', 'Geri al', () => K.store.undo());
        });

        $('#s-save').addEventListener('click', () => {
          const title = $('#s-title').value.trim();
          if (!title) { $('#s-title').focus(); K.util.toast('Başlık gerekli.'); return; }

          const id = existing ? existing.id : K.util.uid();
          const ok = K.store.mutate((d) => {
            let span = K.model.byId(d, id);
            if (!span) {
              span = Object.assign(K.model.blankSpan(d.ui.listId), { id: id, title: title });
              d.events.push(span);
            } else {
              span.title = title;
            }
            span.parentId = state.parentId;

            d.events.forEach((e) => {
              if (e.listId !== d.ui.listId || e.id === id) return;
              const want = state.picked.indexOf(e.id) >= 0;
              if (want) { e.parentId = id; e.groupId = null; }
              else if (e.parentId === id) e.parentId = state.parentId;
            });

            const at = K.model.spanOrder(d, id);
            if (at != null) span.order = at;
          }, {
            action: existing ? 'kapsam değiştirildi' : 'kapsam eklendi',
            title: title,
            details: [{ k: 'İçindekiler', from: existing ? String(K.model.membersOf(db, existing.id).length) : '0',
                        to: String(state.picked.length) }]
          });

          if (!ok) return;
          // Karttan gelindiyse o kartın kapsamı bu olur; seçici panelini de
          // atlayıp doğrudan karta dönüyoruz.
          if (opts.firstId && K.editor._draft) {
            K.editor._draft.parentId = id;
            K.sheet.back();
          }
          K.sheet.back();
        });
      }
    );
  }

  /* Kapsamın kendi kapsamını seçmek için — iç içe kapsam. */
  function pickSpanParent(spanId, state, opts) {
    const db = K.store.get();
    const me = spanId ? K.model.byId(db, spanId) : null;
    const spans = K.model.spanOptions(db, me);

    K.sheet.open(
      '<h2>Kapsam</h2>' +
      '<div class="pick">' +
        '<button class="pick-row ' + (!state.parentId ? 'on' : '') + '" data-pick="">— yok —</button>' +
        spans.map((s) => '<button class="pick-row ' + (state.parentId === s.id ? 'on' : '') + '" data-pick="' + s.id + '">' +
          esc(s.title) + '</button>').join('') +
      '</div>',
      function (root) {
        root.addEventListener('click', (e) => {
          const b = e.target.closest('[data-pick]');
          if (!b) return;
          state.parentId = b.getAttribute('data-pick') || null;
          K.editor._spanState = state;
          K.editor._spanStateFor = spanId || 'new';
          K.sheet.back();
        });
      }
    );
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

  return { open, openSpan, openGroup, pickSpan,
           _draft: null, _draftFor: null, _spanState: null, _spanStateFor: null };
})();
