function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function renderMessages() {
  const container = document.getElementById('messages');
  if (!history.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--muted);font-size:13px;padding:40px 0">Comienza la aventura…</div>';
    return;
  }
  const style = (currentScene || currentChar)?.chatStyle || {};
  container.innerHTML = history.map((m, i) => {
    const isUser = m.role === 'user';
    let inlineStyle = '';
    const op = style.bubbleOpacity;
    if (isUser) {
      if (style.userBg && op !== undefined) inlineStyle += `background:${hexToRgba(style.userBg, op)};`;
      else if (style.userBg)                inlineStyle += `background:${style.userBg};`;
      else if (op !== undefined)            inlineStyle += `background:linear-gradient(135deg,rgba(168,85,247,${op}),rgba(109,40,217,${op}));`;
      if (style.userColor) inlineStyle += `color:${style.userColor};`;
    } else {
      if (style.botBg && op !== undefined)  inlineStyle += `background:${hexToRgba(style.botBg, op)};`;
      else if (style.botBg)                 inlineStyle += `background:${style.botBg};`;
      else if (op !== undefined)            inlineStyle += `background:rgba(10,10,14,${op});`;
      if (style.botColor) inlineStyle += `color:${style.botColor};`;
    }
    if (style.fontSize) inlineStyle += `font-size:${style.fontSize}px;`;
    return `
    <div class="msg-wrap ${isUser ? 'user' : 'bot'}" id="msgwrap-${i}"
         ontouchstart="handleMsgTouch(${i})" onclick="handleMsgClick(${i})">
      ${!isUser && m.speaker ? `<div class="bubble-speaker">${esc(m.speaker.replace(/:+$/, ''))}</div>` : ''}
      <div class="bubble" id="bubble-${i}"${inlineStyle ? ` style="${inlineStyle}"` : ''}>${formatMsg(m.content)}</div>
      <div class="bubble-time">${fmtTime(m.ts)}</div>
      <div class="msg-actions" id="actions-${i}">
        <button class="msg-action-btn" onclick="event.stopPropagation();editMsg(${i})">✎ Editar</button>
        <button class="msg-action-btn del" onclick="event.stopPropagation();deleteMsg(${i})">✕ Borrar</button>
      </div>
    </div>`;
  }).join('');
}

let _msgTouchTimer = null;
function handleMsgTouch(i) { _msgTouchTimer = setTimeout(() => toggleMsgActions(i), 400); }
function handleMsgClick(i) { if (_msgTouchTimer) { clearTimeout(_msgTouchTimer); _msgTouchTimer = null; } }

function toggleMsgActions(i) {
  const el = document.getElementById('msgwrap-' + i);
  if (!el) return;
  document.querySelectorAll('.msg-wrap.show-actions').forEach(e => { if (e !== el) e.classList.remove('show-actions'); });
  el.classList.toggle('show-actions');
}

function deleteMsg(i) {
  openModal('Borrar mensaje', [
    {label: 'Sí, borrar', action: `confirmDeleteMsg(${i})`, danger: true},
    {label: 'Cancelar',   action: 'closeModal()'}
  ]);
}

function confirmDeleteMsg(i) {
  history.splice(i, 1);
  saveHistory();
  closeModal();
  renderMessages();
}

function editMsg(i) {
  const m = history[i];
  const bubble = document.getElementById('bubble-' + i);
  if (!bubble) return;
  const wrap = document.getElementById('msgwrap-' + i);
  wrap.classList.remove('show-actions');
  bubble.classList.add('editing');
  const original = m.content;
  bubble.innerHTML = `
    <textarea class="edit-textarea" id="editta-${i}" rows="3">${esc(original)}</textarea>
    <div class="edit-confirm-row">
      <button class="edit-confirm-btn edit-ok" onclick="confirmEdit(${i})">✓ Guardar</button>
      <button class="edit-confirm-btn edit-cancel" onclick="cancelEdit(${i},'${encodeURIComponent(original)}')">Cancelar</button>
    </div>`;
  const ta = document.getElementById('editta-' + i);
  if (ta) { ta.focus(); ta.style.height = ta.scrollHeight + 'px'; }
}

