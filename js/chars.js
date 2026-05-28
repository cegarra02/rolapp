let editTags = [];

function renderChars() {
  const q = document.getElementById('searchInp').value.toLowerCase();
  const list = document.getElementById('charsList');
  const filtered = chars.filter(x => {
    const tags = x.tags || (x.tag ? [x.tag] : []);
    return x.name.toLowerCase().includes(q) || tags.some(t => t.toLowerCase().includes(q));
  });
  if (!filtered.length) {
    list.style.display = 'block';
    list.innerHTML = `<div class="empty-state"><div class="icon">✦</div><p>${chars.length ? 'Ningún personaje encontrado.' : 'Crea tu primer personaje pulsando <strong>+</strong>'}</p></div>`;
    return;
  }
  list.style.display = '';
  list.innerHTML = filtered.map(x => {
    const tags = x.tags || (x.tag ? [x.tag] : []);
    return `
    <div class="char-card" onclick="openChat('${x.id}')">
      ${x.bg
        ? `<div class="char-card-bg" style="background-image:url('${x.bg}')"></div>`
        : `<div class="char-card-bg-placeholder">${x.name[0]}</div>`
      }
      <div class="char-card-body">
        <div class="char-card-name">${esc(x.name)}</div>
        <div>${tags.map(t => tagBadgeHtml(t)).join('')}</div>
      </div>
      <div class="char-card-edit" onclick="event.stopPropagation();openEdit('${x.id}')">✎</div>
    </div>`;
  }).join('');
}

function renderEditTags() {
  document.getElementById('tagChipsList').innerHTML = editTags.map(t => tagChipHtml(t)).join('');
}

function handleTagInputKey(e) {
  if (e.key === 'Enter') { e.preventDefault(); addTagFromInput(); }
  if (e.key === 'Backspace' && !e.target.value && editTags.length) {
    editTags.pop(); renderEditTags();
  }
}

function onTagInput(inp) {
  clearTimeout(inp._tagTimer);
  inp._tagTimer = setTimeout(() => {
    if (inp.value.includes(' ') || inp.value.includes(',')) addTagFromInput();
  }, 50);
}

function addTagFromInput() {
  const inp = document.getElementById('tagInp');
  const words = inp.value.split(/[\s,]+/).map(w => w.trim()).filter(Boolean);
  inp.value = '';
  words.forEach(val => {
    if (!editTags.includes(val) && editTags.length < 5) editTags.push(val);
  });
  renderEditTags();
}

function removeEditTag(tag) {
  editTags = editTags.filter(t => t !== tag);
  renderEditTags();
}

function pickGender(g) {
  tempGender = tempGender === g ? null : g;
  ['M','F'].forEach(x => document.getElementById('gender'+x)?.classList.toggle('active', tempGender === x));
}

function openCreate() {
  editId = null; tempBg = null; tempGender = null; editTags = [];
  ['M','F'].forEach(x => document.getElementById('gender'+x)?.classList.remove('active'));
  document.getElementById('editTitle').textContent = 'Nuevo personaje';
  document.getElementById('deleteBtn').style.display = 'none';
  ['charName', 'charAge', 'charDesc', 'charContext', 'charGreeting'].forEach(id => {
    const e = document.getElementById(id); if (e) e.value = '';
  });
  renderEditTags();
  resetSlot('bgSlot', '🖼️');
  initSliders(null);
  const cp = document.getElementById('charUseCustomProfile');
  if (cp) { cp.checked = false; toggleCustomProfile(false); }
  ['charCpName', 'charCpDesc', 'charCpContext', 'charCpPrefs'].forEach(id => {
    const e = document.getElementById(id); if (e) e.value = '';
  });
  const charIsPublic = document.getElementById('charIsPublic');
  if (charIsPublic) charIsPublic.checked = false; // nuevo personaje empieza sin publicar
  const ptCard = document.getElementById('publicToggleCard');
  if (ptCard) ptCard.style.display = supabaseUser ? 'block' : 'none';
  showScreen('editScreen', true);
}

function openEdit(id) {
  const c = chars.find(x => x.id === id); if (!c) return;
  editId = id; tempBg = c.bg || null; tempGender = c.gender || null;
  editTags = c.tags ? [...c.tags] : (c.tag ? [c.tag] : []);
  ['M','F'].forEach(x => document.getElementById('gender'+x)?.classList.toggle('active', tempGender === x));
  document.getElementById('editTitle').textContent = 'Editar personaje';
  document.getElementById('deleteBtn').style.display = 'block';
  document.getElementById('charName').value = c.name || '';
  renderEditTags();
  document.getElementById('charAge').value = c.age || '';
  document.getElementById('charDesc').value = c.desc || '';
  document.getElementById('charContext').value = c.context || '';
  document.getElementById('charGreeting').value = c.greeting || '';
  setSlotImg('bgSlot', c.bg, '🖼️');
  initSliders(c);
  const cp = document.getElementById('charUseCustomProfile');
  if (cp) {
    cp.checked = !!c.useCustomProfile;
    toggleCustomProfile(!!c.useCustomProfile);
    const p = c.customProfile || {};
    document.getElementById('charCpName').value    = p.name    || '';
    document.getElementById('charCpDesc').value    = p.desc    || '';
    document.getElementById('charCpContext').value = p.context || '';
    document.getElementById('charCpPrefs').value   = p.prefs   || '';
  }
  const charIsPublic = document.getElementById('charIsPublic');
  if (charIsPublic) charIsPublic.checked = !!c.isPublic; // recupera el estado guardado
  const ptCard = document.getElementById('publicToggleCard');
  if (ptCard) ptCard.style.display = supabaseUser ? 'block' : 'none';
  showScreen('editScreen', true);
}

