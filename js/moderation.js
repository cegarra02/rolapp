const ADMIN_EMAILS = ['alex1234567890ct@gmail.com'];

function isAdmin() {
  return !!(supabaseUser && ADMIN_EMAILS.includes(supabaseUser.email));
}

async function openModeration() {
  showScreen('moderationScreen', true);
  await renderModeration();
}

function showMod() {
  showScreen('moderationScreen', true);
}

// ── Dar gemas a uno mismo ─────────────────────────────────────────────────────
async function giveGemsToSelf() {
  if (!supabaseUser) return;
  const inp = document.getElementById('modSelfGemsInp');
  const amount = parseInt(inp?.value || '0');
  if (!amount || amount <= 0) { toast('Introduce una cantidad válida'); return; }
  const btn = inp?.nextElementSibling;
  if (btn) { btn.textContent = '⏳'; btn.style.pointerEvents = 'none'; }
  try {
    await addGems(supabaseUser.id, amount);
    await refreshGems();
    if (inp) inp.value = '';
    toast(`💎 +${amount} gemas añadidas`);
  } catch (e) {
    toast('Error: ' + (e?.message || 'fallo al añadir gemas'));
  } finally {
    if (btn) { btn.textContent = '+ Añadir'; btn.style.pointerEvents = ''; }
  }
}

// ── Cache local de submissions ────────────────────────────────────────────────
let _modSubs = [];
let _modTempBg = null;

function loadModBg(inp) {
  const file = inp.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    openCropper(e.target.result, 'free', 'Ajustar fondo', result => {
      _modTempBg = result;
      const el = document.getElementById('modBgPreview');
      if (el) { el.style.backgroundImage = `url(${result})`; el.style.backgroundSize = 'cover'; }
    });
  };
  reader.readAsDataURL(file);
  inp.value = '';
}

