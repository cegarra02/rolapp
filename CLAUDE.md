# Rolapp — Contexto del proyecto

## Qué es
PWA de roleplay con IA (single-page, sin bundler, vanilla JS) + app Android nativa vía Capacitor. Permite chatear con personajes de ficción usando la API de Anthropic (Claude). Incluye escenas grupales, biblioteca pública de personajes con Supabase, sistema de gemas de pago y personalización completa de personajes.

**URL de producción (web):** https://cegarra02.github.io/rolapp/  
**Repositorio:** https://github.com/cegarra02/rolapp  
**App Android:** `com.roleplayai.app` (en desarrollo, Capacitor)

---

## Estructura de archivos

```
index.html          — HTML puro, sin CSS ni JS inline
css/style.css       — Todos los estilos
js/
  state.js          — Variables globales: chars, libChars, profile, history, scenes, missions, missionsEnabled…
  utils.js          — save, saveLibChars, uid, esc, formatMsg, fmtTime, toast
  ui.js             — showScreen, goHome, openModal, closeModal, switchTab, setActiveTab
  sliders.js        — updateSlider, initSliders
  supabase.js       — Cliente Supabase, auth, gemas, deductMessageGems, submitCharToLibrary, renderUserHeader
  sync.js           — Sincronización cross-device: _loadUserDataFromDb, syncChars, syncScenes, syncProfile, syncHistory
  api.js            — callAPI, buildSystemPrompt, buildMessages, buildPersonalityBlock
  cropper.js        — Motor completo del recortador de imágenes (touch + mouse)
  chars.js          — CRUD personajes: renderChars, openCreate, openEdit, saveChar, deleteChar
  profile.js        — Perfil del jugador + sección auth (login/registro/logout)
  scenes.js         — Escenas grupales: renderScenesScreen, saveScene, openSceneChat
  inbox.js          — Pantalla "Chats" con historial reciente (chars + libChars + scenes)
  missions.js       — Misiones IA (OCULTAS): generateMissions, checkMissionCompletion — código intacto
  hitos.js          — Sistema de hitos: showHitoNotif, _renderHitos, deleteHito
  explore.js        — Tab Explorar: fetchExploreChars, renderExploreList, openExploreChat, openLibDetail (admin)
  moderation.js     — Panel de moderación: renderModeration, openSubmissionDetail, approve/reject/delete
  chat.js           — Chat: renderMessages, sendMessage, openChat, openChatMenu, initChatSwipe, _saveChar
  main.js           — Init: renderChars, loadProfileFields, initChatSwipe, initSupabase
manifest.json       — PWA manifest (display: fullscreen + display_override)
sw.js               — Service Worker
scripts/
  build-www.js      — Copia web → www/ para Capacitor (node scripts/build-www.js)
android/            — Proyecto Android nativo generado por Capacitor (Gradle)
capacitor.config.json — Config Capacitor: appId, appName, webDir: "www"
package.json        — npm: scripts build:www, sync, open:android
www/                — Directorio de salida para Capacitor (gitignored, generado por build-www.js)
```

**Orden de los `<script>` en index.html importa** — no se usan módulos ES, todo son globals.  
Supabase CDN se carga primero (antes de state.js) vía `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js`.

### Pantallas (screens) en index.html
Cada `<div class="screen">` se activa con `showScreen(id, hideNav)`. Pantallas existentes:
- `home` / `charsScreen` — lista de personajes propios
- `editScreen` — crear/editar personaje
- `exploreScreen` — biblioteca pública
- `libDetailScreen` — editar/eliminar personaje de biblioteca (solo admin)
- `chat` — chat activo
- `inboxScreen` — historial de chats
- `profileScreen` — perfil + auth
- `scenesScreen` — escenas grupales
- `moderationScreen` — lista de submissions pendientes (solo admin)
- `modDetailScreen` — editar/aprobar/rechazar/eliminar una submission (solo admin)
- `missionsScreen` — misiones (oculto)

---

## Tecnologías

