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
  state.js          — Variables globales: chars, profile, history, scenes, missions, missionsEnabled…
  utils.js          — save, uid, esc, formatMsg, fmtTime, toast
  ui.js             — showScreen, goHome, openModal, closeModal, switchTab, setActiveTab
  sliders.js        — updateSlider, initSliders
  api.js            — callAPI, buildSystemPrompt, buildMessages, buildPersonalityBlock
  cropper.js        — Motor completo del recortador de imágenes (touch + mouse)
  chars.js          — CRUD personajes: renderChars, openCreate, openEdit, saveChar, deleteChar
  profile.js        — Perfil del jugador + API key Anthropic
  scenes.js         — Escenas grupales: renderScenesScreen, saveScene, openSceneChat
  inbox.js          — Pantalla "Chats" con historial reciente
  missions.js       — Misiones IA: generateMissions, checkMissionCompletion, toggleMissionsEnabled
  hitos.js          — Sistema de hitos: showHitoNotif, _renderHitos, deleteHito
  chat.js           — Chat: renderMessages, sendMessage, openChat, openChatMenu, initChatSwipe
  main.js           — Init: renderChars, loadProfileFields, initChatSwipe
manifest.json       — PWA manifest (display: fullscreen + display_override)
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
- **Versión en URLs de scripts**: `?v=NN` en los `<script src>` sirve como cache-busting manual. Actualmente en **v47** (sw.js usa `rolapp-v49`).

---

## Sistema de hitos

Los hitos son la **memoria a largo plazo** de la relación. Son esenciales porque el historial de conversación enviado a la API está limitado a los últimos 20 mensajes — los hitos son la única referencia de lo que ocurrió antes.

- Claude puede generar hitos automáticamente añadiendo `<hito>texto</hito>` al final de su respuesta
- `sendMessage()` en chat.js extrae la etiqueta con regex, la elimina del mensaje visible, y guarda el hito en `t.hitos[]`
- Los hitos se inyectan en el prompt como **memoria permanente** (`--- MEMORIA DE LA RELACIÓN ---` / `--- MEMORIA DE LA HISTORIA ---`), indicando explícitamente que el historial visible es limitado y que los hitos son la única referencia pasada
- Los hitos existentes se pasan al `--- SISTEMA DE HITOS ---` para que Claude no los repita
- **Criterios de detección**: primer beso o intimidad, declaraciones de amor/rechazo, traición o conflicto grave, revelación de secreto importante, reconciliación, decisiones que cambian la relación, o cualquier momento emocionalmente intenso con consecuencias. NO se registran: coqueteos sin consecuencias, besos/escenas rutinarias, conversaciones emotivas sin cambio real
- La notificación es una tarjeta rica (`#hitoToast`) que aparece 600ms tras recibir la respuesta
- Los hitos **no hacen llamadas separadas a la API** — van embebidos en la respuesta normal del chat. Desactivar hitos en un personaje sólo excluye el bloque de detección del prompt (~80 tokens)

---

## Sistema de misiones

- Las misiones se generan con Claude y se detecta su compleción automáticamente tras cada mensaje
- **Toggle global**: botón `⏸/▶` en la cabecera de la pantalla Misiones. Pausa `checkMissionCompletion()` (que hace una llamada extra a la API por cada mensaje). Se guarda en `localStorage` como `rp_missions_enabled`. La generación manual sigue funcionando siempre.
- **Sin repeticiones**: se pasan todos los títulos de misiones (activas + completadas) al prompt
- **Contexto reciente**: `_resolveHistory()` obtiene el historial correcto (char, scene o global) y `_buildRecentHistoryBlock()` pasa los últimos 12 mensajes para coherencia
- **Perfil del jugador**: `_buildProfileBlock()` incluye nombre, género, contexto y preferencias
- **Misiones NSFW**: botón separado (`.gen-btn-nsfw`) que genera misiones de contenido adulto con flag `nsfw: true`
- `missionGenTarget` en state.js indica el char/scene objetivo desde la pantalla de Misiones

