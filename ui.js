// Ikon SVG (pengganti emoji) + helper bersama untuk semua halaman
const $ = (s) => document.querySelector(s);
const F = (d) => `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${d}"/></svg>`;
const S = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;

const I = {
  play: F('M7 4.5v15l13-7.5z'),
  info: F('M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-6h2zm0-8h-2V7h2z'),
  star: F('M12 2l3 6.9 7.5.7-5.7 4.9 1.7 7.3-6.5-3.9-6.5 3.9 1.7-7.3L1.5 9.6 9 8.9z'),
  film: F('M4 3h16a1 1 0 011 1v16a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1zm1 2v2h2V5zm12 0v2h2V5zM5 9v2h2V9zm12 0v2h2V9zM5 13v2h2v-2zm12 0v2h2v-2zM5 17v2h2v-2zm12 0v2h2v-2zM9 5v14h6V5z'),
  moon: F('M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z'),
  search: S('M11 18a7 7 0 100-14 7 7 0 000 14zm10 3l-5-5'),
  back: S('M15 5l-7 7 7 7'),
  left: S('M15 5l-7 7 7 7'),
  right: S('M9 5l7 7-7 7'),
  ext: S('M14 4h6v6m0-6L10 14M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5'),
};

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Poster cadangan kalau gambar gagal dimuat
const NOPOSTER = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><rect width="200" height="300" fill="#1b1315"/><path d="M80 120v60l50-30z" fill="#4a3a3e"/></svg>');

// Pasang ikon ke elemen bertanda data-i
document.querySelectorAll('[data-i]').forEach((el) => (el.innerHTML = I[el.dataset.i]));
window.addEventListener('scroll', () => $('#nav').classList.toggle('solid', scrollY > 24), { passive: true });
