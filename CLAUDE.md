# Rolapp — Contexto del proyecto

## Qué es
PWA de roleplay con IA (single-page, sin bundler, vanilla JS). Permite chatear con personajes de ficción usando la API de Anthropic (Claude). Incluye escenas grupales, biblioteca pública de personajes con Supabase, y personalización completa de personajes.

**URL de producción:** https://cegarra02.github.io/rolapp/  
**Repositorio:** https://github.com/cegarra02/rolapp

---

## Estructura de archivos

```
index.html          — HTML puro, sin CSS ni JS inline
css/style.css       — Todos los estilos
js/
  state.js          — Variables globales: chars, profile, history, scenes, missions, missionsEnabled…
  utils.js          — save, uid, esc, formatMsg, fmtTime, toast
  ui.js             — showScreen, goHome, openModal, closeModal, switchTab, setActiveTab
  sliders.js        — updateSlider, initSliders
  supabase.js       — Cliente Supabase, auth, gemas, submitCharToLibrary, renderUserHeader
  api.js            — callAPI, buildSystemPrompt, buildMessages, buildPersonalityBlock
  cropper.js        — Motor completo del recortador de imágenes (touch + mouse)
  chars.js          — CRUD personajes: renderChars, openCreate, openEdit, saveChar, deleteChar
  profile.js        — Perfil del jugador + API key + sección auth (login/registro/logout)
  scenes.js         — Escenas grupales: renderScenesScreen, saveScene, openSceneChat
  inbox.js          — Pantalla "Chats" con historial reciente
  missions.js       — Misiones IA (OCULTAS): generateMissions, checkMissionCompletion — código intacto
  hitos.js          — Sistema de hitos: showHitoNotif, _renderHitos, deleteHito
  explore.js        — Tab Explorar: fetchExploreChars, renderExploreList, openExploreChat
  moderation.js     — Panel de moderación: renderModeration, approveSubmission, rejectSubmission
  chat.js           — Chat: renderMessages, sendMessage, openChat, openChatMenu, initChatSwipe
  main.js           — Init: renderChars, loadProfileFields, initChatSwipe, initSupabase
manifest.json       — PWA manifest (display: fullscreen + display_override)
sw.js               — Service Worker
```

**Orden de los `<script>` en index.html importa** — no se usan módulos ES, todo son globals.  
Supabase CDN se carga primero (antes de state.js) vía `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js`.

---

## Tecnologías

- Vanilla JS + HTML + CSS (sin frameworks, sin bundler)
- PWA (manifest + service worker)
- Fuentes: Syne (títulos) + Inter (cuerpo) vía Google Fonts
- Persistencia local: `localStorage` para chars, profile, scenes, missions, historial de chat
- Persistencia remota: **Supabase** para biblioteca pública, auth y gemas
- Las imágenes (fondo de chat) se recortan con el cropper integrado y se guardan en localStorage

---

## API integrada

### Anthropic (Claude) — chat con personajes
- Las llamadas se proxizan a través de un **Cloudflare Worker**:  
  `https://misty-heart-cd26.alex1234567890ct.workers.dev`
- El worker reenvía a `api.anthropic.com` añadiendo headers CORS **y** el header de prompt caching
- El worker añade `'anthropic-beta': 'prompt-caching-2024-07-31'` en sus propios headers (no desde la app)
- Modelo: `claude-sonnet-4-6`
- API key del usuario guardada en `localStorage` como `rp_apikey`
- **Prompt caching activo**: `callAPI()` envía `system` como array con `cache_control: { type: 'ephemeral' }` → ahorro ~90% tokens del system prompt a partir del 2.º mensaje

### Supabase — biblioteca pública y auth
- URL: `https://pxtnjtckfzsqistfjgn.supabase.co`
- Anon key en `js/supabase.js` (no es secreta, es pública por diseño)
- Cliente global: `supaClient` (inicializado en supabase.js)
- Auth: email/password + Google OAuth
- Tablas: `characters_library`, `submissions`, `users`
- RLS activado en todas las tablas

#### Configuración OAuth (Google) — IMPORTANTE
- **Supabase dashboard → Authentication → URL Configuration:**
  - Site URL: `https://cegarra02.github.io/rolapp/`
  - Redirect URLs: incluir `https://cegarra02.github.io/rolapp/` (con barra final)