- Vanilla JS + HTML + CSS (sin frameworks, sin bundler)
- PWA (manifest + service worker) + **Capacitor** para empaquetado Android nativo
- Fuentes: Syne (títulos) + Inter (cuerpo) vía Google Fonts
- Persistencia local: `localStorage` para chars, libChars, profile, scenes, missions, historial de chat
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
- Cliente global: `supaClient` (inicializado en supabase.js con fetch personalizado)
- Auth: email/password + Google OAuth (Google solo disponible en web, no en Android nativo)
- Tablas: `characters_library`, `submissions`, `users`, `user_histories`
- RLS activado en todas las tablas

#### Fetch con reintentos — `_fetchWithRetry`
El cliente Supabase se inicializa con un `fetch` personalizado que reintenta automáticamente hasta 2 veces (con backoff 600ms / 1200ms) si ocurre un error de red. Esto absorbe los fallos intermitentes de `ERR_QUIC_PROTOCOL_ERROR` causados por HTTP/3 (QUIC/UDP) de Cloudflare.

**⚠️ IMPORTANTE: `flowType: 'implicit'`** — Supabase v2 usa PKCE por defecto, lo que es poco fiable en Capacitor WebView (el `code_verifier` se puede perder si el SO mata la app, y `onAuthStateChange(SIGNED_IN)` puede no dispararse tras `exchangeCodeForSession`). Se usa `implicit` para que el deep link devuelva `#access_token=...&refresh_token=...` directamente en el fragmento URL:

```js
const supaClient = window.supabase.createClient(SUPA_URL, SUPA_KEY, {
  global: { fetch: _fetchWithRetry },
  auth:   { flowType: 'implicit' }  // evita unreliabilidad de PKCE en Capacitor WebView
});
```

#### Políticas RLS configuradas
- `submissions`: SELECT (`TO authenticated USING (true)`), INSERT (authenticated, `WITH CHECK (auth.uid() = author_id)`), UPDATE, DELETE (admin)
- `characters_library`: SELECT (pública), INSERT, UPDATE, DELETE (admin)
- `users`: SELECT/UPDATE propios
- **⚠️ Si se añade una tabla nueva**, hay que configurar sus políticas RLS o las operaciones fallarán silenciosamente (sin error en cliente pero sin efecto en BD). El `DELETE` sin política devuelve `error: null` pero no borra nada.

Si el INSERT de submissions falla, ahora se muestra un **toast rojo** con el mensaje exacto del error (ej: `❌ Error al enviar a revisión: new row violates row-level security`). Si se necesita añadir la política de INSERT para usuarios normales:
```sql
CREATE POLICY "Users can submit their own chars"
ON submissions FOR INSERT TO authenticated
WITH CHECK (auth.uid() = author_id);
```

#### Configuración OAuth (Google) — IMPORTANTE
- **Supabase dashboard → Authentication → URL Configuration:**
  - Site URL: `https://cegarra02.github.io/rolapp/`
  - Redirect URLs: `https://cegarra02.github.io/rolapp/` y `com.roleplayai.app://` (deep link para Android)
- **Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs:**
  - `https://pxtnjtkckfzsqistfjgn.supabase.co/auth/v1/callback` ← **OBLIGATORIO para el redirect flow (Android)**
  - Sin este URI registrado Google devuelve `redirect_uri_mismatch`. El botón GIS de web no lo necesitaba (usa `signInWithIdToken`), pero el redirect flow de Android sí.

#### Auth — solo Google, sin email/password
El login por email/contraseña ha sido **eliminado de la UI**. Solo existe Google Sign-In:
- **Web (PWA)**: botón GIS (`google.accounts.id.renderButton`) — popup nativo de Google, sin redirect de página, no usa el callback de Supabase
- **Android nativo**: botón "Continuar con Google" (SVG inline del logo G) → `signInWithGoogleRedirect()` en `supabase.js`:
  1. Llama a `supaClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'com.roleplayai.app://', skipBrowserRedirect: true } })`
  2. Abre `data.url` en **Chrome Custom Tabs** via `window.Capacitor.Plugins.Browser.open()` — Google bloquea OAuth en WebView, Chrome Custom Tabs sí está permitido
  3. Usuario firma en Chrome Custom Tabs
  4. Google → Supabase callback → deep link `com.roleplayai.app://#access_token=...&refresh_token=...` (implicit flow)
  5. **Warm start**: `App.addListener('appUrlOpen')` en `main.js` captura el deep link y llama a `handleDeepLink(url)`
  5. **Cold start**: `App.getLaunchUrl()` en `main.js` también llama a `handleDeepLink(url)` para el caso en que el SO mató la app mientras Chrome Custom Tabs estaba abierto
  6. `handleDeepLink()` cierra el browser, extrae tokens del fragmento `#` y llama a `supaClient.auth.setSession({ access_token, refresh_token })` → `onAuthStateChange` detecta `SIGNED_IN`
  7. `_lastDeepLinkUrl` — variable de deduplicación en `supabase.js`: evita procesar el mismo URL de deep link dos veces (cold start + warm start pueden dispararse a la vez). Se limpia en `authSignOut()` para permitir login posterior.
  8. `handleDeepLink` también tiene rama PKCE (`code=...`) como fallback por si se recibe ese formato inesperadamente
