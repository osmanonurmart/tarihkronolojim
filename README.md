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
- **Olaylar** — tam tarih / yalnız yıl / tarihsiz; aralık (`1919-22`), yaklaşık
  (`~1300`), not ve etiket.
- **Kapsam** — aralığı olan bir olay, içine düşen olayları solda yuvarlak uçlu
  parantezle toplar. Katlanabilir, en fazla üç seviye.
- **Grup** — tarihi önemsiz, yalnız sırası önemli olaylar için.
- **Bağ** — "şu olayların ardından şu oldu". Bir veya birkaç kaynaktan çıkar.
- **Sıralama** — tarihi olanlar kendiliğinden yerine oturur, gerisi elle taşınır.
  Her değişiklik geri alınabilir.
- **Çalışma** — beş basamaklı tekrar sistemi; araya yerleştirme ve tarih soruları,
  zayıf olanlar önde.
- **Kör mod** — tarihleri gizler, dokununca tek tek açılır.
- **Yedek** — dosya olarak indir/geri yükle, ya da okunabilir metni kopyala.
- **Bulut** — Firebase ile telefon ve bilgisayar eşitlenir; ayar gömülü geldiği
  için uygulamayı açan cihaz kendiliğinden bağlanır. Yalnızca değişen kayıtlar
  yollanır, çevrimdışıyken uygulama aynen çalışır. Kendi projeni kurmak için:
  [`docs/firebase.md`](docs/firebase.md).

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
