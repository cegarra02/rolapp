let dismissedChats = new Set(JSON.parse(localStorage.getItem('rp_dismissed') || '[]'));
function saveDismissed() { localStorage.setItem('rp_dismissed', JSON.stringify([...dismissedChats])); }

function inboxMarkActive(type, id) {
  const key = type + ':' + id;
  if (dismissedChats.has(key)) { dismissedChats.delete(key); saveDismissed(); }
}

function getInboxItems() {
  const items = [];
  chars.forEach(ch => {
    if (!ch.history?.length) return;
    if (dismissedChats.has('char:' + ch.id)) return;
    const last = ch.history[ch.history.length - 1];
    const preview = last.role === 'user' ? ('Tú: ' + last.content) : last.content;
    items.push({type:'char', id:ch.id, name:ch.name, bg:ch.bg, preview, ts:last.ts});
  });
  scenes.forEach(sc => {
    if (!sc.history?.length) return;
    if (dismissedChats.has('scene:' + sc.id)) return;
    const last = sc.history[sc.history.length - 1];
    const sceneChars = sc.charIds.map(id => chars.find(x => x.id === id)).filter(Boolean);
    const firstBg = sceneChars.find(ch => ch.bg)?.bg || null;
    const preview = last.role === 'user' ? ('Tú: ' + last.content) : (last.speaker ? last.speaker + ': ' + last.content : last.content);
    items.push({type:'scene', id:sc.id, name:sc.name, bg:firstBg, preview, ts:last.ts});
  });
  return items.sort((a, b) => b.ts - a.ts);
}

function fmtInboxTime(ts) {
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
  if (now - d < 7 * 86400000)
    return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][d.getDay()];
  return d.getDate() + '/' + (d.getMonth() + 1);
}

function renderInboxScreen() {
  const list = document.getElementById('inboxList');
  if (!list) return;
  const items = getInboxItems();
  if (!items.length) {
    list.innerHTML = '<div class="empty-state"><div class="icon">💬</div><p>Aquí aparecerán tus conversaciones<br>una vez hayas chateado con un personaje</p></div>';
    return;
  }
  list.innerHTML = items.map(item => {
    const avatar = item.bg
      ? `<div class="inbox-avatar" style="background-image:url('${item.bg}')"></div>`
      : `<div class="inbox-avatar inbox-avatar-ph">${item.type === 'scene' ? '⚡' : esc(item.name[0])}</div>`;
    return `<div class="inbox-row-wrap" data-type="${item.type}" data-id="${item.id}">
      <div class="inbox-del-btn">🗑</div>
      <div class="inbox-row">
        ${avatar}
        <div class="inbox-info">
          <div class="inbox-name">${esc(item.name)}</div>
          <div class="inbox-preview">${esc(item.preview.slice(0, 60))}</div>
        </div>
        <div class="inbox-time">${fmtInboxTime(item.ts)}</div>
      </div>
    </div>`;
  }).join('');
  initInboxSwipes();
}

let _openInboxRow = null;

function initInboxSwipes() {
  _openInboxRow = null;
  document.querySelectorAll('.inbox-row-wrap').forEach(wrap => {
    const row = wrap.querySelector('.inbox-row');
    const delBtn = wrap.querySelector('.inbox-del-btn');
    const DEL_W = 72, THRESH = 58;
    let startX = 0, startY = 0, curX = 0, tracking = false, axisLocked = false, isOpen = false;

    function snapTo(x) {
      row.style.transition = 'transform .22s cubic-bezier(.4,0,.2,1)';
      row.style.transform = `translateX(${x}px)`;
      isOpen = x < 0;
      if (isOpen) _openInboxRow = row;
      else if (_openInboxRow === row) _openInboxRow = null;
    }

    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      snapTo(0);
      deleteInboxChat(wrap.dataset.type, wrap.dataset.id);
    });

    row.addEventListener('click', () => {
      if (isOpen) { snapTo(0); return; }
      if (wrap.dataset.type === 'char') openChat(wrap.dataset.id);
      else openSceneChat(wrap.dataset.id);
    });

    row.addEventListener('touchstart', e => {
      if (_openInboxRow && _openInboxRow !== row) {
        _openInboxRow.style.transition = 'transform .22s cubic-bezier(.4,0,.2,1)';
        _openInboxRow.style.transform = 'translateX(0)';
        _openInboxRow = null;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      curX = isOpen ? -DEL_W : 0;
      tracking = true; axisLocked = false;
      row.style.transition = 'none';
    }, {passive: true});

    row.addEventListener('touchmove', e => {
      if (!tracking) return;
      const mx = e.touches[0].clientX - startX;
      const my = e.touches[0].clientY - startY;
      if (!axisLocked) {
        if (Math.abs(my) > Math.abs(mx) + 4) {
          tracking = false;
          row.style.transition = 'transform .22s cubic-bezier(.4,0,.2,1)';
          row.style.transform = `translateX(${isOpen ? -DEL_W : 0}px)`;
          return;
        }
        if (Math.abs(mx) > 4) axisLocked = true; else return;
      }
      curX = isOpen
        ? Math.max(-DEL_W, Math.min(0, -DEL_W + mx))
        : Math.max(-DEL_W, Math.min(0, mx));
      row.style.transform = `translateX(${curX}px)`;
    }, {passive: true});

    row.addEventListener('touchend', () => {
      if (!tracking) return; tracking = false;
      if (!axisLocked) return;
      if (isOpen) snapTo(curX > -(DEL_W - THRESH) ? 0 : -DEL_W);
      else snapTo(curX < -THRESH ? -DEL_W : 0);
    }, {passive: true});
  });
}

function deleteInboxChat(type, id) {
  openModal('Eliminar conversación', [
    {label: 'Sí, eliminar', action: `confirmDeleteInboxChat('${type}','${id}')`, danger: true},
    {label: 'Cancelar', action: 'closeModal()'}
  ]);
}

function confirmDeleteInboxChat(type, id) {
  dismissedChats.add(type + ':' + id);
  saveDismissed();
  closeModal();
  renderInboxScreen();
}
