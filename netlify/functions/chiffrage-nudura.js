/*!
 * netlify/functions/chiffrage-nudura.js
 * Expose le moteur de chiffrage Nudura en HTTP. Un seul appelant possible pour tous :
 * portail pro (navigateur), bot Telegram (Make), boutique, futur formulaire particulier.
 *
 * Le moteur ne connaît pas les prix : il rend un panier de références.
 * Les prix sont lus ici, côté serveur, dans nudura_pro_products (service_role).
 *
 * ENV requis (Netlify > Site settings > Environment variables) :
 *   SUPABASE_URL                = https://crbvlowxxmspjnyculzl.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   = <service_role>   (NE JAMAIS exposer côté client)
 *   APP_SECRET                  = scaf-pro-2026-x7k
 */
const ENGINE = require('../../nudura-engine.js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_SECRET = process.env.APP_SECRET;

const REMISE_PRO = 0.55;      // 45% de remise pro (identique au portail)
const ESCOMPTE_COMPTANT = 0.97; // 3% supplémentaire si paiement comptant
const TVA = 0.20;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
};
const rep = (code, body) => ({ statusCode: code, headers: CORS, body: JSON.stringify(body) });

async function sb(path, init) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init && init.headers),
    },
  });
  const txt = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status} : ${txt}`);
  return txt ? JSON.parse(txt) : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return rep(405, { erreur: 'POST uniquement' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return rep(400, { erreur: 'JSON invalide' }); }

  // Le secret vient du corps (portail pro) ou de l'en-tete (Make / Telegram, dont le
  // corps est produit tel quel par le LLM et ne doit contenir aucun secret).
  const h = event.headers || {};
  const fourni = body.secret || h['x-app-secret'] || h['X-App-Secret'];
  if (APP_SECRET && fourni !== APP_SECRET) return rep(401, { erreur: 'secret invalide' });

  // 1) Chiffrage pur — aucune dépendance réseau, échoue vite si les entrées sont mauvaises
  let calc;
  try { calc = ENGINE.chiffrer({ niveaux: body.niveaux }); }
  catch (e) { return rep(400, { erreur: e.message }); }

  // 2) Prix : lus en base, jamais envoyés par le client
  const refs = calc.lignes.map((l) => l.ref);
  let produits = [];
  if (refs.length) {
    const filtre = encodeURIComponent(`(${refs.map((r) => `"${r}"`).join(',')})`);
    produits = await sb(`nudura_pro_products?select=ref,label,prix_ht,pkg,qte_pkg&ref=in.${filtre}`);
  }
  const parRef = Object.fromEntries(produits.map((p) => [p.ref, p]));

  const comptant = body.paiement === 'comptant';
  const tarifPublic = body.tarif === 'public';
  const coef = tarifPublic ? 1 : REMISE_PRO * (comptant ? ESCOMPTE_COMPTANT : 1);

  const lignes = calc.lignes.map((l) => {
    const p = parRef[l.ref];
    const pu = p ? Math.round(p.prix_ht * coef * 100) / 100 : null;
    return {
      code_article: l.ref,
      designation: p ? p.label : `${l.ref} (hors catalogue)`,
      quantite: l.qte,
      prix_unitaire: pu,
      total_ht: pu === null ? null : Math.round(pu * l.qte * 100) / 100,
      manquant: !p,
    };
  });

  const materielHT = lignes.reduce((s, l) => s + (l.total_ht || 0), 0);
  const locationHT = calc.totaux.locationMontantHT || 0;
  const totalHT = Math.round((materielHT + locationHT) * 100) / 100;

  const notes = calc.notes.slice();
  const manquants = lignes.filter((l) => l.manquant).map((l) => l.code_article);
  if (manquants.length) notes.push(`Références absentes du catalogue, non valorisées : ${manquants.join(', ')}.`);

  const resultat = {
    moteur: ENGINE.VERSION,
    tarif: tarifPublic ? 'public' : (comptant ? 'pro_comptant' : 'pro'),
    lignes,
    totaux: {
      materiel_ht: Math.round(materielHT * 100) / 100,
      location_ht: locationHT,
      total_ht: totalHT,
      total_ttc: Math.round(totalHT * (1 + TVA) * 100) / 100,
      surface_nette_m2: Math.round(calc.totaux.surfaceNette * 100) / 100,
      prix_m2_ht: calc.totaux.surfaceNette > 0 ? Math.round((totalHT / calc.totaux.surfaceNette) * 100) / 100 : null,
      volume_beton_m3: calc.totaux.volumeBeton === null ? null : Math.round(calc.totaux.volumeBeton * 1000) / 1000,
      emprise_hors_tout_m2: calc.totaux.footprintHorsTout,
      emprise_habitable_m2: calc.totaux.footprintHabitable,
      armature: calc.totaux.armature,
    },
    niveaux: calc.niveaux.map((n) => ({
      nom: n.nom, lineaire: n.lineaire, hauteur: n.hauteur, gamme: n.gamme,
      epaisseur_mm: n.epaisseurMm, rangs: n.nCoursesPleins, rang_appoint: n.coursAppoint,
      surface_nette_m2: Math.round(n.surfaceNette * 100) / 100,
    })),
    notes,
  };

  // 3) Écriture ERP optionnelle — le devis n'est créé que si on le demande explicitement.
  //    rpc_creer_document impose statut 'a_verifier' : rien ne part chez un client sans validation.
  if (body.creer && body.creer.tiers && body.creer.tiers.nom) {
    const doc = await sb('rpc/rpc_creer_document', {
      method: 'POST',
      body: JSON.stringify({
        payload: {
          type: 'devis',
          sens: 'vente',
          tiers: body.creer.tiers,
          chantier: body.creer.chantier || null,
          origine: body.creer.origine || 'chiffrage_nudura',
          telegram_user_id: body.creer.telegram_user_id || null,
          notes: [`Chiffrage moteur Nudura ${ENGINE.VERSION}`, ...notes].join('\n'),
          message_telegram: body.creer.message_telegram || null,
          lignes: lignes.filter((l) => !l.manquant).map((l) => ({
            code_article: l.code_article,
            designation: l.designation,
            quantite: l.quantite,
            prix_unitaire: l.prix_unitaire,
          })),
        },
      }),
    });
    resultat.document = doc;
  }

  // Message Telegram compose ici : l'editeur de mapping de Make avale les
  // chaines entre guillemets, donc la branche chiffrage n'affiche qu'un champ nu.
  const nb = (v, d) => (v === null || v === undefined) ? '?' : Number(v).toFixed(d);
  const doc = resultat.document;
  const lignesMsg = [
    doc && doc.numero
      ? `Devis ${doc.numero} cree pour ${doc.tiers}`
      : 'Chiffrage Nudura (non enregistre, client non identifie)',
    `Materiel ${nb(resultat.totaux.materiel_ht, 2)} EUR HT`,
  ];
  if (resultat.totaux.location_ht > 0) {
    lignesMsg.push(`Etaiement ${nb(resultat.totaux.location_ht, 2)} EUR HT (hors devis)`);
  }
  lignesMsg.push(
    `Total ${nb(resultat.totaux.total_ht, 2)} EUR HT - ${nb(resultat.totaux.prix_m2_ht, 2)} EUR/m2`,
    `Surface nette ${nb(resultat.totaux.surface_nette_m2, 2)} m2 - beton ${nb(resultat.totaux.volume_beton_m3, 3)} m3`,
    'Statut : a verifier avant envoi client.'
  );
  if (doc && doc.lien_edition) lignesMsg.push(doc.lien_edition);
  if (doc && doc.status === 'incomplet' && doc.resume_telegram) {
    resultat.message_telegram = doc.resume_telegram;
  } else {
    resultat.message_telegram = lignesMsg.join('\n');
  }

  return rep(200, resultat);
};
