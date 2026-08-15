# SCAF Innovation — contexte du projet

Site et ERP de SCAF Innovation, SARL basée à Borgo (Haute-Corse),
distributeur exclusif Nudura en Corse. Nudura est un système de coffrage
isolant à béton (ICF) : des blocs de polystyrène s'emboîtent, on coule le
béton dedans, on obtient un mur isolé des deux côtés.

Interlocuteur : Frédéric Anziani, à la fois dirigeant, chef de projet
technique et expert métier. Ses corrections sur les règles de calcul font
foi — elles ont plusieurs fois révélé des erreurs invisibles au code.

## Comment travailler ici

- **Répondre en français.** Toute l'interface, le code et les commentaires
  sont en français.
- **Vérifier avant d'affirmer.** Plusieurs erreurs ont été introduites en
  supposant qu'une page était la bonne. Mesurer, tester, puis conclure.
- **Ne jamais recalculer côté client.** Les quantités viennent du serveur.
- **Un seul calculateur.** Toute duplication finit par diverger.

## Architecture

### Hébergement et déploiement

| | |
|---|---|
| Site | Netlify, déploiement continu depuis GitHub (branche `main`) |
| Dépôt | `Anzianifedericu/scaf-innovation` |
| Domaine | `scaf-innovation.com` (l'ancien `scafinnovation.corsica` est mort) |
| Base | Supabase, projet `crbvlowxxmspjnyculzl`, région eu-west-3 |
| Orchestration | Make Pro (team 1106231) |
| Courriel | Brevo |
| Notifications | Telegram (bot ERP + bot médias) |

Netlify réécrit les URL : `/calculateur.html` est servi sous `/calculateur`.
En cherchant un lien dans le HTML servi, chercher les deux formes.

Le déploiement prend 60 à 120 secondes après un commit. Il arrive qu'il
échoue avec « Unable to access repository » — relancer suffit.

### Le calculateur — cœur du projet

`calculateur.html` est **la** page de chiffrage. Trois publics, une seule
page, un seul moteur :

| Public | Accès | Voit |
|---|---|---|
| Professionnel | `connexion-pro.html` → OTP → redirection | quantités + tarifs remisés |
| Particulier | lien signé reçu après demande d'étude | quantités seules |
| Visiteur | accès direct | quantités seules + formulaire d'envoi |

Le mode est déterminé au chargement : `scaf_pro_token` en localStorage →
mode pro ; sinon jeton d'étude vérifié auprès de `acces-etude`.

En mode non-pro, le catalogue tarifaire **n'est pas chargé** : la requête
ne demande pas `prix_ht`. Ce n'est pas un masquage CSS, les prix ne sont
jamais dans la page.

`trace-plan.js` est le module de tracé (UMD, sans dépendance). Il ouvre une
fenêtre modale, produit une géométrie, et ne calcule aucun prix.

**Pages qui redirigent vers le calculateur**, à ne pas ressusciter :
`tracer.html`, `estimation-pro-nudura.html`.

**`nudura-engine.js` est mort.** C'était un second moteur, plus pauvre, qui
tournait dans le navigateur. Il n'est plus référencé. À supprimer.

### Fonctions Supabase (Edge Functions)

| Fonction | Rôle |
|---|---|
| `estimer-nudura` | **Moteur de chiffrage — seule source de vérité** |
| `tarif-pro` | Tarifs et remise, vérifie la session pro |
| `compte-pro` | Inscription et connexion par code à usage unique |
| `acces-etude` | Lien signé pour les particuliers ayant demandé une étude |
| `plan-public` | Réception des plans tracés par les visiteurs |
| `demande-web` | Formulaires Netlify → base + notifications |
| `envoyer-accuse-reception` | Accusé de réception avec PDF (pdf-lib) |
| `github-commit` | Commit direct vers GitHub, sans service tiers |
| `upload-site` | Dépôt de fichiers dans le bucket `site` |
| `ia`, `dictee` | Appels Gemini (clé en base) |
| `generer-offre`, `generer-lettre` | Documents commerciaux |
| `medias-telegram`, `medias-install`, `deposer-media` | Bot de publication |
| `stocker-fichier` | Pièces jointes |

Les secrets sont dans la table `secrets_app`, jamais dans le code ni dans
le navigateur. Clés utiles : `github_token`, `commit_secret`,
`upload_site_secret`, `api_brevo`, `token_telegram`, `chat_id_admin`,
`app_secret`.

### Règles métier Nudura — coûteuses à redécouvrir

Ces règles viennent du terrain. Elles ont toutes causé des devis faux.

- **Le bloc d'angle est réversible** en gamme Standard et XR35 : même
  référence pour un angle sortant ou rentrant, on le retourne. Seule la
  série **Plus+** distingue aile longue (`L`) et aile courte (`S`).
- **Un refend peut avoir des angles.** Un refend en L consomme un bloc
  d'angle par rang, et la longueur correspondante sort du linéaire droit.
  Champs `angles90` / `angles45` sur chaque refend.
- **Le fond de linteau ne sert qu'en partie haute** de l'ouverture, une
  seule rangée, quel que soit le type. Zéro si volet roulant.
- **Les ouvertures déduisent des blocs** : surface percée × 0,75 (marge de
  perte), convertie en modules entiers, arrondie à l'inférieur.
- **Les bouchons d'about** : 2 par tableau et par rang d'ouverture.
- **Bandes de renfort en T** : 8 au premier rang, 4 aux suivants, par
  refend et par jonction — pas au mètre linéaire.
- **Hauteur de bloc** : 0,457 m. Module : 0,20317 m. Longueur : 2,438 m.
  Une hauteur hors module provoque une fausse coupe : le moteur avertit et
  propose les hauteurs utiles.
- **L'emprise au sol** d'un bâtiment à étages est celle du niveau le plus
  large, jamais la somme.
- **Chaque mur doit reposer sur un porteur** au niveau inférieur. Les
  refends d'un vide sanitaire existent pour porter les murs du RDC.
- **Éco-contributions soumises à TVA 20 %** : à inclure dans la base HT.

Les paramètres de calcul sont dans la table `nudura_parametres`, modifiables
sans toucher au code.

## Points de vigilance

**Sécurité.** L'analyse Supabase signale une trentaine de tables avec RLS
activé sans politique, une vue `SECURITY DEFINER` exposée, et des fonctions
appelables sans authentification. L'accès passe par des fonctions serveur
contrôlées, mais c'est à traiter avant tout élargissement.

**Deux pages lourdes** : `produits.html` (880 Ko) et `produits-fr.html`
(472 Ko). Images non optimisées.

**Les médias de `/fr`** sont servis depuis Supabase Storage, qui impose
`no-cache`. Chaque visite retélécharge ~1,3 Mo. Les fichiers sont prêts
dans `/mnt/user-data/outputs/fr-allege/` d'une session précédente ; la règle
de cache est déjà dans `netlify.toml` pour `/assets/*`.

**`_verif-commit.txt`** est un résidu vide, à supprimer.

**Le HTML de certaines pages est encodé en JSON** sur une seule ligne
(`fr.html` l'était). Avant toute manipulation texte, vérifier — `grep` et
`sed` échouent silencieusement dessus.

## État au 14 août 2026

Fait ce jour :

- Référencement rétabli : canonical corrigés (pointaient vers le domaine
  mort), `robots.txt` et `sitemap.xml` créés, Search Console validée,
  sitemap accepté (8 URL).
- `/fr` allégée de 23,5 Mo à 51 Ko (GIF → MP4, images → WebP).
- Traceur de plan créé : multi-niveaux, refends, ouvertures, calque du
  niveau inférieur, contrôle de descente de charges, zoom molette.
- Quatre erreurs de calcul corrigées (voir règles métier).
- Calculateur unifié : trois pages fusionnées en une.
- Impression et export tableur ajoutés.
- Capture de plans publics (`plans_publics`) avec notification.
- Pont de commit direct GitHub, remplaçant Zapier (qui corrompait les
  binaires et avait un quota).

À faire :

- Tester le parcours pro connecté de bout en bout.
- Supprimer `nudura-engine.js` et `_verif-commit.txt`.
- Optimiser les images des pages produits.
- Mesure d'audience (aucune installée).
- Séquences de relance (aucune : tous les automatismes sont transactionnels).

## Déployer sans Zapier

```bash
# 1. déposer le fichier
curl -X POST "https://crbvlowxxmspjnyculzl.supabase.co/functions/v1/upload-site" \
  -H "x-upload-secret: $UPLOAD_SECRET" \
  -H "x-nom-fichier: _deploy/ma-page.html" \
  -H "x-content-type: text/plain" \
  --data-binary "@ma-page.html"

# 2. committer depuis cette source
curl -X POST "https://crbvlowxxmspjnyculzl.supabase.co/functions/v1/github-commit" \
  -H "Content-Type: application/json" \
  -H "x-commit-secret: $COMMIT_SECRET" \
  -d '{"chemin":"ma-page.html","message":"...","source_url":"https://.../_deploy/ma-page.html"}'
```

Les deux secrets sont dans `secrets_app` (`upload_site_secret`,
`commit_secret`). Le jeton GitHub n'a qu'une permission — `Contents` en
lecture-écriture — sur ce seul dépôt.

Toujours vérifier le résultat en ligne après déploiement : comparer la
taille servie à la taille attendue.
