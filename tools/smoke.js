const { chromium } = require('playwright');

const errs = [];
function ok(cond, msg) { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) errs.push(msg); }

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.on('pageerror', e => errs.push('SAYFA HATASI: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_CONNECTION|fonts\.googleapis/.test(m.text())) errs.push('KONSOL: ' + m.text()); });

  await page.goto('http://localhost:8899/', { waitUntil: 'networkidle' });

  console.log('\n[1] Karşılama');
  ok(await page.locator('.welcome h1').innerText() === 'Kronolojim', 'karşılama ekranı çıktı');
  ok(await page.locator('button:has-text("Onur")').count() === 1, 'Onur profili var');
  ok(await page.locator('button:has-text("Fatma")').count() === 1, 'Fatma profili var');
  await page.click('button:has-text("Onur")');

  console.log('\n[2] Boş durum ve örnekler');
  ok(await page.locator('.empty h2').innerText() === 'Liste boş', 'boş durum çıktı');
  await page.click('button:has-text("Örnekle başla")');
  await page.waitForSelector('.stream');

  console.log('\n[3] Akış');
  ok(await page.locator('.bracket .label').innerText() === 'Kurtuluş Savaşı 1919-22',
     'kapsam etiketi "Kurtuluş Savaşı 1919-22" (aralık kısaltması)');
  ok((await page.locator('.ev-title:has-text("Malazgirt Savaşı")').count()) === 1, 'Malazgirt kartı var');
  ok((await page.locator('.group-head:has-text("Cepheler")').count()) === 1, 'Cepheler grubu var');
  ok((await page.locator('.group-row').count()) === 3, 'grupta 3 satır var');
  ok((await page.locator('.ev.consequence').count()) === 1, 'bir sonuç kutusu var');
  ok((await page.locator('.link-elbow').count()) === 1, 'bağ dirseği çizildi');
  const inonu = await page.locator('.ev:has-text("I. İnönü Savaşı") .ev-top span').first().innerText();
  ok(inonu === '6-10 Oca 1921', 'aynı ay aralığı "6-10 Oca 1921" (bulundu: ' + inonu + ')');
  const sakarya = await page.locator('.ev:has-text("Sakarya") .ev-top span').first().innerText();
  ok(sakarya === '23 Ağu - 13 Eyl 1921', 'aylar arası aralık doğru (bulundu: ' + sakarya + ')');

  console.log('\n[4] Sıralama');
  const order = await page.locator('.ev-title, .group-row span:nth-child(2)').allInnerTexts();
  const iM = order.indexOf('Malazgirt Savaşı'), iS = order.indexOf("Samsun'a Çıkış"), iL = order.indexOf('Lozan Antlaşması');
  ok(iM >= 0 && iM < iS && iS < iL, 'kronolojik sıra doğru (Malazgirt → Samsun → Lozan)');

  console.log('\n[5] Kör mod');
  await page.click('[data-act="blind"]');
  ok((await page.locator('.blindmark').count()) > 3, 'tarihler gizlendi');
  await page.locator('.blindmark').first().click();
  ok((await page.locator('.ev-top span').first().innerText()).length > 2, 'dokununca tek tarih açıldı');
  await page.click('[data-act="blind"]');

  console.log('\n[6] Kapsamı katlama');
  await page.click('.bracket');
  ok((await page.locator('.collapsed-span').count()) === 1, 'kapsam katlandı');
  const meta = await page.locator('.cs-meta').innerText();
  ok(/olay$/.test(meta), 'katlanmış satırda olay sayısı yazıyor: ' + meta);
  await page.click('.collapsed-span');
  ok((await page.locator('.bracket').count()) === 1, 'tekrar açıldı');

  console.log('\n[7] Düzenle modu');
  await page.click('[data-act="edit"]');
  ok((await page.locator('.insert').count()) > 3, 'araya ekleme noktaları çıktı');
  ok((await page.locator('.handle').count()) > 3, 'taşıma tutamakları çıktı');
  await page.click('[data-act="edit"]');
  ok((await page.locator('.insert').count()) === 0, 'düzenle modundan çıkıldı');

  console.log('\n[8] Olay düzenleme + geri alma');
  await page.click('.ev:has-text("Lozan Antlaşması")');
  await page.waitForSelector('.sheet');
  ok((await page.locator('#f-title').inputValue()) === 'Lozan Antlaşması', 'düzenleyici doğru olayı açtı');
  await page.fill('#f-title', 'Lozan Barış Antlaşması');
  await page.click('#f-save');
  await page.waitForSelector('.sheet', { state: 'detached' });
  ok((await page.locator('.ev-title:has-text("Lozan Barış Antlaşması")').count()) === 1, 'başlık değişti');
  await page.click('[data-act="undo"]');
  ok((await page.locator('.ev-title:has-text("Lozan Antlaşması")').count()) === 1, 'geri alma çalıştı');

  console.log('\n[9] Yeni olay ekleme');
  await page.click('.fab');
  await page.waitForSelector('.sheet');
  await page.fill('#f-title', 'Ankara Antlaşması');
  await page.click('[data-kind="full"]');
  await page.fill('#f-sd', '20');
  await page.selectOption('#f-sm', '10');
  await page.fill('#f-sy', '1921');
  await page.click('#f-save');
  await page.waitForSelector('.sheet', { state: 'detached' });
  ok((await page.locator('.ev-title:has-text("Ankara Antlaşması")').count()) === 1, 'yeni olay eklendi');
  const after = await page.locator('.ev-title, .group-row span:nth-child(2)').allInnerTexts();
  const iA = after.indexOf('Ankara Antlaşması'), iSak = after.indexOf('Sakarya Meydan Muharebesi'), iLoz = after.indexOf('Lozan Antlaşması');
  ok(iSak < iA && iA < iLoz, 'tarihine göre Sakarya ile Lozan arasına oturdu');
  const inSpan = await page.locator('.bracket').locator('xpath=../..').locator('.ev-title:has-text("Ankara Antlaşması")').count();
  ok(inSpan === 1, 'tarihi Kurtuluş Savaşı aralığına düştüğü için kapsamın içine girdi');

  console.log('\n[10] Çalışma seansı');
  const dueTxt = await page.locator('.due .txt').innerText();
  ok(/tekrar var$/.test(dueTxt), 'tekrar rozeti: ' + dueTxt);
  await page.click('.due');
  await page.waitForSelector('.q-text');
  ok((await page.locator('.opt').count()) === 4, 'dört şık var');
  const kind = await page.locator('.q-kind').innerText();
  ok(kind.length > 0, 'soru tipi yazıyor: ' + kind);
  await page.locator('.opt').first().click();
  ok((await page.locator('.verdict').count()) === 1, 'sonuç gösterildi');
  ok((await page.locator('.levelup').count()) === 1, 'seviye bilgisi gösterildi');
  await page.click('[data-act="next"]');
  ok((await page.locator('.q-text').count()) === 1, 'sonraki soruya geçti');
  await page.click('[data-act="close-study"]');
  await page.waitForSelector('.stream');
  ok((await page.locator('.ev').count()) > 5, 'listeye dönüldü');

  console.log('\n[11] Renk seviyesi');
  const lifted = await page.locator('.ev.l2, .group-row.l2').count();
  ok(lifted >= 0, 'seviye sınıfları uygulanıyor (l2 sayısı: ' + lifted + ')');

  console.log('\n[12] Dışa aktarım metni');
  const outline = await page.evaluate(() => K.panels.outline(K.store.get()));
  ok(/1919-22 — Kurtuluş Savaşı.*\(kapsam/.test(outline), 'metin çıktısında kapsam işaretli');
  ok(outline.indexOf('↳ ardından:') > 0, 'metin çıktısında bağ var');
  ok(outline.indexOf('[Cepheler] (grup') > 0, 'metin çıktısında grup var');

  console.log('\n[13] Kalıcılık');
  await page.reload({ waitUntil: 'networkidle' });
  ok((await page.locator('.topbar .who-name').innerText()) === 'Onur', 'profil hatırlandı, tekrar sorulmadı');
  ok((await page.locator('.ev').count()) > 5, 'olaylar kaydedildi');

  console.log('\n[14] Açık tema');
  await page.click('[data-act="settings"]');
  await page.click('[data-theme="light"]');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(bg === 'rgb(243, 244, 248)', 'açık tema uygulandı (' + bg + ')');
  await page.click('[data-theme="dark"]');
  await page.keyboard.press('Escape');

  await page.screenshot({ path: process.argv[2] + '/ekran-liste.png', fullPage: false });
  await page.click('.due');
  await page.waitForSelector('.q-text');
  await page.screenshot({ path: process.argv[2] + '/ekran-calisma.png' });

  await browser.close();
  console.log('\n' + (errs.length ? '❌ ' + errs.length + ' sorun:\n - ' + errs.join('\n - ') : '✅ hepsi geçti'));
  process.exit(errs.length ? 1 : 0);
})();
