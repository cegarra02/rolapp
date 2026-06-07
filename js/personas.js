// ── Personajes-jugador (player personas) ─────────────────────────────────────
// Modelo: el usuario puede tener varios "personajes-jugador" (alias con género,
// edad, estatura, descripción, contexto, preferencias y media 9:16). Uno está
// ACTIVO de forma global y se usa en todos los chats (vía getEffectiveProfile→profile).
// Al activar el toggle de "perfil personalizado" en un chat/escena, se eligen
// entre estas mismas tarjetas para usar otra persona solo en ese chat.

let playerPersonas = [];
let activePersonaId = null;
let editingPersonaId = null;
let _personaTempMedia = null;

function _loadPersonas() {
  try { playerPersonas = JSON.parse(localStorage.getItem('rp_personas') || '[]'); } catch (e) { playerPersonas = []; }
  try { activePersonaId = localStorage.getItem('rp_active_persona') || null; } catch (e) { activePersonaId = null; }
  // Migración: si no hay personas pero existe el perfil antiguo con datos, crear una.
  if (!playerPersonas.length) {
    const hasOld = profile && (profile.name || profile.desc || profile.context);
    playerPersonas = [{
      id: uid(),
      name:    (profile && profile.name)    || '',
      gender:  (profile && profile.gender)  || null,
      age:     (profile && profile.age)     || '',
      height:  (profile && profile.height)  || '',
      desc:    (profile && profile.desc)    || '',
      context: (profile && profile.context) || '',
      prefs:   (profile && profile.prefs)   || '',
      media:   (profile && profile.media)   || null,
    }];
    activePersonaId = playerPersonas[0].id;
    _savePersonas();
  }
  if (!playerPersonas.find(p => p.id === activePersonaId)) {
    activePersonaId = playerPersonas[0] ? playerPersonas[0].id : null;
  }
  _syncActiveProfile();
}

function _savePersonas() {
  try { localStorage.setItem('rp_personas', JSON.stringify(playerPersonas)); } catch (e) {}
  try { localStorage.setItem('rp_active_persona', activePersonaId || ''); } catch (e) {}
}

function getActivePersona() {
  return playerPersonas.find(p => p.id === activePersonaId) || playerPersonas[0] || null;
}

// Mantiene el `profile` global apuntando a la persona activa → el chat (getEffectiveProfile)
// usa la persona activa sin cambios. También persiste rp_profile y sincroniza con Supabase.
function _syncActiveProfile() {
  const a = getActivePersona();
  if (!a) return;
  profile = {
    name: a.name || '', gender: a.gender || null, age: a.age || '',
    height: a.height || '', desc: a.desc || '', context: a.context || '',
    prefs: a.prefs || '', media: a.media || null,
  };
  try { localStorage.setItem('rp_profile', JSON.stringify(profile)); } catch (e) {}
  if (typeof syncProfile === 'function' && typeof supabaseUser !== 'undefined' && supabaseUser) {
    try { syncProfile(); } catch (e) {}
  }
}

// ── Tarjeta de persona (reutilizada en perfil, grid y picker) ────────────────
function personaCardHtml(p, opts) {
  opts = opts || {};
  const media = p.media
    ? mediaLayerHtml(p.media, 'persona-card-bg')
    : `<div class="persona-card-ph">${esc((p.name || '?')[0] || '?')}</div>`;
  const meta = [p.gender === 'M' ? 'Masculino' : p.gender === 'F' ? 'Femenino' : '', p.age ? p.age + ' años' : '']
    .filter(Boolean).join(' · ');
  const active = (p.id === activePersonaId);
  return `<div class="persona-card${opts.selected ? ' selected' : ''}" ${opts.onclick ? `onclick="${opts.onclick}"` : ''}>
    ${media}
    <div class="persona-card-grad"></div>
    ${active && opts.badge ? `<div class="persona-card-active"><i data-icon="check" data-size="13"></i> Activo</div>` : ''}
    ${opts.edit ? `<div class="persona-card-edit" onclick="event.stopPropagation();openPersonaEdit('${p.id}')"><i data-icon="edit" data-size="15"></i></div>` : ''}
    ${opts.check ? `<div class="persona-card-check"><i data-icon="check" data-size="16"></i></div>` : ''}
    <div class="persona-card-body">
      <div class="persona-card-name">${esc(p.name || 'Sin nombre')}</div>
      ${meta ? `<div class="persona-card-meta">${esc(meta)}</div>` : ''}
    </div>
  </div>`;
}

