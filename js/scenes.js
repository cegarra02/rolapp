function saveScenes() {
  // Tolerante a cuota: si no cabe, reintenta soltando imágenes de fondo pesadas.
  if (_lsSet('rp_scenes', JSON.stringify(scenes))) return true;
  // Silencioso: suelta imágenes de fondo pesadas si no caben (se mantienen en memoria)
  const slim = scenes.map(s => (s && s.bg && s.bg.length > 30000)
    ? Object.assign({}, s, { bg: null }) : s);
  if (_lsSet('rp_scenes', JSON.stringify(slim))) return true;
  // Solo avisamos si no se pudo guardar nada
  toast('⚠️ Almacenamiento lleno: no se pudo guardar la escena');
  return false;
}

function renderScenesScreen() {
  const list = document.getElementById('scenesList');
  if (!list || !document.getElementById('scenesScreen')) return;
  if (!scenes.length) {
    list.style.display = 'block';
    list.innerHTML = '<div class="empty-state"><div class="icon">⚡</div><p>Crea tu primera escena grupal pulsando <strong>+</strong></p></div>';
    return;
  }
  list.style.display = '';
  list.innerHTML = scenes.map(s => {
    const sceneChars = s.charIds.map(id => chars.find(x => x.id === id)).filter(Boolean);
    const bg = sceneChars.find(ch => ch.bg);
    return `<div class="scene-card" onclick="openSceneChat('${s.id}')">
      ${bg ? `<div class="scene-card-bg" style="background-image:url('${bg.bg}')"></div>` : '<div class="scene-card-nochars">⚡</div>'}
      <div class="scene-card-count"><i data-icon="users" data-size="12"></i> ${sceneChars.length}</div>
      <div class="scene-card-body">
        <div class="scene-card-name">${esc(s.name)}</div>
        <div class="scene-card-chars">${sceneChars.map(ch => ch.name).join(' · ') || 'Sin personajes'}</div>
        <span class="scene-card-tag">Escena grupal</span>
      </div>
      <div class="scene-card-edit" onclick="event.stopPropagation();openSceneEdit('${s.id}')">✎</div>
    </div>`;
  }).join('');
}

function renderScenes() {
  const sec = document.getElementById('scenesSection');
  if (!sec) return;
  const list = document.getElementById('scenesList');
  if (!scenes.length) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  list.innerHTML = scenes.map(s => `
    <div class="scene-chip" onclick="openSceneChat('${s.id}')">
      <div class="scene-chip-name">${esc(s.name)}</div>
      <div class="scene-chip-sub">${s.charIds.map(id => { const ch = chars.find(x => x.id === id); return ch ? ch.name : '?'; }).join(', ')}</div>
    </div>
  `).join('');
}

function openSceneCreate() {
  editSceneId = null; pickedCharIds = [];
  document.getElementById('sceneTitle').textContent = 'Nueva escena grupal';
  document.getElementById('sceneDeleteBtn').style.display = 'none';
  ['sceneName', 'sceneContext', 'sceneGreeting'].forEach(id => document.getElementById(id).value = '');
  renderSceneCharsPicker();
  const cp = document.getElementById('sceneUseCustomProfile');
  if (cp) { cp.checked = false; toggleSceneCustomProfile(false); }
  ['sceneCpName', 'sceneCpDesc', 'sceneCpContext', 'sceneCpPrefs'].forEach(id => {
    const e = document.getElementById(id); if (e) e.value = '';
  });
  showScreen('sceneScreen', true);
}

function openSceneEdit(id) {
  const s = scenes.find(x => x.id === id); if (!s) return;
  editSceneId = id; pickedCharIds = [...s.charIds];
  document.getElementById('sceneTitle').textContent = 'Editar escena';
  document.getElementById('sceneDeleteBtn').style.display = 'block';
  document.getElementById('sceneName').value = s.name || '';
  document.getElementById('sceneContext').value = s.context || '';
  document.getElementById('sceneGreeting').value = s.greeting || '';
  renderSceneCharsPicker();
  const cp = document.getElementById('sceneUseCustomProfile');
  if (cp) {
    cp.checked = !!s.useCustomProfile;
    toggleSceneCustomProfile(!!s.useCustomProfile);
    const p = s.customProfile || {};
    document.getElementById('sceneCpName').value    = p.name    || '';
    document.getElementById('sceneCpDesc').value    = p.desc    || '';
    document.getElementById('sceneCpContext').value = p.context || '';
    document.getElementById('sceneCpPrefs').value   = p.prefs   || '';
  }
  showScreen('sceneScreen', true);
}