- **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client:**
  - Authorized redirect URI: `https://pxtnjtckfzsqistfjgn.supabase.co/auth/v1/callback`
- **Nota:** Los cambios en Google Cloud Console pueden tardar varios minutos en propagarse. Si el login con Google falla con `dns_probe_finished_nxdomain` justo después de configurar, esperar unos minutos antes de descartar error de código.
- `redirectTo` en `authSignInGoogle()` está hardcodeado a `'https://cegarra02.github.io/rolapp/'` (con barra final) — no usar `window.location.href` para evitar incluir parámetros PKCE en la URL de retorno.
- El flujo PKCE usa `onAuthStateChange` con evento `INITIAL_SESSION` (no `getSession()` — tiene race condition con el exchange del código).

---

## Sistema de biblioteca pública (Supabase)

### Tablas
- **`characters_library`** — personajes aprobados visibles en Explorar. Campos: `id`, `name`, `tag`, `gender`, `age`, `shoe_size`, `desc`, `context`, `greeting`, `bg` (base64), `timid`, `romantic`, `pace`, `nsfw`, `status`, `author_id`, `chat_count`, `created_at`
- **`submissions`** — personajes enviados por usuarios pendientes de revisión. Mismos campos + `status` (pending/approved/rejected)
- **`users`** — perfil de Supabase del usuario. Campos: `id` (= auth.uid()), `email`, `gems`

### Auth y gemas
- `supabaseUser` — usuario actual (null si no hay sesión), global en supabase.js
- `supabaseGems` — saldo de gemas del usuario en Supabase
- Sin sesión: 50 gemas en `localStorage` como `rp_gems_local`; al registrarse se migran a Supabase y se borra la clave local
- `renderUserHeader()` — actualiza todos los `.user-header-chip` en la UI (headers de Explorar, Personajes, Escenas)
- `addGems(userId, amount)` / `spendGems(userId, amount)` — operaciones de gemas en Supabase

### Flujo de publicación
1. Usuario activa toggle "Hacer público" al guardar personaje (solo visible si hay sesión)
2. `saveChar()` llama `submitCharToLibrary(c)` → inserta en `submissions` con `status: 'pending'`
3. Admin (emails: `cegarra02@gmail.com`, `alex1234567890ct@gmail.com`) ve submissions en panel de moderación
4. Aprobar → copia a `characters_library` con `status: 'approved'` + gemas opcionales al autor
5. Rechazar → cambia `status: 'rejected'` en submissions

### Tab Explorar
- Primera tab del nav (icono 🔍)
- Grid 2 columnas, misma CSS que Personajes
- Búsqueda con debounce 400ms, filtro por tags (chips scrollables), ordenar Nuevos/Populares
- Al abrir chat: incrementa `chat_count` en Supabase (fire and forget)
- Los chats con personajes de biblioteca **no se persisten** en localStorage (solo en memoria de sesión)

---

## Sistema de hitos

Los hitos son la **memoria a largo plazo** de la relación. Son esenciales porque el historial de conversación enviado a la API está limitado a los últimos 20 mensajes — los hitos son la única referencia de lo que ocurrió antes.

- Claude puede generar hitos automáticamente añadiendo `<hito>texto</hito>` al final de su respuesta
- `sendMessage()` en chat.js extrae la etiqueta con regex, la elimina del mensaje visible, y guarda el hito en `t.hitos[]`
- Los hitos se inyectan en el prompt como **memoria permanente** (`--- MEMORIA ---`)
- **Criterios de detección**: primer beso o intimidad, declaraciones de amor/rechazo, traición o conflicto grave, revelación de secreto importante, reconciliación, decisiones que cambian la relación. NO: coqueteos, rutinas, conversaciones sin cambio real
- La notificación es una tarjeta rica (`#hitoToast`) que aparece 600ms tras recibir la respuesta
- Los hitos **no hacen llamadas separadas a la API** — van embebidos en la respuesta normal del chat

---

## Sistema de misiones — OCULTO TEMPORALMENTE

El código está intacto en `missions.js` pero la UI está oculta:
- Tab `⚔️ Misiones` en nav: `display:none`
- Pantalla `#missionsScreen`: `display:none`
- Botón Misiones en chat header: `display:none`
- `checkMissionCompletion()` comentado en `chat.js` (línea con comentario `// misiones ocultas temporalmente`)

