function drawPreview() {
  const cvs = document.getElementById('cropperPreview');
  if (!cvs || !cr.img) return;
  const ctx = cvs.getContext('2d');
  const W = cvs.width, H = cvs.height;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(cr.img, cr.imgX, cr.imgY, cr.img.width * cr.scale, cr.img.height * cr.scale);

  if (cr.mode === 'circle') {
    const r = Math.min(W, H) * 0.45;
    const cx = W / 2, cy = H / 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H);
    ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,126,157,0.95)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(W / 3, 0); ctx.lineTo(W / 3, H);
    ctx.moveTo(2 * W / 3, 0); ctx.lineTo(2 * W / 3, H);
    ctx.moveTo(0, H / 3); ctx.lineTo(W, H / 3);
    ctx.moveTo(0, 2 * H / 3); ctx.lineTo(W, 2 * H / 3);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,126,157,0.6)'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
  }
}

function crClamp() {
  const iw = cr.img.width * cr.scale, ih = cr.img.height * cr.scale;
  const W = cr.canvasW, H = cr.canvasH;
  if (cr.mode === 'circle') {
    const r = Math.min(W, H) * 0.45;
    const cx = W / 2, cy = H / 2;
    if (cr.imgX > cx - r) cr.imgX = cx - r;
    if (cr.imgX + iw < cx + r) cr.imgX = cx + r - iw;
    if (cr.imgY > cy - r) cr.imgY = cy - r;
    if (cr.imgY + ih < cy + r) cr.imgY = cy + r - ih;
  } else {
    if (cr.imgX > 0) cr.imgX = 0;
    if (cr.imgX + iw < W) cr.imgX = W - iw;
    if (cr.imgY > 0) cr.imgY = 0;
    if (cr.imgY + ih < H) cr.imgY = H - ih;
  }
}

function openCropper(src, mode, title, onConfirm) {
  const overlay = document.getElementById('cropperOverlay');
  const vp = document.getElementById('cropperViewport');
  const cvs = document.getElementById('cropperPreview');
  document.getElementById('cropperTitle').textContent = title || 'Ajustar imagen';
  document.getElementById('cropperSubtitle').textContent =
    mode === 'circle' ? 'Arrastra · pellizca para encuadrar el círculo' : 'Mueve y ajusta · lo que ves es lo que se guarda';
  cr.mode = mode; cr.onConfirm = onConfirm;
  overlay.classList.remove('hidden');

  const img = new Image();
  img.onload = () => {
    cr.img = img;
    const vw = vp.clientWidth, vh = vp.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    let cw, ch;
    if (mode === 'circle') {
      cw = vw; ch = vh;
    } else {
      // Force 9:16 portrait aspect ratio so image always fills a mobile screen
      const ratio = 9 / 16;
      if (vh * ratio <= vw) { ch = vh; cw = Math.round(vh * ratio); }
      else { cw = vw; ch = Math.round(vw / ratio); }
    }
    cvs.width = cw * dpr; cvs.height = ch * dpr;
    cvs.style.width = cw + 'px'; cvs.style.height = ch + 'px';
    const W = cvs.width, H = cvs.height;
    cr.canvasW = W; cr.canvasH = H;

    if (mode === 'circle') {
      const r = Math.min(W, H) * 0.45;
      const minS = Math.max((r * 2) / img.width, (r * 2) / img.height);
      cr.minScale = minS; cr.maxScale = minS * 6;
      cr.scale = minS;
      cr.imgX = W / 2 - img.width * minS / 2;
      cr.imgY = H / 2 - img.height * minS / 2;
    } else {
      // minScale forces image to always cover the 9:16 canvas
      const minS = Math.max(W / img.width, H / img.height);
      cr.minScale = minS; cr.maxScale = minS * 5;
      cr.scale = minS;
      cr.imgX = (W - img.width * minS) / 2;
      cr.imgY = (H - img.height * minS) / 2;
    }
    const sl = document.getElementById('zoomSlider');
    sl.min = 0; sl.max = 1000; sl.value = 500;
    drawPreview();
  };
  img.src = src;
}

function sliderToScale(val) {
  const t = val / 1000;
  return cr.minScale * Math.pow(cr.maxScale / cr.minScale, t);
}

function scaleToSlider(s) {
  return Math.round(1000 * Math.log(s / cr.minScale) / Math.log(cr.maxScale / cr.minScale));
}

function applyZoom(newScale, pivotX, pivotY) {
  newScale = Math.max(cr.minScale, Math.min(cr.maxScale, newScale));
  const factor = newScale / cr.scale;
  cr.imgX = pivotX - (pivotX - cr.imgX) * factor;
  cr.imgY = pivotY - (pivotY - cr.imgY) * factor;
  cr.scale = newScale;
  crClamp();
  document.getElementById('zoomSlider').value = scaleToSlider(newScale);
  drawPreview();
}

function onZoomSlider(val) {
  const cvs = document.getElementById('cropperPreview');
  applyZoom(sliderToScale(val), cvs.width / 2, cvs.height / 2);
}

function cropZoom(dir) {
  const step = (cr.maxScale - cr.minScale) / 20;
  applyZoom(cr.scale + dir * step, cr.canvasW / 2, cr.canvasH / 2);
}

function closeCropper() {
  document.getElementById('cropperOverlay').classList.add('hidden');
  cr.img = null;
}

