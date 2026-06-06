// ── Cloudflare Worker — proxy de chat a OpenRouter (Mistral Small) ───────────
//
// Worker: misty-heart-cd26.alex1234567890ct.workers.dev
// Variable SECRETA a configurar en Cloudflare: OPENROUTER_KEY
//
// La app envía: { messages: [...formato OpenAI...], max_tokens?, temperature? }
//   - El primer mensaje es el system prompt (role "system").
// El Worker fija modelo + clave (nada se expone en el cliente) y reintenta ante
// fallos transitorios. Devuelve el JSON de OpenRouter tal cual
// (la app lee choices[0].message.content).
// ─────────────────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return corsResponse('', 204);
    }
    if (request.method !== 'POST') {
      return corsResponse(JSON.stringify({ error: { message: 'Method not allowed' } }), 405);
    }
    if (!env.OPENROUTER_KEY) {
      return corsResponse(JSON.stringify({ error: { message: 'OPENROUTER_KEY no configurada' } }), 500);
    }

    try {
      const body = await request.json();

      const payload = {
        model: 'mistralai/mistral-small-2603',
        messages: Array.isArray(body.messages) ? body.messages : [],
        max_tokens: body.max_tokens || 1000,
      };
      if (typeof body.temperature === 'number') payload.temperature = body.temperature;

      const RETRY_STATUS = [429, 502, 503];
      let lastErr = 'desconocido';

      for (let attempt = 1; attempt <= 3; attempt++) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 45000); // timeout → cuenta como fallo
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

          // Error transitorio → espera 1s y reintenta (si quedan intentos)
          if (RETRY_STATUS.includes(response.status) && attempt < 3) {
            lastErr = 'status ' + response.status;
            await sleep(1000);
            continue;
          }

          // Éxito o error no reintentable → devolver tal cual
          const data = await response.text();
          return corsResponse(data, response.status);

        } catch (e) {
          clearTimeout(timer);
          lastErr = (e && e.name === 'AbortError') ? 'timeout' : (e && e.message || 'error de red');
          if (attempt < 3) { await sleep(1000); continue; }
        }
      }

      return corsResponse(JSON.stringify({ error: { message: 'OpenRouter no disponible tras 3 intentos: ' + lastErr } }), 502);

    } catch (e) {
      return corsResponse(JSON.stringify({ error: { message: e.message } }), 500);
    }
  }
};

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function corsResponse(body, status) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
