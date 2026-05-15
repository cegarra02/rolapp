# Rolapp — Contexto del proyecto

## Qué es
PWA de roleplay con IA (single-page, sin bundler, vanilla JS). Permite chatear con personajes de ficción usando la API de Anthropic (Claude). Incluye escenas grupales, misiones generadas por IA y personalización completa de personajes.

**URL de producción:** https://cegarra02.github.io/rolapp/  
**Repositorio:** https://github.com/cegarra02/rolapp

---

## Estructura de archivos

```
index.html          — HTML puro, sin CSS ni JS inline
css/style.css       — Todos los estilos
js/
  state.js          — Variables globales: chars, profile, history, scenes, missions…
  utils.js          — save, uid, esc, formatMsg, fmtTime, toast
  ui.js             — showScreen, goHome, openModal, closeModal, switchTab, setActiveTab
  sliders.js        — updateSlider, initSliders
  api.js            — callAPI, buildSystemPrompt, buildMessages, buildPersonalityBlock
  cropper.js        — Motor completo del recortador de imágenes (touch + mouse)
  chars.js          — CRUD personajes: renderChars, openCreate, openEdit, saveChar, deleteChar
  profile.js        — Perfil del jugador + API key Anthropic
  scenes.js         — Escenas grupales: renderScenesScreen, saveScene, openSceneChat
  inbox.js          — Pantalla "Chats" con historial reciente
  missions.js       — Misiones IA: generateMissions, checkMissionCompletion
  hitos.js          — Sistema de hitos: showHitoNotif, _renderHitos, deleteHito
  chat.js           — Chat: renderMessages, sendMessage, openChat, openChatMenu, initChatSwipe
  main.js           — Init: renderChars, loadProfileFields, initChatSwipe
manifest.json       — PWA manifest
sw.js               — Service Worker
```

**Orden de los `<script>` en index.html importa** — no se usan módulos ES, todo son globals.

---

## Tecnologías

- Vanilla JS + HTML + CSS (sin frameworks, sin bundler)
- PWA (manifest + service worker)
- Fuentes: Syne (títulos) + Inter (cuerpo) vía Google Fonts
- Persistencia: `localStorage` para chars, profile, scenes, missions, historial de chat
- Las imágenes (fondo de chat) se recortan con el cropper integrado y se guardan en localStorage

---

## API integrada

### Anthropic (Claude) — chat con personajes
- Las llamadas se proxizan a través de un **Cloudflare Worker**:  
  `https://misty-heart-cd26.alex1234567890ct.workers.dev`
- El worker reenvía a `api.anthropic.com` añadiendo headers CORS
- Modelo: `claude-sonnet-4-6`
- API key del usuario guardada en `localStorage` como `rp_apikey`
- Se puede probar la conexión desde "Mi Perfil"

---

## Decisiones de diseño importantes

- **Sin módulos ES**: todo en globals para máxima compatibilidad sin tooling. El orden de los `<script>` es la única "gestión de dependencias".
- **Proxy Cloudflare**: la API de Anthropic no permite llamadas directas desde navegador (CORS). El worker es mínimo y solo reenvía.
- **localStorage como BD**: toda la persistencia es local. No hay backend. Los datos están en el dispositivo del usuario.
- **Historial de chat**: se guarda en cada objeto `char.history[]` o `scene.history[]`.
- **Versión en URLs de scripts**: `?v=NN` en los `<script src>` sirve como cache-busting manual. Actualmente en **v44** (sw.js usa `rolapp-v45`).

---

## Sistema de hitos

Los hitos son momentos únicos e irrepetibles de la relación (primer beso, primera intimidad, traición definitiva…). **No son hitos** los coqueteos, besos habituales o escenas recurrentes.

- Claude puede generar hitos automáticamente añadiendo `<hito>texto</hito>` al final de su respuesta
- `sendMessage()` en chat.js extrae la etiqueta con regex, la strip del mensaje visible, y guarda el hito en `t.hitos[]`
- Los hitos existentes se pasan al prompt de Claude (`--- SISTEMA DE HITOS ---`) para que no los repita
- Los hitos también se inyectan como **memoria activa** en el prompt (`--- MEMORIA DE LA RELACIÓN ---` / `--- MEMORIA DE LA HISTORIA ---`) para que el personaje los tenga en cuenta
- La notificación es una tarjeta rica (`#hitoToast`) que aparece a los 600ms tras recibir la respuesta
- `buildPersonalityBlock(ch, charName)`: cuando se pasa `charName` (contexto de escena grupal), el bloque usa cabecera indentada `Comportamiento de X:` para aislar la personalidad de cada personaje y evitar contaminación cruzada

