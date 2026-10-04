const content = $('#detail');
const qs = new URLSearchParams(location.search);
const slugId = qs.get('id');
const resumeAt = Math.max(0, parseInt(qs.get('t'), 10) || 0); 
const startServer = Math.max(0, parseInt(qs.get('s'), 10) || 0);

let movie = null;
let servers = [];
let cur = 0;
let currentSeason = 1;

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
  P.loaded = true; 
  P.synced = false;
  P.paused = false;
  $('#screen').innerHTML = `<iframe src="${esc(url)}" title="Pemutar Movienyx" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen></iframe>`;
  $('#openTab').href = url;
}

/* ---------- Ekstrak Episode (Khusus TV Series) ---------- */
async function loadEpisodes(seasonNumber) {
  const epContainer = $('#episodes-list');
  epContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--mute);">Memuat episode...</div>';
  try {
    const res = await fetch(`/api/movie?action=episodes&id=${encodeURIComponent(slugId)}&season=${seasonNumber}`);
    const data = await res.json();
    
    if (!data.episodes || data.episodes.length === 0) {
      epContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--mute);">Episode belum tersedia.</div>';
      return;
    }

    let html = '';
    data.episodes.forEach(ep => {
      // Simpan data server episode ini ke dalam string JSON tersembunyi biar gampang dipanggil
      const epServersStr = encodeURIComponent(JSON.stringify(ep.servers));
      const thumb = ep.still ? ep.still : (movie.backdrop || NOPOSTER);
      html += `
        <div class="ep-card" data-servers="${epServersStr}" onclick="playEpisode(this, ${ep.episode})">
          <img src="${esc(thumb)}" alt="Eps ${ep.episode}" loading="lazy" onerror="this.onerror=null;this.src=NOPOSTER">
          <div class="ep-info">
            <h4>Eps ${ep.episode}: ${esc(ep.title || `Episode ${ep.episode}`)}</h4>
            <p>${esc((ep.overview || '').substring(0, 80))}...</p>
          </div>
        </div>
      `;
    });
    epContainer.innerHTML = html;
  } catch (err) {
    epContainer.innerHTML = `<div style="color:red; padding:20px;">Gagal memuat episode: ${err.message}</div>`;
  }
}

// Terpicu saat user ngeklik episode tertentu di daftar
window.playEpisode = function(element, epNumber) {
  const rawServers = decodeURIComponent(element.getAttribute('data-servers'));
  let epServers = [];
  try { epServers = JSON.parse(rawServers); } catch(e){}
  
  if(epServers.length > 0) {
    // Timpa server utama dengan server khusus episode ini
    servers = epServers.map((s, i) => ({ name: s.name || `Server ${i+1}`, url: s.url }));
    toast(`Memutar Episode ${epNumber}`);
    
    // Render ulang tombol server di bawah pemutar
    const floor = $('.floor');
    let srvHtml = `<span class="lbl">Server Eps ${epNumber}</span>`;
    srvHtml += servers.map((s, i) => `<button class="srv" data-i="${i}" aria-pressed="${i === 0}">${esc(s.name)}</button>`).join('');
    
    // Pertahankan tombol tools (buka tab baru & mode bioskop)
    const tools = floor.querySelector('.tools').outerHTML;
    floor.innerHTML = srvHtml + tools;
    
    // Reset tracker riwayat untuk episode baru dan jalankan video
    P.watched = 0;
    P.hold = 0;
    setSource(0, 0);
  } else {
    toast('Server untuk episode ini kosong.');
  }
}

/* ---------- Simpan riwayat ---------- */
function persist() {
  if (!movie) return;
  const total = P.total || parseDuration(movie.duration);
  let w = Math.floor(P.watched);
  if (total && w > total) w = total;
  if (w < 3 || w < P.hold) return; 
  
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
document.querySelectorAll('.back, .logo, .navlink').forEach(el => { el.addEventListener('click', persist); });

window.addEventListener('message', (e) => {
  const frame = $('#screen iframe');
  if (!frame || e.source !== frame.contentWindow) return;
  let d = e.data;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return; } }
  if (!d || typeof d !== 'object') return;
  const src = d.data && typeof d.data === 'object' ? d.data : d;
  const t = [src.currentTime, src.time, src.position, src.current, src.seconds].find((v) => typeof v === 'number' && isFinite(v));
  const dur = [src.duration, src.total].find((v) => typeof v === 'number' && isFinite(v) && v > 0);
  const ev = String(d.event || d.type || src.event || '').toLowerCase();
  if (ev === 'pause' || ev === 'ended') P.paused = true;
  if (ev === 'play' || ev === 'playing') P.paused = false;
  if (t !== undefined) { P.synced = true; P.watched = t; }
  if (dur) P.total = dur;
});

