const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await p.goto('http://localhost:8899/', { waitUntil: 'networkidle' });
  await p.click('button:has-text("Onur")');
  await p.click('button:has-text("Örnekle başla")');
  await p.waitForSelector('.stream');
  await p.mouse.wheel(0, 700);
  await p.waitForTimeout(200);
  await p.screenshot({ path: out + '/s-kaydirma.png' });

  // tarih sorusu bulana kadar ilerle
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.click('.due');
  for (let i = 0; i < 12; i++) {
    const kind = await p.locator('.q-kind').innerText();
    if (kind === 'TARİH') break;
    await p.locator('.opt').first().click();
    await p.click('[data-act="next"]');
  }
  await p.screenshot({ path: out + '/s-tarih-sorusu.png' });
  await p.locator('.opt').first().click();
  await p.waitForTimeout(150);
  await p.screenshot({ path: out + '/s-cevap.png' });

  await p.click('[data-act="close-study"]');
  await p.click('[data-act="settings"]');
  await p.click('[data-theme="light"]');
  await p.keyboard.press('Escape');
  await p.click('[data-act="edit"]');
  await p.waitForTimeout(150);
  await p.screenshot({ path: out + '/s-acik-duzenle.png' });
  await b.close();
  console.log('ekran görüntüleri hazır');
})();