function toggleSceneCustomProfile(checked) {
  const fields = document.getElementById('sceneCustomProfileFields');
  if (fields) fields.style.display = checked ? 'block' : 'none';
}

function renderSceneCharsPicker() {
  const grid = document.getElementById('sceneCharsPicker');
  if (!chars.length) { grid.innerHTML = '<p style="color:var(--muted);font-size:13px;grid-column:1/-1">Crea al menos 2 personajes primero.</p>'; return; }
  grid.innerHTML = chars.map(ch => `
    <div class="scene-char-pick ${pickedCharIds.includes(ch.id) ? 'selected' : ''}" onclick="toggleSceneChar('${ch.id}')">
      ${ch.bg ? `<div class="scene-char-pick-bg" style="background-image:url('${ch.bg}')"></div>` : ''}
      <div class="scene-char-pick-grad"></div>
      <div class="scene-char-pick-name">${esc(ch.name)}</div>
      <div class="scene-char-pick-check">✓</div>
    </div>
  `).join('');
}

function toggleSceneChar(id) {
  const idx = pickedCharIds.indexOf(id);
  if (idx > -1) pickedCharIds.splice(idx, 1);
  else pickedCharIds.push(id);
  renderSceneCharsPicker();
}

function saveScene() {
  const name = document.getElementById('sceneName').value.trim();
  if (!name) { toast('La escena necesita un nombre'); return; }
  if (pickedCharIds.length < 2) { toast('Selecciona al menos 2 personajes'); return; }
  const useCustom = document.getElementById('sceneUseCustomProfile')?.checked || false;
  const existing = editSceneId ? scenes.find(x => x.id === editSceneId) : null;
  const s = {
    id:       editSceneId || uid(),
    name,
    charIds:  pickedCharIds,
    context:  document.getElementById('sceneContext').value.trim(),
    greeting: document.getElementById('sceneGreeting').value.trim(),
    history:      existing?.history      || [],
    chatStyle:    existing?.chatStyle    || null,
    hitos:        existing?.hitos        || [],
    hitosEnabled: existing?.hitosEnabled === false ? false : undefined,
    useCustomProfile: useCustom,
    customProfile: useCustom ? {
      name:    document.getElementById('sceneCpName').value.trim(),
      desc:    document.getElementById('sceneCpDesc').value.trim(),
      context: document.getElementById('sceneCpContext').value.trim(),
      prefs:   document.getElementById('sceneCpPrefs').value.trim()
    } : null
  };
  if (editSceneId) { const i = scenes.findIndex(x => x.id === editSceneId); if (i > -1) scenes[i] = s; else scenes.unshift(s); }
  else scenes.unshift(s);
  saveScenes(); syncScenes(); toast('Escena guardada ✓'); goHome();
}

function deleteScene() {
  if (!editSceneId) return;
  scenes = scenes.filter(x => x.id !== editSceneId);
  saveScenes(); syncScenes(); goHome(); toast('Escena eliminada');
}

function openSceneChat(id) {
  const s = scenes.find(x => x.id === id); if (!s) return;
  currentScene = s; currentChar = null;
  history = s.history || [];
  document.getElementById('chatName').textContent = s.name;
  const sceneChars = s.charIds.map(id => chars.find(x => x.id === id)).filter(Boolean);
  document.getElementById('chatMeta').textContent = sceneChars.map(ch => ch.name).join(' · ');
  const bg = document.getElementById('chatBg');
  const firstBg = sceneChars.find(ch => ch.bg);
  if (firstBg) { bg.style.backgroundImage = `url(${firstBg.bg})`; bg.style.display = 'block'; }
  else { bg.style.display = 'none'; }
  renderMessages();
  updateChatMissionsBtn();
  isSwiped = false; document.getElementById('chatContentWrap').classList.remove('swiped');
  document.getElementById('swipeHint').style.display = '';
  showScreen('chat', true);
  if (!history.length && s.greeting) {
    const msg = {role: 'assistant', content: s.greeting, ts: Date.now(), speaker: 'Narrador'};
    history.push(msg); s.history = history; saveScenes();
    syncHistory(s.id, s.history, s.hitos || []);
    renderMessages();
  }
  setTimeout(() => { const m = document.getElementById('messages'); m.scrollTop = m.scrollHeight; }, 50);
}
