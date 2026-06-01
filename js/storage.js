// ── storage.js — Imágenes de fondo en Supabase Storage ───────────────────────
//
// Las fotos de personaje (bg) se suben como ARCHIVOS a Supabase Storage y en el
// personaje solo se guarda la URL (texto corto). Ventajas frente a base64:
//   • Sin límite de localStorage (la URL ocupa ~100 bytes, no ~500 KB)
//   • Se respaldan en la nube y se ven en cualquier dispositivo
//   • El sync (chars_data) deja de inflarse con imágenes
//
// Requiere un bucket PÚBLICO llamado 'char-bg' en Supabase (ver SQL en CLAUDE.md).
// Si el bucket no existe o falla la subida, se conserva el base64 como fallback
// (comportamiento anterior), así que es seguro desplegar sin romper nada.
// ─────────────────────────────────────────────────────────────────────────────

const BG_BUCKET = 'char-bg';

function _isDataUri(s) { return typeof s === 'string' && s.startsWith('data:'); }
function _isHttpUrl(s) { return typeof s === 'string' && /^https?:\/\//.test(s); }

// Convierte un data URI base64 (data:image/png;base64,XXXX) en un Blob subible.
function _dataUriToBlob(uri) {
  const comma = uri.indexOf(',');
  const meta  = uri.slice(0, comma);
  const b64   = uri.slice(comma + 1);
  const mime  = (meta.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const bin   = atob(b64);
  const arr   = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// Sube la imagen base64 de un personaje a Storage y devuelve su URL pública
// (con cache-buster para que al cambiar la foto no se vea la antigua cacheada).
// Devuelve null si no hay sesión, no es base64, o falla la subida.
async function uploadCharBg(charId, dataUri) {
  if (!supabaseUser || !_isDataUri(dataUri)) return null;
  try {
    const blob = _dataUriToBlob(dataUri);
    const ext  = blob.type.includes('png') ? 'png'
               : blob.type.includes('webp') ? 'webp' : 'jpg';
    const path = `${supabaseUser.id}/${charId}.${ext}`;
    const { error } = await supaClient.storage.from(BG_BUCKET)
      .upload(path, blob, { upsert: true, contentType: blob.type, cacheControl: '3600' });
    if (error) { console.warn('[storage] upload bg:', error.message); return null; }
    const { data } = supaClient.storage.from(BG_BUCKET).getPublicUrl(path);
    if (!data || !data.publicUrl) return null;
    return data.publicUrl + '?t=' + Date.now(); // cache-buster
  } catch (e) {
    console.warn('[storage] upload bg catch:', e && e.message);
    return null;
  }
}

// Tras guardar un personaje: si su foto es base64 nueva y hay sesión, súbela a
// Storage en segundo plano y reemplaza bg por la URL. Refresca el chat si está
// abierto en ese personaje.
function offloadCharBg(charId) {
  if (!supabaseUser) return;
  const c = chars.find(x => x.id === charId);
  if (!c || !_isDataUri(c.bg)) return;
  const original = c.bg;
  uploadCharBg(charId, original).then(url => {
    if (!url) return;                       // bucket inexistente o error → se queda base64
    const cur = chars.find(x => x.id === charId);
    if (!cur || cur.bg !== original) return; // el usuario cambió la foto mientras subía
    cur.bg = url;
    save(); syncChars();
    // Refrescar fondo del chat si está abierto en este personaje
    if (typeof currentChar !== 'undefined' && currentChar && currentChar.id === charId) {
      const bgEl = document.getElementById('chatBg');
      if (bgEl) bgEl.style.backgroundImage = `url(${url})`;
    }
  });
}

// Migración en segundo plano: sube a Storage las fotos base64 que aún tengan los
// personajes (creados antes de Storage). Se ejecuta una vez tras iniciar sesión.
// Secuencial para no saturar la red; cada éxito persiste y sincroniza.
let _bgMigrationRan = false;
async function migrateBgsToStorage() {
  if (_bgMigrationRan || !supabaseUser) return;
  _bgMigrationRan = true;
  const pending = chars.filter(c => _isDataUri(c.bg));
  if (!pending.length) return;
  for (const c of pending) {
    const original = c.bg;
    const url = await uploadCharBg(c.id, original);
    if (url) {
      const cur = chars.find(x => x.id === c.id);
      if (cur && cur.bg === original) { cur.bg = url; save(); }
    }
  }
  syncChars(); // sube de una vez los chars_data ya con URLs
  console.log('[storage] migración de fondos completada:', pending.length);
}
