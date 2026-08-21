/* Bulut senkronunu sahte bir Firestore ile uçtan uca sınar:
   ilk yükleme, uzaktan gelen değişiklik, yerel değişikliğin yollanması,
   silme ve iki tarafta da veri varken sorulan uzlaştırma. */
const { chromium } = require('playwright');

const errs = [];
function ok(cond, msg) { console.log((cond ? '  ✓ ' : '  ✗ ') + msg); if (!cond) errs.push(msg); }

const FAKE = `
window.FAKE = {
  docs: { lists: [], profiles: [], groups: [], events: [], progress: [] },
  cbs: {},
  ops: [],
  async init() {},
  watch(space, col, cb) {
    this.cbs[col] = cb;
    setTimeout(() => cb(this.docs[col].slice()), 0);
    return () => { delete this.cbs[col]; };
  },
  async commit(space, ops) {
    ops.forEach(op => {
      this.ops.push(op);
      const arr = this.docs[op.col];
      const i = arr.findIndex(d => d.id === op.id);
      if (op.del) { if (i >= 0) arr.splice(i, 1); return; }
      const doc = Object.assign({}, op.data, { id: op.id });
      if (i >= 0) arr[i] = doc; else arr.push(doc);
    });
    setTimeout(() => Object.keys(this.cbs).forEach(c => this.cbs[c](this.docs[c].slice())), 0);
  },
  push(col, docs) { this.docs[col] = docs; if (this.cbs[col]) this.cbs[col](docs.slice()); }
};
`;

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => errs.push('SAYFA HATASI: ' + e.message));
  await page.goto('http://localhost:8899/', { waitUntil: 'networkidle' });

  console.log('\n[1] Saf işlevler');
  const pure = await page.evaluate(() => {
    const before = { lists: [{ id: 'l1', name: 'A' }], profiles: [], groups: [], events: [{ id: 'e1', title: 'X' }], progress: {} };
    const after = { lists: [{ id: 'l1', name: 'A' }], profiles: [], groups: [], events: [{ id: 'e1', title: 'Y' }, { id: 'e2', title: 'Z' }], progress: { 'p1|e1|date': { level: 2 } } };
    const ops = K.cloud._diff(before, after);
    return {
      ops: ops,
      noop: K.cloud._diff(after, after).length,
      del: K.cloud._diff(after, before).filter(o => o.del).map(o => o.id),
      grouped: K.cloud._byProfile({ 'p1|e1|date': 1, 'p2|e1|order': 2 }),
      clean: K.cloud._clean({ a: undefined, b: { c: undefined }, d: [1, undefined] }),
      cfg: K.cloud.parseConfig(`const firebaseConfig = { apiKey: 'AIza', projectId: "demo", appId: '1:2:web:3', };`),
      // Konsoldan olduğu gibi kopyalanan tam parça: import satırları, yorumlar, sondaki çağrılar
      whole: K.cloud.parseConfig([
        '// Import the functions you need from the SDKs you need',
        'import { initializeApp } from "firebase/app";',
        'import { getAnalytics } from "firebase/analytics";',
        '// TODO: Add SDKs for Firebase products that you want to use',
        '',
        'const firebaseConfig = {',
        '  apiKey: "AIzaSyBxxx",',
        '  authDomain: "demo-a8405.firebaseapp.com",',
        '  projectId: "demo-a8405",',
        '  storageBucket: "demo-a8405.firebasestorage.app",',
        '  messagingSenderId: "1046716939644",',
        '  appId: "1:1046716939644:web:20b707e2185267e4b9f8f9",',
        '  measurementId: "G-W372NKJ3YL"',
        '};',
        '',
        'const app = initializeApp(firebaseConfig);',
        'const analytics = getAnalytics(app);'
      ].join('\n')),
      bad: (() => { try { K.cloud.parseConfig('merhaba'); return 'hata yok'; } catch (e) { return 'reddedildi'; } })(),
      masked: (() => {
        try { K.cloud.parseConfig('const c = { apiKey: "AIzaSyBL\u2022\u2022\u2022\u2022\u2022\u2022", projectId: "x" };'); return 'hata yok'; }
        catch (e) { return e.message; }
      })(),
      // Konsolun kutusu anahtarı satırlara bölerek gösteriyor
      wrapped: K.cloud.parseConfig('const c = {\n  apiKey: "\nAIzaSyReal123\n",\n  projectId: "demo-a8405"\n};')
    };
  });
  ok(pure.ops.length === 3, 'fark üç işlem üretti (değişen olay, yeni olay, ilerleme) — ' + pure.ops.length);
  ok(pure.ops.some(o => o.col === 'events' && o.id === 'e1'), 'değişen olay yollanıyor');
  ok(pure.ops.some(o => o.col === 'progress' && o.id === 'p1'), 'ilerleme kişi başına tek belge');
  ok(!pure.ops.some(o => o.col === 'lists'), 'değişmeyen liste yollanmıyor');
  ok(pure.noop === 0, 'değişiklik yoksa hiç yazma yok');
  ok(pure.del.join(',') === 'e2,p1', 'silinenler için silme işlemi üretiliyor');
  ok(Object.keys(pure.grouped).join(',') === 'p1,p2', 'ilerleme profile göre gruplanıyor');
  ok(pure.clean.a === null && pure.clean.b.c === null && pure.clean.d[1] === null, 'undefined değerler null oluyor');
  ok(pure.cfg.apiKey === 'AIza' && pure.cfg.projectId === 'demo', 'tek satırlık ayar okunuyor');
  ok(pure.whole.projectId === 'demo-a8405' && pure.whole.appId.indexOf('1:104') === 0 && !pure.whole.initializeApp,
     'konsoldan olduğu gibi yapıştırılan tam parça okunuyor (import satırları dahil)');
  ok(pure.bad === 'reddedildi', 'alakasız metin düzgün reddediliyor');
  ok(/gizli/.test(pure.masked), 'gizlenmiş anahtar yakalanıp anlatılıyor: ' + pure.masked.slice(0, 40) + '…');
  ok(pure.wrapped.apiKey === 'AIzaSyReal123', 'satırlara bölünmüş anahtar toparlanıyor');

  console.log('\n[2] Boş buluta ilk yükleme');
  await page.click('button:has-text("Onur")');
  await page.click('button:has-text("Örnekle başla")');
  await page.waitForSelector('.stream');
  await page.evaluate(FAKE);
  await page.evaluate(() => {
    K.cloud._setBackend(window.FAKE);
    K.cloud.connect({ config: { apiKey: 'x', projectId: 'test' }, space: 'ev' });
  });
  await page.waitForFunction(() => K.cloud.status() === 'online', null, { timeout: 5000 });
  const up = await page.evaluate(() => ({
    events: FAKE.docs.events.length,
    groups: FAKE.docs.groups.length,
    lists: FAKE.docs.lists.length,
    profiles: FAKE.docs.profiles.length
  }));
  ok(up.events === 14 && up.groups === 1 && up.lists === 1 && up.profiles === 2,
     'yerel veri buluta yüklendi (' + JSON.stringify(up) + ')');
  ok((await page.locator('.cloud-dot.online').count()) === 1, 'üstte bağlı işareti çıktı');

  console.log('\n[3] Yerel değişiklik yalnızca değişeni yolluyor');
  await page.evaluate(() => { FAKE.ops.length = 0; });
  await page.click('.ev:has-text("Lozan Antlaşması")');
  await page.waitForSelector('.sheet');
  await page.fill('#f-title', 'Lozan Barış Antlaşması');
  await page.click('#f-save');
  await page.waitForSelector('.sheet', { state: 'detached' });
  await page.waitForTimeout(120);
  const sent = await page.evaluate(() => FAKE.ops.map(o => o.col + ':' + (o.del ? 'sil' : 'yaz')));
  ok(sent.length === 1 && sent[0] === 'events:yaz', '14 olaydan yalnızca biri yollandı (' + sent.join(', ') + ')');
  ok(await page.evaluate(() => FAKE.docs.events.some(e => e.title === 'Lozan Barış Antlaşması')), 'bulutta güncellendi');

  console.log('\n[4] Uzaktan gelen değişiklik');
  await page.evaluate(() => {
    const docs = FAKE.docs.events.map(e =>
      e.title === 'Malazgirt Savaşı' ? Object.assign({}, e, { title: 'Malazgirt Meydan Savaşı' }) : e);
    FAKE.push('events', docs);
  });
  await page.waitForTimeout(150);
  ok((await page.locator('.ev-title:has-text("Malazgirt Meydan Savaşı")').count()) === 1,
     'öteki cihazın değişikliği ekrana yansıdı');
  await page.evaluate(() => { FAKE.ops.length = 0; });
  await page.waitForTimeout(120);
  ok((await page.evaluate(() => FAKE.ops.length)) === 0, 'gelen değişiklik geri yollanmadı (döngü yok)');

  console.log('\n[5] Uzaktan silme');
  await page.evaluate(() => FAKE.push('events', FAKE.docs.events.filter(e => e.title !== 'Sivas Kongresi')));
  await page.waitForTimeout(150);
  ok((await page.locator('.ev-title:has-text("Sivas Kongresi")').count()) === 0, 'uzakta silinen olay listeden kalktı');

  console.log('\n[6] İlerleme kişiye özel eşitleniyor');
  await page.evaluate(() => { FAKE.ops.length = 0; });
  await page.click('.due');
  await page.waitForSelector('.q-text');
  await page.locator('.opt').first().click();
  await page.waitForTimeout(150);
  const prog = await page.evaluate(() => FAKE.ops.filter(o => o.col === 'progress'));
  ok(prog.length === 1, 'cevap tek bir ilerleme belgesi yazdı');
  ok(prog[0] && Object.keys(prog[0].data.entries).length >= 1, 'ilerleme kayıtları belgenin içinde');
  await page.click('[data-act="close-study"]');

  console.log('\n[7] İki tarafta da veri varken soruluyor');
  await page.evaluate(() => {
    K.cloud.disconnect(true);
    FAKE.docs.events = [{ id: 'uzak1', listId: FAKE.docs.lists[0].id, title: 'Buluttan gelen olay', start: { y: 1500, m: null, d: null }, end: null, approx: false, note: '', tags: [], parentId: null, groupId: null, linkFrom: [], order: 1000 }];
    K.cloud.connect({ config: { apiKey: 'x', projectId: 'test' }, space: 'ev' });
  });
  await page.waitForSelector('#m-cloud', { timeout: 5000 });
  ok(true, 'uzlaştırma sorusu çıktı');
  await page.click('#m-cloud');
  await page.waitForFunction(() => K.cloud.status() === 'online', null, { timeout: 5000 });
  ok((await page.locator('.ev-title:has-text("Buluttan gelen olay")').count()) === 1, 'buluttaki veri alındı');
  ok((await page.locator('.ev-title:has-text("Erzurum Kongresi")').count()) === 0, 'yereldekiler yerini bıraktı');

  console.log('\n[8] Bağlantı kesilince uygulama çalışmaya devam ediyor');
  await page.evaluate(() => K.cloud.disconnect());
  await page.waitForTimeout(100);
  ok(await page.evaluate(() => K.cloud.status()) === 'off', 'bağlantı kapandı');
  await page.click('.fab');
  await page.waitForSelector('.sheet');
  await page.fill('#f-title', 'Bağlantısız eklenen');
  await page.click('#f-save');
  await page.waitForSelector('.sheet', { state: 'detached' });
  ok((await page.locator('.ev-title:has-text("Bağlantısız eklenen")').count()) === 1, 'bulutsuz da ekleme çalışıyor');
  await page.reload({ waitUntil: 'networkidle' });
  ok((await page.locator('.ev-title:has-text("Bağlantısız eklenen")').count()) === 1, 'yerel kayıt korunuyor');

  await browser.close();
  console.log('\n' + (errs.length ? '❌ ' + errs.length + ' sorun:\n - ' + errs.join('\n - ') : '✅ hepsi geçti'));
  process.exit(errs.length ? 1 : 0);
})();
