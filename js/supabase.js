const SUPA_URL = 'https://pxtnjtkckfzsqistfjgn.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4dG5qdGtja2Z6c3Fpc3RmamduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDc1ODgsImV4cCI6MjA5NDg4MzU4OH0.toSgkHMYun1yM5UePDGRXYjhe4DRGtRQjsNUGjh5wJY';
const GOOGLE_CLIENT_ID = '780402566964-3dh5n09g3mo3t10i7quq9rvlu42lefpi.apps.googleusercontent.com';

// Fetch con reintentos automáticos para absorber ERR_QUIC_PROTOCOL_ERROR y
// otros fallos de red transitorios que Cloudflare/Supabase pueden lanzar.
async function _fetchWithRetry(url, options = {}) {
  const MAX = 2;
  let lastErr;
  for (let i = 0; i <= MAX; i++) {
    try {
      return await fetch(url, options);
    } catch (e) {
      lastErr = e;
      if (i < MAX) {
        const delay = 600 * (i + 1);
        console.warn(`[supabase] red caída (${e.message}), reintento ${i + 1}/${MAX} en ${delay}ms`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastErr;
}

// flowType: 'implicit' → el deep link devuelve #access_token=...&refresh_token=...
// en vez de ?code=... (PKCE). Evita gestionar code_verifier en Capacitor WebView,
// donde el verifier puede perderse si el SO mata la app entre el OAuth y el retorno.
const supaClient = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
  global: { fetch: _fetchWithRetry },
  auth:   { flowType: 'implicit' }
});

let supabaseUser = null;
let supabaseGems = 0;

async function initSupabase() {
  if (localStorage.getItem('rp_gems_local') === null) {
    localStorage.setItem('rp_gems_local', '50');
  }

  // UI inicial sin sesión mientras resuelve la auth
  renderUserHeader();

  // ── PASO 1: getSession() lee la sesión persistida en localStorage.
  // Es fiable en cada recarga: no depende del timing de eventos.
  // Con flowType:'implicit' no hay code pendiente de intercambiar,
  // así que getSession() siempre devuelve el estado real al arrancar.
  try {
    const { data: { session } } = await supaClient.auth.getSession();
    await _applySession(session);
  } catch (e) {
    console.warn('[initSupabase] getSession:', e?.message);
  }
  renderUserHeader();
  if (document.getElementById('profileScreen')?.classList.contains('active')) loadProfileFields();

  // ── PASO 2: onAuthStateChange gestiona cambios futuros (nuevo login, logout,
  // renovación de token). INITIAL_SESSION se ignora porque ya lo manejó getSession().
  supaClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'INITIAL_SESSION') return; // ya gestionado arriba
    toast('🔔 ' + event); // DEBUG
    try {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await _applySession(session);
      } else if (event === 'SIGNED_OUT') {
        await _applySession(null);
      }
    } catch (e) {
      console.warn('[auth] onAuthStateChange:', e?.message);
    }
    renderUserHeader();
    if (document.getElementById('profileScreen')?.classList.contains('active')) loadProfileFields();
  });

  // Sync gems from Supabase when user returns to the tab/app (cross-device sync)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshGems();
  });
}

// Aplica una sesión (o null) al estado global y carga las gemas.
// Usado tanto por getSession() en el arranque como por onAuthStateChange.
async function _applySession(session) {
  if (session?.user) {
    supabaseUser = session.user;
    const localGems = parseInt(localStorage.getItem('rp_gems_local') || '0');
    const isNew = await _ensureUserRow(session.user, localGems);
    if (isNew && localGems > 0) localStorage.removeItem('rp_gems_local');
    await _loadUserGems();
  } else {
    supabaseUser = null;
    supabaseGems = 0;
    if (localStorage.getItem('rp_gems_local') === null) {
      localStorage.setItem('rp_gems_local', '50');
    }
  }
}