// ── Lista de submissions (grid 2 columnas) ────────────────────────────────────
async function renderModeration() {
  const list = document.getElementById('modList');
  await refreshGems();
  const gemsEl = document.getElementById('modMyGems');
  if (gemsEl) gemsEl.textContent = getDisplayGems();
  list.innerHTML = '<div style="grid-column:span 2;text-align:center;padding:40px;color:var(--muted)">Cargando submissions…</div>';

  const { data, error } = await supaClient
    .from('submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  _modSubs = data || [];

  if (error) {
    list.innerHTML = `<div style="grid-column:span 2;padding:20px;color:var(--danger)">Error: ${esc(error.message)}</div>`;
    return;
  }

  if (!data?.length) {
    list.innerHTML = '<div class="empty-state" style="grid-column:span 2"><div class="icon">✓</div><p>Sin submissions pendientes</p></div>';
    return;
  }

  list.innerHTML = data.map(s => `
    <div class="char-card" onclick="openSubmissionDetail('${s.id}')">
      ${s.bg
        ? `<div class="char-card-bg" style="background-image:url('${s.bg}')"></div>`
        : `<div class="char-card-bg-placeholder">${esc((s.name || '?')[0])}</div>`
      }
      <div class="char-card-body">
        <div class="char-card-name">${esc(s.name)}</div>
        <div>${(s.tags?.length ? s.tags : (s.tag ? [s.tag] : [])).map(t => tagBadgeHtml(t)).join('')}</div>
      </div>
    </div>
  `).join('');
}

// ── Pantalla de detalle / edición ─────────────────────────────────────────────
let _modEditGender = null;

function openSubmissionDetail(subId) {
  const s = _modSubs.find(x => x.id === subId);
  if (!s) return;
  _modTempBg = null;
  _renderSubmissionDetail(s);
  showScreen('modDetailScreen', true);
}

function _renderSubmissionDetail(s) {
  const nameEl = document.getElementById('modDetailName');
  if (nameEl) nameEl.textContent = s.name;
  _modEditGender = s.gender || null;

  const gM = _modEditGender === 'M' ? ' active' : '';
  const gF = _modEditGender === 'F' ? ' active' : '';

  const body = document.getElementById('modDetailBody');
  if (!body) return;

  // Renderizar primero, luego inicializar gradientes
  body.innerHTML = `<div id="modBgPreview" onclick="triggerFile('modBgFile')" style="width:100%;height:220px;background-size:cover;background-position:center top;background-color:var(--surface2);cursor:pointer;position:relative;flex-shrink:0;${s.bg ? `background-image:url('${s.bg}')` : ''}">
      <div style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);border-radius:10px;padding:4px 10px;color:#fff;font-size:12px">✎ Cambiar foto</div>
    </div>
    <div class="mod-detail-form">

      <div class="field-label">Nombre</div>
      <input class="edit-inp" id="modEditName" value="${esc(s.name)}">

      <div class="field-label">Etiquetas (separadas por coma)</div>
      <input class="edit-inp" id="modEditTag" value="${esc((s.tags?.length ? s.tags : (s.tag ? [s.tag] : [])).join(', '))}">

      <div class="field-label">Género</div>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <button class="gender-btn${gM}" id="modEditGenderM" onclick="modPickGender('M')">♂ Hombre</button>
        <button class="gender-btn${gF}" id="modEditGenderF" onclick="modPickGender('F')">♀ Mujer</button>
      </div>

      <div class="field-label">Edad</div>
      <input class="edit-inp" id="modEditAge" value="${esc(s.age || '')}">

      <div class="field-label">Descripción</div>
      <textarea class="edit-inp edit-ta" id="modEditDesc" rows="3">${esc(s.desc || '')}</textarea>

      <div class="field-label">Contexto / Personalidad</div>
      <textarea class="edit-inp edit-ta" id="modEditContext" rows="5">${esc(s.context || '')}</textarea>

      <div class="field-label">Saludo inicial</div>
      <textarea class="edit-inp edit-ta" id="modEditGreeting" rows="3">${esc(s.greeting || '')}</textarea>

      <div class="slider-block">
        <div class="slider-title"><span>😶</span> Timidez</div>
        <div class="slider-row">
          <input type="range" class="pers-slider" id="modSlTimid" min="1" max="10" value="${s.timid ?? 5}" oninput="updateSlider(this,'modValTimid')">
          <div class="slider-val" id="modValTimid">${s.timid ?? 5}</div>
        </div>
        <div class="slider-labels"><span class="slider-label">Muy tímido</span><span class="slider-label right">Muy seguro</span></div>
      </div>
      <div class="slider-block">
        <div class="slider-title"><span>❤️</span> Apertura romántica</div>
        <div class="slider-row">
          <input type="range" class="pers-slider" id="modSlRomantic" min="1" max="10" value="${s.romantic ?? 5}" oninput="updateSlider(this,'modValRomantic')">
          <div class="slider-val" id="modValRomantic">${s.romantic ?? 5}</div>
        </div>
        <div class="slider-labels"><span class="slider-label">Muy cerrado</span><span class="slider-label right">Muy abierto</span></div>
      </div>
      <div class="slider-block">
        <div class="slider-title"><span>🔥</span> Ritmo de escalada</div>
        <div class="slider-row">
          <input type="range" class="pers-slider" id="modSlPace" min="1" max="10" value="${s.pace ?? 4}" oninput="updateSlider(this,'modValPace')">
          <div class="slider-val" id="modValPace">${s.pace ?? 4}</div>
        </div>
        <div class="slider-labels"><span class="slider-label">Muy lento</span><span class="slider-label right">Muy rápido</span></div>
      </div>
      <div class="slider-block" style="margin-bottom:14px">
        <div class="slider-title"><span>🌶️</span> Nivel NSFW máximo</div>
        <div class="slider-row">
          <input type="range" class="pers-slider" id="modSlNsfw" min="1" max="10" value="${s.nsfw ?? 7}" oninput="updateSlider(this,'modValNsfw')">
          <div class="slider-val" id="modValNsfw">${s.nsfw ?? 7}</div>
        </div>
        <div class="slider-labels"><span class="slider-label">Solo insinuaciones</span><span class="slider-label right">Explícito total</span></div>
      </div>
      <div class="mod-card-meta">Autor ID: ${esc(s.author_id || '—')}</div>

      <button class="save-btn" style="margin-top:16px;width:100%" onclick="_saveSubmissionEdit('${s.id}')">💾 Guardar cambios</button>

      <hr class="mod-sep">

      <button class="mod-test-btn" onclick="testSubmissionChat('${s.id}')">▶ Probar personaje</button>

      <div class="mod-gems-row" style="margin-top:14px">
        <label style="font-size:13px;color:var(--muted);flex:1">💎 Gemas al autor al aprobar:</label>
        <input type="number" class="mod-gems-inp" id="modEditGems" value="0" min="0" max="9999">
      </div>
      <div class="mod-actions" style="margin-top:10px">
        <button class="mod-btn-approve" onclick="_confirmApprove('${s.id}','${s.author_id || ''}')">✓ Aprobar</button>
        <button class="mod-btn-reject"  onclick="_confirmReject('${s.id}')">✕ Rechazar</button>
      </div>
      <button class="mod-btn-delete" onclick="_confirmDeleteSub('${s.id}')">🗑 Eliminar permanentemente</button>
    </div>
  `;
  // Inicializar gradientes de sliders tras inyectar el HTML
  [['modSlTimid','modValTimid'],['modSlRomantic','modValRomantic'],['modSlPace','modValPace'],['modSlNsfw','modValNsfw']].forEach(([sid, vid]) => {
    const el = document.getElementById(sid); if (el) updateSlider(el, vid);
  });
}

function modPickGender(g) {
  _modEditGender = _modEditGender === g ? null : g;
  ['M', 'F'].forEach(x => document.getElementById('modEditGender' + x)?.classList.toggle('active', _modEditGender === x));
}

// ── Guardar edición ───────────────────────────────────────────────────────────
async function _saveSubmissionEdit(subId) {
  const name = document.getElementById('modEditName')?.value.trim();
  if (!name) { toast('Nombre obligatorio'); return; }
  const rawTags = (document.getElementById('modEditTag')?.value || '').split(',').map(t => t.trim()).filter(Boolean);
  const updates = {
    name,
    tags:     rawTags.length ? rawTags : null,
    tag:      rawTags[0] || null,
    gender:   _modEditGender                                            || null,
    age:      document.getElementById('modEditAge')?.value.trim()      || null,
    desc:     document.getElementById('modEditDesc')?.value.trim()     || null,
    context:  document.getElementById('modEditContext')?.value.trim()  || null,
    greeting: document.getElementById('modEditGreeting')?.value.trim() || null,
    timid:    parseInt(document.getElementById('modSlTimid')?.value)   || 5,
    romantic: parseInt(document.getElementById('modSlRomantic')?.value)|| 5,
    pace:     parseInt(document.getElementById('modSlPace')?.value)    || 4,
    nsfw:     parseInt(document.getElementById('modSlNsfw')?.value)    || 7,
  };
  if (_modTempBg) updates.bg = _modTempBg;
  const { error } = await supaClient.from('submissions').update(updates).eq('id', subId);
  if (error) { toast('Error: ' + error.message); return; }
  const idx = _modSubs.findIndex(x => x.id === subId);
  if (idx > -1) _modSubs[idx] = { ..._modSubs[idx], ...updates };
  document.getElementById('modDetailName').textContent = name;
  toast('Guardado ✓');
}

// ── Probar en chat ────────────────────────────────────────────────────────────
function testSubmissionChat(subId) {
  const s = _modSubs.find(x => x.id === subId);
  if (!s) return;
  const ch = {
    id:           'sub_' + subId,
    name:         document.getElementById('modEditName')?.value.trim()     || s.name,
    tag:          s.tag,
    gender:       _modEditGender ?? s.gender,
    age:          document.getElementById('modEditAge')?.value.trim()      || s.age,
    desc:         document.getElementById('modEditDesc')?.value.trim()     || s.desc,
    context:      document.getElementById('modEditContext')?.value.trim()  || s.context,
    greeting:     document.getElementById('modEditGreeting')?.value.trim() || s.greeting,
    bg:           s.bg,
    timid:        s.timid    ?? 5,
    romantic:     s.romantic ?? 5,
    pace:         s.pace     ?? 4,
    nsfw:         s.nsfw     ?? 7,
    hitos:        [],
    hitosEnabled: false,
    history:      [],
    isLibraryChar: true
  };
  currentChar  = ch;
  currentScene = null;
  history      = [];
  document.getElementById('chatName').textContent = ch.name;
  document.getElementById('chatMeta').textContent = ch.age ? ch.age + ' años' : '';
  const bg = document.getElementById('chatBg');
  if (ch.bg) { bg.style.backgroundImage = `url(${ch.bg})`; bg.style.display = 'block'; }
  else bg.style.display = 'none';
  renderMessages();
  isSwiped = false;
  document.getElementById('chatContentWrap').classList.remove('swiped');
  document.getElementById('swipeHint').style.display = '';
  showScreen('chat', true);
  if (ch.greeting) {
    history.push({ role: 'assistant', content: ch.greeting, ts: Date.now() });
    renderMessages();
  }
  setTimeout(() => { const m = document.getElementById('messages'); m.scrollTop = m.scrollHeight; }, 50);
}

// ── Aprobar (con confirmación) ────────────────────────────────────────────────
function _confirmApprove(subId, authorId) {
  const gems = parseInt(document.getElementById('modEditGems')?.value || '0') || 0;
  const gemsTxt = gems > 0 ? ` y enviar ${gems} 💎 al autor` : '';
  openModal('Aprobar personaje', [
    { label: `✓ Sí, aprobar${gemsTxt}`, action: `_doApprove('${subId}','${authorId}')` },
    { label: 'Cancelar', action: 'closeModal()' }
  ]);
}

async function _doApprove(subId, authorId) {
  closeModal();
  const s = _modSubs.find(x => x.id === subId);
  if (!s) { toast('Submission no encontrada'); return; }

  const name     = document.getElementById('modEditName')?.value.trim()     || s.name;
  const rawTags  = (document.getElementById('modEditTag')?.value || '').split(',').map(t => t.trim()).filter(Boolean);
  const tag      = rawTags[0] || null;
  const tags     = rawTags.length ? rawTags : null;
  const gender   = _modEditGender ?? s.gender;
  const age      = document.getElementById('modEditAge')?.value.trim()      || null;
  const desc     = document.getElementById('modEditDesc')?.value.trim()     || null;
  const context  = document.getElementById('modEditContext')?.value.trim()  || null;
  const greeting = document.getElementById('modEditGreeting')?.value.trim() || null;
  const gems     = parseInt(document.getElementById('modEditGems')?.value || '0') || 0;

  const timid    = parseInt(document.getElementById('modSlTimid')?.value)    || s.timid    || 5;
  const romantic = parseInt(document.getElementById('modSlRomantic')?.value) || s.romantic || 5;
  const pace     = parseInt(document.getElementById('modSlPace')?.value)     || s.pace     || 4;
  const nsfw     = parseInt(document.getElementById('modSlNsfw')?.value)     || s.nsfw     || 7;

  const { error: insertErr } = await supaClient.from('characters_library').insert({
    name, tag, tags, gender, age, desc, context, greeting,
    bg: _modTempBg || s.bg, timid, romantic, pace, nsfw,
    author_id: s.author_id, status: 'approved', chat_count: 0
  });
  if (insertErr) { toast('Error al insertar: ' + insertErr.message); return; }

  await supaClient.from('submissions').update({ status: 'approved' }).eq('id', subId);
  if (gems > 0 && authorId) await addGems(authorId, gems);

  toast('Aprobado ✓' + (gems > 0 ? ` · ${gems} 💎 al autor` : ''));
  _modSubs = _modSubs.filter(x => x.id !== subId);
  showMod();
  await renderModeration();
}

// ── Rechazar (con confirmación) ───────────────────────────────────────────────
function _confirmReject(subId) {
  openModal('Rechazar submission', [
    { label: '✕ Sí, rechazar', action: `_doReject('${subId}')`, danger: true },
    { label: 'Cancelar', action: 'closeModal()' }
  ]);
}

async function _doReject(subId) {
  closeModal();
  await supaClient.from('submissions').update({ status: 'rejected' }).eq('id', subId);
  toast('Rechazado');
  _modSubs = _modSubs.filter(x => x.id !== subId);
  showMod();
  await renderModeration();
}

// ── Eliminar submission (con confirmación) ────────────────────────────────────
function _confirmDeleteSub(subId) {
  openModal('Eliminar permanentemente', [
    { label: '🗑 Sí, eliminar', action: `_doDeleteSub('${subId}')`, danger: true },
    { label: 'Cancelar', action: 'closeModal()' }
  ]);
}

async function _doDeleteSub(subId) {
  closeModal();
  const { error } = await supaClient.from('submissions').delete().eq('id', subId);
  if (error) { toast('Error: ' + error.message); return; }
  toast('Eliminado');
  _modSubs = _modSubs.filter(x => x.id !== subId);
  showMod();
  await renderModeration();
}
