const content = $('#detail');
const qs = new URLSearchParams(location.search);
const slugId = qs.get('id');
const resumeAt = Math.max(0, parseInt(qs.get('t'), 10) || 0); // dari halaman riwayat
const startServer = Math.max(0, parseInt(qs.get('s'), 10) || 0);

let movie = null;
let servers = [];
let cur = 0;

// Status pemutaran. Pemutar embed ada di domain lain, jadi posisi video
// dihitung dari lama menonton, dan dikoreksi otomatis kalau pemutarnya mengirim waktu via postMessage.
const P = { watched: 0, total: 0, loaded: false, synced: false, paused: false, hold: 0 };

function stateBox(title, msg) {
  content.innerHTML = `<div class="state"><h3>${esc(title)}</h3><p>${esc(msg)}</p><a class="btn red" href="index.html">Kembali ke beranda</a></div>`;
}

async function loadDetail() {
  if (!slugId) return stateBox('Film tidak ditemukan', 'Alamat halaman ini tidak memuat ID film.');
  try {
    const res = await fetch(`/api/movie?action=detail&id=${encodeURIComponent(slugId)}`);
    if (!res.ok) throw new Error(`Server membalas ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    movie = data;
    renderDetail(movie);
  } catch (err) {
    stateBox('Detail film gagal dimuat', err.message);
  }
}

function getServers(m) {
  const list = [];
  if (m.primary_stream) list.push({ name: 'Utama', url: m.primary_stream });
  (m.servers || []).forEach((s) => {
    if (s && s.url && !list.some((x) => x.url === s.url)) list.push({ name: s.name || `Server ${list.length + 1}`, url: s.url });
  });
  return list;
}

// Tambahkan penanda waktu mulai; banyak pemutar embed membaca ?t= atau ?start=
function withStart(url, sec) {
  if (!sec || sec < 1) return url;
  try {
    const u = new URL(url, location.href);
    u.searchParams.set('t', sec);
    u.searchParams.set('start', sec);
    return u.toString();
  } catch { return url; }
}

function setSource(i, at = 0) {
  cur = i;
  const url = withStart(servers[i].url, at);
  P.loaded = false;
  P.synced = false;
  P.paused = false;
  $('#screen').innerHTML = `<iframe src="${esc(url)}" title="Pemutar Movienyx" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen></iframe>`;
  $('#screen iframe').addEventListener('load', () => (P.loaded = true));
  $('#openTab').href = url;
}

/* ---------- Simpan riwayat ---------- */
function persist() {
  if (!movie) return;
  const total = P.total || parseDuration(movie.duration);
  let w = Math.floor(P.watched);
  if (total && w > total) w = total;
  if (w < 10 || w < P.hold) return; // abaikan sekilas buka & jangan timpa posisi lama sebelum user memilih
  const done = total ? w >= total * 0.95 : false;
  Hist.upsert({
    id: slugId,
    title: movie.title,
    poster: movie.poster || '',
    year: movie.year || '',
    durationText: movie.duration || '',
    total,
    watched: done ? total : w,
    server: cur,
    done,
  });
}

let ticks = 0;
setInterval(() => {
  if (P.loaded && !document.hidden && !P.synced && !P.paused) P.watched += 1;
  if (++ticks % 5 === 0) persist();
}, 1000);
document.addEventListener('visibilitychange', () => document.hidden && persist());
window.addEventListener('pagehide', persist);

// Kalau pemutar mengirim waktu sebenarnya, pakai itu
window.addEventListener('message', (e) => {
  const frame = $('#screen iframe');
  if (!frame || e.source !== frame.contentWindow) return;
  let d = e.data;
  if (typeof d === 'string') {
    try { d = JSON.parse(d); } catch { return; }
  }
  if (!d || typeof d !== 'object') return;
  const src = d.data && typeof d.data === 'object' ? d.data : d;
  const t = [src.currentTime, src.time, src.position, src.current, src.seconds].find((v) => typeof v === 'number' && isFinite(v));
  const dur = [src.duration, src.total].find((v) => typeof v === 'number' && isFinite(v) && v > 0);
  const ev = String(d.event || d.type || src.event || '').toLowerCase();
  if (ev === 'pause' || ev === 'ended') P.paused = true;
  if (ev === 'play' || ev === 'playing') P.paused = false;
  if (t !== undefined) {
    P.synced = true;
    P.watched = t;
  }
  if (dur) P.total = dur;
});

/* ---------- Tampilan ---------- */
function renderDetail(m) {
  document.title = `${m.title} - Movienyx`;
  servers = getServers(m);
  const poster = esc(m.poster || NOPOSTER);
  const saved = Hist.get(slugId);
  const offer = !resumeAt && saved && !saved.done && saved.watched >= 30 ? saved : null;

  content.innerHTML = `
    <section class="dh">
      <div class="bd" style="background-image:url('${poster}')"></div>
      <img class="po" src="${poster}" alt="${esc(m.title)}" onerror="this.onerror=null;this.src=NOPOSTER">
      <div>
        <h1>${esc(m.title)}</h1>
        <div class="chips">
          ${m.rating ? `<span class="chip star">${I.star}${esc(m.rating)}</span>` : ''}
          <span class="chip">${esc(m.year || '-')}</span>
          <span class="chip">${I.clock}${esc(m.duration || '-')}</span>
        </div>
        <p class="syn">${esc(m.synopsis || 'Belum ada sinopsis untuk film ini.')}</p>
      </div>
    </section>

    <section class="theater" aria-label="Pemutar film">
      ${offer ? `
      <div class="resume" id="resume">
        <span class="resume-t">${I.history}<span>Terakhir ditonton sampai <b>${fmtTime(offer.watched)}</b></span></span>
        <span class="resume-a">
          <button class="btn red sm" id="resumeYes">${I.play}Lanjutkan</button>
          <button class="tool sm" id="resumeNo">${I.restart}Dari awal</button>
        </span>
      </div>` : ''}
      <div class="stage"><div class="screen" id="screen"></div></div>
      <div class="floor">
        <span class="lbl">Server</span>
        ${servers.map((s, i) => `<button class="srv" data-i="${i}" aria-pressed="${i === Math.min(startServer, servers.length - 1)}">${esc(s.name)}</button>`).join('')}
        <div class="tools">
          <a class="tool" id="openTab" target="_blank" rel="noopener">${I.ext}Buka di tab baru</a>
          <button class="tool" id="dimBtn" aria-pressed="false">${I.moon}Mode bioskop</button>
        </div>
      </div>
      <p class="hint" id="hint" hidden></p>
    </section>`;

  const first = Math.min(startServer, servers.length - 1);
  if (servers.length) {
    P.watched = resumeAt;
    if (offer) P.hold = offer.watched;
    setSource(first, resumeAt);
    if (resumeAt) showResumed(resumeAt);
  } else {
    $('#screen').innerHTML = '<div class="perr"><b>Sumber video belum tersedia</b><span>Film ini belum punya server pemutar.</span></div>';
    $('#openTab').remove();
  }

  $('#resumeYes')?.addEventListener('click', () => {
    P.hold = 0;
    P.watched = offer.watched;
    setSource(cur, offer.watched);
    $('#resume').remove();
    showResumed(offer.watched);
  });
  $('#resumeNo')?.addEventListener('click', () => {
    P.hold = 0;
    P.watched = 0;
    setSource(cur, 0);
    $('#resume').remove();
  });

  content.querySelector('.floor').addEventListener('click', (e) => {
    const b = e.target.closest('.srv');
    if (!b) return;
    content.querySelectorAll('.srv').forEach((x) => x.setAttribute('aria-pressed', x === b));
    persist();
    setSource(+b.dataset.i, Math.floor(P.watched)); // lanjut dari posisi terakhir di server baru
  });

  const dim = $('#dimBtn');
  const toggle = (on) => {
    document.body.classList.toggle('dim', on);
    dim.setAttribute('aria-pressed', on);
  };
  dim.addEventListener('click', () => toggle(!document.body.classList.contains('dim')));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && toggle(false));
}

function showResumed(sec) {
  const hint = $('#hint');
  hint.hidden = false;
  hint.innerHTML = `${I.resume}<span>Dilanjutkan dari <b>${fmtTime(sec)}</b>. Kalau video masih mulai dari awal, geser manual ke menit itu (tidak semua server embed mendukung lompat otomatis).</span>`;
  toast(`Melanjutkan dari ${fmtTime(sec)}`);
}

loadDetail();
