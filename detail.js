const content = $('#detail');
const qs = new URLSearchParams(location.search);
const slugId = qs.get('id');
const viewMode = qs.get('mode') || 'movie'; // Nangkep parameter mode dari URL
const resumeAt = Math.max(0, parseInt(qs.get('t'), 10) || 0); 
const startServer = Math.max(0, parseInt(qs.get('s'), 10) || 0);

let movie = null;
let servers = [];
let cur = 0;

const P = { watched: 0, total: 0, loaded: false, synced: false, paused: false, hold: 0 };

function stateBox(title, msg) {
  content.innerHTML = `<div class="state"><h3>${esc(title)}</h3><p>${esc(msg)}</p><a class="btn red" href="index.html">Kembali ke beranda</a></div>`;
}

async function loadDetail() {
  if (!slugId) return stateBox('Film tidak ditemukan', 'Alamat halaman ini tidak memuat ID film.');
  Loader.start();
  try {
    // Penentuan endpoint berdasarkan mode (movie vs anime)
    const endpoint = viewMode === 'anime' ? '/api/anime' : '/api/movie';
    const res = await fetch(`${endpoint}?action=detail&id=${encodeURIComponent(slugId)}`);
    if (!res.ok) throw new Error(`Server membalas ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    movie = data;
    renderDetail(movie);
  } catch (err) {
    stateBox('Detail gagal dimuat', err.message);
  } finally {
    Loader.done();
  }
}

// Fungsi extract server disesuaikan, karena struktur json Anime/NanimeID & Moviezone beda
function getServers(m) {
  const list = [];
  
  if (viewMode === 'anime') {
    // Kalau anime, struktur datanya belum nyimpen server di 'm' utama, tapi per-episode.
    // Jadi server list buat stage awal kita kosongin dulu sampai user pilih episode.
    return list; 
  }

  // Khusus Moviezone (Film biasa)
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
  if (!servers[i]) return;
  
  const url = withStart(servers[i].url, at);
  P.loaded = true; 
  P.synced = false;
  P.paused = false;
  $('#screen').innerHTML = `<iframe src="${esc(url)}" title="Pemutar Movienyx" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen></iframe>`;
  $('#openTab').href = url;
}

/* ---------- Ekstrak Episode Dinamis (Bisa Anime & Series Moviezone) ---------- */
window.playEpisodeAnime = async function(btnElement, slugReq, epNumber) {
  // Animasi loading di tombol
  const originalText = btnElement.innerHTML;
  btnElement.innerHTML = 'Memuat...';
  btnElement.style.pointerEvents = 'none';

  try {
    const res = await fetch(`/api/anime?action=episode&id=${encodeURIComponent(slugReq)}`);
    const data = await res.json();
    
    // Gabungin streams dan mirror_streams jadi satu list server
    servers = [];
    if (data.episode && data.episode.video_url) {
      servers.push({ name: 'Utama', url: data.episode.video_url });
    }
    if (Array.isArray(data.mirror_streams)) {
      data.mirror_streams.forEach((m, i) => {
        servers.push({ name: m.label || `Mirror ${i+1}`, url: m.url });
      });
    }

    if (servers.length === 0) throw new Error('Video tidak tersedia');

    toast(`Memutar Episode ${epNumber}`);
    
    // Render ulang tombol server di bawah pemutar
    const floor = $('.floor');
    let srvHtml = `<span class="lbl">Server Eps ${epNumber}</span>`;
    srvHtml += servers.map((s, i) => `<button class="srv" data-i="${i}" aria-pressed="${i === 0}">${esc(s.name)}</button>`).join('');
    
    // Pertahankan tombol tools (buka tab baru & mode bioskop)
    const tools = floor.querySelector('.tools') ? floor.querySelector('.tools').outerHTML : '';
    floor.innerHTML = srvHtml + tools;
    
    // Reset tracker riwayat untuk episode baru dan jalankan video
    P.watched = 0;
    P.hold = 0;
    setSource(0, 0);

  } catch (err) {
    toast(`Gagal memuat video: ${err.message}`);
  } finally {
    btnElement.innerHTML = originalText;
    btnElement.style.pointerEvents = 'auto';
  }
}

// Terpicu saat user ngeklik episode dari Moviezone TV Series
window.playEpisodeSeries = function(element, epNumber) {
  const rawServers = decodeURIComponent(element.getAttribute('data-servers'));
  let epServers = [];
  try { epServers = JSON.parse(rawServers); } catch(e){}
  
  if(epServers.length > 0) {
    servers = epServers.map((s, i) => ({ name: s.name || `Server ${i+1}`, url: s.url }));
    toast(`Memutar Episode ${epNumber}`);
    
    const floor = $('.floor');
    let srvHtml = `<span class="lbl">Server Eps ${epNumber}</span>`;
    srvHtml += servers.map((s, i) => `<button class="srv" data-i="${i}" aria-pressed="${i === 0}">${esc(s.name)}</button>`).join('');
    const tools = floor.querySelector('.tools') ? floor.querySelector('.tools').outerHTML : '';
    floor.innerHTML = srvHtml + tools;
    
    P.watched = 0;
    P.hold = 0;
    setSource(0, 0);
  } else {
    toast('Server untuk episode ini kosong.');
  }
}

async function loadEpisodesSeries(seasonNumber) {
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
      const epServersStr = encodeURIComponent(JSON.stringify(ep.servers));
      const thumb = ep.still ? ep.still : (movie.backdrop || NOPOSTER);
      html += `
        <div class="ep-card" data-servers="${epServersStr}" onclick="playEpisodeSeries(this, ${ep.episode})">
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

/* ---------- Simpan riwayat ---------- */
function persist() {
  if (!movie) return;
  const total = P.total || parseDuration(movie.duration || '24m'); // Default 24 menit untuk anime jika kosong
  let w = Math.floor(P.watched);
  if (total && w > total) w = total;
  if (w < 3 || w < P.hold) return; 
  
  const done = total ? w >= total * 0.95 : false;
  Hist.upsert({
    id: slugId,
    mode: viewMode, // Simpan mode biar pas di-resume ga salah narik API
    title: movie.title,
    poster: movie.poster || '',
    year: movie.year || movie.release_year || '',
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
  const isMoviezoneSeries = viewMode === 'movie' && m.type && m.type.toLowerCase() === 'series';

  // Render Deretan Artis (Cast - Cuma buat Moviezone)
  let castHtml = '';
  if (m.cast && m.cast.length > 0) {
    castHtml = `
      <div class="cast-container">
        <h3 class="blk-t">Pemeran Utama</h3>
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

  // Render Dropdown Musim (Khusus Moviezone Series)
  let mzSeasonHtml = '';
  if (isMoviezoneSeries && m.seasons && m.seasons.length > 0) {
    mzSeasonHtml = `
      <div class="season-selector">
        <h3 class="blk-t">Daftar Episode</h3>
        <select id="seasonSelect" class="sel">
          ${m.seasons.map(s => `<option value="${s.season_number}">${esc(s.name)} (${s.episode_count} Eps)</option>`).join('')}
        </select>
        <div id="episodes-list" class="ep-grid" style="margin-top: 15px;"></div>
      </div>
    `;
  }

  // Render Tombol Daftar Episode (Khusus Anime NanimeID)
  let animeEpHtml = '';
  if (viewMode === 'anime' && m.episodes && m.episodes.length > 0) {
    animeEpHtml = `
      <div class="season-selector">
        <h3 class="blk-t">Pilih Episode</h3>
        <div class="ep-grid" style="grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));">
          ${m.episodes.map(ep => `
            <button class="srv" onclick="playEpisodeAnime(this, '${esc(ep.slug_req)}',${ep.number})" style="text-align:center; padding: 12px">
              Eps ${ep.number}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  content.innerHTML = `
    <section class="dh">
      ${m.backdrop ? `<div class="hm wide"><img src="${esc(m.backdrop)}" alt="" onload="this.classList.add('ld')" onerror="this.parentNode.remove()"></div>` : ''}
      <img class="po" src="${poster}" alt="${esc(m.title)}" onerror="this.onerror=null;this.src=NOPOSTER">
      <div>
        <h1>${esc(m.title)}</h1>
        <div class="chips">
          ${m.rating ? `<span class="chip star">${I.star}${esc(m.rating)}</span>` : ''}
          <span class="chip">${esc(m.year || m.release_year || '-')}</span>
          ${m.duration ? `<span class="chip">${I.clock}${esc(m.duration)}</span>` : ''}
          ${m.episodes_count ? `<span class="chip">Total Eps: ${esc(m.episodes_count)}</span>` : ''}
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
        <span class="lbl">
          ${viewMode === 'anime' ? 'Pilih episode di bawah untuk memuat player' : 'Server Utama'}
        </span>
        ${servers.map((s, i) => `<button class="srv" data-i="${i}" aria-pressed="${i === Math.min(startServer, servers.length - 1)}">${esc(s.name)}</button>`).join('')}
        <div class="tools">
          <a class="tool" id="openTab" target="_blank" rel="noopener">${I.ext}Buka di tab baru</a>
          <button class="tool" id="dimBtn" aria-pressed="false">${I.moon}Mode bioskop</button>
        </div>
      </div>
      <p class="hint" id="hint" hidden></p>
    </section>
    
    <section class="more-blk">
      ${castHtml}
      ${mzSeasonHtml}
      ${animeEpHtml}
    </section>
  `;

  const first = Math.min(startServer, servers.length - 1);
  if (servers.length) {
    P.watched = resumeAt;
    if (offer) P.hold = offer.watched;
    setSource(first, resumeAt);
    if (resumeAt) showResumed(resumeAt);
  } else {
    // Kalau anime, layar defaultnya suruh pilih episode dulu. Kalau movie tapi kosong = server down.
    const msg = viewMode === 'anime' ? 'Silakan pilih episode di bawah untuk memulai' : 'Film ini belum punya server pemutar.';
    $('#screen').innerHTML = `<div class="perr"><b>${viewMode === 'anime' ? 'Pilih Episode' : 'Sumber video belum tersedia'}</b><span>${msg}</span></div>`;
    if(viewMode !== 'anime') $('#openTab')?.remove();
  }

  $('#resumeYes')?.addEventListener('click', () => {
    P.hold = 0; P.watched = offer.watched; setSource(cur, offer.watched);
    $('#resume').remove(); showResumed(offer.watched);
  });
  
  $('#resumeNo')?.addEventListener('click', () => {
    P.hold = 0; P.watched = 0; setSource(cur, 0); $('#resume').remove();
  });

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

  if (isMoviezoneSeries && m.seasons && m.seasons.length > 0) {
    const seasonSelect = $('#seasonSelect');
    loadEpisodesSeries(seasonSelect.value); 
    seasonSelect.addEventListener('change', (e) => {
      loadEpisodesSeries(e.target.value);
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