- Las funciones `authSignUp`, `authSignIn`, `doAuth`, `setAuthTab` siguen en el código pero no se usan en la UI (no eliminar para evitar errores si algo las referencia)
- Plugins instalados: `@capacitor/browser@8.0.3`, `@capacitor/app@8.1.0`

#### Auth — comportamiento actual y bug pendiente (v115)

**Lo que funciona:**
- El **primer login** se completa correctamente. `handleDeepLink` recibe los tokens, `setSession` los procesa y `onAuthStateChange(SIGNED_IN)` dispara, cargando las gemas y actualizando la UI.
- **Logout** es inmediato: `doSignOut()` en `profile.js` limpia el estado local ANTES de llamar a `authSignOut()`, por lo que la UI responde aunque Android tarde en propagar el evento.
- Al cerrar sesión, **las gemas de Supabase se guardan en `rp_gems_local`** para que el contador no vuelva a 50 tras el logout.

**Bug pendiente — segundo login falla:**
- `setSession` devuelve `data.session: null` tras el primer login. El login "funciona" porque `onAuthStateChange(SIGNED_IN)` se dispara independientemente.
- En el segundo intento (logout → login), `onAuthStateChange` **no vuelve a disparar** aunque `handleDeepLink` recibe los tokens correctamente.
- Síntomas observados: la secuencia de toasts diagnósticos muestra `🔗 tokens✓ | hash:true` y `🔑 setSession…` pero luego nada más (ni `✅ Login OK` ni `🔔 SIGNED_IN`).
- **Hipótesis principal**: el token de access devuelto en el segundo login ya fue procesado por Supabase internamente en el primer intento (la sesión ya existe en el storage del SDK). `setSession` con tokens idénticos o "ya usados" puede ser ignorado.
- **Próximo paso de diagnóstico**: revisar si en el segundo login se reciben tokens distintos a los del primero. Si son iguales, el problema es que el SDK cachea y no re-dispara el evento. Si son distintos, el problema está en la validación de `setSession`.

**Build de diagnóstico activo (v115):** `js/supabase.js` tiene toasts en cada paso del flujo:
- `toast('🚀 Iniciando OAuth…')` al pulsar el botón
- `toast('🌐 Abriendo navegador…')` antes de `Browser.open()`
- `toast('🔗 …')` al recibir el deep link (indica si tiene tokens, code o nada)
- `toast('🔑 setSession…')` antes de llamar a setSession
- `toast('🔑 session:OK/NULL')` según resultado de setSession
- `toast('✅ Login OK · gems:N')` si login completado vía handleDeepLink
- `toast('🔔 SIGNED_IN/etc')` cuando dispara onAuthStateChange
- `toast('❌ …')` en errores

Estos toasts deben **eliminarse** cuando se resuelva el bug de segundo login.

---

## Sistema de biblioteca pública (Supabase)

