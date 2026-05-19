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
  document.getElementById('profileApiKey').value  = localStorage.getItem('rp_apikey') || '';
  document.getElementById('profileOrKey').value   = localStorage.getItem('rp_or_key') || '';
}

function toggleApiKeyVisibility() {
  const inp = document.getElementById('profileApiKey');
  const btn = document.getElementById('apiKeyToggle');
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁'; }
}

function toggleOrKeyVisibility() {
  const inp = document.getElementById('profileOrKey');
  const btn = document.getElementById('orKeyToggle');
  if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
  else { inp.type = 'password'; btn.textContent = '👁'; }
}

async function testOrKey() {
  const key = document.getElementById('profileOrKey').value.trim() || localStorage.getItem('rp_or_key') || '';
  if (!key) { toast('Introduce una API key de OpenRouter primero'); return; }
  const btn = document.getElementById('testOrKeyBtn');
  btn.textContent = '⏳ Probando...'; btn.style.pointerEvents = 'none';
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + key,
        'HTTP-Referer': 'https://cegarra02.github.io/rolapp/',
        'X-Title': 'Roleplay AI'
      },
      body: JSON.stringify({model: 'meta-llama/llama-3.3-70b-instruct:free', max_tokens: 10, messages: [{role: 'user', content: 'hi'}]})
    });
    if (res.ok) { btn.textContent = '✅ Conexión OK'; btn.style.color = '#4ade80'; }
    else { const d = await res.json(); btn.textContent = '❌ Error: ' + (d.error?.message || res.status); btn.style.color = 'var(--danger)'; }
  } catch (e) {
    btn.textContent = '❌ ' + e.message; btn.style.color = 'var(--danger)';
  }
  btn.style.pointerEvents = '';
  setTimeout(() => { btn.textContent = '🔌 Probar conexión'; btn.style.color = ''; }, 4000);
}



async function testApiKey() {
  const key = document.getElementById('profileApiKey').value.trim() || localStorage.getItem('rp_apikey') || '';
  if (!key) { toast('Introduce una API key primero'); return; }
  const btn = document.getElementById('testKeyBtn');
  btn.textContent = '⏳ Probando...'; btn.style.pointerEvents = 'none';
  try {
    const res = await fetch('https://misty-heart-cd26.alex1234567890ct.workers.dev', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01'},
      body: JSON.stringify({model: 'claude-sonnet-4-6', max_tokens: 10, messages: [{role: 'user', content: 'hi'}]})
    });
    if (res.ok) { btn.textContent = '✅ Conexión OK'; btn.style.color = '#4ade80'; }
    else { const d = await res.json(); btn.textContent = '❌ Error: ' + (d.error?.message || res.status); btn.style.color = 'var(--danger)'; }
  } catch (e) {
    btn.textContent = '❌ ' + e.message; btn.style.color = 'var(--danger)';
  }
  btn.style.pointerEvents = '';
  setTimeout(() => { btn.textContent = '🔌 Probar conexión'; btn.style.color = ''; }, 4000);
}

function saveProfile() {
  const apiKey = document.getElementById('profileApiKey').value.trim();
  if (apiKey) localStorage.setItem('rp_apikey', apiKey);
  const orKey = document.getElementById('profileOrKey').value.trim();
  if (orKey) localStorage.setItem('rp_or_key', orKey);
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
