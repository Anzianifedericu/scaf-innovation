/**
 * netlify/functions/pro.js
 * -------------------------------------------------------------
 * Portail professionnel unifie SCAF Innovation.
 * Remplace l'ancien PRO_PORTAL_WEBHOOK (Airtable) et couvre :
 *   - login SIRET + code a usage unique
 *   - tarif pro Menage (Parex)
 *   - catalogue BTP : Nudura + TEXSA
 *   - commande ferme OU demande de devis
 *
 * Le navigateur ne recoit jamais : prix d'achat, coefficient,
 * marge, ni la cle service_role.
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
  if (event.httpMethod !== 'POST')    return reply(405, { status: 'erreur', message: 'Methode non autorisee' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { status: 'erreur', message: 'JSON invalide' }); }

  const ip = event.headers['x-nf-client-connection-ip']
          || (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || null;

  const session = body.session ? String(body.session) : null;

  try {
    switch (body.action) {

      /* --- Connexion ------------------------------------- */
      case 'login':
        if (!body.siret) return reply(400, { status: 'erreur', message: 'SIRET manquant' });
        return reply(200, await rpc('rpc_texsa_login', { p_siret: String(body.siret), p_ip: ip }));

      case 'otp':
        if (!body.siret || !body.code)
          return reply(400, { status: 'erreur', message: 'SIRET ou code manquant' });
        return reply(200, await rpc('rpc_texsa_otp', {
          p_siret: String(body.siret), p_code: String(body.code)
        }));

      /* --- Tarif pro Menage : { sku -> prix_pro_ht } ------ */
      case 'menage':
        if (!session) return reply(401, { status: 'session_invalide' });
        return reply(200, await rpc('rpc_pro_catalogue_menage', { p_session: session }));

      /* --- Catalogue BTP : Nudura + TEXSA ----------------- */
      case 'btp':
        if (!session) return reply(401, { status: 'session_invalide' });
        return reply(200, await rpc('rpc_pro_catalogue_btp', { p_session: session }));

      /* --- Moyens de reglement proposes ------------------- */
      case 'moyens':
        if (!session) return reply(401, { status: 'session_invalide' });
        return reply(200, await rpc('rpc_moyens_paiement', {
          p_montant: Number(body.montant) || null,
          p_gamme:   body.gamme === 'nudura' ? 'nudura' : 'texsa'
        }));

      /* --- Intention de paiement -------------------------- */
      /* Le montant est lu sur le document cote serveur.      */
      case 'intention': {
        if (!session) return reply(401, { status: 'session_invalide' });
        if (!body.document_id || !body.mode)
          return reply(400, { status: 'erreur', message: 'Document ou mode manquant' });
        return reply(200, await rpc('rpc_paiement_intention', {
          p_session:     session,
          p_document_id: String(body.document_id),
          p_mode:        String(body.mode),
          p_ip:          ip,
          p_user_agent:  event.headers['user-agent'] || null
        }));
      }

      /* --- Coordonnees bancaires (virement) --------------- */
      case 'rib':
        if (!session) return reply(401, { status: 'session_invalide' });
        return reply(200, await rpc('rpc_rib_public', {}));

      /* --- Commande ferme ou demande de devis ------------- */
      case 'commander': {
        if (!session) return reply(401, { status: 'session_invalide' });
        if (!Array.isArray(body.lignes) || body.lignes.length === 0)
          return reply(400, { status: 'erreur', message: 'Panier vide' });
        if (body.lignes.length > 300)
          return reply(400, { status: 'erreur', message: 'Trop de lignes' });

        // Seuls code, marque et quantite sont transmis.
        // Tout prix envoye par le navigateur est ignore.
        const lignes = body.lignes.map(l => ({
          code:     String(l.code || ''),
          marque:   l.marque === 'nudura' ? 'nudura' : 'texsa',
          quantite: Number(l.quantite) || 0
        })).filter(l => l.code && l.quantite > 0);

        if (lignes.length === 0)
          return reply(400, { status: 'erreur', message: 'Aucune ligne exploitable' });

        return reply(200, await rpc('rpc_pro_commande_btp', {
          p_session:        session,
          p_lignes:         lignes,
          p_mode:           body.mode === 'commande' ? 'commande' : 'devis',
          p_chantier:       body.chantier ? String(body.chantier).slice(0, 200) : null,
          p_notes:          body.notes    ? String(body.notes).slice(0, 2000)  : null,
          p_mode_reglement: body.mode_reglement ? String(body.mode_reglement).slice(0, 40) : null
        }));
      }

      default:
        return reply(400, { status: 'erreur', message: 'Action inconnue' });
    }
  } catch (e) {
    console.error('[pro]', e.message);
    return reply(500, { status: 'erreur', message: 'Erreur serveur. Reessaie dans un instant.' });
  }
};
