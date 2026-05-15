function saveMissions() { localStorage.setItem('rp_missions', JSON.stringify(missions)); }
function saveMedals()   { localStorage.setItem('rp_medals',   JSON.stringify(medals)); }

// ── TABS ──
function setMissionTab(tab) {
  activeMissionTab = tab;
  document.getElementById('tabMActive').classList.toggle('active', tab === 'active');
  document.getElementById('tabMDone').classList.toggle('active', tab === 'done');
  renderMissionsList();
}

// ── FILTER CHIPS ──
function renderMissionGenFilter() {
  const filter = document.getElementById('missionCharFilter');
  if (!filter) return;
  const items = [
    {type: 'all', id: '', name: 'Todos'},
    ...chars.map(ch  => ({type: 'char',  id: ch.id, name: ch.name,  bg: ch.bg})),
    ...scenes.map(sc => ({type: 'scene', id: sc.id, name: sc.name,  bg: null}))
  ];
  filter.innerHTML = items.map(item => {
    const isActive = item.type === 'all' ? !missionGenTarget : missionGenTarget?.id === item.id;
    const initial = item.name[0]?.toUpperCase() || '?';
    const icon = item.type === 'scene' ? '⚡' : initial;
    const avatar = item.bg
      ? `<div class="mf-chip-avatar"><img src="${item.bg}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"></div>`
      : `<div class="mf-chip-avatar">${icon}</div>`;
    return `<div class="mf-chip${isActive ? ' active' : ''}" onclick="setMissionGenFilter('${item.type}','${item.id}')">${avatar}${esc(item.name)}</div>`;
  }).join('');
}

function setMissionGenFilter(type, id) {
  if (type === 'all') {
    missionGenTarget = null;
  } else {
    const entity = type === 'char' ? chars.find(x => x.id === id) : scenes.find(x => x.id === id);
    missionGenTarget = entity ? {type, id, name: entity.name} : null;
  }
  renderMissionGenFilter();
}

// ── SCREEN ──
function renderMissionsScreen() {
  const active = missions.filter(m => !m.done).length;
  const done   = missions.filter(m => m.done).length;
  document.getElementById('statCompleted').textContent = totalCompleted;
  document.getElementById('statActive').textContent    = active;
  document.getElementById('statStreak').textContent    = mStreak;
  document.getElementById('missionsSubtitle').textContent = totalCompleted
    ? `${totalCompleted} completada${totalCompleted > 1 ? 's' : ''} · ${mStreak} día${mStreak !== 1 ? 's' : ''} de racha`
    : 'Completa retos en tus roleplays';
  document.getElementById('countDone').textContent   = done;

  const medSec = document.getElementById('medalsSection');
  const medRow = document.getElementById('medalsRow');
  if (medals.length) {
    medSec.style.display = 'block';
    const groups = {};
    medals.forEach(m => { groups[m.type] = (groups[m.type] || 0) + 1; });
    medRow.innerHTML = Object.entries(groups).map(([type, count]) => `
      <div class="medal">
        <div class="medal-icon">${RARITIES[type]?.medal || '🏅'}</div>
        <div class="medal-name">${RARITIES[type]?.label || type}</div>
        <div class="medal-count">×${count}</div>
      </div>`).join('');
  } else {
    medSec.style.display = 'none';
  }

  document.getElementById('countActive').textContent = active;
  renderMissionGenFilter();
  renderMissionsList();
}

