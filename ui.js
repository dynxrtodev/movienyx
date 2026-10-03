// Helper bersama untuk semua halaman: ikon (Lucide via jsDelivr), riwayat tontonan, toast
const $ = (s) => document.querySelector(s);

const ic = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const I = {
  play: ic('play'),
  info: ic('info'),
  star: ic('star'),
  left: ic('chevron-left'),
  right: ic('chevron-right'),
  ext: ic('external-link'),
  moon: ic('moon'),
  history: ic('history'),
  trash: ic('trash-2'),
  clock: ic('clock'),
  resume: ic('play-circle'),
  restart: ic('rotate-ccw'),
  trend: ic('trending-up'),
};

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Poster cadangan kalau gambar gagal dimuat
const NOPOSTER = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect width="200" height="300" fill="#1a1214"/><path d="M80 120v60l50-30z" fill="#4a3a3e"/></svg>');

/* ---------- Ikon ---------- */
let paintQueued = false;
function paintIcons() {
  paintQueued = false;
  if (window.lucide && document.querySelector('[data-lucide]')) window.lucide.createIcons();
}
new MutationObserver(() => {
  if (paintQueued) return;
  paintQueued = true;
  requestAnimationFrame(paintIcons);
}).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('DOMContentLoaded', paintIcons);

/* ---------- Format waktu ---------- */
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

// Ubah teks durasi ("2h 15m", "1j 45m", "135 min", "1:45:00") menjadi detik
function parseDuration(txt) {
  if (!txt) return 0;
  const t = String(txt).trim();
  const clock = t.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (clock) return clock[3] ? +clock[1] * 3600 + +clock[2] * 60 + +clock[3] : +clock[1] * 60 + +clock[2];
  const h = t.match(/(\d+)\s*(?:h|j|jam|hr|hour)/i);
  const m = t.match(/(\d+)\s*(?:m|min|menit|minute)/i);
  if (h || m) return (h ? +h[1] * 3600 : 0) + (m ? +m[1] * 60 : 0);
  if (/^\d+$/.test(t)) return +t * 60;
  return 0;
}

/* ---------- Riwayat tontonan (localStorage) ---------- */
const Hist = {
  key: 'movienyx_history',
  all() {
    try {
      const v = JSON.parse(localStorage.getItem(this.key));
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  },
  write(list) {
    try { localStorage.setItem(this.key, JSON.stringify(list)); } catch { /* penyimpanan penuh / diblokir */ }
  },
  get(id) { return this.all().find((x) => x.id === id) || null; },
  upsert(entry) {
    const old = this.get(entry.id) || {};
    const list = this.all().filter((x) => x.id !== entry.id);
    list.unshift({ ...old, ...entry, updatedAt: Date.now() });
    this.write(list.slice(0, 100));
  },
  remove(id) { this.write(this.all().filter((x) => x.id !== id)); },
  clear() { this.write([]); },
};
const resumeLink = (x) => `detail.html?id=${encodeURIComponent(x.id)}&t=${Math.floor(x.watched || 0)}&s=${x.server || 0}`;

/* ---------- Toast ---------- */
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3600);
  setTimeout(() => el.remove(), 4100);
}

/* ---------- Navbar & gerbang DNS ---------- */
window.addEventListener('scroll', () => $('#nav')?.classList.toggle('solid', scrollY > 24), { passive: true });

function initDnsGate() {
  const gate = document.getElementById('dnsGate');
  if (!gate) return;

  const expiryKey = 'movienyx_dns_expiry';
  const savedExpiry = localStorage.getItem(expiryKey);
  const now = Date.now();

  if (savedExpiry && now < parseInt(savedExpiry, 10)) {
    gate.style.display = 'none';
    return;
  }

  gate.style.display = 'grid';
  document.body.classList.add('locked');

  const closeAndSetExpiry = () => {
    localStorage.setItem(expiryKey, String(now + 3 * 24 * 60 * 60 * 1000));
    gate.style.display = 'none';
    document.body.classList.remove('locked');
  };
  document.getElementById('btnDnsDone')?.addEventListener('click', closeAndSetExpiry);
  document.getElementById('btnDnsSkip')?.addEventListener('click', closeAndSetExpiry);
}
window.addEventListener('DOMContentLoaded', initDnsGate);