function confirmEdit(i) {
  const ta = document.getElementById('editta-' + i);
  if (!ta) return;
  history[i].content = ta.value.trim() || history[i].content;
  saveHistory();
  renderMessages();
}

function cancelEdit(i, orig) {
  history[i].content = decodeURIComponent(orig);
  renderMessages();
}

// Persiste currentChar en el store correcto (chars[] o libChars[] según sea de biblioteca)
function _saveChar() {
  if (!currentChar) return;
  if (currentChar.isLibraryChar) {
    const idx = libChars.findIndex(x => x.id === currentChar.id);
    if (idx > -1) libChars[idx] = currentChar;
    else libChars.unshift(currentChar);
    saveLibChars();
  } else {
    save();
  }
}

function saveHistory() {
  if (currentScene) { currentScene.history = history; saveScenes(); }
  else if (currentChar) { currentChar.history = history; _saveChar(); }
}

function scrollBottom() { setTimeout(() => { const m = document.getElementById('messages'); m.scrollTop = m.scrollHeight; }, 50); }
function scrollToMsg(idx) {
  setTimeout(() => {
    const el = document.getElementById('msgwrap-' + idx);
    if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
    else { const m = document.getElementById('messages'); m.scrollTop = m.scrollHeight; }
  }, 60);
}

