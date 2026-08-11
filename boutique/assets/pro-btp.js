/* =====================================================================
   /boutique/assets/pro-btp.js
   Charge APRES app.js. Ajoute :
     - la session professionnelle unifiee (SIRET + code e-mail)
     - le rayon BTP / Materiaux : Nudura + TEXSA
     - le panier BTP, en commande ferme ou en demande de devis
   Ne remplace pas app.js : il en surcharge quelques fonctions.
   ===================================================================== */
'use strict';

const PRO_API      = '/.netlify/functions/pro';
const PRO_SESSION  = 'scaf_pro_session';
const BTP_CART_KEY = 'scaf_btp_cart_v1';

let proSession = localStorage.getItem(PRO_SESSION) || null;
let proInfo    = null;   // { nom, categorie }
let menagePrix = {};     // sku -> prix pro HT
let btpData    = null;   // reponse brute du catalogue BTP

async function proApi(payload) {
  const r = await fetch(PRO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, session: proSession })
  });
  return r.json();
}

const eurP = n => (Number(n) || 0).toLocaleString('fr-FR',
  { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const escP = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

/* ---------------- Session ---------------- */

async function proLogin(siret) {
  return proApi({ action: 'login', siret });
}
async function proVerify(siret, code) {
  const r = await proApi({ action: 'otp', siret, code });
  if (r && r.status === 'ok') {
    proSession = r.session;
    localStorage.setItem(PRO_SESSION, proSession);
    proInfo = r.tiers;
  }
  return r;
}
function proLogout() {
  localStorage.removeItem(PRO_SESSION);
  proSession = null; proInfo = null; menagePrix = {};
  location.reload();
}
function proConnecte() { return !!proSession; }

/* Tarif pro Menage, calcule serveur. Remplace la remise -20 % locale. */
async function chargerTarifMenage() {
  if (!proSession) return;
  const r = await proApi({ action: 'menage' });
  if (r && r.status === 'ok') {
    menagePrix = {};
    (r.produits || []).forEach(p => { if (p.prix_pro_ht != null) menagePrix[p.sku] = p.prix_pro_ht; });
    proInfo = proInfo || {};
  } else if (r && r.status === 'session_invalide') {
    localStorage.removeItem(PRO_SESSION); proSession = null;
  }
}

/* Surcharge de app.js : le prix pro vient du serveur, plus d'un calcul local */
function priceDisplay(price_eur, sku) {
  const pro = sku && menagePrix[sku] != null ? menagePrix[sku] : null;
  if (pro != null) {
    return `<span class="card-price">${eurP(pro)} `
         + `<span style="font-size:11px;color:#495765;font-weight:400">HT pro</span></span>`;
  }
  return `<span class="card-price">${eurP(price_eur)}</span>`;
}
function isPro() { return proConnecte(); }

/* ---------------- Catalogue BTP ---------------- */

async function chargerBTP() {
  const r = await proApi({ action: 'btp' });
  if (r && r.status === 'ok') { btpData = r; return r; }
  btpData = null;
  return r;
}

/* Convertit un produit BTP au format attendu par les cartes de la boutique */
function btpVersCarte(p, marque, familleTitre) {
  return {
    sku: p.code,
    name: p.designation,
    description: p.dimension || '',
    category: familleTitre,
    // price_eur = prix du CONDITIONNEMENT reellement vendu (rlx, bidon, sac, carton...)
    price_eur: p.prix_conditionnement_ht,
    stock_status: 'en_stock',
    _btp: true,
    _marque: marque,
    _unite: p.unite_comptage || 'u.',
    _uniteMesure: p.unite || null,
    _facteur: p.facteur || null,
    _prixUnite: p.prix_unite_ht || null,
    _palette: p.qte_palette_num,
    _prixPalette: p.prix_conditionnement_palette_ht,
    _eco: p.eco_contrib_ht || null,
    _surDemande: !!p.sur_demande
  };
}

function btpProduits(marqueFiltre) {
  if (!btpData) return [];
  const out = [];
  (btpData.marques || []).forEach(m => {
    if (marqueFiltre && m.code !== marqueFiltre) return;
    (m.familles || []).forEach(f => {
      (f.produits || []).forEach(p => out.push(btpVersCarte(p, m.code, f.titre)));
    });
  });
  return out;
}

function btpTarifDispo(marque) {
  if (!btpData) return false;
  const m = (btpData.marques || []).find(x => x.code === marque);
  return m ? !!m.tarif_disponible : false;
}

/* ---------------- Panier BTP ---------------- */

function getBtpCart() {
  try { return JSON.parse(localStorage.getItem(BTP_CART_KEY)) || []; }
  catch { return []; }
}
function saveBtpCart(c) {
  localStorage.setItem(BTP_CART_KEY, JSON.stringify(c));
  majBtpBadge();
}
function addToBtpCart(p, qty) {
  const c = getBtpCart();
  const i = c.findIndex(l => l.code === p.sku && l.marque === p._marque);
  if (i >= 0) c[i].qty += qty;
  else c.push({
    code: p.sku, marque: p._marque, name: p.name, unite: p._unite,
    uniteMesure: p._uniteMesure, facteur: p._facteur,
    price: p.price_eur, palette: p._palette, prixPalette: p._prixPalette,
    eco: p._eco,
    surDemande: p._surDemande, qty
  });
  saveBtpCart(c);
}
function updateBtpQty(code, marque, qty) {
  let c = getBtpCart();
  const i = c.findIndex(l => l.code === code && l.marque === marque);
  if (i < 0) return;
  if (qty <= 0) c.splice(i, 1); else c[i].qty = qty;
  saveBtpCart(c);
}
function btpCount() { return getBtpCart().reduce((s, l) => s + l.qty, 0); }

/* Total indicatif : prix du conditionnement x nombre de conditionnements.
   Le montant qui fait foi reste celui recalcule par le serveur. */
function btpTotal() {
  return getBtpCart().reduce((s, l) => {
    if (l.surDemande || l.price == null) return s;
    const pal = l.palette && l.qty > 0 && l.qty % l.palette === 0;
    return s + (pal && l.prixPalette ? l.prixPalette : l.price) * l.qty;
  }, 0);
}

/* Eco-contribution : due a l'unite de mesure, donc x facteur */
function btpEco() {
  return getBtpCart().reduce((s, l) =>
    s + (Number(l.eco) || 0) * l.qty * (Number(l.facteur) || 1), 0);
}
function btpTotalGeneral() { return btpTotal() + btpEco(); }

function majBtpBadge() {
  const b = document.getElementById('btp-badge');
  const n = btpCount();
  if (b) { b.textContent = n; b.style.display = n > 0 ? 'inline-flex' : 'none'; }
  const bar = document.getElementById('btp-bar');
  if (bar) bar.style.display = n > 0 ? 'block' : 'none';
  const tot = document.getElementById('btp-total');
  if (tot) tot.textContent = eurP(btpTotalGeneral());
  const eco = document.getElementById('btp-eco');
  if (eco) {
    const e = btpEco();
    eco.textContent = e > 0 ? 'dont eco-contribution ' + eurP(e) : '';
  }
  const cnt = document.getElementById('btp-count');
  if (cnt) cnt.textContent = n;
}

/* ---------------- Envoi : commande ou devis ---------------- */

async function envoyerBtp(mode, chantier, notes, modeReglement) {
  const lignes = getBtpCart().map(l => ({ code: l.code, marque: l.marque, quantite: l.qty }));
  if (lignes.length === 0) return { status: 'erreur', message: 'Panier vide' };
  const r = await proApi({ action: 'commander', mode, lignes, chantier, notes,
                           mode_reglement: modeReglement || null });
  if (r && r.status === 'ok') { localStorage.removeItem(BTP_CART_KEY); majBtpBadge(); }
  return r;
}

/* ---------------- Interface ---------------- */

function ouvrirConnexionPro() {
  const m = document.createElement('div');
  m.id = 'pro-modal';
  m.style.cssText = 'position:fixed;inset:0;background:rgba(20,26,32,.55);display:flex;'
    + 'align-items:center;justify-content:center;padding:20px;z-index:9000';
  m.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:28px 26px;max-width:400px;width:100%;
                font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
      <h2 style="margin:0 0 4px;font-size:19px">Espace professionnel</h2>
      <p style="margin:0 0 22px;color:#5b6b7a;font-size:14px">
        Tarifs pro, catalogue BTP, commandes et devis.</p>
      <div id="pro-msg"></div>
      <div id="pro-step1">
        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Numéro SIRET</label>
        <input id="pro-siret" inputmode="numeric" maxlength="17" placeholder="14 chiffres"
               style="width:100%;padding:11px 12px;border:1px solid #cfd8e0;border-radius:8px;margin-bottom:14px">
        <button id="pro-go" style="width:100%;padding:11px;border:0;border-radius:8px;
                background:#3f6b4a;color:#fff;font-weight:600;cursor:pointer">Recevoir mon code</button>
      </div>
      <div id="pro-step2" style="display:none">
        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Code reçu par e-mail</label>
        <input id="pro-code" inputmode="numeric" maxlength="6" placeholder="······"
               style="width:100%;padding:13px;border:1px solid #cfd8e0;border-radius:8px;margin-bottom:14px;
                      text-align:center;font-size:24px;letter-spacing:10px;font-family:ui-monospace,monospace">
        <button id="pro-ok" style="width:100%;padding:11px;border:0;border-radius:8px;
                background:#3f6b4a;color:#fff;font-weight:600;cursor:pointer">Se connecter</button>
      </div>
      <button id="pro-close" style="width:100%;padding:10px;margin-top:8px;background:none;
              border:1px solid #cfd8e0;border-radius:8px;color:#5b6b7a;cursor:pointer">Fermer</button>
    </div>`;
  document.body.appendChild(m);

  const msg = (t, ok) => {
    document.getElementById('pro-msg').innerHTML = t
      ? `<div style="padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:14px;
           background:${ok ? '#f0fdf4' : '#fef2f2'};color:${ok ? '#166534' : '#991b1b'}">${escP(t)}</div>`
      : '';
  };

  document.getElementById('pro-close').onclick = () => m.remove();

  document.getElementById('pro-go').onclick = async () => {
    const s = document.getElementById('pro-siret').value.replace(/\D/g, '');
    if (s.length !== 9 && s.length !== 14) return msg('Le SIRET compte 14 chiffres.', false);
    msg('Envoi du code…', true);
    const r = await proLogin(s);
    if (r.status === 'code_envoye') {
      msg(r.message, true);
      document.getElementById('pro-step1').style.display = 'none';
      document.getElementById('pro-step2').style.display = 'block';
      document.getElementById('pro-code').focus();
    } else msg(r.message || 'Connexion impossible.', false);
  };

  document.getElementById('pro-ok').onclick = async () => {
    const s = document.getElementById('pro-siret').value.replace(/\D/g, '');
    const c = document.getElementById('pro-code').value.replace(/\D/g, '');
    if (c.length !== 6) return msg('Le code compte 6 chiffres.', false);
    const r = await proVerify(s, c);
    if (r.status === 'ok') location.reload();
    else msg(r.message || 'Code refusé.', false);
  };
}

/* Bandeau haut : etat de connexion */
function majBandeauPro() {
  const el = document.getElementById('pro-bar');
  if (!el) return;
  el.innerHTML = proConnecte()
    ? `<span style="font-weight:600">${escP((proInfo && proInfo.nom) || 'Compte pro')}</span>
       <span style="opacity:.7">· tarifs professionnels actifs</span>
       <button onclick="proLogout()" style="margin-left:10px;background:none;border:0;
         color:inherit;text-decoration:underline;cursor:pointer;font-size:13px">Se déconnecter</button>`
    : `<button onclick="ouvrirConnexionPro()" style="background:none;border:0;color:inherit;
         text-decoration:underline;cursor:pointer;font-size:13px">Espace professionnel — se connecter</button>`;
}

/* Barre d'action du panier BTP */
function injecterBarreBtp() {
  if (document.getElementById('btp-bar')) return;
  const d = document.createElement('div');
  d.id = 'btp-bar';
  d.style.cssText = 'display:none;position:fixed;left:0;right:0;bottom:0;background:#fff;'
    + 'border-top:1px solid #cfd8e0;box-shadow:0 -2px 14px rgba(0,0,0,.08);z-index:8000;padding:12px 16px';
  d.innerHTML = `
    <div style="max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:16px;flex-wrap:wrap;
                font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
      <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#8895a3">Lignes</div>
           <div id="btp-count" style="font-size:18px;font-weight:700">0</div></div>
      <div><div style="font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#8895a3">Total HT</div>
           <div id="btp-total" style="font-size:18px;font-weight:700">0,00 €</div>
           <div id="btp-eco" style="font-size:11px;color:#8895a3"></div></div>
      <div style="flex:1"></div>
      <button onclick="ouvrirEnvoiBtp('devis')" style="padding:10px 18px;border:1px solid #3f6b4a;
        background:#fff;color:#3f6b4a;border-radius:8px;font-weight:600;cursor:pointer">Demander un devis</button>
      <button onclick="ouvrirEnvoiBtp('commande')" style="padding:10px 18px;border:0;
        background:#3f6b4a;color:#fff;border-radius:8px;font-weight:600;cursor:pointer">Commander</button>
    </div>`;
  document.body.appendChild(d);
}

function ouvrirEnvoiBtp(mode) {
  const lignes = getBtpCart();
  if (lignes.length === 0) return;
  const m = document.createElement('div');
  m.style.cssText = 'position:fixed;inset:0;background:rgba(20,26,32,.55);display:flex;'
    + 'align-items:center;justify-content:center;padding:20px;z-index:9000';
  m.innerHTML = `
    <div style="background:#fff;border-radius:14px;padding:26px;max-width:460px;width:100%;
                max-height:88vh;overflow:auto;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
      <h2 style="margin:0 0 4px;font-size:18px">${mode === 'commande' ? 'Passer commande' : 'Demander un devis'}</h2>
      <p style="margin:0 0 18px;color:#5b6b7a;font-size:13.5px">
        ${mode === 'commande'
          ? 'SCAF Innovation confirme disponibilité, délai et montant définitif avant expédition.'
          : 'Réponse rapide avec le tarif définitif.'}</p>
      <div style="border-top:1px solid #e4e9ee;font-size:13.5px;margin-bottom:16px">
        ${lignes.map(l => `<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;
           border-bottom:1px solid #e4e9ee"><span>${escP(l.name)} — ${l.qty} ${escP(l.unite)}${
             l.facteur && l.uniteMesure ? ` <span style="color:#8895a3">(${(l.qty * l.facteur).toLocaleString('fr-FR')} ${escP(l.uniteMesure)})</span>` : ''}</span>
           <span>${l.surDemande ? 'à chiffrer' : eurP((l.palette && l.qty % l.palette === 0 && l.prixPalette ? l.prixPalette : l.price) * l.qty)}</span></div>`).join('')}
      </div>
      ${btpEco() > 0 ? `<div style="display:flex;justify-content:space-between;font-size:13px;
        color:#5b6b7a;padding:2px 0 10px"><span>Éco-contribution</span><span>${eurP(btpEco())}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;font-weight:700;font-size:15px;
        padding:8px 0 16px;border-top:1px solid #e4e9ee">
        <span>Total HT</span><span>${eurP(btpTotalGeneral())}</span></div>
      <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Chantier (facultatif)</label>
      <input id="btp-chantier" style="width:100%;padding:10px 12px;border:1px solid #cfd8e0;
             border-radius:8px;margin-bottom:12px" placeholder="Ville, nom du chantier…">
      <label style="display:block;font-size:13px;font-weight:600;margin-bottom:6px">Précisions (facultatif)</label>
      <textarea id="btp-notes" rows="3" style="width:100%;padding:10px 12px;border:1px solid #cfd8e0;
             border-radius:8px;margin-bottom:14px" placeholder="Délai souhaité, livraison…"></textarea>
      ${mode === 'commande' ? `<div style="margin-top:6px">
        <label style="display:block;font-size:13px;font-weight:600;margin-bottom:8px">Reglement</label>
        <div id="btp-moyens" class="pay-liste">Chargement...</div>
        <div id="btp-detail-moyen"></div>
      </div>` : ''}
      <div id="btp-msg"></div>
      <button id="btp-send" style="width:100%;padding:11px;border:0;border-radius:8px;
              background:#3f6b4a;color:#fff;font-weight:600;cursor:pointer">
        ${mode === 'commande' ? 'Envoyer ma commande' : 'Envoyer ma demande'}</button>
      <button id="btp-cancel" style="width:100%;padding:10px;margin-top:8px;background:none;
              border:1px solid #cfd8e0;border-radius:8px;color:#5b6b7a;cursor:pointer">Annuler</button>
    </div>`;
  document.body.appendChild(m);

  m.querySelector('#btp-cancel').onclick = () => m.remove();
  m.querySelector('#btp-send').onclick = async () => {
    const b = m.querySelector('#btp-send');
    b.disabled = true; b.textContent = 'Envoi…';
    const r = await envoyerBtp(mode,
      m.querySelector('#btp-chantier').value,
      m.querySelector('#btp-notes').value);
    if (r && r.status === 'ok') {
      m.firstElementChild.innerHTML =
        `<h2 style="margin:0 0 8px;font-size:18px">C'est envoyé</h2>
         <p style="margin:0 0 20px;color:#5b6b7a;font-size:14px">${escP(r.message)}</p>
         <button onclick="location.reload()" style="width:100%;padding:11px;border:0;border-radius:8px;
                 background:#3f6b4a;color:#fff;font-weight:600;cursor:pointer">Fermer</button>`;
    } else if (r && r.status === 'session_invalide') {
      proLogout();
    } else {
      m.querySelector('#btp-msg').innerHTML =
        `<div style="padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:12px;
          background:#fef2f2;color:#991b1b">${escP((r && r.message) || 'Envoi impossible.')}</div>`;
      b.disabled = false;
      b.textContent = mode === 'commande' ? 'Envoyer ma commande' : 'Envoyer ma demande';
    }
  };
}

