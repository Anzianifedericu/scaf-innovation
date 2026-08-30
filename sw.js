// Service worker du site SCAF Innovation.
//
// Il permet d'installer le site sur l'ecran d'accueil du telephone, et
// d'ouvrir quand meme les pages deja consultees quand le reseau manque —
// ce qui arrive souvent sur un chantier corse.
//
// Choix de mise en cache, volontairement different de TradePro :
//   - les pages et les images du site sont des documents figes (une photo
//     de chantier, un texte de reference). Les garder est sans risque.
//   - MAIS on sert toujours la version du reseau quand elle repond, et le
//     cache ne sert que de filet. Ainsi une page corrigee est vue tout de
//     suite, sans attendre l'expiration d'un cache.
//   - le calculateur interroge le serveur pour chiffrer : ces appels ne
//     sont jamais mis en cache, un prix doit toujours etre frais.

const CACHE = 'scaf-site-v1';
const REPLI = '/hors-connexion.html';

// Le strict minimum pour que l'application s'ouvre hors reseau.
const SOCLE = [REPLI, '/fr.html', '/prix-construction-maison-corse.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      // addAll echoue en bloc si une seule URL manque : on les ajoute une a une.
      .then((c) => Promise.all(SOCLE.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(noms.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Tout ce qui n'est pas le site lui-meme part au reseau sans detour :
  // appels de chiffrage, polices, images hebergees ailleurs.
  if (url.origin !== location.origin) return;

  e.respondWith(
    fetch(req)
      .then((rep) => {
        // On ne garde que les reponses completes et valides.
        if (rep.ok && rep.type === 'basic') {
          const copie = rep.clone();
          caches.open(CACHE).then((c) => c.put(req, copie));
        }
        return rep;
      })
      .catch(() =>
        caches.match(req).then((c) =>
          c || (req.mode === 'navigate' ? caches.match(REPLI) : Response.error())
        )
      )
  );
});
