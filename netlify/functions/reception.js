/**
 * netlify/functions/reception.js
 * -------------------------------------------------------------
 * Saisie des quantites recues sur une commande fournisseur.
 * Acces par jeton signe HMAC uniquement, valide 90 jours.
 * Les quantites sont bornees cote base : on ne peut pas
 * receptionner plus que ce qui a ete commande.
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

  if (!body.jeton) return reply(401, { status: 'refuse', message: 'Lien incomplet' });

  try {
    if (body.action === 'valider') {
      const lignes = Array.isArray(body.lignes) ? body.lignes
        .filter(l => l && l.code && Number(l.quantite) > 0)
        .slice(0, 200)
        .map(l => ({ code: String(l.code).slice(0, 60), quantite: Number(l.quantite) }))
        : [];
      if (lignes.length === 0)
        return reply(400, { status: 'erreur', message: 'Aucune quantite saisie.' });

      return reply(200, await rpc('rpc_cf_reception_valider', {
        p_jeton:  String(body.jeton),
        p_lignes: lignes,
        p_date:   body.date || null
      }));
    }

    // lecture par defaut
    return reply(200, await rpc('rpc_cf_reception_lire', { p_jeton: String(body.jeton) }));
  } catch (e) {
    console.error('[reception]', e.message);
    return reply(500, { status: 'erreur', message: 'Erreur serveur.' });
  }
};
