const box = $('#hist');
const rtf = new Intl.RelativeTimeFormat('id', { numeric: 'auto' });

function ago(ts) {
  const diff = (ts - Date.now()) / 1000;
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [u, s] of units) {
    if (Math.abs(diff) >= s) return rtf.format(Math.round(diff / s), u);
  }
  return 'baru saja';
}

function item(x) {
  const pct = x.total ? Math.min(100, Math.round((x.watched / x.total) * 100)) : 0;
  const status = x.done
    ? 'Selesai ditonton'
    : x.total
      ? `${fmtTime(x.watched)} dari ${fmtTime(x.total)}`
      : `Ditonton ${fmtTime(x.watched)}`;
  return `
  <article class="hitem" data-id="${esc(x.id)}">
    <a class="hposter" href="${resumeLink(x)}" tabindex="-1" aria-hidden="true">
      <img src="${esc(x.poster || NOPOSTER)}" alt="" loading="lazy" onerror="this.onerror=null;this.src=NOPOSTER">
    </a>
    <div class="hbody">
      <h3><a href="${resumeLink(x)}">${esc(x.title)}</a></h3>
      <div class="hmeta">
        ${x.year ? `<span>${esc(x.year)}</span>` : ''}
        ${x.durationText ? `<span>${I.clock}${esc(x.durationText)}</span>` : ''}
        <span>${ago(x.updatedAt)}</span>
      </div>
      <div class="hstat"><b>${status}</b>${pct && !x.done ? `<span>${pct}%</span>` : ''}</div>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${x.done ? 100 : pct}"><i style="width:${x.done ? 100 : pct}%"></i></div>
      <div class="hact">
        <a class="btn red sm" href="${resumeLink(x)}">${I.play}${x.done ? 'Tonton lagi' : `Lanjut dari ${fmtTime(x.watched)}`}</a>
        <button class="tool sm" data-del="${esc(x.id)}" aria-label="Hapus ${esc(x.title)} dari riwayat">${I.trash}Hapus</button>
      </div>
    </div>
  </article>`;
}

function render() {
  const list = Hist.all();
  if (!list.length) {
    box.innerHTML = `
      <div class="state">
        <div class="state-ic">${I.history}</div>
        <h3>Belum ada riwayat</h3>
        <p>Film yang kamu tonton akan muncul di sini beserta durasinya, jadi bisa dilanjutkan kapan saja.</p>
        <a class="btn red" href="index.html">Cari film</a>
      </div>`;
    return;
  }
  const secs = list.reduce((a, x) => a + (x.watched || 0), 0);
  box.innerHTML = `
    <section class="sec hist-sec">
      <div class="hist-head">
        <div>
          <h1>Riwayat tontonan</h1>
          <p class="sub">${list.length} film · total ${fmtTime(secs)} ditonton</p>
        </div>
        <button class="tool" id="clearAll">${I.trash}Hapus semua</button>
      </div>
      <div class="hlist">${list.map(item).join('')}</div>
    </section>`;
}

box.addEventListener('click', (e) => {
  const del = e.target.closest('[data-del]');
  if (del) {
    Hist.remove(del.dataset.del);
    render();
    toast('Dihapus dari riwayat');
    return;
  }
  if (e.target.closest('#clearAll') && confirm('Hapus seluruh riwayat tontonan?')) {
    Hist.clear();
    render();
  }
});

render();