---

## Sistema de misiones

- Las misiones se generan con Claude y se detecta su compleción automáticamente tras cada mensaje
- **Sin repeticiones**: se pasan todos los títulos de misiones (activas + completadas) al prompt de generación
- **Contexto reciente**: `_resolveHistory()` obtiene el historial correcto (char, scene o global) y `_buildRecentHistoryBlock()` pasa los últimos 12 mensajes a Claude para que las misiones sean coherentes con lo que ya ha ocurrido
- **Perfil del jugador**: `_buildProfileBlock()` incluye nombre, género, contexto y preferencias del perfil
- **Misiones NSFW**: botón separado (`.gen-btn-nsfw`) que genera misiones de contenido adulto explícito con flag `nsfw: true`
- `missionGenTarget` en state.js indica el char/scene para el que se están generando misiones desde la pantalla de Misiones

---

## Swipe en el chat

El chat soporta swipe de derecha a izquierda para revelar la imagen de fondo al completo (ocultando la UI del chat).

- `initChatSwipe()` en chat.js registra los listeners una sola vez al inicio (en `main.js`)
- **Anti-accidental**: se usa `touchmove` para bloquear el swipe si en cualquier momento el movimiento vertical supera al horizontal. Así un scroll diagonal no activa el swipe, pero un gesto claramente horizontal sí
- Al hacer swipe, `chat-content-wrap` recibe la clase `swiped` → `transform: translateX(-100%)`
- **Restaurar**: cualquier toque mientras está swiped lo restaura (`isSwiped` flag en state.js)
- `openChat()` y `openSceneChat()` siempre resetean `isSwiped = false` y eliminan la clase `swiped` al abrir

---

## Proceso de deploy — IMPORTANTE

Al modificar cualquier archivo JS o CSS hay que hacer **tres cosas** antes del commit, o los usuarios verán la versión antigua aunque el repo esté actualizado:

1. **Subir el número de versión** en `index.html` — todos los `?v=NN` deben pasar al mismo número nuevo.
2. **Actualizar `sw.js`** — cambiar `CACHE = 'rolapp-vNN'` al nuevo número Y actualizar la lista `ASSETS` con el nuevo `?v=NN`. Si se añade un archivo JS nuevo, también hay que añadirlo aquí.
3. **Commit + push** de `index.html` y `sw.js` junto con los archivos modificados.

El Service Worker intercepta todas las peticiones y sirve desde su caché interna. Si `CACHE` no cambia de nombre, el SW sigue devolviendo los archivos antiguos aunque el servidor ya tenga los nuevos.

El registro del SW usa `{ updateViaCache: 'none' }` para evitar que el navegador cachee el propio `sw.js`, y escucha `controllerchange` para recargar la página automáticamente cuando el nuevo SW toma el control.

### ⚠️ CRÍTICO: Bump de versión — usar SIEMPRE Node.js

**Nunca usar PowerShell `Get-Content` para reemplazar texto en index.html.** PowerShell 5.1 lee UTF-8 sin BOM como Windows-1252, corrompiendo todos los caracteres multibyte (emojis, tildes, flechas, etc.) al reescribir el archivo.

Usar siempre Node.js para el bump:
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

Si los usuarios están atascados con una caché corrupta que el mecanismo normal no limpia, publicar temporalmente este `sw.js` de reset nuclear:

```javascript
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request));
});
```

Una vez confirmado que todo se ve bien, restaurar el SW normal con un nuevo número de caché.

---

## Contexto para continuar el desarrollo

- El proyecto no tiene tests ni CI. Los cambios se prueban manualmente en el navegador.
- La app está pensada para móvil (PWA, touch events, safe-area-inset).
- `--safe-top` y `--safe-bot` usan `env(safe-area-inset-*)`. Requiere `viewport-fit=cover` en el viewport meta para funcionar (ya incluido).
- Las escenas tienen múltiples personajes; el prompt incluye a todos con bloques `╔═ NOMBRE ═╗` y `buildPersonalityBlock(ch, ch.name)` para aislar su personalidad.
- El sistema de misiones usa Claude para generar retos narrativos y detectar su compleción automáticamente.
- Hay un sistema de estilos de chat por personaje/escena (colores de burbuja, opacidad, tamaño de fuente).
- La barra de chat tiene botones de inserción rápida: `**` (cursiva), `""` (negrita), `()` (paréntesis).
- El chat tiene un layout flex correcto: `.chat-content-wrap` es `flex:1;min-height:0` y `.messages` tiene `min-height:0` para evitar el bug clásico de overflow en móvil.
