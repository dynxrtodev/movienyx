const content = document.getElementById('detail-content');

// Ambil ID (slug) dari URL (misal: detail.html?id=goat-2024)
const urlParams = new URLSearchParams(window.location.search);
const slugId = urlParams.get('id');

async function loadDetail() {
  if (!slugId) {
    content.innerHTML = '<p style="color:red; text-align:center;">Waduh, ID filmnya kaga ada.</p>';
    return;
  }

  try {
    // Cuma butuh 1 fetch karena detail dari Moviezone udah sekalian ngasih link embed video
    const res = await fetch(`/api/movie?action=detail&id=${slugId}`);
    const movie = await res.json();
    
    if (movie.error) throw new Error(movie.error);
    
    renderDetail(movie);
  } catch (err) {
    content.innerHTML = `<p style="color:red; text-align:center;">Error gagal muat: ${err.message}</p>`;
  }
}

function renderDetail(movie) {
  // Looping tombol server biar user bisa ganti kalau videonya macet
  let serverButtons = '';
  if (movie.servers && movie.servers.length > 0) {
    serverButtons = movie.servers.map((s) => 
      `<button onclick="document.getElementById('iframe-player').src='${s.url}'" 
               style="padding: 6px 12px; margin-right: 8px; margin-bottom: 8px; background: #333; color: white; border: 1px solid #555; cursor:pointer; border-radius:4px; font-weight:bold;">
        ${s.name}
      </button>`
    ).join('');
  }

  content.innerHTML = `
    <div class="detail-wrapper">
      <img src="${movie.poster}" alt="${movie.title}" class="poster-large">
      
      <div>
        <h1 style="margin-bottom: 10px;">${movie.title}</h1>
        <div class="tags" style="margin-bottom: 15px;">
          <span>⭐ ${movie.rating || 'N/A'}</span>
          <span>${movie.year || '-'}</span>
          <span>${movie.duration || '-'}</span>
        </div>
        <p style="color: #ccc; line-height: 1.5; font-size: 14px;">
          ${movie.synopsis || 'Tidak ada deskripsi.'}
        </p>
      </div>

      <div class="video-container" style="margin-top: 20px;">
        <h3 style="margin-bottom: 10px; color: #e50914;">▶ MovieNyx Player</h3>
        
        <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; background: #000; border-radius: 8px;">
          <iframe id="iframe-player" 
                  src="${movie.primary_stream}" 
                  style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" 
                  allowfullscreen="true" 
                  webkitallowfullscreen="true" 
                  mozallowfullscreen="true" 
                  scrolling="no">
          </iframe>
        </div>
        
        <div style="margin-top: 15px;">
          <p style="font-size: 13px; color: #888; margin-bottom: 10px;">Ganti server kalau macet/error:</p>
          <div style="display: flex; flex-wrap: wrap;">
            ${serverButtons}
          </div>
        </div>
      </div>
    </div>
  `;
}

// Eksekusi jalanin
loadDetail();
