function save() { localStorage.setItem('rp_chars', JSON.stringify(chars)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function esc(s) { return String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function formatMsg(txt) {
  return esc(txt)
    .replace(/\n/g, '<br>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/"([^"\n]{1,300})"/g, '<strong>"$1"</strong>');
}
function fmtTime(ts) { const d = new Date(ts); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); }
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}
