const content = document.getElementById('detail-content');

// Ambil ID dari URL (misal: detail.html?id=12345)
const urlParams = new URLSearchParams(window.location.search);
const subjectId = urlParams.get('id');

async function loadDetailAndPlay() {
  if (!subjectId) {
    content.innerHTML = '<p style="color:red;">Waduh, ID filmnya kaga ada.</p>';
    return;
  }

  try {
    // Tembak 2 API sekaligus biar cepet (Detail & Play)
    const [detailRes, playRes] = await Promise.all([
      fetch(`/api/movie?action=detail&id=${subjectId}`),
      fetch(`/api/movie?action=play&id=${subjectId}`)
    ]);

    const movie = await detailRes.json();
    const playData = await playRes.json();

    renderDetail(movie, playData);

  } catch (err) {
    content.innerHTML = `<p style="color:red;">Error gagal muat: ${err.message}</p>`;
  }
}

function renderDetail(movie, playData) {
  // Ekstrak URL HLS (.m3u8) dari balikan API Play
  const hlsUrl = playData.playHls || (playData.streams && playData.streams[0] && playData.streams[0].hls);
  
  // Format durasi (detik ke menit)
  const duration = movie.duration ? Math.floor(movie.duration / 60) + ' Menit' : '-';

  content.innerHTML = `
    <div class="detail-wrapper">
      <img src="${movie.cover}" alt="${movie.title}" class="poster-large">
      
      <div>
        <h1 style="margin-bottom: 10px;">${movie.title}</h1>
        <div class="tags" style="margin-bottom: 15px;">
          <span>⭐ ${movie.imdb || 'N/A'}</span>
          <span>${movie.releaseDate || '-'}</span>
          <span>${duration}</span>
          <span>${movie.country || '-'}</span>
        </div>
        <p style="color: #ccc; line-height: 1.5; font-size: 14px;">
          ${movie.description || 'Tidak ada deskripsi.'}
        </p>
      </div>

      <div class="video-container">
        <h3 style="margin-bottom: 10px; color: #e50914;">▶ Player (Eksperimental)</h3>
        <video id="player" controls playsinline></video>
        <p style="font-size: 12px; color: #888; margin-top: 10px;">
          Kalau error diputar, server nge-blokir karena butuh header Cookie CDN.
        </p>
      </div>
    </div>
  `;

  // Setup HLS.js buat videonya
  setupPlayer(hlsUrl);
}

function setupPlayer(streamUrl) {
  const video = document.getElementById('player');
  
  if (!streamUrl) {
    video.parentElement.innerHTML += '<p style="color:red;">Link stream tidak ditemukan.</p>';
    return;
  }

  // Kalau browsernya Safari (Apple), bisa muter m3u8 asli tanpa hls.js
  if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = streamUrl;
  } 
  // Pakai hls.js buat Chrome/Firefox/Android
  else if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(streamUrl);
    hls.attachMedia(video);
  }
}

// Eksekusi jalanin
loadDetailAndPlay();