/* Initialisation : appelee par index.html avant le rendu */
async function initPro() {
  injecterBarreBtp();
  if (proSession) await chargerTarifMenage();
  majBandeauPro();
  majBtpBadge();
}

/* ============ Choix du moyen de reglement ============ */
/* Rien n'est calcule ici : le serveur decide de ce qui est
   propose et du montant reellement preleve. */

async function chargerMoyens(montant) {
  const r = await proApi({ action: 'moyens', montant });
  return Array.isArray(r) ? r : [];
}

const ICONES_PAIEMENT = {
  store:  'M3 9l1.5-5h15L21 9M3 9h18M3 9v10a1 1 0 001 1h16a1 1 0 001-1V9',
  bank:   'M3 10l9-6 9 6M5 10v9m4-9v9m6-9v9m4-9v9M3 21h18',
  card:   'M2 7h20v11a1 1 0 01-1 1H3a1 1 0 01-1-1V7zm0 4h20M6 16h4',
  paypal: 'M7 20l2-14h5a4 4 0 010 8h-3l-1 6H7z',
  split:  'M12 3v18M5 8h5M5 16h5M14 12h5',
  truck:  'M1 7h13v9H1zM14 10h4l3 3v3h-7z'
};

function iconePaiement(code) {
  const d = ICONES_PAIEMENT[code] || ICONES_PAIEMENT.card;
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" class="pay-ico"><path d="' + d + '"/></svg>';
}

