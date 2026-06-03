// ── i18n.js — Traducción ES/EN ───────────────────────────────────────────────
//
// Estrategia: el código fuente está en español. Para inglés, se traducen los
// nodos de texto y los placeholders del DOM usando un diccionario es→en, y un
// MutationObserver re-traduce el contenido que el JS genera dinámicamente
// (igual que hace icons.js con los iconos). No requiere marcar el HTML.
//
// Para volver a español se usa el mapa inverso. Se ignora el contenido de
// usuario (nombres de personaje, mensajes de chat, inputs) para no traducirlo.
// ─────────────────────────────────────────────────────────────────────────────

// Diccionario español → inglés (solo cadenas de interfaz)
const I18N_EN = {
  // Nav / cabeceras
  'Explorar': 'Explore', 'Personajes': 'Characters', 'Chats': 'Chats', 'Mi Perfil': 'My Profile',
  'Escenas grupales': 'Group scenes', 'Escenas': 'Scenes', 'Sin límites, tus reglas': 'No limits, your rules',
  'Tus conversaciones': 'Your conversations', 'Personajes de la comunidad': 'Community characters',
  'Roleplay grupal': 'Group roleplay', 'Roleplay con múltiples personajes': 'Roleplay with multiple characters',
  // Onboarding
  'Crea personajes y vive historias sin límites.': 'Create characters and live stories without limits.',
  'Tus reglas, tu mundo. Habla con quien imagines, cuando quieras.': 'Your rules, your world. Talk to anyone you imagine, whenever you want.',
  'Continuar con Google': 'Continue with Google', 'Explorar sin cuenta': 'Explore without an account',
  // Crear/editar personaje
  'Nuevo personaje': 'New character', 'Editar personaje': 'Edit character', 'Fotos': 'Photos',
  'Fondo del chat': 'Chat background', 'Nombre del personaje': 'Character name', 'Etiquetas': 'Tags',
  'Sexo del personaje': 'Character gender', '♂ Masculino': '♂ Male', '♀ Femenino': '♀ Female',
  'Masculino': 'Male', 'Femenino': 'Female', 'Edad': 'Age', 'Descripción breve': 'Short description',
  'Contexto / Instrucciones (prompt del sistema)': 'Context / Instructions (system prompt)',
  'Personalidad y comportamiento': 'Personality and behavior',
  'Muy tímido': 'Very shy', 'Muy seguro': 'Very confident', 'Muy cerrado': 'Very closed',
  'Muy abierto': 'Very open', 'Muy lento': 'Very slow', 'Muy rápido': 'Very fast',
  'Solo insinuaciones': 'Hints only', 'Explícito total': 'Fully explicit',
  'Mensaje de bienvenida': 'Welcome message', 'Perfil del jugador personalizado': 'Custom player profile',
  'Usa datos distintos a "Mi Perfil" en este chat': 'Use different data than "My Profile" in this chat',
  'Usa datos distintos a "Mi Perfil" en esta escena': 'Use different data than "My Profile" in this scene',
  'Tu nombre en este chat': 'Your name in this chat', 'Tu nombre en esta escena': 'Your name in this scene',
  'Tu descripción': 'Your description', 'Contexto del jugador': 'Player context', 'Preferencias': 'Preferences',
  'Hacer público': 'Make public', 'Enviar a la biblioteca de la comunidad para revisión': 'Submit to the community library for review',
  'Guardar personaje': 'Save character', 'Eliminar personaje': 'Delete character', 'Misiones': 'Missions',
  '← desliza': '← swipe',
  // Cropper
  'Ajustar imagen': 'Adjust image', 'Arrastra · pellizca para zoom': 'Drag · pinch to zoom',
  'Cancelar': 'Cancel', '✓ Usar imagen': '✓ Use image',
  // Escenas
  'Nueva escena grupal': 'New group scene', 'Editar escena': 'Edit scene', 'Nombre de la escena': 'Scene name',
  'Selecciona personajes (mín. 2)': 'Select characters (min. 2)', 'Contexto de la escena': 'Scene context',
  'Mensaje inicial (opcional)': 'Opening message (optional)', 'Crear escena': 'Create scene', 'Eliminar escena': 'Delete scene',
  'Sin personajes': 'No characters', 'Escena grupal': 'Group scene',
  // Explorar / moderación
  'Nuevos': 'New', 'Populares': 'Popular', 'Moderación': 'Moderation', 'Envíos pendientes': 'Pending submissions',
  '+ Añadir': '+ Add', 'Revisión de personaje': 'Character review', 'Personaje': 'Character',
  'Gestionar personaje de biblioteca': 'Manage library character', 'Probar': 'Test', 'Aprobar': 'Approve',
  'Rechazar': 'Reject', 'Eliminar permanentemente': 'Delete permanently',
  // Perfil
  'Completa retos en tus roleplays': 'Complete challenges in your roleplays', 'Completadas': 'Completed',
  'Activas': 'Active', 'Racha': 'Streak', 'Medallas conseguidas': 'Medals earned',
  'Tu nombre / alias': 'Your name / alias', 'Tu género': 'Your gender', 'Estatura': 'Height',
  'Preferencias de roleplay': 'Roleplay preferences', 'Guardar mi perfil': 'Save my profile',
  'Apariencia': 'Appearance', 'Crepúsculo': 'Dusk', 'Idioma': 'Language', 'Español': 'Spanish', 'English': 'English',
  'Panel de moderación': 'Moderation panel', 'Cerrar sesión': 'Sign out', 'Administración': 'Administration',
  // Tienda de gemas
  'Tienda de Gemas': 'Gem Shop', 'Tu saldo actual': 'Your current balance',
  'Packs Especiales — 1 compra por semana': 'Special Packs — 1 purchase per week',
  '— O GANA GRATIS —': '— OR EARN FREE —', 'Ver anuncio · Ganar 4–9 gemas gratis': 'Watch ad · Earn 4–9 free gems',
  '📺 Ver anuncio · Solo en app Android': '📺 Watch ad · Android app only',
  // VIP
  'Desbloquea la experiencia completa, sin límites.': 'Unlock the full experience, without limits.',
  'Recompensas diarias': 'Daily rewards', 'Reclama gemas gratis cada día de la semana': 'Claim free gems every day of the week',
  'Gemas con descuento': 'Discounted gems', 'Mejores precios en todos los paquetes': 'Better prices on all packages',
  'Respuestas más rápidas': 'Faster responses', 'Prioridad de generación y modelo mejorado': 'Generation priority and improved model',
  'Personajes ilimitados': 'Unlimited characters', 'Crea y guarda todos los que quieras': 'Create and save as many as you want',
  'Insignia VIP': 'VIP badge', 'Destaca en la comunidad': 'Stand out in the community',
  'Eres Storym VIP': 'You are Storym VIP', 'Renovación mensual · activa': 'Monthly renewal · active',
  'Renovación anual · activa': 'Annual renewal · active', 'Cancelar suscripción': 'Cancel subscription',
  'MÁS POPULAR': 'MOST POPULAR', 'Mensual': 'Monthly', 'Empezar ahora': 'Start now', 'Anual': 'Annual',
  'Ahorra un 37%': 'Save 37%', 'Cancela cuando quieras. La suscripción se renueva automáticamente.': 'Cancel anytime. The subscription renews automatically.',
  'Hazte VIP': 'Get VIP', 'Hazte VIP para reclamar el premio mejorado': 'Get VIP to claim the upgraded reward',
  'Recompensa diaria': 'Daily reward', 'Entra cada día y reclama gemas': 'Come back daily and claim gems',
  'Se reinicia cada lunes': 'Resets every Monday', 'Reclamar': 'Claim',
  // Empty states / varios
  'Crea tu primer personaje pulsando': 'Create your first character by tapping',
  'Crea tu primera escena grupal pulsando': 'Create your first group scene by tapping',
  'Ningún personaje encontrado.': 'No characters found.', 'Cargando…': 'Loading…',
  'Error al cargar. Comprueba tu conexión.': 'Failed to load. Check your connection.',
  '🔄 Reintentar': '🔄 Retry', 'Sin etiquetas': 'No tags', 'Todos': 'All',
  'años': 'years old',
  // Hitos
  'Momentos importantes': 'Key moments', 'Hitos': 'Milestones', '● Activo': '● Active', '○ Inactivo': '○ Inactive',
  'Cerrar': 'Close', '¿Eliminar este hito?': 'Delete this milestone?', 'Eliminar': 'Delete',
  // Toasts
  'Guardado ✓': 'Saved ✓', 'Personaje eliminado': 'Character deleted', 'Escena guardada ✓': 'Scene saved ✓',
  'Escena eliminada': 'Scene deleted', 'Estilo guardado ✓': 'Style saved ✓', 'Estilo restablecido': 'Style reset',
  'Perfil guardado ✓': 'Profile saved ✓', 'Historial borrado': 'History cleared', 'Eliminado': 'Deleted',
  'Eliminado de la biblioteca': 'Removed from library', 'El personaje necesita un nombre': 'The character needs a name',
  'La escena necesita un nombre': 'The scene needs a name', 'Selecciona al menos 2 personajes': 'Select at least 2 characters',
  'Sesión iniciada ✓': 'Signed in ✓', 'Sesión cerrada': 'Signed out', 'Crea personajes primero': 'Create characters first',
  'Inicia sesión para comprar gemas': 'Sign in to buy gems', 'Inicia sesión para publicar personajes': 'Sign in to publish characters',
  'Ya has comprado este pack esta semana': 'You already bought this pack this week',
  'Las compras solo están disponibles en la app Android': 'Purchases are only available in the Android app',
  'Configura tu API Key en Mi Perfil primero': 'Set up your API Key in My Profile first',
  '⚠️ Almacenamiento lleno: no se pudo guardar': '⚠️ Storage full: could not save',
  '⚠️ Almacenamiento lleno: no se pudo guardar la escena': '⚠️ Storage full: could not save the scene',
  // Placeholders
  'Buscar personajes…': 'Search characters…', 'Ej: Serafina, Viktor, Kira…': 'e.g. Serafina, Viktor, Kira…',
  'Añadir etiqueta…': 'Add tag…', 'Ej: 24': 'e.g. 24', 'Ej: 22': 'e.g. 22', 'Ej: 175 cm': 'e.g. 175 cm',
  '¿Cómo es este personaje? Apariencia, personalidad, voz…': 'What is this character like? Appearance, personality, voice…',
  'Describe aquí cómo debe comportarse el personaje, su mundo, restricciones, objetivos, tono… Sin límites creativos.': 'Describe how the character should behave, their world, restrictions, goals, tone… No creative limits.',
  'El primer mensaje que enviará el personaje…': 'The first message the character will send…',
  'Nombre del jugador': 'Player name', 'Aspecto, personalidad…': 'Appearance, personality…',
  'Qué sabe el personaje sobre ti…': 'What the character knows about you…',
  'Géneros, límites, idioma…': 'Genres, limits, language…', 'Escribe algo…': 'Type something…',
  'Ej: La taberna, El apartamento…': 'e.g. The tavern, The apartment…',
  'Describe el escenario, qué está pasando, el tono de la escena… Todos los personajes lo compartirán.': 'Describe the setting, what is happening, the scene tone… All characters will share it.',
  'El primer mensaje que arranca la escena…': 'The first message that starts the scene…',
  'Qué saben los personajes sobre ti…': 'What the characters know about you…',
  'Buscar etiqueta…': 'Search tag…', 'Cantidad': 'Amount',
  '¿Cómo te llamas tú en el roleplay?': 'What is your name in the roleplay?',
  'Tu aspecto, personalidad, quién eres en estas historias…': 'Your appearance, personality, who you are in these stories…',
  'Géneros favoritos, cosas que siempre quieres incluir, límites, idioma preferido…': 'Favorite genres, things you always want to include, limits, preferred language…',
  // Sliders de personalidad
  'Timidez': 'Shyness', 'Apertura romántica': 'Romantic openness', 'Ritmo de escalada': 'Escalation pace',
  'Nivel NSFW máximo': 'Max NSFW level',
  // Chip informativo bajo el perfil del jugador
  'El personaje sabrá esto sobre ti en cada chat': 'The character will know this about you in every chat',
  'Los personajes sabrán esto sobre ti en cada chat': 'The characters will know this about you in every chat',
  // Botón guardar perfil
  'Guardar perfil': 'Save profile',
  // Menú del chat (⋮)
  'Estilo del chat': 'Chat style', 'Limpiar historial': 'Clear history', 'Ir a Misiones': 'Go to Missions',
  // Panel de estilo de chat
  'Color de tus burbujas': 'Your bubble color', 'Tamaño de fuente': 'Font size',
  'Transparencia de tus burbujas': 'Your bubble opacity', 'Vista previa': 'Preview',
  'Restablecer': 'Reset', 'Guardar': 'Save', 'Editar': 'Edit',
  '"Te esperaba."': '"I was waiting for you."', 'Y yo a ti.': 'And you too.', 'sonríe': 'smiles',
  // Hitos
  'Sistema pausado para este chat.': 'System paused for this chat.',
  'Los hitos se generan automáticamente cuando ocurre algo importante en la conversación.': 'Milestones are generated automatically when something important happens in the conversation.',
  // Tienda de gemas
  'Inicio': 'Starter', 'Pro': 'Pro', 'Mega': 'Mega', 'Elite': 'Elite', 'Popular': 'Popular',
  '+33% GRATIS': '+33% FREE', '+53% GRATIS': '+53% FREE', 'MEJOR VALOR': 'BEST VALUE',
  'precio habitual': 'regular price', '1 compra / semana': '1 purchase / week',
  'Cargando anuncio…': 'Loading ad…', 'Ver anuncio · Ganar 4–9': 'Watch ad · Earn 4–9', 'gratis': 'free',
  // Recompensas
  'Lun': 'Mon', 'Mar': 'Tue', 'Mié': 'Wed', 'Jue': 'Thu', 'Vie': 'Fri', 'Sáb': 'Sat', 'Dom': 'Sun',
  '¡Premio de hoy reclamado!': "Today's reward claimed!", 'Elige tu recompensa': 'Choose your reward',
  'Recompensas exclusivas VIP': 'Exclusive VIP rewards', 'Recompensas VIP': 'VIP rewards',
  'Reclamado': 'Claimed', 'Reclamada': 'Claimed', 'gemas': 'gems',
  // Etiquetas comunes (para que se entiendan en cada idioma)
  'Romance': 'Romance', 'Fantasía': 'Fantasy', 'Aventura': 'Adventure', 'Drama': 'Drama',
  'Misterio': 'Mystery', 'Histórico': 'Historical', 'Ciencia ficción': 'Sci-fi', 'Terror': 'Horror',
  'Comedia': 'Comedy', 'Acción': 'Action', 'Anime': 'Anime', 'Original': 'Original',
  'Fantasía oscura': 'Dark fantasy', 'Sobrenatural': 'Supernatural', 'Escolar': 'School life',
  'Vampiros': 'Vampires', 'Magia': 'Magic', 'Amistad': 'Friendship', 'Celos': 'Jealousy',
  'Enemigos a amantes': 'Enemies to lovers', 'Slice of life': 'Slice of life', 'Romántico': 'Romantic',
};

