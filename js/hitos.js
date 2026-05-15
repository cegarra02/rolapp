function showHitoNotif(text) {
  const el = document.getElementById('hitoToast');
  if (!el) return;
  document.getElementById('hitoToastText').textContent = text;
  el.classList.remove('show');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 5000);
  }));
}

function _hitosTarget() { return currentScene || currentChar || null; }

function _hitosEnabled() {
  const t = _hitosTarget();
  return t ? t.hitosEnabled !== false : false;
}

function _hitosSave() {
  if (currentScene) saveScenes();
  else if (currentChar) save();
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('es-ES', {day:'numeric', month:'short', year:'numeric'});
}

function openMilestonesModal() {
  closeModal();
  setTimeout(() => {
    openModal('📌 Hitos', []);
    _renderHitos();
  }, 50);
}

function _renderHitos() {
  const mb = document.getElementById('modalBody');
  if (!mb) return;
  const t = _hitosTarget();
  if (!t) return;
  const enabled = _hitosEnabled();
  const list = t.hitos || [];

  let html = `
    <div class="hitos-header">
      <span class="hitos-header-label">Momentos importantes</span>
      <button class="hitos-system-btn ${enabled ? 'hitos-on' : 'hitos-off'}" onclick="toggleHitosSystem()">
        ${enabled ? '● Activo' : '○ Inactivo'}
      </button>
    </div>`;

  if (!enabled) {
    const savedCount = list.length;
    html += `<div class="hitos-disabled-msg">
      Sistema pausado para este chat.${savedCount ? `<br><span style="color:var(--accent)">${savedCount} hito${savedCount > 1 ? 's' : ''} guardado${savedCount > 1 ? 's' : ''}</span>` : ''}
    </div>`;
    html += `<button class="modal-btn" style="width:100%;margin-top:8px" onclick="closeModal()">Cerrar</button>`;
    mb.innerHTML = html;
    return;
  }

  if (!list.length) {
    html += `<div class="hitos-empty">Los hitos se generan automáticamente cuando ocurre algo importante en la conversación.</div>`;
  } else {
    html += `<div class="hitos-list" id="hitosList">`;
    list.forEach(h => {
      html += `
        <div class="hito-item" data-id="${h.id}">
          <div class="hito-body">
            <div class="hito-text">${esc(h.text)}</div>
            <div class="hito-date">${fmtDate(h.ts)}</div>
          </div>
          <button class="hito-del" onclick="deleteHito('${h.id}')">✕</button>
        </div>`;
    });
    html += `</div>`;
  }

  html += `<button class="modal-btn" style="width:100%;margin-top:12px" onclick="closeModal()">Cerrar</button>`;
  mb.innerHTML = html;
}

function toggleHitosSystem() {
  const t = _hitosTarget();
  if (!t) return;
  t.hitosEnabled = !_hitosEnabled();
  _hitosSave();
  _renderHitos();
}

function deleteHito(id) {
  const item = document.querySelector(`.hito-item[data-id="${id}"]`);
  if (!item) return;
  item.innerHTML = `
    <div class="hito-confirm">
      <span class="hito-confirm-txt">¿Eliminar este hito?</span>
      <button class="hito-confirm-yes" onclick="confirmDeleteHito('${id}')">Eliminar</button>
      <button class="hito-confirm-no" onclick="_renderHitos()">Cancelar</button>
    </div>`;
}

function confirmDeleteHito(id) {
  const t = _hitosTarget();
  if (!t) return;
  t.hitos = (t.hitos || []).filter(h => h.id !== id);
  _hitosSave();
  _renderHitos();
}
