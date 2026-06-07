// ── Gem Shop — paquetes de compra + anuncios de recompensa ───────────────────

// Paquetes regulares (base + bonus gratis)
const GEM_PACKAGES = [
  { id: 'gems_150',  gems: 150,                       price: '4,99 €',   label: 'Inicio' },
  { id: 'gems_360',  gems: 360,  base: 300, bonus: 60,   price: '9,99 €',   label: 'Popular', badge: 'MÁS POPULAR' },
  { id: 'gems_1200', gems: 1200, base: 900, bonus: 300,  price: '30,99 €',  label: 'Pro',     badge: '+33% GRATIS' },
  { id: 'gems_2300', gems: 2300, base: 1500, bonus: 800, price: '49,99 €',  label: 'Mega',    badge: '+53% GRATIS' },
  { id: 'gems_5200', gems: 5200, base: 3000, bonus: 2200, price: '104,99 €', label: 'Elite',  badge: 'MEJOR VALOR' },
];

// Packs especiales semanales (1 compra por pack por semana)
const SPECIAL_PACKAGES = [
  { id: 'specials_240',  gems: 240,  normalGems: 210,  price: '6,99 €'  },
  { id: 'specials_1200', gems: 1200, normalGems: 600,  price: '20,99 €' },
  { id: 'specials_3000', gems: 3000, normalGems: 1500, price: '49,99 €' },
];

const WEEK_MS        = 7 * 24 * 60 * 60 * 1000;
// Anuncios: cupo de N en una ventana móvil (no cooldown fijo). Pone un techo de
// gemas gratis para no canibalizar las compras, pero recompensa al casual.
const AD_WINDOW_MS   = 8 * 60 * 60 * 1000; // ventana de 8 h
const AD_MAX_PER_WIN = 5;                   // máx. anuncios por ventana
let _adInProgress    = false;

// Marcas de tiempo de los anuncios vistos dentro de la ventana actual.
function _adViews() {
  const raw = localStorage.getItem('rp_ad_views') || '';
  return raw.split(',').map(Number).filter(t => t > 0 && (Date.now() - t) < AD_WINDOW_MS);
}
function _adRemaining() { return Math.max(0, AD_MAX_PER_WIN - _adViews().length); }
function _markAdView() {
  const arr = _adViews(); arr.push(Date.now());
  localStorage.setItem('rp_ad_views', arr.join(','));
}
// Minutos hasta que se libere un hueco (cuando el más antiguo salga de la ventana).
function _adMinsUntilSlot() {
  const arr = _adViews(); if (arr.length < AD_MAX_PER_WIN) return 0;
  const oldest = Math.min.apply(null, arr);
  return Math.max(0, Math.ceil((AD_WINDOW_MS - (Date.now() - oldest)) / 60000));
}

// ── Límite semanal para packs especiales (VIP: 2/sem · normal: 1/sem) ─────────
function _specialLimit() {
  return (typeof isVipUser === 'function' && isVipUser()) ? 2 : 1;
}
function _specialUses(packId) {
  const raw = localStorage.getItem('rp_sp_' + packId) || '';
  return raw.split(',').map(Number).filter(t => t > 0 && (Date.now() - t) < WEEK_MS);
}
function _specialRemaining(packId) {
  return Math.max(0, _specialLimit() - _specialUses(packId).length);
}
function _specialUsedThisWeek(packId) {
  return _specialRemaining(packId) <= 0;
}
function _markSpecialUsed(packId) {
  const arr = _specialUses(packId);
  arr.push(Date.now());
  localStorage.setItem('rp_sp_' + packId, arr.join(','));
}
function _specialDaysLeft(packId) {
  const arr = _specialUses(packId);
  if (!arr.length) return 0;
  const oldest = Math.min.apply(null, arr);   // al expirar el más antiguo se libera un uso
  return Math.max(0, Math.ceil((WEEK_MS - (Date.now() - oldest)) / 86400000));
}

// ── Inicialización de plugins nativos ─────────────────────────────────────────
async function initAdMob() {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  try {
    const AdMob = window.Capacitor.Plugins?.AdMob;
    if (!AdMob) { console.warn('[AdMob] plugin no cargado'); return; }
    await AdMob.initialize({ requestTrackingAuthorization: false });
    console.log('[AdMob] inicializado');
  } catch (e) { console.warn('[AdMob] init error:', e?.message); }
}

