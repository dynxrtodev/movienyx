const content = $('#detail');
const slugId = new URLSearchParams(location.search).get('id');

function stateBox(title, msg) {
  content.innerHTML = `<div class="state"><h3>${esc(title)}</h3><p>${esc(msg)}</p><a class="btn red" href="index.html">Kembali ke beranda</a></div>`;
}

async function loadDetail() {
  if (!slugId) return stateBox('Film tidak ditemukan', 'Alamat halaman ini tidak memuat ID film.');
  try {
    const res = await fetch(`/api/movie?action=detail&id=${encodeURIComponent(slugId)}`);
    if (!res.ok) throw new Error(`Server membalas ${res.status}`);
    const movie = await res.json();
    if (movie.error) throw new Error(movie.error);
    renderDetail(movie);
  } catch (err) {
    stateBox('Detail film gagal dimuat', err.message);
  }
}

function getServers(movie) {
  const list = [];
  if (movie.primary_stream) list.push({ name: 'Utama', url: movie.primary_stream });
  (movie.servers || []).forEach((s) => {
    if (s && s.url && !list.some((x) => x.url === s.url)) list.push({ name: s.name || `Server ${list.length + 1}`, url: s.url });
  });
  return list;
}

function setSource(url) {
  const screen = $('#screen');
  // Iframe murni tanpa sandbox biar server embed kaga ngeblokir koneksinya
  screen.innerHTML = `<iframe src="${esc(url)}" title="Pemutar Movienyx" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowfullscreen style="position: absolute; inset: 0; width: 100%; height: 100%; border: 0;"></iframe>`;
  $('#openTab').href = url;
}

function renderDetail(movie) {
  document.title = `${movie.title} - Movienyx`;
  const servers = getServers(movie);
  const poster = esc(movie.poster || NOPOSTER);

  content.innerHTML = `
    <section class="dh">
      <div class="bd" style="background-image:url('${poster}')"></div>
      <img class="po" src="${poster}" alt="${esc(movie.title)}" onerror="this.onerror=null;this.src=NOPOSTER">
      <div>
        <h1>${esc(movie.title)}</h1>
        <div class="chips">
          ${movie.rating ? `<span class="chip star">${I.star}${esc(movie.rating)}</span>` : ''}
          <span class="chip">${esc(movie.year || '-')}</span>
          <span class="chip">${esc(movie.duration || '-')}</span>
        </div>
        <p class="syn">${esc(movie.synopsis || 'Belum ada sinopsis untuk film ini.')}</p>
      </div>
    </section>

    <section class="theater" aria-label="Pemutar film">
      <div class="stage"><div class="screen" id="screen"></div></div>
      <div class="floor" style="justify-content: flex-start;">
        <span class="lbl">Server</span>
        ${servers.map((s, i) => `<button class="srv" data-i="${i}" aria-pressed="${i === 0}">${esc(s.name)}</button>`).join('')}
        <div class="tools" style="margin-left: auto;">
          <a class="tool" id="openTab" target="_blank" rel="noopener">${I.ext}Buka di tab baru</a>
          <button class="tool" id="dimBtn" aria-pressed="false">${I.moon}Mode bioskop</button>
        </div>
      </div>
    </section>
    <div style="text-align:center; padding: 10px; color: #888; font-size: 13px;">
      💡 Tip: Nonton banyak iklan? Pakai browser Brave atau uBlock Origin.
    </div>`;

  if (servers.length) {
    setSource(servers[0].url);
  } else {
    $('#screen').innerHTML = '<div class="perr"><b>Sumber video belum tersedia</b><span>Film ini belum punya server pemutar.</span></div>';
    $('#openTab').remove();
  }

  content.querySelector('.floor').addEventListener('click', (e) => {
    const b = e.target.closest('.srv');
    if (!b) return;
    content.querySelectorAll('.srv').forEach((x) => x.setAttribute('aria-pressed', x === b));
    setSource(servers[+b.dataset.i].url);
  });

  const dim = $('#dimBtn');
  const toggle = (on) => {
    document.body.classList.toggle('dim', on);
    dim.setAttribute('aria-pressed', on);
  };
  dim.addEventListener('click', () => toggle(!document.body.classList.contains('dim')));
  document.addEventListener('keydown', (e) => e.key === 'Escape' && toggle(false));
}

loadDetail();
