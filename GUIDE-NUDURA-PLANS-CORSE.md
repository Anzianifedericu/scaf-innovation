# Guide — Catalogue Plans Nudura Adaptés Corse

## 📋 Fichier

**`nudura-plans-corse-catalogue.html`** (50 KB)

Catalogue de vente comprenant 11 plans de maison ICF Nudura, adaptés aux conditions corses avec pricing SCAF gros œuvre.

---

## 🎯 Cas d'usage commercial

### Flux standard
1. **Client cherche maison neuve** → visite `scaf-innovation.com/plans-nudura`
2. **Découvre 11 plans** avec images + specs + prix estimé
3. **Clique "Devis"** → arrive formulaire SCAF avec plan pré-sélectionné
4. **SCAF génère devis** : gros œuvre + options (clim, toiture, adaptations) + planning
5. **Client achète plans PDF** auprès de Nudura
6. **SCAF coordonne architecture + construction**

### Variantes
- **Architecte/bureau d'étude** : Utilise les plans comme base, SCAF fournit gros œuvre
- **Client solitaire** : Peaufine plan avec architect indépendant, puis revient à SCAF
- **Location touristique** : Client choisit plan + SCAF propose options haut de gamme (piscine, domotique)

---

## 🚀 Déploiement

### Sur Netlify
```
/pages/nudura-plans-corse.html
URL : https://scaf-innovation.com/plans-nudura
```

### Ou intégration page existante
Copier le contenu HTML dans une page `/plans-nudura` de votre site.

---

## ⚙️ Configuration

### URLs du calculateur & devis
Modifiez dans le fichier :

```javascript
const CONFIG = {
  calculatorUrl: '/calculateur',      // Votre URL du calculateur
  quoteFormUrl: '/devis'               // Votre URL du formulaire devis
};
```

Les boutons passeront automatiquement :
- **Estimer détail** → `/calculateur?model=XXX&surface=YYY&nudura=ZZZ`
- **Devis** → `/devis?plan=NNN&surface=YYY`

### Récupération paramètres côté serveur
```javascript
// Dans votre formulaire devis
const params = new URLSearchParams(window.location.search);
const planId = params.get('plan');      // Ex: "497-63"
const surface = params.get('surface');  // Ex: "273"
```

---

## 🎨 Personnalisation

### Couleurs
Modifiez `:root` dans le CSS :
```css
:root {
  --color-nudura: #2d5016;      /* Vert Nudura */
  --color-accent: #0066cc;      /* Bleu CTA */
  --color-price: #d97706;       /* Or tarif */
}
```

### Ajouter/modifier plans
Chaque plan est un objet dans le tableau `plans[]` :

```javascript
{
  id: '427-13',
  name: 'Ranch Simple',
  type: 'Plain-pied classique',
  surface: 130,
  nudura: '102mm',
  rValue: 'R=3.8',
  bedrooms: 3,
  bathrooms: 2,
  stories: 1,
  description: 'Description marketing',
  options: ['Clim 12kW', 'Toiture TX5', 'Pergola'],
  priceSqm: 750,    // €/m²
  nuduraUrl: 'https://...'  // Lien PDF officiel Nudura
}
```

Dupliquez & modifiez pour ajouter/adapter un plan.

---

## 📊 Données utilisées

### Surface & pricing
- **Formule** : Surface m² × €/m² plancher = Prix HT
- **TVA Corse** : 10% (appliquée auto en TTC)
- **€/m² plancher** :
  - 750€/m² pour Nudura 102mm
  - 720€/m² pour Nudura 152mm
  - 700€/m² pour Nudura 203mm

### Adaptations Corse incluses
Chaque plan comprend par défaut :
- **Climatisation** : Pompe à chaleur réversible (Midea/Daikin)
  - 12kW pour petites maisons (≤150m²)
  - 16–18kW pour maisons moyennes (150–250m²)
  - 20–24kW pour villas (>250m²)
- **Toiture** : TX5 Texsa SBS (86€/m² standard SCAF)
  - Résist vents côtiers, durabilité 50+ ans
- **Protections** :
  - Volets motorisés (UV été)
  - Pergola/parasol côtés sud-ouest
  - Surélévation climatique (humidité)

---

## 📊 Analytics

Le catalogue track automatiquement les clics :
- **estimate_click** : Bouton "Estimer détail"
- **quote_request_click** : Bouton "Devis"

Pour activer : assurez-vous Google Analytics 4 est installé sur votre site.

```javascript
if (typeof gtag !== 'undefined') {
  gtag('event', 'estimate_click', { 'plan': 'Ranch Simple' });
}
```

---

## 🔗 Liens officiels Nudura

Chaque plan renvoie vers :
- **Catalogue principal** : https://www.houseplans.com/collection/icf-house-plans
- **PDFs téléchargeables** : Plans anglais, 5–20$, souvent avec "Study Set" ou "Full Set"

**Pour localisation** : Un architecture local peut convertir plans anglais → français + adaptations régionales.

---

## ✅ Checklist déploiement

- [ ] Fichier placé sur Netlify (`/pages/nudura-plans-corse.html`)
- [ ] URL `/plans-nudura` accessible
- [ ] CONFIG du JS mis à jour (calculateur + devis)
- [ ] Test bouton "Devis" → formulaire SCAF pré-rempli
- [ ] Test bouton "Estimer détail" → calculateur avec paramètres
- [ ] Google Analytics events trackés
- [ ] Thème sombre fonctionne (test sur mobile)
- [ ] Lien vers docs Nudura fonctionne

---

## 💡 Propositions améliorations

### Phase 1 : Court terme
1. **Ajouter galerie images réelles** : Photos de maisons Nudura construites en Corse
2. **Mettre à jour pricing** : Ajouter options "clim premium", "piscine", "domotique"
3. **Mini-PDF devis** : Générer auto un devis PDF sommaire côté client

### Phase 2 : Moyen terme
1. **Configurateur 3D** : Client change couleur façade, toiture, pergola
2. **Timeline planning** : Afficher durée chantier estimation par taille
3. **Comparateur** : Côte à côte 3 plans (surface, prix, caractère)

### Phase 3 : Intégration complète
1. **Bridge Supabase** : Plans + devis auto-générés en base
2. **Chatbot IA** : "Quel plan pour ma famille ?" → recommandation
3. **Lead capture** : Email optionnel avant télécharger PDF Nudura

---

## 📞 Questions fréquentes

**Q: Puis-je modifier les plans Nudura ?**  
R: Oui — un architect peut adapter les plans de base. SCAF coordonne avec l'architect.

**Q: Comment gérer les clients qui veulent des variantes ?**  
R: Chaque devis peut inclure variantes (garages, piscine, étage supplémentaire). Pricing +X€/m² applicable.

**Q: Les prix inclus l'électricité/plomberie ?**  
R: Non, pricing = **gros œuvre seul** (murs + planchers + charpente + toiture). Second œuvre sur devis séparé.

**Q: Peut-on proposer financement ?**  
R: Oui — ajouter section "Financement" dans formulaire devis SCAF (partenaire banque).

---

**Créé pour SCAF Innovation**  
Plans Nudura • Adaptation Corse • Climatisation • Toiture TX5 • Gros œuvre clé en main
