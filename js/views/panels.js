window.K = window.K || {};

/* Karşılama, profil / liste / ayar panelleri, aktarım ve örnek veri. */
K.panels = (function () {
  const esc = K.util.esc;

  /* ---- Karşılama: kim çalışıyor? ---- */
  function welcome(db) {
    return '<div class="welcome">' +
      '<div>' +
        '<h1>Kronolojim</h1>' +
        '<p>Kim çalışıyor?</p>' +
      '</div>' +
      '<div class="pick">' +
        db.profiles.map((p) =>
          '<button class="pick-row" data-act="pick-profile" data-id="' + p.id + '">' +
            '<span class="avatar">' + esc(K.util.initials(p.name)) + '</span>' +
            '<span>' + esc(p.name) + '</span>' +
          '</button>').join('') +
        '<button class="pick-row" data-act="new-profile"><span class="avatar">+</span><span>Yeni kişi</span></button>' +
      '</div>' +
      '<p class="hint">Seçtiğin kişi hatırlanır — bir daha sorulmaz. Üstteki isme dokunarak değiştirebilirsin.</p>' +
    '</div>';
  }

  /* ---- Profil paneli ---- */
  function profiles() {
    const db = K.store.get();
    K.sheet.open(
      '<h2>Kim çalışıyor?</h2>' +
      '<div class="pick">' +
        db.profiles.map((p) =>
          '<div class="pick-row ' + (p.id === db.ui.profileId ? 'on' : '') + '">' +
            '<span class="avatar">' + esc(K.util.initials(p.name)) + '</span>' +
            '<button style="flex:1;text-align:left" data-act="pick-profile" data-id="' + p.id + '">' + esc(p.name) + '</button>' +
            '<button class="kill" data-act="rename-profile" data-id="' + p.id + '" aria-label="Adını değiştir">✎</button>' +
            (db.profiles.length > 1 ? '<button class="kill" data-act="del-profile" data-id="' + p.id + '" aria-label="Sil">✕</button>' : '') +
          '</div>').join('') +
        '<button class="pick-row" data-act="new-profile"><span class="avatar">+</span><span>Yeni kişi</span></button>' +
      '</div>' +
      '<p class="hint" style="margin-top:.8rem">Olaylar herkeste ortak; hangi olayı ne kadar bildiğin kişiye özel tutulur.</p>'
    );
  }

  /* ---- Liste paneli ---- */
  function lists() {
    const db = K.store.get();
    K.sheet.open(
      '<h2>Liste</h2>' +
      '<div class="pick">' +
        db.lists.map((l) => {
          const n = db.events.filter((e) => e.listId === l.id).length;
          return '<div class="pick-row ' + (l.id === db.ui.listId ? 'on' : '') + '">' +
            '<button style="flex:1;text-align:left" data-act="pick-list" data-id="' + l.id + '">' + esc(l.name) + '</button>' +
            '<span class="sub mono">' + n + '</span>' +
            '<button class="kill" data-act="rename-list" data-id="' + l.id + '" aria-label="Adını değiştir">✎</button>' +
            (db.lists.length > 1 ? '<button class="kill" data-act="del-list" data-id="' + l.id + '" aria-label="Sil">✕</button>' : '') +
          '</div>';
        }).join('') +
        '<button class="pick-row" data-act="new-list"><span class="avatar">+</span><span>Yeni liste</span></button>' +
      '</div>'
    );
  }

  /* ---- Ayarlar ---- */
  function settings() {
    const db = K.store.get();
    const themeNow = db.ui.theme;
    K.sheet.open(
      '<h2>Ayarlar</h2>' +

      '<div class="field">' +
        '<label>Görünüm</label>' +
        '<div class="seg" id="s-theme">' +
          '<button type="button" data-theme="dark" class="' + (themeNow === 'dark' ? 'on' : '') + '">Karanlık</button>' +
          '<button type="button" data-theme="light" class="' + (themeNow === 'light' ? 'on' : '') + '">Açık</button>' +
          '<button type="button" data-theme="system" class="' + (themeNow === 'system' ? 'on' : '') + '">Sistem</button>' +
        '</div>' +
      '</div>' +

      '<div class="field">' +
        '<label>Kör mod</label>' +
        '<label class="check"><input type="checkbox" id="s-blind" ' + (db.ui.blind ? 'checked' : '') + '> Tarihleri gizle</label>' +
        '<div class="hint">Kartlarda tarih görünmez, dokununca tek tek açılır. Puanlamaya girmez.</div>' +
      '</div>' +

      '<div class="field">' +
        '<label>Yedek</label>' +
        '<div class="row">' +
          '<button class="btn" id="s-export" type="button">Dosya indir</button>' +
          '<button class="btn" id="s-copy" type="button">Metni kopyala</button>' +
        '</div>' +
        '<div class="hint">Kopyalanan metni yapay zekaya yapıştırıp yanlış tarih var mı diye sorabilirsin.</div>' +
        '<label class="btn" style="margin-top:.5rem">Dosyadan geri yükle' +
          '<input type="file" id="s-import" accept="application/json,.json" style="display:none">' +
        '</label>' +
      '</div>' +

      cloudSection() +

      logSection() +

      '<div class="field">' +
        '<label>Tehlikeli</label>' +
        '<button class="btn danger" id="s-reset" type="button">Her şeyi sil</button>' +
      '</div>',

      function (root) {
        bindCloud(root);
        root.querySelector('#s-theme').addEventListener('click', (e) => {
          const b = e.target.closest('[data-theme]');
          if (!b) return;
          K.store.quiet((d) => { d.ui.theme = b.getAttribute('data-theme'); });
          K.app.applyTheme();
          settings();
        });
        root.querySelector('#s-blind').addEventListener('change', (e) => {
          K.store.quiet((d) => { d.ui.blind = e.target.checked; });
        });
        root.querySelector('#s-export').addEventListener('click', exportFile);
        root.querySelector('#s-copy').addEventListener('click', copyText);
        root.querySelector('#s-import').addEventListener('change', importFile);
        root.querySelector('#s-reset').addEventListener('click', () => {
          if (!K.util.confirmAsk('Bütün listeler, olaylar ve ilerleme silinecek. Emin misin?')) return;
          localStorage.removeItem('kronolojim.v1');
          location.reload();
        });
      }
    );
  }


  /* ---- Bulut ---- */
  const CLOUD_LABEL = {
    off: 'Kapalı — veriler yalnızca bu cihazda',
    first: 'İlk eşitleme yapılıyor…',
    connecting: 'Bağlanılıyor…',
    online: 'Bağlı — değişiklikler anında eşitleniyor',
    offline: 'Çevrimdışı — bağlantı gelince eşitlenecek',
    error: 'Bağlanamadı'
  };

  function cloudSection() {
    const st = K.cloud.status();
    const cfg = K.cloud.config();
    const err = K.cloud.error();
    const off = !cfg || cfg.off;

    if (off) {
      return '<div class="field"><label>Bulut</label>' +
        '<div class="pick-row" style="gap:.5rem">' +
          '<span class="cloud-dot off"></span>' +
          '<span style="flex:1">Kapalı — veriler yalnızca bu cihazda</span>' +
        '</div>' +
        (K.cloud.hasBuiltIn()
          ? '<button class="btn primary" id="c-on" type="button" style="margin-top:.5rem">Yeniden bağlan</button>'
          : '<div class="hint" style="margin-top:.5rem">Bu sürümde gömülü bir Firebase ayarı yok.</div>') +
      '</div>';
    }

    return '<div class="field"><label>Bulut</label>' +
      '<div class="pick-row" style="gap:.5rem">' +
        '<span class="cloud-dot ' + st + '"></span>' +
        '<span style="flex:1">' + esc(CLOUD_LABEL[st] || st) + '</span>' +
      '</div>' +
      '<div class="hint" style="margin:.4rem 0">Proje: <b>' + esc(cfg.config.projectId) + '</b> · Ev kodu: <b>' + esc(cfg.space) + '</b></div>' +
      (err ? '<div class="hint" style="color:var(--bad)">' + esc(err) + '</div>' : '') +
      '<div class="row" style="margin-top:.5rem">' +
        '<button class="btn" id="c-retry" type="button">Yeniden dene</button>' +
        '<button class="btn danger" id="c-off" type="button">Bağlantıyı kes</button>' +
      '</div>' +
    '</div>';
  }

  function bindCloud(root) {
    const on = root.querySelector('#c-on');
    if (on) on.addEventListener('click', () => {
      K.sheet.close();
      K.cloud.reconnect();
      K.util.toast('Bağlanılıyor…');
    });

    const retry = root.querySelector('#c-retry');
    if (retry) retry.addEventListener('click', () => { K.sheet.close(); K.cloud.connect(); });

    const off = root.querySelector('#c-off');
    if (off) off.addEventListener('click', () => {
      if (!K.util.confirmAsk('Bulut bağlantısı kesilsin mi? Veriler bu cihazda kalır, bu cihaz artık eşitlenmez.')) return;
      K.cloud.disconnect();
      K.sheet.close();
      K.util.toast('Bağlantı kesildi');
    });
  }

  /* ---- Kayıt defteri ---- */
  function logSection() {
    const db = K.store.get();
    const rows = (db.log || []).slice(0, 20).map((e) => {
      const t = new Date(e.ts);
      const when = t.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) +
        ' ' + t.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      return '<div class="log-row">' +
        '<span class="log-when mono">' + esc(when) + '</span>' +
        '<span class="log-who">' + esc(e.by) + '</span>' +
        '<span class="log-what">' + esc(e.title ? '"' + e.title + '" ' + e.action : e.action) + '</span>' +
      '</div>';
    }).join('');

    return '<div class="field"><label>Son değişiklikler</label>' +
      (rows ? '<div class="log">' + rows + '</div>'
            : '<div class="hint">Henüz bir değişiklik yok.</div>') +
      '<div class="hint">Günlük tekrarlar buraya yazılmaz — sadece kart ekleme, değiştirme ve silme.</div>' +
    '</div>';
  }

  /* ---- Aktarım ---- */
  function exportFile() {
    const db = K.store.get();
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'kronolojim-' + K.util.todayISO() + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function outline(db) {
    const lines = [];
    function walk(parentId, depth) {
      K.model.childrenOf(db, parentId).forEach((node) => {
        const pad = '  '.repeat(depth);
        if (node.t === 'gr') {
          lines.push(pad + '- [' + node.gr.name + '] (grup, sadece sıra)');
          K.model.eventsOfGroup(db, node.gr.id).forEach((e, i) => {
            lines.push(pad + '  ' + (i + 1) + '. ' + e.title + (e.note ? ' — ' + e.note : ''));
          });
          return;
        }
        const ev = node.ev;
        const date = K.model.fmtEvent(ev);
        const span = K.model.isSpan(ev) ? '  (kapsam — altındakiler bu aralığın içinde)' : '';
        lines.push(pad + '- ' + (date ? date + ' — ' : '(tarihsiz) ') + ev.title +
                   (ev.note ? ' — ' + ev.note : '') + span);
        if (ev.after) lines.push(pad + '  ↳ sonucunda: ' + ev.after);
        if (K.model.isSpan(ev)) walk(ev.id, depth + 1);
      });
    }
    walk(null, 0);
    const l = K.store.list();
    return '# ' + (l ? l.name : 'Liste') + '\n\n' + lines.join('\n') + '\n';
  }

  function copyText() {
    const text = outline(K.store.get());
    const done = () => K.util.toast('Kopyalandı');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else fallbackCopy(text, done);
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); }
    catch (e) { K.util.toast('Kopyalanamadı.'); }
    ta.remove();
  }

  function importFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.events) || !Array.isArray(data.lists)) {
          throw new Error('biçim');
        }
        K.store.replaceAll(data);
        K.sheet.close();
        K.util.toast('Yedek yüklendi', 'Geri al', () => K.store.undo());
      } catch (err) {
        K.util.toast('Dosya okunamadı — geçerli bir yedek değil.');
      }
    };
    reader.readAsText(file);
  }

  /* ---- Örnek veri ---- */
  function samples() {
    K.store.mutate((db) => {
      const lid = db.ui.listId;
      let o = 1000;
      const mk = (title, start, extra) => {
        const ev = Object.assign(K.model.blank(lid), { title: title, start: start, order: o }, extra || {});
        o += 10;
        db.events.push(ev);
        return ev;
      };

      mk('Malazgirt Savaşı', { y: 1071, m: null, d: null },
        { note: 'Anadolu\'nun kapıları açıldı', after: 'Anadolu\'ya Türk göçü hızlandı' });

      const kurtulus = mk('Kurtuluş Savaşı', { y: 1919, m: null, d: null },
        { end: { y: 1922, m: null, d: null }, isSpan: true });

      const inSpan = { parentId: kurtulus.id };
      mk('Samsun\'a Çıkış', { y: 1919, m: 5, d: 19 }, inSpan);
      mk('Erzurum Kongresi', { y: 1919, m: 7, d: 23 },
        Object.assign({ note: 'Bölgesel değil, ulusal karar' }, inSpan));
      mk('Sivas Kongresi', { y: 1919, m: 9, d: 4 }, inSpan);

      const g = { id: K.util.uid(), listId: lid, name: 'Cepheler', parentId: kurtulus.id, order: o };
      o += 10;
      db.groups.push(g);
      let go = 1000;
      ['Doğu Cephesi', 'Güney Cephesi', 'Batı Cephesi'].forEach((n) => {
        db.events.push(Object.assign(K.model.blank(lid), { title: n, groupId: g.id, order: go }));
        go += 10;
      });

      mk('I. İnönü Savaşı', { y: 1921, m: 1, d: 6 },
        Object.assign({ end: { y: 1921, m: 1, d: 10 }, after: 'Londra Konferansı toplandı' }, inSpan));
      mk('II. İnönü Savaşı', { y: 1921, m: 3, d: 23 },
        Object.assign({ end: { y: 1921, m: 3, d: 31 }, after: 'İsmet Bey Dışişleri Bakanı oldu' }, inSpan));
      mk('Sakarya Meydan Muharebesi', { y: 1921, m: 8, d: 23 },
        Object.assign({ end: { y: 1921, m: 9, d: 13 }, after: 'Mustafa Kemal\'e Gazi unvanı verildi' }, inSpan));

      mk('Lozan Antlaşması', { y: 1923, m: 7, d: 24 }, { after: 'Yeni devlet uluslararası olarak tanındı' });
      mk('Cumhuriyet\'in İlanı', { y: 1923, m: 10, d: 29 }, { after: 'Mustafa Kemal ilk cumhurbaşkanı oldu' });
    }, { action: 'örnekler eklendi' });
    K.util.toast('Örnekler eklendi', 'Geri al', () => K.store.undo());
  }

  return { welcome, profiles, lists, settings, samples, outline };
})();