async function _ensureUserRow(user, migrateGems) {
  // Devuelve true SOLO si la fila se creó con éxito (usuario nuevo).
  // Si el INSERT falla (ej: falta política RLS), devuelve false para NO borrar las gemas locales.
  try {
    const { data } = await supaClient.from('users').select('id').eq('id', user.id).single();
    if (!data) {
      // Usuario nuevo → intentar crear fila con gemas locales
      const gems = migrateGems > 0 ? migrateGems : 50;
      const { error: insertErr } = await supaClient.from('users').insert({ id: user.id, gems });
      if (insertErr) {
        console.error('[ensureUserRow] INSERT falló:', insertErr.message, insertErr.code,
          '— ¿falta política RLS INSERT en users? Ejecuta: CREATE POLICY "Users insert own row" ON users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);');
        return false; // No borrar gemas locales si el INSERT falló
      }
      console.log('[ensureUserRow] nueva fila creada, gems:', gems);
      return true;
    }
    return false; // Usuario existente
  } catch (e) {
    console.warn('[ensureUserRow] non-fatal:', e?.message);
    return false;
  }
}

async function _loadUserGems() {
  if (!supabaseUser) return;
  try {
    const { data, error } = await supaClient.from('users').select('gems').eq('id', supabaseUser.id).single();
    if (error) {
      if (error.code === 'PGRST116') {
        // No hay fila → crearla con las gemas locales (o 50 por defecto)
        console.warn('[loadUserGems] sin fila → _ensureUserRow');
        const localGems = parseInt(localStorage.getItem('rp_gems_local') || '50');
        const created = await _ensureUserRow(supabaseUser, localGems);
        if (created) {
          localStorage.removeItem('rp_gems_local');
          supabaseGems = localGems;
        }
      } else {
        // Error de red u otro: no tocar supabaseGems para no perder valor previo
        console.warn('[loadUserGems]:', error.code, error.message);
      }
      return;
    }
    supabaseGems = data?.gems ?? 0;
  } catch (e) {
    console.warn('[loadUserGems] catch:', e?.message);
  }
}

async function refreshGems() {
  if (!supabaseUser) return;
  await _loadUserGems();
  renderUserHeader();
  // Sync profile screen badge if visible
  const badge = document.querySelector('.auth-gems-badge strong');
  if (badge) badge.textContent = supabaseGems;
  // Sync mod panel label
  const modEl = document.getElementById('modMyGems');
  if (modEl) modEl.textContent = supabaseGems;
}

async function addGems(userId, amount) {
  const { data, error: selErr } = await supaClient.from('users').select('gems').eq('id', userId).single();
  if (selErr) throw selErr;
  const current = data?.gems ?? 0;
  const { error: updErr } = await supaClient.from('users').update({ gems: current + amount }).eq('id', userId);
  if (updErr) throw updErr;
  if (supabaseUser?.id === userId) { supabaseGems = current + amount; renderUserHeader(); }
}

async function spendGems(userId, amount) {
  const { data, error: selErr } = await supaClient.from('users').select('gems').eq('id', userId).single();
  if (selErr) throw selErr;
  const current = data?.gems ?? 0;
  if (current < amount) return false;
  const { error: updErr } = await supaClient.from('users').update({ gems: current - amount }).eq('id', userId);
  if (updErr) throw updErr;
  if (supabaseUser?.id === userId) { supabaseGems = current - amount; renderUserHeader(); }
  return true;
}

function getDisplayGems() {
  if (supabaseUser) return supabaseGems;
  return parseInt(localStorage.getItem('rp_gems_local') || '0');
}

// ── Coste por mensaje ─────────────────────────────────────────────────────────
const MESSAGE_GEM_COST = 7;

// Descuenta las gemas del mensaje de forma síncrona (usando la caché local)
// y persiste el nuevo saldo en Supabase/localStorage en segundo plano.
// Devuelve true si hay saldo suficiente, false si no.
function deductMessageGems() {
  const cost = MESSAGE_GEM_COST;
  if (supabaseUser) {
    if (supabaseGems < cost) return false;
    supabaseGems -= cost;
    renderUserHeader();
    // Persistir en Supabase async (fire and forget)
    supaClient.from('users').update({ gems: supabaseGems }).eq('id', supabaseUser.id);
    return true;
  } else {
    const current = parseInt(localStorage.getItem('rp_gems_local') || '0');
    if (current < cost) return false;
    localStorage.setItem('rp_gems_local', String(current - cost));
    renderUserHeader();
    return true;
  }
}

