// ── Cloudflare Worker — proxy de chat a OpenRouter (Mistral Small) ───────────
//
// Despliegue: este archivo es la fuente del Worker
//   misty-heart-cd26.alex1234567890ct.workers.dev
// Configura en Cloudflare la variable SECRETA: OPENROUTER_KEY
//
// La app envía: { messages: [...formato OpenAI...], max_tokens?, temperature? }
//   - El primer mensaje del array es el system prompt (role "system").
// El Worker fija el modelo, la autorización y reintenta ante fallos transitorios.
// Responde el JSON de OpenRouter tal cual (la app lee choices[0].message.content).
// ─────────────────────────────────────────────────────────────────────────────

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL          = 'mistralai/mistral-small-2603';
const RETRY_STATUS   = [429, 502, 503];
const MAX_ATTEMPTS   = 3;
const RETRY_WAIT_MS  = 1000;
const REQUEST_TIMEOUT_MS = 45000; // un fetch colgado cuenta como fallo y reintenta

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Title',
};

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST')    return jsonResponse({ error: 'Method not allowed' }, 405);
    if (!env.OPENROUTER_KEY)          return jsonResponse({ error: 'OPENROUTER_KEY no configurada' }, 500);

    let body;
    try { body = await request.json(); } catch (e) { return jsonResponse({ error: 'JSON inválido' }, 400); }
    if (!Array.isArray(body.messages)) return jsonResponse({ error: 'Falta el array messages' }, 400);

    const payload = {
      model:       MODEL,
      messages:    body.messages,
      max_tokens:  body.max_tokens || 1000,
    };
    if (typeof body.temperature === 'number') payload.temperature = body.temperature;

    let lastErr = 'desconocido';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(OPENROUTER_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.OPENROUTER_KEY}`,
            'Content-Type':  'application/json',
            'X-Title':       'Storym',
          },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
        clearTimeout(timer);

        // Error transitorio → reintentar (tras espera) si quedan intentos
        if (RETRY_STATUS.includes(res.status)) {
          lastErr = 'status ' + res.status;
          if (attempt < MAX_ATTEMPTS) { await sleep(RETRY_WAIT_MS); continue; }
        }

        // Éxito o error no reintentable → devolver tal cual (con CORS)
        const text = await res.text();
        return new Response(text, {
          status: res.status,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      } catch (e) {
        clearTimeout(timer);
        lastErr = (e && e.name === 'AbortError') ? 'timeout' : (e && e.message || 'error de red');
        if (attempt < MAX_ATTEMPTS) { await sleep(RETRY_WAIT_MS); continue; }
      }
    }
    return jsonResponse({ error: 'OpenRouter no disponible tras ' + MAX_ATTEMPTS + ' intentos: ' + lastErr }, 502);
  },
};
