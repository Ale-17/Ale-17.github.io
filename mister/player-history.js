(() => {
  'use strict';

  let seriesPromise = null;
  const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const tone = value => Number(value) > 0 ? 'positive' : Number(value) < 0 ? 'negative' : 'neutral';
  const compactEuro = value => {
    const n = num(value);
    if (n == null) return '—';
    const sign = n < 0 ? '−' : '';
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toLocaleString('es-ES', { maximumFractionDigits: 2 })} M€`;
    if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000).toLocaleString('es-ES')}k`;
    return `${sign}${abs.toLocaleString('es-ES')} €`;
  };
  const signedEuro = value => {
    const n = num(value);
    if (n == null) return '—';
    return `${n > 0 ? '+' : n < 0 ? '−' : ''}${compactEuro(Math.abs(n))}`;
  };
  const date = value => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit' }).format(d);
  };

  function loadSeries() {
    if (!seriesPromise) {
      seriesPromise = fetch('./data/series.json', { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null);
    }
    return seriesPromise;
  }

  function chart(points) {
    const data = points.filter(p => p && p.captured_at && num(p.market_value) != null).slice(-90);
    if (data.length < 2) return '';
    const W = 360, H = 126, L = 4, R = 4, T = 10, B = 20;
    const values = data.map(p => num(p.market_value));
    let min = Math.min(...values), max = Math.max(...values);
    if (min === max) { min -= 1; max += 1; }
    const pad = (max - min) * .12;
    min -= pad; max += pad;
    const x = i => L + (i / Math.max(data.length - 1, 1)) * (W - L - R);
    const y = v => T + (1 - (v - min) / (max - min)) * (H - T - B);
    const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
    const first = values[0], last = values[values.length - 1], delta = last - first;
    return `
      <div class="drawer-section player-history-section">
        <h3>Evolución histórica de VM</h3>
        <svg class="drawer-history-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Evolución histórica del valor de mercado">
          <line x1="${L}" x2="${W-R}" y1="${H-B}" y2="${H-B}"/>
          <path d="${path}"/>
          <circle cx="${x(data.length-1)}" cy="${y(last)}" r="3"/>
          <text x="${L}" y="${H-4}">${date(data[0].captured_at)}</text>
          <text x="${W-R}" y="${H-4}" text-anchor="end">${date(data[data.length-1].captured_at)}</text>
        </svg>
        <div class="drawer-history-meta"><span>${data.length} snapshots · ${compactEuro(first)} → ${compactEuro(last)}</span><strong class="${tone(delta)}">${signedEuro(delta)}</strong></div>
      </div>`;
  }

  async function enhanceDrawer(playerId) {
    const drawer = document.querySelector('#drawerContent');
    if (!drawer || drawer.querySelector('.player-history-section')) return;
    const series = await loadSeries();
    const points = series?.players?.[String(playerId)]?.points;
    if (!Array.isArray(points)) return;
    const html = chart(points);
    if (!html || drawer.querySelector('.player-history-section')) return;
    const firstSection = drawer.querySelector('.drawer-section');
    if (firstSection) firstSection.insertAdjacentHTML('beforebegin', html);
    else drawer.insertAdjacentHTML('beforeend', html);
  }

  const style = document.createElement('style');
  style.textContent = `
    .drawer-history-chart{width:100%;height:126px;display:block;overflow:visible;margin-top:4px}
    .drawer-history-chart line{stroke:rgba(255,255,255,.08);stroke-width:1;vector-effect:non-scaling-stroke}
    .drawer-history-chart path{fill:none;stroke:var(--green);stroke-width:2.2;vector-effect:non-scaling-stroke}
    .drawer-history-chart circle{fill:var(--green)}
    .drawer-history-chart text{font:8px Inter,ui-sans-serif,system-ui;fill:var(--muted)}
    .drawer-history-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:7px;font-size:8px;color:var(--muted)}
    .drawer-history-meta strong{font-size:10px;white-space:nowrap}
  `;
  document.head.appendChild(style);

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-player-id]');
    if (!target?.dataset.playerId) return;
    setTimeout(() => enhanceDrawer(target.dataset.playerId), 0);
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target.closest?.('[data-player-id]');
    if (!target?.dataset.playerId) return;
    setTimeout(() => enhanceDrawer(target.dataset.playerId), 0);
  }, true);
})();
