# Guide d'Intégration — Galerie Modèles SCAF Alliance

## 📋 Contenu

La galerie `modeles-scaf-galerie-production.html` est **prête pour déploiement**. Elle contient :

- ✅ **5 modèles complets** avec SVG rendus : Studio 45m² • T2 65m² • T3 100m² • T4 130m² • R+1 130m²
- ✅ **Boutons fonctionnels** : "Estimer en détail" + "Demander devis"
- ✅ **Passage de paramètres** : le nom du modèle, surface et Nudura sont transmis automatiquement
- ✅ **SEO optimisé** : meta tags, description, keywords
- ✅ **Thème sombre/clair** : support complet des préférences utilisateur
- ✅ **Analytics** : intégration Google Analytics (optionnel)
- ✅ **Responsive** : mobile-first design
- ✅ **Note d'explication** : section complète sur la technologie Nudura

---

## 🚀 Déploiement sur Netlify

### Option 1 : Fichier statique (Recommandé)

1. Créez un dossier `/pages` ou `/public` dans votre site Netlify
2. Placez `modeles-scaf-galerie-production.html` dedans
3. Accédez-y via : `votre-domaine.com/modeles-construction` (ou le chemin que vous choisissez)

**Configuration Netlify (_redirects)** :
```
/modeles-construction /modeles-scaf-galerie-production.html 200
```

### Option 2 : Intégration dans une page existante

Copiez le contenu HTML (sections `.container` et `.note`) dans votre page existante, et assurez-vous que :
- Le CSS des variables (`:root`) soit inclus
- Le script JavaScript soit présent

---

## 🔗 Configuration des URLs

Modifiez la section `CONFIG` du script JavaScript selon vos URLs :

```javascript
const CONFIG = {
  calculatorUrl: '/calculateur',  // ← Remplacez par votre URL du calculateur
  quoteFormUrl: '/devis',         // ← Remplacez par votre URL du formulaire devis
};
```

### Paramètres transmis

Quand un utilisateur clique sur un bouton, les paramètres suivants sont passés en query string :

**Estimer en détail** :
```
/calculateur?model=T3%20Plain-pied&surface=100&nudura=152mm
```

**Demander devis** :
```
/devis?model=T3%20Plain-pied&surface=100
```

Vous pouvez récupérer ces paramètres côté client avec :
```javascript
const params = new URLSearchParams(window.location.search);
const model = params.get('model');    // "T3 Plain-pied"
const surface = params.get('surface'); // "100"
const nudura = params.get('nudura');   // "152mm"
```

---

## 📊 Analytics (Google Analytics)

Le script inclut le support Google Analytics optionnel :

```javascript
if (typeof gtag !== 'undefined') {
  gtag('event', 'estimate_click', {
    'model': modelName,
    'surface': surface
  });
}
```

**Pour activer** :
1. Assurez-vous que GA4 est installé sur votre site
2. Les événements `estimate_click` et `quote_request_click` seront automatiquement trackés

---

## 🎨 Personnalisation

### Changer les couleurs

Modifiez les variables CSS dans `:root` :

```css
:root {
  --color-nudura: #2d5016;           /* vert des blocs */
  --color-accent: #0066cc;            /* bleu des accents */
  --color-bg: #fafaf8;                /* fond clair */
}
```

### Ajouter/modifier les modèles

Chaque modèle suit ce structure HTML :

```html
<div class="model-card">
  <div class="model-visual">
    <!-- SVG ou image ici -->
  </div>
  <div class="model-content">
    <div class="model-header">
      <div class="model-name">Nom du modèle</div>
      <div class="model-type">Surface | Segment</div>
    </div>
    <div class="model-specs">
      <!-- 3 specs -->
    </div>
    <!-- Description, détails, prix... -->
    <div class="model-actions">
      <button class="btn btn-primary" 
        data-model="Nom" 
        data-surface="100" 
        data-nudura="152mm">Estimer en détail</button>
      <button class="btn btn-secondary" 
        data-model="Nom" 
        data-surface="100">Devis</button>
    </div>
  </div>
</div>
```

---

## 🖼️ Amélioration future

### 1. Remplacer les SVG par des images/photos

Vous pouvez remplacer les SVG générés par des photos réelles :

```html
<div class="model-visual">
  <img src="/images/t3-plain-pied.jpg" alt="T3 Plain-pied 100m²" style="width:100%; height:100%; object-fit:cover;">
</div>
```

### 2. Ajouter les 6 modèles restants

Créez les cartes pour : R+1 Prestige • R+2 Standard • R+2 Premium • R+3 Collectif • R+3 Prestige • Villa Prestige

Utilisez le même template de structure.

### 3. Modal ou slide show

Convertir la galerie en un slider/carousel pour afficher les 11 modèles sur une seule page, sans scrolling horizontal.

---

## ✅ Checklist de déploiement

- [ ] Fichier placé sur Netlify/votre serveur
- [ ] URL `/modeles-construction` (ou votre chemin) accessible
- [ ] CONFIG du JavaScript mis à jour avec vos URLs
- [ ] Calculateur testable depuis la galerie
- [ ] Formulaire devis testable depuis la galerie
- [ ] Google Analytics events trackés (si GA4 installé)
- [ ] Thème sombre fonctionne sur mobile
- [ ] 6 modèles "coming soon" remplacés par les cartes complètes (optionnel mais recommandé)

---

## 📞 Support

**Problème de boutons** : Vérifiez que `CONFIG.calculatorUrl` et `CONFIG.quoteFormUrl` pointe vers les bonnes routes.

**Thème qui ne change pas** : Vérifiez que votre CSS du site supporte `data-theme` ou `prefers-color-scheme`.

**Images SVG qui ne s'affichent** : Assurez-vous que SVG est bien imbriqué dans le HTML (pas de fichiers externes).

---

**Créé pour SCAF Innovation** — Galerie de construction en Nudura ICF
