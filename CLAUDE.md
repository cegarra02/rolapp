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
- **Versión en URLs de scripts**: `?v=NN` en los `<script src>` sirve como cache-busting manual. Actualmente en **v31**.

---

## Proceso de deploy — IMPORTANTE

Al modificar cualquier archivo JS o CSS hay que hacer **tres cosas** antes del commit, o los usuarios verán la versión antigua aunque el repo esté actualizado:

1. **Subir el número de versión** en `index.html` — todos los `?v=NN` deben pasar al mismo número nuevo (buscar y reemplazar global).
2. **Actualizar `sw.js`** — cambiar `CACHE = 'rolapp-vNN'` al nuevo número Y actualizar la lista `ASSETS` con el nuevo `?v=NN`. Si se añade un archivo JS nuevo, también hay que añadirlo aquí. Si se elimina uno, hay que quitarlo.
3. **Commit + push** de `index.html` y `sw.js` junto con los archivos modificados.

El Service Worker intercepta todas las peticiones y sirve desde su caché interna. Si `CACHE` no cambia de nombre, el SW sigue devolviendo los archivos antiguos aunque el servidor ya tenga los nuevos. El cambio de nombre activa el ciclo `install → activate → skipWaiting → claim`, que borra la caché vieja y descarga la nueva.

El registro del SW usa `{ updateViaCache: 'none' }` para evitar que el navegador cachee el propio `sw.js`, y escucha `controllerchange` para recargar la página automáticamente cuando el nuevo SW toma el control.

---

## Contexto para continuar el desarrollo

- El proyecto no tiene tests ni CI. Los cambios se prueban manualmente en el navegador.
- La app está pensada para móvil (PWA, touch events, safe-area-inset).
- El chat soporta swipe horizontal para revelar un panel lateral (misiones).
- Las escenas tienen múltiples personajes y el prompt del sistema incluye a todos.
- El sistema de misiones usa Claude para generar retos narrativos y detectar su compleción automáticamente.
- Hay un sistema de estilos de chat por personaje/escena (colores de burbuja, opacidad, tamaño de fuente).
- La barra de chat tiene botones de inserción rápida: `**` (cursiva), `""` (negrita), `()` (paréntesis).
