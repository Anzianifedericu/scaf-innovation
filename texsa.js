/**
 * netlify/functions/texsa.js
 * -------------------------------------------------------------
 * Relais serveur du portail professionnel TEXSA.
 *
 * Le navigateur ne voit JAMAIS :
 *   - la cle service_role
 *   - les prix d'achat, le coefficient, la marge
 *   - le lien d'edition interne du devis
 *
 * Tout le calcul tarifaire est fait par Postgres. Cette fonction
 * ne fait que router 4 actions vers les RPC correspondantes.
 * -------------------------------------------------------------
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CORS = {
  'Access-Control-Allow-Origin':  'https://scaf-innovation.com',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type':                 'application/json; charset=utf-8',
  'Cache-Control':                'no-store'
};

const reply = (statusCode, body) => ({
  statusCode,
  headers: CORS,
  body: JSON.stringify(body)
});

async function rpc(nom, params) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nom}`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      apikey:          SERVICE_KEY,
      Authorization:   `Bearer ${SERVICE_KEY}`
    },
    body: JSON.stringify(params)
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`RPC ${nom} ${r.status} : ${txt.slice(0, 300)}`);
  return txt ? JSON.parse(txt) : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST')    return reply(405, { status: 'erreur', message: 'Methode non autorisee' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { status: 'erreur', message: 'JSON invalide' }); }

  const ip = event.headers['x-nf-client-connection-ip']
          || (event.headers['x-forwarded-for'] || '').split(',')[0].trim()
          || null;

  try {
    switch (body.action) {

      /* 1. Demande du code a usage unique -------------------- */
      case 'login':
        if (!body.siret) return reply(400, { status: 'erreur', message: 'SIRET manquant' });
        return reply(200, await rpc('rpc_texsa_login', {
          p_siret: String(body.siret), p_ip: ip
        }));

      /* 2. Verification du code -> session 30 jours ---------- */
      case 'otp':
        if (!body.siret || !body.code)
          return reply(400, { status: 'erreur', message: 'SIRET ou code manquant' });
        return reply(200, await rpc('rpc_texsa_otp', {
          p_siret: String(body.siret), p_code: String(body.code)
        }));

      /* 3. Catalogue, tarife pour ce tiers ------------------- */
      case 'catalogue':
        if (!body.session) return reply(401, { status: 'session_invalide' });
        return reply(200, await rpc('rpc_texsa_catalogue_session', {
          p_session: String(body.session)
        }));

      /* 4. Envoi de la demande ------------------------------- */
      case 'demande': {
        if (!body.session) return reply(401, { status: 'session_invalide' });
        if (!Array.isArray(body.lignes) || body.lignes.length === 0)
          return reply(400, { status: 'erreur', message: 'Panier vide' });
        if (body.lignes.length > 200)
          return reply(400, { status: 'erreur', message: 'Trop de lignes' });

        // On ne transmet que code + quantite : aucun prix venant du client
        const lignes = body.lignes
          .map(l => ({ code: String(l.code || ''), quantite: Number(l.quantite) || 0 }))
          .filter(l => l.code && l.quantite > 0);

        if (lignes.length === 0)
          return reply(400, { status: 'erreur', message: 'Aucune ligne exploitable' });

        return reply(200, await rpc('rpc_texsa_demande_session', {
          p_session:  String(body.session),
          p_lignes:   lignes,
          p_chantier: body.chantier ? String(body.chantier).slice(0, 200) : null,
          p_notes:    body.notes    ? String(body.notes).slice(0, 2000)  : null
        }));
      }

      default:
        return reply(400, { status: 'erreur', message: 'Action inconnue' });
    }
  } catch (e) {
    console.error('[texsa]', e.message);
    return reply(500, { status: 'erreur', message: 'Erreur serveur. Reessaie dans un instant.' });
  }
};
