// ── Cloudflare Worker — chat (OpenRouter+gemas) + Explorar cacheado ──────────
//
// Worker: misty-heart-cd26.alex1234567890ct.workers.dev
// Variable SECRETA en Cloudflare: OPENROUTER_KEY
//
// POST  → chat: exige JWT de Supabase, descuenta gemas (deduct_gems) ANTES de
//          llamar a OpenRouter; reembolsa si OpenRouter falla. (Ver más abajo.)
// GET ?explore     → lista pública de personajes (characters_library) CACHEADA
//                    ~60s en el edge (reduce muchísimo la carga de Supabase:
//                    miles de aperturas = ~1 consulta por filtro cada 60s).
// GET ?exploretags → lista de etiquetas, también cacheada.
// ─────────────────────────────────────────────────────────────────────────────

const SUPA_URL  = 'https://pxtnjtkckfzsqistfjgn.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4dG5qdGtja2Z6c3Fpc3RmamduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDc1ODgsImV4cCI6MjA5NDg4MzU4OH0.toSgkHMYun1yM5UePDGRXYjhe4DRGtRQjsNUGjh5wJY';
const GEM_COST  = 7;            // debe coincidir con MESSAGE_GEM_COST en la app
const EXPLORE_TTL = 60;         // segundos de caché para Explorar

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return corsResponse('', 204);

    // ── Explorar (público, cacheado) + callback SSV de AdMob ─────────────────
    if (request.method === 'GET') {
      const url = new URL(request.url);
      if (url.pathname.replace(/\/+$/, '').endsWith('/admob-ssv')) return handleAdmobSSV(request, env);
      if (url.searchParams.has('explore'))     return handleExplore(url);
      if (url.searchParams.has('exploretags')) return handleExploreTags(url);
      return corsResponse(JSON.stringify({ error: { message: 'Not found' } }), 404);
    }

    if (request.method !== 'POST') return corsResponse(JSON.stringify({ error: { message: 'Method not allowed' } }), 405);

    // Webhook de RevenueCat (server-to-server): acredita gemas tras compra real.
    const url = new URL(request.url);
    if (url.pathname.replace(/\/+$/, '').endsWith('/rc-webhook')) return handleRevenueCatWebhook(request, env);

    return handleChat(request, env);
  }
};

