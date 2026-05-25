const ADMIN_EMAILS = ['alex1234567890ct@gmail.com'];

function isAdmin() {
  return !!(supabaseUser && ADMIN_EMAILS.includes(supabaseUser.email));
}

async function openModeration() {
  showScreen('moderationScreen', true);
  await renderModeration();
}

async function giveGemsToSelf() {
  if (!supabaseUser) return;
  const inp = document.getElementById('modSelfGemsInp');
  const amount = parseInt(inp?.value || '0');
  if (!amount || amount <= 0) { toast('Introduce una cantidad válida'); return; }
  const btn = inp?.nextElementSibling;
  if (btn) { btn.textContent = '⏳'; btn.style.pointerEvents = 'none'; }
  try {
    await addGems(supabaseUser.id, amount);
    await refreshGems();
    if (inp) inp.value = '';
    toast(`💎 +${amount} gemas añadidas`);
  } catch (e) {
    toast('Error: ' + (e?.message || 'fallo al añadir gemas'));
  } finally {
    if (btn) { btn.textContent = '+ Añadir'; btn.style.pointerEvents = ''; }
  }
}

async function renderModeration() {
  const list = document.getElementById('modList');
  // Actualizar saldo de gemas propio (leer de Supabase para tener el valor real)
  await refreshGems();
  const gemsEl = document.getElementById('modMyGems');
  if (gemsEl) gemsEl.textContent = getDisplayGems();
  list.innerHTML = '<div style="text-align:center;padding:40px;color:var(--muted)">Cargando submissions…</div>';

  const { data, error } = await supaClient
    .from('submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  console.log('[mod] user:', supabaseUser?.email, '| data:', data, '| error:', error);

  if (error) {
    list.innerHTML = `<div style="padding:20px;color:var(--danger)">Error: ${esc(error.message)}</div>`;
    return;
  }

  if (!data?.length) {
    list.innerHTML = '<div class="empty-state"><div class="icon">✓</div><p>Sin submissions pendientes</p></div>';
    return;
  }

  list.innerHTML = data.map(s => `
    <div class="mod-card" id="modcard-${s.id}">
      ${s.bg ? `<div class="mod-card-img" style="background-image:url('${s.bg}')"></div>` : ''}
      <div class="mod-card-body">
        <div class="mod-card-name">${esc(s.name)}</div>
        ${s.tag ? `<span class="char-card-tag" style="margin-bottom:8px;display:inline-block">${esc(s.tag)}</span>` : ''}
        ${s.desc    ? `<div class="mod-card-desc">${esc(s.desc)}</div>` : ''}
        ${s.context ? `<div class="mod-card-context">${esc(s.context)}</div>` : ''}
        <div class="mod-card-meta">
          ${s.gender === 'M' ? '♂ Hombre' : s.gender === 'F' ? '♀ Mujer' : ''}
          ${s.age ? ' · ' + s.age + ' años' : ''}
        </div>
        <div class="mod-card-sliders">
          Timidez: ${s.timid} · Romance: ${s.romantic} · Ritmo: ${s.pace} · NSFW: ${s.nsfw}
        </div>
        <div class="mod-card-meta" style="font-size:10px;margin-top:4px">
          Autor: ${esc(s.author_id || '—')}
        </div>
        <div class="mod-gems-row">
          <label style="font-size:13px;color:var(--muted)">Gemas al autor:</label>
          <input type="number" class="mod-gems-inp" id="modgems-${s.id}" value="0" min="0" max="9999">
        </div>
        <div class="mod-actions">
          <button class="mod-btn-approve" onclick="approveSubmission('${s.id}','${s.author_id}')">✓ Aprobar</button>
          <button class="mod-btn-reject"  onclick="rejectSubmission('${s.id}')">✕ Rechazar</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function approveSubmission(subId, authorId) {
  const { data: sub, error } = await supaClient.from('submissions').select('*').eq('id', subId).single();
  if (error || !sub) { toast('Error: ' + (error?.message || 'sin datos')); return; }

  const gems = parseInt(document.getElementById('modgems-' + subId)?.value || '0') || 0;

  const { error: insertErr } = await supaClient.from('characters_library').insert({
    name:      sub.name,
    tag:       sub.tag,
    gender:    sub.gender,
    age:       sub.age,
    desc:      sub.desc,
    context:   sub.context,
    greeting:  sub.greeting,
    bg:        sub.bg,
    timid:     sub.timid,
    romantic:  sub.romantic,
    pace:      sub.pace,
    nsfw:      sub.nsfw,
    author_id: sub.author_id,
    status:    'approved',
    chat_count: 0
  });

  if (insertErr) { toast('Error al insertar: ' + insertErr.message); return; }

  await supaClient.from('submissions').update({ status: 'approved' }).eq('id', subId);

  if (gems > 0 && authorId) await addGems(authorId, gems);

  toast('Aprobado ✓' + (gems > 0 ? ` · ${gems} gemas enviadas` : ''));
  document.getElementById('modcard-' + subId)?.remove();
}

async function rejectSubmission(subId) {
  await supaClient.from('submissions').update({ status: 'rejected' }).eq('id', subId);
  toast('Rechazado');
  document.getElementById('modcard-' + subId)?.remove();
}