Para reactivar: quitar los `display:none` de los tres elementos HTML y descomentar la llamada en chat.js.

---

## Optimización de tokens

- **Historial limitado**: `buildMessages()` envía solo los últimos 20 mensajes
- **Prompt caching**: system prompt cacheado 5 min en Anthropic → ahorro ~90% tokens de entrada en mensajes 2+
- **Hitos desactivados**: excluye el bloque `SISTEMA DE HITOS` del prompt (~80 tokens menos)
- **Misiones ocultas**: elimina una llamada extra a la API por cada mensaje del chat

---

## Swipe en el chat

El chat soporta swipe de derecha a izquierda para revelar la imagen de fondo al completo.

- `initChatSwipe()` en chat.js registra los listeners una sola vez al inicio (en `main.js`)
- **Anti-accidental**: `touchmove` bloquea el swipe si el movimiento vertical supera al horizontal
- Al hacer swipe, `chat-content-wrap` recibe la clase `swiped` → `transform: translateX(-100%)`
- `openChat()` y `openSceneChat()` resetean siempre `isSwiped = false` al abrir

---

## Layout y safe areas

- `viewport-fit=cover` en el viewport meta
- `--safe-top: env(safe-area-inset-top, 0px)` y `--safe-bot: env(safe-area-inset-bottom, 0px)` en `:root`
- Los headers usan `padding-top: max(8px, var(--safe-top))`
- `manifest.json` tiene `display: fullscreen` + `display_override: ["fullscreen", "standalone"]`
- En iOS: barra de estado translúcida con `apple-mobile-web-app-status-bar-style: black-translucent`

---

## Proceso de deploy — IMPORTANTE

Al modificar cualquier archivo JS o CSS hay que hacer **tres cosas** antes del commit:

1. **Subir el número de versión** en `index.html` — todos los `?v=NN` al mismo número nuevo.
2. **Actualizar `sw.js`** — cambiar `CACHE = 'rolapp-vNN'` (siempre 2 por encima del anterior) y los `?v=NN` en ASSETS. Si se añade un JS nuevo, añadirlo también aquí.
3. **Commit + push** de `index.html` y `sw.js` junto con los archivos modificados.

**Versión actual: v69** (sw.js usa `rolapp-v71`)

El Service Worker sirve desde caché interna. Si `CACHE` no cambia, sigue devolviendo archivos viejos.

### ⚠️ CRÍTICO: Bump de versión — usar SIEMPRE Node.js

**Nunca usar PowerShell `Get-Content`** — lee UTF-8 como Windows-1252, corrompiendo emojis, tildes y flechas.

```javascript
node -e "
const fs = require('fs');
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/\?v=OLD/g, '?v=NEW');
fs.writeFileSync('index.html', html, 'utf8');
let sw = fs.readFileSync('sw.js', 'utf8');
sw = sw.replace('rolapp-vOLD', 'rolapp-vNEW').replace(/\?v=OLD/g, '?v=NEW');
fs.writeFileSync('sw.js', sw, 'utf8');
"
```

### Recuperación de emergencia — caché corrupta

```javascript
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => { e.respondWith(fetch(e.request)); });
```

---

## Contexto para continuar el desarrollo

- Sin tests ni CI — los cambios se prueban manualmente en el navegador.
- App pensada para móvil (PWA, touch events, safe-area-inset).
- Las escenas usan un formato de lista simple por personaje en el prompt: cada personaje en un `-` con sus datos y `buildPersonalityBlock(ch)`.
- Hay un sistema de estilos de chat por personaje/escena (colores de burbuja, opacidad, fuente).
- La barra de chat tiene botones de inserción rápida: `**` (cursiva), `""` (negrita), `()` (paréntesis).
- El sistema de misiones está oculto pero funcional — se puede reactivar fácilmente.
- Los personajes de biblioteca tienen `isLibraryChar: true` y `hitosEnabled: false` — el historial de chat con ellos no se persiste en localStorage.
- Las imágenes `bg` se guardan como base64 en localStorage y también en la columna `bg` de Supabase al publicar — no está optimizado con Supabase Storage todavía.
