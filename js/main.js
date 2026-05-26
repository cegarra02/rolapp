renderChars();
loadProfileFields();
initChatSwipe();
if (!missions.length) { document.getElementById('missionsEmpty').style.display = 'block'; }
initSupabase().catch(console.error);

// Deep link para OAuth (solo en app nativa Android)
if (window.Capacitor?.isNativePlatform?.()) {
  // Cold start: app lanzada directamente por el deep link (ej: OS mató la app mientras
  // Chrome Custom Tabs estaba abierto → al volver, appUrlOpen no se dispara).
  window.Capacitor.Plugins.App.getLaunchUrl().then(result => {
    if (result?.url) handleDeepLink(result.url);
  }).catch(() => {});

  // Warm start: deep link recibido mientras la app ya está en ejecución.
  window.Capacitor.Plugins.App.addListener('appUrlOpen', ({ url }) => {
    handleDeepLink(url);
  });
}
