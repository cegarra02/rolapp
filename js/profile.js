function pickProfileGender(g) {
  profile._tempGender = profile._tempGender === g ? null : g;
  ['M','F'].forEach(x => document.getElementById('profileGender'+x)?.classList.toggle('active', profile._tempGender === x));
}

function loadProfileFields() {
  const p = profile;
  document.getElementById('profileName').value    = p.name    || '';
  document.getElementById('profileAge').value     = p.age     || '';
  document.getElementById('profileHeight').value  = p.height  || '';
  profile._tempGender = p.gender || null;
  ['M','F'].forEach(x => document.getElementById('profileGender'+x)?.classList.toggle('active', profile._tempGender === x));
  document.getElementById('profileDesc').value    = p.desc    || '';
  document.getElementById('profileContext').value = p.context || '';
  document.getElementById('profilePrefs').value   = p.prefs   || '';
  renderAuthSection();
}

let _authTab = 'login';

function renderAuthSection() {
  const el = document.getElementById('authSection');
  if (!el) return;

  if (supabaseUser) {
    const email = supabaseUser.email || '';
    const name  = supabaseUser.user_metadata?.full_name || email;
    const initials = name.slice(0, 2).toUpperCase();
    const gems = supabaseGems;
    el.innerHTML = `
      <div class="auth-section">
        <div class="auth-user-row">
          <div class="auth-user-avatar">${initials}</div>
          <div class="auth-user-info">
            <div class="auth-user-name">${esc(name)}</div>
            <div class="auth-user-email">${esc(email)}</div>
          </div>
        </div>
        <div class="auth-gems-badge">💎 <strong>${gems}</strong> gemas</div>
        ${isAdmin() ? `<button class="auth-btn auth-btn-google" style="margin-top:10px" onclick="openModeration()">🛡️ Panel de moderación</button>` : ''}
        <button class="auth-btn auth-btn-logout" style="margin-top:10px" onclick="doSignOut()">Cerrar sesión</button>
      </div>`;
  } else {
    const isNative = !!(window.Capacitor?.isNativePlatform?.());
    el.innerHTML = `
      <div class="auth-section">
        ${isNative
          ? `<button class="auth-btn auth-btn-google" onclick="signInWithGoogleRedirect()">
               <svg width="18" height="18" viewBox="0 0 18 18" style="vertical-align:middle;margin-right:8px;flex-shrink:0"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
               Continuar con Google
             </button>`
          : `<div id="googleBtnContainer" style="margin-bottom:8px;min-height:44px"></div>`
        }
        <div class="auth-note">💎 Tienes ${getDisplayGems()} gemas locales · Crea una cuenta para no perderlas</div>
      </div>`;
    if (!isNative) setTimeout(() => initGoogleSignIn('googleBtnContainer'), 100);
  }
}

function setAuthTab(tab) {
  _authTab = tab;
  renderAuthSection();
}

async function doAuth() {
  const email    = document.getElementById('authEmail')?.value.trim();
  const password = document.getElementById('authPassword')?.value;
  if (!email || !password) { toast('Introduce email y contraseña'); return; }
  const btn = document.querySelector('#authSection .auth-btn-primary');
  if (btn) { btn.textContent = '⏳ …'; btn.style.pointerEvents = 'none'; }
  try {
    if (_authTab === 'login') {
      await authSignIn(email, password);
      toast('Sesión iniciada ✓');
    } else {
      await authSignUp(email, password);
      toast('Cuenta creada · revisa tu email para confirmar');
    }
  } catch (e) {
    toast('Error: ' + e.message);
    if (btn) { btn.textContent = _authTab === 'login' ? 'Entrar' : 'Crear cuenta'; btn.style.pointerEvents = ''; }
  }
}

async function doSignOut() {
  // Conservar el saldo de Supabase como gemas locales → el contador no se reinicia a 50.
  // Si el usuario tenía 36 gemas en Supabase, tras cerrar sesión sigue viendo 36.
  const gemsToKeep = supabaseGems;

  // Limpiar estado local ANTES de llamar a Supabase → respuesta inmediata en UI.
  // onAuthStateChange(SIGNED_OUT) puede tardar o no disparar en Android.
  supabaseUser = null;
  supabaseGems = 0;
  if (gemsToKeep > 0) {
    localStorage.setItem('rp_gems_local', String(gemsToKeep));
  } else if (!localStorage.getItem('rp_gems_local')) {
    localStorage.setItem('rp_gems_local', '50');
  }
  renderUserHeader();
  loadProfileFields();
  toast('Sesión cerrada');
  try {
    await authSignOut();
  } catch (e) {
    console.warn('[doSignOut] signOut error (ya limpiado localmente):', e?.message);
  }
}

function saveProfile() {
  profile = {
    name:    document.getElementById('profileName').value.trim(),
    gender:  profile._tempGender || null,
    age:     document.getElementById('profileAge').value.trim(),
    height:  document.getElementById('profileHeight').value.trim(),
    desc:    document.getElementById('profileDesc').value.trim(),
    context: document.getElementById('profileContext').value.trim(),
    prefs:   document.getElementById('profilePrefs').value.trim()
  };
  localStorage.setItem('rp_profile', JSON.stringify(profile));
  toast('Perfil guardado ✓');
}