### Tablas
- **`characters_library`** — personajes aprobados visibles en Explorar. Campos: `id`, `name`, `tag`, `gender`, `age`, `desc`, `context`, `greeting`, `bg` (base64), `timid`, `romantic`, `pace`, `nsfw`, `status`, `author_id`, `chat_count`, `message_count`, `created_at`
- **`submissions`** — personajes enviados por usuarios pendientes de revisión. Mismos campos + `character_data` (JSONB, NOT NULL) + `status` (pending/approved/rejected)
- **`users`** — perfil de Supabase del usuario. Campos: `id` (= auth.uid()), `gems`, `profile` (JSONB), `chars_data` (JSONB, sin bg/history/hitos), `scenes_data` (JSONB, sin history/hitos)
- **`user_histories`** — historiales de chat e hitos. PK: `(user_id, entity_id)`. `entity_id` = char id propio | `lib_<id>` para biblioteca | scene id. Max 400 mensajes por entidad. RLS: cada usuario solo ve los suyos.

#### SQL para crear las tablas de sync (ejecutar en Supabase SQL Editor)
```sql
-- Columnas de sync en users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS profile     JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS chars_data  JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS scenes_data JSONB DEFAULT '[]';

-- Tabla de historiales
CREATE TABLE IF NOT EXISTS user_histories (
  user_id    UUID  NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_id  TEXT  NOT NULL,
  history    JSONB NOT NULL DEFAULT '[]',
  hitos      JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entity_id)
);
ALTER TABLE user_histories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own histories"
  ON user_histories FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Auth y gemas
- `supabaseUser` — usuario actual (null si no hay sesión), global en supabase.js
- `supabaseGems` — saldo de gemas del usuario en Supabase
- Sin sesión: 50 gemas en `localStorage` como `rp_gems_local`; al registrarse se migran a Supabase y se borra la clave local
- `renderUserHeader()` — actualiza todos los `.user-header-chip` en la UI
- `addGems(userId, amount)` / `spendGems(userId, amount)` — operaciones de gemas en Supabase
- `initSupabase()` usa `getSession()` para la carga inicial (fiable en cada recarga) y `onAuthStateChange` para cambios futuros; ignora `INITIAL_SESSION` en el listener

### Coste por mensaje — gemas
- **Coste**: `MESSAGE_GEM_COST = 7` gemas por mensaje enviado (constante en `supabase.js`)
- `deductMessageGems()` — descuenta de forma **síncrona** desde la caché local (`supabaseGems` o localStorage), actualiza el header inmediatamente y persiste en Supabase en background (fire and forget). Devuelve `true` si había saldo, `false` si no
- Si no hay gemas: `sendMessage()` muestra toast y hace `return` sin llamar a la API ni tocar el historial
- Funciona igual para usuarios anónimos (localStorage) y registrados (Supabase)
- **Para Android**: la recarga de gemas con dinero usará Google Play Billing + `addGems(userId, amount)`. La constante `MESSAGE_GEM_COST` es el único punto a cambiar para ajustar el precio

### Flujo de publicación
1. Usuario activa toggle "Hacer público" al guardar personaje (solo visible si hay sesión)
2. `saveChar()` llama `submitCharToLibrary(c)` solo si `!wasPublic && isPublicNow` (evita duplicados)
3. `submitCharToLibrary` inserta en `submissions` con `status:'pending'` **incluyendo el campo `character_data` (JSONB, NOT NULL)**
   - Si el INSERT falla → toast rojo con el error exacto (`❌ Error al enviar a revisión: …`)
   - Si el INSERT tiene éxito → toast verde (`✓ Personaje enviado a revisión`)
4. Admin ve submissions en panel de moderación → puede editar campos antes de aprobar
5. Aprobar → copia a `characters_library` + gemas opcionales al autor → status `'approved'`
6. Rechazar → status `'rejected'` en submissions
7. Eliminar → hard DELETE (política RLS de DELETE configurada)

### Tab Explorar
- Primera tab del nav (icono 🔍)
- El nav tiene 4 tabs: Explorar, Personajes, Chats, Mi Perfil
- Grid 2 columnas, misma CSS que Personajes (`.chars-list`)
- Búsqueda con debounce 400ms, filtro por tags (usa `encodeURIComponent` en onclick para evitar inyección de comillas), ordenar Nuevos/Populares
- Al abrir chat: incrementa `chat_count` en Supabase (fire and forget)
- Orden **Popular**: ordena por `message_count` (mensajes enviados por usuarios). Cada mensaje al personaje llama a la RPC `increment_lib_messages(char_id uuid)` — incremento atómico en SQL, sin race condition, accesible por `anon` y `authenticated`
- **El historial de chat con personajes de biblioteca SÍ se persiste** en `libChars` (localStorage `rp_lib_chars`) y aparece en la pestaña Chats
- Cuando admin está logueado: aparece icono ✎ en cada tarjeta → abre `libDetailScreen` para editar/eliminar
- Si la carga falla (ej: `ERR_QUIC_PROTOCOL_ERROR`), se muestra ⚠️ con botón "🔄 Reintentar" que relanza `renderExploreScreen()`
- `fetchExploreChars()` devuelve `false` en caso de error y `true` si fue exitoso. `renderExploreScreen()` solo llama a `renderExploreList()` si el resultado no es `false` — esto evita que la lista vacía sobreescriba el HTML de error.

### Historial de personajes de biblioteca (`libChars`)
- `let libChars` en `state.js` — array de objetos char con `isLibraryChar: true` e `history`
- `saveLibChars()` en `utils.js` — persiste en `localStorage` como `rp_lib_chars`
- `_saveChar()` en `chat.js` — helper que decide si guardar en `chars` (propios) o `libChars` (biblioteca)
- `openExploreChat()` en `explore.js` — busca historial previo en `libChars` antes de crear el objeto; no repite el saludo si ya hay historial
- `inbox.js` incluye `libChars` en `getInboxItems()` con `type:'lib'`; el click reabre con `openLibChatFromInbox(id)`; el delete elimina de `libChars` (no usa `dismissedChats`)
- En el menú del chat, "Editar personaje" se oculta si `currentChar.isLibraryChar`

### Panel de moderación (solo admin — `alex1234567890ct@gmail.com`)
- Accesible desde Mi Perfil → "🛡️ Panel de moderación" (solo visible si `isAdmin()`)
- **Lista**: grid 2 columnas con tarjetas tipo `char-card` (imagen + nombre + tag)
- **Detalle** (`modDetailScreen`): editar todos los campos de la submission antes de aprobar/rechazar; botón "▶ Probar" abre chat temporal sin guardar historial; todas las acciones tienen modal de confirmación
- Aprobar: copia a `characters_library` con los valores editados del formulario + gemas opcionales al autor
- Rechazar: `status='rejected'`
- Eliminar permanentemente: hard DELETE (política RLS configurada)

---

## Sistema de hitos

Los hitos son la **memoria a largo plazo** de la relación. Son esenciales porque el historial de conversación enviado a la API está limitado a los últimos 20 mensajes.

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

**Versión actual: v137** (sw.js usa `rolapp-v173`)

El Service Worker sirve desde caché interna. Si `CACHE` no cambia, sigue devolviendo archivos viejos.

### ⚠️ CRÍTICO: Bump de versión — usar SIEMPRE Node.js

**Nunca usar PowerShell `Get-Content`** — lee UTF-8 como Windows-1252, corrompiendo emojis, tildes y flechas.  
**Nunca usar `node -e` con strings multilínea en PowerShell** — falla con comillas y saltos de línea. Usar heredoc de bash o un script en fichero.

```javascript
node -e "const fs=require('fs');let h=fs.readFileSync('index.html','utf8');h=h.replace(/\?v=OLD/g,'?v=NEW');fs.writeFileSync('index.html',h,'utf8');let s=fs.readFileSync('sw.js','utf8');s=s.replace('rolapp-vOLD','rolapp-vNEW').replace(/\?v=OLD/g,'?v=NEW');fs.writeFileSync('sw.js',s,'utf8');console.log('done');"
```

### ⚠️ CRÍTICO: Editar index.html con Node.js

Las sustituciones en index.html deben hacerse con regex que admita `\r?\n` (CRLF en Windows). Una sustitución con string literal que tenga `\n` no encontrará el patrón si el fichero usa `\r\n`. Usar siempre regex con `.replace(/patrón/,...)` y heredoc de bash (`node << 'EOF' ... EOF`) para bloques multilínea.

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

## Capacitor / Android

### Workflow de desarrollo Android
```bash
# Tras modificar cualquier archivo web:
npm run sync          # = node scripts/build-www.js + npx cap sync android
npm run open:android  # abre Android Studio
```
En Android Studio → Build → Generate Signed APK / Bundle para publicar.

### Estructura Capacitor
- `capacitor.config.json` — `appId: com.roleplayai.app`, `webDir: "www"`, `androidScheme: "https"`
- `scripts/build-www.js` — copia `index.html`, `css/`, `js/`, `manifest.json`, `sw.js` a `www/`
- `www/` está en `.gitignore` (se regenera con `npm run build:www`)
- `android/` está en git — contiene el proyecto Gradle completo

### ⚠️ Antes de cada `cap sync`
Ejecutar `npm run build:www` (o `npm run sync` para hacer ambos pasos a la vez) para que `www/` tenga los últimos archivos. Si se salta este paso, Android tendrá la versión anterior del código web.

### Versiones Android (build.gradle / variables.gradle)
- AGP: `8.9.1` (subido desde 8.7.2 para soportar `androidx.browser:1.9.0` que requiere `@capacitor/browser@8`)
- compileSdk / targetSdk: `36` (subido desde 35 por el mismo requisito)
- Gradle wrapper: `8.11.1` (ya era compatible con AGP 8.9.1)
- minSdk: `23` (sin cambios)

### Kotlin stdlib — fix de clases duplicadas
El `android/build.gradle` raíz tiene este bloque para evitar el error `Duplicate class kotlin.collections.jdk8.*` que produce Capacitor al arrastrar `kotlin-stdlib-jdk7/jdk8` junto a `kotlin-stdlib 1.8+`:
```groovy
subprojects {
    configurations.all {
        exclude group: 'org.jetbrains.kotlin', module: 'kotlin-stdlib-jdk7'
        exclude group: 'org.jetbrains.kotlin', module: 'kotlin-stdlib-jdk8'
    }
}
```
Desde Kotlin 1.8, el stdlib unificado ya incluye jdk7 y jdk8, por lo que se pueden excluir con seguridad.

### Google Sign-In en Android
GIS (`google.accounts.id.renderButton`) **no funciona en WebView**. Se usa en su lugar el flujo OAuth redirect via Chrome Custom Tabs:
- Detección de plataforma: `window.Capacitor?.isNativePlatform()` en `profile.js → renderAuthSection()`
- Plugins requeridos: `@capacitor/browser` (Chrome Custom Tabs) y `@capacitor/app` (deep links)
- Deep link registrado en `AndroidManifest.xml`: `<data android:scheme="com.roleplayai.app" />`
- `signInWithGoogleRedirect()` en `supabase.js` usa `skipBrowserRedirect: true` + `Browser.open(data.url)`
- `handleDeepLink(url)` en `supabase.js` procesa el retorno: `Browser.close()` + `setSession({ access_token, refresh_token })`
- Listeners registrados en `main.js`:
  - **Warm start**: `App.addListener('appUrlOpen', ({ url }) => handleDeepLink(url))`
  - **Cold start**: `App.getLaunchUrl().then(result => { if (result?.url) handleDeepLink(result.url); })`
- `_lastDeepLinkUrl` en `supabase.js` evita procesar el mismo URL dos veces (cold + warm pueden solaparse)
- `authSignOut()` en `supabase.js` limpia `_lastDeepLinkUrl = ''` para permitir nuevos logins
- `flowType: 'implicit'` en el cliente Supabase → deep link devuelve `#access_token=...` (no `?code=...`)
- **Google Cloud Console**: `https://pxtnjtkckfzsqistfjgn.supabase.co/auth/v1/callback` debe estar en Authorized redirect URIs
- **Supabase Redirect URLs**: añadir `com.roleplayai.app://`
- ⚠️ **Bug pendiente**: el segundo login falla (ver sección "Bug pendiente" en Auth arriba)