function renderUserHeader() {
  document.querySelectorAll('.user-header-chip').forEach(el => {
    const gems = getDisplayGems();
    if (supabaseUser) {
      const name = supabaseUser.user_metadata?.full_name || supabaseUser.email || '';
      const initials = name.slice(0, 2).toUpperCase();
      el.innerHTML = `<span class="uhc-gems">💎 ${gems}</span><div class="uhc-avatar" onclick="switchTab('profile')">${initials}</div>`;
    } else {
      el.innerHTML = `<span class="uhc-gems">💎 ${gems}</span><button class="uhc-login" onclick="switchTab('profile')">👤</button>`;
    }
  });

  // Sync profile gems badge if already rendered
  const badge = document.querySelector('.auth-gems-badge strong');
  if (badge) badge.textContent = getDisplayGems();

  // Show/hide public toggle in char editor
  const ptCard = document.getElementById('publicToggleCard');
  if (ptCard) ptCard.style.display = supabaseUser ? 'block' : 'none';
}

// Auth actions
async function authSignUp(email, password) {
  const { data, error } = await supaClient.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

async function authSignIn(email, password) {
  const { data, error } = await supaClient.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Google OAuth redirect — para Android nativo.
// Google bloquea OAuth en WebViews → se usa @capacitor/browser (Chrome Custom Tabs).
// El redirect final vuelve a la app por deep link: com.roleplayai.app://
async function signInWithGoogleRedirect() {
  const isNative = !!(window.Capacitor?.isNativePlatform?.());
  const redirectTo = isNative ? 'com.roleplayai.app://' : window.location.origin + '/';
  console.log('[Google] signInWithOAuth → redirectTo:', redirectTo);
  toast('🚀 Iniciando OAuth…');

  const { data, error } = await supaClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: isNative }
  });
  if (error) {
    console.error('[Google] signInWithOAuth error:', error);
    toast('Error Google: ' + error.message);
    return;
  }
  // En nativo: abre Chrome Custom Tabs (no WebView → Google lo permite)
  if (isNative && data?.url) {
    toast('🌐 Abriendo navegador…');
    try {
      await window.Capacitor.Plugins.Browser.open({ url: data.url });
    } catch (e) {
      console.error('[Google] Browser.open error:', e);
      toast('Error abriendo navegador: ' + e.message);
    }
  }
}

// Deduplicación: evita procesar el mismo deep link dos veces
// (getLaunchUrl + appUrlOpen pueden dispararse ambos en cold-start en algunos dispositivos).
let _lastDeepLinkUrl = '';

// Gestiona el deep link de retorno tras OAuth (llamado desde main.js).
// Con flowType:'implicit', Supabase devuelve #access_token=...&refresh_token=...
// Mantenemos el rama PKCE (?code=...) como fallback por compatibilidad.
async function handleDeepLink(url) {
  if (!url || !url.startsWith('com.roleplayai.app://')) return;
  if (url === _lastDeepLinkUrl) {
    console.log('[deepLink] URL duplicada ignorada');
    return;
  }
  _lastDeepLinkUrl = url;
  console.log('[deepLink] URL recibida:', url.slice(0, 100));

  // ── DIAGNÓSTICO: muestra qué contiene la URL ──────────────────────────
  const _hasHash  = url.includes('#');
  const _hasCode  = url.includes('code=');
  const _hasToken = url.includes('access_token=');
  toast('🔗 ' + (_hasToken ? 'tokens✓' : _hasCode ? 'code✓' : 'sin datos⚠') + ' | hash:' + _hasHash);
  // ──────────────────────────────────────────────────────────────────────

  try { await window.Capacitor.Plugins.Browser.close(); } catch (_) {}

  // Parsear hash (#...) y query (?...) por separado
  const hashStr  = url.includes('#') ? url.split('#').slice(1).join('#') : '';
  const queryStr = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const hp = new URLSearchParams(hashStr);
  const qp = new URLSearchParams(queryStr);

  const access_token  = hp.get('access_token')  || qp.get('access_token');
  const refresh_token = hp.get('refresh_token') || qp.get('refresh_token');
  const code          = qp.get('code');

  if (access_token && refresh_token) {
    // ── Flujo implícito (flowType:'implicit') ────────────────────────────
    toast('🔑 setSession…');
    const { data, error } = await supaClient.auth.setSession({ access_token, refresh_token });
    if (error) {
      toast('❌ setSession: ' + error.message.slice(0, 40));
      _lastDeepLinkUrl = '';
      return;
    }
    toast('🔑 session:' + (data?.session ? 'OK' : 'NULL'));
    if (data?.session) {
      await _applySession(data.session);
      renderUserHeader();
      if (document.getElementById('profileScreen')?.classList.contains('active')) loadProfileFields();
      toast('✅ Login OK · gems:' + supabaseGems);
    }

  } else if (code) {
    // ── Flujo PKCE (fallback por si el servidor envía code en lugar de tokens) ──
    toast('🔑 PKCE exchange…');
    const { data, error } = await supaClient.auth.exchangeCodeForSession(url);
    if (error) {
      toast('❌ PKCE: ' + error.message.slice(0, 40));
      _lastDeepLinkUrl = '';
      return;
    }
    toast('🔑 session:' + (data?.session ? 'OK' : 'NULL'));
    if (data?.session) {
      await _applySession(data.session);
      renderUserHeader();
      if (document.getElementById('profileScreen')?.classList.contains('active')) loadProfileFields();
      toast('✅ Login PKCE OK · gems:' + supabaseGems);
    }

  } else {
    console.warn('[deepLink] URL sin tokens ni code:', url.slice(0, 120));
    toast('⚠️ URL sin datos de sesión');
    _lastDeepLinkUrl = '';
  }
}

