(() => {
  'use strict';

  document.body.classList.add('fantasy-v3');

  function addBranding() {
    document.querySelectorAll('.brand-copy strong, .mobile-brand strong').forEach(el => {
      if (el.querySelector('.v3-brand-badge')) return;
      el.insertAdjacentHTML('beforeend', '<span class="v3-brand-badge">V3</span>');
    });
    if (!document.querySelector('.v3-floating-badge')) {
      const badge = document.createElement('div');
      badge.className = 'v3-floating-badge';
      badge.textContent = 'Fantasy OS · Visual V3';
      document.body.appendChild(badge);
    }
  }

  function decorateCards() {
    document.querySelectorAll('.panel, .kpi-card, .summary-card, .player-card, .manager-card, .market-hero').forEach(el => {
      el.classList.add('v3-section-glow');
    });
  }

  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      entry.target.animate([
        { opacity: .45, transform: 'translateY(7px) scale(.996)' },
        { opacity: 1, transform: 'translateY(0) scale(1)' }
      ], { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
      io.unobserve(entry.target);
    });
  }, { threshold: .06 }) : null;

  function observeNewPanels() {
    if (!io) return;
    document.querySelectorAll('.panel:not([data-v3-observed]), .kpi-card:not([data-v3-observed]), .player-card:not([data-v3-observed])').forEach(el => {
      el.dataset.v3Observed = '1';
      io.observe(el);
    });
  }

  function polishHero() {
    const heading = document.querySelector('[data-view="command"] .hero-heading h1');
    if (heading && !heading.dataset.v3Polished) {
      heading.dataset.v3Polished = '1';
      const original = heading.textContent.trim();
      if (original && !original.includes('⚡')) heading.textContent = `${original} ⚡`;
    }
  }

  function addMicroBars() {
    document.querySelectorAll('.kpi-card').forEach((card, index) => {
      if (card.querySelector('.v3-microbar')) return;
      const bar = document.createElement('div');
      bar.className = 'v3-microbar';
      bar.innerHTML = `<span style="width:${[82,68,91,74,63,86][index % 6]}%"></span>`;
      card.appendChild(bar);
    });
  }

  function addStylesForEnhancements() {
    if (document.getElementById('v3-ui-inline')) return;
    const style = document.createElement('style');
    style.id = 'v3-ui-inline';
    style.textContent = `
      .v3-microbar{height:3px;border-radius:999px;background:rgba(255,255,255,.06);overflow:hidden;margin-top:12px}
      .v3-microbar span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--v3-green),var(--v3-cyan));box-shadow:0 0 12px rgba(88,200,255,.22)}
      body.fantasy-v3 .hero-status{position:relative}
      body.fantasy-v3 .hero-status:after{content:'LIVE';display:inline-flex;margin-left:8px;padding:4px 7px;border-radius:999px;background:rgba(114,241,184,.1);border:1px solid rgba(114,241,184,.18);color:var(--v3-green);font-size:8px;font-weight:900;letter-spacing:.12em}
      body.fantasy-v3 .player-card [class*='trend'],body.fantasy-v3 .player-card [class*='change']{font-weight:800}
      body.fantasy-v3 .chart-summary strong{letter-spacing:-.04em}
      body.fantasy-v3 .link-btn{color:var(--v3-cyan)!important}
    `;
    document.head.appendChild(style);
  }

  function run() {
    addBranding();
    decorateCards();
    observeNewPanels();
    polishHero();
    addMicroBars();
    addStylesForEnhancements();
  }

  run();
  const mo = new MutationObserver(() => {
    clearTimeout(mo._v3Timer);
    mo._v3Timer = setTimeout(run, 80);
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();
