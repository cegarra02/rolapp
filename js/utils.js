// ── Tag color system ─────────────────────────────────────────────────────────
// 8 colores distintos; el mismo nombre de tag → mismo color siempre
const _TAG_PALETTES = [
  ['rgba(56,189,248,.22)','rgba(56,189,248,.55)','rgba(56,189,248,.95)'],   // sky
  ['rgba(192,132,252,.22)','rgba(192,132,252,.55)','rgba(192,132,252,.95)'],// purple
  ['rgba(34,197,94,.22)','rgba(34,197,94,.55)','rgba(34,197,94,.95)'],      // green
  ['rgba(249,115,22,.22)','rgba(249,115,22,.55)','rgba(249,115,22,.95)'],   // orange
  ['rgba(244,63,94,.22)','rgba(244,63,94,.55)','rgba(244,63,94,.95)'],      // rose
  ['rgba(234,179,8,.22)','rgba(234,179,8,.55)','rgba(234,179,8,.95)'],      // yellow
  ['rgba(20,184,166,.22)','rgba(20,184,166,.55)','rgba(20,184,166,.95)'],   // teal
  ['rgba(239,68,68,.22)','rgba(239,68,68,.55)','rgba(239,68,68,.95)'],      // red
];
function _tagPalette(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (Math.imul(31, h) + tag.charCodeAt(i)) | 0;
  return _TAG_PALETTES[Math.abs(h) % _TAG_PALETTES.length];
}
// Chip pequeño para tarjetas de personaje (sin ×)
function tagBadgeHtml(tag) {
  const [bg, bd, col] = _tagPalette(tag);
  return `<span class="char-card-tag" style="background:${bg};border-color:${bd};color:${col}">${esc(tag)}</span>`;
}
// Etiquetas en tarjeta: muestra las que quepan en una fila + chip "+n"
function tagsMiniHtml(tags) {
  if (!tags || !tags.length) return '';
  const MAXW = 150;            // ancho útil aprox. de la fila de chips (px)
  const MORE = 36;             // espacio reservado para el chip "+n"
  const chipW = t => t.length * 6.6 + 22;
  let used = 0, shown = [];
  for (let i = 0; i < tags.length; i++) {
    const w = chipW(tags[i]) + (shown.length ? 5 : 0);
    const reserve = (i < tags.length - 1) ? MORE : 0;
    if (shown.length && used + w > MAXW - reserve) break;
    used += w; shown.push(tags[i]);
  }
  if (!shown.length) shown.push(tags[0]);
  const extra = tags.length - shown.length;
  return `<div class="card-tags-mini">` +
    shown.map(t => tagBadgeHtml(t)).join('') +
    (extra > 0 ? `<span class="char-card-tag tag-more">+${extra}</span>` : '') + `</div>`;
}
// Chip editable para el formulario de creación (con ×)
function tagChipHtml(tag) {
  const [bg, bd, col] = _tagPalette(tag);
  return `<span class="tag-chip" style="background:${bg};border-color:${bd};color:${col}">${esc(tag)}<button class="tag-chip-rm" onclick="removeEditTag(decodeURIComponent('${encodeURIComponent(tag)}'))" type="button">×</button></span>`;
}
// Chip de filtro explore (sin ×, con estilo activo opcional)
function exploreTagChipHtml(tag, active) {
  const [bg, bd, col] = _tagPalette(tag);
  const activeBg  = bg.replace(',.22)', ',.42)');
  const activeBd  = bd.replace(',.55)', ',.85)');
  return `<span class="explore-tag-chip${active ? ' active' : ''}" style="background:${active ? activeBg : bg};border-color:${active ? activeBd : bd};color:${col}" onclick="setExploreTag(decodeURIComponent('${encodeURIComponent(tag)}'))">${esc(tag)}</span>`;
}

// Escritura segura en localStorage. Devuelve true si persistió, false si falló.
function _lsSet(key, value) {
  try { localStorage.setItem(key, value); return true; }
  catch (e) { return false; }
}

// Guarda un array de personajes en localStorage tolerando la cuota llena (móvil ~5 MB).
// Las imágenes de fondo (base64) son lo que más ocupa: si no cabe, se reintenta
// sin las bg pesadas. Estas se conservan en MEMORIA (la sesión actual sigue
// mostrándolas) y, para usuarios con sesión, en Supabase (se restauran al recargar
// vía _mergeDbChars). Así el texto, ediciones y mensajes SIEMPRE se persisten.
// Devuelve true si guardó completo, 'degraded' si guardó sin imágenes pesadas,
// false si no pudo guardar. En los dos últimos casos ya muestra un toast.
function _saveCharsArray(key, arr) {
  if (_lsSet(key, JSON.stringify(arr))) return true;
  // Cuota llena → reintentar soltando imágenes de fondo grandes (>30 KB base64)
  // Silencioso: las bg se conservan en memoria y, con sesión, en Supabase.
  const slim = arr.map(c => (c && c.bg && c.bg.length > 30000)
    ? Object.assign({}, c, { bg: null })
    : c);
  if (_lsSet(key, JSON.stringify(slim))) return 'degraded';
  // Último recurso: soltar TODAS las bg
  const noBg = arr.map(c => (c && c.bg) ? Object.assign({}, c, { bg: null }) : c);
  if (_lsSet(key, JSON.stringify(noBg))) return 'degraded';
  // Solo avisamos si NO se pudo guardar absolutamente nada (pérdida real de datos)
  toast('⚠️ Almacenamiento lleno: no se pudo guardar');
  return false;
}

function save() { return _saveCharsArray('rp_chars', chars); }
function saveLibChars() { return _saveCharsArray('rp_lib_chars', libChars); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function esc(s) { return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function formatMsg(txt) {
  let s = esc(txt);
  // Se procesa por línea (antes de convertir \n) para que los marcadores no
  // "sangren" a través de saltos de línea. Tolerante con lo que genera Mistral:
  // **negrita** / *cursiva* y comillas rectas, tipográficas o guillemets.
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');   // **diálogo/énfasis** → fuerte
  s = s.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');               // *acción/narración* → cursiva
  s = s.replace(/"([^"\n]{1,300})"/g, '<strong>"$1"</strong>'); // "diálogo" recto
  s = s.replace(/“([^”\n]{1,300})”/g, '<strong>“$1”</strong>'); // “diálogo” tipográfico
  s = s.replace(/«([^»\n]{1,300})»/g, '<strong>«$1»</strong>'); // «diálogo» guillemets
  return s.replace(/\n/g, '<br>');
}
function fmtTime(ts) { const d = new Date(ts); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); }
// Formatea un contador de mensajes para la tarjeta: 0→null, 1500→'1.5k', 12000→'12k'
function _fmtStat(n) {
  if (!n || n < 1) return null;
  if (n >= 10000) return Math.round(n / 1000) + 'k';
  if (n >= 1000)  return (n / 1000).toFixed(1).replace('.0', '') + 'k';
  return String(n);
}
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}
