# Kronolojim

Tarih olaylarını kendi girdiğin bir zaman çizelgesine dizen, sonra onları
unutmadan önce sana geri soran çalışma uygulaması.

Tam tasarım kararları için `docs/plan.html` dosyasına bak.

## Çalıştırma

Kurulum gerektirmez — statik dosyalar. Yerelde denemek için:

```
npm start          # http://localhost:8899
```

Yayınlamak için deponun kökünü herhangi bir statik sunucuya (GitHub Pages dahil)
koymak yeterli. Telefonda tarayıcıdan açıp "Ana ekrana ekle" dendiğinde uygulama
gibi açılır ve internetsiz çalışır.

## Şu an ne yapıyor

- **Profiller** — ilk açılışta kim çalışıyor diye sorar, sonra hatırlar. Olaylar
  herkeste ortak, hangi olayı ne kadar bildiğin kişiye özel.
- **Olaylar** — gün / ay / yıl kutuları; boş bırakılanlar yok sayılır. Aralık
  (`1919-22`), yaklaşık (`~1300`), not.
- **Sonucunda** — her kartın altında görünen sonuç metni; çalışırken de sorulur.
- **Kapsam** — olay eklerken açılan kutudan oluşturulur; içine aldıklarını solda
  yuvarlak uçlu parantezle toplar. Katlanabilir, en fazla üç seviye.
- **Grup** — tarihi önemsiz, yalnız sırası önemli olaylar için.
- **Sıralama** — tarihi olanlar kendiliğinden yerine oturur, gerisi elle taşınır.
  Her değişiklik geri alınabilir.
- **Çalışma** — beş basamaklı tekrar sistemi; araya yerleştirme, tarih ve sonuç
  soruları, zayıf olanlar önde.
- **Kör mod** — üstteki düğme tarihleri gizler, dokununca tek tek açılır.
- **Tek görünüm** — uygulama her zaman karanlık, seçenek sunmuyor.
- **Yedek** — dosya olarak indir/geri yükle, okunabilir metni kopyala, ya da
  metin yapıştırıp içe aktar. Kopyalanan metin aynen geri yüklenebilir, yani
  yapay zekaya kontrol ettirip düzeltilmiş halini geri koyabilirsin.
- **Bulut** — Firebase ile telefon ve bilgisayar eşitlenir; ayar gömülü geldiği
  için uygulamayı açan cihaz kendiliğinden bağlanır. Yalnızca değişen kayıtlar
  yollanır. Bulutta içerik varsa o kazanır, soru sorulmaz. İnternet yokken kart
  eklenip değiştirilemez ama günlük tekrar yapılabilir; ilerleme sonra yüklenir.
  Kendi projeni kurmak için: [`docs/firebase.md`](docs/firebase.md).
- **Kayıt defteri** — son değişiklikler (kim, ne zaman, ne yaptı) Ayarlar'da.

## Sırada ne var

Sıraya dizme oyunu, hazır tarih paketleri, arama ve filtre.

## Geliştirme

```
npm test           # tarayıcıda uçtan uca duman testi (Playwright)
npm run test:cloud # bulut senkronu, sahte bir Firestore ile
npm run bundle     # dist/index.html — tek dosyalık sürüm
```

`CHROMIUM_PATH` tanımlıysa test o tarayıcıyı kullanır.

## Dosyalar

```
index.html          kabuk
css/app.css         tüm görsel dil, karanlık ve açık tema
js/util.js          küçük yardımcılar
js/model.js         olay modeli, tarih biçimleri, ağaç kurma
js/textimport.js    metinden olay okuma
js/store.js         durum, kayıt, geri alma
js/firebase-config.js  gömülü Firebase ayarı
js/cloud.js         Firebase senkronu
js/srs.js           beş basamaklı tekrar sistemi ve soru üretimi
js/views/           ekranlar
js/app.js           yönlendirme ve eylemler
tools/              sunucu, test, paketleyici
docs/plan.html      tasarım planı
docs/firebase.md    bulut kurulumu
```