async function initBilling() {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  try {
    const { Purchases } = window.Capacitor.Plugins;
    if (!Purchases) { console.warn('[Billing] RevenueCat plugin no cargado'); return; }
    await Purchases.configure({
      // RevenueCat Android public API key
      apiKey: 'goog_MsQFVavHArbkGnfqoOgrRLJiISh',
    });
    console.log('[Billing] RevenueCat inicializado');
    await billingIdentify();
  } catch (e) { console.warn('[Billing] init error:', e?.message); }
}

// Asocia las compras de RevenueCat al usuario de Supabase. IMPRESCINDIBLE: el
// webhook usa este app_user_id para saber a quién acreditar las gemas. Sin esto
// RevenueCat usaría un id anónimo y el webhook descartaría la compra.
async function billingIdentify() {
  if (!window.Capacitor?.isNativePlatform?.()) return;
  const { Purchases } = window.Capacitor.Plugins || {};
  if (!Purchases || !supabaseUser?.id) return;
  try { await Purchases.logIn({ appUserID: supabaseUser.id }); }
  catch (e) { console.warn('[Billing] logIn:', e?.message); }
}

// Tras una compra, las gemas las acredita el WEBHOOK (server-side), de forma
// asíncrona. Sondeamos el saldo del servidor hasta verlo subir (~12s máx). Si
// tarda más, las gemas aparecerán igualmente al refrescar/reabrir la app.
async function _awaitGemCredit() {
  const before = supabaseGems;
  for (let i = 0; i < 8; i++) {
    await new Promise(r => setTimeout(r, 1500));
    await refreshGems();
    if (supabaseGems > before) {
      toast(`💎 +${supabaseGems - before} gemas añadidas`);
      return true;
    }
  }
  toast('💎 Compra recibida. Tus gemas aparecerán en unos instantes.');
  return false;
}

// ── Bottom sheet ──────────────────────────────────────────────────────────────
function openGemShop() {
  _renderGemShop();
  document.getElementById('gemShopOverlay').classList.add('open');
  document.getElementById('gemShopSheet').classList.add('open');
}

function closeGemShop() {
  document.getElementById('gemShopOverlay').classList.remove('open');
  document.getElementById('gemShopSheet').classList.remove('open');
}

function _fmtGems(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K';
  return String(n);
}

