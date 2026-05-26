renderChars();
loadProfileFields();
initChatSwipe();
if (!missions.length) { document.getElementById('missionsEmpty').style.display = 'block'; }
initSupabase().catch(console.error);

// Deep link listener para OAuth (solo en app nativa Android)
if (window.Capacitor?.isNativePlatform?.()) {
  window.Capacitor.Plugins.App.addListener('appUrlOpen', ({ url }) => {
    handleDeepLink(url);
  });
}
