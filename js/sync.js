// ── sync.js — Persistencia de datos de usuario en Supabase ───────────────────
//
// Qué se sincroniza:
//   • Perfil del jugador              → users.profile      (JSONB)
//   • Configuración de personajes     → users.chars_data   (JSONB, sin bg/history/hitos)
//   • Configuración de escenas        → users.scenes_data  (JSONB, sin history/hitos)
//   • Historiales de chat e hitos     → tabla user_histories
//
// Qué NO se sincroniza:
//   • bg (imágenes base64) — demasiado grandes para la BD
//   • rp_apikey            — ¡seguridad! queda solo en localStorage
//
// Todos los sync son fire-and-forget (no bloquean la UI).
// localStorage es la fuente de verdad de la sesión activa.
// Supabase actúa como backup y sincronización cross-device.
// ─────────────────────────────────────────────────────────────────────────────

// Cuando el historial supera HISTORY_MAX, se podan los más antiguos conservando
// solo los HISTORY_PRUNE_TO más recientes. Esto ocurre tanto en localStorage como
// en la BD, de forma que ambos siempre contienen los mismos mensajes.
const HISTORY_MAX      = 400;  // mensajes antes de lanzar la poda
const HISTORY_PRUNE_TO = 200;  // mensajes a conservar (los más recientes)

// bg se sincroniza a Supabase si está por debajo de este límite. Así las fotos
// se respaldan en la nube y se restauran en otros dispositivos (vía _mergeDbChars).
// Subido a ~1 MB base64 (≈ 750 KB de imagen) para cubrir fotos normales: antes
// estaba en 300 KB y las más grandes no se respaldaban → desaparecían al soltarse
// de localStorage por falta de espacio.
const BG_SYNC_MAX_FREE = 1000000; // caracteres base64 ≈ 750 KB imagen real

const _syncTimers   = {};
const _pendingHist  = new Map(); // entityId → { historyArr, hitosArr } para flush en background

function _debounceSync(key, ms, fn) {
  clearTimeout(_syncTimers[key]);
  _syncTimers[key] = setTimeout(fn, ms);
}

// Cuando la app va a segundo plano, flusheamos inmediatamente todos los historiales
// pendientes para que no se pierdan por el SO cancelando los timers.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden || !supabaseUser || !_pendingHist.size) return;
  _pendingHist.forEach(({ historyArr, hitosArr }, entityId) => {
    clearTimeout(_syncTimers['h_' + entityId]);
    delete _syncTimers['h_' + entityId];
    _doSyncHistory(entityId, historyArr, hitosArr);
  });
  _pendingHist.clear();
});

// Devuelve el array podado si supera el límite; si no, lo devuelve tal cual.
// Es un no-op cuando arr.length ≤ HISTORY_MAX, por lo que es seguro llamarlo siempre.
function pruneHistory(arr) {
  if (!arr || arr.length <= HISTORY_MAX) return arr || [];
  return arr.slice(-HISTORY_PRUNE_TO); // conservar los HISTORY_PRUNE_TO más recientes
}

// Prepara un personaje para la BD.
// • bg: se incluye solo si está dentro del límite gratuito; imágenes más grandes
//   quedan en localStorage únicamente.
// • history, hitos: excluidos → van en la tabla user_histories.
function _charForDb(c) {
  const out = {};
  for (const k in c) {
    if (k === 'history' || k === 'hitos') continue;
    if (k === 'bg') {
      if (c.bg && c.bg.length <= BG_SYNC_MAX_FREE) out.bg = c.bg;
      // Si bg supera el límite gratuito, simplemente se omite
      continue;
    }
    out[k] = c[k];
  }
  return out;
}

// Prepara una escena para la BD: excluye history e hitos
function _sceneForDb(s) {
  const out = {};
  for (const k in s) {
    if (k !== 'history' && k !== 'hitos') out[k] = s[k];
  }
  return out;
}

