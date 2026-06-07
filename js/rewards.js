/* ============================================================
   Storym — Recompensa diaria EN RACHA (anti-abuso, server-side)

   • Racha de 7 días: Día 1..7 con importes crecientes.
   • Si faltas un día, la racha vuelve al Día 1. Tras el Día 7,
     el siguiente día consecutivo reinicia en el Día 1.
   • El reclamo SIEMPRE pasa por la RPC claim_daily_reward():
     el servidor decide el importe, valida "una vez al día" y
     guarda la racha. Editar localStorage NO sirve para abusar.
   • Es una ventaja VIP (el servidor también exige VIP activo).

   Importes Día 1..7: 10, 12, 15, 28, 20, 30, 40.
   ============================================================ */
(function () {
  // Importes solo para MOSTRAR (la verdad la pone el servidor en la RPC).
  var DAYS = [
    { d: 'Día 1', n: 10 },
    { d: 'Día 2', n: 12 },
    { d: 'Día 3', n: 15 },
    { d: 'Día 4', n: 18 },
    { d: 'Día 5', n: 20 },
    { d: 'Día 6', n: 30 },
    { d: 'Día 7', n: 40 },
  ];

  var ICON = (window.STORYM && window.STORYM.icon) ? window.STORYM.icon : function () { return ''; };

  function isVip() { return (typeof window.isVipUser === 'function') ? window.isVipUser() : false; }
  function onUpsell() { close(); if (window.openVipScreen) window.openVipScreen(); }

  // Estado en memoria (espejo del servidor; NO es la fuente de verdad).
  var _rw = { streak: 0, lastDate: null, loaded: false };

  // Fechas en UTC para casar con el servidor (la RPC usa fecha UTC).
  function utcToday()     { return new Date().toISOString().slice(0, 10); }
  function utcYesterday() { var d = new Date(); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); }

  // Lee racha/última fecha del servidor (RLS: solo la fila propia).
  function refreshState() {
    if (typeof supabaseUser === 'undefined' || !supabaseUser || !window.supaClient) {
      _rw = { streak: 0, lastDate: null, loaded: true };
      return Promise.resolve(_rw);
    }
    return supaClient.from('users').select('reward_streak, last_reward_date').eq('id', supabaseUser.id).single()
      .then(function (res) {
        if (res && res.error) {
          if (window.toast) toast('🎁 read ERR: ' + (res.error.message || '').slice(0, 45));
          _rw.loaded = true; return _rw; // no machacar con vacío si hubo error
        }
        var d = res && res.data ? res.data : {};
        _rw = { streak: d.reward_streak || 0, lastDate: d.last_reward_date || null, loaded: true };
        if (window.toast) toast('🎁 racha d' + _rw.streak + ' · ' + (_rw.lastDate || 'null') + ' · hoy ' + utcToday());
        return _rw;
      })
      .catch(function (e) { if (window.toast) toast('🎁 catch: ' + (e && e.message || '').slice(0, 40)); _rw.loaded = true; return _rw; });
  }

  // Calcula la vista a partir del estado: qué día es hoy en la racha,
  // si ya se reclamó, y cuántos días llevan reclamados.
  function computeView() {
    var today = utcToday(), yest = utcYesterday();
    var s = _rw.streak || 0, lr = _rw.lastDate;
    if (lr === today) {
      return { claimedToday: true, currentDay: s, doneDays: s };
    }
    var day;
    if (lr === yest) { day = (s >= 7) ? 1 : s + 1; }
    else             { day = 1; }
    // días ya reclamados de la racha en curso = day-1 (los anteriores consecutivos)
    var done = (lr === yest) ? (day - 1) : 0;
    return { claimedToday: false, currentDay: day, doneDays: done };
  }

  function dayState(i, view) {
    var dayNum = i + 1;                       // pill i → Día (i+1)
    if (view.claimedToday) {
      if (dayNum <= view.doneDays) return 'claimed';
      return 'locked';
    }
    if (dayNum < view.currentDay)  return 'claimed';
    if (dayNum === view.currentDay) return 'today';
    return 'locked';
  }

  function hasUnclaimedToday() {
    return isVip() && _rw.loaded && _rw.lastDate !== utcToday();
  }

  // ── DOM ───────────────────────────────────────────────────
  var sheet, overlay, dot;

  function buildSheet() {
    overlay = document.createElement('div');
    overlay.className = 'rw-overlay';
    overlay.addEventListener('click', close);
    sheet = document.createElement('div');
    sheet.className = 'rw-sheet';
    document.body.appendChild(overlay);
    document.body.appendChild(sheet);
  }

  function render() {
    var view = computeView();
    var vip = isVip();

    var pills = DAYS.map(function (r, i) {
      var s = dayState(i, view);
      return '<div class="rw-pill rw-' + s + '">' +
        '<span class="rw-pill-day">' + r.d + '</span>' +
        '<span class="rw-pill-ic">' + (s === 'claimed'
          ? ICON('check', { size: 18 })
          : (s === 'locked' ? ICON('gift', { size: 16 }) : ICON('gem', { size: 16 }))) + '</span>' +
        '<span class="rw-pill-amt">' + r.n + '</span>' +
      '</div>';
    }).join('');

    var todayReward = DAYS[Math.max(0, Math.min(6, view.currentDay - 1))];
    var panel;
    if (typeof supabaseUser === 'undefined' || !supabaseUser) {
      panel = '<div class="rw-vipgate">' +
        '<div class="rw-vipgate-crown">' + ICON('gift', { size: 26 }) + '</div>' +
        '<div class="rw-vipgate-title">Inicia sesión</div>' +
        '<div class="rw-vipgate-sub">Necesitas tu cuenta para reclamar la recompensa diaria.</div>' +
      '</div>';
    } else if (!vip) {
      panel = '<div class="rw-vipgate">' +
        '<div class="rw-vipgate-crown">' + ICON('crown', { size: 26 }) + '</div>' +
        '<div class="rw-vipgate-title">Recompensas exclusivas VIP</div>' +
        '<div class="rw-vipgate-sub">Hazte VIP para reclamar <strong>+' + todayReward.n + ' gemas</strong> hoy y mantener tu racha.</div>' +
        '<button class="rw-vipgate-btn" data-vip>' + ICON('crown', { size: 16 }) + ' Hazte VIP</button>' +
      '</div>';
    } else if (view.claimedToday) {
      var nextDay = (view.currentDay >= 7) ? 1 : view.currentDay + 1;
      panel = '<div class="rw-today rw-today-done">' +
        '<div class="rw-today-check">' + ICON('check', { size: 30 }) + '</div>' +
        '<div class="rw-today-txt"><strong>¡Recompensa de hoy reclamada!</strong>' +
        '<span>Vuelve mañana por +' + DAYS[nextDay - 1].n + ' gemas (Día ' + nextDay + ')</span></div></div>';
    } else {
      panel = '<div class="rw-today rw-today-vip">' +
        '<div class="rw-today-head"><span class="rw-today-tag">HOY · ' + todayReward.d + '</span>' +
        '<span class="rw-vip-chip">' + ICON('crown', { size: 12 }) + ' VIP</span></div>' +
        '<button class="rw-claim rw-claim-single" data-tier="vip">' +
          '<span class="rw-claim-ic">' + ICON('gem', { size: 22 }) + '</span>' +
          '<span class="rw-claim-info">' +
            '<span class="rw-claim-amt">+' + todayReward.n + ' gemas</span>' +
            '<span class="rw-claim-cap">Tu recompensa de hoy</span>' +
          '</span>' +
          '<span class="rw-claim-go">Reclamar ' + ICON('chevronR', { size: 15 }) + '</span>' +
        '</button>' +
      '</div>';
    }

    sheet.innerHTML =
      '<div class="rw-grip"></div>' +
      '<div class="rw-hdr">' +
        '<div class="rw-hdr-ic">' + ICON('gift', { size: 22 }) + '</div>' +
        '<div class="rw-hdr-txt"><div class="rw-title">Recompensa diaria</div>' +
        '<div class="rw-subtitle">Entra cada día y mantén tu racha</div></div>' +
        '<button class="rw-close" aria-label="Cerrar">' + ICON('x', { size: 18 }) + '</button>' +
      '</div>' +
      '<div class="rw-days">' + pills + '</div>' +
      panel +
      '<div class="rw-foot">' + ICON('refresh', { size: 13 }) + ' Si faltas un día, la racha vuelve al Día 1</div>';

    sheet.querySelector('.rw-close').addEventListener('click', close);
    sheet.querySelectorAll('.rw-claim').forEach(function (b) {
      b.addEventListener('click', function () { claim(); });
    });
    var vipBtn = sheet.querySelector('[data-vip]');
    if (vipBtn) vipBtn.addEventListener('click', function () { onUpsell(); });
    if (window.STORYM && window.STORYM.scanIcons) window.STORYM.scanIcons(sheet);
  }

  // Reclamo SIEMPRE en el servidor. Devuelve día, importe y saldo nuevo.
  var _claiming = false;
  function claim() {
    if (_claiming) return;
    if (typeof supabaseUser === 'undefined' || !supabaseUser) {
      if (window.toast) toast('Inicia sesión para reclamar');
      if (window.switchTab) switchTab('profile');
      return;
    }
    if (!isVip()) { onUpsell(); return; }
    _claiming = true;
    supaClient.rpc('claim_daily_reward').then(function (res) {
      _claiming = false;
      var r = res && res.data ? res.data : null;
      var err = res && res.error ? res.error : null;
      // La función no existe / error de la RPC → el SQL no está desplegado.
      if (err) {
        if (window.toast) toast('Error al reclamar: ' + (err.message || '').slice(0, 50));
        refreshState().then(function () { render(); refreshDot(); });
        return;
      }
      if (!r || r.ok === false) {
        if (r && r.reason === 'not_vip') { onUpsell(); }
        else if (r && r.reason === 'already') { if (window.toast) toast('Ya reclamaste hoy'); }
        else { if (window.toast) toast('No se pudo reclamar'); }
        // NO marcamos nada localmente: re-sincronizamos desde el servidor (verdad).
        refreshState().then(function () { render(); refreshDot(); });
        return;
      }
      // Éxito: el servidor sumó las gemas y guardó la racha. Reflejar saldo…
      if (typeof r.gems === 'number') {
        supabaseGems = r.gems;
        try { localStorage.setItem('rp_gems_local', String(supabaseGems)); } catch (e) {}
        if (window.renderUserHeader) renderUserHeader();
      }
      burst();
      if (window.toast) toast('+' + r.amount + ' gemas · Día ' + r.day);
      // …y RECONCILIAR el estado leyéndolo del servidor (fuente de verdad), para
      // que al cerrar y reabrir siga apareciendo como reclamado.
      refreshState().then(function () { render(); refreshDot(); });
    }).catch(function (e) {
      _claiming = false;
      if (window.toast) toast('Error al reclamar');
      console.error('[rewards] claim:', e && e.message);
    });
  }

  // ── botón + punto ─────────────────────────────────────────
  function refreshDot() {
    var on = hasUnclaimedToday();
    document.querySelectorAll('[data-rewards-btn]').forEach(function (b) { b.classList.toggle('has-reward', on); });
    if (dot) dot.style.display = on ? 'block' : 'none';
  }

  function mountButton() {
    document.querySelectorAll('[data-rewards-btn]').forEach(function (slot) {
      if (slot.dataset.rwReady) return;
      slot.dataset.rwReady = '1';
      slot.classList.add('rw-btn');
      slot.innerHTML = '<span class="rw-btn-ic">' + ICON('gift', { size: 18 }) + '</span><span class="rw-btn-dot"></span>';
      slot.addEventListener('click', open);
      if (!dot) dot = slot.querySelector('.rw-btn-dot');
    });
    if (window.STORYM && window.STORYM.scanIcons) window.STORYM.scanIcons(document);
    refreshDot();
  }

  // ── open / close ──────────────────────────────────────────
  function open() {
    if (!sheet) buildSheet();
    render(); // pinta con lo que haya en caché
    void sheet.offsetHeight;
    setTimeout(function () { overlay.classList.add('open'); sheet.classList.add('open'); }, 16);
    // Refresca desde el servidor y re-pinta con datos frescos.
    refreshState().then(function () { render(); refreshDot(); });
  }
  function close() {
    if (!sheet) return;
    overlay.classList.remove('open');
    sheet.classList.remove('open');
  }

  // ── fx ────────────────────────────────────────────────────
  function toast(msg) {
    if (window.toast && window.toast !== toast) return window.toast(msg); // toast global de la app
    var t = document.createElement('div');
    t.className = 'rw-toast'; t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 250); }, 1800);
  }
  function burst() {
    var host = document.createElement('div');
    host.className = 'rw-burst';
    var N = 20;
    for (var i = 0; i < N; i++) {
      var p = document.createElement('span');
      var a = (Math.PI * 2 * i) / N + (Math.random() * 0.4 - 0.2), d = 55 + Math.random() * 65;
      p.style.setProperty('--x', Math.cos(a) * d + 'px');
      p.style.setProperty('--y', Math.sin(a) * d + 'px');
      p.style.setProperty('--sz', (6 + Math.random() * 8).toFixed(1) + 'px');
      p.style.animationDelay = (Math.random() * 80) + 'ms';
      host.appendChild(p);
    }
    (sheet || document.body).appendChild(host);
    setTimeout(function () { host.remove(); }, 1000);
  }

  // expose + init
  window.StorymRewards = {
    open: open, close: close,
    refresh: function () { refreshState().then(refreshDot); }
  };
  function init() { mountButton(); refreshState().then(refreshDot); }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
  new MutationObserver(mountButton).observe(document.documentElement, { childList: true, subtree: true });
})();
