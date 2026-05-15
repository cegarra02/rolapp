function buildHordePrompt() {
  const c = currentChar;
  const parts = [];
  if (c.desc) parts.push(c.desc);
  if (c.gender === 'F') parts.push('female');
  else if (c.gender === 'M') parts.push('male');

  const charAge = parseInt(c.age);
  parts.push((charAge >= 18) ? `${charAge} years old` : 'adult, 18 years old');

  const lastMsgs = history
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.type !== 'image')
    .slice(-2);
  const context = lastMsgs
    .map(m => m.content.replace(/\*[^*]+\*/g, '').replace(/"[^"]+"/g, '').trim().slice(0, 120))
    .filter(Boolean)
    .join(', ');
  if (context) parts.push(context);

  parts.push('masterpiece, best quality, detailed');
  return parts.join(', ');
}

function getActiveRefPhoto() {
  if (!currentChar) return null;
  const photos = currentChar.refPhotos || [];
  if (!photos.length) return null;
  const idx = currentChar.activeRefPhoto ?? 0;
  return photos[idx] || photos[0] || null;
}

async function pollHordeJob(id) {
  while (true) {
    await new Promise(r => setTimeout(r, 2000));
    const checkRes = await fetch(`https://aihorde.net/api/v2/generate/check/${id}`);
    if (!checkRes.ok) throw new Error('Error comprobando estado');
    const data = await checkRes.json();
    if (data.faulted) throw new Error('La generación falló en AI Horde');
    if (data.done) {
      const statusRes = await fetch(`https://aihorde.net/api/v2/generate/status/${id}`);
      if (!statusRes.ok) throw new Error('Error obteniendo resultado');
      const result = await statusRes.json();
      const img = result.generations?.[0]?.img;
      if (!img) throw new Error('No se recibió imagen');
      return img;
    }
  }
}

function generateChatImage() {
  const key = localStorage.getItem('rp_horde_key') || '';
  if (!key) { toast('Añade tu AI Horde key en Mi Perfil'); return; }
  if (!currentChar) { toast('Solo disponible en chats individuales'); return; }

  const hasPhoto = !!getActiveRefPhoto();
  openModal('Generar imagen', [
    { label: '🎨 Generar', action: 'closeModal();doGenerateChatImage()' },
    { label: 'Cancelar',   action: 'closeModal()' }
  ]);
  const mb = document.getElementById('modalBody');
  if (mb) {
    mb.insertAdjacentHTML('afterbegin', `
      <p style="font-size:13px;color:var(--muted);margin-bottom:14px;line-height:1.7">
        ${hasPhoto
          ? '📷 <strong style="color:var(--text)">Con foto de referencia</strong> — usará la foto activa del personaje.'
          : '✦ <strong style="color:var(--text)">Solo texto</strong> — no hay foto de referencia activa.'
        }<br>Puede tardar entre 10 y 30 segundos.
      </p>`);
  }
}

async function doGenerateChatImage() {
  const key = localStorage.getItem('rp_horde_key') || '';
  if (!key || !currentChar) return;

  const prompt = buildHordePrompt();
  const activePhoto = getActiveRefPhoto();

  const loadIdx = history.length;
  history.push({ role: 'image-loading', content: '', ts: Date.now() });
  currentChar.history = history; save();
  renderMessages(); scrollBottom();

  try {
    const payload = {
      prompt,
      params: { width: 512, height: 768, steps: 30, sampler_name: 'k_euler_a', cfg_scale: 7 },
      nsfw: true,
      censor_nsfw: false,
      r2: false,
      models: ['AlbedoBase XL (SDXL)']
    };

    if (activePhoto) {
      payload.source_image = activePhoto.replace(/^data:[^;]+;base64,/, '');
      payload.source_processing = 'img2img';
      payload.denoising_strength = 0.6;
    }

    const res = await fetch('https://aihorde.net/api/v2/generate/async', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': key },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al iniciar generación (' + res.status + ')');
    }

    const { id } = await res.json();
    const imgB64 = await pollHordeJob(id);
    const mime = imgB64.startsWith('/9j/') ? 'image/jpeg' : 'image/png';

    history[loadIdx] = {
      role: 'assistant',
      type: 'image',
      content: `data:${mime};base64,${imgB64}`,
      ts: Date.now()
    };
    currentChar.history = history; save();
    renderMessages(); scrollBottom();
  } catch (err) {
    history.splice(loadIdx, 1);
    currentChar.history = history; save();
    renderMessages();
    toast('Error: ' + err.message);
  }
}

function openFullImg(idx) {
  const m = history[idx];
  if (!m || m.type !== 'image') return;
  const overlay = document.createElement('div');
  overlay.className = 'full-img-overlay';
  overlay.innerHTML = `
    <img src="${m.content}" alt="Imagen generada">
    <button class="full-img-dl-btn" onclick="event.stopPropagation();downloadImg(${idx});document.querySelector('.full-img-overlay').remove()" title="Guardar">💾 Guardar</button>
  `;
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
}