// Tarjeta de la persona activa en Mi Perfil + botón "Mis personajes"
function renderProfilePersonaCard() {
  const el = document.getElementById('profilePersonaCard');
  if (!el) return;
  const a = getActivePersona();
  el.innerHTML = `
    <div class="section-label">Mi personaje</div>
    ${a ? personaCardHtml(a, { badge: true, onclick: `openPersonaEdit('${a.id}')` }) : ''}
    <button class="settings-row" style="margin-top:12px" onclick="openPersonas()">
      <span class="settings-row-ic"><i data-icon="users" data-size="18"></i></span>
      <span class="settings-row-label">Mis personajes</span>
      <span class="settings-row-value">${playerPersonas.length}</span>
      <span class="settings-row-chev"><i data-icon="chevronR" data-size="18"></i></span>
    </button>`;
  if (window.STORYM && STORYM.scanIcons) STORYM.scanIcons(el);
}

// ── Pantalla "Mis personajes" (grid) ─────────────────────────────────────────
function openPersonas() {
  showScreen('personasScreen', true);
  renderPersonasGrid();
}
function renderPersonasGrid() {
  const grid = document.getElementById('personasGrid');
  if (!grid) return;
  grid.innerHTML = playerPersonas.map(p =>
    personaCardHtml(p, { badge: true, edit: true, onclick: `selectPersona('${p.id}')` })
  ).join('') + `
    <div class="persona-card persona-card-new" onclick="openPersonaEdit(null)">
      <div class="persona-card-new-inner">
        <span class="persona-card-new-ic"><i data-icon="plus" data-size="26" data-stroke="2.4"></i></span>
        <span>Nuevo personaje</span>
      </div>
    </div>`;
  if (window.STORYM && STORYM.scanIcons) STORYM.scanIcons(grid);
}
function selectPersona(id) {
  if (!playerPersonas.find(p => p.id === id)) return;
  activePersonaId = id;
  _savePersonas();
  _syncActiveProfile();
  renderPersonasGrid();
  renderProfilePersonaCard();
  toast('Personaje activo cambiado ✓');
}