function rendreMoyens(conteneur, moyens, onChoix) {
  if (!moyens.length) {
    conteneur.innerHTML = '<p class="pay-vide">Aucun moyen de reglement disponible pour ce montant. Envoie ta demande, on te recontacte.</p>';
    return;
  }
  conteneur.innerHTML = moyens.map(function (m) {
    var acompte = m.acompte_pct ? '<span class="pay-badge">' + eurP(m.montant_a_payer) + ' maintenant</span>' : '';
    return '<label class="pay-opt" data-code="' + escP(m.code) + '">'
         + '<input type="radio" name="moyen" value="' + escP(m.code) + '">'
         + iconePaiement(m.icone)
         + '<span class="pay-txt"><strong>' + escP(m.libelle) + '</strong><span>' + escP(m.description || '') + '</span></span>'
         + acompte + '</label>';
  }).join('');
  conteneur.querySelectorAll('input[name="moyen"]').forEach(function (i) {
    i.addEventListener('change', function () {
      conteneur.querySelectorAll('.pay-opt').forEach(function (o) {
        o.classList.toggle('pay-opt-actif', o.dataset.code === i.value);
      });
      if (onChoix) onChoix(i.value);
    });
  });
}

async function blocVirement() {
  const r = await proApi({ action: 'rib' });
  if (!r || r.status !== 'ok') {
    return '<div class="pay-note pay-note-warn">' + escP((r && r.message) || 'Coordonnees bancaires indisponibles. Contacte-nous.') + '</div>';
  }
  return '<div class="pay-note"><div><strong>' + escP(r.titulaire) + '</strong></div>'
       + '<div class="pay-iban">' + escP(r.iban) + '</div>'
       + (r.bic ? '<div>BIC ' + escP(r.bic) + '</div>' : '')
       + '<div class="pay-warn">' + escP(r.avertissement) + '</div></div>';
}
