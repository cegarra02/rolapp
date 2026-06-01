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
    // Sin suscripción VIP por ahora → siempre false
    isVip: function () { return false; },
    onUpsell: function () { // qué pasa al tocar VIP sin serlo
      toast('Hazte VIP para reclamar el premio mejorado');
      if (window.openGemShop) window.openGemShop();
    },
  };

  // recompensa por día: [normal, vip]
  var WEEK = [
    { d: 'Lun', n: 10,  v: 25  },
    { d: 'Mar', n: 15,  v: 35  },
    { d: 'Mié', n: 20,  v: 50  },
    { d: 'Jue', n: 25,  v: 60  },
    { d: 'Vie', n: 30,  v: 80  },
    { d: 'Sáb', n: 45,  v: 110 },
    { d: 'Dom', n: 80,  v: 200 },
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
      var tier = st.claimed[i];
      return '<div class="rw-pill rw-' + s + '">' +
        '<span class="rw-pill-day">' + r.d + '</span>' +
        '<span class="rw-pill-ic">' + (s === 'claimed'
          ? ICON('check', { size: 18 })
          : (s === 'locked' ? ICON('gift', { size: 16 }) : ICON('gem', { size: 16 }))) + '</span>' +
        '<span class="rw-pill-amt">' + (tier === 'vip' ? r.v : r.n) + '</span>' +
        (tier === 'vip' ? '<span class="rw-pill-vip">' + ICON('crown', { size: 11 }) + '</span>' : '') +
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
    } else {
      panel = '<div class="rw-today">' +
        '<div class="rw-today-head"><span class="rw-today-tag">HOY · ' + today.d + '</span>' +
        '<span class="rw-today-sub">Elige tu recompensa</span></div>' +
        '<div class="rw-claim-row">' +
          '<button class="rw-claim rw-claim-normal" data-tier="normal">' +
            '<span class="rw-claim-ic">' + ICON('gem', { size: 22 }) + '</span>' +
            '<span class="rw-claim-amt">+' + today.n + '</span>' +
            '<span class="rw-claim-lbl">Normal</span></button>' +
          '<button class="rw-claim rw-claim-vip' + (vip ? '' : ' rw-locked') + '" data-tier="vip">' +
            '<span class="rw-claim-crown">' + ICON('crown', { size: 14 }) + ' VIP</span>' +
            '<span class="rw-claim-ic">' + ICON('gem', { size: 22 }) + '</span>' +
            '<span class="rw-claim-amt">+' + today.v + '</span>' +
            '<span class="rw-claim-lbl">' + (vip ? 'VIP' : 'Hazte VIP') + '</span></button>' +
        '</div></div>';
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
    if (window.STORYM && window.STORYM.scanIcons) window.STORYM.scanIcons(sheet);
  }

  function claim(tier) {
    var st = load();
    var t = todayIdx();
    if (st.claimed[t]) return;
    if (tier === 'vip' && !CONFIG.isVip()) { CONFIG.onUpsell(); return; }
    var r = WEEK[t];
    var amount = tier === 'vip' ? r.v : r.n;
    st.claimed[t] = tier;
    save(st);
    CONFIG.applyGems(amount);
    burst();
    toast('+' + amount + ' gemas reclamadas');
    render();
    refreshDot();
  }

  // ── button + dot ──────────────────────────────────────────
  function refreshDot() {
    if (!dot) return;
    dot.style.display = hasUnclaimedToday() ? 'block' : 'none';
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
    for (var i = 0; i < 14; i++) {
      var p = document.createElement('span');
      var a = (Math.PI * 2 * i) / 14, d = 60 + Math.random() * 40;
      p.style.setProperty('--x', Math.cos(a) * d + 'px');
      p.style.setProperty('--y', Math.sin(a) * d + 'px');
      p.style.animationDelay = (Math.random() * 60) + 'ms';
      host.appendChild(p);
    }
    (sheet || document.body).appendChild(host);
    setTimeout(function () { host.remove(); }, 900);
  }

  // expose + init
  window.StorymRewards = { open: open, close: close, refresh: refreshDot, config: CONFIG };
  function init() { mountButton(); }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
  // re-mount if app swaps screens in
  new MutationObserver(mountButton).observe(document.documentElement, { childList: true, subtree: true });
})();
