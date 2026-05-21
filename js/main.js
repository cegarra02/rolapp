renderChars();
loadProfileFields();
initChatSwipe();
if (!missions.length) { document.getElementById('missionsEmpty').style.display = 'block'; }
initSupabase().catch(console.error);
