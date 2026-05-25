const SUPA_URL = 'https://pxtnjtkckfzsqistfjgn.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4dG5qdGtja2Z6c3Fpc3RmamduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDc1ODgsImV4cCI6MjA5NDg4MzU4OH0.toSgkHMYun1yM5UePDGRXYjhe4DRGtRQjsNUGjh5wJY';
const GOOGLE_CLIENT_ID = '780402566964-3dh5n09g3mo3t10i7quq9rvlu42lefpi.apps.googleusercontent.com';

const supaClient = window.supabase.createClient(SUPA_URL, SUPA_KEY);

let supabaseUser = null;
let supabaseGems = 0;

async function initSupabase() {
  if (localStorage.getItem('rp_gems_local') === null) {
    localStorage.setItem('rp_gems_local', '50');
  }

  // UI inicial sin sesión mientras resuelve la auth
  renderUserHeader();

  // ── PASO 1: getSession() lee la sesión directamente de localStorage.
  // Es fiable en cada recarga sin depender del timing de eventos (INITIAL_SESSION
  // puede llegar con sesión null cuando el JWT expiró y TOKEN_REFRESHED no se manejaba).
  // Nota: no usamos getSession() para flujos PKCE (redirect OAuth) porque el código
  // de la URL aún no se ha intercambiado; pero nuestra app solo usa GIS (signInWithIdToken)
  // que no usa PKCE, así que getSession() es completamente seguro aquí.
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
  // Devuelve true si se acaba de crear la fila (usuario nuevo), false si ya existía.
  try {
    const { data } = await supaClient.from('users').select('id').eq('id', user.id).single();
    if (!data) {
      // Usuario nuevo → crear fila con gemas locales si las hay
      await supaClient.from('users').insert({ id: user.id, gems: migrateGems > 0 ? migrateGems : 50 });
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
      // PGRST116 = no row found; any other error = network/RLS issue
      console.warn('[loadUserGems]:', error.message, error.code);
      return; // Keep last known supabaseGems — don't reset to 0
    }
    supabaseGems = data?.gems ?? 0;
  } catch (e) {
    console.warn('[loadUserGems] catch:', e?.message);
    // Don't reset supabaseGems to 0 on network failures
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
