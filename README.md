# SCAF Innovation — site statique + micro-boutique

Ce dépôt contient le site web statique de SCAF Innovation (pages marketing en Corse / FR) et une micro-boutique front-end (dossier `boutique/`) qui interagit avec Supabase et des webhooks Make.

## Vue d'ensemble
- Pages principales : `index.html`, `fr.html` et plusieurs pages produit/contact/merci.
- Boutique : `boutique/` — catalogue statique + `boutique/assets/app.js` (vanilla JS) qui consomme une REST API Supabase et utilise des webhooks Make pour certaines fonctionnalités (vérif compte pro, chatbot, stock_alerts).
- Outil d'édition : `appliquer-espace-pro.py` — script Python pour injecter un bouton "Espace Pro" dans les pages `*-fr.html`.

## Arborescence importante

```
index.html
fr.html
appliquer-espace-pro.py
nudura-video.mp4
boutique/
  index.html
  product.html
  checkout.html
  assets/
    app.js
    style.css
    products/   # photos attendues par SKU
```

## Prérequis
- Navigateur moderne
- (Optionnel) Python 3 pour exécuter le script `appliquer-espace-pro.py`
- Pour tester localement : un serveur statique (ex. `python -m http.server` ou `serve`)

## Exécution locale (rapide)
Cloner puis lancer un serveur statique depuis la racine du dépôt :

```bash
git clone https://github.com/Anzianifedericu/scaf-innovation.git
cd scaf-innovation
# Option A : python
python3 -m http.server 8000
# Option B : npm (si 'serve' est installé)
# npm install -g serve
# serve -s .
# Ouvrir http://localhost:8000/index.html ou /fr.html ou /boutique/
```

## Boutique — fonctionnement et variables externes
- `boutique/assets/app.js` consulte une instance Supabase publique via `SUPABASE_URL` et `SUPABASE_ANON_KEY` (clé anonyme présente dans le fichier).
- La boutique utilise aussi des webhooks Make (URLs en clair dans `app.js`) pour :
  - vérification d'accès "pro" (PRO_PORTAL_WEBHOOK)
  - chatbot (CHATBOT_WEBHOOK_URL)
  - pré-demandes / alertes de stock (insertion via REST)
- Le catalogue est lu depuis la table `shop_products` via l'API REST de Supabase.

Attention : la clé anonyme SUPABASE_ANON_KEY est embarquée dans le JS — elle donne un accès en lecture/écriture selon les règles RLS du projet Supabase. Vérifier les règles d'accès du projet Supabase avant déploiement en production.

Recommandation de sécurité : ne pas laisser de secrets d'administration dans le dépôt. Pour atténuer :
- Remplacer la clé en dur par une variable d'environnement côté build / serveur et injecter dynamiquement au moment du déploiement.
- Protéger les tables sensibles via Row Level Security et politiques (`anon` uniquement lecture des éléments publics) et limiter les insert/update.

## Modifier / Provisionner la configuration Supabase
- Si vous créez un nouveau projet Supabase, créez la table `shop_products` avec les colonnes attendues (`sku`, `name`, `category`, `price_eur`, `stock_status`, `department`, `active`, ...).
- Mettez à jour `SUPABASE_URL` et `SUPABASE_ANON_KEY` dans `boutique/assets/app.js` ou utilisez une stratégie d'injection côté déploiement.

## Script d'injection "Espace Pro"
Le script `appliquer-espace-pro.py` analyse les fichiers `*-fr.html` (et `fr.html`) et injecte un bouton "Espace Pro" dans l'entête. Pour l'utiliser :

```bash
# exécuter à la racine du dépôt
python3 appliquer-espace-pro.py
```

Le script modifie les fichiers en place ; faire un commit ou une branche avant exécution si vous voulez garder un historique.

## Déploiement
Le site est statique — déployer sur Netlify, GitHub Pages, Vercel (static), ou tout hébergement de fichiers statiques.
- Si vous utilisez Netlify et souhaitez activer les Netlify Forms, conservez l'attribut `data-netlify="true"` présent sur le formulaire de contact.
- Assurez-vous que les variables et webhooks (Supabase, Make) sont correctement configurés dans l'environnement de production.

## Contribution
- Fork -> branch -> PR. Décris les changements dans le titre et la description du PR.
- Pour corrections rapides (typos, contenu), modifier les fichiers HTML/CSS/JS directement et ouvrir un PR.

## Points d’attention / To‑do potentiels
- Extraire la clé SUPABASE_ANON_KEY du dépôt et documenter la procédure d’injection au déploiement.
- Ajouter un README détaillé sur la structure de la table `shop_products` et les webhooks Make attendus.
- Vérifier les règles RLS de Supabase pour limiter ce que la clé anonyme peut faire.
- Ajouter tests statiques (lint HTML/CSS/JS) si souhaité.

## Licence
Ajoutez ici la licence souhaitée (ex. MIT) ou un fichier `LICENSE` au besoin.

---

Si tu veux, je peux maintenant :
- ouvrir un PR/commit pour ajouter ce README (je viens de l'ajouter),
- proposer un patch pour extraire la SUPABASE_ANON_KEY dans un fichier de configuration, ou
- générer un README plus détaillé (schéma de la table `shop_products`, exemples d'API Supabase, snippets pour les webhooks Make).
