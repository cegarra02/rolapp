let exploreChars = [];
let exploreTags  = [];
let exploreSearch = '';
let exploreActiveTag = '';
let exploreSort  = 'new';

async function renderExploreScreen() {
  renderExploreLoading();
  await Promise.all([fetchExploreChars(), fetchExploreTags()]);
  renderExploreList();
  renderExploreTags();
}

function renderExploreLoading() {
  const list = document.getElementById('exploreList');
  if (list) list.innerHTML = '<div class="explore-loading">Cargando…</div>';
}

async function fetchExploreChars() {
  let q = supaClient
    .from('characters_library')
    .select('id, name, tag, bg, chat_count, created_at')
    .eq('status', 'approved');

  if (exploreSearch) q = q.ilike('name', `%${exploreSearch}%`);
  if (exploreActiveTag) q = q.eq('tag', exploreActiveTag);
  q = exploreSort === 'popular'
    ? q.order('chat_count', { ascending: false })
    : q.order('created_at', { ascending: false });

  const { data, error } = await q.limit(50);
  if (error) { console.error('explore fetch:', error); return; }
  exploreChars = data || [];
}

async function fetchExploreTags() {
  const { data } = await supaClient
    .from('characters_library')
    .select('tag')
    .eq('status', 'approved')
    .not('tag', 'is', null);
  if (!data) return;
  const counts = {};
  data.forEach(r => { if (r.tag) counts[r.tag] = (counts[r.tag] || 0) + 1; });
  exploreTags = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([t]) => t);
}

function renderExploreTags() {
  const el = document.getElementById('exploreTagsRow');
  if (!el) return;
  el.innerHTML =
    `<div class="explore-tag-chip${!exploreActiveTag ? ' active' : ''}" onclick="setExploreTag('')">Todos</div>` +
    exploreTags.map(t =>
      `<div class="explore-tag-chip${exploreActiveTag === t ? ' active' : ''}" onclick="setExploreTag(${JSON.stringify(t)})">${esc(t)}</div>`
    ).join('');
}

function renderExploreList() {
  const list = document.getElementById('exploreList');
  if (!list) return;
  if (!exploreChars.length) {
    list.innerHTML = `<div class="empty-state" style="grid-column:span 2"><div class="icon">🔍</div><p>Aún no hay personajes en la biblioteca</p></div>`;
    return;
  }
  list.innerHTML = exploreChars.map(x => `
    <div class="char-card" onclick="openExploreChat('${x.id}')">
      ${x.bg
        ? `<div class="char-card-bg" style="background-image:url('${x.bg}')"></div>`
        : `<div class="char-card-bg-placeholder">${esc((x.name || '?')[0])}</div>`}
      <div class="char-card-body">
        <div class="char-card-name">${esc(x.name)}</div>
        ${x.tag ? `<span class="char-card-tag">${esc(x.tag)}</span>` : ''}
      </div>
    </div>`
  ).join('');
}

function setExploreTag(tag) {
  exploreActiveTag = tag;
  renderExploreScreen();
}

function setExploreSort(val) {
  exploreSort = val;
  renderExploreScreen();
}

function onExploreSearch(val) {
  exploreSearch = val;
  clearTimeout(window._exploreTimer);
  window._exploreTimer = setTimeout(() => renderExploreScreen(), 400);
}

async function openExploreChat(libCharId) {
  const { data, error } = await supaClient
    .from('characters_library')
    .select('*')
    .eq('id', libCharId)
    .single();

  if (error || !data) { toast('Error cargando personaje'); return; }

  // Increment chat_count (fire and forget)
  supaClient.from('characters_library')
    .update({ chat_count: (data.chat_count || 0) + 1 })
    .eq('id', libCharId);

  const ch = {
    id:        'lib_' + libCharId,
    name:      data.name,
    tag:       data.tag,
    gender:    data.gender,
    age:       data.age,
    shoeSize:  data.shoe_size,
    desc:      data.desc,
    context:   data.context,
    greeting:  data.greeting,
    bg:        data.bg,
    timid:     data.timid    ?? 5,
    romantic:  data.romantic ?? 5,
    pace:      data.pace     ?? 4,
    nsfw:      data.nsfw     ?? 7,
    hitos:     [],
    hitosEnabled: false,
    history:   [],
    isLibraryChar: true
  };

  currentChar  = ch;
  currentScene = null;
  history      = [];

  document.getElementById('chatName').textContent = ch.name;
  const metaParts = [];
  if (ch.age)      metaParts.push(ch.age + ' años');
  if (ch.shoeSize) metaParts.push('Talla ' + ch.shoeSize);
  document.getElementById('chatMeta').textContent = metaParts.join(' · ');

  const bg = document.getElementById('chatBg');
  if (ch.bg) { bg.style.backgroundImage = `url(${ch.bg})`; bg.style.display = 'block'; }
  else bg.style.display = 'none';

  renderMessages();
  isSwiped = false;
  document.getElementById('chatContentWrap').classList.remove('swiped');
  document.getElementById('swipeHint').style.display = '';
  showScreen('chat', true);

  if (!history.length && ch.greeting) {
    history.push({ role: 'assistant', content: ch.greeting, ts: Date.now() });
    renderMessages();
  }
  setTimeout(() => { const m = document.getElementById('messages'); m.scrollTop = m.scrollHeight; }, 50);
}
