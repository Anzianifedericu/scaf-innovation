/*!
 * netlify/functions/document.js
 * Edition d'un document ERP via lien signe.
 *
 * Relais mince : toute la logique de droits vit dans les RPC Postgres
 * (verifier_jeton, rpc_document_lire / _enregistrer / _statut). Ici on
 * ne fait que transporter, et declencher l'envoi au client via Make.
 *
 * Le jeton EST le droit d'acces. Il n'est jamais journalise.
 *
 * ENV : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MAKE_WEBHOOK (optionnel), APP_SECRET
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_SECRET = process.env.APP_SECRET;
const MAKE_WEBHOOK = process.env.MAKE_WEBHOOK || 'https://hook.eu1.make.com/h9t0hai8vsaqlhnmf6tfnyy6cjv581xm';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};
const rep = (code, body) => ({ statusCode: code, headers: CORS, body: JSON.stringify(body) });

async function rpc(nom, args) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${nom}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  return txt ? JSON.parse(txt) : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return rep(405, { erreur: 'POST uniquement' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return rep(400, { erreur: 'JSON invalide' }); }

  const jeton = body.t;
  if (!jeton) return rep(400, { erreur: 'Lien incomplet' });

  try {
    switch (body.action) {
      case 'lire':
        return rep(200, await rpc('rpc_document_lire', { p_jeton: jeton }));

      case 'enregistrer':
        return rep(200, await rpc('rpc_document_enregistrer', {
          p_jeton: jeton,
          p_entete: body.entete || {},
          p_lignes: body.lignes || [],
        }));

      case 'valider':
      case 'accepter':
      case 'refuser':
        return rep(200, await rpc('rpc_document_statut', { p_jeton: jeton, p_action: body.action }));

      case 'envoyer': {
        // Le passage en 'envoye' produit le lien client (30 jours, lecture + accord).
        const maj = await rpc('rpc_document_statut', { p_jeton: jeton, p_action: 'envoyer' });
        if (maj.status !== 'ok') return rep(200, maj);

        const vue = await rpc('rpc_document_lire', { p_jeton: jeton });
        const doc = vue.document || {};
        const email = (body.email || (doc.tiers && doc.tiers.email) || '').trim();
        if (!email) {
          return rep(200, { ...maj, envoi: 'sans_email',
            message: "Document marque envoye, mais aucune adresse email n'est renseignee pour ce client." });
        }

        // Best-effort : le statut est deja pose, un echec d'email ne doit pas le defaire.
        let envoi = 'ok';
        try {
          const r = await fetch(MAKE_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'envoiDevisClient',
              secret: APP_SECRET,
              email,
              refDevis: doc.numero,
              client: doc.tiers && doc.tiers.nom,
              montantTTC: doc.montant_ttc,
              lienAccord: maj.lien_client,
            }),
          });
          if (!r.ok) envoi = 'echec';
        } catch { envoi = 'echec'; }

        return rep(200, { ...maj, envoi, email });
      }

      default:
        return rep(400, { erreur: 'Action inconnue' });
    }
  } catch (e) {
    return rep(502, { erreur: 'Le serveur n\'a pas pu traiter la demande', detail: e.message });
  }
};
