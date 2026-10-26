/* scaf-contact.js — commun aux pages publiques du site.
 * 1. Mesure d'audience sans cookie ni stockage : une page vue et les clics
 *    utiles (WhatsApp, téléphone, demande d'étude) sont envoyés à la fonction
 *    Supabase « visite ». Aucune donnée personnelle, aucune adresse IP stockée.
 * 2. Bouton WhatsApp flottant (sauf si la balise porte data-sans-bouton).
 * 3. Bandeau des avis Google avant le pied de page (si data-avis).
 * La note et le nombre d'avis sont à mettre à jour ici quand ils changent.
 */
(function () {
  var NOTE = '4,5', NB_AVIS = 8;
  var TEL = '33646449186';
  var LIEN_AVIS = 'https://g.page/r/Ccs1Bq_mgHTkEBE/review';
  var LIEN_FICHE = 'https://www.google.com/maps/search/?api=1&query=SCAF%20INNOVATION%20Borgo';
  var URL_MESURE = 'https://crbvlowxxmspjnyculzl.supabase.co/functions/v1/visite';

  var balise = document.currentScript;
  var corse = (document.documentElement.lang || '').toLowerCase() === 'co';
  var T = corse ? {
    wa: 'Scriveci nant\'à WhatsApp', msg: 'Bonghjornu, vogliu una infurmazione per un prugettu di custruzzione.',
    avis: 'nant\'à Google', lire: 'Leghje i pareri', laisser: 'Lascià un parè'
  } : {
    wa: 'Écrivez-nous sur WhatsApp', msg: 'Bonjour, je souhaite un renseignement pour un projet de construction.',
    avis: 'sur Google', lire: 'Lire les avis', laisser: 'Laisser un avis'
  };

  // ---------- 1. Mesure d'audience ----------
  var session = Math.random().toString(36).slice(2, 12);
  var q = new URLSearchParams(location.search);
  var mobile = /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 1 : 0;
  function mesure(e) {
    try {
      var d = JSON.stringify({ e: e, p: location.pathname, r: document.referrer, s: session, m: mobile,
        us: q.get('utm_source') || q.get('source') || '', uc: q.get('utm_campaign') || '' });
      var envoye = navigator.sendBeacon && navigator.sendBeacon(URL_MESURE, new Blob([d], { type: 'text/plain' }));
      if (!envoye) fetch(URL_MESURE, { method: 'POST', body: d, keepalive: true, mode: 'cors' }).catch(function () {});
    } catch (_) { /* la mesure ne doit jamais casser la page */ }
  }
  mesure('vue');
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest && ev.target.closest('a[href]');
    if (!a) return;
    var h = a.getAttribute('href') || '';
    if (/wa\.me\/33|api\.whatsapp\.com\/send\?phone/.test(h)) mesure('clic_whatsapp');
    else if (h.indexOf('tel:') === 0) mesure('clic_tel');
    else if (h.indexOf('demande-etude-nudura') !== -1) mesure('clic_etude');
  }, true);

  // ---------- Styles ----------
  var css = document.createElement('style');
  css.textContent =
    '.scaf-wa{position:fixed;right:16px;bottom:16px;z-index:900;display:flex;align-items:center;gap:8px;' +
    'background:#25D366;color:#fff;text-decoration:none;font:600 15px/1 system-ui,-apple-system,sans-serif;' +
    'padding:12px 16px;border-radius:999px;box-shadow:0 4px 14px rgba(0,0,0,.25)}' +
    '.scaf-wa svg{width:22px;height:22px;flex:none}' +
    '.scaf-wa:focus-visible{outline:3px solid #2B2620;outline-offset:3px}' +
    '@media (max-width:640px){.scaf-wa span{display:none}.scaf-wa{padding:14px}}' +
    '@media print{.scaf-wa,.scaf-avis{display:none}}' +
    '.scaf-avis{background:#FBF7EC;border-top:1px solid #C7BCA4;padding:18px 16px;text-align:center;' +
    'font:15px/1.5 system-ui,-apple-system,sans-serif;color:#2B2620}' +
    '.scaf-avis .etoiles{color:#E8A317;letter-spacing:2px;font-size:18px}' +
    '.scaf-avis b{font-size:18px}' +
    '.scaf-avis a{color:#C1693E;font-weight:600;margin:0 8px;white-space:nowrap}';
  document.head.appendChild(css);

  function quandPret(f) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', f); else f();
  }

  quandPret(function () {
    // ---------- 2. Bouton WhatsApp ----------
    if (!balise || !balise.hasAttribute('data-sans-bouton')) {
      var wa = document.createElement('a');
      wa.className = 'scaf-wa';
      wa.href = 'https://wa.me/' + TEL + '?text=' + encodeURIComponent(T.msg);
      wa.target = '_blank'; wa.rel = 'noopener';
      wa.setAttribute('aria-label', T.wa);
      wa.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3C8.8 3 3 8.7 3 15.8c0 2.5.7 4.9 2 7L3 29l6.4-2c2 1.1 4.3 1.7 6.6 1.7 7.2 0 13-5.7 13-12.8S23.2 3 16 3zm0 23.4c-2.1 0-4.1-.6-5.9-1.7l-.4-.2-3.8 1.2 1.2-3.7-.3-.4a10.4 10.4 0 0 1-1.7-5.8C5.1 10 10 5.2 16 5.2S26.9 10 26.9 15.8 22 26.4 16 26.4zm6-7.8c-.3-.2-1.9-.9-2.2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-1 1.2-.2.2-.4.2-.7.1-.3-.2-1.4-.5-2.6-1.6-1-.9-1.6-1.9-1.8-2.2-.2-.3 0-.5.1-.7l.5-.6c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7s1.2 3.2 1.4 3.4c.2.2 2.4 3.6 5.8 5 .8.4 1.4.6 1.9.7.8.2 1.5.2 2.1.1.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"/></svg><span>' + T.wa + '</span>';
      document.body.appendChild(wa);
    }

    // ---------- 3. Bandeau avis Google ----------
    if (balise && balise.hasAttribute('data-avis')) {
      var pied = document.querySelector('footer');
      if (pied) {
        var b = document.createElement('section');
        b.className = 'scaf-avis';
        b.setAttribute('aria-label', 'Avis Google');
        b.innerHTML = '<span class="etoiles" aria-hidden="true">★★★★★</span> <b>' + NOTE + '/5</b> ' + T.avis +
          ' (' + NB_AVIS + ')' + '<br><a href="' + LIEN_FICHE + '" target="_blank" rel="noopener">' + T.lire + '</a>' +
          '<a href="' + LIEN_AVIS + '" target="_blank" rel="noopener">' + T.laisser + '</a>';
        pied.parentNode.insertBefore(b, pied);
      }
    }
  });
})();
