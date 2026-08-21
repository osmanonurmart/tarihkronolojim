window.K = window.K || {};

/* Ana ekran: kronoloji akışı. */
K.timeline = (function () {
  const esc = K.util.esc;

  function ring(level) {
    let s = '<span class="ring r' + level + '">';
    for (let i = 1; i <= 5; i++) s += '<i class="' + (i <= level ? 'on' : '') + '"></i>';
    return s + '</span>';
  }

  function dateChip(db, ev) {
    const txt = K.model.fmtEvent(ev);
    if (!txt) return '';
    if (db.ui.blind && !revealed.has(ev.id)) {
      return '<button class="blindmark" data-act="reveal" data-id="' + ev.id + '">••••</button>';
    }
    return '<span>' + esc(txt) + '</span>';
  }

  const revealed = new Set();

  function killBtn(db, id) {
    return db.ui.editing
      ? '<button class="kill-left" data-act="del-event" data-id="' + id + '" aria-label="Sil">🗑</button>'
      : '';
  }

  function eventCard(db, ev) {
    const lv = K.srs.levelOf(db, ev.id);
    const date = dateChip(db, ev);

    return '' +
      '<div class="ev l' + lv + '" data-node="ev:' + ev.id + '" data-act="open-event" data-id="' + ev.id + '" role="button" tabindex="0">' +
        killBtn(db, ev.id) +
        '<div class="ev-top">' + date + ring(lv) + '</div>' +
        '<div class="ev-title">' + esc(ev.title) + '</div>' +
        (ev.note ? '<div class="ev-note">' + esc(ev.note) + '</div>' : '') +
        (db.ui.editing ? '<button class="handle" data-handle aria-label="Taşı">⣿</button>' : '') +
      '</div>';
  }

  /* Sonuç metni kartın altında, içeri girintili küçük bir kutu olarak durur. */
  function consequence(db, ev) {
    if (!ev.after) return '';
    return '<div class="link-row"><div class="link-elbow"></div>' +
      '<div class="ev consequence" data-act="open-event" data-id="' + ev.id + '">' +
        '<div class="after-chip">sonucunda</div>' +
        '<div class="ev-title">' + esc(ev.after) + '</div>' +
      '</div></div>';
  }

  function groupBox(db, g) {
    const evs = K.model.eventsOfGroup(db, g.id);
    const rows = evs.map((ev, i) => {
      const lv = K.srs.levelOf(db, ev.id);
      return '<div class="group-row l' + lv + '" data-node="ev:' + ev.id + '" data-act="open-event" data-id="' + ev.id + '" role="button" tabindex="0">' +
        killBtn(db, ev.id) +
        '<span class="idx">' + (i + 1) + '</span>' +
        '<span>' + esc(ev.title) + '</span>' +
        ring(lv) +
        (db.ui.editing ? '<button class="handle" data-handle aria-label="Taşı">⣿</button>' : '') +
      '</div>';
    }).join('');

    const inner = db.ui.editing
      ? '<div class="kids" data-kids="g:' + g.id + '">' + rows + '</div>' +
        insertBtn(db, { group: g.id, order: (evs.length ? evs[evs.length - 1].order + 1 : 1000) })
      : '<div class="kids" data-kids="g:' + g.id + '">' + rows + '</div>';

    return '<div class="group" data-node="gr:' + g.id + '">' +
      '<div class="group-head"><span>' + esc(g.name) + '</span>' +
        '<button class="g-edit iconbtn" data-act="edit-group" data-id="' + g.id + '" aria-label="Grubu düzenle">✎</button>' +
        (db.ui.editing
          ? '<button class="handle" data-handle aria-label="Taşı" style="position:static;transform:none">⣿</button>'
          : '') +
      '</div>' + inner +
      (evs.length ? '' : '<div class="hint">Boş grup — düzenle modunda içine olay ekle.</div>') +
    '</div>';
  }

  function insertBtn(db, ctx) {
    if (!db.ui.editing) return '';
    const attrs = [
      'data-act="insert"',
      'data-parent="' + (ctx.parent || '') + '"',
      'data-group="' + (ctx.group || '') + '"',
      'data-order="' + ctx.order + '"'
    ].join(' ');
    return '<button class="insert" ' + attrs + ' aria-label="Buraya olay ekle">+</button>';
  }

  function container(db, parentId, depth) {
    const nodes = K.model.childrenOf(db, parentId);
    const out = [];
    const key = parentId || 'root';

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const prevOrder = i === 0 ? null : nodes[i - 1].order;
      out.push(insertBtn(db, { parent: parentId, order: K.model.orderBetween(prevOrder, node.order) }));

      if (node.t === 'gr') { out.push(groupBox(db, node.gr)); continue; }

      const ev = node.ev;

      if (K.model.isSpan(ev) && depth < K.model.MAX_DEPTH) {
        const collapsed = db.ui.collapsed.indexOf(ev.id) >= 0;
        if (collapsed) {
          const count = K.model.flatten(db, ev.id).length;
          out.push(
            '<div class="collapsed-row" data-node="ev:' + ev.id + '">' +
            '<button class="collapsed-span" data-act="toggle-span" data-id="' + ev.id + '">' +
              '<span class="cs-title">' + esc(ev.title) + '</span>' +
              '<span class="mono cs-meta">' + esc(K.model.fmtEvent(ev)) + ' · ' + count + ' olay</span>' +
            '</button>' +
            '<button class="iconbtn" data-act="open-event" data-id="' + ev.id + '" aria-label="Düzenle">✎</button>' +
            '</div>'
          );
        } else {
          const label = esc(ev.title + ' ' + K.model.fmtEvent(ev));
          out.push(
            '<div class="span-row" data-node="ev:' + ev.id + '">' +
              '<div class="gutter">' +
                '<button class="span-edit" data-act="open-event" data-id="' + ev.id + '" aria-label="Kapsamı düzenle">✎</button>' +
                (db.ui.editing
                  ? '<button class="span-edit kill" data-act="del-event" data-id="' + ev.id + '" aria-label="Kapsamı sil">🗑</button>' +
                    '<button class="handle" data-handle aria-label="Taşı" style="position:static;transform:none;height:24px">⣿</button>'
                  : '') +
                '<button class="bracket d' + depth + '" data-act="toggle-span" data-id="' + ev.id + '" aria-label="Kapsamı katla">' +
                  '<span class="label">' + label + '</span>' +
                '</button>' +
              '</div>' +
              '<div class="kids" data-kids="' + ev.id + '">' + container(db, ev.id, depth + 1).join('') + '</div>' +
            '</div>'
          );
        }
        out.push(consequence(db, ev));
        continue;
      }

      out.push(eventCard(db, ev));
      out.push(consequence(db, ev));
    }

    const lastOrder = nodes.length ? nodes[nodes.length - 1].order + 1 : 1000;
    out.push(insertBtn(db, { parent: parentId, order: lastOrder }));
    return out;
  }

  function dueBar(db) {
    const n = K.srs.dueCount(db);
    if (!K.model.listEvents(db).length) return '';
    if (!n) {
      return '<div class="due calm"><span class="dot"></span>' +
        '<span class="txt">Bugünlük tekrar bitti</span>' +
        '<button class="go" data-act="study">YİNE DE ÇALIŞ ▸</button></div>';
    }
    return '<button class="due" data-act="study">' +
      '<span class="dot"></span>' +
      '<span class="txt">Bugün ' + n + ' tekrar var</span>' +
      '<span class="go">BAŞLA ▸</span></button>';
  }

  function emptyState() {
    return '<div class="empty">' +
      '<h2>Liste boş</h2>' +
      '<p>İlk olayını ekle. Tarihi olanlar kendiliğinden yerine oturur; tarihi olmayanları elle sıralarsın.</p>' +
      '<div class="row" style="max-width:20rem">' +
        '<button class="btn primary" data-act="add">Olay ekle</button>' +
        '<button class="btn" data-act="samples">Örnekle başla</button>' +
      '</div></div>';
  }

  function render(db) {
    const p = K.store.profile();
    const l = K.store.list();
    const has = K.model.listEvents(db).length > 0 || K.model.listGroups(db).length > 0;

    return '<div class="screen' + (db.ui.editing ? ' editing' : '') + '">' +
      '<div class="topbar">' +
        '<button class="who" data-act="profiles">' +
          '<span class="avatar">' + esc(K.util.initials(p ? p.name : '?')) + '</span>' +
          '<span class="who-name">' + esc(p ? p.name : '') + '</span>' +
          '<span class="caret">▾</span>' +
        '</button>' +
        '<div class="grow"></div>' +
        '<button class="list-name" data-act="lists">' + esc(l ? l.name : 'Liste') + '</button>' +
        '<button class="iconbtn" data-act="undo" ' + (K.store.canUndo() ? '' : 'disabled') + ' aria-label="Geri al" title="Geri al">↺</button>' +
        '<button class="iconbtn ' + (db.ui.blind ? 'on' : '') + '" data-act="blind" aria-label="Kör mod" title="Kör mod">' + (db.ui.blind ? '◌' : '◉') + '</button>' +
        '<button class="iconbtn ' + (db.ui.editing ? 'on' : '') + '" data-act="edit" aria-label="Düzenle" title="Düzenle">✎</button>' +
        '<button class="iconbtn" data-act="settings" aria-label="Ayarlar" title="Ayarlar">⋯' +
          (K.cloud.status() === 'off' ? '' : '<span class="cloud-dot ' + K.cloud.status() + '"></span>') +
        '</button>' +
      '</div>' +
      dueBar(db) +
      (has
        ? '<div class="stream kids" data-kids="root">' + container(db, null, 1).join('') + '</div>'
        : emptyState()) +
      (has ? '<button class="fab" data-act="add" aria-label="Olay ekle">+</button>' : '') +
    '</div>';
  }

  /* ---- Sürükleyerek sıralama ---- */
  let drag = null;
  let lastDrag = 0;

  function nodeOrder(db, node) {
    const [t, id] = node.split(':');
    return t === 'ev'
      ? (K.model.byId(db, id) || {}).order
      : (db.groups.find((g) => g.id === id) || {}).order;
  }

  function setOrder(node, order) {
    const [t, id] = node.split(':');
    const db = K.store.get();
    const item = t === 'ev' ? K.model.byId(db, id) : db.groups.find((g) => g.id === id);
    K.store.mutate((d) => {
      const target = t === 'ev' ? d.events.find((e) => e.id === id) : d.groups.find((g) => g.id === id);
      if (target) target.order = order;
    }, { action: 'sırası değişti', title: item ? (item.title || item.name) : '' });
  }

  function onPointerDown(e) {
    const handle = e.target.closest('[data-handle]');
    if (!handle) return;
    const el = handle.closest('[data-node]');
    const box = el && el.closest('[data-kids]');
    if (!el || !box) return;

    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const line = document.createElement('div');
    line.className = 'drop-line';
    drag = { el: el, box: box, line: line, handle: handle };
    el.classList.add('dragging');
  }

  function onPointerMove(e) {
    if (!drag) return;
    const sibs = Array.from(drag.box.children).filter((c) => c.hasAttribute('data-node') && c !== drag.el);
    let placed = false;
    for (const s of sibs) {
      const r = s.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) {
        drag.box.insertBefore(drag.line, s);
        placed = true;
        break;
      }
    }
    if (!placed) drag.box.appendChild(drag.line);
  }

  function onPointerUp() {
    if (!drag) return;
    const db = K.store.get();
    const line = drag.line;
    const node = drag.el.getAttribute('data-node');

    if (line.parentNode) {
      const sibs = Array.from(drag.box.children)
        .filter((c) => c.hasAttribute('data-node') || c === line);
      const at = sibs.indexOf(line);
      const beforeEl = sibs.slice(0, at).reverse().find((c) => c.hasAttribute('data-node'));
      const afterEl = sibs.slice(at + 1).find((c) => c.hasAttribute('data-node'));
      const before = beforeEl ? nodeOrder(db, beforeEl.getAttribute('data-node')) : null;
      const after = afterEl ? nodeOrder(db, afterEl.getAttribute('data-node')) : null;
      line.remove();
      setOrder(node, K.model.orderBetween(before, after));
    }
    drag.el.classList.remove('dragging');
    lastDrag = Date.now();
    drag = null;
  }

  function bind(root) {
    root.addEventListener('pointerdown', onPointerDown);
    root.addEventListener('pointermove', onPointerMove);
    root.addEventListener('pointerup', onPointerUp);
    root.addEventListener('pointercancel', onPointerUp);
  }

  return { render, bind, revealed, lastDrag: () => lastDrag };
})();
