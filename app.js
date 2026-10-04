const app = $('#app');
const form = $('#searchForm');
const input = $('#searchInput');
const tabs = document.querySelectorAll('.cat-btn');

let retry = null;
let token = 0; 
let currentMode = 'movie'; // Default mode

// Format link beda-beda tergantung tipe data biar halaman detail tau narik API mana
const link = (m) => `detail.html?id=${encodeURIComponent(m.slug)}&mode=${currentMode}`;
const rate = (m) => (m.rating ? `<span class="star">${I.star}${esc(m.rating)}</span>` : '');
const img = (m, cls = '') => `<img ${cls ? `class="${cls}" ` : ''}src="${esc(m.poster || NOPOSTER)}" alt="${esc(m.title)}" loading="lazy" onload="this.classList.add('ld')" onerror="this.onerror=null;this.src=NOPOSTER">`;

const card = (m) => `
  <a class="card" href="${link(m)}" aria-label="${esc(m.title)}">
    ${img(m)}
    <div class="ov">
      <span class="pl">${I.play}</span>
      <b>${esc(m.title)}</b>
      <small>${rate(m)}<span>${esc(m.year || m.release_year || '-')}</span></small>
    </div>
  </a>`;

const histCard = (x) => {
  const pct = x.total ? Math.min(100, Math.round((x.watched / x.total) * 100)) : 0;
  return `
  <a class="card" href="${resumeLink(x)}" aria-label="Lanjutkan ${esc(x.title)} dari ${fmtTime(x.watched)}">
    ${img(x)}
    <div class="ov">
      <span class="pl">${I.play}</span>
      <b>${esc(x.title)}</b>
      <small><span>${I.clock}Lanjut ${fmtTime(x.watched)}</span></small>
    </div>
    ${pct ? `<div class="prog"><i style="width:${pct}%"></i></div>` : ''}
  </a>`;
};

const row = (title, itemsHtml, { top = false, extra = '', cls = '' } = {}) => `
  <section class="sec${top ? ' top' : ''}${cls ? ' ' + cls : ''}">
    <div class="sec-head"><h2>${title}</h2>${extra}</div>
    <div class="row">
      <button class="arrow l" aria-label="Geser kiri">${I.left}</button>
      <div class="track">${itemsHtml}</div>
      <button class="arrow r" aria-label="Geser kanan">${I.right}</button>
    </div>
  </section>`;

const continueRow = () => {
  const list = Hist.all().filter((x) => !x.done).slice(0, 12);
  if (!list.length) return '';
  return row('Lanjutkan menonton', list.map(histCard).join(''), {
    cls: 'cont',
    extra: `<a class="more" href="history.html">Semua riwayat${I.right}</a>`,
  });
};

const heroImg = (src) => `<img src="${esc(src || NOPOSTER)}" alt="" fetchpriority="high" onload="this.classList.add('ld')" onerror="this.onerror=null;this.src=NOPOSTER">`;

const hero = (m) => {
  const syn = m.synopsis || m.overview || '';
  return `
  <section class="hero">
    <div class="hm ${m.backdrop ? 'wide' : 'tall'}">${heroImg(m.backdrop || m.poster)}</div>
    <div class="hc">
      <span class="rank-tag">${I.trend}Paling Populer</span>
      <h1>${esc(m.title)}</h1>
      <div class="meta">${rate(m)}<span>${esc(m.year || m.release_year || '-')}</span></div>
      ${syn ? `<p class="hsyn">${esc(syn)}</p>` : ''}
      <div class="btns">
        <a class="btn" href="${link(m)}">${I.play}Tonton Sekarang</a>
      </div>
    </div>
  </section>`;
};

const skRow = () => `<section class="sec"><div class="sk-t sk"></div><div class="track">${'<div class="card sk"></div>'.repeat(8)}</div></section>`;
const skeleton = () => `<div class="hero sk"></div>${skRow()}${skRow()}`;

function stateBox(title, msg, action) {
  app.innerHTML = `<div class="state"><h3>${esc(title)}</h3><p>${esc(msg)}</p>${action || ''}</div>`;
}

// Logika pemanggilan API dinamis berdasarkan currentMode
async function api(q) {
  const endpoint = currentMode === 'anime' ? '/api/anime' : '/api/movie';
  const r = await fetch(`${endpoint}?${q}`);
  if (!r.ok) throw new Error(`Server membalas ${r.status}`);
  return r.json();
}

