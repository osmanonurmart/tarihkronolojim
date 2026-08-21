window.K = window.K || {};

/* Firebase senkronu.

   Yerel kayıt her zaman asıl kopya; bulut onun üstüne bir katman. Bağlantı
   yoksa uygulama hiç değişmeden çalışmaya devam eder.

   Yazma yönü: her yerel değişiklikte önceki ve sonraki durum karşılaştırılır,
   yalnızca değişen belgeler yollanır — böylece iki cihaz farklı olayları aynı
   anda düzenlediğinde birbirlerinin işini silmez.

   Okuma yönü: koleksiyonlar canlı dinlenir, gelen anlık görüntü yerel diziyi
   olduğu gibi değiştirir. Çakışmada belge bazında son yazan kazanır.

   İlerleme kişi başına tek belgede tutulur: bir profili aynı anda iki kişi
   çalışmadığı için orada çakışma doğal olarak oluşmaz. */
K.cloud = (function () {
  const CFG_KEY = 'kronolojim.cloud.v1';
  const COLLECTIONS = ['lists', 'profiles', 'groups', 'events'];
  const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';

  let cfg = null;
  let backend = null;
  let unsubs = [];
  let state = 'off';          // off | connecting | online | offline | error
  let lastError = '';
  let applying = false;       // buluttan gelen değişiklik uygulanırken yazma yok
  let ready = false;          // ilk uzlaştırma bitti mi
  let pending = null;         // ilk anlık görüntüler, uzlaştırma kararı beklerken

  /* ---- Ayar ---- */
  function loadCfg() {
    try {
      const raw = localStorage.getItem(CFG_KEY);
      cfg = raw ? JSON.parse(raw) : null;
    } catch (e) { cfg = null; }
    return cfg;
  }

  function saveCfg(next) {
    cfg = next;
    if (next) localStorage.setItem(CFG_KEY, JSON.stringify(next));
    else localStorage.removeItem(CFG_KEY);
  }

  function parseConfig(text) {
    // Firebase konsolu bir JavaScript nesnesi verir; JSON'a çevirmemiz gerekiyor.
    const m = String(text).match(/\{[\s\S]*\}/);
    if (!m) throw new Error('Ayar bulunamadı.');
    let body = m[0]
      .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
      .replace(/'/g, '"')
      .replace(/,\s*([}\]])/g, '$1');
    const obj = JSON.parse(body);
    if (!obj.apiKey || !obj.projectId) throw new Error('apiKey ve projectId gerekiyor.');
    return obj;
  }

  /* ---- Değişiklik farkı ---- */
  function indexById(arr) {
    const out = {};
    (arr || []).forEach((x) => { out[x.id] = x; });
    return out;
  }

  function byProfile(progress) {
    const out = {};
    Object.keys(progress || {}).forEach((k) => {
      const cut = k.indexOf('|');
      if (cut < 0) return;
      const pid = k.slice(0, cut);
      (out[pid] = out[pid] || {})[k.slice(cut + 1)] = progress[k];
    });
    return out;
  }

  function diff(before, after) {
    const ops = [];

    COLLECTIONS.forEach((col) => {
      const b = indexById(before[col]), a = indexById(after[col]);
      Object.keys(a).forEach((id) => {
        if (!b[id] || JSON.stringify(b[id]) !== JSON.stringify(a[id])) {
          ops.push({ col: col, id: id, data: a[id] });
        }
      });
      Object.keys(b).forEach((id) => {
        if (!a[id]) ops.push({ col: col, id: id, del: true });
      });
    });

    const bp = byProfile(before.progress), ap = byProfile(after.progress);
    Object.keys(ap).forEach((pid) => {
      if (JSON.stringify(bp[pid]) !== JSON.stringify(ap[pid])) {
        ops.push({ col: 'progress', id: pid, data: { entries: ap[pid] } });
      }
    });
    Object.keys(bp).forEach((pid) => {
      if (!ap[pid]) ops.push({ col: 'progress', id: pid, del: true });
    });

    return ops;
  }

  function fullUpload(db) {
    return diff(
      { lists: [], profiles: [], groups: [], events: [], progress: {} },
      db
    );
  }

  /* ---- Uzaktan gelen ---- */
  function applySnapshot(col, docs) {
    if (!ready) { pending[col] = docs; return; }
    applying = true;
    K.store.applyRemote((db) => {
      if (col === 'progress') {
        const flat = {};
        docs.forEach((d) => {
          Object.keys(d.entries || {}).forEach((k) => { flat[d.id + '|' + k] = d.entries[k]; });
        });
        db.progress = flat;
      } else {
        db[col] = docs;
        if (col === 'profiles' && !docs.some((p) => p.id === db.ui.profileId)) db.ui.profileId = null;
        if (col === 'lists' && !docs.some((l) => l.id === db.ui.listId)) {
          db.ui.listId = docs.length ? docs[0].id : null;
        }
      }
    });
    applying = false;
  }

  function cloudHasContent(snap) {
    return (snap.events && snap.events.length > 0) ||
           (snap.groups && snap.groups.length > 0) ||
           (snap.lists && snap.lists.length > 0);
  }

  function localHasContent(db) {
    return db.events.length > 0 || db.groups.length > 0;
  }

  function adoptCloud(snap) {
    ready = true;
    ['lists', 'profiles', 'groups', 'events', 'progress'].forEach((col) => {
      applySnapshot(col, snap[col] || []);
    });
  }

  function uploadLocal() {
    ready = true;
    const ops = fullUpload(K.store.get());
    if (ops.length) backend.commit(cfg.space, ops);
  }

  function reconcile() {
    const snap = pending;
    const db = K.store.get();
    const cloudFull = cloudHasContent(snap);
    const localFull = localHasContent(db);

    if (!cloudFull) { uploadLocal(); return finish(); }
    if (!localFull) { adoptCloud(snap); return finish(); }

    K.panels.cloudMerge(function (choice) {
      if (choice === 'cloud') adoptCloud(snap);
      else uploadLocal();
      finish();
    });
  }

  function finish() {
    pending = null;
    setState('online');
    K.app.render();
  }

  function setState(s, err) {
    state = s;
    lastError = err || '';
    if (K.app && K.app.render) K.app.render();
  }

  /* ---- Gerçek Firestore arka ucu ---- */
  async function firestoreBackend() {
    const [appMod, authMod, dbMod] = await Promise.all([
      import(SDK + 'firebase-app.js'),
      import(SDK + 'firebase-auth.js'),
      import(SDK + 'firebase-firestore.js')
    ]);

    let app, fs;

    return {
      async init(config) {
        app = appMod.initializeApp(config);
        try {
          fs = dbMod.initializeFirestore(app, {
            localCache: dbMod.persistentLocalCache({ tabManager: dbMod.persistentMultipleTabManager() })
          });
        } catch (e) {
          fs = dbMod.getFirestore(app);       // birden çok sekme açıksa yerel önbellek kurulamayabilir
        }
        const auth = authMod.getAuth(app);
        await authMod.signInAnonymously(auth);
      },

      watch(space, col, cb, onError) {
        const ref = dbMod.collection(fs, 'spaces', space, col);
        return dbMod.onSnapshot(ref,
          (snap) => cb(snap.docs.map((d) => Object.assign({ id: d.id }, d.data()))),
          onError);
      },

      async commit(space, ops) {
        for (let i = 0; i < ops.length; i += 400) {
          const batch = dbMod.writeBatch(fs);
          ops.slice(i, i + 400).forEach((op) => {
            const ref = dbMod.doc(fs, 'spaces', space, op.col, op.id);
            if (op.del) batch.delete(ref);
            else batch.set(ref, clean(op.data));
          });
          await batch.commit();
        }
      }
    };
  }

  // Firestore undefined kabul etmez.
  function clean(value) {
    if (value === undefined) return null;
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(clean);
    const out = {};
    Object.keys(value).forEach((k) => { out[k] = clean(value[k]); });
    return out;
  }

  /* ---- Bağlan / kes ---- */
  async function connect(nextCfg) {
    if (nextCfg) saveCfg(nextCfg);
    if (!cfg) { setState('off'); return; }

    disconnect(true);
    setState('connecting');
    pending = {};
    ready = false;

    try {
      if (!backend) backend = await firestoreBackend();
      await backend.init(cfg.config);
    } catch (e) {
      backend = null;
      setState('error', 'Bağlanılamadı: ' + (e && e.message ? e.message : e));
      return;
    }

    const cols = ['lists', 'profiles', 'groups', 'events', 'progress'];
    let firstSeen = 0;

    cols.forEach((col) => {
      const un = backend.watch(cfg.space, col,
        (docs) => {
          applySnapshot(col, docs);
          if (!ready && ++firstSeen === cols.length) reconcile();
        },
        (err) => setState('error', 'Okuma hatası: ' + (err && err.message ? err.message : err))
      );
      unsubs.push(un);
    });
  }

  function disconnect(keepConfig) {
    unsubs.forEach((u) => { try { u(); } catch (e) {} });
    unsubs = [];
    ready = false;
    pending = null;
    if (!keepConfig) { saveCfg(null); backend = null; setState('off'); }
  }

  function onLocalChange(before, after) {
    if (!ready || applying || !backend) return;
    const ops = diff(before, after);
    if (!ops.length) return;
    Promise.resolve(backend.commit(cfg.space, ops)).catch((e) => {
      setState('offline', e && e.message ? e.message : String(e));
    });
  }

  function boot() {
    loadCfg();
    if (cfg) connect();
  }

  return {
    boot, connect, disconnect, onLocalChange,
    status: () => state,
    error: () => lastError,
    config: () => cfg,
    parseConfig: parseConfig,
    // testler için
    _diff: diff, _fullUpload: fullUpload, _byProfile: byProfile, _clean: clean,
    _setBackend: (b) => { backend = b; },
    _internals: () => ({ ready: ready, applying: applying })
  };
})();