function confirmCrop() {
  const cvs = document.getElementById('cropperPreview');
  const W = cvs.width, H = cvs.height;
  const out = document.createElement('canvas');
  out.width = W; out.height = H;
  const ctx = out.getContext('2d');

  if (cr.mode === 'circle') {
    const r = Math.min(W, H) * 0.45;
    const cx = W / 2, cy = H / 2;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(cr.img, cr.imgX, cr.imgY, cr.img.width * cr.scale, cr.img.height * cr.scale);
    ctx.restore();
    const sq = document.createElement('canvas');
    sq.width = r * 2; sq.height = r * 2;
    sq.getContext('2d').drawImage(out, cx - r, cy - r, r * 2, r * 2, 0, 0, r * 2, r * 2);
    const result = sq.toDataURL('image/png', 0.95);
    closeCropper();
    if (cr.onConfirm) cr.onConfirm(result);
  } else {
    ctx.drawImage(cr.img, cr.imgX, cr.imgY, cr.img.width * cr.scale, cr.img.height * cr.scale);
    const result = out.toDataURL('image/jpeg', 0.92);
    closeCropper();
    if (cr.onConfirm) cr.onConfirm(result);
  }
}

// Touch & Mouse handlers for the cropper
(function () {
  function getVP() { return document.getElementById('cropperViewport'); }
  function active() { return !document.getElementById('cropperOverlay').classList.contains('hidden'); }

  document.addEventListener('touchstart', e => {
    if (!active()) return;
    if (e.target.closest('.cropper-controls,.cropper-topbar')) return;
    e.preventDefault();
    if (e.touches.length === 1) {
      crDrag.on = true; crPinch.on = false;
      const dpr = window.devicePixelRatio || 1;
      const vp = getVP(); const rect = vp.getBoundingClientRect();
      crDrag.sx = (e.touches[0].clientX - rect.left) * dpr;
      crDrag.sy = (e.touches[0].clientY - rect.top) * dpr;
      crDrag.ox = cr.imgX; crDrag.oy = cr.imgY;
    } else if (e.touches.length === 2) {
      crDrag.on = false; crPinch.on = true;
      const vp = getVP(); const rect = vp.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      crPinch.d0 = Math.hypot(dx, dy); crPinch.s0 = cr.scale;
      crPinch.mx = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) * dpr;
      crPinch.my = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) * dpr;
    }
  }, {passive: false});

  document.addEventListener('touchmove', e => {
    if (!active()) return;
    if (e.target.closest('.cropper-controls,.cropper-topbar')) return;
    e.preventDefault();
    const dpr = window.devicePixelRatio || 1;
    const vp = getVP(); const rect = vp.getBoundingClientRect();
    if (crDrag.on && e.touches.length === 1) {
      cr.imgX = crDrag.ox + ((e.touches[0].clientX - rect.left) * dpr - crDrag.sx);
      cr.imgY = crDrag.oy + ((e.touches[0].clientY - rect.top) * dpr - crDrag.sy);
      crClamp(); drawPreview();
    } else if (crPinch.on && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const d = Math.hypot(dx, dy);
      const newS = crPinch.s0 * (d / crPinch.d0);
      const mx = ((e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left) * dpr;
      const my = ((e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top) * dpr;
      applyZoom(newS, mx, my);
    }
  }, {passive: false});

  document.addEventListener('touchend', e => {
    if (!active()) return;
    if (e.touches.length === 0) { crDrag.on = false; crPinch.on = false; }
    else if (e.touches.length === 1 && crPinch.on) {
      crPinch.on = false; crDrag.on = true;
      const dpr = window.devicePixelRatio || 1;
      const vp = getVP(); const rect = vp.getBoundingClientRect();
      crDrag.sx = (e.touches[0].clientX - rect.left) * dpr;
      crDrag.sy = (e.touches[0].clientY - rect.top) * dpr;
      crDrag.ox = cr.imgX; crDrag.oy = cr.imgY;
    }
  }, {passive: true});

  let mdown = false;
  document.addEventListener('mousedown', e => {
    if (!active() || e.target.closest('.cropper-controls,.cropper-topbar')) return;
    mdown = true;
    const dpr = window.devicePixelRatio || 1;
    const vp = getVP(); const rect = vp.getBoundingClientRect();
    crDrag.sx = (e.clientX - rect.left) * dpr;
    crDrag.sy = (e.clientY - rect.top) * dpr;
    crDrag.ox = cr.imgX; crDrag.oy = cr.imgY;
  });
  document.addEventListener('mousemove', e => {
    if (!mdown || !active()) return;
    const dpr = window.devicePixelRatio || 1;
    const vp = getVP(); const rect = vp.getBoundingClientRect();
    cr.imgX = crDrag.ox + ((e.clientX - rect.left) * dpr - crDrag.sx);
    cr.imgY = crDrag.oy + ((e.clientY - rect.top) * dpr - crDrag.sy);
    crClamp(); drawPreview();
  });
  document.addEventListener('mouseup', () => { mdown = false; });
  document.addEventListener('wheel', e => {
    if (!active() || e.target.closest('.cropper-controls')) return;
    e.preventDefault();
    const dpr = window.devicePixelRatio || 1;
    const vp = getVP(); const rect = vp.getBoundingClientRect();
    const px = (e.clientX - rect.left) * dpr, py = (e.clientY - rect.top) * dpr;
    applyZoom(cr.scale * (e.deltaY < 0 ? 1.08 : 0.93), px, py);
  }, {passive: false});
})();
