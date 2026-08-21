/* Uygulamayı iPhone 13 ölçüsünde uçtan uca sürer. */
const { chromium } = require('playwright');

const errs = [];
function ok(cond, msg) { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) errs.push(msg); }

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
  page.on('pageerror', e => errs.push('SAYFA HATASI: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error' && !/ERR_CONNECTION|fonts\.googleapis|gstatic/.test(m.text())) errs.push('KONSOL: ' + m.text());
  });

  await page.addInitScript(() => { window.KRONOLOJIM_NO_CLOUD = true; });
  await page.goto('http://localhost:8899/', { waitUntil: 'networkidle' });

  const noOverflow = async (where) => {
    const r = await page.evaluate(() => ({
      w: document.documentElement.scrollWidth,
      c: document.documentElement.clientWidth
    }));
    ok(r.w <= r.c, 'yatay taşma yok — ' + where + ' (' + r.w + '/' + r.c + ')');
  };

  console.log('\n[1] Karşılama');
  ok(await page.locator('.welcome h1').innerText() === 'Tarih Kronolojim', 'karşılama ekranı çıktı');
  await noOverflow('karşılama');
  await page.click('button:has-text("Onur")');
  await page.click('button:has-text("Örnekle başla")');
  await page.waitForSelector('.stream');

  console.log('\n[2] Akış ve numaralar');
  ok((await page.locator('.bracket .label').innerText()) === 'Kurtuluş Savaşı (1919-22)',
     'kapsam etiketinde yıl yok, ad ne ise o');
  ok((await page.locator('.group-head:has-text("Cepheler")').count()) === 1, 'Cepheler grubu var');
  ok((await page.locator('.ev.consequence').count()) >= 4, 'sonuç kutuları çizildi');
  const nums = await page.evaluate(() => {
    const n = K.model.numbering(K.store.get());
    const byTitle = {};
    K.model.cards(K.store.get()).forEach((e) => { byTitle[e.title] = n[e.id]; });
    return byTitle;
  });
  ok(nums['Malazgirt Savaşı'] === 1 && nums["Samsun'a Çıkış"] === 2 && nums["Cumhuriyet'in İlanı"] === 12,
     'kartlar 1\'den numaralandı (Cumhuriyet = ' + nums["Cumhuriyet'in İlanı"] + ')');
  ok(nums['Kurtuluş Savaşı (1919-22)'] === undefined, 'kapsam numara almadı');
  const seqs = await page.locator('.ev .seq').allInnerTexts();
  ok(seqs[0] === '1', 'kartın sağ altında numara görünüyor');
  ok((await page.locator('.group-row .idx').first().innerText()) === '5', 'grup satırı da genel numarayı taşıyor');
  await noOverflow('liste');

  console.log('\n[3] Kart ekranı');
  await page.click('.ev-title:has-text("Malazgirt Savaşı")');
  await page.waitForSelector('.sheet');
  ok((await page.locator('#f-sd').count()) === 1, 'gün / ay / yıl kutuları duruyor');
  ok((await page.locator('#f-after').count()) === 1, 'Sonucunda kutusu var');
  ok((await page.locator('button#f-parent').count()) === 1, 'kapsam artık dokunulan bir satır');
  ok((await page.locator('#f-parent').innerText()).indexOf('— yok —') >= 0, 'kapsamı yok yazıyor');
  ok((await page.locator('.sheet-back').count()) === 0, 'ilk panelde geri tuşu yok');

  console.log('\n[4] Panel üstüne panel');
  await page.click('#f-parent');
  await page.waitForSelector('.sheet-back');
  ok((await page.locator('.sheet h2').innerText()) === 'Kapsam', 'kapsam seçici açıldı');
  ok((await page.locator('.sheet-back').count()) === 1, 'geri tuşu geldi');
  await page.click('.sheet-back');
  ok((await page.locator('#f-title').inputValue()) === 'Malazgirt Savaşı', 'geri dönünce kart formu yerinde');

  console.log('\n[5] Karttan yeni kapsam açma');
  await page.click('#f-parent');
  await page.waitForSelector('#p-new');
  await page.click('#p-new');
  await page.waitForSelector('#s-title');
  ok((await page.locator('#s-y').count()) === 0 && (await page.locator('#s-note').count()) === 0,
     'kapsam ekranında yıl, not, sonucunda yok');
  ok((await page.locator('#f-group').count()) === 0, 'grup kutusu da yok');
  const firstMember = await page.locator('.member').first().innerText();
  ok(/Malazgirt/.test(firstMember), 'geldiğimiz kart listenin başında: ' + firstMember.replace(/\n/g, ' '));
  ok((await page.locator('.member.on').count()) === 1, 've işaretli geldi');
  await page.fill('#s-title', 'Selçuklu Dönemi');

  // İki işaret arası kendiliğinden dolsun
  await page.locator('.member', { hasText: 'Sivas Kongresi' }).click();
  const picked = await page.locator('.member.on').count();
  ok(picked >= 4, 'iki işaret arası dolduruldu (' + picked + ' kart)');
  ok((await page.locator('#s-count').innerText()).indexOf(String(picked)) === 0, 'sayaç güncellendi');

  await page.fill('#s-q', 'lozan');
  ok((await page.locator('.member').count()) === 1, 'arama kutusu süzüyor');
  await page.fill('#s-q', '');
  await page.click('#s-save');
  await page.waitForSelector('#f-title');
  ok((await page.locator('#f-parent').innerText()).indexOf('Selçuklu Dönemi') >= 0,
     'kaydedince karta dönüldü ve kapsam seçili');
  await page.click('#f-save');
  await page.waitForSelector('.sheet', { state: 'detached' });
  ok((await page.locator('.bracket .label:has-text("Selçuklu Dönemi")').count()) === 1, 'yeni kapsam listede');

  console.log('\n[6] Kapsam kendiliğinden oluşmuyor');
  await page.click('.fab');
  await page.waitForSelector('#f-title');
  await page.fill('#f-title', 'Aralıklı ama kapsam değil');
  await page.fill('#f-sy', '1600');
  await page.check('#f-range');
  await page.fill('#f-ey', '1650');
  await page.click('#f-save');
  await page.waitForSelector('.sheet', { state: 'detached' });
  ok((await page.locator('.ev-title:has-text("Aralıklı ama kapsam değil")').count()) === 1, 'aralıklı olay normal kart');
  ok((await page.locator('.bracket').count()) === 2, 'yeni parantez oluşmadı');

  console.log('\n[7] Kapsamı düzenleme');
  await page.locator('.bracket .label:has-text("Selçuklu")').locator('xpath=../..').locator('.span-edit').first().click();
  await page.waitForSelector('#s-title');
  ok((await page.locator('#s-title').inputValue()) === 'Selçuklu Dönemi', 'kalem kapsamı açtı');
  await page.click('#s-del');
  await page.waitForSelector('.sheet', { state: 'detached' });
  ok((await page.locator('.bracket .label:has-text("Selçuklu")').count()) === 0, 'kapsam silindi');
  ok((await page.locator('.ev-title:has-text("Malazgirt Savaşı")').count()) === 1, 'içindekiler listede kaldı');

  console.log('\n[8] Düzenle modunda soldan silme');
  await page.click('[data-act="edit"]');
  ok((await page.locator('.kill-left').count()) > 5, 'her kartın solunda silme işareti');
  const total = await page.locator('.ev-title').count();
  await page.locator('.ev:has-text("Aralıklı ama kapsam değil") .kill-left').click();
  ok((await page.locator('.ev-title:has-text("Aralıklı ama kapsam değil")').count()) === 0, 'soru sormadan sildi');
  await page.click('[data-act="undo"]');
  ok((await page.locator('.ev-title').count()) === total, 'geri al getirdi');
  await page.click('[data-act="edit"]');

  console.log('\n[9] Kayıt defteri ve detayı');
  // Detayı görebilmek için gerçek bir değişiklik yapıyoruz.
  await page.click('.ev-title:has-text("Erzurum Kongresi")');
  await page.waitForSelector('#f-title');
  await page.fill('#f-title', 'Erzurum Kongresi (ulusal)');
  await page.fill('#f-after', 'Temsil Heyeti kuruldu');
  await page.click('#f-save');
  await page.waitForSelector('.sheet', { state: 'detached' });

  await page.click('[data-act="settings"]');
  await page.waitForSelector('#s-log');
  await page.click('#s-log');
  await page.waitForSelector('.log-row');
  ok((await page.locator('.sheet h2').innerText()) === 'Son değişiklikler', 'kendi paneli açıldı');
  ok((await page.locator('.sheet-back').count()) === 1, 'ayarlar arkada duruyor');
  const rows = await page.locator('.log-row').allInnerTexts();
  ok(rows.length > 3, rows.length + ' kayıt var');
  ok(/Onur/.test(rows[0]), 'en yeni üstte ve kimin yaptığı yazıyor');
  await page.locator('.log-row').filter({ hasText: 'Erzurum' }).first().click();
  await page.waitForSelector('.diff-row');
  const diffs = await page.locator('.diff-row').allInnerTexts();
  ok(diffs.length === 2, 'iki alanın değiştiği yazıyor');
  ok(/Erzurum Kongresi.*→.*ulusal/.test(diffs[0].replace(/\n/g, ' ')),
     'başlık: eski → yeni (' + diffs[0].replace(/\n/g, ' ') + ')');
  ok(/Temsil Heyeti/.test(diffs[1]), 'sonucunda da kayıtlı');
  await page.click('.sheet-back');
  ok((await page.locator('.log-row').count()) > 3, 'geri dönünce kayıt listesi');
  await page.click('.sheet-back');
  ok((await page.locator('#s-log').count()) === 1, 'bir geri daha ayarlara döndü');
  await page.locator('.sheet-x').click();

  console.log('\n[10] Çalışma — kapsam sorusu ve karışıklık');
  await page.click('.due');
  await page.waitForSelector('.q-text');
  const kinds = [];
  let sawSpanQ = false;
  for (let i = 0; i < 20; i++) {
    if (!(await page.locator('.q-kind').count())) break;
    const kind = await page.locator('.q-kind').innerText();
    kinds.push(kind);
    if (kind === 'KAPSAM') {
      sawSpanQ = true;
      const q = await page.locator('.q-text').innerText();
      ok(/ne ile başladı\?$/.test(q), 'kapsam sorusu: ' + q);
    }
    await page.locator('.opt').first().click();
    await page.click('[data-act="next"]');
  }
  ok(sawSpanQ, '"ne ile başladı" sorusu üretildi');
  ok(kinds.indexOf('SONUCUNDA') >= 0, 'sonuç sorusu da geldi');
  ok(new Set(kinds).size >= 3, 'soru tipleri karışık geldi: ' + Array.from(new Set(kinds)).join(', '));
  await page.click('[data-act="close-study"]');

  console.log('\n[11] Ayarlar');
  await page.click('[data-act="settings"]');
  await page.waitForSelector('.sheet');
  ok((await page.locator('#s-theme').count()) === 0, 'görünüm seçeneği yok');
  ok((await page.locator('#s-blind').count()) === 0, 'kör mod ayarı yok');
  ok((await page.locator('#c-off').count()) === 0, 'bulut düğmeleri yok');
  ok((await page.locator('#s-paste').count()) === 1, 'İçe aktar var');
  const dark = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
  ok(dark === 'dark', 'uygulama her zaman karanlık');

  console.log('\n[12] İçe aktarma kipleri');
  await page.click('#s-paste');
  await page.waitForSelector('#i-text');
  const modes = await page.locator('#i-mode .pick-row').allInnerTexts();
  ok(modes.length === 4, 'dört kip var: ' + modes.map((m) => m.split('\n')[0]).join(' / '));
  await page.fill('#i-text', '1453 - İstanbul\'un Fethi\n1683 - II. Viyana Kuşatması');
  await page.waitForTimeout(80);
  ok(/2 olay \(2 tanesi tarihli\)/.test(await page.locator('#i-count').innerText()), 'ne geleceğini söylüyor');
  await page.click('#i-go');
  await page.waitForSelector('#i-text', { state: 'detached' });
  const order = await page.evaluate(() => K.model.cards(K.store.get()).map((e) => e.title));
  const iF = order.indexOf("İstanbul'un Fethi");
  const iM = order.indexOf('Malazgirt Savaşı');
  const iS = order.indexOf("Samsun'a Çıkış");
  ok(iM < iF && iF < iS, 'kronolojik kip 1453\'ü 1071 ile 1919 arasına koydu');

  console.log('\n[13] Şu kartın altına ekleme');
  await page.click('[data-act="settings"]');
  await page.click('#s-paste');
  await page.waitForSelector('#i-text');
  await page.fill('#i-text', 'Bir ara olay\nBir ara olay 2');
  await page.click('.pick-row:has-text("Şu kartın altına")');
  await page.waitForSelector('.member');
  await page.locator('.member', { hasText: 'Sivas Kongresi' }).click();
  await page.click('#i-go');
  await page.waitForSelector('#i-text', { state: 'detached' });
  const after = await page.evaluate(() => K.model.cards(K.store.get()).map((e) => e.title));
  ok(after[after.indexOf('Sivas Kongresi') + 1] === 'Bir ara olay',
     'işaretlenen kartın hemen altına girdi');
  ok(after[after.indexOf('Sivas Kongresi') + 2] === 'Bir ara olay 2', 'ikincisi de sırayla');

  console.log('\n[14] Metin çözümleme');
  const parsed = await page.evaluate(() => {
    const p = K.textimport.parse([
      '1071 - Malazgirt Savaşı | Anadolu\'nun kapıları açıldı',
      '19.05.1919 - Samsun\'a Çıkış',
      '23 Temmuz 1919 — Erzurum Kongresi',
      'Kurtuluş Savaşı  (kapsam — altındakiler bunun içinde)',
      '  - 23-31 Mar 1921 — II. İnönü Savaşı',
      '    ↳ sonucunda: İsmet Bey Dışişleri Bakanı oldu',
      '  - [Cepheler] (grup, sadece sıra)',
      '    1. Doğu Cephesi',
      '~1300 - Osmanlı Beyliği kuruldu',
      'II. Meşrutiyet 1908'
    ].join('\n'));
    const t = {};
    p.events.forEach((e) => { t[e.title] = e; });
    return { p: p, t: t };
  });
  const T = parsed.t;
  ok(T['Malazgirt Savaşı'].start.y === 1071 && /kapıları/.test(T['Malazgirt Savaşı'].note), 'yıl ve not ayrıldı');
  ok(T["Samsun'a Çıkış"].start.d === 19 && T["Samsun'a Çıkış"].start.m === 5, 'noktalı tarih');
  ok(T['Erzurum Kongresi'].start.m === 7, 'uzun ay adı');
  ok(T['Kurtuluş Savaşı'].isSpan === true, 'kapsam işareti okundu');
  ok(T['II. İnönü Savaşı'].parentId === T['Kurtuluş Savaşı'].id, 'girinti kapsama girdi');
  ok(/İsmet Bey/.test(T['II. İnönü Savaşı'].after), 'sonuç satırı bağlandı');
  ok(T['Doğu Cephesi'].groupId === parsed.p.groups[0].id, 'numaralı satır gruba girdi');
  ok(T['Osmanlı Beyliği kuruldu'].approx === true, 'yaklaşık işareti');
  ok(T['II. Meşrutiyet'].start.y === 1908, 'sondaki tarih');

  console.log('\n[15] Kalıcılık');
  await page.reload({ waitUntil: 'networkidle' });
  ok((await page.locator('.topbar .who-name').innerText()) === 'Onur', 'profil hatırlandı');
  ok((await page.locator('.ev').count()) > 5, 'olaylar kaydedildi');
  await noOverflow('yeniden açılış');

  await page.screenshot({ path: process.argv[2] + '/ekran-liste.png' });
  await page.click('[data-act="edit"]');
  await page.screenshot({ path: process.argv[2] + '/ekran-duzenle.png' });

  await browser.close();
  console.log('\n' + (errs.length ? '❌ ' + errs.length + ' sorun:\n - ' + errs.join('\n - ') : '✅ hepsi geçti'));
  process.exit(errs.length ? 1 : 0);
})();
