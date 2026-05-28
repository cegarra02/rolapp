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
const AD_COOLDOWN_MS = 30 * 60 * 1000;
let _adCooldownUntil = parseInt(localStorage.getItem('rp_ad_cooldown') || '0');
let _adInProgress    = false;

// ── Límite semanal para packs especiales ──────────────────────────────────────
function _specialUsedThisWeek(packId) {
  const ts = parseInt(localStorage.getItem('rp_sp_' + packId) || '0');
  return ts > 0 && (Date.now() - ts) < WEEK_MS;
}
function _markSpecialUsed(packId) {
  localStorage.setItem('rp_sp_' + packId, String(Date.now()));
}
function _specialDaysLeft(packId) {
  const ts = parseInt(localStorage.getItem('rp_sp_' + packId) || '0');
  if (!ts) return 0;
  return Math.max(0, Math.ceil((WEEK_MS - (Date.now() - ts)) / 86400000));
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
      // ↓ REEMPLAZAR con tu API key de RevenueCat (dashboard.revenuecat.com)
      apiKey: 'goog_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    });
    console.log('[Billing] RevenueCat inicializado');
  } catch (e) { console.warn('[Billing] init error:', e?.message); }
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
  const now          = Date.now();
  const cooldownLeft = _adCooldownUntil > now ? Math.ceil((_adCooldownUntil - now) / 60000) : 0;

  document.getElementById('gemShopBalance').textContent = getDisplayGems() + ' 💎';

  // ── Paquetes regulares ───────────────────────────────────────────────────
  document.getElementById('gemPackagesList').innerHTML = GEM_PACKAGES.map(p => {
    const gemsLabel  = _fmtGems(p.gems);
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
    return `
    <button class="gem-special-card" onclick="purchaseSpecialPackage('${p.id}')" ${used ? 'disabled' : ''}>
      <div class="gem-special-badge">⚡ SEMANAL</div>
      <div class="gem-special-gems">
        <div class="gem-special-count">💎 ${_fmtGems(p.gems)}</div>
        <div class="gem-special-normal">💎 ${p.normalGems} precio habitual</div>
      </div>
      <div class="gem-special-right">
        <div class="gem-special-price">${isNative ? p.price : '—'}</div>
        <div class="gem-special-status">${used ? `⏳ ${daysLeft}d para renovar` : '1 compra / semana'}</div>
      </div>
    </button>`;
  }).join('');

  // ── Botón de anuncio ──────────────────────────────────────────────────────
  const adBtn = document.getElementById('gemAdBtn');
  if (!isNative) {
    adBtn.textContent = '📺 Ver anuncio · Solo en app Android';
    adBtn.disabled = true;
  } else if (_adInProgress) {
    adBtn.textContent = '⏳ Cargando anuncio…';
    adBtn.disabled = true;
  } else if (cooldownLeft > 0) {
    adBtn.textContent = `⏳ Disponible en ${cooldownLeft} min`;
    adBtn.disabled = true;
  } else {
    adBtn.textContent = '📺 Ver anuncio · Ganar 4–9 💎 gratis';
    adBtn.disabled = false;
  }
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

    const { offerings } = await Purchases.getOfferings();
    const available = offerings?.current?.availablePackages || [];
    const rcPkg = available.find(p => p.product?.identifier === productId);
    if (!rcPkg) throw new Error(`Producto ${productId} no encontrado en RevenueCat`);

    await Purchases.purchasePackage({ aPackage: rcPkg });

    // Para producción: webhook RevenueCat → Supabase Edge Function → addGems
    await addGems(supabaseUser.id, pkg.gems);
    toast(`💎 +${pkg.gems} gemas añadidas`);
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

    const { offerings } = await Purchases.getOfferings();
    const available = offerings?.current?.availablePackages || [];
    const rcPkg = available.find(p => p.product?.identifier === productId);
    if (!rcPkg) throw new Error(`Producto ${productId} no encontrado en RevenueCat`);

    await Purchases.purchasePackage({ aPackage: rcPkg });
    await addGems(supabaseUser.id, pkg.gems);
    _markSpecialUsed(productId);
    toast(`💎 +${pkg.gems} gemas añadidas`);
    _renderGemShop();
  } catch (e) {
    const msg = e?.message || '';
    if (msg.includes('userCancelled') || e?.code === '1') return;
    console.error('[IAP special] error:', msg);
    toast('Error en la compra' + (msg ? ': ' + msg : ''));
  }
}

// ── Anuncio de recompensa vía AdMob ──────────────────────────────────────────
async function watchRewardedAd() {
  if (_adInProgress || Date.now() < _adCooldownUntil) return;
  if (!window.Capacitor?.isNativePlatform?.()) return;

  _adInProgress = true;
  _renderGemShop();

  try {
    const AdMob = window.Capacitor.Plugins?.AdMob;
    if (!AdMob) throw new Error('AdMob no disponible');

    await AdMob.prepareRewardVideoAd({
      // ↓ TEST ID de Google — reemplazar con tu ad unit ID real de AdMob
      adId: 'ca-app-pub-3940256099942544/5224354917',
    });
    const result = await AdMob.showRewardVideoAd();

    if (result?.reward) {
      const gems = Math.floor(Math.random() * 6) + 4; // 4–9 aleatorio
      await _grantAdGems(gems);
      _adCooldownUntil = Date.now() + AD_COOLDOWN_MS;
      localStorage.setItem('rp_ad_cooldown', String(_adCooldownUntil));
      toast(`💎 +${gems} gemas ganadas`);
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

async function _grantAdGems(amount) {
  if (supabaseUser) {
    const { data: newBalance, error } = await supaClient.rpc('add_gems_from_ad', { amount });
    if (error) {
      console.error('[AdGems] RPC error:', error.message);
      supabaseGems += amount;
    } else {
      supabaseGems = newBalance ?? (supabaseGems + amount);
    }
    localStorage.setItem('rp_gems_local', String(supabaseGems));
  } else {
    const cur = parseInt(localStorage.getItem('rp_gems_local') || '0');
    localStorage.setItem('rp_gems_local', String(cur + amount));
  }
  renderUserHeader();
}