---

## Optimización de tokens

- **Historial limitado**: `buildMessages()` en api.js envía solo los últimos 20 mensajes (`history.slice(0, -1).slice(-20)`), no todo el historial. Mayor ahorro de tokens en conversaciones largas.
- **Misiones pausables**: desactivar la detección elimina una llamada completa a la API por cada mensaje del chat.
- **Hitos desactivados**: excluye el bloque `SISTEMA DE HITOS` del prompt (~80 tokens menos por llamada).
- Los hitos actúan como resumen de eventos pasados, compensando el historial limitado.

---

## Swipe en el chat

El chat soporta swipe de derecha a izquierda para revelar la imagen de fondo al completo.

- `initChatSwipe()` en chat.js registra los listeners una sola vez al inicio (en `main.js`)
- **Anti-accidental**: `touchmove` bloquea el swipe si en cualquier momento el movimiento vertical supera al horizontal — un scroll diagonal no lo activa, un gesto claramente horizontal sí
- Al hacer swipe, `chat-content-wrap` recibe la clase `swiped` → `transform: translateX(-100%)`
- **Restaurar**: cualquier toque mientras está swiped lo restaura
- `openChat()` y `openSceneChat()` resetean siempre `isSwiped = false` al abrir

---

## Layout y safe areas

- `viewport-fit=cover` en el viewport meta — permite que el contenido se extienda detrás de la barra de estado y notch
- `--safe-top: env(safe-area-inset-top, 0px)` y `--safe-bot: env(safe-area-inset-bottom, 0px)` en `:root`
- Los headers usan `padding-top: max(8px, var(--safe-top))` para aprovechar el espacio superior: el contenido sube hasta el límite del área segura sin dejar hueco negro
- El chat usa `flex:1;min-height:0` en `.chat-content-wrap` y `min-height:0` en `.messages` para evitar el bug clásico de overflow en móvil
- `manifest.json` tiene `display: fullscreen` + `display_override: ["fullscreen", "standalone"]` para ocultar la barra de estado en Android PWA (soporte variable según fabricante)
- En iOS: barra de estado translúcida con `apple-mobile-web-app-status-bar-style: black-translucent`

---

## Proceso de deploy — IMPORTANTE

Al modificar cualquier archivo JS o CSS hay que hacer **tres cosas** antes del commit:

1. **Subir el número de versión** en `index.html` — todos los `?v=NN` al mismo número nuevo.
2. **Actualizar `sw.js`** — cambiar `CACHE = 'rolapp-vNN'` y los `?v=NN` en ASSETS. Si se añade un JS nuevo, añadirlo también aquí.
3. **Commit + push** de `index.html` y `sw.js` junto con los archivos modificados.

El Service Worker sirve desde caché interna. Si `CACHE` no cambia, sigue devolviendo archivos viejos.

El registro del SW usa `{ updateViaCache: 'none' }` + `controllerchange` para recargar automáticamente.

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

Publicar este SW temporalmente, confirmar que todo carga bien, y restaurar el SW normal con un nuevo número de caché.

---

## Contexto para continuar el desarrollo

- Sin tests ni CI — los cambios se prueban manualmente en el navegador.
- App pensada para móvil (PWA, touch events, safe-area-inset).
- Las escenas usan un formato de lista simple por personaje en el prompt (no bloques `╔═`): cada personaje en un `-` con sus datos y `buildPersonalityBlock(ch)`.
- El sistema de misiones detecta compleción tras cada mensaje del chat (puede pausarse con el toggle).
- Hay un sistema de estilos de chat por personaje/escena (colores de burbuja, opacidad, fuente).
- La barra de chat tiene botones de inserción rápida: `**` (cursiva), `""` (negrita), `()` (paréntesis).