function renderHomeMovie(data) {
  const trend = Array.isArray(data.trending) ? data.trending : [];
  const latest = Array.isArray(data.latest) ? data.latest : [];
  const upcoming = Array.isArray(data.upcoming) ? data.upcoming : [];
  const topRated = Array.isArray(data.toprated) ? data.toprated : [];

  if (!trend.length && !latest.length) {
    stateBox('Belum ada film', 'Daftar film kosong. Coba lagi sebentar lagi.', '<button class="btn red" data-retry>Muat ulang</button>');
    return;
  }

  const top10 = trend.slice(0, 10).map((m, i) => `<div class="tn"><i>${i + 1}</i>${card(m)}</div>`).join('');
  
  app.innerHTML =
    (trend[0] ? hero(trend[0]) : '') +
    continueRow() +
    (top10 ? row('Top 10 Hari Ini', top10, { top: true }) : '') +
    (latest.length ? row('Baru Ditambahkan', latest.map(card).join('')) : '') +
    (topRated.length ? row('Rating Tertinggi', topRated.map(card).join('')) : '') +
    (upcoming.length ? row('Segera Tayang', upcoming.map(card).join('')) : '');
}

function renderHomeAnime(data) {
  const list = Array.isArray(data.data) ? data.data : (Array.isArray(data.results) ? data.results : []);
  
  if (!list.length) {
    stateBox('Belum ada anime', 'Daftar anime kosong atau server sedang sibuk.', '<button class="btn red" data-retry>Muat ulang</button>');
    return;
  }

  const firstCard = list[0];
  const gridHtml = `<section class="sec"><div class="sec-head"><h2>Daftar Anime</h2></div><div class="grid">${list.map(card).join('')}</div></section>`;
  
  app.innerHTML = hero(firstCard) + gridHtml;
}

const reveal = () => {
  app.classList.remove('in');
  void app.offsetWidth;
  app.classList.add('in');
};

async function loadHome() {
  const my = ++token;
  retry = loadHome;
  scrollTo(0, 0);
  Loader.start();
  app.innerHTML = skeleton();

  try {
    const data = await api('action=home');
    if (my !== token) return;

    if (currentMode === 'movie') {
      renderHomeMovie(data);
    } else {
      renderHomeAnime(data);
    }
    reveal();
    paintIcons();
  } catch (err) {
    if (my !== token) return;
    stateBox('Beranda gagal dimuat', err.message, '<button class="btn red" data-retry>Coba lagi</button>');
  } finally {
    if (my === token) { Loader.done(); hideSplash(); }
  }
}

async function search(q) {
  const my = ++token;
  retry = () => search(q);
  scrollTo(0, 0);
  Loader.start();
  app.innerHTML = `<section class="sec res"><div class="sec-head"><h2>Mencari “${esc(q)}”</h2></div><div class="grid">${'<div class="card sk"></div>'.repeat(10)}</div></section>`;
  try {
    const d = await api(`action=search&keyword=${encodeURIComponent(q)}`);
    if (my !== token) return;

    // API anime ngereturn { data: [...] }, API movie ngereturn { results: [...] }
    const list = Array.isArray(d.data) ? d.data : (Array.isArray(d.results) ? d.results : []);

    if (!list.length) {
      stateBox(`Tidak ada hasil untuk “${q}”`, 'Coba kata kunci lain atau periksa ejaan judulnya.', '<button class="btn red" data-home>Kembali ke beranda</button>');
      return;
    }
    app.innerHTML = `<section class="sec res"><div class="sec-head"><h2>Hasil untuk “${esc(q)}”</h2><span class="count">${list.length} judul</span></div><div class="grid">${list.map(card).join('')}</div></section>`;
    reveal();
  } catch (err) {
    if (my !== token) return;
    stateBox('Pencarian gagal', err.message, '<button class="btn red" data-retry>Coba lagi</button>');
  } finally {
    if (my === token) Loader.done();
  }
}

// Logika Ganti Tab
tabs.forEach(btn => {
  btn.addEventListener('click', (e) => {
    tabs.forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    currentMode = btn.dataset.type; // 'movie' atau 'anime'
    $('#catTabs').dataset.active = currentMode;
    input.value = ''; // Reset input pencarian pas ganti tab
    loadHome();
  });
});

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

document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== input && !e.target.closest('input,textarea')) {
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

window.addEventListener('pageshow', (e) => {
  if (e.persisted && !input.value.trim()) loadHome();
});

// Init load
loadHome();
