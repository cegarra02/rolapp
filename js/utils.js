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

function save() { localStorage.setItem('rp_chars', JSON.stringify(chars)); }
function saveLibChars() { localStorage.setItem('rp_lib_chars', JSON.stringify(libChars)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function esc(s) { return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function formatMsg(txt) {
  return esc(txt)
    .replace(/\n/g, '<br>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/"([^"\n]{1,300})"/g, '<strong>"$1"</strong>');
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