// ─────────────── WEBHOOK RevenueCat → acreditación verificada ─────────────────
// Cadena de confianza: Google Play (pago) → RevenueCat (valida recibo) → este
// webhook (secreto compartido) → credit_purchase (importe decidido en servidor).
// El cliente NO acredita nada de compras: solo refresca su saldo.
async function handleRevenueCatWebhook(request, env) {
  // RevenueCat envía el secreto en el header Authorization (configurado en su panel).
  const auth = request.headers.get('Authorization') || '';
  if (!env.RC_SECRET || auth !== env.RC_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch (e) { return new Response('bad json', { status: 400 }); }
  const ev = body && body.event;
  if (!ev) return new Response('no event', { status: 400 });

  const userId    = ev.app_user_id || '';
  const productId = ev.product_id || '';
  const eventId   = ev.id || ((ev.transaction_id || '') + ':' + productId);

  // Ignorar IDs anónimos de RevenueCat (no se hizo logIn con el uid de Supabase).
  if (!userId || userId.indexOf('$RCAnonymousID:') === 0) {
    return new Response('anon user, skipped', { status: 200 });
  }

  // ── ¿Es un evento de VIP (suscripción)? ─────────────────────────────────────
  // Detectamos por el entitlement 'vip' o por el product_id (vip_*).
  const ents = Array.isArray(ev.entitlement_ids) ? ev.entitlement_ids
             : (ev.entitlement_id ? [ev.entitlement_id] : []);
  const isVip = ents.indexOf('vip') !== -1 || productId.indexOf('vip') === 0;

  if (isVip) return handleVipEvent(ev, userId, env);

  // ── Si no, es una compra de gemas (consumible) ──────────────────────────────
  const GEM_CREDIT_TYPES = ['NON_RENEWING_PURCHASE', 'NON_SUBSCRIPTION_PURCHASE'];
  if (GEM_CREDIT_TYPES.indexOf(ev.type) === -1) return new Response('ignored', { status: 200 });
  if (!productId || !eventId) return new Response('missing fields', { status: 200 });

  let result;
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/credit_purchase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPA_ANON, 'Authorization': 'Bearer ' + SUPA_ANON },
      body: JSON.stringify({ p_secret: env.RC_SECRET, p_user_id: userId, p_product_id: productId, p_event_id: eventId }),
    });
    if (!r.ok) {
      // Excepción en la RPC (p.ej. user_not_found) → 500 para que RevenueCat reintente.
      return new Response('db error: ' + (await r.text()), { status: 500 });
    }
    result = await r.json();
  } catch (e) {
    return new Response('fetch error: ' + (e && e.message), { status: 500 });
  }

  if (result && result.ok === false && result.error === 'unauthorized') {
    // Secreto de BD mal configurado → 500 para reintentar tras corregirlo.
    return new Response('rpc unauthorized', { status: 500 });
  }
  // ok:true / duplicate / unknown_product → 200 (no reintentar).
  return new Response(JSON.stringify(result || {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

// Evento de suscripción VIP → actualiza users.vip_until con la expiración que
// reporta RevenueCat. Cubre alta, renovación, cancelación (sigue activo hasta la
// fecha) y expiración (fecha pasada → deja de ser VIP). Eventos sin expiración
// (p.ej. BILLING_ISSUE inicial) se ignoran con 200.
async function handleVipEvent(ev, userId, env) {
  const VIP_TYPES = ['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION',
                     'CANCELLATION', 'EXPIRATION', 'SUBSCRIPTION_EXTENDED', 'SUBSCRIPTION_PAUSED'];
  if (VIP_TYPES.indexOf(ev.type) === -1) return new Response('vip ignored', { status: 200 });

  const expMs = Number(ev.expiration_at_ms);
  if (!expMs || isNaN(expMs)) return new Response('vip no expiration', { status: 200 });

  // 1) Actualizar la expiración del VIP (users.vip_until).
  let result;
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/rpc/set_vip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPA_ANON, 'Authorization': 'Bearer ' + SUPA_ANON },
      body: JSON.stringify({ p_secret: env.RC_SECRET, p_user_id: userId, p_expiration_ms: expMs }),
    });
    if (!r.ok) return new Response('db error: ' + (await r.text()), { status: 500 });
    result = await r.json();
  } catch (e) {
    return new Response('fetch error: ' + (e && e.message), { status: 500 });
  }
  if (result && result.ok === false && result.error === 'unauthorized') {
    return new Response('rpc unauthorized', { status: 500 });
  }

  // 2) Perk "300 gemas al mes": acreditar el bono en cada alta/renovación.
  //    Reutiliza credit_purchase (importe en gem_products, idempotente por event_id).
  if (ev.type === 'INITIAL_PURCHASE' || ev.type === 'RENEWAL') {
    const eventId = ev.id || ((ev.transaction_id || '') + ':vipbonus');
    try {
      const g = await fetch(`${SUPA_URL}/rest/v1/rpc/credit_purchase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPA_ANON, 'Authorization': 'Bearer ' + SUPA_ANON },
        body: JSON.stringify({ p_secret: env.RC_SECRET, p_user_id: userId, p_product_id: 'vip_gems_bonus', p_event_id: eventId }),
      });
      if (!g.ok) return new Response('vip bonus db error: ' + (await g.text()), { status: 500 });
      const gj = await g.json();
      if (gj && gj.ok === false && gj.error === 'unauthorized') return new Response('rpc unauthorized', { status: 500 });
      result = { ok: true, vip: result, bonus: gj };
    } catch (e) {
      return new Response('vip bonus fetch error: ' + (e && e.message), { status: 500 });
    }
  }

  return new Response(JSON.stringify(result || {}), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

// ───────────────────────── CHAT (gemas en servidor) ──────────────────────────
async function handleChat(request, env) {
  if (!env.OPENROUTER_KEY) return corsResponse(JSON.stringify({ error: { message: 'OPENROUTER_KEY no configurada' } }), 500);

  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return corsResponse(JSON.stringify({ error: { code: 'no_auth', message: 'Inicia sesión para chatear' } }), 401);

  let body;
  try { body = await request.json(); } catch (e) { return corsResponse(JSON.stringify({ error: { message: 'JSON inválido' } }), 400); }
  if (!Array.isArray(body.messages)) return corsResponse(JSON.stringify({ error: { message: 'Falta messages' } }), 400);

  // Descuento atómico en servidor
  let newBalance;
  try {
    const dRes = await fetch(`${SUPA_URL}/rest/v1/rpc/deduct_gems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPA_ANON, 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ amount: GEM_COST }),
    });
    if (dRes.status === 401) return corsResponse(JSON.stringify({ error: { code: 'no_auth', message: 'Sesión caducada' } }), 401);
    if (!dRes.ok) return corsResponse(JSON.stringify({ error: { message: 'Error al verificar gemas' } }), 502);
    newBalance = await dRes.json();
  } catch (e) {
    return corsResponse(JSON.stringify({ error: { message: 'Error al verificar gemas: ' + e.message } }), 502);
  }
  if (typeof newBalance !== 'number' || newBalance < 0) {
    return corsResponse(JSON.stringify({ error: { code: 'no_gems', message: 'Sin gemas suficientes' } }), 402);
  }

  const payload = {
    model: 'mistralai/mistral-small-2603',
    messages: body.messages,
    max_tokens: body.max_tokens || 1000,
  };
  if (typeof body.temperature === 'number') payload.temperature = body.temperature;

  const RETRY_STATUS = [429, 502, 503];
  let lastErr = 'desconocido';
  for (let attempt = 1; attempt <= 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 45000);
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${env.OPENROUTER_KEY}`, 'X-Title': 'Storym' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (RETRY_STATUS.includes(response.status) && attempt < 3) { lastErr = 'status ' + response.status; await sleep(1000); continue; }
      if (!response.ok) { await refund(token); return corsResponse(await response.text(), response.status); }
      return corsResponse(await response.text(), 200);
    } catch (e) {
      clearTimeout(timer);
      lastErr = (e && e.name === 'AbortError') ? 'timeout' : (e && e.message || 'error de red');
      if (attempt < 3) { await sleep(1000); continue; }
    }
  }
  await refund(token);
  return corsResponse(JSON.stringify({ error: { message: 'OpenRouter no disponible tras 3 intentos: ' + lastErr } }), 502);
}

// ───────────────────────── EXPLORAR (cacheado) ───────────────────────────────
// Limpia valores que romperían la sintaxis de filtros de PostgREST.
function clean(s) { return (s || '').replace(/[(),*]/g, '').trim().slice(0, 60); }

async function handleExplore(url) {
  const q      = clean(url.searchParams.get('q'));
  const gender = url.searchParams.get('gender') === 'M' ? 'M' : url.searchParams.get('gender') === 'F' ? 'F' : '';
  const tags   = (url.searchParams.get('tags') || '').split(',').map(clean).filter(Boolean).slice(0, 8);
  const sort   = url.searchParams.get('sort') === 'popular' ? 'popular' : 'new';

  // Clave de caché normalizada (compartida entre todos los usuarios con el mismo filtro)
  const keyUrl = `https://storym.cache/explore?q=${encodeURIComponent(q)}&g=${gender}&t=${encodeURIComponent(tags.join(','))}&s=${sort}`;
  const cache = caches.default;
  const cacheKey = new Request(keyUrl, { method: 'GET' });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  // Construir la consulta PostgREST
  const p = new URLSearchParams();
  p.set('select', 'id,name,tag,tags,bg,chat_count,message_count,created_at');
  p.append('status', 'eq.approved');
  if (q) p.append('name', 'ilike.*' + q + '*');
  if (gender) p.append('gender', 'eq.' + gender);
  if (tags.length) {
    const orParts = tags.map(t => `tag.eq.${t}`).concat(`tags.ov.{${tags.join(',')}}`).join(',');
    p.append('or', `(${orParts})`);
  }
  p.set('order', sort === 'popular' ? 'message_count.desc' : 'created_at.desc');
  p.set('limit', '50');

  let resp;
  try {
    resp = await fetch(`${SUPA_URL}/rest/v1/characters_library?${p.toString()}`, {
      headers: { 'apikey': SUPA_ANON, 'Authorization': 'Bearer ' + SUPA_ANON },
    });
  } catch (e) {
    return corsResponse(JSON.stringify({ error: { message: 'Explore fetch: ' + e.message } }), 502);
  }
  const text = await resp.text();
  const out = new Response(text, {
    status: resp.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${EXPLORE_TTL}` },
  });
  if (resp.ok) await cache.put(cacheKey, out.clone());
  return out;
}

async function handleExploreTags() {
  const cache = caches.default;
  const cacheKey = new Request('https://storym.cache/exploretags', { method: 'GET' });
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  let resp;
  try {
    resp = await fetch(`${SUPA_URL}/rest/v1/characters_library?select=tags,tag&status=eq.approved`, {
      headers: { 'apikey': SUPA_ANON, 'Authorization': 'Bearer ' + SUPA_ANON },
    });
  } catch (e) {
    return corsResponse(JSON.stringify({ error: { message: 'Tags fetch: ' + e.message } }), 502);
  }
  const text = await resp.text();
  const out = new Response(text, {
    status: resp.status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${EXPLORE_TTL}` },
  });
  if (resp.ok) await cache.put(cacheKey, out.clone());
  return out;
}

