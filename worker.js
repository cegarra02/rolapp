// ── Cloudflare Worker — chat OpenRouter (Mistral Small) con gemas en servidor ─
//
// Worker: misty-heart-cd26.alex1234567890ct.workers.dev
// Variable SECRETA a configurar en Cloudflare: OPENROUTER_KEY
//
// Seguridad: CADA mensaje exige un usuario con sesión (JWT de Supabase) y
// descuenta gemas en el SERVIDOR (RPC deduct_gems) ANTES de llamar a OpenRouter.
// Sin sesión → 401. Sin saldo → 402. Así nadie puede gastar tu crédito de
// OpenRouter sin gemas legítimas, ni llamando al Worker directamente ni con un
// cliente modificado. Si OpenRouter falla tras los reintentos, se reembolsan
// las gemas.
//
// La app envía: { messages: [...OpenAI...], max_tokens? } + header
//   Authorization: Bearer <supabase access_token>
// Devuelve el JSON de OpenRouter (la app lee choices[0].message.content).
// ─────────────────────────────────────────────────────────────────────────────

const SUPA_URL  = 'https://pxtnjtkckfzsqistfjgn.supabase.co';
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB4dG5qdGtja2Z6c3Fpc3RmamduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDc1ODgsImV4cCI6MjA5NDg4MzU4OH0.toSgkHMYun1yM5UePDGRXYjhe4DRGtRQjsNUGjh5wJY';
const GEM_COST  = 7; // debe coincidir con MESSAGE_GEM_COST en la app

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return corsResponse('', 204);
    if (request.method !== 'POST')    return corsResponse(JSON.stringify({ error: { message: 'Method not allowed' } }), 405);
    if (!env.OPENROUTER_KEY)          return corsResponse(JSON.stringify({ error: { message: 'OPENROUTER_KEY no configurada' } }), 500);

    // ── 1. Sesión obligatoria ───────────────────────────────────────────────
    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return corsResponse(JSON.stringify({ error: { code: 'no_auth', message: 'Inicia sesión para chatear' } }), 401);

    let body;
    try { body = await request.json(); } catch (e) { return corsResponse(JSON.stringify({ error: { message: 'JSON inválido' } }), 400); }
    if (!Array.isArray(body.messages)) return corsResponse(JSON.stringify({ error: { message: 'Falta messages' } }), 400);

    // ── 2. Descontar gemas en el SERVIDOR (autoridad real) ──────────────────
    let newBalance;
    try {
      const dRes = await fetch(`${SUPA_URL}/rest/v1/rpc/deduct_gems`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPA_ANON, 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ amount: GEM_COST }),
      });
      if (dRes.status === 401) return corsResponse(JSON.stringify({ error: { code: 'no_auth', message: 'Sesión caducada' } }), 401);
      if (!dRes.ok) return corsResponse(JSON.stringify({ error: { message: 'Error al verificar gemas' } }), 502);
      newBalance = await dRes.json(); // nuevo saldo, o -1 si insuficiente
    } catch (e) {
      return corsResponse(JSON.stringify({ error: { message: 'Error al verificar gemas: ' + e.message } }), 502);
    }
    if (typeof newBalance !== 'number' || newBalance < 0) {
      return corsResponse(JSON.stringify({ error: { code: 'no_gems', message: 'Sin gemas suficientes' } }), 402);
    }

    // ── 3. Llamar a OpenRouter con reintentos ───────────────────────────────
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
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.OPENROUTER_KEY}`,
            'X-Title': 'Storym',
          },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
        clearTimeout(timer);

        if (RETRY_STATUS.includes(response.status) && attempt < 3) {
          lastErr = 'status ' + response.status;
          await sleep(1000);
          continue;
        }

        if (!response.ok) {            // error no reintentable → reembolsar gemas
          await refund(token);
          const errText = await response.text();
          return corsResponse(errText, response.status);
        }

        const data = await response.text();
        return corsResponse(data, 200); // éxito: gemas ya descontadas
      } catch (e) {
        clearTimeout(timer);
        lastErr = (e && e.name === 'AbortError') ? 'timeout' : (e && e.message || 'error de red');
        if (attempt < 3) { await sleep(1000); continue; }
      }
    }

    // Agotados los reintentos → reembolsar gemas y devolver error
    await refund(token);
    return corsResponse(JSON.stringify({ error: { message: 'OpenRouter no disponible tras 3 intentos: ' + lastErr } }), 502);
  }
};

async function refund(token) {
  try {
    await fetch(`${SUPA_URL}/rest/v1/rpc/refund_gems`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPA_ANON, 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ amount: GEM_COST }),
    });
  } catch (e) { /* el reembolso es best-effort */ }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function corsResponse(body, status) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
