let exploreChars = [];
let exploreTags  = [];
let exploreSearch = '';
let exploreActiveTags = [];
let exploreSort  = 'new';
let exploreGender = '';
let _exploreFiltersOpen = false;

async function renderExploreScreen() {
  renderExploreLoading();
  const [charsOk] = await Promise.all([fetchExploreChars(), fetchExploreTags()]);
  // Solo renderizar la lista si la carga fue exitosa.
  // Si fetchExploreChars falló, ya puso el HTML de error en #exploreList — no sobreescribir.
  if (charsOk !== false) renderExploreList();
  renderExploreTags();
}

function renderExploreLoading() {
  const list = document.getElementById('exploreList');
  if (list) list.innerHTML = '<div class="explore-loading">Cargando…</div>';
}

async function fetchExploreChars() {
  // Guardar conteos locales optimistas antes de sobreescribir con datos frescos de DB
  const _localCounts = {};
  exploreChars.forEach(c => { if (c.message_count) _localCounts[c.id] = c.message_count; });

  // Construye la consulta (se rehace en cada reintento)
  const buildQuery = () => {
    let q = supaClient
      .from('characters_library')
      .select('id, name, tag, tags, bg, chat_count, message_count, created_at')
      .eq('status', 'approved');
    if (exploreSearch) q = q.ilike('name', `%${exploreSearch}%`);
    if (exploreActiveTags.length) {
      const orParts = [
        ...exploreActiveTags.map(t => `tag.eq.${t}`),
        `tags.ov.{${exploreActiveTags.join(',')}}`
      ].join(',');
      q = q.or(orParts);
    }
    if (exploreGender) q = q.eq('gender', exploreGender);
    q = exploreSort === 'popular'
      ? q.order('message_count', { ascending: false })
      : q.order('created_at', { ascending: false });
    return q.limit(50);
  };

  // Reintentos a nivel de Explorar (encima de _fetchWithRetry) para absorber la
  // flakiness de red (ERR_QUIC_PROTOCOL_ERROR) que dejaba la lista vacía a menudo.
  let data = null, error = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await buildQuery();
    data = res.data; error = res.error;
    if (!error) break;                 // éxito → salir
    console.warn('explore fetch intento', attempt + 1, error.message);
    if (attempt < 3) await new Promise(r => setTimeout(r, 400 * (attempt + 1))); // 0.4s, 0.8s, 1.2s
  }

  if (error) {
    console.error('explore fetch (tras reintentos):', error);
    const list = document.getElementById('exploreList');
    if (list) list.innerHTML = `
      <div class="empty-state" style="grid-column:span 2">
        <div class="icon">⚠️</div>
        <p>Error al cargar. Comprueba tu conexión.</p>
        <button class="save-btn" style="margin-top:12px;width:auto;padding:10px 24px" onclick="renderExploreScreen()">🔄 Reintentar</button>
      </div>`;
    return false; // señal de error para renderExploreScreen
  }
  // Usar el mayor entre DB y local (preserva incrementos optimistas si DB aún no los tiene)
  exploreChars = (data || []).map(c => ({
    ...c,
    message_count: Math.max(c.message_count || 0, _localCounts[c.id] || 0),
  }));
  return true;
}

async function fetchExploreTags() {
  const { data } = await supaClient
    .from('characters_library')
    .select('tags, tag')
    .eq('status', 'approved');
  if (!data) return;
  const counts = {};
  data.forEach(r => {
    const tags = r.tags?.length ? r.tags : (r.tag ? [r.tag] : []);
    tags.forEach(t => { counts[t] = (counts[t] || 0) + 1; });
  });
  exploreTags = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
}

function renderExploreTags() {
  const el = document.getElementById('exploreTagsRow');
  if (!el) return;
  const q = (document.getElementById('expTagSearch')?.value || '').toLowerCase();
  const list = exploreTags.filter(t => t.toLowerCase().includes(q));
  el.innerHTML =
    `<span class="explore-tag-chip exp-tag-todos${!exploreActiveTags.length ? ' active' : ''}" onclick="setExploreTag('')">Todos</span>` +
    list.map(t => exploreTagChipHtml(t, exploreActiveTags.includes(t))).join('') +
    (list.length ? '' : '<div class="exp-tag-empty">Sin etiquetas</div>');
  const lbl = document.getElementById('expTagsLabel');
  if (lbl) lbl.textContent = exploreActiveTags.length ? `Etiquetas (${exploreActiveTags.length})` : 'Etiquetas';
  document.getElementById('expTagsBtn')?.classList.toggle('has-sel', exploreActiveTags.length > 0);
}

