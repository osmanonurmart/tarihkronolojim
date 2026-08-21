# Firebase kurulumu

Telefon ve bilgisayarın aynı veriyi görmesi için. Bir kere yapılır, sonra
her cihazda sadece son iki adım tekrarlanır. Ücretsiz plan (Spark) fazlasıyla
yetiyor — iki kişilik bir kullanımda aylık kotanın yanına bile yaklaşmazsın.

## 1. Proje aç

1. [console.firebase.google.com](https://console.firebase.google.com) → **Proje ekle**
2. Ada `kronolojim` yaz.
3. Google Analytics'i **kapat** (gerekmiyor), **Proje oluştur**.

## 2. Veritabanını aç

1. Sol menü → **Build → Firestore Database** → **Veritabanı oluştur**
2. Konum: **eur3 (europe-west)** — Türkiye'ye en yakını.
3. **Production mode** ile başlat. Kuralları birazdan biz yazacağız.

## 3. Kuralları yapıştır

Firestore Database → **Rules** sekmesi. İçindekini silip bunu yapıştır, **Publish** de:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /spaces/{space}/{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 4. Anonim girişi aç

1. Sol menü → **Build → Authentication** → **Get started**
2. **Sign-in method** sekmesi → **Anonymous** → aç → **Save**

Uygulama kimseye şifre sormaz; arka planda anonim bir oturum açıp Firestore'a
öyle bağlanır. 3. adımdaki kural da bunu şart koşuyor.

## 5. Web uygulaması ekle ve ayarı kopyala

1. Sol üstteki **dişli → Proje ayarları**
2. Aşağıda **Uygulamalarınız** → **`</>`** (web) simgesine bas
3. Takma ad ver, **Uygulamayı kaydet**
4. Ekranda çıkan kod parçasını **olduğu gibi kopyala** — `import` satırları,
   yorumlar, sondaki `initializeApp(...)` çağrısı dahil hepsini alabilirsin,
   uygulama içinden ayarı kendi bulur:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "kronolojim.firebaseapp.com",
  projectId: "kronolojim",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

Bu değerler gizli değil — tarayıcıya gömülmek için tasarlanmışlar. Veriyi
koruyan şey 3. adımdaki kurallar.

## 6. Uygulamaya bağlan

1. Uygulamada sağ üst **⋯ → Ayarlar → Bulut**
2. Kopyaladığın bloğu kutuya yapıştır
3. **Ev kodu** kısmına ortak bir isim yaz — `ev` varsayılan. **Aynı veriyi
   paylaşacak bütün cihazlarda birebir aynı olmalı.**
4. **Bağlan**

Üstteki **⋯** düğmesinin köşesinde yeşil bir nokta belirirse bağlantı kurulmuş
demektir.

İkinci cihazda sadece 5. adımdaki bloğu ve aynı ev kodunu gir — proje kurulumunu
tekrarlaman gerekmez.

## İlk bağlantıda ne olur

- **Bulut boşsa:** bu cihazdaki her şey yukarı yüklenir.
- **Bu cihaz boşsa:** buluttaki her şey aşağı iner.
- **İkisinde de veri varsa:** uygulama hangisinin kalacağını sorar. Seçilmeyen
  taraf silinir, o yüzden önce Ayarlar → Yedek'ten dosya indirmek iyi olur.

## Nasıl çalışıyor

- Yerel kayıt asıl kopya olmaya devam eder; bulut onun üstünde bir katman.
  İnternet yokken uygulama hiç değişmeden çalışır, bağlantı gelince eşitlenir.
- Bir değişiklikte bütün veri değil, **yalnızca değişen kayıtlar** yollanır.
  Böylece sen telefonda bir olayı düzenlerken öteki cihazın başka bir olaya
  yaptığı değişiklik silinmez.
- İlerleme (kim neyi ne kadar biliyor) kişi başına tek belgede tutulur. Bir
  profili aynı anda iki kişi çalışmadığı için orada çakışma olmaz.
- Aynı kaydı iki cihaz aynı anda değiştirirse son yazan kazanır.

## Bilinmesi gereken

Uygulamanın adresi ve ayarı elinde olan herkes veriyi okuyabilir ve
değiştirebilir. Profiller hesap değil, sadece "kim çalışıyor" bilgisi.
Aile veya arkadaş çevresi için yeterli; gerçekten yabancılar kullanmaya
başlarsa tek bir ortak şifre eklemek gerekir.

## Bağlantıyı kesmek

Ayarlar → Bulut → **Bağlantıyı kes**. Veriler cihazda kalır, sadece eşitleme
durur. Buluttaki kayıtlar silinmez.
