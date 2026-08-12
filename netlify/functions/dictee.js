/**
 * netlify/functions/dictee.js
 * -------------------------------------------------------------
 * Dictee d'un devis. Protege par le jeton admin + code console.
 * Deux temps : "analyser" comprend la phrase, "creer" etablit
 * le devis une fois les choix tranches.
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

// Verifie le lien signe ET le code console, comme la console elle-meme.
async function autorise(jeton, code) {
  const r = await rpc('rpc_admin_executer', {
    p_jeton: String(jeton), p_commande: 'aide', p_ip: null,
    p_code: code ? String(code).slice(0, 100) : null
  });
  return r && (r.status === 'aide' || r.status === 'ok');
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
    if (!(await autorise(body.jeton, body.code)))
      return reply(401, { status: 'refuse', message: 'Acces refuse.' });

    // --- creation du devis, une fois les choix tranches ---
    if (body.action === 'creer') {
      if (!body.tiers_id) return reply(400, { status: 'erreur', message: 'Client manquant.' });
      const lignes = (Array.isArray(body.lignes) ? body.lignes : [])
        .filter(l => l && l.code && Number(l.quantite) > 0)
        .map(l => ({ code: String(l.code), quantite: Number(l.quantite) }));
      if (!lignes.length) return reply(400, { status: 'erreur', message: 'Aucune ligne.' });

      if (body.remise_pct != null && body.remise_pct !== '') {
        await rpc('rpc_pro_set_remise', {
          p_tiers_id: String(body.tiers_id), p_gamme: 'texsa',
          p_pct: Number(body.remise_pct)
        }).catch(() => null);
      }
      return reply(200, await rpc('rpc_texsa_demande', {
        p_tiers_id: String(body.tiers_id),
        p_lignes:   lignes,
        p_chantier: body.chantier || null,
        p_notes:    body.notes || 'Devis dicte'
      }));
    }

    // --- analyse de la phrase ---
    const texte = String(body.texte || '').slice(0, 2000).trim();
    if (!texte) return reply(400, { status: 'erreur', message: 'Texte vide.' });

    const r = await fetch(`${SUPABASE_URL}/functions/v1/dictee`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ texte })
    });
    return reply(200, await r.json());
  } catch (e) {
    console.error('[dictee]', e.message);
    return reply(500, { status: 'erreur', message: 'Erreur serveur.' });
  }
};