### ⚠️ Sync Android — OBLIGATORIO tras cada cambio
**Después de cada modificación de archivos web, ejecutar siempre:**
```bash
npm run sync   # = node scripts/build-www.js + npx cap sync android
```
Esto copia los archivos a `www/` y los sincroniza con el proyecto Gradle de Android Studio. Sin este paso, Android Studio compila la versión anterior del código.

### Próximos pasos Android
- Añadir `@capacitor-community/in-app-purchases` o plugin de Google Play Billing para recargas de gemas con dinero real
- La función `addGems(userId, amount)` ya está lista para recibir el crédito desde el lado nativo

---

## Contexto para continuar el desarrollo

- Sin tests ni CI — los cambios se prueban manualmente en el navegador.
- **Tras cada sesión de cambios**: ejecutar `npm run sync` para actualizar Android, luego commit + push.
- App pensada para móvil (PWA + Android nativo vía Capacitor, touch events, safe-area-inset).
- Las escenas usan un formato de lista simple por personaje en el prompt: cada personaje en un `-` con sus datos y `buildPersonalityBlock(ch)`.
- Hay un sistema de estilos de chat por personaje/escena (colores de burbuja, opacidad, fuente).
- La barra de chat tiene botones de inserción rápida: `**` (cursiva), `""` (negrita), `()` (paréntesis).
- El sistema de misiones está oculto pero funcional — se puede reactivar fácilmente.
- Los personajes de biblioteca tienen `isLibraryChar: true` y `hitosEnabled: false`. Su historial **sí se persiste** en `libChars` (localStorage `rp_lib_chars`).
- Las imágenes `bg` se guardan como base64 en localStorage y también en la columna `bg` de Supabase al publicar — no está optimizado con Supabase Storage todavía.
- El `_saveChar()` en chat.js es el punto central de guardado: redirige a `save()` (chars propios) o `saveLibChars()` (biblioteca). Todos los save de chat pasan por ahí.
- Moderación: botones de Aprobar/Rechazar/Eliminar siempre tienen modal de confirmación (`openModal`). El formulario de detalle usa los valores editados del form en el momento de aprobar.
- **IDs de personajes**: los personajes locales usan `uid()` (timestamp base36 + aleatoriedad, ej: `lq8k3f2abc7d`). Los personajes públicos en Supabase reciben un **UUID v4 generado automáticamente por PostgreSQL** al hacer INSERT — no se envía `id` desde el cliente. No hay colisiones posibles en la BD.

