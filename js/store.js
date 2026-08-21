window.K = window.K || {};

/* Tek durum kaynağı: her şey burada, her değişiklik geri alınabilir.
   Yerel depo bir bağdaştırıcının arkasında — Firebase geldiğinde
   save/load değişecek, geri kalan kod aynı kalacak. */
K.store = (function () {
  const KEY = 'kronolojim.v1';
  const UNDO_MAX = 50;

  let db = null;
  const subs = [];
  const undoStack = [];

  function seed() {
    const p1 = K.util.uid(), p2 = K.util.uid(), lid = K.util.uid();
    return {
      v: 1,
      profiles: [{ id: p1, name: 'Onur' }, { id: p2, name: 'Fatma' }],
      lists: [{ id: lid, name: 'Tarih' }],
      events: [],
      groups: [],
      progress: {},                       // "profil|olay|tip" -> {level, due, right, wrong}
      ui: { profileId: null, listId: lid, theme: 'dark', blind: false, editing: false, collapsed: [] }
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.profiles) return null;
      parsed.ui = Object.assign(seed().ui, parsed.ui || {});
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

  /* İçerik değişikliği: geri alma yığınına yazılır. */
  function mutate(fn) {
    undoStack.push(JSON.stringify(db));
    if (undoStack.length > UNDO_MAX) undoStack.shift();
    fn(db);
    save(); emit();
  }

  /* Görünüm ve ilerleme değişiklikleri geri almayı kirletmesin. */
  function quiet(fn) { fn(db); save(); emit(); }

  function canUndo() { return undoStack.length > 0; }

  function undo() {
    const snap = undoStack.pop();
    if (!snap) return false;
    const ui = db.ui;                     // görünüm durumunu koru
    db = JSON.parse(snap);
    db.ui = ui;
    save(); emit();
    return true;
  }

  function replaceAll(next) {
    undoStack.push(JSON.stringify(db));
    const ui = db.ui;
    db = next;
    db.ui = Object.assign(seed().ui, ui, {
      listId: (next.lists && next.lists[0]) ? next.lists[0].id : null,
      profileId: null
    });
    save(); emit();
  }

  function reset() { mutate(() => { db = seed(); }); }

  /* ---- Kısa yollar ---- */
  const profile = () => db.profiles.find((p) => p.id === db.ui.profileId) || null;
  const list = () => db.lists.find((l) => l.id === db.ui.listId) || null;

  return {
    init, get, subscribe, mutate, quiet, undo, canUndo, replaceAll, reset,
    profile, list, seed
  };
})();