function _renderGemShop() {
  const isNative     = !!(window.Capacitor?.isNativePlatform?.());

  document.getElementById('gemShopBalance').textContent = getDisplayGems() + ' 💎';

  // ── Paquetes regulares ───────────────────────────────────────────────────
  document.getElementById('gemPackagesList').innerHTML = GEM_PACKAGES.map(p => {
    const gemsLabel  = _fmtGems(p.base || p.gems); // mostrar base, no el total
    // Mostrar % en línea de bonus solo si el badge no lo lleva ya
    const bonusPct   = p.bonus ? Math.round(p.bonus / p.base * 100) : 0;
    const pctInBonus = p.badge && !p.badge.includes('%');
    const bonusLine  = p.bonus
      ? `<div class="gem-pkg-bonus">+${p.bonus} gratis${pctInBonus ? ' (+' + bonusPct + '%)' : ''}</div>`
      : '';
    return `
    <button class="gem-pkg-card${p.badge ? ' gem-pkg-featured' : ''}" onclick="purchaseGemPackage('${p.id}')">
      ${p.badge ? `<div class="gem-pkg-badge">${p.badge}</div>` : ''}
      <div class="gem-pkg-gems">💎 ${gemsLabel}</div>
      ${bonusLine}
      <div class="gem-pkg-name">${p.label}</div>
      <div class="gem-pkg-price">${isNative ? p.price : '—'}</div>
    </button>`;
  }).join('');

  // ── Packs especiales semanales ────────────────────────────────────────────
  document.getElementById('gemSpecialsList').innerHTML = SPECIAL_PACKAGES.map(p => {
    const used     = _specialUsedThisWeek(p.id);
    const daysLeft = used ? _specialDaysLeft(p.id) : 0;
    const extraPct = p.normalGems ? Math.round((p.gems / p.normalGems - 1) * 100) : 0;
    const limit    = _specialLimit();
    const remain   = _specialRemaining(p.id);
    const statusTxt = used
      ? `⏳ ${daysLeft}d para renovar`
      : (limit > 1 ? `${remain} de ${limit} esta semana` : 'Reclamar');
    return `
    <button class="gem-special-card" onclick="purchaseSpecialPackage('${p.id}')" ${used ? 'disabled' : ''}>
      <div class="gem-special-badge">${limit > 1 ? '⚡ SEMANAL · x2 VIP' : '⚡ SEMANAL'}</div>
      <span class="gem-special-ic"><i data-icon="gem" data-size="24"></i></span>
      <div class="gem-special-gems">
        <div class="gem-special-count">${_fmtGems(p.gems)} gemas</div>
        ${extraPct > 0 ? `<div class="gem-special-extra">+${extraPct}% extra</div>` : ''}
        <div class="gem-special-normal">antes ${p.normalGems}</div>
      </div>
      <div class="gem-special-right">
        <div class="gem-special-price">${isNative ? p.price : '—'}</div>
        <div class="gem-special-status">${statusTxt}</div>
      </div>
    </button>`;
  }).join('');

  // ── Botón de anuncio (cupo de 3 por ventana de 6 h) ───────────────────────
  const adBtn = document.getElementById('gemAdBtn');
  const adRemaining = _adRemaining();
  if (!isNative) {
    adBtn.textContent = '📺 Ver anuncio · Solo en app Android';
    adBtn.disabled = true;
  } else if (_adInProgress) {
    adBtn.textContent = '⏳ Cargando anuncio…';
    adBtn.disabled = true;
  } else if (adRemaining <= 0) {
    const mins = _adMinsUntilSlot();
    const h = Math.floor(mins / 60), m = mins % 60;
    adBtn.textContent = `⏳ Disponible en ${h > 0 ? h + 'h ' : ''}${m}min`;
    adBtn.disabled = true;
  } else {
    adBtn.textContent = `📺 Ver anuncio · Gana gemas (${adRemaining}/${AD_MAX_PER_WIN})`;
    adBtn.disabled = false;
  }
  if (window.STORYM && STORYM.scanIcons) {
    STORYM.scanIcons(document.getElementById('gemSpecialsList'));
    STORYM.scanIcons(document.getElementById('gemPackagesList'));
  }
}

// Localiza un package de RevenueCat de forma tolerante:
//  · getOfferings() puede devolver {offerings:{…}} o el objeto directo → ambos OK.
//  · busca en el offering `default` (gemas) o el `current` como respaldo.
//  · empareja por identificador de package (que controlamos nosotros) y, si no,
//    por product.identifier — admitiendo el formato nuevo de Google `id:base`.
async function _findGemPackage(Purchases, productId) {
  const res = await Purchases.getOfferings();
  const offerings = (res && res.offerings) ? res.offerings : res;
  let off = (offerings && offerings.all && offerings.all.default) ? offerings.all.default
          : (offerings && offerings.current);
  const pkgs = (off && off.availablePackages) || [];
  return pkgs.find(p => p.identifier === productId)
      || pkgs.find(p => p.product && p.product.identifier === productId)
      || pkgs.find(p => p.product && String(p.product.identifier || '').split(':')[0] === productId)
      || null;
}