function toggleCustomProfile(checked) {
  const fields = document.getElementById('charCustomProfileFields');
  if (fields) fields.style.display = checked ? 'block' : 'none';
}

function resetSlot(slotId, icon) {
  const s = document.getElementById(slotId);
  s.innerHTML = `<div class="photo-slot-icon">${icon}</div><div class="overlay">✎</div>`;
}

function setSlotImg(slotId, src, fallback) {
  const s = document.getElementById(slotId);
  if (src) { s.innerHTML = `<img src="${src}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"><div class="overlay">✎</div>`; }
  else resetSlot(slotId, fallback);
}

function triggerFile(id) {
  document.getElementById(id).click();
}

function loadPhoto(inp, type) {
  const file = inp.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    openCropper(e.target.result, 'free', 'Ajustar fondo de chat', result => {
      tempBg = result; setSlotImg('bgSlot', result, '🖼️');
    });
  };
  reader.readAsDataURL(file);
  inp.value = '';
}

function saveChar() {
  const name = document.getElementById('charName').value.trim();
  if (!name) { toast('El personaje necesita un nombre'); return; }
  const useCustom = document.getElementById('charUseCustomProfile')?.checked || false;
  const existingChar = editId ? chars.find(x => x.id === editId) : null;
  // submittedToLibrary:true → INSERT confirmado; false/undefined → pendiente o fallido (se puede reintentar)
  const wasSubmitted = !!(existingChar?.submittedToLibrary);
  const isPublicNow = !!(document.getElementById('charIsPublic')?.checked && supabaseUser);
  const c = {
    id: editId || uid(),
    name,
    tags:     [...editTags],
    tag:      editTags[0] || '',
    age:      document.getElementById('charAge').value.trim(),
    desc:     document.getElementById('charDesc').value.trim(),
    context:  document.getElementById('charContext').value.trim(),
    greeting: document.getElementById('charGreeting').value.trim(),
    bg:       tempBg,
    gender:   tempGender,
    timid:    parseInt(document.getElementById('slTimid').value),
    romantic: parseInt(document.getElementById('slRomantic').value),
    pace:     parseInt(document.getElementById('slPace').value),
    nsfw:     parseInt(document.getElementById('slNsfw').value),
    useCustomProfile: useCustom,
    customProfile: useCustom ? {
      name:    document.getElementById('charCpName').value.trim(),
      desc:    document.getElementById('charCpDesc').value.trim(),
      context: document.getElementById('charCpContext').value.trim(),
      prefs:   document.getElementById('charCpPrefs').value.trim()
    } : null,
    isPublic: isPublicNow,
    history: []
  };
  if (editId) {
    const i = chars.findIndex(x => x.id === editId);
    if (i > -1) {
      c.history            = chars[i].history            || [];
      c.chatStyle          = chars[i].chatStyle          || null;
      c.hitos              = chars[i].hitos              || [];
      c.submittedToLibrary = chars[i].submittedToLibrary; // preservar estado de envío
      if (chars[i].hitosEnabled === false) c.hitosEnabled = false;
      chars[i] = c;
    }
  } else {
    chars.unshift(c);
  }
  // Marcar como envío pendiente antes de guardar: si el INSERT falla, queda en false
  // y el usuario puede reintentar guardando de nuevo (wasSubmitted será false).
  if (!wasSubmitted && isPublicNow) {
    c.submittedToLibrary = false;
  }
  save(); syncChars(); goHome();
  toast('Guardado ✓');
  if (!wasSubmitted && isPublicNow) {
    submitCharToLibrary(c).then(() => {
      // INSERT confirmado: marcar como enviado para no duplicar en ediciones posteriores
      const idx = chars.findIndex(x => x.id === c.id);
      if (idx > -1) { chars[idx].submittedToLibrary = true; save(); }
    }).catch(e => {
      console.error('[submitChar] error final:', e?.message, e?.code);
      // submittedToLibrary queda en false → reintento automático al guardar de nuevo
    });
  }
}

function deleteChar() {
  if (!editId) return;
  openModal('Eliminar personaje', [
    {label: 'Sí, eliminar', action: `confirmDelete('${editId}')`, danger: true},
    {label: 'Cancelar',     action: 'closeModal()'}
  ]);
}

function confirmDelete(id) {
  chars = chars.filter(x => x.id !== id);
  save(); syncChars(); closeModal(); goHome(); toast('Personaje eliminado');
}