// ── Carga datos del usuario desde BD al iniciar sesión ───────────────────────
async function _loadUserDataFromDb() {
  if (!supabaseUser) return;
  try {
    // Obtener perfil/chars/escenas e historiales en paralelo
    const [userRes, histRes] = await Promise.all([
      supaClient.from('users')
        .select('profile, chars_data, scenes_data')
        .eq('id', supabaseUser.id)
        .single(),
      supaClient.from('user_histories')
        .select('entity_id, history, hitos')
        .eq('user_id', supabaseUser.id)
    ]);

    if (userRes.error) {
      console.error('[sync] _loadUserDataFromDb users error:', userRes.error.message, userRes.error.code);
      toast('⚠️ Sync error: ' + userRes.error.message.slice(0, 60));
      return;
    }
    if (histRes.error) {
      console.warn('[sync] user_histories error:', histRes.error.message, histRes.error.code);
      // Tabla inexistente → avisar al usuario con instrucciones claras
      if (histRes.error.code === '42P01') {
        toast('⚠️ Tabla user_histories no existe — ejecuta el SQL en Supabase Dashboard');
      }
    }

    const db   = userRes.data || {};
    // Mapa rápido entity_id → { history, hitos }
    const hMap = {};
    (histRes.data || []).forEach(h => { hMap[h.entity_id] = h; });

    // ── 1. Perfil ──────────────────────────────────────────────────────────
    if (db.profile && Object.keys(db.profile).length) {
      // La BD gana: fue sincronizada desde algún dispositivo del usuario
      profile = Object.assign({}, profile, db.profile);
      localStorage.setItem('rp_profile', JSON.stringify(profile));
      // Refrescar campos del formulario si la pantalla de perfil ya está visible
      if (typeof loadProfileFields === 'function') loadProfileFields();
    }

    // ── 2. Personajes propios ──────────────────────────────────────────────
    _mergeDbChars(db.chars_data || [], hMap);

    // ── 3. Escenas ─────────────────────────────────────────────────────────
    _mergeDbScenes(db.scenes_data || [], hMap);

    // ── 4. Historiales de personajes de biblioteca ─────────────────────────
    _mergeDbLibHistories(hMap);

    // ── 4b. Subida inicial (local → BD) ────────────────────────────────────
    // El sync solo sube al crear/editar. Si hay personajes o escenas locales
    // que NO están en la BD (creados antes de tener sesión, o en un dispositivo
    // que no se re-guardó), súbelos ahora para que la nube quede completa.
    // Solo se sube cuando hay datos local-only → idempotente, no machaca la BD.
    const dbCharIds  = new Set((db.chars_data  || []).map(c => c && c.id));
    const dbSceneIds = new Set((db.scenes_data || []).map(s => s && s.id));
    if (chars.some(c => !dbCharIds.has(c.id)))  syncChars();
    if (scenes.some(s => !dbSceneIds.has(s.id))) syncScenes();

    // ── 4c. Migrar fotos base64 → Supabase Storage (segundo plano) ─────────
    // Sube a Storage las imágenes que aún estén embebidas como base64 y las
    // reemplaza por su URL. Libera localStorage y las respalda cross-device.
    if (typeof migrateBgsToStorage === 'function') migrateBgsToStorage();

    // ── 5. Refrescar UI con datos recién cargados ──────────────────────────
    // renderChars/renderScenesScreen no se habían llamado aún con los datos de BD
    if (typeof renderChars === 'function') renderChars();
    if (typeof renderScenesScreen === 'function') renderScenesScreen();

    const nChars   = (db.chars_data  || []).length;
    const nScenes  = (db.scenes_data || []).length;
    const nHistories = Object.keys(hMap).length;
    console.log(`[sync] cargado ✓ — ${nChars} personajes, ${nScenes} escenas, ${nHistories} historiales desde BD`);
  } catch (e) {
    console.error('[sync] _loadUserDataFromDb catch:', e?.message);
    toast('⚠️ Sync error inesperado: ' + (e?.message || '?').slice(0, 60));
  }
}

// Fusiona personajes de BD con los locales
function _mergeDbChars(dbChars, hMap) {
  if (!dbChars.length) return;
  const localById = {};
  chars.forEach(c => { localById[c.id] = c; });
  let changed = false;

  dbChars.forEach(dbC => {
    const h      = hMap[dbC.id] || {};
    const dbHist = h.history || [];
    const dbHit  = h.hitos   || [];

    if (localById[dbC.id]) {
      // El personaje existe localmente.
      const local = localById[dbC.id];
      // Restaurar historial/hitos si la BD tiene más mensajes/hitos.
      if (dbHist.length > (local.history || []).length) { local.history = dbHist; changed = true; }
      if (dbHit.length  > (local.hitos   || []).length) { local.hitos   = dbHit;  changed = true; }
      // Restaurar bg desde BD si no está disponible localmente (ej: caché borrada).
      if (!local.bg && dbC.bg) { local.bg = dbC.bg; changed = true; }
    } else {
      // Personaje de otro dispositivo: bg viene incluido en dbC si estaba bajo el límite.
      const newChar = Object.assign({}, dbC, { history: dbHist, hitos: dbHit });
      if (!newChar.bg) newChar.bg = null; // garantizar campo definido
      localById[dbC.id] = newChar;
      chars.push(newChar);
      changed = true;
    }
  });

  if (changed) save();
}

