// Migración: personajes con isPublic:true creados antes de añadir submittedToLibrary
// se marcan como ya enviados para que no se reenvíen en la próxima edición.
(function _migrateSubmittedToLibrary() {
  let changed = false;
  chars.forEach(c => {
    if (c.isPublic && c.submittedToLibrary === undefined) { c.submittedToLibrary = true; changed = true; }
  });
  if (changed) save();
})();

if (typeof _loadPersonas === 'function') _loadPersonas(); // perfil-jugador → profile activo
renderChars();
loadProfileFields();
initChatSwipe();
if (!missions.length) { document.getElementById('missionsEmpty').style.display = 'block'; }
initSupabase().catch(console.error);

// Inicializar plugins nativos de monetización (solo Android nativo)
if (window.Capacitor?.isNativePlatform?.()) {
  initAdMob().catch(console.error);
  initBilling().catch(console.error);
}

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
