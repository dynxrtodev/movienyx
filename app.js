const app = $('#app');
const form = $('#searchForm');
const input = $('#searchInput');
let retry = null;
let token = 0; // cegah hasil lama menimpa hasil baru

const link = (m) => `detail.html?id=${encodeURIComponent(m.slug)}`;
const rate = (m) => (m.rating ? `<span class="star">${I.star}${esc(m.rating)}</span>` : '');
const img = (m, cls = '') => `<img ${cls ? `class="${cls}" ` : ''}src="${esc(m.poster || NOPOSTER)}" alt="${esc(m.title)}" loading="lazy" onerror="this.onerror=null;this.src=NOPOSTER">`;

const card = (m) => `
  <a class="card" href="${link(m)}" aria-label="${esc(m.title)}">
    ${img(m)}
    <div class="ov"><span class="pl">${I.play}</span><b>${esc(m.title)}</b><small>${rate(m)}<span>${esc(m.year || '-')}</span></small></div>
  </a>`;

const row = (title, items, top) => `
  <section class="sec${top ? ' top' : ''}">
    <h2>${title}</h2>
    <div class="row">
      <button class="arrow l" aria-label="Geser kiri">${I.left}</button>
      <div class="track">${items.map((m, i) => (top ? `<div class="tn"><i>${i + 1}</i>${card(m)}</div>` : card(m))).join('')}</div>
      <button class="arrow r" aria-label="Geser kanan">${I.right}</button>
    </div>
  </section>`;

const hero = (m) => `
  <section class="hero">
    <div class="bd" style="background-image:url('${esc(m.poster || '')}')"></div>
    <div class="hc">
      <span class="rank-tag">No. 1 hari ini</span>
      <h1>${esc(m.title)}</h1>
      <div class="meta">${rate(m)}<span>${esc(m.year || '-')}</span></div>
      <div class="btns">
        <a class="btn" href="${link(m)}">${I.play}Putar</a>
        <a class="btn ghost" href="${link(m)}">${I.info}Info lainnya</a>
      </div>
    </div>
    ${img(m, 'hp')}
  </section>`;

const skeleton = () => `
  <div class="hero sk"></div>
  <section class="sec"><div class="track">${'<div class="card sk"></div>'.repeat(8)}</div></section>`;

function stateBox(title, msg, action) {
  app.innerHTML = `<div class="state"><h3>${esc(title)}</h3><p>${esc(msg)}</p>${action || ''}</div>`;
}

async function api(q) {
  const r = await fetch(`/api/movie?${q}`);
  if (!r.ok) throw new Error(`Server membalas ${r.status}`);
  return r.json();
}

function renderHome(list) {
  if (!list || !list.length) {
    stateBox('Belum ada film', 'Daftar trending kosong. Coba lagi sebentar lagi.', '<button class="btn red" data-retry>Muat ulang</button>');
    return;
  }
  const rest = list.slice(10);
  app.innerHTML =
    hero(list[0]) +
    row('Top 10 hari ini', list.slice(0, 10), true) +
    (rest.length ? `<section class="sec"><h2>Jelajahi</h2><div class="grid">${rest.map(card).join('')}</div></section>` : '');
}

async function loadHome() {
  const my = ++token;
  retry = loadHome;
  scrollTo(0, 0);
  app.innerHTML = skeleton();
  try {
    const d = await api('action=trending');
    if (my !== token) return;
    const list = d.results || d;
    renderHome(Array.isArray(list) ? list : []);
  } catch (err) {
    if (my !== token) return;
    stateBox('Film gagal dimuat', err.message, '<button class="btn red" data-retry>Coba lagi</button>');
  }
}

async function search(q) {
  const my = ++token;
  retry = () => search(q);
  scrollTo(0, 0);
  app.innerHTML = `<section class="sec res"><h2>Mencari “${esc(q)}”</h2><div class="grid">${'<div class="card sk"></div>'.repeat(10)}</div></section>`;
  try {
    const d = await api(`action=search&keyword=${encodeURIComponent(q)}`);
    if (my !== token) return;
    const list = d.results || [];
    if (!list.length) {
      stateBox(`Tidak ada hasil untuk “${q}”`, 'Coba kata kunci lain atau periksa ejaan judulnya.', '<button class="btn red" data-home>Kembali ke beranda</button>');
      return;
    }
    app.innerHTML = `<section class="sec res"><h2>Hasil untuk “${esc(q)}”</h2><div class="grid">${list.map(card).join('')}</div></section>`;
  } catch (err) {
    if (my !== token) return;
    stateBox('Pencarian gagal', err.message, '<button class="btn red" data-retry>Coba lagi</button>');
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (q) search(q);
  else input.focus();
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    input.value = '';
    input.blur();
    loadHome();
  }
});

// Tekan "/" untuk langsung mengetik pencarian
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== input) {
    e.preventDefault();
    input.focus();
  }
});

app.addEventListener('click', (e) => {
  const a = e.target.closest('.arrow');
  if (a) {
    const t = a.parentElement.querySelector('.track');
    t.scrollBy({ left: (a.classList.contains('l') ? -1 : 1) * t.clientWidth * 0.85, behavior: 'smooth' });
  }
  if (e.target.closest('[data-retry]') && retry) retry();
  if (e.target.closest('[data-home]')) {
    input.value = '';
    loadHome();
  }
});

loadHome();
