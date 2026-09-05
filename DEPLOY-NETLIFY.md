# Déploiement Netlify — Catalogues SCAF

## 📁 Fichiers à déployer

```
/pages/
├── nudura-plans-corse.html          (11 plans Nudura adapté Corse)
├── modeles-construction.html        (11 modèles SCAF maisons)
└── modeles-nudura-production.html   (5 modèles SCAF références)
```

---

## 🚀 Étapes Netlify (3 clics)

### 1. Ouvrir Netlify
- Connectez-vous : **https://app.netlify.com**
- Choisir votre site SCAF (`scaf-innovation-corsica.netlify.app`)

### 2. Uploader les fichiers
**Option A : Drag-drop** (rapide)
- Aller à **Deploys** → **Deploy**
- Glisser-déposer les 3 fichiers `.html` dans la zone
- Attendre confirmation (30s)

**Option B : Git push** (recommandé)
```bash
cd votre-repo-netlify
cp /mnt/user-data/outputs/*.html ./pages/
git add pages/
git commit -m "Add SCAF construction galleries & Nudura plans catalog"
git push
```

### 3. Vérifier URLs
Après déploiement :
- ✅ `https://scaf-innovation.com/pages/nudura-plans-corse`
- ✅ `https://scaf-innovation.com/pages/modeles-construction`
- ✅ `https://scaf-innovation.com/pages/modeles-nudura-production`

---

## ⚙️ Configuration POST-déploiement

### 1. Mettre à jour CONFIG JavaScript
**Dans chaque fichier `.html`**, modifier :

```javascript
const CONFIG = {
  calculatorUrl: '/calculateur',      // ← VÉRIFIER cette URL existe
  quoteFormUrl: '/devis'              // ← VÉRIFIER cette URL existe
};
```

Vérifier que ces endpoints retournent vos vrais formulaires.

### 2. Ajouter redirects Netlify (optionnel)
Fichier `netlify.toml` ou **_redirects** :

```
/plans-nudura                    /pages/nudura-plans-corse.html 200
/modeles-construction            /pages/modeles-construction.html 200
/modeles-construction-complete   /pages/modeles-construction.html 200
```

Cela rend les URLs plus courtes/mémorables.

### 3. Analytics Google
Ajouter votre **Google Analytics 4** ID dans la **<head>** si absent :

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

---

## 🧪 Tests POST-déploiement

### Test 1 : Pages accessibles
```
curl -I https://scaf-innovation.com/pages/nudura-plans-corse
# Attendez : HTTP/1.1 200 OK
```

### Test 2 : Boutons fonctionnent
- Ouvrir chaque page
- Cliquer "Devis" → formulaire SCAF s'ouvre avec `?plan=XXX&surface=YYY`
- Cliquer "Estimer détail" → calculateur avec `?model=XXX&surface=YYY&nudura=ZZZ`

### Test 3 : Thème sombre
- Ouvrir chaque page
- Cocher "Mode sombre"
- Vérifier fond/texte lisibles en sombre + en clair

### Test 4 : Mobile
- Ouvrir sur téléphone
- Grille responsive (1 colonne sur petit écran)
- Boutons CTA restent cliquables

---

## 📊 Monitoring

Après déploiement, suivre dans **Google Analytics** :
- **Event : estimate_click** — combien clients cliquent "Estimer détail"
- **Event : quote_request_click** — combien cliquent "Devis"

Cible : mesurer quel plan attire le plus.

---

## ✅ Checklist finale

- [ ] 3 fichiers `.html` placés dans `/pages/`
- [ ] URLs `/pages/nudura-plans-corse` et autres accessibles
- [ ] CONFIG JavaScript pointe vers vos vrais URLs (calculateur + devis)
- [ ] Test : clic "Devis" pré-remplit formulaire
- [ ] Test : thème sombre fonctionne
- [ ] Test : mobile responsive
- [ ] Google Analytics events apparaissent dans GA4
- [ ] Lien Nudura PDF fonctionne pour chaque plan

---

## 🔗 Fichiers attachés

- `nudura-plans-corse-catalogue.html` (22 KB)
- `modeles-scaf-galerie-complets-11.html` (60 KB) 
- `modeles-scaf-galerie-production.html` (32 KB)
- `GUIDE-NUDURA-PLANS-CORSE.md`
- `GUIDE-INTEGRATION-GALERIE.md`
- `RESUME-PROJET-GALERIE.md`

---

**Déploiement clé en main.**  
Estimé : 5–10 min (upload + vérification).
