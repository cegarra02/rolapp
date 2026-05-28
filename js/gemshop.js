// ── Gem Shop — paquetes de compra + anuncios de recompensa ───────────────────

const GEM_PACKAGES = [
  { id: 'gems_100',  gems: 100,  price: '0,99 €',  label: 'Inicio' },
  { id: 'gems_500',  gems: 500,  price: '3,99 €',  label: 'Popular',  badge: 'MÁS POPULAR' },
  { id: 'gems_1200', gems: 1200, price: '7,99 €',  label: 'Pro',      badge: '+20% EXTRA' },
  { id: 'gems_3000', gems: 3000, price: '16,99 €', label: 'Mega',     badge: 'MEJOR VALOR' },
];

const AD_COOLDOWN_MS = 30 * 60 * 1000; // 30 min entre anuncios
let _adCooldownUntil = parseInt(localStorage.getItem('rp_ad_cooldown') || '0');
let _adInProgress = false;

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

function _renderGemShop() {
  const isNative = !!(window.Capacitor?.isNativePlatform?.());
  const now = Date.now();
  const cooldownLeft = _adCooldownUntil > now ? Math.ceil((_adCooldownUntil - now) / 60000) : 0;

  document.getElementById('gemShopBalance').textContent = getDisplayGems();

  document.getElementById('gemPackagesList').innerHTML = GEM_PACKAGES.map(p => {
    const label = p.gems >= 1000 ? (p.gems / 1000) + 'K' : p.gems;
    return `
    <button class="gem-pkg-card${p.badge ? ' gem-pkg-featured' : ''}" onclick="purchaseGemPackage('${p.id}')">
      ${p.badge ? `<div class="gem-pkg-badge">${p.badge}</div>` : ''}
      <div class="gem-pkg-gems">💎 ${label}</div>
      <div class="gem-pkg-name">${p.label}</div>
      <div class="gem-pkg-price">${isNative ? p.price : '—'}</div>
    </button>`;
  }).join('');

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

// ── Comprar paquete vía Google Play Billing ───────────────────────────────────
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

    // RevenueCat confirma la compra → añadir gemas
    // Para mayor seguridad: usar webhook RevenueCat → Supabase Edge Function
    // Por ahora: addGems directo (admin bypass RLS, válido para compra confirmada)
    await addGems(supabaseUser.id, pkg.gems);
    toast(`💎 +${pkg.gems} gemas añadidas`);
    _renderGemShop();
  } catch (e) {
    const msg = e?.message || '';
    if (msg.includes('userCancelled') || e?.code === '1') return; // cancelado por el usuario
    console.error('[IAP] error:', msg);
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
