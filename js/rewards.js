/* ============================================================
   Storym — Recompensas de inicio de sesión (semanal)
   Vanilla JS, sin dependencias. Drop-in.

   • Botón regalo (con punto si hay premio sin reclamar hoy).
   • Hoja inferior con los 7 días (Lun–Dom).
   • Cada día: recompensa NORMAL + recompensa VIP (más gemas).
   • Solo se puede reclamar el día actual; al reclamar, ese día
     cambia de tonalidad (reclamado) y queda marcado con ✓.
   • Se reinicia automáticamente cada semana (lunes).

   ── INTEGRACIÓN (2 líneas) ─────────────────────────────────
   1) Gemas: apunta CONFIG.applyGems a TU función de sumar gemas.
   2) VIP:   apunta CONFIG.isVip a TU comprobación de membresía.
   Si no las tocas, usa un fallback con localStorage + eventos.
   ============================================================ */
(function () {
  var CONFIG = {
    // Usa grantGems() expuesto en gemshop.js (maneja usuarios logueados y anónimos)
    applyGems: function (n) {
      if (window.grantGems) return window.grantGems(n);
      // fallback: solo localStorage (usuario no logueado y gemshop no cargado aún)
      try {
        var cur = parseInt(localStorage.getItem('rp_gems_local') || '0');
        localStorage.setItem('rp_gems_local', String(cur + n));
        if (window.renderUserHeader) window.renderUserHeader();
      } catch (e) {}
    },
    // VIP requerido para las recompensas semanales
    isVip: function () { return (typeof window.isVipUser === 'function') ? window.isVipUser() : false; },
    onUpsell: function () { // qué pasa al tocar reclamar sin ser VIP
      close();
      if (window.openVipScreen) window.openVipScreen();
    },
  };

  // recompensa por día (única; ahora es una ventaja VIP)
  var WEEK = [
    { d: 'Lun', n: 25  },
    { d: 'Mar', n: 35  },
    { d: 'Mié', n: 50  },
    { d: 'Jue', n: 60  },
    { d: 'Vie', n: 80  },
    { d: 'Sáb', n: 110 },
    { d: 'Dom', n: 200 },
  ];

  var KEY = 'storym_rewards_v1';
  var ICON = (window.STORYM && window.STORYM.icon) ? window.STORYM.icon : function () { return ''; };

  // ── week helpers ──────────────────────────────────────────
  function weekKey(date) { // ISO year-week, resets each Monday
    var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    var day = (d.getUTCDay() + 6) % 7;            // Mon=0
    d.setUTCDate(d.getUTCDate() - day + 3);        // nearest Thursday
    var firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    var w = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
    return d.getUTCFullYear() + '-W' + w;
  }
  function todayIdx() { return (new Date().getDay() + 6) % 7; } // Mon=0..Sun=6

  function load() {
    var st;
    try { st = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
    var wk = weekKey(new Date());
    if (!st || st.week !== wk) { st = { week: wk, claimed: {} }; save(st); }
    return st;
  }
  function save(st) { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  function dayState(i, st) {
    if (st.claimed[i]) return 'claimed';
    var t = todayIdx();
    if (i === t) return 'today';
    if (i < t) return 'missed';
    return 'locked';
  }
  function hasUnclaimedToday() {
    var st = load();
    return !st.claimed[todayIdx()];
  }

  // ── DOM build ─────────────────────────────────────────────
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
    var st = load();
    var t = todayIdx();
    var vip = CONFIG.isVip();

    var pills = WEEK.map(function (r, i) {
      var s = dayState(i, st);
      return '<div class="rw-pill rw-' + s + '">' +
        '<span class="rw-pill-day">' + r.d + '</span>' +
        '<span class="rw-pill-ic">' + (s === 'claimed'
          ? ICON('check', { size: 18 })
          : (s === 'locked' ? ICON('gift', { size: 16 }) : ICON('gem', { size: 16 }))) + '</span>' +
        '<span class="rw-pill-amt">' + r.n + '</span>' +
      '</div>';
    }).join('');

    var today = WEEK[t];
    var claimedToday = st.claimed[t];
    var panel;
    if (claimedToday) {
      panel = '<div class="rw-today rw-today-done">' +
        '<div class="rw-today-check">' + ICON('check', { size: 30 }) + '</div>' +
        '<div class="rw-today-txt"><strong>¡Premio de hoy reclamado!</strong>' +
        '<span>Vuelve mañana por +' + (WEEK[(t + 1) % 7].n) + ' gemas</span></div></div>';
    } else if (!vip) {
      // bloqueado: recompensas son una ventaja VIP
      panel = '<div class="rw-vipgate">' +
        '<div class="rw-vipgate-crown">' + ICON('crown', { size: 26 }) + '</div>' +
        '<div class="rw-vipgate-title">Recompensas exclusivas VIP</div>' +
        '<div class="rw-vipgate-sub">Hazte VIP para reclamar <strong>+' + today.n + ' gemas</strong> hoy y cada día de la semana.</div>' +
        '<button class="rw-vipgate-btn" data-vip>' + ICON('crown', { size: 16 }) + ' Hazte VIP</button>' +
      '</div>';
    } else {
      panel = '<div class="rw-today rw-today-vip">' +
        '<div class="rw-today-head"><span class="rw-today-tag">HOY · ' + today.d + '</span>' +
        '<span class="rw-vip-chip">' + ICON('crown', { size: 12 }) + ' VIP</span></div>' +
        '<button class="rw-claim rw-claim-single" data-tier="vip">' +
          '<span class="rw-claim-ic">' + ICON('gem', { size: 22 }) + '</span>' +
          '<span class="rw-claim-info">' +
            '<span class="rw-claim-amt">+' + today.n + ' gemas</span>' +
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
        '<div class="rw-subtitle">Entra cada día y reclama gemas</div></div>' +
        '<button class="rw-close" aria-label="Cerrar">' + ICON('x', { size: 18 }) + '</button>' +
      '</div>' +
      '<div class="rw-days">' + pills + '</div>' +
      panel +
      '<div class="rw-foot">' + ICON('refresh', { size: 13 }) + ' Se reinicia cada lunes</div>';

    sheet.querySelector('.rw-close').addEventListener('click', close);
    sheet.querySelectorAll('.rw-claim').forEach(function (b) {
      b.addEventListener('click', function () { claim(b.getAttribute('data-tier')); });
    });
    var vipBtn = sheet.querySelector('[data-vip]');
    if (vipBtn) vipBtn.addEventListener('click', function () { CONFIG.onUpsell(); });
    if (window.STORYM && window.STORYM.scanIcons) window.STORYM.scanIcons(sheet);
  }

  function claim(tier) {
    var st = load();
    var t = todayIdx();
    if (st.claimed[t]) return;
    if (!CONFIG.isVip()) { CONFIG.onUpsell(); return; }
    var r = WEEK[t];
    var amount = r.n;
    st.claimed[t] = 'vip';
    save(st);
    CONFIG.applyGems(amount);
    burst();
    toast('+' + amount + ' gemas reclamadas');
    render();
    refreshDot();
  }

  // ── button + dot ──────────────────────────────────────────
  function refreshDot() {
    var on = hasUnclaimedToday();
    var btns = document.querySelectorAll('[data-rewards-btn]');
    btns.forEach(function (b) { b.classList.toggle('has-reward', on); });
    if (!dot) return;
    dot.style.display = on ? 'block' : 'none';
  }

  function mountButton() {
    var slots = document.querySelectorAll('[data-rewards-btn]');
    slots.forEach(function (slot) {
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
    render();
    // force reflow so the transition runs, then open (setTimeout is more
    // reliable than rAF when the tab is backgrounded/throttled)
    void sheet.offsetHeight;
    setTimeout(function () {
      overlay.classList.add('open');
      sheet.classList.add('open');
    }, 16);
  }
  function close() {
    if (!sheet) return;
    overlay.classList.remove('open');
    sheet.classList.remove('open');
  }

  // ── fx ────────────────────────────────────────────────────
  function toast(msg) {
    if (window.showToast) return window.showToast(msg);
    var t = document.createElement('div');
    t.className = 'rw-toast';
    t.textContent = msg;
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
  window.StorymRewards = { open: open, close: close, refresh: refreshDot, config: CONFIG };
  function init() { mountButton(); }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
  // re-mount if app swaps screens in
  new MutationObserver(mountButton).observe(document.documentElement, { childList: true, subtree: true });
})();
