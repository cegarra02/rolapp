// Blur any focused text field when a range slider is touched to prevent keyboard-dismiss scroll jump
document.addEventListener('touchstart', e => {
  if (e.target.type !== 'range') return;
  const a = document.activeElement;
  if (a && a !== e.target && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) a.blur();
}, {passive: true});

function updateSlider(el, valId) {
  const v = parseInt(el.value);
  document.getElementById(valId).textContent = v;
  const pct = ((v - 1) / 9) * 100;
  el.style.background = `linear-gradient(to right,var(--accent) ${pct}%,var(--border) ${pct}%)`;
}

function initSliders(char) {
  const defaults = {slTimid: 5, slRomantic: 5, slPace: 4, slNsfw: 7};
  const vals = {
    slTimid:    char?.timid    ?? defaults.slTimid,
    slRomantic: char?.romantic ?? defaults.slRomantic,
    slPace:     char?.pace     ?? defaults.slPace,
    slNsfw:     char?.nsfw     ?? defaults.slNsfw,
  };
  const map = {slTimid: 'valTimid', slRomantic: 'valRomantic', slPace: 'valPace', slNsfw: 'valNsfw'};
  Object.entries(vals).forEach(([id, v]) => {
    const el = document.getElementById(id);
    if (el) { el.value = v; updateSlider(el, map[id]); }
  });
}