// Prefijos con texto interpolado (nombre, día…): traduce solo el prefijo.
const I18N_PREFIX_EN = [
  ['Color de las burbujas de ', 'Bubble color of '],
  ['Transparencia de ', 'Opacity of '],
  ['HOY · ', 'TODAY · '],
  ['Vuelve mañana por +', 'Come back tomorrow for +'],
  ['Generar misiones para ', 'Generate missions for '],
];
const I18N_PREFIX_ES = I18N_PREFIX_EN.map(p => [p[1], p[0]]);

// Mapa inverso (en→es). Se omiten valores duplicados para evitar ambigüedad.
const I18N_ES = (function () {
  const r = {}, seen = {};
  for (const es in I18N_EN) { const en = I18N_EN[es]; if (seen[en]) continue; seen[en] = 1; r[en] = es; }
  return r;
})();

let _lang = (function () { try { return localStorage.getItem('storym_lang') || 'es'; } catch (e) { return 'es'; } })();

// Traducción puntual para cadenas en JS: t('Guardado ✓')
function t(es) { return _lang === 'en' ? (I18N_EN[es] || es) : es; }

// No traducir contenido de usuario ni controles (las etiquetas SÍ se traducen)
const _I18N_SKIP = '.bubble,.messages,.msg,.msg-wrap,.chat-input,input,textarea,[contenteditable],' +
  '.char-card-name,.scene-card-name,.scene-card-chars,.inbox-name,.inbox-preview,.chat-hdr-name,' +
  '.bubble-speaker,.uhc-gems,.hito-text,.auth-user-name,.auth-user-email,.onb-card,script,style,.ic,svg';

