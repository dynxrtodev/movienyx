const grid = document.getElementById('movie-grid');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

// Fungsi utama buat ngerender kotak-kotak film
function renderMovies(data) {
  grid.innerHTML = ''; // Bersihin grid
  
  if (!data || data.length === 0) {
    grid.innerHTML = '<p style="text-align:center; grid-column: 1 / -1;">Waduh, filmnya kaga nemu lek.</p>';
    return;
  }

  data.forEach(movie => {
    const card = document.createElement('div');
    card.className = 'card';
    
    // Key di API Moviezone pake 'year' dan 'poster'
    const year = movie.year ? movie.year : '-';
    const coverUrl = movie.poster || '';
    
    card.innerHTML = `
      <img src="${coverUrl}" alt="${movie.title}" loading="lazy">
      <div class="info">
        <div class="title">${movie.title}</div>
        <div class="meta">
          <span>⭐ ${movie.rating || 'N/A'}</span>
          <span>${year}</span>
        </div>
      </div>
    `;
    
    // API Moviezone pake 'slug' buat ngebuka detailnya, bukan subjectId angka
    card.addEventListener('click', () => {
      window.location.href = `detail.html?id=${movie.slug}`;
    });
    
    grid.appendChild(card);
  });
}

// Narik data Trending (Default pas web dibuka)
async function loadTrending() {
  grid.innerHTML = '<p style="text-align:center; grid-column: 1 / -1;">Lagi nyedot data trending...</p>';
  try {
    // Tembak ke /api/movie biar Vercel yang nerusin ke Pterodactyl (Anti HTTPS Error)
    const response = await fetch('/api/movie?action=trending');
    const data = await response.json();
    renderMovies(data.results || data);
  } catch (err) {
    grid.innerHTML = `<p style="color:red; text-align:center; grid-column: 1 / -1;">Error: ${err.message}</p>`;
  }
}

// Narik data Search
async function searchMovies(keyword) {
  grid.innerHTML = `<p style="text-align:center; grid-column: 1 / -1;">Nyari "${keyword}"...</p>`;
  try {
    const response = await fetch(`/api/movie?action=search&keyword=${encodeURIComponent(keyword)}`);
    const result = await response.json();
    renderMovies(result.results || []); 
  } catch (err) {
    grid.innerHTML = `<p style="color:red; text-align:center; grid-column: 1 / -1;">Error: ${err.message}</p>`;
  }
}

// Trigger pencarian pas tombol diklik
searchBtn.addEventListener('click', () => {
  const keyword = searchInput.value.trim();
  if (keyword) searchMovies(keyword);
});

// Trigger pencarian pas pencet Enter di keyboard
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const keyword = searchInput.value.trim();
    if (keyword) searchMovies(keyword);
  }
});

// Load awal
loadTrending();