function renderExploreList() {
  const list = document.getElementById('exploreList');
  if (!list) return;
  if (!exploreChars.length) {
    list.innerHTML = `<div class="empty-state" style="grid-column:span 2"><div class="icon">🔍</div><p>Aún no hay personajes en la biblioteca</p></div>`;
    return;
  }
  const admin = isAdmin();
  list.innerHTML = exploreChars.map(x => {
    const tags = x.tags || (x.tag ? [x.tag] : []);
    const stat = _fmtStat(x.message_count) || '0';
    return `
    <div class="char-card" onclick="openExploreChat('${x.id}')">
      ${x.bg
        ? `<div class="char-card-bg" style="background-image:url('${x.bg}')"></div>`
        : `<div class="char-card-bg-placeholder">${esc((x.name || '?')[0])}</div>`}
      <div class="char-card-stat stat-right"><i data-icon="flame" data-size="12"></i> ${stat}</div>
      <div class="char-card-body">
        <div class="char-card-name">${esc(x.name)}</div>
        ${tagsMiniHtml(tags)}
      </div>
      ${admin ? `<div class="char-card-edit edit-left" onclick="event.stopPropagation();openLibDetail('${x.id}')">✎</div>` : ''}
    </div>`;
  }).join('');
}

function showExplore() {
  showScreen('exploreScreen', false);
  setActiveTab('explore');
  // Re-render desde datos locales (ya actualizados por chat.js) sin hacer fetch
  if (exploreChars.length) renderExploreList();
}

function setExploreTag(tag) {
  if (!tag) {
    exploreActiveTags = [];
  } else {
    const idx = exploreActiveTags.indexOf(tag);
    if (idx > -1) exploreActiveTags.splice(idx, 1);
    else exploreActiveTags.push(tag);
  }
  renderExploreScreen();
}

function setExploreSort(val) {
  exploreSort = val;
  const lbl = document.getElementById('expSortLabel');
  if (lbl) lbl.textContent = val === 'popular' ? 'Populares' : 'Nuevos';
  document.querySelectorAll('#expSortPanel .exp-dd-item').forEach(b => b.classList.toggle('active', b.dataset.sort === val));
  closeExpDropdowns();
  renderExploreScreen();
}

// Toggle de sexo: vuelve a pulsar el activo para deseleccionar (= Todos)
function setExploreGender(g) {
  exploreGender = (exploreGender === g) ? '' : g;
  document.getElementById('egender-M')?.classList.toggle('active', exploreGender === 'M');
  document.getElementById('egender-F')?.classList.toggle('active', exploreGender === 'F');
  renderExploreScreen();
}

// Desplegables compactos (Ordenar / Etiquetas)
function toggleExpDropdown(which) {
  const sortP = document.getElementById('expSortPanel'), tagsP = document.getElementById('expTagsPanel');
  const sortB = document.getElementById('expSortBtn'),   tagsB = document.getElementById('expTagsBtn');
  const openSort = which === 'sort' && !sortP.classList.contains('open');
  const openTags = which === 'tags' && !tagsP.classList.contains('open');
  sortP.classList.toggle('open', openSort); sortB.classList.toggle('open', openSort);
  tagsP.classList.toggle('open', openTags); tagsB.classList.toggle('open', openTags);
  if (openTags) setTimeout(() => document.getElementById('expTagSearch')?.focus(), 60);
}
function closeExpDropdowns() {
  ['expSortPanel','expTagsPanel','expSortBtn','expTagsBtn'].forEach(id => document.getElementById(id)?.classList.remove('open'));
}
// cerrar al tocar fuera
document.addEventListener('click', e => {
  if (!e.target.closest('.explore-controls') && !e.target.closest('.exp-dd-panel')) closeExpDropdowns();
});
// compat: la función antigua ya no se usa
function toggleExploreFilters() {}

function onExploreSearch(val) {
  exploreSearch = val;
  clearTimeout(window._exploreTimer);
  window._exploreTimer = setTimeout(() => renderExploreScreen(), 400);
}

async function openExploreChat(libCharId) {
  const libId    = 'lib_' + libCharId;
  const existing = libChars.find(x => x.id === libId); // historial local previo

  const { data, error } = await supaClient
    .from('characters_library')
    .select('*')
    .eq('id', libCharId)
    .single();

  if (error || !data) { toast('Error cargando personaje'); return; }

  // Increment chat_count (fire and forget)
  supaClient.from('characters_library')
    .update({ chat_count: (data.chat_count || 0) + 1 })
    .eq('id', libCharId);

  const ch = {
    id:           libId,
    name:         data.name,
    tag:          data.tag,
    gender:       data.gender,
    age:          data.age,
    desc:         data.desc,
    context:      data.context,
    greeting:     data.greeting,
    bg:           data.bg,
    timid:        data.timid    ?? 5,
    romantic:     data.romantic ?? 5,
    pace:         data.pace     ?? 4,
    nsfw:         data.nsfw     ?? 7,
    hitos:        existing?.hitos   || [],
    hitosEnabled: false,
    history:      existing?.history || [],
    isLibraryChar: true
  };

  currentChar  = ch;
  currentScene = null;
  history      = ch.history;

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

  // Saludo solo si no hay historial previo; guardar inmediatamente en libChars
  if (!history.length && ch.greeting) {
    history.push({ role: 'assistant', content: ch.greeting, ts: Date.now() });
    ch.history = history;
    const idx = libChars.findIndex(x => x.id === ch.id);
    if (idx > -1) libChars[idx] = ch; else libChars.unshift(ch);
    saveLibChars();
    renderMessages();
  }
  setTimeout(() => { const m = document.getElementById('messages'); m.scrollTop = m.scrollHeight; }, 50);
}