// Google Identity Services — no redirect, usa popup propio de Google
async function handleGoogleLogin(response) {
  console.log('[GIS] credential recibido, longitud:', response?.credential?.length);
  try {
    const { data, error } = await supaClient.auth.signInWithIdToken({
      provider: 'google',
      token: response.credential
    });
    console.log('[GIS] signInWithIdToken — data:', data, '— error:', error);
    if (error) throw error;
    // onAuthStateChange gestiona el resto (gems, header, etc.)
  } catch (e) {
    console.error('[GIS] handleGoogleLogin error completo:', e);
    const msg = e.status ? `${e.status} ${e.message}` : e.message || 'sin conexión con Supabase';
    toast('Error Google: ' + msg);
  }
}

let _gisInitialized = false;

function initGoogleSignIn(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (typeof google === 'undefined' || !google?.accounts?.id) {
    // Script aún cargando, reintenta en 300ms
    setTimeout(() => initGoogleSignIn(containerId), 300);
    return;
  }
  if (!_gisInitialized) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleLogin
    });
    _gisInitialized = true;
  }
  google.accounts.id.renderButton(el, {
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'rectangular',
    logo_alignment: 'left',
    width: el.offsetWidth || 300
  });
}

async function authSignOut() {
  _lastDeepLinkUrl = ''; // permitir nuevo login tras cerrar sesión
  await supaClient.auth.signOut();
}

async function submitCharToLibrary(charData) {
  if (!supabaseUser) { toast('Inicia sesión para publicar personajes'); return; }
  console.log('[submitChar] INSERT → name:', charData.name, '| author_id:', supabaseUser.id);
  const { error } = await supaClient.from('submissions').insert({
    name:     charData.name,
    tag:      charData.tag      || null,
    gender:   charData.gender   || null,
    age:      charData.age      || null,
    desc:     charData.desc     || null,
    context:  charData.context  || null,
    greeting: charData.greeting || null,
    bg:       charData.bg       || null,
    timid:    charData.timid    ?? 5,
    romantic: charData.romantic ?? 5,
    pace:     charData.pace     ?? 4,
    nsfw:     charData.nsfw     ?? 7,
    author_id: supabaseUser.id,
    status:   'pending',
    character_data: {
      name:     charData.name,
      tag:      charData.tag      || null,
      gender:   charData.gender   || null,
      age:      charData.age      || null,
      desc:     charData.desc     || null,
      context:  charData.context  || null,
      greeting: charData.greeting || null,
      timid:    charData.timid    ?? 5,
      romantic: charData.romantic ?? 5,
      pace:     charData.pace     ?? 4,
      nsfw:     charData.nsfw     ?? 7
    }
  });
  console.log('[submitChar] resultado INSERT → error:', error);
  if (error) {
    console.error('[submitChar] FALLO:', error.code, error.message, error.details);
    toast('❌ Error al enviar a revisión: ' + (error.message || error.code || 'desconocido'));
    throw error;
  }
  console.log('[submitChar] INSERT OK ✓');
  toast('✓ Personaje enviado a revisión');
}
