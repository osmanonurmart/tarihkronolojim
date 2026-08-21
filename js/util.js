window.K = window.K || {};

K.util = (function () {
  const uid = () =>
    Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

  const esc = (s) =>
    String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const todayISO = () => new Date().toISOString().slice(0, 10);

  const addDays = (iso, n) => {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const initials = (name) => (name || '?').trim().charAt(0).toLocaleUpperCase('tr');

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function toast(msg, actionLabel, onAction) {
    const host = document.getElementById('toast-host');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = '<span>' + esc(msg) + '</span>';
    if (actionLabel) {
      const b = document.createElement('button');
      b.textContent = actionLabel;
      b.onclick = () => { el.remove(); onAction && onAction(); };
      el.appendChild(b);
    }
    host.appendChild(el);
    setTimeout(() => el.remove(), actionLabel ? 5000 : 2600);
  }

  // Onay: tarayıcının confirm'ü yerine kendi alt panelimizi kullanan yerlerde
  // geri dönüş noktası olsun diye burada duruyor.
  const confirmAsk = (msg) => window.confirm(msg);

  return { uid, esc, todayISO, addDays, initials, shuffle, toast, confirmAsk };
})();
