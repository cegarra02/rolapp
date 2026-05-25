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

// ── Lista de submissions (grid 2 columnas) ────────────────────────────────────
async function renderModeration() {
  const list = document.getElementById('modList');
  await refreshGems();
  const gemsEl = document.getElementById('modMyGems');
  if (gemsEl) gemsEl.textContent = getDisplayGems();
  list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Cargando submissions…</div>';

  const { data, error } = await supaClient
    .from('submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  _modSubs = data || [];

  if (error) {
    list.innerHTML = `<div style="padding:20px;color:var(--danger)">Error: ${esc(error.message)}</div>`;
    return;
  }

  if (!data?.length) {
    list.innerHTML = '<div class="empty-state"><div class="icon">✓</div><p>Sin submissions pendientes</p></div>';
    return;
  }

  list.innerHTML = data.map(s => `
    <div class="char-card" onclick="openSubmissionDetail('${s.id}')">
      ${s.bg
        ? `<div class="char-card-bg" style="background-image:url('${s.bg}')"></div>`
        : `<div class="char-card-bg-placeholder">${esc(s.name?.[0] || '?')}</div>`
      }
      <div class="char-card-body">
        <div class="char-card-name">${esc(s.name)}</div>
        ${s.tag ? `<span class="char-card-tag">${esc(s.tag)}</span>` : ''}
      </div>
    </div>
  `).join('');
}

// ── Pantalla de detalle / edición de una submission ───────────────────────────
let _modEditGender = null;

function openSubmissionDetail(subId) {
  const s = _modSubs.find(x => x.id === subId);
  if (!s) return;
  _renderSubmissionDetail(s);
  showScreen('modDetailScreen', true);
}

function _renderSubmissionDetail(s) {
  document.getElementById('modDetailName').textContent = s.name;
  _modEditGender = s.gender || null;

  const gM = _modEditGender === 'M' ? ' active' : '';
  const gF = _modEditGender === 'F' ? ' active' : '';

  document.getElementById('modDetailBody').innerHTML = `
    ${s.bg ? `<div class="mod-detail-bg" style="background-image:url('${s.bg}')"></div>` : ''}
    <div class="mod-detail-form">

      <div class="field-label">Nombre</div>
      <input class="edit-inp" id="modEditName" value="${esc(s.name)}">

      <div class="field-label">Tag / Categoría</div>
      <input class="edit-inp" id="modEditTag" value="${esc(s.tag || '')}">

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

      <div class="mod-card-sliders" style="margin:10px 0 4px">
        Timidez: ${s.timid} · Romance: ${s.romantic} · Ritmo: ${s.pace} · NSFW: ${s.nsfw}
      </div>
      <div class="mod-card-meta">Autor ID: ${esc(s.author_id || '—')}</div>

      <button class="save-btn" style="margin-top:16px" onclick="_saveSubmissionEdit('${s.id}')">💾 Guardar cambios</button>

      <div class="mod-sep"></div>

      <button class="mod-test-btn" onclick="testSubmissionChat('${s.id}')">▶ Probar personaje</button>

      <div class="mod-gems-row" style="margin-top:14px">
        <label style="font-size:13px;color:var(--muted);flex:1">💎 Gemas al autor al aprobar:</label>
        <input type="number" class="mod-gems-inp" id="modEditGems" value="0" min="0" max="9999">
      </div>
      <div class="mod-actions" style="margin-top:10px">
        <button class="mod-btn-approve" onclick="_approveFromDetail('${s.id}','${s.author_id || ''}')">✓ Aprobar</button>
        <button class="mod-btn-reject"  onclick="_rejectFromDetail('${s.id}')">✕ Rechazar</button>
      </div>
      <button class="mod-btn-delete" onclick="_deleteSubmission('${s.id}')">🗑 Eliminar permanentemente</button>
    </div>
  `;
}

function modPickGender(g) {
  _modEditGender = _modEditGender === g ? null : g;
  ['M', 'F'].forEach(x => document.getElementById('modEditGender' + x)?.classList.toggle('active', _modEditGender === x));
}

// ── Guardar edición ───────────────────────────────────────────────────────────
async function _saveSubmissionEdit(subId) {
  const name = document.getElementById('modEditName')?.value.trim();
  if (!name) { toast('Nombre obligatorio'); return; }
  const updates = {
    name,
    tag:      document.getElementById('modEditTag')?.value.trim()     || null,
    gender:   _modEditGender || null,
    age:      document.getElementById('modEditAge')?.value.trim()     || null,
    desc:     document.getElementById('modEditDesc')?.value.trim()    || null,
    context:  document.getElementById('modEditContext')?.value.trim() || null,
    greeting: document.getElementById('modEditGreeting')?.value.trim() || null,
  };
  const { error } = await supaClient.from('submissions').update(updates).eq('id', subId);
  if (error) { toast('Error: ' + error.message); return; }
  // Actualizar caché local
  const idx = _modSubs.findIndex(x => x.id === subId);
  if (idx > -1) _modSubs[idx] = { ..._modSubs[idx], ...updates };
  document.getElementById('modDetailName').textContent = name;
  toast('Guardado ✓');
}

// ── Probar en chat ────────────────────────────────────────────────────────────
function testSubmissionChat(subId) {
  const s = _modSubs.find(x => x.id === subId);
  if (!s) return;
  // Usar los valores actuales del formulario si están disponibles
  const name     = document.getElementById('modEditName')?.value.trim()     || s.name;
  const age      = document.getElementById('modEditAge')?.value.trim()      || s.age;
  const desc     = document.getElementById('modEditDesc')?.value.trim()     || s.desc;
  const context  = document.getElementById('modEditContext')?.value.trim()  || s.context;
  const greeting = document.getElementById('modEditGreeting')?.value.trim() || s.greeting;

  const ch = {
    id:           'sub_' + subId,
    name,
    tag:          s.tag,
    gender:       _modEditGender ?? s.gender,
    age,
    desc,
    context,
    greeting,
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

// ── Aprobar ───────────────────────────────────────────────────────────────────
async function _approveFromDetail(subId, authorId) {
  const s = _modSubs.find(x => x.id === subId);
  if (!s) { toast('Submission no encontrada'); return; }

  // Tomar valores actuales del formulario (ya editados)
  const name     = document.getElementById('modEditName')?.value.trim()     || s.name;
  const tag      = document.getElementById('modEditTag')?.value.trim()      || null;
  const gender   = _modEditGender ?? s.gender;
  const age      = document.getElementById('modEditAge')?.value.trim()      || null;
  const desc     = document.getElementById('modEditDesc')?.value.trim()     || null;
  const context  = document.getElementById('modEditContext')?.value.trim()  || null;
  const greeting = document.getElementById('modEditGreeting')?.value.trim() || null;
  const gems     = parseInt(document.getElementById('modEditGems')?.value || '0') || 0;

  const { error: insertErr } = await supaClient.from('characters_library').insert({
    name, tag, gender, age, desc, context, greeting,
    bg:        s.bg,
    timid:     s.timid,
    romantic:  s.romantic,
    pace:      s.pace,
    nsfw:      s.nsfw,
    author_id: s.author_id,
    status:    'approved',
    chat_count: 0
  });
  if (insertErr) { toast('Error al insertar: ' + insertErr.message); return; }

  await supaClient.from('submissions').update({ status: 'approved' }).eq('id', subId);
  if (gems > 0 && authorId) await addGems(authorId, gems);

  toast('Aprobado ✓' + (gems > 0 ? ` · ${gems} gemas al autor` : ''));
  _modSubs = _modSubs.filter(x => x.id !== subId);
  showMod();
  await renderModeration();
}

// ── Rechazar ──────────────────────────────────────────────────────────────────
async function _rejectFromDetail(subId) {
  await supaClient.from('submissions').update({ status: 'rejected' }).eq('id', subId);
  toast('Rechazado');
  _modSubs = _modSubs.filter(x => x.id !== subId);
  showMod();
  await renderModeration();
}

// ── Eliminar (hard delete) ────────────────────────────────────────────────────
function _deleteSubmission(subId) {
  openModal('Eliminar submission', [
    { label: '🗑 Sí, eliminar', action: `_confirmDeleteSub('${subId}')`, danger: true },
    { label: 'Cancelar', action: 'closeModal()' }
  ]);
}

async function _confirmDeleteSub(subId) {
  closeModal();
  const { error } = await supaClient.from('submissions').delete().eq('id', subId);
  if (error) { toast('Error: ' + error.message); return; }
  toast('Eliminado');
  _modSubs = _modSubs.filter(x => x.id !== subId);
  showMod();
  await renderModeration();
}
