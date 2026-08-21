/* Tek dosyalık sürüm üretir: dist/index.html
   Aynı uygulama, hiçbir ek dosyaya ihtiyaç duymadan tek HTML olarak çalışır. */
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const scripts = [
  'js/util.js', 'js/model.js', 'js/store.js', 'js/firebase-config.js', 'js/cloud.js', 'js/srs.js',
  'js/views/timeline.js', 'js/views/editor.js', 'js/views/study.js',
  'js/views/panels.js', 'js/app.js'
];

let html = read('index.html');
html = html.replace('<link rel="stylesheet" href="css/app.css">',
  '<style>\n' + read('css/app.css') + '\n</style>');
html = html.replace('<link rel="manifest" href="manifest.webmanifest">', '');
html = html.replace('<link rel="icon" href="icon.svg" type="image/svg+xml">',
  '<link rel="icon" href="data:image/svg+xml;base64,' + Buffer.from(read('icon.svg')).toString('base64') + '">');
html = html.replace('<link rel="apple-touch-icon" href="icon.svg">', '');
scripts.forEach((s, i) => {
  html = html.replace('<script src="' + s + '"></script>',
    i === 0 ? '<script>\n' + read(s) + '\n</script>' : '<script>\n' + read(s) + '\n</script>');
});
// Tek dosyada servis çalışanı yok.
html = html.replace(/if \('serviceWorker' in navigator[\s\S]*?\n    \}\n/, '');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
console.log('dist/index.html yazıldı — ' + Math.round(html.length / 1024) + ' KB');
