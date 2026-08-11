/**
 * netlify/functions/admin.js
 * -------------------------------------------------------------
 * Console d'administration SCAF Innovation.
 * Acces par jeton signe HMAC uniquement. Toute commande est
 * executee cote base, journalisee, et jamais interpretee ici.
 * -------------------------------------------------------------
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  'https://scaf-innovation.com',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type':                 'application/json; charset=utf-8',
  'Cache-Control':                'no-store',
  'X-Robots-Tag':                 'noindex, nofollow'
};

const reply = (statusCode, body) => ({ statusCode, headers: CORS, body: JSON.stringify(body) });

async function rpc(nom, params) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nom}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey:         SERVICE_KEY,
      Authorization:  `Bearer ${SERVICE_KEY}`
    },
    body: JSON.stringify(params)
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`RPC ${nom} ${r.status} : ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')
    return reply(405, { status: 'erreur', message: 'Methode non autorisee' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { status: 'erreur', message: 'JSON invalide' }); }

  if (!body.jeton) return reply(401, { status: 'refuse', message: 'Jeton manquant' });

  const ip = event.headers['x-nf-client-connection-ip']
          || (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;

  try {
    return reply(200, await rpc('rpc_admin_executer', {
      p_jeton:    String(body.jeton),
      p_commande: String(body.commande || '').slice(0, 500),
      p_ip:       ip,
      p_code:     body.code ? String(body.code).slice(0, 100) : null
    }));
  } catch (e) {
    console.error('[admin]', e.message);
    return reply(500, { status: 'erreur', message: 'Erreur serveur.' });
  }
};