function showTyping() {
  const m = document.getElementById('messages');
  const d = document.createElement('div');
  d.className = 'msg bot'; d.id = 'typing';
  d.innerHTML = `<div class="bubble"><div class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
  m.appendChild(d); scrollBottom();
}
function hideTyping() { const t = document.getElementById('typing'); if (t) t.remove(); }

function parseSceneReply(reply) {
  const segments = [];
  const regex = /\*\*([^*\n]+)\*\*[:\s]+([\s\S]*?)(?=\n?\*\*[^*\n]+\*\*[:\s]+|$)/g;
  let match;
  while ((match = regex.exec(reply)) !== null) {
    const content = match[2].trim();
    if (content) segments.push({speaker: match[1].trim().replace(/:+$/, ''), content});
  }
  if (!segments.length) segments.push({speaker: null, content: reply.trim()});
  return segments;
}

async function sendMessage() {
  const inp = document.getElementById('chatInp');
  const text = inp.value.trim(); if (!text) return;

  // Coste por mensaje: 7 gemas
  if (!deductMessageGems()) {
    toast(`💎 No tienes gemas suficientes (necesitas ${MESSAGE_GEM_COST})`);
    return;
  }

  inp.value = ''; inp.style.height = 'auto';
  const userMsg = {role: 'user', content: text, ts: Date.now()};
  history.push(userMsg);
  if (currentScene) { currentScene.history = history; saveScenes(); }
  else { currentChar.history = history; _saveChar(); }
  // Contar mensajes enviados a personajes de biblioteca (para ordenar por popularidad)
  if (currentChar?.isLibraryChar) {
    const libCharId = currentChar.id.slice(4); // quita el prefijo 'lib_'
    // Incremento optimista local — survives re-fetch gracias a fetchExploreChars merge
    const ec = exploreChars.find(c => c.id === libCharId);
    if (ec) ec.message_count = (ec.message_count || 0) + 1;
    // Persistir en DB (fire and forget con logging para diagnóstico)
    supaClient.rpc('increment_lib_messages', { char_id: libCharId })
      .then(({ error }) => { if (error) console.error('[explore] increment_lib_messages error:', error.message, error.code); });
  }
  renderMessages(); scrollBottom();
  showTyping();
  try {
    const rawReply = await callAPI(text);
    hideTyping();

    // Extract and strip <hito> tag before storing or displaying
    const hitoMatch = rawReply.match(/<hito>([^<]+)<\/hito>/i);
    const reply = rawReply.replace(/<hito>[^<]*<\/hito>/gi, '').trim();
    if (hitoMatch) {
      const t = currentScene || currentChar;
      if (t && t.hitosEnabled !== false) {
        if (!t.hitos) t.hitos = [];
        t.hitos.unshift({ id: uid(), text: hitoMatch[1].trim(), ts: Date.now() });
        if (currentScene) saveScenes(); else _saveChar();
        setTimeout(() => showHitoNotif(hitoMatch[1].trim()), 600);
      }
    }

    const firstNewBotIdx = history.length;
    if (currentScene) {
      const parts = parseSceneReply(reply);
      for (const p of parts) {
        history.push({role: 'assistant', content: p.content, ts: Date.now(), speaker: p.speaker});
      }
      currentScene.history = history; saveScenes();
    } else {
      history.push({role: 'assistant', content: reply, ts: Date.now(), speaker: null});
      currentChar.history = history; _saveChar();
    }
    renderMessages(); scrollToMsg(firstNewBotIdx);
    if (currentChar)  inboxMarkActive('char',  currentChar.id);
    if (currentScene) inboxMarkActive('scene', currentScene.id);
    // checkMissionCompletion(text, reply); // misiones ocultas temporalmente
  } catch (err) {
    hideTyping();
    history.push({role: 'assistant', content: `_(Error: ${err.message}. Comprueba tu API key en Mi Perfil.)_`, ts: Date.now()});
    if (currentScene) { currentScene.history = history; saveScenes(); }
    else { currentChar.history = history; _saveChar(); }
    renderMessages(); scrollBottom();
  }
}

function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }
function autoResize(el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px'; }

// ── QUICK INSERT ──
function quickInsert(open, close) {
  const inp = document.getElementById('chatInp');
  const start = inp.selectionStart, end = inp.selectionEnd;
  const selected = inp.value.slice(start, end);
  inp.value = inp.value.slice(0, start) + open + selected + close + inp.value.slice(end);
  const pos = selected.length === 0 ? start + open.length : start + open.length + selected.length + close.length;
  inp.setSelectionRange(pos, pos);
  inp.focus(); autoResize(inp);
}
function qi_asterisk() { quickInsert('*', '*'); }
function qi_quote()    { quickInsert('"', '"'); }
function qi_paren()    { quickInsert('(', ')'); }

// ── CHAT STYLE ──
function _csColorItem(label, inputId, swatchId, defaultVal) {
  return `
    <div class="cs-color-item">
      <span class="cs-color-label">${label}</span>
      <div class="cs-color-wrap">
        <div class="cs-color-swatch" id="${swatchId}" style="background:${defaultVal}"></div>
        <input type="color" class="cs-color-hidden" id="${inputId}" value="${defaultVal}"
          oninput="document.getElementById('${swatchId}').style.background=this.value;updateStylePreview()">
      </div>
    </div>`;
}

function updateStylePreview() {
  const op  = parseInt(document.getElementById('csBubbleOpacity')?.value || 58) / 100;
  const botBg    = document.getElementById('csBotBg')?.value    || '#0a0a0e';
  const botColor = document.getElementById('csBotColor')?.value  || '#ffffff';
  const userBg   = document.getElementById('csUserBg')?.value   || '#7c3aed';
  const userColor= document.getElementById('csUserColor')?.value || '#ffffff';
  const fs = document.getElementById('csFontSize')?.value || 14;
  const bot  = document.getElementById('cs-preview-bot');
  const user = document.getElementById('cs-preview-user');
  if (bot)  { bot.style.background  = hexToRgba(botBg, op);  bot.style.color  = botColor;  bot.style.fontSize  = fs + 'px'; }
  if (user) { user.style.background = hexToRgba(userBg, op); user.style.color = userColor; user.style.fontSize = fs + 'px'; }
}

function openChatStyleModal() {
  closeModal();
  setTimeout(() => {
    openModal('🎨 Estilo del chat', []);
    const mb = document.getElementById('modalBody');
    const style = (currentScene || currentChar)?.chatStyle || {};
    const opPct = style.bubbleOpacity !== undefined ? Math.round(style.bubbleOpacity * 100) : 58;
    const botBg    = style.botBg    || '#0a0a0e';
    const botColor = style.botColor || '#ffffff';
    const userBg   = style.userBg   || '#7c3aed';
    const userColor= style.userColor|| '#ffffff';
    const fs       = style.fontSize || 14;
    mb.innerHTML = `
      <div class="cs-preview">
        <div class="cs-preview-bot-wrap">
          <div class="bubble-speaker" style="display:inline-block">${esc((currentScene || currentChar)?.name || 'Personaje')}</div>
          <div class="cs-preview-bubble" id="cs-preview-bot"
            style="background:${hexToRgba(botBg,opPct/100)};color:${botColor};font-size:${fs}px">
            ¡Hola! Esto es un ejemplo de texto en burbuja.
          </div>
        </div>
        <div class="cs-preview-user-wrap">
          <div class="cs-preview-bubble cs-preview-bubble-user" id="cs-preview-user"
            style="background:${hexToRgba(userBg,opPct/100)};color:${userColor};font-size:${fs}px">
            Esto es tu burbuja.
          </div>
        </div>
      </div>

      <div class="cs-section-title">Personaje</div>
      <div class="cs-color-row">
        ${_csColorItem('Fondo', 'csBotBg', 'csBotBgSwatch', botBg)}
        ${_csColorItem('Texto', 'csBotColor', 'csBotColorSwatch', botColor)}
      </div>

      <div class="cs-section-title" style="margin-top:14px">Jugador</div>
      <div class="cs-color-row">
        ${_csColorItem('Fondo', 'csUserBg', 'csUserBgSwatch', userBg)}
        ${_csColorItem('Texto', 'csUserColor', 'csUserColorSwatch', userColor)}
      </div>

      <div class="cs-sliders">
        <div class="cs-slider-row">
          <div class="cs-slider-hdr">
            <span>Opacidad</span>
            <span class="cs-slider-val" id="csBubbleOpacityLabel">${opPct}%</span>
          </div>
          <input type="range" class="cs-slider" id="csBubbleOpacity" min="30" max="100" value="${opPct}"
            oninput="document.getElementById('csBubbleOpacityLabel').textContent=this.value+'%';updateStylePreview()">
        </div>
        <div class="cs-slider-row">
          <div class="cs-slider-hdr">
            <span>Tamaño de fuente</span>
            <span class="cs-slider-val" id="csFontSizeLabel">${fs}px</span>
          </div>
          <input type="range" class="cs-slider" id="csFontSize" min="11" max="20" value="${fs}"
            oninput="document.getElementById('csFontSizeLabel').textContent=this.value+'px';updateStylePreview()">
        </div>
      </div>

      <div class="cs-btns">
        <button class="btn-primary" style="flex:1" onclick="saveChatStyle()">Guardar</button>
        <button class="cs-reset-btn" onclick="resetChatStyle()">Restablecer</button>
      </div>
    `;
  }, 50);
}

function saveChatStyle() {
  const s = {
    botBg:         document.getElementById('csBotBg').value,
    botColor:      document.getElementById('csBotColor').value,
    userBg:        document.getElementById('csUserBg').value,
    userColor:     document.getElementById('csUserColor').value,
    bubbleOpacity: parseInt(document.getElementById('csBubbleOpacity').value) / 100,
    fontSize:      parseInt(document.getElementById('csFontSize').value)
  };
  if (currentScene) { currentScene.chatStyle = s; saveScenes(); }
  else if (currentChar) { currentChar.chatStyle = s; _saveChar(); }
  closeModal();
  renderMessages();
  toast('Estilo guardado ✓');
}

function resetChatStyle() {
  if (currentScene) { delete currentScene.chatStyle; saveScenes(); }
  else if (currentChar) { delete currentChar.chatStyle; _saveChar(); }
  closeModal();
  renderMessages();
  toast('Estilo restablecido');
}

function openChat(id) {
  const c = chars.find(x => x.id === id); if (!c) return;
  currentScene = null; currentChar = c;
  history = c.history || [];
  document.getElementById('chatName').textContent = c.name;
  document.getElementById('chatMeta').textContent = c.age ? c.age + ' años' : '';
  const bg = document.getElementById('chatBg');
  if (c.bg) { bg.style.backgroundImage = `url(${c.bg})`; bg.style.display = 'block'; }
  else { bg.style.display = 'none'; }
  renderMessages();
  updateChatMissionsBtn();
  isSwiped = false; document.getElementById('chatContentWrap').classList.remove('swiped');
  document.getElementById('swipeHint').style.display = '';
  showScreen('chat', true);
  if (!history.length && c.greeting) {
    const msg = {role: 'assistant', content: c.greeting, ts: Date.now()};
    history.push(msg); c.history = history; save(); renderMessages();
  }
  setTimeout(() => { const m = document.getElementById('messages'); m.scrollTop = m.scrollHeight; }, 50);
}

function openChatMenu() {
  const isLib = !!(currentChar?.isLibraryChar);
  openModal('Opciones del chat', [
    ...(!isLib && !currentScene ? [{label: '✎  Editar personaje', action: `editFromChat()`}] : []),
    {label: '📌  Hitos',            action: `openMilestonesModal()`},
    {label: '🎨  Estilo del chat',   action: `openChatStyleModal()`},
    {label: '🗑  Limpiar historial', action: `clearHistory()`},
    {label: '✕  Cancelar',          action: 'closeModal()'}
  ]);
}

function updateChatMissionsBtn() {
  const badge = document.getElementById('chatMissionsBadge');
  if (!badge) return;
  const count = missions.filter(m => !m.done).filter(m => {
    if (currentScene) return (!m.charId && !m.sceneId) || m.sceneId === currentScene.id;
    if (currentChar)  return !m.sceneId && (!m.charId || m.charId === currentChar.id);
    return true;
  }).length;
  badge.textContent    = count;
  badge.style.display  = count > 0 ? '' : 'none';
}

function openChatMissions() {
  closeModal();
  setTimeout(() => {
    const allActive = missions.filter(m => !m.done);
    const relevant = allActive.filter(m => {
      if (currentScene) return (!m.charId && !m.sceneId) || m.sceneId === currentScene.id;
      if (currentChar)  return !m.sceneId && (!m.charId || m.charId === currentChar.id);
      return true;
    });

    openModal('⚔️ Misiones activas', []);
    const mb = document.getElementById('modalBody');

    if (!relevant.length) {
      mb.innerHTML = `
        <div style="text-align:center;padding:24px 0 8px;color:var(--muted);font-size:14px;line-height:1.6">
          No hay misiones activas para este chat.
        </div>
        <button class="btn-primary" style="width:100%;margin-top:12px" onclick="closeModal();switchTab('missions')">Ir a Misiones</button>`;
      return;
    }

    mb.innerHTML = relevant.map(m => `
      <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
        <div class="mission-icon ${m.rarity}" style="width:38px;height:38px;font-size:20px;flex-shrink:0">${RARITIES[m.rarity]?.icon || '⚔️'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:3px">${esc(m.title)}</div>
          <div style="font-size:12px;color:var(--muted);line-height:1.5">${esc(m.desc)}</div>
          <span class="mission-badge ${m.rarity}" style="margin-top:6px;display:inline-block">${RARITIES[m.rarity]?.label || m.rarity}</span>
        </div>
      </div>`).join('') +
      `<button class="btn-primary" style="width:100%;margin-top:16px" onclick="closeModal()">Cerrar</button>`;
  }, 50);
}

function editFromChat() {
  closeModal();
  if (currentScene) openSceneEdit(currentScene.id);
  else openEdit(currentChar.id);
}

function clearHistory() {
  history = [];
  if (currentScene) {
    currentScene.history = []; saveScenes();
    if (currentScene.greeting) { const m = {role: 'assistant', content: currentScene.greeting, ts: Date.now(), speaker: 'Narrador'}; history.push(m); currentScene.history = history; saveScenes(); }
  } else {
    currentChar.history = []; _saveChar();
    if (currentChar.greeting) { const m = {role: 'assistant', content: currentChar.greeting, ts: Date.now()}; history.push(m); currentChar.history = history; _saveChar(); }
  }
  renderMessages(); closeModal(); toast('Historial borrado');
}


function initChatSwipe() {
  const screen = document.getElementById('chat');
  screen.addEventListener('touchstart', e => {
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
  }, {passive: true});
  screen.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - swipeStartX;
    const dy = e.changedTouches[0].clientY - swipeStartY;
    const wrap = document.getElementById('chatContentWrap');
    // Si ya está swiped, cualquier toque lo restaura
    if (isSwiped) {
      isSwiped = false; wrap.classList.remove('swiped');
      return;
    }
    // Umbral más alto (90px, ratio 2:1) para evitar disparos accidentales al scrollear
    if (Math.abs(dx) > Math.abs(dy) * 2 && Math.abs(dx) > 90) {
      if (dx < 0) { isSwiped = true; wrap.classList.add('swiped'); document.getElementById('swipeHint').style.display = 'none'; }
    }
  }, {passive: true});
}