// ── Comprar paquete regular vía Google Play Billing ───────────────────────────
async function purchaseGemPackage(productId) {
  if (!supabaseUser) {
    closeGemShop(); switchTab('profile');
    toast('Inicia sesión para comprar gemas');
    return;
  }
  if (!window.Capacitor?.isNativePlatform?.()) {
    toast('Las compras solo están disponibles en la app Android');
    return;
  }
  const pkg = GEM_PACKAGES.find(p => p.id === productId);
  if (!pkg) return;

  try {
    const { Purchases } = window.Capacitor.Plugins;
    if (!Purchases) throw new Error('billing plugin no disponible');

    await billingIdentify();  // asegura que la compra se asocia a ESTE usuario

    const rcPkg = await _findGemPackage(Purchases, productId);
    if (!rcPkg) throw new Error(`Producto ${productId} no encontrado en RevenueCat`);

    await Purchases.purchasePackage({ aPackage: rcPkg });

    // Las gemas las acredita el webhook verificado (server-side). No acreditamos
    // nada en el cliente: solo esperamos a que el saldo del servidor suba.
    toast('⏳ Procesando compra…');
    await _awaitGemCredit();
    _renderGemShop();
  } catch (e) {
    const msg = e?.message || '';
    if (msg.includes('userCancelled') || e?.code === '1') return;
    console.error('[IAP] error:', msg);
    toast('Error en la compra' + (msg ? ': ' + msg : ''));
  }
}

// ── Comprar pack especial semanal ─────────────────────────────────────────────
async function purchaseSpecialPackage(productId) {
  if (_specialUsedThisWeek(productId)) {
    toast('Ya has comprado este pack esta semana');
    return;
  }
  if (!supabaseUser) {
    closeGemShop(); switchTab('profile');
    toast('Inicia sesión para comprar gemas');
    return;
  }
  if (!window.Capacitor?.isNativePlatform?.()) {
    toast('Las compras solo están disponibles en la app Android');
    return;
  }
  const pkg = SPECIAL_PACKAGES.find(p => p.id === productId);
  if (!pkg) return;

  try {
    const { Purchases } = window.Capacitor.Plugins;
    if (!Purchases) throw new Error('billing plugin no disponible');

    await billingIdentify();  // asegura que la compra se asocia a ESTE usuario

    const rcPkg = await _findGemPackage(Purchases, productId);
    if (!rcPkg) throw new Error(`Producto ${productId} no encontrado en RevenueCat`);

    await Purchases.purchasePackage({ aPackage: rcPkg });

    // Las gemas las acredita el webhook verificado (importe decidido en servidor).
    // El límite "1/semana" es solo un gate de UI; lo marcamos para deshabilitar
    // el botón hasta la próxima semana.
    _markSpecialUsed(productId);
    toast('⏳ Procesando compra…');
    await _awaitGemCredit();
    _renderGemShop();
  } catch (e) {
    const msg = e?.message || '';
    if (msg.includes('userCancelled') || e?.code === '1') return;
    console.error('[IAP special] error:', msg);
    toast('Error en la compra' + (msg ? ': ' + msg : ''));
  }
}

// ── Anuncio de recompensa vía AdMob (con SSV verificado en servidor) ─────────
// Las gemas las acredita el callback SSV de Google al Worker (firma verificada),
// NO el cliente. Pasamos userId en las opciones SSV para que Google sepa a quién
// acreditar; tras ver el anuncio, sondeamos el saldo hasta que llegue el crédito.
async function watchRewardedAd() {
  if (_adInProgress) return;
  if (_adRemaining() <= 0) { toast('Has agotado los anuncios por ahora, vuelve más tarde'); return; }
  if (!supabaseUser) { toast('Inicia sesión para ganar gemas'); return; }
  if (!window.Capacitor?.isNativePlatform?.()) return;

  _adInProgress = true;
  _renderGemShop();

  try {
    const AdMob = window.Capacitor.Plugins?.AdMob;
    if (!AdMob) throw new Error('AdMob no disponible');

    await AdMob.prepareRewardVideoAd({
      adId: 'ca-app-pub-2254796338985845/7497827581',
      ssv: { userId: supabaseUser.id }, // → Google envía user_id en el callback SSV
    });
    const result = await AdMob.showRewardVideoAd();

    if (result) {
      // Consumir un hueco del cupo y esperar el crédito server-side (asíncrono).
      _markAdView();
      toast('⏳ Procesando recompensa…');
      await _awaitGemCredit();
    }
  } catch (e) {
    const msg = e?.message || '';
    if (!msg.includes('dismiss') && !msg.includes('cancel')) {
      console.error('[AdMob] error:', msg);
      toast('El anuncio no pudo cargarse, inténtalo de nuevo');
    }
  } finally {
    _adInProgress = false;
    _renderGemShop();
  }
}