// Traduce una cadena ya recortada (trim). Devuelve la traducción o null si no aplica.
// Primero intenta coincidencia exacta; si no, prueba los prefijos interpolados.
function _xlate(key, map, prefixes) {
  if (map[key]) return map[key];
  for (let i = 0; i < prefixes.length; i++) {
    if (key.indexOf(prefixes[i][0]) === 0) return prefixes[i][1] + key.slice(prefixes[i][0].length);
  }
  return null;
}

function _translateNode(node, map, prefixes) {
  if (!node || (node.nodeType !== 1 && node.nodeType !== 9)) return;
  if (node.nodeType === 1 && node.closest && node.closest(_I18N_SKIP)) return;
  // Placeholders
  const inputs = [];
  if (node.matches && node.matches('input[placeholder],textarea[placeholder]')) inputs.push(node);
  if (node.querySelectorAll) node.querySelectorAll('input[placeholder],textarea[placeholder]').forEach(el => inputs.push(el));
  inputs.forEach(el => {
    const ph = el.getAttribute('placeholder');
    const key = ph && ph.trim();
    const tr = key && _xlate(key, map, prefixes);
    if (tr) el.setAttribute('placeholder', ph.replace(key, tr));
  });
  // Nodos de texto
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
    acceptNode: function (n) {
      const key = n.nodeValue && n.nodeValue.trim();
      if (!key || !_xlate(key, map, prefixes)) return NodeFilter.FILTER_REJECT;
      if (n.parentElement && n.parentElement.closest(_I18N_SKIP)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = []; let cur;
  while ((cur = walker.nextNode())) nodes.push(cur);
  nodes.forEach(n => { const key = n.nodeValue.trim(); const tr = _xlate(key, map, prefixes); if (tr) n.nodeValue = n.nodeValue.replace(key, tr); });
}

function setLanguage(lang) {
  lang = (lang === 'en') ? 'en' : 'es';
  const map = (lang === 'en') ? I18N_EN : I18N_ES;
  const prefixes = (lang === 'en') ? I18N_PREFIX_EN : I18N_PREFIX_ES;
  if (lang === _lang) { if (lang === 'en') _translateNode(document.body, I18N_EN, I18N_PREFIX_EN); return; }
  _lang = lang;
  try { localStorage.setItem('storym_lang', lang); } catch (e) {}
  document.documentElement.lang = lang;
  _translateNode(document.body, map, prefixes);
}

// Re-traducir el contenido que el JS inserta dinámicamente (solo si estamos en EN)
new MutationObserver(function (muts) {
  if (_lang !== 'en') return;
  for (let i = 0; i < muts.length; i++) {
    const added = muts[i].addedNodes;
    for (let j = 0; j < added.length; j++) {
      const n = added[j];
      if (n.nodeType === 1) _translateNode(n, I18N_EN, I18N_PREFIX_EN);
      else if (n.nodeType === 3 && n.parentElement && !n.parentElement.closest(_I18N_SKIP)) {
        const key = n.nodeValue && n.nodeValue.trim();
        const tr = key && _xlate(key, I18N_EN, I18N_PREFIX_EN);
        if (tr) n.nodeValue = n.nodeValue.replace(key, tr);
      }
    }
  }
}).observe(document.documentElement, { childList: true, subtree: true });

// Aplicar idioma guardado al cargar
function _i18nInit() { if (_lang === 'en') _translateNode(document.body, I18N_EN, I18N_PREFIX_EN); }
if (document.readyState !== 'loading') _i18nInit();
else document.addEventListener('DOMContentLoaded', _i18nInit);

window.setLanguage = setLanguage;
window.t = t;