### Cambios de la sesión de corrección de bugs Android (mayo 2026)

Los siguientes bugs fueron corregidos en esta sesión (v108–v115):

1. **Logout no respondía en Android** → `doSignOut()` en `profile.js` ahora limpia el estado local inmediatamente antes de llamar a `authSignOut()`, sin esperar `onAuthStateChange(SIGNED_OUT)`.

2. **Gemas vuelven a 50 tras logout** → `doSignOut()` guarda el valor de `supabaseGems` en `rp_gems_local` antes de borrar el estado. Si el usuario tenía N gemas en Supabase, tras cerrar sesión ve N gemas locales.

3. **Error UI de Explorar sobreescrita por "sin personajes"** → `fetchExploreChars()` devuelve `false` cuando hay error (en lugar de no devolver nada). `renderExploreScreen()` solo llama a `renderExploreList()` si recibe `true` o cualquier valor no-`false`.

4. **Cold start de deep link ignorado** → `main.js` ahora llama a `App.getLaunchUrl()` al arrancar, además del listener `appUrlOpen` para warm start.

5. **Double processing del mismo deep link** → variable `_lastDeepLinkUrl` en `supabase.js` ignora URLs duplicados. Se limpia en `authSignOut()`.

6. **PKCE poco fiable en Capacitor** → migrado a `flowType: 'implicit'`. El deep link devuelve tokens directamente en el fragmento `#`, sin intercambio de código.

**Bug sin resolver (pendiente diagnóstico en siguiente sesión):**
- Segundo login y sucesivos fallan en Android. El primer login funciona vía `onAuthStateChange(SIGNED_IN)`. En el segundo intento, `setSession` devuelve `data.session: null` y `onAuthStateChange` no vuelve a disparar. Build v115 tiene toasts diagnósticos — el usuario aún no ha reportado la secuencia de toasts del segundo intento. **Próximo paso**: pedir al usuario la secuencia completa de toasts en: primer login → logout → segundo login.

### Advertencias Gradle (inofensivas)
- `Using flatDir should be avoided` — viene de una dependencia de Capacitor, no afecta la funcionalidad.
