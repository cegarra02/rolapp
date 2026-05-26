function showScreen(id, hideNav) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.getElementById('bottomNav').classList.toggle('hidden', !!hideNav);
}

function goHome() { showScreen('home'); renderChars(); setActiveTab('chars'); renderUserHeader(); }

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
  else if (tab === 'chars')    { showScreen('home');     renderChars();              setActiveTab('chars'); }
  else if (tab === 'scenes')   { renderScenesScreen();  showScreen('scenesScreen'); setActiveTab('chars'); }
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
