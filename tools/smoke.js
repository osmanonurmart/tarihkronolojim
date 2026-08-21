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
  ok(await page.locator('.welcome h1').innerText() === 'Kronolojim', 'karşılama ekranı çıktı');
  await noOverflow('karşılama');
  await page.click('button:has-text("Onur")');
  await page.click('button:has-text("Örnekle başla")');
  await page.waitForSelector('.stream');

  console.log('\n[2] Akış');
  ok(await page.locator('.bracket .label').innerText() === 'Kurtuluş Savaşı 1919-22', 'kapsam etiketi doğru');
  ok((await page.locator('.group-head:has-text("Cepheler")').count()) === 1, 'Cepheler grubu var');
  ok((await page.locator('.tag').count()) === 0, 'etiketler kaldırıldı');
  ok((await page.locator('.ev.consequence').count()) >= 4, 'sonuç kutuları çizildi');
  const cons = await page.locator('.ev:has-text("II. İnönü Savaşı")').locator('xpath=following::div[contains(@class,"consequence")][1]').innerText();
  ok(/SONUCUNDA/.test(cons) && /İsmet Bey/.test(cons), 'sonuç kutusu doğru kartın altında: ' + cons.replace(/\n/g, ' '));
  await noOverflow('liste');

  console.log('\n[3] Düzenleme ekranı');
  await page.click('.ev-title:has-text("Malazgirt Savaşı")');
  await page.waitForSelector('.sheet');
  ok((await page.locator('#f-kind').count()) === 0, 'Yok/Yıl/Tam tarih seçicisi kalktı');
  ok((await page.locator('#f-sd').count()) === 1 && (await page.locator('#f-sm').count()) === 1 && (await page.locator('#f-sy').count()) === 1,
     'gün / ay / yıl kutuları hep görünüyor');
  ok((await page.locator('#f-sy').inputValue()) === '1071' && (await page.locator('#f-sd').inputValue()) === '',
     'yıl dolu, gün boş — tarihsiz alanlar boş kalıyor');
  ok((await page.locator('#f-after').count()) === 1, 'Sonucunda kutusu var');
  ok((await page.locator('#f-tags').count()) === 0, 'etiket kutusu kalktı');
  ok((await page.locator('#f-links').count()) === 0, 'eski bağ listesi kalktı');
  ok((await page.locator('.sheet-x').count()) === 1, 'sağ üstte kapatma tuşu var');

  const opts = await page.locator('#f-parent option').allInnerTexts();
  ok(opts[0] === '— yok —' && opts[1] === '+ Yeni kapsam…', 'kapsam listesinde yeni oluştur hemen altta: ' + opts.slice(0, 3).join(' / '));
  const gopts = await page.locator('#f-group option').allInnerTexts();
  ok(gopts[1] === '+ Yeni grup…', 'grup listesinde de aynı sıra');
  await noOverflow('düzenleme paneli');

  console.log('\n[4] Panel kaydırması arkayı oynatmıyor');
  await page.locator('.sheet-x').click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(120);
  const before = await page.evaluate(() => window.scrollY);
  ok(before > 50, 'sayfa gerçekten kaydırıldı (' + before + 'px) — sınama boş değil');
  await page.click('[data-act="settings"]');
  await page.waitForSelector('.sheet');
  const locked = await page.evaluate(() => getComputedStyle(document.body).position);
  ok(locked === 'fixed', 'panel açıkken arka plan kilitli');
  await page.locator('.sheet-x').click();
  const after = await page.evaluate(() => window.scrollY);
  ok(Math.abs(after - before) < 3, 'panel kapanınca aynı yere dönüldü (' + before + ' → ' + after + ')');

  console.log('\n[5] Yeni kapsamı panelden oluşturma');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('.fab');
  await page.waitForSelector('.sheet');
  await page.fill('#f-title', 'Kanuni Dönemi Olayı');
  await page.fill('#f-sy', '1530');
  await page.selectOption('#f-parent', '__new');
  await page.waitForSelector('.inline-new');
  ok(true, 'satır içi kapsam formu açıldı');
  await page.fill('.inline-new [data-name]', 'Kanuni Dönemi');
  await page.fill('.inline-new [data-from]', '1520');
  await page.fill('.inline-new [data-to]', '1566');
  await page.click('.inline-new [data-create]');
  await page.waitForSelector('.inline-new', { state: 'detached' });
  ok((await page.locator('#f-title').inputValue()) === 'Kanuni Dönemi Olayı', 'form kaybolmadı');
  const sel = await page.locator('#f-parent').inputValue();
  ok(sel !== '' && sel !== '__new', 'yeni kapsam seçili geldi');
  await page.click('#f-save');
  await page.waitForSelector('.sheet', { state: 'detached' });
  ok((await page.locator('.bracket .label:has-text("Kanuni Dönemi 1520-66")').count()) === 1, 'yeni kapsam parantez oldu');
  ok((await page.locator('.ev-title:has-text("Kanuni Dönemi Olayı")').count()) === 1, 'olay kapsamın içine girdi');

  console.log('\n[6] Kapsam kendiliğinden oluşmuyor');
  await page.click('.fab');
  await page.waitForSelector('.sheet');
  await page.fill('#f-title', 'Aralıklı ama kapsam değil');
  await page.fill('#f-sy', '1600');
  await page.check('#f-range');
  await page.fill('#f-ey', '1650');
  await page.click('#f-save');
  await page.waitForSelector('.sheet', { state: 'detached' });
  ok((await page.locator('.ev-title:has-text("Aralıklı ama kapsam değil")').count()) === 1, 'aralıklı olay normal kart olarak durdu');
  ok((await page.locator('.bracket').count()) === 2, 'yeni parantez oluşmadı (hâlâ 2 kapsam)');

  console.log('\n[7] Kapsamı düzenlemeye her zaman ulaşılıyor');
  ok((await page.locator('.span-edit').count()) >= 2, 'parantezlerin tepesinde kalem var');
  await page.locator('.bracket .label:has-text("Kanuni")').locator('xpath=../..').locator('.span-edit').first().click();
  await page.waitForSelector('.sheet');
  ok((await page.locator('#f-title').inputValue()) === 'Kanuni Dönemi', 'kalem kapsamı açtı');
  await page.click('#f-del');
  await page.waitForSelector('.sheet', { state: 'detached' });
  ok((await page.locator('.bracket .label:has-text("Kanuni")').count()) === 0, 'kapsam silindi');
  ok((await page.locator('.ev-title:has-text("Kanuni Dönemi Olayı")').count()) === 1, 'içindeki olay listede kaldı');

  console.log('\n[8] Düzenle modunda soldan silme');
  await page.click('[data-act="edit"]');
  ok((await page.locator('.kill-left').count()) > 5, 'her kartın solunda silme işareti var');
  const total = await page.locator('.ev-title').count();
  await page.locator('.ev:has-text("Aralıklı ama kapsam değil") .kill-left').click();
  ok((await page.locator('.ev-title:has-text("Aralıklı ama kapsam değil")').count()) === 0, 'soru sormadan sildi');
  await page.click('[data-act="undo"]');
  ok((await page.locator('.ev-title').count()) === total, 'geri al düğmesi geri getirdi');
  await page.click('[data-act="edit"]');

  console.log('\n[9] Kayıt defteri');
  await page.click('[data-act="settings"]');
  await page.waitForSelector('.sheet');
  const logRows = await page.locator('.log-row').count();
  ok(logRows > 3, 'kayıt defterinde ' + logRows + ' satır var');
  const first = await page.locator('.log-row').first().innerText();
  ok(/Onur/.test(first), 'kimin yaptığı yazıyor: ' + first.replace(/\n/g, ' '));
  await page.locator('.sheet-x').click();

  console.log('\n[10] Çalışma — sonuç sorusu');
  await page.click('.due');
  await page.waitForSelector('.q-text');
  let sawAfter = false;
  for (let i = 0; i < 25; i++) {
    const kind = await page.locator('.q-kind').innerText();
    if (kind === 'SONUCUNDA') {
      sawAfter = true;
      const q = await page.locator('.q-text').innerText();
      ok(/sonucunda ne oldu\?$/.test(q), 'soru metni: ' + q);
      ok((await page.locator('.opt').count()) === 4, 'dört şık var');
      break;
    }
    if ((await page.locator('.opt').count()) === 0) break;
    await page.locator('.opt').first().click();
    await page.click('[data-act="next"]');
  }
  ok(sawAfter, 'sonuç sorusu üretildi');
  await page.click('[data-act="close-study"]');

  console.log('\n[11] Kör mod ve katlama');
  await page.click('[data-act="blind"]');
  ok((await page.locator('.blindmark').count()) > 3, 'tarihler gizlendi');
  await page.click('[data-act="blind"]');
  await page.locator('.bracket').first().click();
  ok((await page.locator('.collapsed-span').count()) === 1, 'kapsam katlandı');
  await page.locator('.collapsed-span').click();
  ok((await page.locator('.bracket').count()) === 1, 'tekrar açıldı');

  console.log('\n[12] Kalıcılık ve temalar');
  await page.reload({ waitUntil: 'networkidle' });
  ok((await page.locator('.topbar .who-name').innerText()) === 'Onur', 'profil hatırlandı');
  ok((await page.locator('.ev').count()) > 5, 'olaylar kaydedildi');
  await page.click('[data-act="settings"]');
  await page.click('[data-theme="light"]');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(bg === 'rgb(243, 244, 248)', 'açık tema uygulandı');
  await noOverflow('açık tema');
  await page.click('[data-theme="dark"]');
  await page.locator('.sheet-x').click();

  await page.screenshot({ path: process.argv[2] + '/ekran-liste.png' });
  await page.click('[data-act="edit"]');
  await page.screenshot({ path: process.argv[2] + '/ekran-duzenle.png' });

  await browser.close();
  console.log('\n' + (errs.length ? '❌ ' + errs.length + ' sorun:\n - ' + errs.join('\n - ') : '✅ hepsi geçti'));
  process.exit(errs.length ? 1 : 0);
})();