// ── LIST ──
function renderMissionsList() {
  const list  = document.getElementById('missionsList');
  const empty = document.getElementById('missionsEmpty');
  const filtered = missions.filter(m => activeMissionTab === 'done' ? m.done : !m.done);

  if (!filtered.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    const p = empty.querySelector('p');
    if (p) p.innerHTML = activeMissionTab === 'done'
      ? 'Todavía no has completado ninguna misión'
      : 'Pulsa el botón para que la IA<br>genere misiones basadas en tus personajes';
    return;
  }
  empty.style.display = 'none';
  list.innerHTML = filtered.map(m => {
    const charObj  = m.charId  ? chars.find(x => x.id === m.charId)  : null;
    const sceneObj = m.sceneId ? scenes.find(x => x.id === m.sceneId) : null;
    const displayName = charObj?.name || sceneObj?.name || (m.charName && m.charName !== 'null' ? m.charName : null);
    const displayBg   = charObj?.bg || null;
    const isSceneTag  = !!sceneObj;

    const avatarHtml = displayName ? (
      displayBg
        ? `<div class="mission-char-avatar"><img src="${displayBg}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit"></div>`
        : `<div class="mission-char-avatar">${isSceneTag ? '⚡' : displayName[0].toUpperCase()}</div>`
    ) : '';

    return `
      <div class="mission-card ${m.done ? 'completed' : ''}" id="mc-${m.id}">
        <div class="mission-card-top">
          <div class="mission-icon ${m.rarity}">${RARITIES[m.rarity]?.icon || '⚔️'}</div>
          <div style="flex:1;min-width:0">
            <div class="mission-title">${esc(m.title)}</div>
            <div class="mission-desc">${esc(m.desc)}</div>
            ${displayName ? `<div class="mission-char-tag">${avatarHtml}${isSceneTag ? '⚡' : '📍'} ${esc(displayName)}</div>` : ''}
          </div>
        </div>
        <div class="mission-footer">
          <span class="mission-badge ${m.rarity}">${RARITIES[m.rarity]?.label || m.rarity}</span>
          <div style="display:flex;align-items:center;gap:6px;margin-left:auto">
            ${m.done
              ? `<span class="mission-done-badge">${RARITIES[m.rarity]?.medal || '🏅'} Completada</span>`
              : `<button class="mission-regen-btn" onclick="event.stopPropagation();regenerateMission('${m.id}')">↺ Cambiar</button>`
            }
            <button class="mission-del-btn" onclick="event.stopPropagation();deleteMission('${m.id}')">✕</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── COMPLETE ──
function completeMission(id) {
  const m = missions.find(x => x.id === id);
  if (!m || m.done) return;
  m.done = true; m.completedAt = Date.now();
  saveMissions();
  medals.push({type: m.rarity, missionId: id, ts: Date.now()});
  saveMedals();
  // Racha por días consecutivos
  const today     = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (mLastDate !== today) {
    mStreak   = mLastDate === yesterday ? mStreak + 1 : 1;
    mLastDate = today;
    localStorage.setItem('rp_streak',    mStreak);
    localStorage.setItem('rp_last_date', mLastDate);
  }
  // Contador histórico (nunca baja)
  totalCompleted++;
  localStorage.setItem('rp_total_completed', totalCompleted);
  renderMissionsScreen();
  if (typeof updateChatMissionsBtn === 'function') updateChatMissionsBtn();
  showMissionToast(m);
}

// ── DELETE ──
function deleteMission(id) {
  openModal('Eliminar misión', [
    {label: 'Sí, eliminar', action: `confirmDeleteMission('${id}')`, danger: true},
    {label: 'Cancelar',     action: 'closeModal()'}
  ]);
}
function confirmDeleteMission(id) {
  missions = missions.filter(x => x.id !== id);
  saveMissions();
  closeModal();
  renderMissionsScreen();
}

// ── REGENERATE ──
function regenerateMission(id) {
  const m = missions.find(x => x.id === id);
  if (!m || m.done) return;
  openModal(`Regenerar misión ${RARITIES[m.rarity]?.label || ''}`, [
    {label: '↺ Sí, regenerar', action: `confirmRegenerateMission('${id}')`},
    {label: 'Cancelar',        action: 'closeModal()'}
  ]);
}

async function confirmRegenerateMission(id) {
  closeModal();
  const m = missions.find(x => x.id === id);
  if (!m || m.done) return;
  const apiKey = localStorage.getItem('rp_apikey') || '';
  if (!apiKey) { toast('Configura tu API Key en Mi Perfil primero'); return; }

  const card = document.getElementById('mc-' + id);
  if (card) card.style.opacity = '0.4';

  let contextBlock = '';
  if (m.charId) {
    const ch = chars.find(x => x.id === m.charId);
    if (ch) contextBlock = `Genera una misión para el personaje "${ch.name}"${ch.desc ? ': ' + ch.desc.slice(0, 100) : ''}.`;
  } else if (m.sceneId) {
    const sc = scenes.find(x => x.id === m.sceneId);
    if (sc) {
      const names = sc.charIds.map(id => chars.find(x => x.id === id)?.name).filter(Boolean).join(', ');
      contextBlock = `Genera una misión para la escena "${sc.name}" con los personajes: ${names}.`;
    }
  } else {
    contextBlock = `Personajes disponibles: ${chars.slice(0, 5).map(c => c.name).join(', ') || 'Sin personajes'}.`;
  }

  const existing = missions.filter(x => !x.done).map(x => x.title).join(', ');
  const prompt = `Eres un generador de misiones para una app de roleplay.
${contextBlock}
${existing ? 'Misiones activas ya existentes (NO repitas): ' + existing : ''}

Genera exactamente 1 misión de roleplay nueva de rareza "${m.rarity}". Debe ser accionable durante un chat de roleplay.

Responde ÚNICAMENTE con el array JSON, sin texto adicional:
[{"title":"Título corto","desc":"Qué hay que hacer (1-2 frases)","rarity":"${m.rarity}","charName":null}]`;

  try {
    const res = await anthropicFetch(apiKey, prompt, 400);
    if (!res.ok) throw new Error('Error ' + res.status);
    const data = await res.json();
    const match = data.content[0].text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Respuesta inválida');
    const g = JSON.parse(match[0])[0];
    if (!g?.title || !g?.desc) throw new Error('Misión inválida');
    const idx = missions.findIndex(x => x.id === id);
    if (idx > -1) { missions[idx].title = g.title; missions[idx].desc = g.desc; }
    saveMissions();
    renderMissionsList();
    toast('Misión regenerada ✓');
  } catch (e) {
    toast('Error: ' + e.message);
    if (card) card.style.opacity = '1';
  }
}

function showMissionToast(m) {
  const t = document.getElementById('missionToast');
  document.getElementById('toastMedalIcon').textContent  = RARITIES[m.rarity]?.medal || '🏅';
  document.getElementById('toastTitle').textContent      = m.title;
  document.getElementById('toastDesc').textContent       = m.desc || '';
  const eyebrow = document.getElementById('toastEyebrow');
  eyebrow.textContent  = `${RARITIES[m.rarity]?.label || 'Misión'} completada`;
  eyebrow.className    = 'mission-notif-eyebrow ' + m.rarity;
  document.getElementById('toastRarityBar').className    = 'mission-notif-bar ' + m.rarity;
  t.classList.remove('show');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 5000);
  }));
}

// ── GENERATE ──
async function generateMissions() {
  if (!chars.length && !scenes.length) { toast('Crea personajes primero'); return; }
  const apiKey = localStorage.getItem('rp_apikey') || '';
  if (!apiKey) { toast('Configura tu API Key en Mi Perfil primero'); return; }

  const btn  = document.getElementById('genBtn');
  const icon = document.getElementById('genBtnIcon');
  const txt  = document.getElementById('genBtnText');
  btn.classList.add('loading');
  icon.textContent = '⏳'; txt.textContent = 'Generando misiones…';

  const existing = missions.filter(m => !m.done).map(m => m.title).join(', ');
  let contextBlock = '';
  let charId = null, sceneId = null;

  if (missionGenTarget?.type === 'char') {
    const ch = chars.find(x => x.id === missionGenTarget.id);
    if (ch) {
      charId = ch.id;
      contextBlock = `Genera misiones específicas para el personaje "${ch.name}"${ch.tag ? ' (' + ch.tag + ')' : ''}${ch.desc ? ': ' + ch.desc.slice(0, 100) : ''}.`;
    }
  } else if (missionGenTarget?.type === 'scene') {
    const sc = scenes.find(x => x.id === missionGenTarget.id);
    if (sc) {
      sceneId = sc.id;
      const sceneCharsNames = sc.charIds.map(id => chars.find(x => x.id === id)?.name).filter(Boolean).join(', ');
      contextBlock = `Genera misiones específicas para la escena grupal "${sc.name}" con los personajes: ${sceneCharsNames}.${sc.context ? ' Contexto: ' + sc.context.slice(0, 100) : ''}`;
    }
  } else {
    const charSummary  = chars.slice(0, 6).map(ch => `${ch.name}${ch.age ? ' (' + ch.age + ' años)' : ''}${ch.desc ? ': ' + ch.desc.slice(0, 60) : ''}`).join('\n');
    const sceneSummary = scenes.slice(0, 3).map(s => `Escena grupal "${s.name}"`).join(', ');
    contextBlock = `Personajes disponibles:\n${charSummary || 'Sin personajes definidos'}${sceneSummary ? '\nEscenas: ' + sceneSummary : ''}`;
  }

  const prompt = `Eres un generador de misiones para una app de roleplay.
${contextBlock}
${existing ? '\nMisiones activas ya existentes (NO repitas): ' + existing : ''}

Genera exactamente 4 misiones de roleplay nuevas, variadas y creativas. Deben ser:
- Accionables durante una conversación de roleplay (cosas que el jugador pueda hacer, decir o conseguir hablando con el personaje)
- Con rareza variada: 2 common, 1 rare, 1 epic o legendary
- Divertidas y con narrativa de fantasía/aventura/romance según el contexto

Responde ÚNICAMENTE con el array JSON, sin texto adicional, sin markdown:
[{"title":"Título corto","desc":"Qué hay que hacer (1-2 frases)","rarity":"common","charName":"NombrePersonaje o null"}]`;

  try {
    const res = await anthropicFetch(apiKey, prompt, 1000);
    if (!res.ok) {
      let msg = String(res.status);
      try { const err = await res.json(); msg = err.error?.message || msg; } catch (_) {}
      throw new Error(msg);
    }
    const data = await res.json();
    const match = data.content[0].text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Respuesta no contiene JSON válido');
    const generated = JSON.parse(match[0]);
    const validRarities = new Set(['common', 'rare', 'epic', 'legendary']);
    generated.forEach(m => {
      if (!m.title || !m.desc) return;
      missions.push({
        id:       uid(),
        title:    m.title,
        desc:     m.desc,
        rarity:   validRarities.has(m.rarity) ? m.rarity : 'common',
        charName: (m.charName && m.charName !== 'null') ? m.charName : null,
        charId,
        sceneId,
        done:      false,
        createdAt: Date.now()
      });
    });
    saveMissions();
    setMissionTab('active');
    renderMissionsScreen();
    toast('¡' + generated.length + ' misiones generadas!');
  } catch (e) {
    toast('Error: ' + e.message);
    console.error('generateMissions error:', e);
  }
  btn.classList.remove('loading');
  icon.textContent = '✦'; txt.textContent = 'Generar misiones con IA';
}

// ── AUTO-DETECT COMPLETION ──
async function checkMissionCompletion(userMsg, botReply) {
  const allActive = missions.filter(m => !m.done);
  if (!allActive.length) return;
  const apiKey = localStorage.getItem('rp_apikey') || '';
  if (!apiKey) return;

  // Solo misiones relevantes al chat actual
  const active = allActive.filter(m => {
    if (currentScene) return !m.charId && !m.sceneId || m.sceneId === currentScene.id;
    if (currentChar)  return !m.sceneId && (!m.charId || m.charId === currentChar.id);
    return true;
  });
  if (!active.length) return;

  const missionList = active.map((m, i) => `${i}: "${m.title}" — ${m.desc}`).join('\n');
  const prompt = `Eres un árbitro de misiones para una app de roleplay. Analiza si el jugador ha completado alguna misión en este intercambio.

MISIONES (índice: título — descripción):
${missionList}

MENSAJE DEL JUGADOR:
"${userMsg.slice(0, 500)}"

RESPUESTA DEL PERSONAJE/ESCENA:
"${botReply.slice(0, 600)}"

INSTRUCCIONES: Una misión se completa si en este intercambio el jugador ha realizado o conseguido lo que describe la misión. Sé generoso pero realista: si el jugador claramente intentó cumplirla y el personaje respondió de forma coherente, márcala como completada. Solo marca las que están claramente cumplidas en ESTE intercambio.

Responde ÚNICAMENTE con JSON: {"completed":[0,2]} con los índices de las misiones completadas, o {"completed":[]} si ninguna.`;

  try {
    const res = await anthropicFetch(apiKey, prompt, 150);
    if (!res.ok) return;
    const data = await res.json();
    const match = data.content[0].text.match(/\{[\s\S]*\}/);
    if (!match) return;
    const result = JSON.parse(match[0]);
    if (Array.isArray(result.completed) && result.completed.length) {
      result.completed.forEach(idx => { if (active[idx]) completeMission(active[idx].id); });
    }
  } catch (e) { /* silent fail */ }
}
