window.K = window.K || {};

/* Tek durum kaynağı: her şey burada, her değişiklik geri alınabilir.
   Yerel depo bir bağdaştırıcının arkasında; bulut katmanı K.cloud'da. */
K.store = (function () {
  const KEY = 'kronolojim.v1';
  const UNDO_MAX = 50;
  const LOG_MAX = 50;

  let db = null;
  const subs = [];
  const undoStack = [];

  function seed() {
    const p1 = K.util.uid(), p2 = K.util.uid(), lid = K.util.uid();
    return {
      v: 2,
      profiles: [{ id: p1, name: 'Onur' }, { id: p2, name: 'Fatma' }],
      lists: [{ id: lid, name: 'Tarih' }],
      events: [],
      groups: [],
      log: [],                            // son değişiklikler: kim, ne zaman, ne
      progress: {},                       // "profil|olay|tip" -> {level, due, right, wrong}
      ui: { profileId: null, listId: lid, theme: 'dark', blind: false, editing: false, collapsed: [] }
    };
  }

  /* Eski kayıtları yeni şekle taşır. Bulut kopyası da eski olabileceği için
     her çağrıldığında güvenle çalışır ve bir şey değiştiyse true döner. */
  function normalize(target) {
    let touched = false;
    target.events = target.events || [];
    target.groups = target.groups || [];
    target.log = target.log || [];

    const index = {};
    target.events.forEach((e) => { index[e.id] = e; });

    // Eski "bağ" olayları: tarihsiz sonuç kartları, kaynağının metnine taşınır.
    const drop = [];
    target.events.forEach((e) => {
      if (!e.linkFrom || !e.linkFrom.length || e.start) return;
      const sources = e.linkFrom.map((id) => index[id]).filter(Boolean);
      if (sources.length) {
        const anchor = sources.reduce((a, b) => (b.order > a.order ? b : a));
        if (!anchor.after) { anchor.after = e.title; touched = true; }
      }
      drop.push(e.id);
    });
    if (drop.length) {
      target.events = target.events.filter((e) => drop.indexOf(e.id) < 0);
      touched = true;
    }

    target.events.forEach((e) => {
      if (e.tags) { delete e.tags; touched = true; }
      if (e.linkFrom) { delete e.linkFrom; touched = true; }
      if (e.after === undefined) { e.after = ''; touched = true; }
      if (e.isSpan === undefined) {
        // Eskiden kapsam, "aralığı var ve içinde olay var" demekti.
        e.isSpan = !!(e.end && (
          target.events.some((c) => c.parentId === e.id) ||
          target.groups.some((g) => g.parentId === e.id)
        ));
        touched = true;
      }
    });

    return touched;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.profiles) return null;
      parsed.ui = Object.assign(seed().ui, parsed.ui || {});
      normalize(parsed);
      return parsed;
    } catch (e) {
      console.warn('Kayıt okunamadı, sıfırdan başlanıyor.', e);
      return null;
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
      K.util.toast('Kayıt yapılamadı — depolama dolu olabilir.');
    }
  }

  function emit() { subs.forEach((fn) => fn(db)); }

  function init() { db = load() || seed(); }
  function get() { return db; }
  function subscribe(fn) { subs.push(fn); }

  /* İçerik değişikliği bulut açıkken ancak bağlıyken yapılabilir; çalışma ve
     görünüm değişiklikleri her zaman serbesttir. */
  function contentAllowed() {
    if (!K.cloud || !K.cloud.isEnabled()) return true;
    return K.cloud.status() === 'online';
  }

  function addLog(entry) {
    const who = profile();
    db.log.unshift({
      id: K.util.uid(),
      ts: Date.now(),
      by: who ? who.name : '—',
      action: entry.action,
      title: entry.title || ''
    });
    if (db.log.length > LOG_MAX) db.log.length = LOG_MAX;
  }

  function commit(fn, opts) {
    opts = opts || {};
    const before = JSON.stringify(db);
    if (opts.undoable) {
      undoStack.push(before);
      if (undoStack.length > UNDO_MAX) undoStack.shift();
    }
    fn(db);
    if (opts.log) addLog(opts.log);
    save(); emit();
    if (K.cloud) K.cloud.onLocalChange(JSON.parse(before), db);
  }

  /* İçerik değişikliği: geri alınabilir, kayıt defterine yazılır. */
  function mutate(fn, log) {
    if (!contentAllowed()) {
      K.util.toast('İnternet yokken değişiklik yapılamaz.');
      return false;
    }
    commit(fn, { undoable: true, log: log });
    return true;
  }

  /* Görünüm ve ilerleme: her zaman serbest, geri almayı kirletmez. */
  function quiet(fn) { commit(fn, {}); }

  /* Buluttan gelen: yerel kaydı tazeler, geri alma yığınına dokunmaz. */
  function applyRemote(fn) { fn(db); save(); emit(); }

  function canUndo() { return undoStack.length > 0; }

  function undo() {
    if (!undoStack.length) return false;
    if (!contentAllowed()) {
      K.util.toast('İnternet yokken değişiklik yapılamaz.');
      return false;
    }
    const snap = undoStack.pop();
    const ui = db.ui;
    commit(() => {
      db = JSON.parse(snap);
      db.ui = ui;
    }, {});
    return true;
  }

  function replaceAll(next) {
    commit(() => {
      const ui = db.ui;
      db = next;
      normalize(db);
      db.ui = Object.assign(seed().ui, ui, {
        listId: (next.lists && next.lists[0]) ? next.lists[0].id : null,
        profileId: null
      });
    }, { undoable: true, log: { action: 'yedekten geri yüklendi' } });
  }

  /* Buluttan eski şekilde veri geldiyse bir kere düzeltip yukarı yollar. */
  function normalizeAndPush() {
    const copy = JSON.parse(JSON.stringify(db));
    if (!normalize(copy)) return false;
    commit((d) => {
      d.events = copy.events;
      d.groups = copy.groups;
    }, {});
    return true;
  }

  const profile = () => db.profiles.find((p) => p.id === db.ui.profileId) || null;
  const list = () => db.lists.find((l) => l.id === db.ui.listId) || null;

  return {
    init, get, subscribe, mutate, quiet, applyRemote, undo, canUndo,
    replaceAll, normalize, normalizeAndPush, contentAllowed,
    profile, list, seed
  };
})();
