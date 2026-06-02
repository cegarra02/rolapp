function showScreen(id, hideNav) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.getElementById('bottomNav').classList.toggle('hidden', !!hideNav);
}

function goHome() { showScreen('home'); renderChars(); setActiveTab('chars'); _setActiveSubtab('chars'); renderUserHeader(); }

function openModal(title, actions) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = actions.map(a =>
    `<button class="modal-btn ${a.danger ? 'btn-danger' : ''}" onclick="${a.action}">${a.label}</button>`
  ).join('');
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal')) return;
  document.getElementById('modal').classList.add('hidden');
}

function switchTab(tab) {
  if      (tab === 'explore')  { renderExploreScreen(); showScreen('exploreScreen'); setActiveTab('explore'); }
  else if (tab === 'chars')    { showScreen('home');     renderChars();              setActiveTab('chars'); _setActiveSubtab('chars'); }
  else if (tab === 'scenes')   { renderScenesScreen();  showScreen('scenesScreen'); setActiveTab('chars'); _setActiveSubtab('scenes'); }
  else if (tab === 'chats')    { renderInboxScreen();   showScreen('chatsScreen');  setActiveTab('chats'); }
  else if (tab === 'missions') { renderMissionsScreen(); showScreen('missionsScreen'); setActiveTab('missions'); }
  else if (tab === 'profile')  {
    showScreen('profileScreen'); setActiveTab('profile');
    loadProfileFields(); // render inmediato con valor actual
    refreshGems().then(() => loadProfileFields()); // re-render con valor fresco de Supabase
  }
}

function setActiveTab(tab) {
  ['tabExplore', 'tabChars', 'tabChats', 'tabMissions', 'tabProfile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('active', id === 'tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
  });
}

// Resalta la subpestaña activa (Personajes / Escenas grupales) en Home y Escenas.
// Se basa en el destino del onclick para no depender de ids (las subpestañas
// aparecen en dos pantallas y solo la visible importa).
function _setActiveSubtab(tab) {
  document.querySelectorAll('.subtab').forEach(b => {
    const oc = b.getAttribute('onclick') || '';
    b.classList.toggle('active', oc.indexOf("switchTab('" + tab + "')") !== -1);
  });
}
