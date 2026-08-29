(() => {
  'use strict';

  const state = {
    data: null,
    history: null,
    series: null,
    view: 'command',
    marketPosition: 'all',
    marketSort: 'score',
    marketSearch: '',
    teamSort: 'daily',
    movementFilter: 'all',
    trendMetric: 'wealth',
    rivalMetric: 'capacity',
    allObjects: [],
    playerIndex: new Map(),
    commandItems: []
  };

  const VIEW_META = {
    command: ['CONTROL CENTER', 'Control'],
    market: ['LIVE MARKET', 'Mercado'],
    squad: ['PORTFOLIO', 'Plantilla'],
    rivals: ['OPPONENT INTELLIGENCE', 'Rivales'],
    gameweeks: ['PERFORMANCE', 'Jornadas'],
    transfers: ['MARKET HISTORY', 'Actividad'],
    clauses: ['CLAUSE INTELLIGENCE', 'Cláusulas'],
    data: ['DATA QUALITY', 'Datos']
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const safe = value => String(value ?? '').replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
  const cleanName = value => String(value || 'Sin nombre').replace(/\s*💥\s*/g, '').trim();
  const normalizeName = value => cleanName(value).toLocaleLowerCase('es-ES');
  const posLabel = position => ({ 1: 'POR', 2: 'DEF', 3: 'MED', 4: 'DEL' }[Number(position)] || '—');
  const tone = value => Number(value) > 0 ? 'positive' : Number(value) < 0 ? 'negative' : 'neutral';

  const euro = value => {
    const n = num(value);
    return n == null ? '—' : new Intl.NumberFormat('es-ES', {
      style: 'currency', currency: 'EUR', maximumFractionDigits: 0
    }).format(n);
  };

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
    if (n === 0) return '0 €';
    return `${n > 0 ? '+' : '−'}${compactEuro(Math.abs(n))}`;
  };

  const signedPct = value => {
    const n = num(value);
    if (n == null) return '—';
    return `${n > 0 ? '+' : ''}${n.toLocaleString('es-ES', { maximumFractionDigits: 2 })}%`;
  };

  const integer = value => {
    const n = num(value);
    return n == null ? '—' : Math.round(n).toLocaleString('es-ES');
  };

  const toDate = value => {
    if (!value) return null;
    const normalized = typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:/.test(value)
      ? value.replace(' ', 'T') : value;
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const dateTime = value => {
    const d = toDate(value);
    if (!d) return value || '—';
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
    }).format(d);
  };

  const shortDate = value => {
    const d = toDate(value);
    if (!d) return '—';
    return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit' }).format(d);
  };

  function walkObjects(value, out = [], depth = 0) {
    if (!value || depth > 7) return out;
    if (Array.isArray(value)) {
      value.forEach(v => walkObjects(v, out, depth + 1));
    } else if (typeof value === 'object') {
      out.push(value);
      Object.values(value).forEach(v => walkObjects(v, out, depth + 1));
    }
    return out;
  }

  function collectArrays(value, path = 'root', out = [], depth = 0) {
    if (!value || depth > 5) return out;
    if (Array.isArray(value)) {
      out.push({ path, value });
      value.slice(0, 8).forEach((v, i) => {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          collectArrays(v, `${path}[${i}]`, out, depth + 1);
        }
      });
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => collectArrays(v, `${path}.${k}`, out, depth + 1));
    }
    return out;
  }

  function findArrayByShape(required, preferred = '') {
    let best = [];
    let bestScore = -1;
    for (const entry of collectArrays(state.data)) {
      const sample = entry.value.find(v => v && typeof v === 'object' && !Array.isArray(v));
      if (!sample) continue;
      if (!required.every(k => Object.prototype.hasOwnProperty.call(sample, k))) continue;
      let score = required.length * 10 + Math.min(entry.value.length, 40);
      if (preferred && entry.path.toLowerCase().includes(preferred.toLowerCase())) score += 50;
      if (score > bestScore) {
        best = entry.value;
        bestScore = score;
      }
    }
    return best;
  }

  async function fetchFirstJson(paths, optional = false) {
    let lastError = null;
    for (const path of paths) {
      try {
        const response = await fetch(path, { cache: 'no-store' });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const text = await response.text();
        if (!text.trim() || text.trim() === 'null') return optional ? null : {};
        return JSON.parse(text);
      } catch (error) {
        lastError = error;
      }
    }
    if (optional) return null;
    throw lastError || new Error('No se pudo cargar el JSON');
  }

  function getMarket() {
    return Array.isArray(state.data?.market_players) ? state.data.market_players : [];
  }

  function getFreeMarket() {
    return getMarket().filter(p =>
      String(p.owner_id) === '0' ||
      normalizeName(p.owner_name) === 'libre'
    );
  }

  function getMyTeam() {
    return Array.isArray(state.data?.my_team) ? state.data.my_team : [];
  }

  function getLeague() {
    return Array.isArray(state.data?.league_users) ? state.data.league_users : [];
  }

  function getBalances() {
    if (Array.isArray(state.data?.estimated_rival_balances)) return state.data.estimated_rival_balances;
    return findArrayByShape(['name', 'estimated_balance', 'team_value'], 'balance');
  }

  function getTransfers() {
    if (Array.isArray(state.data?.transfers_detected)) return state.data.transfers_detected;
    return findArrayByShape(['created', 'from', 'to', 'price'], 'transfer');
  }

  function getClauseSnapshots() {
    if (Array.isArray(state.data?.member_clause_snapshots)) return state.data.member_clause_snapshots;
    return findArrayByShape(['name', 'clauses'], 'clause');
  }

  function getManagerAudits() {
    const directCandidates = Object.entries(state.data || {})
      .filter(([, value]) => Array.isArray(value))
      .map(([, value]) => value)
      .filter(value => value.some(v => v && Array.isArray(v.current_holdings) && 'reconstructed_balance' in v));
    return directCandidates[0] || findArrayByShape(['name', 'reconstructed_balance', 'current_holdings'], 'audit');
  }

  function getAleUser() {
    return getLeague().find(u => normalizeName(u.name) === 'ale') ||
      getLeague().find(u => String(u.user_id) === '12165479') || null;
  }

  function getBalanceRow(name) {
    return getBalances().find(r => normalizeName(r.name) === normalizeName(name)) || null;
  }

  function getAuditRow(name) {
    return getManagerAudits().find(r => normalizeName(r.name) === normalizeName(name)) || null;
  }

  function getClauseRow(name) {
    return getClauseSnapshots().find(r => normalizeName(r.name) === normalizeName(name)) || null;
  }

  function teamValue() {
    const me = getAleUser();
    const leagueValue = num(me?.displayed_euro_value);
    if (leagueValue != null) return leagueValue;
    return getMyTeam().reduce((sum, p) => sum + (num(p.market_value) || 0), 0);
  }

  function playerCountFromUser(user) {
    const item = Array.isArray(user?.score_candidates)
      ? user.score_candidates.find(x => x?.class === 'played') : null;
    const match = String(item?.text || '').match(/(\d+)\s+jugadores/i);
    return match ? Number(match[1]) : null;
  }

  function mapPosition(player) {
    if (num(player?.position) != null) return Number(player.position);
    const market = getMarket().find(p => String(p.player_id) === String(player?.player_id));
    return num(market?.position);
  }

  function getListedPlayers() {
    return getMarket().filter(p => normalizeName(p.owner_name) === 'ale' || String(p.owner_id) === '12165479');
  }

  function getActiveBidCommitment() {
    const current = num(state.data?.my_balance?.current_balance);
    const future = num(state.data?.my_balance?.future_balance);
    if (current != null && future != null && future < current) return current - future;
    return 0;
  }

  function getLiveSections() {
    return Object.entries(state.data || {}).filter(([key]) =>
      /bid|offer|puja|oferta/i.test(key) &&
      !/history|transfer|movement|other_bids/i.test(key)
    );
  }

  function flattenOne(value) {
    if (Array.isArray(value)) return value.filter(x => x && typeof x === 'object');
    if (value && typeof value === 'object') {
      const arrays = Object.values(value).filter(Array.isArray);
      if (arrays.length) return arrays.flat().filter(x => x && typeof x === 'object');
      return [value];
    }
    return [];
  }

  function extractRealOffers() {
    const offers = [];
    for (const [key, value] of Object.entries(state.data || {})) {
      if (!/offer|oferta/i.test(key) || /history/i.test(key)) continue;
      for (const obj of flattenOne(value)) {
        const amount = num(obj.offer_amount ?? obj.amount ?? obj.price ?? obj.value);
        const pid = obj.player_id ?? obj.id_player ?? obj.player?.id;
        const pname = obj.player_name ?? obj.name ?? obj.player?.name ?? obj.player;
        if (amount == null || (!pid && !pname)) continue;
        const listed = getListedPlayers().find(p =>
          (pid && String(p.player_id) === String(pid)) ||
          (pname && normalizeName(p.name) === normalizeName(pname))
        );
        if (!listed) continue;
        offers.push({
          key,
          player_id: listed.player_id,
          name: cleanName(listed.name),
          amount,
          market_value: num(listed.market_value) || 0,
          raw: obj
        });
      }
    }
    const unique = new Map();
    for (const offer of offers) {
      const existing = unique.get(String(offer.player_id));
      if (!existing || offer.amount > existing.amount) unique.set(String(offer.player_id), offer);
    }
    return [...unique.values()];
  }

  function getGameweekCapture() {
    if (state.data?.gameweek_payment_capture && typeof state.data.gameweek_payment_capture === 'object') {
      return state.data.gameweek_payment_capture;
    }
    if (state.data?.scoring_capture?.gameweek_payment_capture) {
      return state.data.scoring_capture.gameweek_payment_capture;
    }
    const obj = state.allObjects.find(o => Array.isArray(o?.closures) &&
      o.closures.some(c => c && ('gameweek' in c || 'gameweek_id' in c)));
    return obj || null;
  }

  function getGameweekClosures() {
    const capture = getGameweekCapture();
    if (Array.isArray(capture?.closures)) return capture.closures;
    const payments = Array.isArray(capture?.payments) ? capture.payments : [];
    const groups = new Map();
    for (const p of payments) {
      const key = String(p.gameweek_id ?? p.gameweek ?? 'unknown');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    }
    return [...groups.entries()].map(([key, group]) => ({
      key,
      gameweek: group[0]?.gameweek,
      gameweek_id: group[0]?.gameweek_id,
      latest_created: [...group].sort((a, b) => (toDate(b.created)?.getTime() || 0) - (toDate(a.created)?.getTime() || 0))[0]?.created,
      closure_count: 1,
      reopened_or_reclosed: false,
      latest_payments: group
    }));
  }

  function playerMarketScore(player) {
    const value = Math.max(num(player.market_value) || 1, 1);
    const daily = num(player.daily_market_change) || 0;
    const weekly = num(player.weekly_market_change) || 0;
    const dailyPct = num(player.daily_market_change_pct) ?? (daily / value * 100);
    const weeklyPct = num(player.weekly_market_change_pct) ?? (weekly / value * 100);
    const points = num(player.displayed_points) || 0;
    let score = 44;
    score += clamp(dailyPct, -15, 12) * 3.2;
    score += clamp(weeklyPct, -35, 60) * .55;
    score += clamp(points, 0, 20) * 1.15;
    if (daily > 75_000) score += 8;
    if (daily > 150_000) score += 6;
    if (daily < 0) score -= 12;
    if (weekly < 0) score -= 10;
    return Math.round(clamp(score, 0, 100));
  }

  function scoreClass(score) {
    if (score >= 76) return 'elite';
    if (score >= 56) return 'watch';
    if (score < 34) return 'avoid';
    return '';
  }

  function competitionPressure() {
    const recent = [...getTransfers()]
      .sort((a, b) => (toDate(b.created)?.getTime() || 0) - (toDate(a.created)?.getTime() || 0))
      .slice(0, 70)
      .filter(t => String(t.from).toLowerCase() === 'mister');
    if (!recent.length) return 0;
    const bidCounts = recent.map(t => Array.isArray(t.other_bids) ? t.other_bids.length : 0);
    return bidCounts.reduce((a, b) => a + b, 0) / bidCounts.length;
  }

  function bidModel(player) {
    const value = num(player.market_value) || 0;
    const base = Math.max(value, num(player.asking_price) || 0);
    const dailyPct = Math.max(0, num(player.daily_market_change_pct) || 0);
    const weeklyPct = Math.max(0, num(player.weekly_market_change_pct) || 0);
    const pressure = competitionPressure();
    const score = playerMarketScore(player);
    const winPremium = clamp(.014 + dailyPct * .004 + pressure * .007 + (score >= 76 ? .012 : 0), .012, .105);
    const ceilingPremium = clamp(winPremium + .018 + weeklyPct * .0009, winPremium + .015, .15);
    const round = value < 1_000_000 ? 1_000 : 5_000;
    const roundTo = n => Math.ceil(n / round) * round;
    return {
      value: roundTo(base),
      win: roundTo(base * (1 + winPremium)),
      ceiling: roundTo(base * (1 + ceilingPremium)),
      modelScore: score
    };
  }

  function playerEfficiency(player) {
    const value = Math.max(num(player.market_value) || 1, 1);
    const daily = num(player.daily_market_change) || 0;
    const points = num(player.displayed_points) || 0;
    return (daily / value * 100) * 8 + (points / Math.max(value / 1_000_000, .25));
  }

  function isProtectedPlayer(player) {
    const name = normalizeName(player.name);
    return name.includes('lookman') || name.includes('valles') || name.includes('valles');
  }

  function saleOpportunityCost(player) {
    if (isProtectedPlayer(player)) return 9999;
    const value = Math.max(num(player.market_value) || 1, 1);
    const dailyPct = (num(player.daily_market_change) || 0) / value * 100;
    const weeklyPct = (num(player.weekly_market_change) || 0) / value * 100;
    const points = num(player.displayed_points) || 0;
    return dailyPct * 7 + weeklyPct * .35 + points * .32;
  }

  function suggestedSaleCandidates() {
    return [...getMyTeam()]
      .filter(p => !isProtectedPlayer(p))
      .sort((a, b) => saleOpportunityCost(a) - saleOpportunityCost(b))
      .slice(0, 6);
  }

  function capacityModel() {
    const current = num(state.data?.my_balance?.current_balance) || 0;
    const future = num(state.data?.my_balance?.future_balance);
    const value = teamValue();
    const minBalance = -0.25 * value;
    const committedBalance = future == null ? current : future;
    const immediate = committedBalance - minBalance;
    const cancel = current - minBalance;
    const offers = extractRealOffers();
    const executableGain = offers.reduce((sum, o) => sum + Math.max(0, o.amount - .25 * o.market_value), 0);
    const executable = immediate + executableGain;
    const candidates = suggestedSaleCandidates();
    const potentialMinGain = candidates.reduce((sum, p) => sum + .70 * (num(p.market_value) || 0), 0);
    const potentialMaxGain = candidates.reduce((sum, p) => sum + .80 * (num(p.market_value) || 0), 0);
    return {
      current, future: committedBalance, value, minBalance, immediate, cancel, offers,
      executable, candidates,
      potentialMin: cancel + potentialMinGain,
      potentialMax: cancel + potentialMaxGain,
      commitment: Math.max(0, current - committedBalance)
    };
  }

  function managerModel(user) {
    const balance = getBalanceRow(user.name);
    const audit = getAuditRow(user.name);
    const teamVal = num(user.displayed_euro_value) ?? num(balance?.team_value) ?? num(audit?.team_value) ?? 0;
    const saldo = num(balance?.usable_estimated_balance) ?? num(balance?.estimated_balance) ?? num(audit?.reconstructed_balance);
    const capacity = num(balance?.remaining_debt_capacity_if_estimate_were_true) ??
      (saldo != null ? saldo + .25 * teamVal : null);
    const wealth = (saldo != null ? saldo : 0) + teamVal;
    const points = num(user.displayed_points) || 0;
    const players = playerCountFromUser(user) ?? num(audit?.roster_cards_detected);
    const threat = capacity == null ? 35 : clamp((capacity / 30_000_000) * 100 + (players != null && players <= 12 ? 10 : 0), 0, 100);
    return { user, balance, audit, teamVal, saldo, capacity, wealth, points, players, threat };
  }

  function buildPlayerIndex() {
    state.playerIndex = new Map();
    const add = (player, source) => {
      if (!player?.player_id) return;
      const id = String(player.player_id);
      const existing = state.playerIndex.get(id) || {};
      state.playerIndex.set(id, { ...existing, ...player, _source: existing._source || source });
    };
    getMarket().forEach(p => add(p, String(p.owner_id) === '0' ? 'market' : 'listed'));
    getMyTeam().forEach(p => add(p, 'squad'));
    for (const clauses of getClauseSnapshots()) {
      (clauses.clauses || []).forEach(p => add(p, 'clause'));
    }
    for (const audit of getManagerAudits()) {
      (audit.current_holdings || []).forEach(p => add({ ...p, owner_name: audit.name }, 'audit'));
    }
  }

  function renderHeader() {
    const captured = state.data?.captured_at;
    const finalized = state.data?.snapshot_finalized;
    $('#snapshotText').textContent = captured ? dateTime(captured) : 'Snapshot cargado';
    $('#snapshotPill').title = captured || '';
    const live = $('#sidebarLive');
    live.innerHTML = `<span class="pulse"></span><span>${finalized === true ? 'Snapshot finalizado' : finalized === false ? 'Snapshot parcial' : 'Estado desconocido'}</span>`;
  }

  function renderOverviewKpis() {
    const cap = capacityModel();
    const me = getAleUser();
    const league = [...getLeague()].sort((a, b) => (num(b.displayed_points) || 0) - (num(a.displayed_points) || 0));
    const rank = me ? league.findIndex(u => String(u.user_id) === String(me.user_id)) + 1 : null;
    const daily = getMyTeam().reduce((sum, p) => sum + (num(p.daily_market_change) || 0), 0);
    const items = [
      ['Saldo real', euro(cap.current), `Jornada: debe quedar ≥ 0`, '€'],
      ['Saldo futuro', euro(cap.future), cap.commitment ? `${compactEuro(cap.commitment)} comprometidos` : 'Sin pujas comprometidas detectadas', '→'],
      ['Plantilla', compactEuro(cap.value), `${getMyTeam().length} jugadores`, '◇'],
      ['Capacidad', compactEuro(cap.immediate), `mínimo permitido ${compactEuro(cap.minBalance)}`, '↗'],
      ['Puntos', me && num(me.displayed_points) != null ? `${integer(me.displayed_points)} pts` : '—', rank ? `${rank}.º de ${league.length}` : 'Acumulado visible', '★'],
      ['Hoy', signedEuro(daily), `${getMyTeam().filter(p => (num(p.daily_market_change) || 0) > 0).length}/${getMyTeam().length} en verde`, '⌁']
    ];
    $('#overviewKpis').innerHTML = items.map(([label, value, sub, icon]) => `
      <article class="kpi">
        <div class="kpi-top"><span>${safe(label)}</span><span class="kpi-icon">${safe(icon)}</span></div>
        <div class="kpi-value ${label === 'Hoy' ? tone(daily) : ''}">${safe(value)}</div>
        <div class="kpi-sub">${safe(sub)}</div>
      </article>
    `).join('');

    $('#heroRank').textContent = rank || '—';
    $('#heroState').textContent = state.data?.snapshot_finalized === true ? 'Datos listos' : 'Revisar captura';
  }

  function renderDecision() {
    const free = [...getFreeMarket()].sort((a, b) => playerMarketScore(b) - playerMarketScore(a));
    const top = free[0];
    const cap = capacityModel();
    const falling = [...getMyTeam()].filter(p => (num(p.daily_market_change) || 0) < 0)
      .sort((a, b) => (num(a.daily_market_change) || 0) - (num(b.daily_market_change) || 0));
    const finalized = state.data?.snapshot_finalized === true;
    let text = 'No hay una acción automática clara.';
    let foot = 'El radar local usa únicamente datos capturados; el informe automático de ChatGPT prevalece.';
    let confidence = 'MEDIA';

    if (!finalized) {
      text = 'Esperaría a un <strong>snapshot finalizado</strong> antes de mover dinero.';
      confidence = 'ALTA';
    } else if (cap.future < 0 && cap.commitment > 0) {
      text = `Revisaría las pujas: el saldo futuro queda en <strong>${euro(cap.future)}</strong>.`;
      foot = 'Puedes pujar con deuda, pero antes de jornada el saldo debe ser ≥ 0.';
      confidence = 'ALTA';
    } else if (top && playerMarketScore(top) >= 76) {
      const bid = bidModel(top);
      text = `El radar prioriza a <strong>${safe(cleanName(top.name))}</strong>: ${signedEuro(top.daily_market_change)} hoy y ${integer(top.displayed_points)} pts.`;
      foot = `Puja orientativa local: ${euro(bid.win)} · techo ${euro(bid.ceiling)}. Contrastar con el informe maestro antes de ejecutar.`;
      confidence = playerMarketScore(top) >= 88 ? 'ALTA' : 'MEDIA';
    } else if (falling[0]) {
      text = `Vigilaría a <strong>${safe(cleanName(falling[0].name))}</strong>: es el peor momentum diario de tu plantilla.`;
      foot = 'No implica venta automática: puntos, rol y contexto deportivo pueden justificar mantener.';
      confidence = 'MEDIA';
    }

    $('#nowAction').innerHTML = text;
    $('#decisionFoot').textContent = foot;
    $('#decisionConfidence').textContent = confidence;

    const heroTop = [...getMyTeam()].sort((a, b) => (num(b.daily_market_change) || 0) - (num(a.daily_market_change) || 0))[0];
    $('#heroCopy').textContent = heroTop
      ? `Snapshot ${dateTime(state.data?.captured_at)} · ${cleanName(heroTop.name)} lidera tu subida con ${signedEuro(heroTop.daily_market_change)} hoy.`
      : `Snapshot ${dateTime(state.data?.captured_at)}.`;
  }

  function getSeriesPoints() {
    const points = Array.isArray(state.series?.points) ? state.series.points : [];
    return points.filter(p => p && p.captured_at).sort((a, b) => (toDate(a.captured_at)?.getTime() || 0) - (toDate(b.captured_at)?.getTime() || 0));
  }

  function seriesMetricValue(point, metric) {
    if (metric === 'points') return num(point.points);
    if (metric === 'balance') return num(point.balance);
    return num(point.wealth) ?? ((num(point.balance) || 0) + (num(point.team_value) || 0));
  }

  function renderTrendChart() {
    const svg = $('#trendChart');
    const all = getSeriesPoints();
    const points = all.slice(-90).filter(p => seriesMetricValue(p, state.trendMetric) != null);
    const empty = $('#trendEmpty');
    if (points.length < 2) {
      svg.innerHTML = '';
      empty.classList.remove('hidden');
      $('#trendMeta').innerHTML = `<span><strong>${points.length}</strong> snapshots históricos disponibles</span>`;
      return;
    }
    empty.classList.add('hidden');

    const W = 800, H = 280, L = 46, R = 14, T = 18, B = 32;
    const values = points.map(p => seriesMetricValue(p, state.trendMetric));
    let min = Math.min(...values), max = Math.max(...values);
    if (min === max) { min -= 1; max += 1; }
    const padding = (max - min) * .12;
    min -= padding; max += padding;
    const x = i => L + (i / Math.max(points.length - 1, 1)) * (W - L - R);
    const y = v => T + (1 - (v - min) / (max - min)) * (H - T - B);
    const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
    const area = `${line} L${x(points.length - 1)},${H - B} L${x(0)},${H - B} Z`;

    const grid = [0, .25, .5, .75, 1].map(r => {
      const yy = T + r * (H - T - B);
      const val = max - r * (max - min);
      const label = state.trendMetric === 'points' ? Math.round(val) : compactEuro(val);
      return `<line class="chart-grid-line" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text x="0" y="${yy + 3}">${safe(label)}</text>`;
    }).join('');

    const tickIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];
    const ticks = tickIndexes.map(i => `<text x="${x(i)}" y="${H - 7}" text-anchor="${i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}">${shortDate(points[i].captured_at)}</text>`).join('');
    const dots = points.filter((_, i) => i === 0 || i === points.length - 1 || i % Math.max(1, Math.floor(points.length / 12)) === 0)
      .map(p => {
        const i = points.indexOf(p);
        return `<circle class="chart-dot" cx="${x(i)}" cy="${y(seriesMetricValue(p, state.trendMetric))}" r="3.2"><title>${safe(dateTime(p.captured_at))}: ${safe(state.trendMetric === 'points' ? integer(seriesMetricValue(p, state.trendMetric)) : euro(seriesMetricValue(p, state.trendMetric)))}</title></circle>`;
      }).join('');

    svg.innerHTML = `
      <defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#61f58a"/><stop offset="100%" stop-color="#61f58a" stop-opacity="0"/></linearGradient></defs>
      ${grid}<path class="chart-area" d="${area}"/><path class="chart-line" d="${line}"/>${dots}${ticks}
    `;

    const first = values[0], last = values[values.length - 1];
    const delta = last - first;
    $('#trendMeta').innerHTML = `
      <span><strong>${points.length}</strong> snapshots</span>
      <span>Desde <strong>${shortDate(points[0].captured_at)}</strong></span>
      <span>Cambio <strong class="${tone(delta)}">${state.trendMetric === 'points' ? `${delta > 0 ? '+' : ''}${integer(delta)}` : signedEuro(delta)}</strong></span>
      <span>Último <strong>${state.trendMetric === 'points' ? integer(last) : compactEuro(last)}</strong></span>
    `;
  }

  function renderMomentum() {
    const team = getMyTeam();
    const daily = team.reduce((s, p) => s + (num(p.daily_market_change) || 0), 0);
    const weekly = team.reduce((s, p) => s + (num(p.weekly_market_change) || 0), 0);
    const rising = team.filter(p => (num(p.daily_market_change) || 0) > 0).length;
    const avgPoints = team.length ? team.reduce((s, p) => s + (num(p.displayed_points) || 0), 0) / team.length : 0;
    const dailyRoi = teamValue() ? daily / teamValue() * 100 : 0;
    const score = Math.round(clamp(45 + dailyRoi * 25 + (rising / Math.max(team.length, 1)) * 28 + avgPoints * 1.4, 0, 100));
    $('#teamDailyChip').textContent = signedEuro(daily);
    $('#teamDailyChip').className = `delta-chip ${tone(daily)}`;
    $('#momentumScore').textContent = score;
    $('#momentumOrb').style.setProperty('--score', `${score}%`);
    $('#momentumGrid').innerHTML = [
      ['7 días', signedEuro(weekly)],
      ['En verde', `${rising}/${team.length}`],
      ['Pts/jug.', avgPoints.toLocaleString('es-ES', { maximumFractionDigits: 1 })]
    ].map(([label, value]) => `<div class="momentum-stat"><strong>${safe(value)}</strong><small>${safe(label)}</small></div>`).join('');
  }

  function renderStarCapacity() {
    const cap = capacityModel();
    const offerGain = cap.offers.reduce((s, o) => s + Math.max(0, o.amount - .25 * o.market_value), 0);
    const steps = [
      ['1 · Inmediata', cap.immediate, cap.commitment ? `con ${compactEuro(cap.commitment)} comprometidos` : 'sin cancelar nada', .25],
      ['2 · Cancelando', cap.cancel, cap.commitment ? 'recuperando pujas activas' : 'igual: no hay compromiso', .45],
      ['3 · Ejecutable', cap.executable, cap.offers.length ? `+${compactEuro(offerGain)} netos en ${cap.offers.length} ofertas reales` : 'sin ofertas reales capturadas', .7],
      ['4 · Máx. práctica', cap.potentialMax, `${compactEuro(cap.potentialMin)}–${compactEuro(cap.potentialMax)} · 6 ventas potenciales`, 1]
    ];
    $('#starCapacity').innerHTML = steps.map(([label, value, sub, level]) => `
      <div class="capacity-step" style="--level:${level}">
        <small>${safe(label)}</small>
        <strong>${compactEuro(value)}</strong>
        <span>${safe(sub)}</span>
      </div>
    `).join('');

    const listed = getListedPlayers();
    $('#saleSlotsMini').innerHTML = listed.length
      ? listed.slice(0, 6).map(p => `<span class="sale-token"><strong>${safe(cleanName(p.name))}</strong> · ${compactEuro(p.market_value)}</span>`).join('')
      : cap.candidates.map(p => `<span class="sale-token"><strong>${safe(cleanName(p.name))}</strong> · potencial</span>`).join('');
  }

  function renderMarketRadar() {
    const free = [...getFreeMarket()].sort((a, b) => playerMarketScore(b) - playerMarketScore(a)).slice(0, 5);
    $('#marketRadar').innerHTML = free.length ? free.map((p, i) => `
      <div class="radar-row player-link" data-player-id="${safe(p.player_id)}">
        <div class="row-main"><strong>${i + 1}. ${safe(cleanName(p.name))}</strong><small>${posLabel(p.position)} · ${compactEuro(p.market_value)} · radar ${playerMarketScore(p)}/100</small></div>
        <div class="row-right"><strong class="${tone(p.daily_market_change)}">${signedEuro(p.daily_market_change)}</strong><small>${integer(p.displayed_points)} pts</small></div>
      </div>
    `).join('') : '<div class="empty">No hay libres capturados.</div>';
  }

  function renderLeagueMini() {
    const league = [...getLeague()].sort((a, b) => (num(b.displayed_points) || 0) - (num(a.displayed_points) || 0));
    $('#leagueMini').innerHTML = league.map((u, i) => `
      <div class="mini-rank ${normalizeName(u.name) === 'ale' ? 'me' : ''}">
        <span class="rank-no">${i + 1}</span>
        <strong>${safe(u.name)}</strong>
        <span>${num(u.displayed_points) != null ? `${integer(u.displayed_points)} pts` : '—'}</span>
      </div>
    `).join('');
  }

  function renderRisks() {
    const risks = [];
    if (state.data?.snapshot_finalized !== true) risks.push(['!', 'Snapshot no finalizado', 'No tomar decisiones fuertes con una captura parcial.']);
    const marketStatus = state.data?.market_evolution?.status;
    if (marketStatus && marketStatus !== 'ok') risks.push(['↗', 'Evolución parcial', `market_evolution = ${marketStatus}.`]);
    const scoringStatus = state.data?.scoring_capture?.status;
    if (scoringStatus && scoringStatus !== 'ok') risks.push(['★', 'Scoring parcial', `scoring_capture = ${scoringStatus}.`]);

    const biggestFall = [...getMyTeam()].filter(p => (num(p.daily_market_change) || 0) < 0)
      .sort((a, b) => (num(a.daily_market_change) || 0) - (num(b.daily_market_change) || 0))[0];
    if (biggestFall) risks.push(['↓', cleanName(biggestFall.name), `${signedEuro(biggestFall.daily_market_change)} hoy · vigilar tendencia.`]);

    const cap = capacityModel();
    if (cap.future < 0) risks.push(['€', 'Saldo futuro negativo', `${euro(cap.future)}. Debe volver a ≥ 0 antes de jornada.`]);
    if (!extractRealOffers().length && getListedPlayers().length) risks.push(['◇', 'Liquidez no ejecutable', 'Hay jugadores listados, pero no cuento dinero sin oferta real.']);

    $('#riskCount').textContent = risks.length;
    $('#riskBoard').innerHTML = risks.length ? risks.slice(0, 5).map(([icon, title, sub]) => `
      <div class="risk-row"><div class="risk-icon">${safe(icon)}</div><div class="risk-copy"><strong>${safe(title)}</strong><small>${safe(sub)}</small></div></div>
    `).join('') : '<div class="empty">Sin alertas estructurales detectadas.</div>';
  }

  function renderMarket() {
    let players = [...getFreeMarket()];
    const query = state.marketSearch.trim().toLowerCase();
    if (query) players = players.filter(p => normalizeName(p.name).includes(query));
    if (state.marketPosition !== 'all') players = players.filter(p => String(p.position) === state.marketPosition);
    const sorters = {
      score: (a, b) => playerMarketScore(b) - playerMarketScore(a),
      daily: (a, b) => (num(b.daily_market_change) || 0) - (num(a.daily_market_change) || 0),
      dailyPct: (a, b) => (num(b.daily_market_change_pct) || 0) - (num(a.daily_market_change_pct) || 0),
      weekly: (a, b) => (num(b.weekly_market_change) || 0) - (num(a.weekly_market_change) || 0),
      points: (a, b) => (num(b.displayed_points) || 0) - (num(a.displayed_points) || 0),
      value: (a, b) => (num(b.market_value) || 0) - (num(a.market_value) || 0)
    };
    players.sort(sorters[state.marketSort] || sorters.score);
    $('#marketCount').textContent = `${getFreeMarket().length} libres`;
    $('#marketList').innerHTML = players.length
      ? players.map(p => playerCard(p, 'market')).join('')
      : '<div class="empty">No hay jugadores con estos filtros.</div>';
  }

  function playerCard(player, source = 'market') {
    const score = playerMarketScore(player);
    const bid = source === 'market' ? bidModel(player) : null;
    const pos = mapPosition(player);
    const daily = num(player.daily_market_change);
    const weekly = num(player.weekly_market_change);
    const value = num(player.market_value);
    const cls = source === 'market' ? scoreClass(score) : '';
    const listed = source === 'squad' && getListedPlayers().some(p => String(p.player_id) === String(player.player_id));
    const protectedTag = source === 'squad' && isProtectedPlayer(player);
    return `
      <article class="player-card ${cls}" tabindex="0" data-player-id="${safe(player.player_id || '')}">
        <div class="player-top">
          <span class="position-badge p${pos || 0}">${posLabel(pos)}</span>
          <div class="player-title">
            <strong>${safe(cleanName(player.name))}</strong>
            <small>${source === 'market' ? `Radar ${score}/100` : listed ? 'En venta' : protectedTag ? 'Protegido' : 'Ale'}</small>
          </div>
          <div class="player-value">${compactEuro(value)}</div>
        </div>
        <div class="player-stats">
          <div class="player-stat"><span>Hoy</span><strong class="${tone(daily)}">${signedEuro(daily)}</strong></div>
          <div class="player-stat"><span>7 días</span><strong class="${tone(weekly)}">${signedEuro(weekly)}</strong></div>
          <div class="player-stat"><span>Puntos</span><strong>${integer(player.displayed_points)}</strong></div>
          <div class="player-stat"><span>${source === 'market' ? 'Ganar' : '€/M'}</span><strong>${source === 'market' ? compactEuro(bid?.win) : playerEfficiency(player).toLocaleString('es-ES', { maximumFractionDigits: 1 })}</strong></div>
        </div>
        <div class="player-meter" style="--meter:${source === 'market' ? score : clamp(50 + ((daily || 0) / Math.max(value || 1, 1) * 100) * 8, 5, 100)}%"><span></span></div>
        <div class="player-tags">
          ${daily != null ? `<span class="mini-tag ${daily > 0 ? 'good' : daily < 0 ? 'bad' : ''}">${signedPct(player.daily_market_change_pct)} día</span>` : ''}
          ${weekly != null ? `<span class="mini-tag ${weekly > 0 ? 'good' : weekly < 0 ? 'bad' : ''}">${signedPct(player.weekly_market_change_pct)} semana</span>` : ''}
          ${source === 'market' && score >= 76 ? '<span class="mini-tag good">oportunidad</span>' : ''}
          ${source === 'market' && score < 34 ? '<span class="mini-tag bad">riesgo</span>' : ''}
          ${listed ? '<span class="mini-tag warn">slot venta</span>' : ''}
          ${protectedTag ? '<span class="mini-tag good">protegido</span>' : ''}
        </div>
      </article>
    `;
  }

  function renderTeam() {
    let team = [...getMyTeam()];
    const sorters = {
      daily: (a, b) => (num(b.daily_market_change) || 0) - (num(a.daily_market_change) || 0),
      weekly: (a, b) => (num(b.weekly_market_change) || 0) - (num(a.weekly_market_change) || 0),
      points: (a, b) => (num(b.displayed_points) || 0) - (num(a.displayed_points) || 0),
      value: (a, b) => (num(b.market_value) || 0) - (num(a.market_value) || 0),
      efficiency: (a, b) => playerEfficiency(b) - playerEfficiency(a)
    };
    team.sort(sorters[state.teamSort] || sorters.daily);
    const value = teamValue();
    const daily = team.reduce((s, p) => s + (num(p.daily_market_change) || 0), 0);
    const weekly = team.reduce((s, p) => s + (num(p.weekly_market_change) || 0), 0);
    const points = team.reduce((s, p) => s + (num(p.displayed_points) || 0), 0);
    $('#teamCount').textContent = `${team.length} jugadores`;
    $('#teamSummary').innerHTML = [
      ['Valor', compactEuro(value), ''],
      ['Hoy', signedEuro(daily), tone(daily)],
      ['Semana', signedEuro(weekly), tone(weekly)],
      ['Pts visibles', integer(points), ''],
      ['Slots venta', `${getListedPlayers().length}/6`, '']
    ].map(([label, valueText, cls]) => `<article class="summary-tile"><small>${safe(label)}</small><strong class="${cls}">${safe(valueText)}</strong></article>`).join('');
    $('#teamList').innerHTML = team.length ? team.map(p => playerCard(p, 'squad')).join('') : '<div class="empty">No se ha capturado la plantilla.</div>';
    renderSquadBubble();
    renderSaleCandidates();
  }

  function renderSquadBubble() {
    const svg = $('#squadBubbleChart');
    const team = getMyTeam().filter(p => num(p.market_value) != null);
    if (!team.length) { svg.innerHTML = ''; return; }
    const W = 800, H = 360, L = 44, R = 18, T = 20, B = 34;
    const xValues = team.map(p => num(p.market_value) || 0);
    const yValues = team.map(p => num(p.displayed_points) || 0);
    const maxX = Math.max(...xValues, 1) * 1.08;
    const maxY = Math.max(...yValues, 1) * 1.12;
    const x = v => L + (v / maxX) * (W - L - R);
    const y = v => T + (1 - v / maxY) * (H - T - B);
    const circles = team.map(p => {
      const value = num(p.market_value) || 0;
      const points = num(p.displayed_points) || 0;
      const daily = num(p.daily_market_change) || 0;
      const radius = clamp(7 + Math.sqrt(Math.max(Math.abs(daily), 1)) / 55, 8, 22);
      return `<circle class="bubble player-link" data-player-id="${safe(p.player_id)}" cx="${x(value)}" cy="${y(points)}" r="${radius}"><title>${safe(cleanName(p.name))}: ${compactEuro(value)} · ${integer(points)} pts · ${signedEuro(daily)} hoy</title></circle>`;
    }).join('');
    svg.innerHTML = `
      <line class="axis" x1="${L}" x2="${W-R}" y1="${H-B}" y2="${H-B}"/>
      <line class="axis" x1="${L}" x2="${L}" y1="${T}" y2="${H-B}"/>
      <text x="${W-R}" y="${H-8}" text-anchor="end">Valor de mercado →</text>
      <text x="6" y="${T+8}">Puntos ↑</text>
      ${circles}
    `;
  }

  function renderSaleCandidates() {
    const listed = getListedPlayers();
    const suggested = suggestedSaleCandidates();
    $('#saleSlotCount').textContent = `${listed.length}/6`;
    const rows = (listed.length ? listed : suggested).slice(0, 6);
    $('#saleCandidates').innerHTML = rows.length ? rows.map((p, i) => {
      const offer = extractRealOffers().find(o => String(o.player_id) === String(p.player_id));
      const net = offer ? offer.amount - .25 * (num(p.market_value) || 0) : .70 * (num(p.market_value) || 0);
      return `
        <div class="simple-row player-link" data-player-id="${safe(p.player_id)}">
          <div class="row-main">
            <strong>${i + 1}. ${safe(cleanName(p.name))}${isProtectedPlayer(p) ? ' · 🔒' : ''}</strong>
            <small>${listed.length ? 'listado' : 'candidato'} · sacrifica ${signedEuro(p.daily_market_change)}/día</small>
          </div>
          <div class="row-right"><strong>${compactEuro(net)}</strong><small>${offer ? 'neto ejecutable' : 'neto potencial 95%'}</small></div>
        </div>
      `;
    }).join('') : '<div class="empty">No hay candidatos disponibles.</div>';
  }

  function renderRivals() {
    const models = getLeague()
      .map(managerModel)
      .sort((a, b) => b.points - a.points);
    $('#leagueList').innerHTML = models.map((m, i) => `
      <article class="manager-card ${normalizeName(m.user.name) === 'ale' ? 'me' : ''}">
        <div class="manager-head">
          <div class="manager-rank">${i + 1}</div>
          <div class="manager-name"><strong>${safe(m.user.name)}</strong><small>${m.players != null ? `${m.players} jugadores` : 'plantilla capturada'} · amenaza ${Math.round(m.threat)}/100</small></div>
          <div class="manager-points"><strong>${integer(m.points)}</strong><small>PTS</small></div>
        </div>
        <div class="manager-stats">
          <div class="manager-stat"><span>Plantilla</span><strong>${compactEuro(m.teamVal)}</strong></div>
          <div class="manager-stat"><span>Saldo</span><strong>${m.saldo == null ? '—' : compactEuro(m.saldo)}</strong></div>
          <div class="manager-stat"><span>Capacidad</span><strong>${m.capacity == null ? '—' : compactEuro(m.capacity)}</strong></div>
          <div class="manager-stat"><span>Patrimonio</span><strong>${compactEuro(m.wealth)}</strong></div>
        </div>
        <div class="threat-meter" style="--threat:${m.threat}%"><span></span></div>
      </article>
    `).join('');
    renderRivalBars();
  }

  function renderRivalBars() {
    const models = getLeague().map(managerModel);
    const metric = state.rivalMetric;
    const values = models.map(m => metric === 'capacity' ? m.capacity : metric === 'wealth' ? m.wealth : m.points)
      .filter(v => v != null);
    const max = Math.max(...values, 1);
    const sorted = [...models].sort((a, b) => {
      const av = metric === 'capacity' ? a.capacity : metric === 'wealth' ? a.wealth : a.points;
      const bv = metric === 'capacity' ? b.capacity : metric === 'wealth' ? b.wealth : b.points;
      return (bv || 0) - (av || 0);
    });
    $('#rivalBars').innerHTML = sorted.map(m => {
      const value = metric === 'capacity' ? m.capacity : metric === 'wealth' ? m.wealth : m.points;
      const label = metric === 'points' ? integer(value) : compactEuro(value);
      return `
        <div class="bar-row ${normalizeName(m.user.name) === 'ale' ? 'me' : ''}">
          <div class="bar-label">${safe(m.user.name)}</div>
          <div class="bar-track"><div class="bar-fill" style="--bar:${value == null ? 0 : clamp(value / max * 100, 0, 100)}%"></div></div>
          <div class="bar-value">${label}</div>
        </div>
      `;
    }).join('');
  }

  function renderGameweeks() {
    const closures = [...getGameweekClosures()].sort((a, b) => (num(b.gameweek) || 0) - (num(a.gameweek) || 0));
    $('#gameweekCount').textContent = `${closures.length} cierres`;
    $('#gameweekList').innerHTML = closures.length ? closures.map(c => {
      const payments = Array.isArray(c.latest_payments) ? [...c.latest_payments].sort((a, b) => (num(a.rank) || 99) - (num(b.rank) || 99)) : [];
      return `
        <article class="gameweek-card">
          <div class="gameweek-head">
            <h3>Jornada ${safe(c.gameweek ?? c.key ?? '—')}</h3>
            <span>${c.reopened_or_reclosed ? 'reabierta/recalculada · ' : ''}${safe(dateTime(c.latest_created))}</span>
          </div>
          ${payments.map(p => `
            <div class="gameweek-standing ${normalizeName(p.manager) === 'ale' ? 'me' : ''}">
              <strong>${integer(p.rank)}</strong>
              <span>${safe(p.manager || '—')}</span>
              <small>${integer(p.lined_up_players)}/${integer(p.scored_lined_up_players)} al./punt.</small>
              <strong>${integer(p.points)} pts</strong>
            </div>
          `).join('')}
        </article>
      `;
    }).join('') : '<div class="empty">No he localizado cierres de jornadas.</div>';

    const mine = closures.flatMap(c => (c.latest_payments || []).filter(p => normalizeName(p.manager) === 'ale').map(p => ({ ...p, gameweek: c.gameweek })));
    $('#myForm').innerHTML = mine.length ? mine.slice(0, 6).map(p => `
      <div class="form-chip"><strong>${integer(p.points)}</strong><span>J${safe(p.gameweek)} · ${integer(p.rank)}º</span></div>
    `).join('') : '<div class="empty">Sin cierres propios.</div>';
    renderPointsRace();
  }

  function renderPointsRace() {
    const league = [...getLeague()].sort((a, b) => (num(b.displayed_points) || 0) - (num(a.displayed_points) || 0));
    const max = Math.max(...league.map(u => num(u.displayed_points) || 0), 1);
    $('#pointsRace').innerHTML = league.map(u => `
      <div class="bar-row ${normalizeName(u.name) === 'ale' ? 'me' : ''}">
        <div class="bar-label">${safe(u.name)}</div>
        <div class="bar-track"><div class="bar-fill" style="--bar:${(num(u.displayed_points) || 0) / max * 100}%"></div></div>
        <div class="bar-value">${integer(u.displayed_points)} pts</div>
      </div>
    `).join('');
  }

  function filterTransfers() {
    const all = [...getTransfers()].sort((a, b) => (toDate(b.created)?.getTime() || 0) - (toDate(a.created)?.getTime() || 0));
    if (state.movementFilter === 'ale') return all.filter(t => normalizeName(t.from) === 'ale' || normalizeName(t.to) === 'ale' || (t.other_bids || []).some(b => normalizeName(b.name) === 'ale'));
    if (state.movementFilter === 'bids') return all.filter(t => Array.isArray(t.other_bids) && t.other_bids.length);
    if (state.movementFilter === 'sales') return all.filter(t => normalizeName(t.to) === 'mister' && normalizeName(t.from) !== 'mister');
    if (state.movementFilter === 'buys') return all.filter(t => normalizeName(t.from) === 'mister' && normalizeName(t.to) !== 'mister');
    return all;
  }

  function transferPlayerLabel(t) {
    if (t.player) return cleanName(t.player);
    const candidates = t.player_resolution?.candidate_players;
    if (Array.isArray(candidates) && candidates.length === 1) return cleanName(candidates[0]);
    if (Array.isArray(candidates) && candidates.length > 1) return `Jugador no resuelto (${candidates.length} candidatos)`;
    return 'Jugador no resuelto';
  }

  function renderTransfers() {
    const transfers = filterTransfers();
    $('#movementCount').textContent = `${getTransfers().length} registros`;
    $('#movementList').innerHTML = transfers.length ? transfers.slice(0, 100).map(t => {
      const bids = Array.isArray(t.other_bids) ? t.other_bids : [];
      return `
        <div class="timeline-row">
          <div class="timeline-dot"></div>
          <div class="timeline-copy">
            <strong>${safe(transferPlayerLabel(t))}</strong>
            <small>${safe(t.from || '—')} → ${safe(t.to || '—')} · ${safe(dateTime(t.created))}</small>
            ${bids.length ? `<div class="bid-pills">${bids.map(b => `<span class="bid-pill">${safe(b.name)} ${compactEuro(b.bid)}</span>`).join('')}</div>` : ''}
          </div>
          <div class="timeline-price">${compactEuro(t.price)}</div>
        </div>
      `;
    }).join('') : '<div class="empty">No hay movimientos con este filtro.</div>';
    renderBidRivals();
    renderLiveOps();
  }

  function renderBidRivals() {
    const map = new Map();
    const touch = name => {
      if (!name || normalizeName(name) === 'ale' || normalizeName(name) === 'mister') return null;
      const key = cleanName(name);
      if (!map.has(key)) map.set(key, { name: key, battles: 0, beatAle: 0, lostToAle: 0, totalBid: 0, bids: 0 });
      return map.get(key);
    };
    for (const t of getTransfers()) {
      const other = Array.isArray(t.other_bids) ? t.other_bids : [];
      const aleBid = other.find(b => normalizeName(b.name) === 'ale');
      if (normalizeName(t.to) === 'ale') {
        for (const b of other) {
          const row = touch(b.name);
          if (!row) continue;
          row.battles += 1;
          row.lostToAle += 1;
          row.totalBid += num(b.bid) || 0;
          row.bids += 1;
        }
      } else if (aleBid && normalizeName(t.from) === 'mister') {
        const winner = touch(t.to);
        if (winner) {
          winner.battles += 1;
          winner.beatAle += 1;
        }
      }
    }
    const rows = [...map.values()].sort((a, b) => b.battles - a.battles || b.beatAle - a.beatAle);
    $('#bidRivals').innerHTML = rows.length ? rows.slice(0, 6).map(r => `
      <div class="simple-row">
        <div class="row-main"><strong>${safe(r.name)}</strong><small>${r.beatAle} te ganó · ${r.lostToAle} perdió contigo</small></div>
        <div class="row-right"><strong>${r.battles}</strong><small>duelos</small></div>
      </div>
    `).join('') : '<div class="empty">Aún no hay other_bids suficientes.</div>';
  }

  function prettyInline(value) {
    if (value == null) return 'Sin dato';
    if (['string', 'number', 'boolean'].includes(typeof value)) return String(value);
    if (Array.isArray(value)) return `${value.length} registros`;
    const entries = Object.entries(value).filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v)).slice(0, 4);
    return entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join(' · ') : 'Datos capturados';
  }

  function renderLiveOps() {
    const sections = getLiveSections();
    $('#liveMarketOps').innerHTML = sections.length ? sections.slice(0, 10).map(([key, value]) => `
      <div class="simple-row">
        <div class="row-main"><strong>${safe(key.replaceAll('_', ' '))}</strong><small>${safe(prettyInline(value))}</small></div>
        <div class="row-right"><strong>${Array.isArray(value) ? value.length : '✓'}</strong><small>items</small></div>
      </div>
    `).join('') : '<div class="empty">Sin sección activa de pujas/ofertas.</div>';
  }

  function renderClauses() {
    const rows = getClauseSnapshots();
    const totalInvestment = rows.reduce((s, r) => s + (num(r.active_clause_balance_investment) || 0), 0);
    const raised = rows.reduce((s, r) => s + (num(r.raised_clause_players_detected) || 0), 0);
    const exact = rows.every(r => r.active_clause_balance_investment_exact !== false);
    const changes = Array.isArray(state.data?.clause_changes_since_previous) ? state.data.clause_changes_since_previous : [];
    $('#clauseStatus').textContent = exact ? 'captura exacta' : 'captura parcial';
    $('#clauseSummary').innerHTML = [
      ['Managers', rows.length],
      ['Invertido activo', compactEuro(totalInvestment)],
      ['Cláusulas subidas', integer(raised)],
      ['Cambios snapshot', integer(changes.length)],
      ['Integridad', exact ? 'OK' : 'Revisar']
    ].map(([label, value]) => `<article class="summary-tile"><small>${safe(label)}</small><strong>${safe(value)}</strong></article>`).join('');

    $('#clauseList').innerHTML = rows.length ? rows.map(r => {
      const clauses = (r.clauses || []).filter(c => (num(c.clause_level) || 0) > 0 || (num(c.active_balance_investment) || 0) > 0);
      return `
        <article class="manager-card ${normalizeName(r.name) === 'ale' ? 'me' : ''}">
          <div class="clause-manager-top">
            <div class="manager-name"><strong>${safe(r.name)}</strong><small>${integer(r.clause_players_detected)} jugadores · ${integer(r.raised_clause_players_detected)} elevados</small></div>
            <strong>${compactEuro(r.active_clause_balance_investment)}</strong>
          </div>
          ${clauses.length ? clauses.map(c => `
            <div class="clause-player player-link" data-player-id="${safe(c.player_id)}">
              <div><strong>${safe(cleanName(c.name))}</strong><small>VM ${compactEuro(c.market_value)} · inversión ${compactEuro(c.active_balance_investment)}</small></div>
              <div class="clause-value"><strong class="clause-level">${integer(c.clause_percent)}%</strong><small>${compactEuro(c.clause_value)}</small></div>
            </div>
          `).join('') : '<div class="empty">Sin inversión activa en cláusulas.</div>'}
        </article>
      `;
    }).join('') : '<div class="empty">No se ha localizado member_clause_snapshots.</div>';
  }

  function statusText(value) {
    if (value === true) return 'OK';
    if (value === false) return 'No';
    if (value == null || value === '') return 'Sin dato';
    return String(value).replaceAll('_', ' ');
  }

  function renderDataHealth() {
    const market = state.data?.market_evolution;
    const scoring = state.data?.scoring_capture;
    const clauses = getClauseSnapshots();
    const finalized = state.data?.snapshot_finalized;
    const balances = getBalances();
    const items = [
      ['Snapshot', finalized === true ? 'Finalizado' : finalized === false ? 'Parcial' : 'Sin estado', finalized === true ? 'ok' : 'warn'],
      ['Mercado', statusText(market?.status ?? (getFreeMarket().length ? 'capturado' : null)), market?.status === 'ok' ? 'ok' : 'warn'],
      ['Scoring', statusText(scoring?.status ?? (getLeague().length ? 'capturado' : null)), scoring?.status === 'ok' ? 'ok' : 'warn'],
      ['Rivales', `${balances.length}/7 saldos`, balances.length >= 7 ? 'ok' : 'warn'],
      ['Cláusulas', `${clauses.length}/7 managers`, clauses.length >= 7 ? 'ok' : 'warn'],
      ['Histórico web', `${getSeriesPoints().length} snapshots`, getSeriesPoints().length > 1 ? 'ok' : 'warn'],
      ['Mercado libre', `${getFreeMarket().length} jugadores`, getFreeMarket().length ? 'ok' : 'warn'],
      ['Plantilla', `${getMyTeam().length} jugadores`, getMyTeam().length ? 'ok' : 'warn']
    ];
    $('#healthGrid').innerHTML = items.map(([label, value, cls]) => `
      <article class="health-item ${cls}"><span>${safe(label)}</span><strong>${safe(value)}</strong></article>
    `).join('');
    $('#finalizedBadge').textContent = finalized === true ? 'Finalizado ✓' : finalized === false ? 'No finalizado' : 'Estado desconocido';

    const scoreSections = Object.entries(state.data || {}).filter(([k]) => /scoring|gameweek_payment/i.test(k));
    $('#scoringList').innerHTML = scoreSections.length ? scoreSections.map(([k, v]) => `
      <div class="simple-row"><div class="row-main"><strong>${safe(k.replaceAll('_', ' '))}</strong><small>${safe(prettyInline(v))}</small></div><div class="row-right"><strong>${Array.isArray(v) ? v.length : '✓'}</strong><small>capturado</small></div></div>
    `).join('') : '<div class="empty">Sin secciones explícitas de scoring.</div>';

    const keys = Object.keys(state.data || {});
    $('#schemaList').innerHTML = keys.slice(0, 22).map(k => {
      const v = state.data[k];
      return `<div class="simple-row"><div class="row-main"><strong>${safe(k)}</strong><small>${Array.isArray(v) ? 'array' : typeof v}</small></div><div class="row-right"><strong>${Array.isArray(v) ? v.length : '•'}</strong><small>${Array.isArray(v) ? 'items' : ''}</small></div></div>`;
    }).join('');

    $('#diagnostics').textContent = JSON.stringify({
      captured_at: state.data?.captured_at,
      source: state.data?.source,
      snapshot_finalized: state.data?.snapshot_finalized,
      market_evolution: state.data?.market_evolution,
      scoring_capture: state.data?.scoring_capture,
      players: { market: getMarket().length, free: getFreeMarket().length, squad: getMyTeam().length },
      league_users: getLeague().length,
      estimated_balances: getBalances().length,
      transfers: getTransfers().length,
      clause_snapshots: clauses.length,
      dashboard_history: getSeriesPoints().length
    }, null, 2);
  }

  function openPlayerDrawer(playerId) {
    const player = state.playerIndex.get(String(playerId));
    if (!player) return;
    const teamPlayer = getMyTeam().find(p => String(p.player_id) === String(playerId));
    const marketPlayer = getMarket().find(p => String(p.player_id) === String(playerId));
    const basePlayer = { ...player, ...(marketPlayer || {}), ...(teamPlayer || {}) };
    const clause = getClauseSnapshots().flatMap(r => r.clauses || []).find(p => String(p.player_id) === String(playerId));
    const holding = getManagerAudits().flatMap(r => (r.current_holdings || []).map(p => ({ ...p, manager: r.name }))).find(p => String(p.player_id) === String(playerId));
    const bid = String(marketPlayer?.owner_id) === '0' ? bidModel(basePlayer) : null;
    const protectedPlayer = isProtectedPlayer(basePlayer);
    $('#drawerContent').innerHTML = `
      <div class="drawer-hero">
        <span class="position-badge p${mapPosition(basePlayer) || 0}">${posLabel(mapPosition(basePlayer))}</span>
        <h2>${safe(cleanName(basePlayer.name))}</h2>
        <p>${safe(marketPlayer?.owner_name || holding?.manager || (teamPlayer ? 'Ale' : ''))}</p>
      </div>
      <div class="drawer-kpis">
        <div class="drawer-kpi"><span>Valor</span><strong>${compactEuro(basePlayer.market_value)}</strong></div>
        <div class="drawer-kpi"><span>Puntos</span><strong>${integer(basePlayer.displayed_points)}</strong></div>
        <div class="drawer-kpi"><span>Hoy</span><strong class="${tone(basePlayer.daily_market_change)}">${signedEuro(basePlayer.daily_market_change)}</strong></div>
        <div class="drawer-kpi"><span>Semana</span><strong class="${tone(basePlayer.weekly_market_change)}">${signedEuro(basePlayer.weekly_market_change)}</strong></div>
      </div>
      ${bid ? `<div class="drawer-section"><h3>Estimador local de puja</h3><div class="drawer-kpis"><div class="drawer-kpi"><span>Valor</span><strong>${compactEuro(bid.value)}</strong></div><div class="drawer-kpi"><span>Para ganar</span><strong>${compactEuro(bid.win)}</strong></div><div class="drawer-kpi"><span>Techo</span><strong>${compactEuro(bid.ceiling)}</strong></div><div class="drawer-kpi"><span>Radar</span><strong>${bid.modelScore}/100</strong></div></div><p>Orientativo: usa evolución y competencia histórica agregada. El informe automático incorpora además contexto deportivo y expertos Fantasy.</p></div>` : ''}
      ${holding ? `<div class="drawer-section"><h3>Adquisición</h3><p>Coste: <strong>${compactEuro(holding.acquisition_cost)}</strong> · Fecha: ${safe(dateTime(holding.acquired_at))}${num(basePlayer.market_value) != null && num(holding.acquisition_cost) != null ? ` · Plusvalía latente: <strong class="${tone(num(basePlayer.market_value)-num(holding.acquisition_cost))}">${signedEuro(num(basePlayer.market_value)-num(holding.acquisition_cost))}</strong>` : ''}.</p></div>` : ''}
      ${clause ? `<div class="drawer-section"><h3>Cláusula</h3><p>${integer(clause.clause_percent)}% · valor ${compactEuro(clause.clause_value)} · inversión activa ${compactEuro(clause.active_balance_investment)}.</p></div>` : ''}
      ${protectedPlayer ? '<div class="drawer-section"><h3>Regla crítica</h3><p>Jugador protegido por las reglas maestras del tracker. No debe tratarse como liquidez normal.</p></div>' : ''}
      <div class="drawer-section"><h3>Lectura</h3><p>Variación diaria ${signedPct(basePlayer.daily_market_change_pct)} y semanal ${signedPct(basePlayer.weekly_market_change_pct)}. ${num(basePlayer.displayed_points) != null ? `Puntuación visible: ${integer(basePlayer.displayed_points)}.` : 'Sin puntos fiables visibles.'}</p></div>
    `;
    $('#playerDrawer').classList.add('open');
    $('#playerDrawer').setAttribute('aria-hidden', 'false');
    $('#playerDrawerOverlay').classList.remove('hidden');
  }

  function closePlayerDrawer() {
    $('#playerDrawer').classList.remove('open');
    $('#playerDrawer').setAttribute('aria-hidden', 'true');
    $('#playerDrawerOverlay').classList.add('hidden');
  }

  function buildCommandItems() {
    const sections = Object.entries(VIEW_META).map(([view, [, label]]) => ({
      type: 'section', id: view, label, sub: 'Ir a sección', icon: '⌁'
    }));
    const players = [...state.playerIndex.values()].map(p => ({
      type: 'player', id: String(p.player_id), label: cleanName(p.name), sub: `${posLabel(mapPosition(p))} · ${compactEuro(p.market_value)} · ${integer(p.displayed_points)} pts`, icon: posLabel(mapPosition(p))
    }));
    const managers = getLeague().map(u => ({
      type: 'manager', id: String(u.user_id), label: u.name, sub: `${integer(u.displayed_points)} pts · ${compactEuro(u.displayed_euro_value)}`, icon: '♟'
    }));
    state.commandItems = [...sections, ...players, ...managers];
  }

  function renderCommandResults(query = '') {
    const q = query.trim().toLowerCase();
    let items = state.commandItems;
    if (q && q !== '@') {
      items = items.filter(item => `${item.label} ${item.sub}`.toLowerCase().includes(q));
    } else if (q === '@') {
      items = items.filter(item => item.type === 'section');
    }
    $('#commandResults').innerHTML = items.slice(0, 30).map(item => `
      <button class="command-result" data-command-type="${item.type}" data-command-id="${safe(item.id)}">
        <span class="command-result-icon">${safe(item.icon)}</span>
        <span class="command-result-copy"><strong>${safe(item.label)}</strong><small>${safe(item.sub)}</small></span>
        <span>↵</span>
      </button>
    `).join('') || '<div class="empty">Sin resultados.</div>';
  }

  function openCommand(sectionsOnly = false) {
    $('#commandOverlay').classList.remove('hidden');
    const input = $('#globalSearch');
    input.value = sectionsOnly ? '@' : '';
    renderCommandResults(input.value);
    requestAnimationFrame(() => input.focus());
  }

  function closeCommand() {
    $('#commandOverlay').classList.add('hidden');
  }

  function renderAll() {
    state.allObjects = walkObjects(state.data, []);
    buildPlayerIndex();
    buildCommandItems();
    renderHeader();
    renderOverviewKpis();
    renderDecision();
    renderTrendChart();
    renderMomentum();
    renderStarCapacity();
    renderMarketRadar();
    renderLeagueMini();
    renderRisks();
    renderMarket();
    renderTeam();
    renderRivals();
    renderGameweeks();
    renderTransfers();
    renderClauses();
    renderDataHealth();
    renderCommandResults('');
    bindDynamicPlayerLinks();
  }

  function bindDynamicPlayerLinks() {
    $$('[data-player-id]').forEach(el => {
      if (el.dataset.boundPlayer === '1') return;
      el.dataset.boundPlayer = '1';
      el.addEventListener('click', () => openPlayerDrawer(el.dataset.playerId));
      el.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPlayerDrawer(el.dataset.playerId);
        }
      });
    });
  }

  function showView(view, pushHash = true) {
    if (!VIEW_META[view]) return;
    state.view = view;
    $$('.view').forEach(v => v.classList.toggle('active', v.dataset.view === view));
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.target === view));
    const meta = VIEW_META[view];
    $('#viewEyebrow').textContent = meta[0];
    $('#viewTitle').textContent = meta[1];
    if (pushHash) history.replaceState(null, '', `#${view}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function load() {
    $('#errorBox').classList.add('hidden');
    $('#refreshButton').disabled = true;
    $('#refreshButton').innerHTML = '<span>↻</span><b>Cargando</b>';
    try {
      const [data, historyData, seriesData] = await Promise.all([
        fetchFirstJson(['./data/latest.json', '../data/latest.json', 'data/latest.json']),
        fetchFirstJson(['./data/history.json', '../data/history.json', 'data/history.json'], true),
        fetchFirstJson(['./data/series.json', '../data/series.json', 'data/series.json'], true)
      ]);
      state.data = data;
      state.history = historyData;
      state.series = seriesData;
      renderAll();
    } catch (error) {
      $('#errorBox').classList.remove('hidden');
      $('#errorBox').textContent = `No pude cargar data/latest.json. Abre el build HTTP del dashboard. Detalle: ${error.message}`;
      $('#heroCopy').textContent = 'La interfaz está lista, pero el snapshot no se ha podido leer.';
    } finally {
      $('#refreshButton').disabled = false;
      $('#refreshButton').innerHTML = '<span>↻</span><b>Actualizar</b>';
    }
  }

  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => {
    if (btn.classList.contains('more-nav')) {
      openCommand(true);
      return;
    }
    showView(btn.dataset.target);
  }));

  $$('[data-jump]').forEach(btn => btn.addEventListener('click', event => {
    event.preventDefault();
    showView(btn.dataset.jump);
  }));

  $('#refreshButton').addEventListener('click', load);
  $('#commandTrigger').addEventListener('click', () => openCommand(false));
  $('#commandOverlay').addEventListener('click', event => {
    if (event.target === $('#commandOverlay')) closeCommand();
  });
  $('#globalSearch').addEventListener('input', event => renderCommandResults(event.target.value));
  $('#commandResults').addEventListener('click', event => {
    const button = event.target.closest('.command-result');
    if (!button) return;
    closeCommand();
    if (button.dataset.commandType === 'section') showView(button.dataset.commandId);
    if (button.dataset.commandType === 'player') openPlayerDrawer(button.dataset.commandId);
    if (button.dataset.commandType === 'manager') showView('rivals');
  });

  $('#drawerClose').addEventListener('click', closePlayerDrawer);
  $('#playerDrawerOverlay').addEventListener('click', closePlayerDrawer);

  $('#marketSearch').addEventListener('input', event => {
    state.marketSearch = event.target.value;
    renderMarket();
    bindDynamicPlayerLinks();
  });

  $('#marketSort').addEventListener('change', event => {
    state.marketSort = event.target.value;
    renderMarket();
    bindDynamicPlayerLinks();
  });

  $$('#positionFilters .filter').forEach(btn => btn.addEventListener('click', () => {
    $$('#positionFilters .filter').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    state.marketPosition = btn.dataset.position;
    renderMarket();
    bindDynamicPlayerLinks();
  }));

  $('#teamSort').addEventListener('change', event => {
    state.teamSort = event.target.value;
    renderTeam();
    bindDynamicPlayerLinks();
  });

  $$('#movementFilters .filter').forEach(btn => btn.addEventListener('click', () => {
    $$('#movementFilters .filter').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    state.movementFilter = btn.dataset.movement;
    renderTransfers();
  }));

  $$('#trendMetric button').forEach(btn => btn.addEventListener('click', () => {
    $$('#trendMetric button').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    state.trendMetric = btn.dataset.metric;
    renderTrendChart();
  }));

  $$('#rivalMetric button').forEach(btn => btn.addEventListener('click', () => {
    $$('#rivalMetric button').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    state.rivalMetric = btn.dataset.metric;
    renderRivalBars();
  }));

  document.addEventListener('keydown', event => {
    const metaK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
    if (metaK) {
      event.preventDefault();
      openCommand(false);
    }
    if (event.key === 'Escape') {
      closeCommand();
      closePlayerDrawer();
    }
  });

  const initial = location.hash.replace('#', '');
  if (VIEW_META[initial]) showView(initial, false);
  load();

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
