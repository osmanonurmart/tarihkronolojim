window.K = window.K || {};

K.app = (function () {
  const root = () => document.getElementById('app');

  function applyTheme() {
    const t = K.store.get().ui.theme;
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    const meta = document.querySelector('meta[name=theme-color]');
    if (meta) {
      const dark = t === 'dark' ||
        (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      meta.setAttribute('content', dark ? '#101219' : '#F3F4F8');
    }
  }

  function render() {
    const db = K.store.get();
    if (K.study.active()) root().innerHTML = K.study.render();
    else if (!db.ui.profileId) root().innerHTML = K.panels.welcome(db);
    else root().innerHTML = K.timeline.render(db);
  }

  /* ---- Eylemler ---- */
  const actions = {
    profiles: () => K.panels.profiles(),
    lists: () => K.panels.lists(),
    settings: () => K.panels.settings(),
    samples: () => K.panels.samples(),

    undo: () => {
      if (K.store.undo()) K.util.toast('Geri alındı');
      else K.util.toast('Geri alınacak bir şey yok.');
    },

    blind: () => K.store.quiet((d) => { d.ui.blind = !d.ui.blind; }),
    edit: () => K.store.quiet((d) => { d.ui.editing = !d.ui.editing; }),

    reveal: (el) => { K.timeline.revealed.add(el.dataset.id); render(); },

    'toggle-span': (el) => K.store.quiet((d) => {
      const i = d.ui.collapsed.indexOf(el.dataset.id);
      if (i >= 0) d.ui.collapsed.splice(i, 1);
      else d.ui.collapsed.push(el.dataset.id);
    }),

    add: () => K.editor.open(null, {}),

    'del-event': (el) => {
      const db = K.store.get();
      const ev = K.model.byId(db, el.dataset.id);
      if (!ev) return;
      const ok = K.store.mutate((d) => {
        d.events = d.events.filter((e) => e.id !== ev.id);
        d.events.forEach((e) => { if (e.parentId === ev.id) e.parentId = null; });
        d.groups.forEach((g) => { if (g.parentId === ev.id) g.parentId = null; });
      }, { action: 'silindi', title: ev.title });
      if (ok) K.util.toast('Silindi', 'Geri al', () => K.store.undo());
    },

    'open-event': (el) => K.editor.open(el.dataset.id),
    'edit-group': (el) => K.editor.openGroup(el.dataset.id),

    insert: (el) => K.editor.open(null, {
      parent: el.dataset.parent || null,
      group: el.dataset.group || null,
      order: parseFloat(el.dataset.order)
    }),

    study: () => { if (K.study.start()) render(); },
    'close-study': () => { K.study.quit(); render(); },
    answer: (el) => { K.study.answer(parseInt(el.dataset.i, 10)); render(); },
    next: () => K.study.next(),

    'pick-profile': (el) => {
      K.store.quiet((d) => { d.ui.profileId = el.dataset.id; });
      K.sheet.close();
    },

    'new-profile': () => {
      const name = prompt('Kimin adı eklensin?');
      if (!name || !name.trim()) return;
      const id = K.util.uid();
      K.store.mutate((d) => {
        d.profiles.push({ id: id, name: name.trim() });
        d.ui.profileId = id;
      }, { action: 'kişi eklendi', title: name.trim() });
      K.sheet.close();
    },

    'rename-profile': (el) => {
      const db = K.store.get();
      const p = db.profiles.find((x) => x.id === el.dataset.id);
      const name = prompt('Yeni ad:', p ? p.name : '');
      if (!name || !name.trim()) return;
      K.store.mutate((d) => { d.profiles.find((x) => x.id === el.dataset.id).name = name.trim(); },
        { action: 'kişi adı değişti', title: name.trim() });
      K.panels.profiles();
    },

    'del-profile': (el) => {
      const db = K.store.get();
      const p = db.profiles.find((x) => x.id === el.dataset.id);
      if (!p) return;
      K.store.mutate((d) => {
        d.profiles = d.profiles.filter((x) => x.id !== p.id);
        Object.keys(d.progress).forEach((k) => {
          if (k.indexOf(p.id + '|') === 0) delete d.progress[k];
        });
        if (d.ui.profileId === p.id) d.ui.profileId = d.profiles.length ? d.profiles[0].id : null;
      }, { action: 'kişi silindi', title: p.name });
      K.panels.profiles();
      K.util.toast('Silindi', 'Geri al', () => K.store.undo());
    },

    'pick-list': (el) => {
      K.store.quiet((d) => { d.ui.listId = el.dataset.id; d.ui.collapsed = []; });
      K.sheet.close();
    },

    'new-list': () => {
      const name = prompt('Liste adı:');
      if (!name || !name.trim()) return;
      const id = K.util.uid();
      K.store.mutate((d) => {
        d.lists.push({ id: id, name: name.trim() });
        d.ui.listId = id;
        d.ui.collapsed = [];
      }, { action: 'liste eklendi', title: name.trim() });
      K.sheet.close();
    },

    'rename-list': (el) => {
      const db = K.store.get();
      const l = db.lists.find((x) => x.id === el.dataset.id);
      const name = prompt('Yeni ad:', l ? l.name : '');
      if (!name || !name.trim()) return;
      K.store.mutate((d) => { d.lists.find((x) => x.id === el.dataset.id).name = name.trim(); },
        { action: 'liste adı değişti', title: name.trim() });
      K.panels.lists();
    },

    'del-list': (el) => {
      const db = K.store.get();
      const l = db.lists.find((x) => x.id === el.dataset.id);
      if (!l) return;
      K.store.mutate((d) => {
        d.events = d.events.filter((e) => e.listId !== l.id);
        d.groups = d.groups.filter((g) => g.listId !== l.id);
        d.lists = d.lists.filter((x) => x.id !== l.id);
        if (d.ui.listId === l.id) d.ui.listId = d.lists.length ? d.lists[0].id : null;
      }, { action: 'liste silindi', title: l.name });
      K.panels.lists();
      K.util.toast('Liste silindi', 'Geri al', () => K.store.undo());
    }
  };

  function onClick(e) {
    if (e.target.closest('[data-handle]')) return;
    if (Date.now() - K.timeline.lastDrag() < 350) return;
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = actions[el.getAttribute('data-act')];
    if (!fn) return;
    e.preventDefault();
    fn(el);
  }

  function onKey(e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-act]')) {
      e.preventDefault();
      e.target.click();
      return;
    }
    if (e.key === 'Escape' && K.sheet.isOpen()) { K.sheet.close(); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !K.sheet.isOpen()) {
      e.preventDefault();
      actions.undo();
    }
  }

  function boot() {
    K.store.init();
    K.cloud.boot();
    applyTheme();
    K.store.subscribe(render);
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    K.timeline.bind(root());
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    window.addEventListener('online', render);
    window.addEventListener('offline', render);
    render();

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then((reg) => {
          // Arka planda yeni bir sürüm devraldıysa sayfayı bir kere tazeliyoruz,
          // yoksa güncelleme bir sonraki açılışa kalıyor.
          let refreshing = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            location.reload();
          });
          reg.update();
        }).catch(() => {});
      });
    }
  }

  return { boot, render, applyTheme };
})();

document.addEventListener('DOMContentLoaded', K.app.boot);