// ── Admin: gestión de personaje de biblioteca ─────────────────────────────────
let _libEditGender = null;

async function openLibDetail(libCharId) {
  const { data, error } = await supaClient
    .from('characters_library')
    .select('*')
    .eq('id', libCharId)
    .single();
  if (error || !data) { toast('Error cargando personaje'); return; }
  _renderLibDetail(data);
  showScreen('libDetailScreen', true);
}

function _renderLibDetail(data) {
  const nameEl = document.getElementById('libDetailName');
  if (nameEl) nameEl.textContent = data.name;
  _libEditGender = data.gender || null;
  const gM = _libEditGender === 'M' ? ' active' : '';
  const gF = _libEditGender === 'F' ? ' active' : '';

  const body = document.getElementById('libDetailBody');
  if (!body) return;
  body.innerHTML = `
    ${data.bg ? `<div class="mod-detail-bg" style="background-image:url('${data.bg}')"></div>` : ''}
    <div class="mod-detail-form">

      <div class="field-label">Nombre</div>
      <input class="edit-inp" id="libEditName" value="${esc(data.name)}">

      <div class="field-label">Tag / Categoría</div>
      <input class="edit-inp" id="libEditTag" value="${esc(data.tag || '')}">

      <div class="field-label">Género</div>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <button class="gender-btn${gM}" id="libEditGenderM" onclick="libPickGender('M')">♂ Hombre</button>
        <button class="gender-btn${gF}" id="libEditGenderF" onclick="libPickGender('F')">♀ Mujer</button>
      </div>

      <div class="field-label">Edad</div>
      <input class="edit-inp" id="libEditAge" value="${esc(data.age || '')}">

      <div class="field-label">Descripción</div>
      <textarea class="edit-inp edit-ta" id="libEditDesc" rows="3">${esc(data.desc || '')}</textarea>

      <div class="field-label">Contexto / Personalidad</div>
      <textarea class="edit-inp edit-ta" id="libEditContext" rows="5">${esc(data.context || '')}</textarea>

      <div class="field-label">Saludo inicial</div>
      <textarea class="edit-inp edit-ta" id="libEditGreeting" rows="3">${esc(data.greeting || '')}</textarea>

      <div class="mod-card-sliders" style="margin:10px 0 4px">
        Timidez: ${data.timid} · Romance: ${data.romantic} · Ritmo: ${data.pace} · NSFW: ${data.nsfw}
      </div>
      <div class="mod-card-meta">Autor ID: ${esc(data.author_id || '—')}</div>

      <button class="save-btn" style="margin-top:16px;width:100%" onclick="_saveLibEdit('${data.id}')">💾 Guardar cambios</button>

      <hr class="mod-sep">

      <button class="mod-btn-delete" onclick="_confirmDeleteLibChar('${data.id}')">🗑 Eliminar de la biblioteca</button>
    </div>
  `;
}

function libPickGender(g) {
  _libEditGender = _libEditGender === g ? null : g;
  ['M', 'F'].forEach(x => document.getElementById('libEditGender' + x)?.classList.toggle('active', _libEditGender === x));
}

async function _saveLibEdit(charId) {
  const name = document.getElementById('libEditName')?.value.trim();
  if (!name) { toast('Nombre obligatorio'); return; }
  const updates = {
    name,
    tag:      document.getElementById('libEditTag')?.value.trim()      || null,
    gender:   _libEditGender                                            || null,
    age:      document.getElementById('libEditAge')?.value.trim()      || null,
    desc:     document.getElementById('libEditDesc')?.value.trim()     || null,
    context:  document.getElementById('libEditContext')?.value.trim()  || null,
    greeting: document.getElementById('libEditGreeting')?.value.trim() || null,
  };
  const { error } = await supaClient.from('characters_library').update(updates).eq('id', charId);
  if (error) { toast('Error: ' + error.message); return; }
  document.getElementById('libDetailName').textContent = name;
  // Actualizar en el cache local de explore si está cargado
  const idx = exploreChars.findIndex(x => x.id === charId);
  if (idx > -1) exploreChars[idx] = { ...exploreChars[idx], ...updates };
  toast('Guardado ✓');
}

function _confirmDeleteLibChar(charId) {
  openModal('Eliminar de la biblioteca', [
    { label: '🗑 Sí, eliminar', action: `_doDeleteLibChar('${charId}')`, danger: true },
    { label: 'Cancelar', action: 'closeModal()' }
  ]);
}

async function _doDeleteLibChar(charId) {
  closeModal();
  const { error } = await supaClient.from('characters_library').delete().eq('id', charId);
  if (error) { toast('Error: ' + error.message); return; }
  toast('Eliminado de la biblioteca');
  exploreChars = exploreChars.filter(x => x.id !== charId);
  showExplore();
  renderExploreList();
}
