window.K = window.K || {};

/* Uygulamanın kendi Firebase projesi. Burada durduğu için hiç kimsenin
   ayar yapıştırması gerekmiyor — uygulama açılır açılmaz bağlanıyor.

   Bu değerler gizli değil; Firebase web anahtarları tarayıcıya gömülmek
   üzere tasarlanmıştır. Veriyi koruyan şey Firestore güvenlik kuralları. */
K.firebaseConfig = {
  apiKey: "AIzaSyBLyqJ-JVuEr1qg3XUU_aB0GojP-7fG5mg",
  authDomain: "tarihkronolojim-a8405.firebaseapp.com",
  projectId: "tarihkronolojim-a8405",
  storageBucket: "tarihkronolojim-a8405.firebasestorage.app",
  messagingSenderId: "1046716939644",
  appId: "1:1046716939644:web:20b707e2185267e4b9f8f9"
};

/* Aynı veriyi paylaşan cihazların ortak adı. */
K.firebaseSpace = 'ev';
