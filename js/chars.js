function renderChars() {
  const q = document.getElementById('searchInp').value.toLowerCase();
  const list = document.getElementById('charsList');
  const filtered = chars.filter(x => x.name.toLowerCase().includes(q) || (x.tag || '').toLowerCase().includes(q));
  if (!filtered.length) {
    list.style.display = 'block';
    list.innerHTML = `<div class="empty-state"><div class="icon">✦</div><p>${chars.length ? 'Ningún personaje encontrado.' : 'Crea tu primer personaje pulsando <strong>+</strong>'}</p></div>`;
    return;
  }
  list.style.display = '';
  list.innerHTML = filtered.map(x => `
    <div class="char-card" onclick="openChat('${x.id}')">
      ${x.bg
        ? `<div class="char-card-bg" style="background-image:url('${x.bg}')"></div>`
        : `<div class="char-card-bg-placeholder">${x.name[0]}</div>`
      }
      <div class="char-card-body">
        <div class="char-card-name">${esc(x.name)}</div>
        ${x.tag ? `<span class="char-card-tag">${esc(x.tag)}</span>` : ''}
      </div>
      <div class="char-card-edit" onclick="event.stopPropagation();openEdit('${x.id}')">✎</div>
    </div>
  `).join('');
}

function pickGender(g) {
  tempGender = tempGender === g ? null : g;
  ['M','F'].forEach(x => document.getElementById('gender'+x)?.classList.toggle('active', tempGender === x));
}

function openCreate() {
  editId = null; tempBg = null; tempGender = null;
  tempRefPhotos = []; tempActiveRefPhoto = 0;
  ['M','F'].forEach(x => document.getElementById('gender'+x)?.classList.remove('active'));
  document.getElementById('editTitle').textContent = 'Nuevo personaje';
  document.getElementById('deleteBtn').style.display = 'none';
  ['charName', 'charTag', 'charAge', 'charShoeSize', 'charDesc', 'charContext', 'charGreeting'].forEach(id => {
    const e = document.getElementById(id); if (e) e.value = '';
  });
  resetSlot('bgSlot', '🖼️');
  initSliders(null);
  const cp = document.getElementById('charUseCustomProfile');
  if (cp) { cp.checked = false; toggleCustomProfile(false); }
  ['charCpName', 'charCpDesc', 'charCpContext', 'charCpPrefs'].forEach(id => {
    const e = document.getElementById(id); if (e) e.value = '';
  });
  renderRefPhotos();
  showScreen('editScreen', true);
}

function openEdit(id) {
  const c = chars.find(x => x.id === id); if (!c) return;
  editId = id; tempBg = c.bg || null; tempGender = c.gender || null;
  tempRefPhotos = [...(c.refPhotos || [])];
  tempActiveRefPhoto = c.activeRefPhoto ?? 0;
  ['M','F'].forEach(x => document.getElementById('gender'+x)?.classList.toggle('active', tempGender === x));
  document.getElementById('editTitle').textContent = 'Editar personaje';
  document.getElementById('deleteBtn').style.display = 'block';
  document.getElementById('charName').value = c.name || '';
  document.getElementById('charTag').value = c.tag || '';
  document.getElementById('charAge').value = c.age || '';
  document.getElementById('charShoeSize').value = c.shoeSize || '';
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
  renderRefPhotos();
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
  const c = {
    id: editId || uid(),
    name,
    tag:      document.getElementById('charTag').value.trim(),
    age:      document.getElementById('charAge').value.trim(),
    shoeSize: document.getElementById('charShoeSize').value.trim(),
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
    refPhotos:       [...tempRefPhotos],
    activeRefPhoto:  tempActiveRefPhoto,
    history: []
  };
  if (editId) {
    const i = chars.findIndex(x => x.id === editId);
    if (i > -1) {
      c.history   = chars[i].history   || [];
      c.chatStyle = chars[i].chatStyle || null;
      chars[i] = c;
    }
  } else {
    chars.unshift(c);
  }
  save(); toast('Guardado ✓'); goHome();
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
  save(); closeModal(); goHome(); toast('Personaje eliminado');
}

// ── REF PHOTOS ──
function renderRefPhotos() {
  const grid = document.getElementById('refPhotosGrid');
  if (!grid) return;
  const slots = [];
  for (let i = 0; i < 4; i++) {
    const photo = tempRefPhotos[i];
    if (photo) {
      const isActive = i === tempActiveRefPhoto;
      slots.push(`
        <div class="ref-photo-slot${isActive ? ' rp-active' : ''}" onclick="setActiveRefPhoto(${i})">
          <img src="${photo}" alt="">
          ${isActive ? '<div class="ref-photo-star">★</div>' : ''}
          <div class="ref-photo-del" onclick="event.stopPropagation();removeRefPhoto(${i})">✕</div>
        </div>`);
    } else if (i === tempRefPhotos.length) {
      slots.push(`<div class="ref-photo-slot ref-photo-add-slot" onclick="triggerRefPhotoUpload()"><div class="ref-photo-add-icon">+</div></div>`);
    } else {
      slots.push(`<div class="ref-photo-slot ref-photo-placeholder"></div>`);
    }
  }
  grid.innerHTML = slots.join('');
}

function triggerRefPhotoUpload() {
  if (tempRefPhotos.length >= 4) return;
  document.getElementById('refPhotoFile').click();
}

function loadRefPhoto(inp) {
  const file = inp.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    const compressed = await compressImage(e.target.result, 512);
    tempRefPhotos.push(compressed);
    if (tempRefPhotos.length === 1) tempActiveRefPhoto = 0;
    renderRefPhotos();
  };
  reader.readAsDataURL(file);
  inp.value = '';
}

function setActiveRefPhoto(idx) {
  if (!tempRefPhotos[idx]) return;
  tempActiveRefPhoto = idx;
  renderRefPhotos();
}

function removeRefPhoto(idx) {
  tempRefPhotos.splice(idx, 1);
  if (tempActiveRefPhoto >= tempRefPhotos.length) {
    tempActiveRefPhoto = Math.max(0, tempRefPhotos.length - 1);
  }
  renderRefPhotos();
}