// ── Editar / crear persona ───────────────────────────────────────────────────
function openPersonaEdit(id) {
  editingPersonaId = id;
  const p = id ? playerPersonas.find(x => x.id === id) : null;
  document.getElementById('personaEditTitle').textContent = p ? 'Editar personaje' : 'Nuevo personaje';
  document.getElementById('personaDelBtn').style.display = (p && playerPersonas.length > 1) ? 'block' : 'none';
  _personaTempMedia = p ? (p.media || null) : null;
  setSlotImg('personaMediaSlot', _personaTempMedia, '🖼️');
  document.getElementById('personaName').value    = p ? (p.name || '')    : '';
  document.getElementById('personaAge').value     = p ? (p.age || '')     : '';
  document.getElementById('personaHeight').value  = p ? (p.height || '')  : '';
  document.getElementById('personaDesc').value    = p ? (p.desc || '')    : '';
  document.getElementById('personaContext').value = p ? (p.context || '') : '';
  document.getElementById('personaPrefs').value   = p ? (p.prefs || '')   : '';
  _personaTempGender = p ? (p.gender || null) : null;
  ['M','F'].forEach(x => document.getElementById('personaGender'+x)?.classList.toggle('active', _personaTempGender === x));
  showScreen('personaEditScreen', true);
}
let _personaTempGender = null;
function pickPersonaGender(g) {
  _personaTempGender = _personaTempGender === g ? null : g;
  ['M','F'].forEach(x => document.getElementById('personaGender'+x)?.classList.toggle('active', _personaTempGender === x));
}
function loadPersonaMedia(inp) {
  const file = inp.files[0]; if (!file) return;
  const isVid = file.type.startsWith('video');
  const reader = new FileReader();
  reader.onload = e => {
    if (isVid) { _personaTempMedia = e.target.result; setSlotImg('personaMediaSlot', _personaTempMedia, '🖼️'); }
    else openCropper(e.target.result, '9:16', 'Ajustar foto del personaje', result => {
      _personaTempMedia = result; setSlotImg('personaMediaSlot', _personaTempMedia, '🖼️');
    });
  };
  reader.readAsDataURL(file);
  inp.value = '';
}
function savePersona() {
  const name = document.getElementById('personaName').value.trim();
  if (!name) { toast('El personaje necesita un nombre'); return; }
  const data = {
    name,
    gender:  _personaTempGender || null,
    age:     document.getElementById('personaAge').value.trim(),
    height:  document.getElementById('personaHeight').value.trim(),
    desc:    document.getElementById('personaDesc').value.trim(),
    context: document.getElementById('personaContext').value.trim(),
    prefs:   document.getElementById('personaPrefs').value.trim(),
    media:   _personaTempMedia || null,
  };
  if (editingPersonaId) {
    const idx = playerPersonas.findIndex(p => p.id === editingPersonaId);
    if (idx > -1) playerPersonas[idx] = Object.assign({}, playerPersonas[idx], data);
  } else {
    const np = Object.assign({ id: uid() }, data);
    playerPersonas.push(np);
    activePersonaId = np.id; // un personaje nuevo pasa a ser el activo
  }
  _savePersonas();
  _syncActiveProfile();
  renderProfilePersonaCard();
  showScreen('profileScreen', true);
  toast('Personaje guardado ✓');
}
function deletePersona() {
  if (!editingPersonaId || playerPersonas.length <= 1) return;
  playerPersonas = playerPersonas.filter(p => p.id !== editingPersonaId);
  if (activePersonaId === editingPersonaId) activePersonaId = playerPersonas[0].id;
  _savePersonas();
  _syncActiveProfile();
  renderProfilePersonaCard();
  showScreen('personasScreen', true);
  renderPersonasGrid();
  toast('Personaje eliminado');
}

// ── Picker para el toggle de "perfil personalizado" en chat/escena ───────────
// Renderiza las tarjetas de persona; al elegir una, rellena los campos cp ocultos
// reutilizando la lógica de guardado existente (customProfile = {name,desc,context,prefs}).
function renderPersonaPicker(containerId, prefix, selectedName) {
  const c = document.getElementById(containerId);
  if (!c) return;
  // marca como seleccionada la persona cuyo nombre coincide con el cp guardado (o la activa)
  const selId = (function () {
    const byName = selectedName && playerPersonas.find(p => p.name === selectedName);
    return byName ? byName.id : activePersonaId;
  })();
  c.innerHTML = `<div class="persona-picker-grid">` + playerPersonas.map(p =>
    personaCardHtml(p, { check: true, selected: p.id === selId, onclick: `pickPersonaForCp('${prefix}','${p.id}')` })
  ).join('') + `</div>`;
  // rellena los campos ocultos con la persona seleccionada inicialmente
  pickPersonaForCp(prefix, selId, true);
  if (window.STORYM && STORYM.scanIcons) STORYM.scanIcons(c);
}
function pickPersonaForCp(prefix, id, silent) {
  const p = playerPersonas.find(x => x.id === id);
  if (!p) return;
  const set = (suffix, val) => { const e = document.getElementById(prefix + suffix); if (e) e.value = val || ''; };
  set('CpName', p.name); set('CpDesc', p.desc); set('CpContext', p.context); set('CpPrefs', p.prefs);
  if (!silent) {
    document.querySelectorAll('#' + prefix + 'CustomProfileFields .persona-card').forEach(el => el.classList.remove('selected'));
    const grid = document.getElementById(prefix + 'PersonaPicker');
    if (grid) {
      const cards = grid.querySelectorAll('.persona-card');
      const idx = playerPersonas.findIndex(x => x.id === id);
      if (cards[idx]) cards[idx].classList.add('selected');
    }
  }
}