// ──────────────── ADMOB SSV (gemas por anuncio verificadas) ──────────────────
// Google llama a esta URL tras un anuncio recompensado, FIRMADO con ECDSA. Se
// verifica la firma con las claves públicas de Google y solo entonces se
// acreditan las gemas (importe en gem_products('ad_reward'), idempotente por
// transaction_id). El cliente ya no acredita nada.
let _ssvKeysCache = null;
let _ssvKeysAt = 0;

async function _getVerifierKeys() {
  const now = Date.now();
  if (_ssvKeysCache && (now - _ssvKeysAt) < 3600000) return _ssvKeysCache; // 1h
  const r = await fetch('https://gstatic.com/admob/reward/verifier-keys.json');
  const j = await r.json();
  _ssvKeysCache = j.keys || [];
  _ssvKeysAt = now;
  return _ssvKeysCache;
}

function _b64ToBytes(b64) {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// DER ECDSA (SEQUENCE{ INTEGER r, INTEGER s }) → raw r||s de 64 bytes (P-256).
function _derToRaw(der) {
  let i = 0;
  if (der[i++] !== 0x30) throw new Error('DER seq');
  if (der[i] & 0x80) i += 1 + (der[i] & 0x7f); else i++; // saltar longitud seq
  function readInt() {
    if (der[i++] !== 0x02) throw new Error('DER int');
    let len = der[i++];
    let v = der.slice(i, i + len); i += len;
    while (v.length > 32 && v[0] === 0x00) v = v.slice(1); // quitar 0x00 de signo
    const out = new Uint8Array(32);
    out.set(v, 32 - v.length); // pad-left a 32
    return out;
  }
  const r = readInt(), s = readInt();
  const raw = new Uint8Array(64);
  raw.set(r, 0); raw.set(s, 32);
  return raw;
}

async function handleAdmobSSV(request, env) {
  try {
    const rawUrl = request.url;
    const qIdx = rawUrl.indexOf('?');
    if (qIdx === -1) return new Response('no query', { status: 400 });
    const query = rawUrl.slice(qIdx + 1);
    const marker = '&signature=';
    const sIdx = query.indexOf(marker);
    if (sIdx === -1) return new Response('no signature', { status: 400 });
    const message = query.slice(0, sIdx);                 // contenido firmado (exacto)
    const tail = query.slice(sIdx + marker.length);        // signature=...&key_id=...
    const signatureB64 = tail.split('&key_id=')[0];
    const keyId = tail.split('&key_id=')[1];

    const params = new URLSearchParams(query);
    const userId = params.get('user_id') || '';
    const txnId  = params.get('transaction_id') || '';
    if (!userId || userId.indexOf('$RCAnonymousID:') === 0) return new Response('no user', { status: 200 });
    if (!txnId) return new Response('no txn', { status: 200 });

    // Verificar la firma con la clave pública de Google correspondiente al key_id.
    const keys = await _getVerifierKeys();
    const k = keys.find(x => String(x.keyId) === String(keyId));
    if (!k || !k.base64) return new Response('unknown key', { status: 400 });

    const pubKey = await crypto.subtle.importKey(
      'spki', _b64ToBytes(k.base64),
      { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']
    );
    const rawSig = _derToRaw(_b64ToBytes(signatureB64));
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' }, pubKey, rawSig, new TextEncoder().encode(message)
    );
    if (!ok) return new Response('bad signature', { status: 403 });

    // Firma válida → acreditar (importe en servidor, idempotente por txn, y CUPO
    // en servidor: rechaza si el usuario supera el máximo de anuncios por ventana).
    const res = await fetch(`${SUPA_URL}/rest/v1/rpc/credit_ad_reward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPA_ANON, 'Authorization': 'Bearer ' + SUPA_ANON },
      body: JSON.stringify({ p_secret: env.RC_SECRET, p_user_id: userId, p_event_id: 'ad_' + txnId }),
    });
    if (!res.ok) return new Response('db error', { status: 500 }); // AdMob reintentará
    // ok / duplicate / cap / unknown_product → 200 (no reintentar).
    return new Response('ok', { status: 200 });
  } catch (e) {
    return new Response('ssv error: ' + (e && e.message), { status: 500 });
  }
}

// ───────────────────────── Utilidades ────────────────────────────────────────
async function refund(token) {
  try {
    await fetch(`${SUPA_URL}/rest/v1/rpc/refund_gems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPA_ANON, 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ amount: GEM_COST }),
    });
  } catch (e) { /* best-effort */ }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function corsResponse(body, status) {
  return new Response(body, { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}