/* ---------- Tampilan ---------- */
function renderDetail(m) {
  document.title = `${m.title} - Movienyx`;
  servers = getServers(m);
  const poster = esc(m.poster || NOPOSTER);
  const saved = Hist.get(slugId);
  const offer = !resumeAt && saved && !saved.done && saved.watched >= 5 ? saved : null;
  const isSeries = m.type && m.type.toLowerCase() === 'series';

  // Render Deretan Artis (Cast)
  let castHtml = '';
  if (m.cast && m.cast.length > 0) {
    castHtml = `
      <div class="cast-container">
        <h3 style="margin: 20px 0 10px; font-family: var(--disp); letter-spacing: 1px;">Pemeran Utama</h3>
        <div class="cast-track">
          ${m.cast.map(c => `
            <div class="cast-card">
              <img src="${c.photo || NOPOSTER}" alt="${esc(c.name)}" loading="lazy" onerror="this.onerror=null;this.src=NOPOSTER">
              <b>${esc(c.name)}</b>
              <span>${esc(c.character)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Render Dropdown Musim (Khusus Series)
  let seasonHtml = '';
  if (isSeries && m.seasons && m.seasons.length > 0) {
    seasonHtml = `
      <div class="season-selector" style="margin-top: 25px;">
        <h3 style="margin-bottom: 10px; font-family: var(--disp); letter-spacing: 1px;">Daftar Episode</h3>
        <select id="seasonSelect" style="padding: 8px 12px; background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: var(--r); outline: none;">
          ${m.seasons.map(s => `<option value="${s.season_number}">${esc(s.name)} (${s.episode_count} Eps)</option>`).join('')}
        </select>
        <div id="episodes-list" class="ep-grid" style="margin-top: 15px;"></div>
      </div>
    `;
  }

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
        <span class="lbl">Server Utama</span>
        ${servers.map((s, i) => `<button class="srv" data-i="${i}" aria-pressed="${i === Math.min(startServer, servers.length - 1)}">${esc(s.name)}</button>`).join('')}
        <div class="tools">
          <a class="tool" id="openTab" target="_blank" rel="noopener">${I.ext}Buka di tab baru</a>
          <button class="tool" id="dimBtn" aria-pressed="false">${I.moon}Mode bioskop</button>
        </div>
      </div>
      <p class="hint" id="hint" hidden></p>
    </section>
    
    <!-- Area Cast & Seasons ditaruh di bawah player -->
    <section style="padding: 0 var(--pad); margin-top: 30px; margin-bottom: 50px;">
      ${castHtml}
      ${seasonHtml}
    </section>
  `;

  // Logika inisialisasi player bawaan film (sebelum pilih episode)
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

  // Event Listener UI
  $('#resumeYes')?.addEventListener('click', () => {
    P.hold = 0; P.watched = offer.watched; setSource(cur, offer.watched);
    $('#resume').remove(); showResumed(offer.watched);
  });
  
  $('#resumeNo')?.addEventListener('click', () => {
    P.hold = 0; P.watched = 0; setSource(cur, 0); $('#resume').remove();
  });

  // Karena area '.floor' isinya dinamis (berubah pas ganti episode), kita attach event di '.theater'
  content.querySelector('.theater').addEventListener('click', (e) => {
    const b = e.target.closest('.srv');
    if (!b) return;
    document.querySelectorAll('.srv').forEach((x) => x.setAttribute('aria-pressed', x === b));
    persist();
    setSource(+b.dataset.i, Math.floor(P.watched));
  });

  const dim = $('#dimBtn');
  const toggle = (on) => { document.body.classList.toggle('dim', on); dim?.setAttribute('aria-pressed', on); };
  dim?.addEventListener('click', () => toggle(!document.body.classList.contains('dim')));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && toggle(false));

  // Jalankan fetch episode jika ini adalah TV Series
  if (isSeries && m.seasons && m.seasons.length > 0) {
    const seasonSelect = $('#seasonSelect');
    loadEpisodes(seasonSelect.value); // Load default
    seasonSelect.addEventListener('change', (e) => {
      loadEpisodes(e.target.value);
    });
  }
}

function showResumed(sec) {
  const hint = $('#hint');
  hint.hidden = false;
  hint.innerHTML = `${I.resume}<span>Dilanjutkan dari <b>${fmtTime(sec)}</b>. Kalau video masih mulai dari awal, geser manual ke menit itu (tidak semua server embed mendukung lompat otomatis).</span>`;
  toast(`Melanjutkan dari ${fmtTime(sec)}`);
}

let blurTime = 0;
window.addEventListener('blur', () => { blurTime = Date.now(); setTimeout(() => { window.focus(); }, 100); });
window.addEventListener('focus', () => {
  if (blurTime === 0) return;
  if ((Date.now() - blurTime) < 15000) { toast('Pop-up iklan terdeteksi. Silakan tutup tab yang baru terbuka untuk melanjutkan.'); }
  blurTime = 0;
});

loadDetail();
