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
      <span class="hitos-header-label">Registro de momentos importantes</span>
      <button class="hitos-system-btn ${enabled ? 'hitos-on' : 'hitos-off'}" onclick="toggleHitosSystem()">
        ${enabled ? '● Activo' : '○ Inactivo'}
      </button>
    </div>`;

  if (!enabled) {
    html += `
      <div class="hitos-disabled-msg">Sistema desactivado para este chat.</div>
      <button class="modal-btn" style="width:100%;margin-top:4px" onclick="closeModal()">Cerrar</button>`;
    mb.innerHTML = html;
    return;
  }

  if (!list.length) {
    html += `<div class="hitos-empty">Aún no hay hitos registrados.<br>Añade los momentos importantes de la historia.</div>`;
  } else {
    html += `<div class="hitos-list">`;
    list.forEach(h => {
      html += `
        <div class="hito-item">
          <div class="hito-body">
            <div class="hito-text">${esc(h.text)}</div>
            <div class="hito-date">${fmtDate(h.ts)}</div>
          </div>
          <button class="hito-del" onclick="deleteHito('${h.id}')">✕</button>
        </div>`;
    });
    html += `</div>`;
  }

  html += `
    <div class="hitos-add-row">
      <input class="hitos-inp" id="hitoInp" placeholder="Describe el hito…" maxlength="140"
        onkeydown="if(event.key==='Enter'){event.preventDefault();addHito()}">
      <button class="hitos-add-btn" onclick="addHito()">＋</button>
    </div>
    <button class="modal-btn" style="width:100%;margin-top:8px" onclick="closeModal()">Cerrar</button>`;

  mb.innerHTML = html;
  document.getElementById('hitoInp')?.focus();
}

function toggleHitosSystem() {
  const t = _hitosTarget();
  if (!t) return;
  t.hitosEnabled = !_hitosEnabled();
  _hitosSave();
  _renderHitos();
}

function addHito() {
  const inp = document.getElementById('hitoInp');
  const text = inp?.value.trim();
  if (!text) return;
  const t = _hitosTarget();
  if (!t) return;
  if (!t.hitos) t.hitos = [];
  t.hitos.unshift({ id: uid(), text, ts: Date.now() });
  _hitosSave();
  _renderHitos();
}

function deleteHito(id) {
  const t = _hitosTarget();
  if (!t) return;
  t.hitos = (t.hitos || []).filter(h => h.id !== id);
  _hitosSave();
  _renderHitos();
}
