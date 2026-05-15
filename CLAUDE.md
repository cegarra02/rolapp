# Rolapp — Contexto del proyecto

## Qué es
PWA de roleplay con IA (single-page, sin bundler, vanilla JS). Permite chatear con personajes de ficción usando la API de Anthropic (Claude). Incluye escenas grupales, misiones generadas por IA, personalización completa de personajes y generación de imágenes con AI Horde.

**URL de producción:** https://cegarra02.github.io/rolapp/  
**Repositorio original:** https://github.com/cegarra02/rolapp

---

## Estructura de archivos

```
index.html          — HTML puro, sin CSS ni JS inline
css/style.css       — Todos los estilos
js/
  state.js          — Variables globales: chars, profile, history, scenes, missions, tempRefPhotos…
  utils.js          — save, uid, esc, formatMsg, fmtTime, toast, compressImage
  ui.js             — showScreen, goHome, openModal, closeModal, switchTab, setActiveTab
  sliders.js        — updateSlider, initSliders
  api.js            — callAPI, buildSystemPrompt, buildMessages, buildPersonalityBlock
  cropper.js        — Motor completo del recortador de imágenes (touch + mouse)
  chars.js          — CRUD personajes + fotos de referencia (renderRefPhotos, loadRefPhoto…)
  profile.js        — Perfil del jugador + API keys (Anthropic + AI Horde)
  scenes.js         — Escenas grupales: renderScenesScreen, saveScene, openSceneChat
  inbox.js          — Pantalla "Chats" con historial reciente
  missions.js       — Misiones IA: generateMissions, checkMissionCompletion
  horde.js          — Generación de imágenes con AI Horde: generateChatImage, pollHordeJob…
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
- Las imágenes se comprimen a máx. 512px con canvas antes de guardar

---

## APIs integradas

### Anthropic (Claude) — chat con personajes
- Las llamadas se proxizan a través de un **Cloudflare Worker**:  
  `https://misty-heart-cd26.alex1234567890ct.workers.dev`
- El worker reenvía a `api.anthropic.com` añadiendo headers CORS
- Modelo: `claude-sonnet-4-6`
- API key del usuario guardada en `localStorage` como `rp_apikey`
- Se puede probar la conexión desde "Mi Perfil"

### AI Horde — generación de imágenes
- Llamadas **directas desde el navegador** (sin CORS)
- Endpoints:
  - POST `https://aihorde.net/api/v2/generate/async` — iniciar generación
  - GET `https://aihorde.net/api/v2/generate/check/{id}` — comprobar estado (polling cada 2s)
  - GET `https://aihorde.net/api/v2/generate/status/{id}` — obtener resultado
- API key guardada en `localStorage` como `rp_horde_key` (campo en "Mi Perfil")
- Modelo: `AlbedoBase XL (SDXL)`, 512×768, img2img si hay foto de referencia activa
- Los mensajes de imagen tienen `{ role: 'assistant', type: 'image', content: 'data:image/webp;base64,...' }`
- Los mensajes `image-loading` se limpian automáticamente al abrir el chat

---

## Decisiones de diseño importantes

- **Sin módulos ES**: todo en globals para máxima compatibilidad sin tooling. El orden de los `<script>` es la única "gestión de dependencias".
- **Proxy Cloudflare**: la API de Anthropic no permite llamadas directas desde navegador (CORS). El worker es mínimo y solo reenvía.
- **localStorage como BD**: toda la persistencia es local. No hay backend. Los datos están en el dispositivo del usuario.
- **Compresión de imágenes**: las fotos de personaje (fondo de chat) y fotos de referencia se comprimen a 512px/JPEG 0.82 antes de guardarse, para no saturar localStorage.
- **Fotos de referencia**: cada personaje puede tener hasta 4 fotos (campo `refPhotos[]`, índice activo `activeRefPhoto`). La foto activa se usa como `source_image` en AI Horde (img2img).
- **Historial de chat**: se guarda en cada objeto `char.history[]` o `scene.history[]`. Los mensajes de imagen se excluyen al construir el contexto para Claude (`buildMessages` filtra `type !== 'image'`).
- **Versión en URLs de scripts**: `?v=NN` en los `<script src>` sirve como cache-busting manual. Actualmente en **v25**.

---

## Proceso de deploy — IMPORTANTE

Al modificar cualquier archivo JS o CSS hay que hacer **tres cosas** antes del commit, o los usuarios verán la versión antigua aunque el repo esté actualizado:

1. **Subir el número de versión** en `index.html` — todos los `?v=NN` deben pasar al mismo número nuevo (buscar y reemplazar todo `?v=24` → `?v=25`, etc.).
2. **Actualizar `sw.js`** — cambiar `CACHE = 'rolapp-vNN'` al nuevo número Y actualizar la lista `ASSETS` para que incluya todos los archivos con el nuevo `?v=NN`. Si se añade un archivo JS nuevo, también hay que añadirlo aquí.
3. **Commit + push** de `index.html` y `sw.js` junto con los archivos modificados.

El Service Worker intercepta todas las peticiones y sirve desde su caché interna. Si `CACHE` no cambia de nombre, el SW sigue devolviendo los archivos antiguos aunque el servidor ya tenga los nuevos. El cambio de nombre de caché activa el ciclo `install → activate → skipWaiting → claim`, que borra la caché vieja y descarga la nueva.

---

## Contexto para continuar el desarrollo

- El proyecto no tiene tests ni CI. Los cambios se prueban manualmente en el navegador.
- La app está pensada para móvil (PWA, touch events, safe-area-inset).
- El chat soporta swipe horizontal para revelar un panel lateral (misiones).
- Las escenas tienen múltiples personajes y el prompt del sistema incluye a todos.
- El sistema de misiones usa Claude para generar retos narrativos y detectar su compleción automáticamente.
- Hay un sistema de estilos de chat por personaje/escena (colores de burbuja, opacidad, tamaño de fuente).
