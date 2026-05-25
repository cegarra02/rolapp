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
    el.innerHTML = `
      <div class="auth-section">
        <div class="auth-tab-row">
          <button class="auth-tab${_authTab === 'login' ? ' active' : ''}" onclick="setAuthTab('login')">Iniciar sesión</button>
          <button class="auth-tab${_authTab === 'register' ? ' active' : ''}" onclick="setAuthTab('register')">Registrarse</button>
        </div>
        <input class="auth-field" id="authEmail" type="email" placeholder="Email" autocomplete="email">
        <input class="auth-field" id="authPassword" type="password" placeholder="Contraseña" autocomplete="${_authTab === 'login' ? 'current-password' : 'new-password'}">
        <button class="auth-btn auth-btn-primary" onclick="doAuth()">
          ${_authTab === 'login' ? 'Entrar' : 'Crear cuenta'}
        </button>
        <div id="googleBtnContainer" style="margin-bottom:8px;min-height:44px"></div>
        <div class="auth-note">💎 Tienes ${getDisplayGems()} gemas locales · Crea una cuenta para no perderlas</div>
      </div>`;
    setTimeout(() => initGoogleSignIn('googleBtnContainer'), 100);
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
  await authSignOut();
  toast('Sesión cerrada');
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
