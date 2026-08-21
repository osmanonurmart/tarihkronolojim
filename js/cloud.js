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
  const COLLECTIONS = ['lists', 'profiles', 'groups', 'events', 'log'];
  const ALL = COLLECTIONS.concat(['progress']);
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

  // Firebase konsolu bir JavaScript parçası verir — import satırları, yorumlar
  // ve sonda getAnalytics çağrısıyla birlikte. Tamamı yapıştırılabilsin diye
  // apiKey'i içeren nesneyi bulup parantezlerini sayarak kesiyoruz.
  function parseConfig(text) {
    const src = String(text).replace(/\/\/[^\n]*/g, '');

    const at = src.indexOf('apiKey');
    if (at < 0) throw new Error('apiKey bulunamadı.');

    let start = -1;
    for (let i = at; i >= 0; i--) { if (src[i] === '{') { start = i; break; } }
    if (start < 0) throw new Error('Ayar bloğu bulunamadı.');

    let depth = 0, end = -1;
    for (let i = start; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) { end = i; break; }
    }
    if (end < 0) throw new Error('Ayar bloğu kapanmamış.');

    let body = src.slice(start, end + 1)
      .replace(/([{,]\s*)([A-Za-z0-9_$]+)\s*:/g, '$1"$2":')
      .replace(/'/g, '"')
      .replace(/,\s*([}\]])/g, '$1');

    // Konsol uzun anahtarı kendi kutusunda satırlara bölerek gösteriyor;
    // aradaki satır sonlarını temizliyoruz.
    body = body.replace(/"([^"]*)"/g, (m, v) =>
      /\n/.test(v) ? '"' + v.replace(/\s+/g, '') + '"' : m);

    if (/[\u2022\u00B7\u25CF\u2219*]{3,}/.test(body)) {
      throw new Error('API anahtarı gizli görünüyor. Firebase konsolunda anahtarın yanındaki kopyala düğmesine basıp gerçek değeri al.');
    }

    let obj;
    try { obj = JSON.parse(body); }
    catch (e) { throw new Error('Ayar okunamadı, blok eksik olabilir.'); }

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
    const empty = { progress: {} };
    COLLECTIONS.forEach((c) => { empty[c] = []; });
    return diff(empty, db);
  }

  /* ---- Uzaktan gelen ---- */
  /* İlerleme birleştirilir, üzerine yazılmaz: internetsiz yapılan bir çalışma
     seansı bağlanır bağlanmaz silinmesin diye. Bir profili tek kişi çalıştığı
     için "hangisinde daha çok cevap varsa o" kuralı yeterli. */
  function mergeProgress(db, docs) {
    const incoming = {};
    docs.forEach((d) => {
      Object.keys(d.entries || {}).forEach((k) => { incoming[d.id + '|' + k] = d.entries[k]; });
    });
    const local = db.progress || {};
    const merged = {};
    const seen = {};
    Object.keys(incoming).concat(Object.keys(local)).forEach((k) => {
      if (seen[k]) return;
      seen[k] = true;
      const a = incoming[k], b = local[k];
      if (!a) { merged[k] = b; return; }
      if (!b) { merged[k] = a; return; }
      const na = (a.right || 0) + (a.wrong || 0);
      const nb = (b.right || 0) + (b.wrong || 0);
      merged[k] = na >= nb ? a : b;
    });
    db.progress = merged;
  }

  function applySnapshot(col, docs) {
    if (!ready) { pending[col] = docs; return; }
    applying = true;
    K.store.applyRemote((db) => {
      if (col === 'progress') { mergeProgress(db, docs); return; }
      db[col] = docs;
      if (col === 'profiles' && !docs.some((p) => p.id === db.ui.profileId)) db.ui.profileId = null;
      if (col === 'lists' && !docs.some((l) => l.id === db.ui.listId)) {
        db.ui.listId = docs.length ? docs[0].id : null;
      }
    });
    applying = false;
  }

  function cloudHasContent(snap) {
    return (snap.events && snap.events.length > 0) ||
           (snap.groups && snap.groups.length > 0);
  }

  function pushProgress() {
    const grouped = byProfile(K.store.get().progress);
    const ops = Object.keys(grouped).map((pid) => ({
      col: 'progress', id: pid, data: { entries: grouped[pid] }
    }));
    if (ops.length) backend.commit(cfg.space, ops);
  }

  /* Bulut her zaman haklı: bulutta içerik varsa o alınır, yoksa bu cihazdaki
     yüklenir. İlerleme bu kuralın dışında — birleştirilir. */
  function reconcile() {
    const snap = pending;
    ready = true;

    if (cloudHasContent(snap)) {
      ALL.forEach((col) => applySnapshot(col, snap[col] || []));
      K.store.normalizeAndPush();     // bulut kopyası eski şekildeyse düzeltilir
      pushProgress();
    } else {
      applySnapshot('progress', snap.progress || []);
      const ops = fullUpload(K.store.get());
      if (ops.length) backend.commit(cfg.space, ops);
    }
    finish();
  }

  function finish() {
    pending = null;
    setState('online');
    if (K.app && K.app.render) K.app.render();
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
    if (!cfg || cfg.off) { setState('off'); return; }

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

    let firstSeen = 0;

    ALL.forEach((col) => {
      const un = backend.watch(cfg.space, col,
        (docs) => {
          applySnapshot(col, docs);
          if (!ready && ++firstSeen === ALL.length) reconcile();
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
    if (!keepConfig) {
      // Gömülü ayar açılışta yeniden devreye girmesin diye tercih saklanır.
      saveCfg({ off: true });
      backend = null;
      setState('off');
    }
  }

  function onLocalChange(before, after) {
    if (!ready || applying || !backend) return;
    const ops = diff(before, after);
    if (!ops.length) return;
    Promise.resolve(backend.commit(cfg.space, ops)).catch((e) => {
      setState('offline', e && e.message ? e.message : String(e));
    });
  }

  /* Uygulamanın kendi ayarı gömülü geldiği için açılışta kendiliğinden
     bağlanır. Kullanıcı bağlantıyı kestiyse o tercih saklanır ve bir daha
     kendiliğinden bağlanmaz. */
  function currentStatus() {
    if (state === 'online' && navigator.onLine === false) return 'offline';
    return state;
  }

  function isEnabled() { return !!(cfg && !cfg.off); }

  function boot() {
    loadCfg();
    if (window.KRONOLOJIM_NO_CLOUD) { setState('off'); return; }   // testler için
    if (cfg && cfg.off) { setState('off'); return; }
    if (!cfg && K.firebaseConfig) {
      cfg = { config: K.firebaseConfig, space: K.firebaseSpace || 'ev' };
    }
    if (cfg) connect();
  }

  function hasBuiltIn() { return !!K.firebaseConfig; }

  /* Kesilmiş bağlantıyı gömülü ayarla yeniden kurar. */
  function reconnect() {
    saveCfg(null);
    boot();
  }

  return {
    boot, connect, disconnect, reconnect, hasBuiltIn, onLocalChange,
    status: currentStatus,
    isEnabled: isEnabled,
    error: () => lastError,
    config: () => cfg,
    parseConfig: parseConfig,
    // testler için
    _diff: diff, _fullUpload: fullUpload, _byProfile: byProfile, _clean: clean,
    _setBackend: (b) => { backend = b; },
    _internals: () => ({ ready: ready, applying: applying })
  };
})();
