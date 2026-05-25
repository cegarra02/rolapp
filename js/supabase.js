const SUPA_URL = 'https://pxtnjtckfzsqistfjgn.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4dG5qdGtja2Z6c3Fpc3RmamduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDc1ODgsImV4cCI6MjA5NDg4MzU4OH0.toSgkHMYun1yM5UePDGRXYjhe4DRGtRQjsNUGjh5wJY';
const GOOGLE_CLIENT_ID = '780402566964-3dh5n09g3mo3t10i7quq9rvlu42lefpi.apps.googleusercontent.com';

const supaClient = window.supabase.createClient(SUPA_URL, SUPA_KEY);

let supabaseUser = null;
let supabaseGems = 0;

async function initSupabase() {
  if (localStorage.getItem('rp_gems_local') === null) {
    localStorage.setItem('rp_gems_local', '50');
  }

  // Render header immediately with no-session state while auth resolves
  renderUserHeader();

  // onAuthStateChange fires INITIAL_SESSION immediately on registration —
  // this handles existing sessions, OAuth callbacks (PKCE code exchange),
  // and new logins, all in one place. No need for getSession().
  supaClient.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
      if (session?.user) {
        supabaseUser = session.user;
        const localGems = parseInt(localStorage.getItem('rp_gems_local') || '0');
        await _ensureUserRow(session.user, localGems);
        if (localGems > 0) localStorage.removeItem('rp_gems_local');
        await _loadUserGems();
      } else {
        supabaseUser = null;
        supabaseGems = 0;
        if (localStorage.getItem('rp_gems_local') === null) {
          localStorage.setItem('rp_gems_local', '50');
        }
      }
      renderUserHeader();
      if (document.getElementById('profileScreen')?.classList.contains('active')) loadProfileFields();
    } else if (event === 'SIGNED_OUT') {
      supabaseUser = null;
      supabaseGems = 0;
      if (localStorage.getItem('rp_gems_local') === null) {
        localStorage.setItem('rp_gems_local', '50');
      }
      renderUserHeader();
      if (document.getElementById('profileScreen')?.classList.contains('active')) loadProfileFields();
    }
  });
}

async function _ensureUserRow(user, migrateGems) {
  const { data } = await supaClient.from('users').select('id,gems').eq('id', user.id).single();
  if (!data) {
    await supaClient.from('users').insert({ id: user.id, email: user.email, gems: migrateGems });
  } else if (migrateGems > 0) {
    await supaClient.from('users').update({ gems: (data.gems || 0) + migrateGems }).eq('id', user.id);
  }
}

async function _loadUserGems() {
  if (!supabaseUser) return;
  const { data } = await supaClient.from('users').select('gems').eq('id', supabaseUser.id).single();
  supabaseGems = data?.gems ?? 0;
}

async function addGems(userId, amount) {
  const { data } = await supaClient.from('users').select('gems').eq('id', userId).single();
  const current = data?.gems ?? 0;
  await supaClient.from('users').update({ gems: current + amount }).eq('id', userId);
  if (supabaseUser?.id === userId) { supabaseGems = current + amount; renderUserHeader(); }
}

async function spendGems(userId, amount) {
  const { data } = await supaClient.from('users').select('gems').eq('id', userId).single();
  const current = data?.gems ?? 0;
  if (current < amount) return false;
  await supaClient.from('users').update({ gems: current - amount }).eq('id', userId);
  if (supabaseUser?.id === userId) { supabaseGems = current - amount; renderUserHeader(); }
  return true;
}

function getDisplayGems() {
  if (supabaseUser) return supabaseGems;
  return parseInt(localStorage.getItem('rp_gems_local') || '0');
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
    console.error('[GIS] handleGoogleLogin error:', e);
    toast('Error Google: ' + (e.message || JSON.stringify(e)));
  }
}

function initGoogleSignIn(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (typeof google === 'undefined' || !google?.accounts?.id) {
    // Script aún cargando, reintenta en 300ms
    setTimeout(() => initGoogleSignIn(containerId), 300);
    return;
  }
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleLogin
  });
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
  const { error } = await supaClient.from('submissions').insert({
    name:     charData.name,
    tag:      charData.tag      || null,
    gender:   charData.gender   || null,
    age:      charData.age      || null,
    shoe_size: charData.shoeSize || null,
    desc:     charData.desc     || null,
    context:  charData.context  || null,
    greeting: charData.greeting || null,
    bg:       charData.bg       || null,
    timid:    charData.timid    ?? 5,
    romantic: charData.romantic ?? 5,
    pace:     charData.pace     ?? 4,
    nsfw:     charData.nsfw     ?? 7,
    author_id: supabaseUser.id,
    status:   'pending'
  });
  if (error) throw error;
}