// Fusiona escenas de BD con las locales
function _mergeDbScenes(dbScenes, hMap) {
  if (!dbScenes.length) return;
  const localById = {};
  scenes.forEach(s => { localById[s.id] = s; });
  let changed = false;

  dbScenes.forEach(dbS => {
    const h      = hMap[dbS.id] || {};
    const dbHist = h.history || [];
    const dbHit  = h.hitos   || [];

    if (localById[dbS.id]) {
      const local = localById[dbS.id];
      if (dbHist.length > (local.history || []).length) { local.history = dbHist; changed = true; }
      if (dbHit.length  > (local.hitos   || []).length) { local.hitos   = dbHit;  changed = true; }
    } else {
      const newScene = Object.assign({}, dbS, { history: dbHist, hitos: dbHit });
      localById[dbS.id] = newScene;
      scenes.push(newScene);
      changed = true;
    }
  });

  if (changed) saveScenes();
}

// Fusiona historiales de personajes de biblioteca
function _mergeDbLibHistories(hMap) {
  let changed = false;
  libChars.forEach(lc => {
    const h = hMap[lc.id]; // lc.id ya tiene prefijo 'lib_'
    if (!h) return;
    if ((h.history || []).length > (lc.history || []).length) { lc.history = h.history; changed = true; }
    if ((h.hitos   || []).length > (lc.hitos   || []).length) { lc.hitos   = h.hitos;   changed = true; }
  });
  if (changed) saveLibChars();
}

// ── Sync perfil → BD ──────────────────────────────────────────────────────────
function syncProfile() {
  if (!supabaseUser) return;
  const p = Object.assign({}, profile);
  delete p._tempGender; // campo interno de UI, no persisitir en BD
  supaClient.from('users').update({ profile: p }).eq('id', supabaseUser.id)
    .then(({ error }) => {
      if (error) { console.error('[sync] profile:', error.message, error.code); toast('⚠️ Sync perfil: ' + error.message.slice(0, 50)); }
      else          console.log('[sync] profile ✓');
    });
}

// ── Sync personajes → BD (solo config, sin bg / history / hitos) ─────────────
function syncChars() {
  if (!supabaseUser) return;
  supaClient.from('users').update({ chars_data: chars.map(_charForDb) }).eq('id', supabaseUser.id)
    .then(({ error }) => {
      if (error) { console.error('[sync] chars:', error.message, error.code); toast('⚠️ Sync chars: ' + error.message.slice(0, 50)); }
      else          console.log('[sync] chars ✓ (' + chars.length + ' personajes)');
    });
}

// ── Sync escenas → BD (solo config, sin history / hitos) ─────────────────────
function syncScenes() {
  if (!supabaseUser) return;
  supaClient.from('users').update({ scenes_data: scenes.map(_sceneForDb) }).eq('id', supabaseUser.id)
    .then(({ error }) => {
      if (error) { console.error('[sync] scenes:', error.message, error.code); toast('⚠️ Sync escenas: ' + error.message.slice(0, 50)); }
      else          console.log('[sync] scenes ✓');
    });
}

// ── Sync historial de chat → BD ───────────────────────────────────────────────
// entityId: id del char propio, 'lib_<id>', o id de escena

// Función interna que hace el upsert real. La llama syncHistory (vía debounce)
// y también el listener de visibilitychange para forzar el flush inmediato.
function _doSyncHistory(entityId, historyArr, hitosArr) {
  _pendingHist.delete(entityId); // ya no está pendiente: se está enviando ahora
  supaClient.from('user_histories').upsert({
    user_id:    supabaseUser.id,
    entity_id:  entityId,
    history:    pruneHistory(historyArr || []),
    hitos:      hitosArr || [],
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,entity_id' })
  .then(({ error }) => {
    if (error) { console.error('[sync] history', entityId + ':', error.message, error.code); toast('⚠️ Sync historial: ' + error.message.slice(0, 50)); }
    else          console.log('[sync] history ✓ ' + entityId);
  });
}

// Registra el historial como pendiente y lo envía tras 1,5 s de inactividad.
// Si la app va a segundo plano antes, visibilitychange lo flushea de inmediato.
function syncHistory(entityId, historyArr, hitosArr) {
  if (!supabaseUser) return;
  _pendingHist.set(entityId, { historyArr, hitosArr }); // rastrear para flush en background
  _debounceSync('h_' + entityId, 1500, () => {
    _doSyncHistory(entityId, historyArr, hitosArr);
  });
}
