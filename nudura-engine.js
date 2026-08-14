/*!
 * nudura-engine.js — moteur de chiffrage Nudura SCAF Innovation
 * Source unique de vérité. Extrait verbatim de estimation-pro-nudura.html (8 août 2026).
 * Consommé par : estimation-pro-nudura.html (<script src>) ET netlify/functions/chiffrage-nudura.js (require).
 * Aucune dépendance DOM. Ne pas dupliquer : toute correction se fait ICI.
 * Comptage par cours (blocs/rang x rangs) — pas au m². Constantes = manuel officiel Nudura.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.NuduraEngine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';

// ===== constantes =====
const LOCATION_PRIX_ENSEMBLE = 75; // € par ensemble loué (montant, garde-corps, support de passerelle, contreventement, axes d'assemblage), pour toute la durée du chantier
const LONGUEUR_BLOC_M = 2.438; // longueur standard des blocs Nudura (hors Optimizer, qui fait 1.219m et n'est pas utilisé ici)
const HAUTEUR_BLOC_M = 0.4572; // hauteur de bloc = 18 po exact (manuel officiel Nudura)
const RENDEMENT_BLOC_M2 = LONGUEUR_BLOC_M * HAUTEUR_BLOC_M;
const HAUTEUR_CORRECTEUR_M = 0.0762; // hauteur du correcteur = 3 po exact (manuel officiel, page 29)
const PERTE_PCT = 5;
const WASTE_OUVERTURE_PCT = 75; // % de la surface d'ouverture non réutilisable, déduite de la surface de mur
const REF_CONNECTEUR_T = 'NUS ATSTP 00'; // Carton 30 Bandes renfort mur T (T-strap)
const CONNECTEURS_PAR_CARTON = 30;
const REF_APPOINT = 'NUS AHDJF 00'; // Planelle Ajusteur de hauteur 76mm — utilisée pour le cours d'appoint
const LONGUEUR_AJUSTEUR_M = 0.813; // longueur réelle de la planelle ajusteur (813mm)
const ENTRETOISES_AJUSTEUR_PAR_CARTON = 100;
const REF_CONNECTEUR_4D = 'NUS A4XWC 00'; // Connecteur inter-entretoises 4 directions (largeurs sur-mesure >305mm)

const RATIOS_KG_ML = { 'HA8':0.395, 'HA10':0.617, 'HA12':0.888 };

// Table 2.2.2.1 du manuel officiel Nudura — ratio ml armature / m² de mur, recouvrements inclus
const TABLE_ARMATURE = [
  { espaceV: 203, simple: 4.92, double: 9.84 },
  { espaceV: 406, simple: 2.46, double: 4.92 },
  { espaceV: 610, simple: 1.64, double: 3.28 },
  { espaceV: 813, simple: 1.25, double: 2.50 },
  { espaceV: 1213, simple: 0.82, double: 1.64 },
];

const NIVEAU_PRESETS = [
  'Fondation / soubassement', 'Vide sanitaire', 'Dalle / plancher existant (reprise sur existant)',
  'RDC', 'R+1', 'R+2', 'R+3', 'Combles / attique', 'Pignon', 'Extension',
  'Muret / clôture', 'Piscine (paroi enterrée)', 'Local technique / annexe', 'Toiture (mur de pignon sous toiture)',
];

// ---- Gammes et épaisseurs ----
const GAMMES = [
  { key:'standard', label:'Standard' },
  { key:'xr35', label:'XR35' },
  { key:'plus', label:'Plus+ Forms' },
  { key:'one1', label:'One1' },
];
const EPAISSEURS_PAR_GAMME = { standard:[102,152,203,254,305], xr35:[152,203], plus:[152,203], one1:[102,152,203,254,305] };
const RAJOUTS_PSE_PLUS = [25,51,102,152];

const REFS_STANDARD = {
  102:{droit:'NUS I0096 04',angleExt:'NUS I0090 04',angleInt:'NUS I0090 04',angle45:'NUS I0045 04',courbe:'NUS I0RAD 04',entretoiseAjusteur:'NUS AHADT 04',entretoise:'NUS IWEBS 04'},
  152:{droit:'NUS I0096 06',angleExt:'NUS I0090 06',angleInt:'NUS I0090 06',angle45:'NUS I0045 06',courbe:'NUS I0RAD 06',entretoiseAjusteur:'NUS AHADT 06',entretoise:'NUS IWEBS 06'},
  203:{droit:'NUS I0096 08',angleExt:'NUS I0090 08',angleInt:'NUS I0090 08',angle45:'NUS I0045 08',courbe:'NUS I0RAD 08',entretoiseAjusteur:'NUS AHADT 08',entretoise:'NUS IWEBS 08'},
  254:{droit:'NUS I0096 10',angleExt:'NUS I0090 10',angleInt:'NUS I0090 10',angle45:'NUS I0045 10',courbe:'NUS I0RAD 10',entretoiseAjusteur:'NUS AHADT 10',entretoise:'NUS IWEBS 10'},
  305:{droit:'NUS I0096 12',angleExt:'NUS I0090 12',angleInt:'NUS I0090 12',angle45:'NUS I0045 12',courbe:'NUS I0RAD 12',entretoiseAjusteur:'NUS AHADT 12',entretoise:'NUS IWEBS 12'},
};
const REFS_XR35 = {
  152:{droit:'NUS IX496 06',angleExt:'NUS IX490 06',angleInt:'NUS IX490 06',angle45:null,courbe:null,entretoiseAjusteur:null,entretoise:null},
  203:{droit:'NUS IX496 08',angleExt:'NUS IX490 08',angleInt:'NUS IX490 08',angle45:null,courbe:null,entretoiseAjusteur:null,entretoise:null},
};
const REFS_PLUS = {
  152:{ 25:{droit:'NUS P1096 06',angleExt:'NUS P1L90 06',angleInt:'NUS P1S90 06'},
        51:{droit:'NUS P2096 06',angleExt:'NUS P2L90 06',angleInt:'NUS P2S90 06'},
        102:{droit:'NUS P4096 06',angleExt:'NUS P4L90 06',angleInt:'NUS P4S90 06'},
        152:{droit:'NUS P6096 06',angleExt:'NUS P6L90 06',angleInt:'NUS P6S90 06'} },
  203:{ 25:{droit:'NUS P1096 08',angleExt:'NUS P1L90 08',angleInt:'NUS P1S90 08'},
        51:{droit:'NUS P2096 08',angleExt:'NUS P2L90 08',angleInt:'NUS P2S90 08'},
        102:{droit:'NUS P4096 08',angleExt:'NUS P4L90 08',angleInt:'NUS P4S90 08'},
        152:{droit:'NUS P6096 08',angleExt:'NUS P6L90 08',angleInt:'NUS P6S90 08'} },
};

// ===== references =====
function getRefs(gamme, epaisseurMm, rajoutPSE){
  if(gamme === 'standard'){
    if(epaisseurMm === 'custom') return null;
    return REFS_STANDARD[epaisseurMm] || null;
  }
  if(gamme === 'xr35') return REFS_XR35[epaisseurMm] || null;
  if(gamme === 'plus'){
    const parEpaisseur = REFS_PLUS[epaisseurMm];
    if(!parEpaisseur) return null;
    const base = parEpaisseur[rajoutPSE];
    if(!base) return null;
    return { ...base, angle45:null, courbe:null, entretoiseAjusteur:null, entretoise:null };
  }
  return null; // one1 : composé par assemblage, voir calculerOne1Droit/calculerOne1Angle
}

// ---- One1 : système à assemblage sur site (composants, pas un bloc unique) ----
const REF_ONE1_PLANELLE = 'NUS I0PAN 00'; // Planelle droite PSE
const REF_ONE1_CONTREPLAQUE = 'NUS APLYN 00'; // Panneau contreplaqué
const REF_ONE1_VIS = 'NUS ASHEX 20'; // Vis Nudura 51mm hexagonale
const REF_ONE1_MULTILINK = 'NUS EMULT 00'; // Entretoises Multi-Link
const REF_ONE1_GABARIT = 'NUS AONEJ 00'; // Gabarit de montage — outil réutilisable, 1 par projet
const REF_ONE1_ANGLE_LONG = 'NUS E0E90 00'; // Angle 90° PSE côté long (A1=0,956m / A2=0,549m)
const REF_ONE1_ANGLE_COURT = 'NUS I0STW 00'; // Angle 90° PSE côté court (A1=0,518m / A2=0,111m)
const REF_ONE1_CONNECTEUR_ANGLE = 'NUS AONEC 00'; // Connecteur d'angle 3m — par angle, pas par ml

function entretoiseStandardPour(epaisseurMm){
  const r = REFS_STANDARD[epaisseurMm];
  return r ? r.entretoise : null;
}

function calculerOne1Droit(epaisseurMm, nbModules, panier){
  if(nbModules <= 0) return;
  ajouter(panier, REF_ONE1_PLANELLE, nbModules);
  ajouter(panier, REF_ONE1_CONTREPLAQUE, nbModules);
  ajouter(panier, REF_ONE1_VIS, nbModules * 24);
  ajouter(panier, REF_ONE1_MULTILINK, nbModules * 12);
  const entretoise = entretoiseStandardPour(epaisseurMm);
  if(entretoise) ajouter(panier, entretoise, nbModules * 12);
}

function calculerOne1Angle(epaisseurMm, type, nbAngles, courses, panier){
  if(nbAngles <= 0) return;
  const nbModulesAngle = nbAngles * courses;
  const entretoise = entretoiseStandardPour(epaisseurMm);
  if(type === 'long'){
    ajouter(panier, REF_ONE1_ANGLE_LONG, nbModulesAngle);
    ajouter(panier, REF_ONE1_CONTREPLAQUE, nbModulesAngle);
    ajouter(panier, REF_ONE1_VIS, nbModulesAngle * 8);
    ajouter(panier, REF_ONE1_MULTILINK, nbModulesAngle * 4);
    if(entretoise) ajouter(panier, entretoise, nbModulesAngle * 4);
  } else {
    ajouter(panier, REF_ONE1_ANGLE_COURT, nbModulesAngle);
    ajouter(panier, REF_ONE1_CONTREPLAQUE, nbModulesAngle);
    ajouter(panier, REF_ONE1_VIS, nbModulesAngle * 12);
    ajouter(panier, REF_ONE1_MULTILINK, nbModulesAngle * 6);
    if(entretoise) ajouter(panier, entretoise, nbModulesAngle * 4);
  }
  ajouter(panier, REF_ONE1_CONNECTEUR_ANGLE, nbAngles); // par angle physique, pas par cours/ml
}

function getCorniche(gamme, epaisseurMm){
  if(gamme === 'standard' && epaisseurMm === 152){
    return { ref:'NUS I0B96 06', assemble:true };
  }
  return {
    ref:'NUS I0B96 00', assemble:false,
    note:"Corniche non-assemblée : référence générique NUS I0B96 00, non déclinée par épaisseur dans notre catalogue (contrairement au catalogue fabricant Nudura qui varie la planelle corniche de 102 à 305mm) — quantité indicative, à confirmer avec SCAF.",
  };
}

// ===== geometrie =====
const TOURNANTS_RELEVE = { droit:0, sortant90:90, rentrant90:-90, sortant45:45, rentrant45:-45 };
const TOURNANT_LABEL = { droit:'0°', sortant90:'90°', rentrant90:'90°', sortant45:'45°', rentrant45:'45°' };
const PSE_PANEL_MM = 67; // épaisseur d'un panneau PSE Nudura (confirmée SCAF), présent des deux côtés du voile béton

function epaisseurCoreMm(n){
  const ep = (typeof n.epaisseurMm === 'number') ? n.epaisseurMm : null;
  if(ep === null) return null;
  if(n.gamme === 'plus') return ep + 2*PSE_PANEL_MM + (n.rajoutPSE||0);
  return ep + 2*PSE_PANEL_MM;
}

function cotDeg(deg){
  const r = deg * Math.PI / 180;
  return Math.cos(r) / Math.sin(r);
}

// ===== releve =====
function calculerReleveNiveau(n){
  let theta = 0, x = 0, y = 0;
  const points = [{x,y}];
  let perimetre = 0;
  const murs = n.releve.murs;
  let sumCot = cotDeg((180 - (TOURNANTS_RELEVE[n.releve.angleDepart] ?? 0)) / 2);
  murs.forEach((m,i)=>{
    const L = m.longueur || 0;
    perimetre += L;
    x += L * Math.cos(theta * Math.PI / 180);
    y += L * Math.sin(theta * Math.PI / 180);
    points.push({x,y});
    const isLast = i === murs.length - 1;
    if(!isLast){
      const turnDeg = TOURNANTS_RELEVE[m.angle] ?? 0;
      sumCot += cotDeg((180 - turnDeg) / 2);
      theta += turnDeg;
    }
  });
  let aire2 = 0;
  const nn = points.length - 1;
  for(let i=0;i<nn;i++){
    const p1 = points[i], p2 = points[i+1];
    aire2 += p1.x * p2.y - p2.x * p1.y;
  }
  const aireHorsTout = Math.abs(aire2) / 2;
  const closureErr = nn > 0 ? Math.hypot(points[nn].x - points[0].x, points[nn].y - points[0].y) : 0;
  const epaisseurMm = epaisseurCoreMm(n);
  const t = (epaisseurMm !== null ? epaisseurMm/1000 : 0) + (n.releve.finitionsCm || 0)/100;
  const correction = t * t * sumCot;
  const aireHabitable = Math.max(0, aireHorsTout - t * perimetre + correction);
  return { points, perimetre, aireHorsTout, aireHabitable, closureErr };
}

// ===== arrondis =====
const TOLERANCE_ARRONDI = 0.01; // absorbe les imprécisions de saisie/flottant (ex. 2,44m saisi pour un module de 2,438m)
function arrondiSupTolerant(valeur, unite){
  const ratio = valeur / unite;
  if(Math.abs(ratio - Math.round(ratio)) < TOLERANCE_ARRONDI) return Math.round(ratio);
  return Math.ceil(ratio);
}

function coursesInfo(hauteur){
  const exact = hauteur / HAUTEUR_BLOC_M;
  const isExact = Math.abs(exact - Math.round(exact)) < TOLERANCE_ARRONDI;
  const floor = isExact ? Math.round(exact) : Math.floor(exact);
  const ceil = isExact ? Math.round(exact) : Math.ceil(exact);
  return { exact, floor, ceil, isExact };
}

// ===== accessoires =====
function ajouter(panier, ref, qte){
  if(!ref || !(qte > 0)) return;
  panier[ref] = (panier[ref]||0) + qte;
}

// Table 2.2.3 du manuel officiel Nudura — volume de béton par module (m³), par épaisseur 102/152/203/254/305mm
const VOLUME_BETON = {
  102:{droit:0.120, angle90:0.048, angle45:0.043, correcteur:0.007, corniche:0.192},
  152:{droit:0.177, angle90:0.067, angle45:0.060, correcteur:0.010, corniche:0.248},
  203:{droit:0.234, angle90:0.093, angle45:0.078, correcteur:0.013, corniche:0.305},
  254:{droit:0.290, angle90:0.122, angle45:0.103, correcteur:0.016, corniche:0.362},
  305:{droit:0.347, angle90:0.153, angle45:0.138, correcteur:0.019, corniche:0.419},
};

// Accessoires liés aux blocs — références par épaisseur de voile béton (102/152/203/254/305mm)
const REF_BOUCHON = {102:'NUS A0ECF 04', 152:'NUS A0ECF 06', 203:'NUS A0ECF 08', 254:'NUS A0ECF 10', 305:'NUS A0ECF 12'};
const REF_LINTEAU = {102:'NUS PLINT 04', 152:'NUS PLINT 06', 203:'NUS PLINT 08', 254:'NUS PLINT 10', 305:'NUS PLINT 12'};
const REF_RAIDISSEUR = {152:'NUS ABLOK 06', 203:'NUS ABLOK 08', 254:'NUS ABLOK 10', 305:'NUS ABLOK 12'}; // pas de référence 102mm au catalogue
const REF_CLIPS = 'NUS A0VJC 00';
const LONGUEUR_LINTEAU_SEGMENT_M = 1.219;
const CLIPS_PAR_CARTON = 200;
const LONGUEUR_RAIDISSEUR_LOT_M = 30.5; // lot de 10 x 3,05m
// ===== moteur =====
function calculerNiveauUnique(n, gabaritFlag){
  let panier = {};
  let notes = [];
  let armatureLignes = [];
  const footprint = calculerReleveNiveau(n);

  const refs = getRefs(n.gamme, n.epaisseurMm, n.rajoutPSE);
  if(!refs && n.epaisseurMm === 'custom'){
    notes.push('Épaisseur sur-mesure : aucune quantité de bloc calculée automatiquement — configuration à valider avec SCAF.');
  }

  const ci = coursesInfo(n.hauteur);
  let hauteurEffective = n.hauteur;
  let coursAppoint = 0;
  let nCoursesPleins = ci.floor; // nb de cours de blocs entiers (hors correcteur d'appoint) ; ajusté ci-dessous si besoin
  if(!ci.isExact){
    if(n.ajustement === 'up'){ hauteurEffective = ci.ceil * HAUTEUR_BLOC_M; nCoursesPleins = ci.ceil; }
    else if(n.ajustement === 'down'){ hauteurEffective = ci.floor * HAUTEUR_BLOC_M; nCoursesPleins = ci.floor; }
    else { hauteurEffective = ci.floor * HAUTEUR_BLOC_M + HAUTEUR_CORRECTEUR_M; coursAppoint = 1; nCoursesPleins = ci.floor; }
  } else {
    nCoursesPleins = ci.floor; // hauteur exacte : floor === ceil, un seul cas
  }

  const surfaceBrute = n.lineaire * hauteurEffective;
  let surfaceOuvertures = 0;
  n.ouvertures.forEach(o=>{ surfaceOuvertures += o.largeur * o.hauteur * o.qte * (WASTE_OUVERTURE_PCT/100); });
  const surfaceNette = Math.max(0, surfaceBrute - surfaceOuvertures);
  const coursesPourAngles = nCoursesPleins; // même logique de tolérance que le comptage des blocs droits — un seul nombre de cours entiers pour tout le niveau

  let qDroit = 0, qAngle90 = 0, qAngle45 = 0;
  if(n.gamme === 'one1'){
    const nbModulesDroits = Math.ceil(surfaceNette / RENDEMENT_BLOC_M2 * (1 + PERTE_PCT/100));
    calculerOne1Droit(n.epaisseurMm, nbModulesDroits, panier);
    calculerOne1Angle(n.epaisseurMm, 'long', n.coins.ext90, coursesPourAngles, panier);
    calculerOne1Angle(n.epaisseurMm, 'court', n.coins.int90, coursesPourAngles, panier);
    if(nbModulesDroits > 0 || n.coins.ext90 > 0 || n.coins.int90 > 0) gabaritFlag.necessaire = true;
  } else if(refs){
    // Comptage par cours (exact géométriquement) plutôt que par surface — évite de basculer au bloc
    // supérieur uniquement à cause de la marge de perte quand le mur tombe pile sur un nombre entier de modules.
    const nbCoinsPourConsommation = n.coins.ext90 + n.coins.int90 + n.coins.ext45 + n.coins.int45;
    if(nbCoinsPourConsommation > 0){
      notes.push("Comptage des blocs droits par cours : la longueur consommée par les blocs d'angle n'est pas déduite du linéaire (donnée de consommation par angle non disponible) — légère surestimation possible si des coins sont présents, à vérifier avec SCAF sur les configurations avec beaucoup d'angles.");
    }
    const nBlocsParCours = arrondiSupTolerant(n.lineaire, LONGUEUR_BLOC_M);
    qDroit = nBlocsParCours * nCoursesPleins;
    ajouter(panier, refs.droit, qDroit);
    qAngle90 = n.coins.ext90 * coursesPourAngles + n.coins.int90 * coursesPourAngles;
    ajouter(panier, refs.angleExt, n.coins.ext90 * coursesPourAngles);
    ajouter(panier, refs.angleInt, n.coins.int90 * coursesPourAngles);
    const nbAngles45 = n.coins.int45 + n.coins.ext45;
    qAngle45 = nbAngles45 * coursesPourAngles;
    if(nbAngles45 > 0 && refs.angle45) ajouter(panier, refs.angle45, qAngle45);
  }

  let surfaceRefend = 0;
  let qAppoint = 0;
  if(coursAppoint > 0){
    qAppoint = arrondiSupTolerant(n.lineaire, LONGUEUR_AJUSTEUR_M);
    ajouter(panier, REF_APPOINT, qAppoint);
    if(refs && refs.entretoiseAjusteur){
      ajouter(panier, refs.entretoiseAjusteur, Math.ceil(qAppoint / ENTRETOISES_AJUSTEUR_PAR_CARTON));
    }
  }

  if(n.armature.actif){
    const ligneTable = TABLE_ARMATURE.find(t=>t.espaceV === n.armature.espaceV);
    const ratio = ligneTable ? ligneTable[n.armature.nappe] : 0;
    const mlTotal = ratio * surfaceNette;
    const kgm = RATIOS_KG_ML[n.armature.diametre] || 0;
    armatureLignes.push({ diametre:n.armature.diametre, ml:mlTotal, kg:mlTotal*kgm, espaceV:n.armature.espaceV, espaceH:n.armature.espaceH, nappe:n.armature.nappe });
    if(n.armature.espaceH === 914){
      notes.push("Espacement horizontal 914mm : dépasse le maximum standard recommandé (457mm). Le ratio utilisé correspond à un espacement horizontal standard — pour 914mm, contactez SCAF pour le tableau croisé exact, et faites valider par un ingénieur.");
    }
  }

  if(n.refend.actif && n.refend.lineaire > 0){
    surfaceRefend = n.refend.lineaire * n.refend.hauteur;
    if(n.refend.gamme === 'one1'){
      const nbModulesRefend = Math.ceil(surfaceRefend / RENDEMENT_BLOC_M2 * (1 + PERTE_PCT/100));
      calculerOne1Droit(n.refend.epaisseurMm, nbModulesRefend, panier);
      if(nbModulesRefend > 0) gabaritFlag.necessaire = true;
    } else {
      const refsRefend = getRefs(n.refend.gamme, n.refend.epaisseurMm, n.refend.rajoutPSE);
      if(refsRefend){
        // Un refend qui change de direction consomme un bloc d'angle par cours,
        // exactement comme le mur peripherique. Le lineaire correspondant
        // n'est donc plus a compter en blocs droits.
        const coursRefend = coursesInfo(n.refend.hauteur).floor;
        const nb90 = Math.max(0, n.refend.angles90 || 0);
        const nb45 = Math.max(0, n.refend.angles45 || 0);
        const lineaireAngles = (nb90 + nb45) * LONGUEUR_BLOC_M;
        const lineaireDroit = Math.max(0, n.refend.lineaire - lineaireAngles);
        const surfaceDroite = lineaireDroit * n.refend.hauteur;

        ajouter(panier, refsRefend.droit, Math.ceil(surfaceDroite / RENDEMENT_BLOC_M2 * (1 + PERTE_PCT/100)));
        if(nb90 > 0) ajouter(panier, refsRefend.angleExt, nb90 * coursRefend);
        if(nb45 > 0 && refsRefend.angle45) ajouter(panier, refsRefend.angle45, nb45 * coursRefend);
        else if(nb45 > 0) notes.push('Refend : angles a 45 degres non disponibles pour cette gamme/epaisseur — a valider avec SCAF.');
      } else {
        notes.push('Refend : gamme/épaisseur sans référence catalogue calculable — à valider avec SCAF.');
      }
    }
  }

  if(n.options.tWalls.actif && n.options.tWalls.nb > 0){
    const cartons = Math.ceil((n.options.tWalls.nb * coursesPourAngles) / CONNECTEURS_PAR_CARTON);
    ajouter(panier, REF_CONNECTEUR_T, cartons);
  }

  let gableSurface = 0;
  if(n.options.gableEnds.actif && n.options.gableEnds.qte > 0 && refs){
    gableSurface = 0.5 * n.options.gableEnds.largeur * n.options.gableEnds.hauteur * n.options.gableEnds.qte;
    ajouter(panier, refs.droit, Math.ceil(gableSurface / RENDEMENT_BLOC_M2 * (1 + PERTE_PCT/100)));
  }

  let radiusSurface = 0;
  if(n.options.radius.actif && n.options.radius.rayonExt > 0 && refs && refs.courbe){
    const rayonMoyen = (n.options.radius.rayonExt + (n.options.radius.rayonInt||n.options.radius.rayonExt)) / 2;
    const arcLength = (n.options.radius.angle/360) * 2 * Math.PI * rayonMoyen;
    radiusSurface = arcLength * hauteurEffective;
    ajouter(panier, refs.courbe, Math.ceil(radiusSurface / RENDEMENT_BLOC_M2 * (1 + PERTE_PCT/100)));
  } else if(n.options.radius.actif && n.options.radius.rayonExt > 0 && refs && !refs.courbe){
    notes.push('Mur courbe : pas de bloc courbe catalogué pour cette gamme/épaisseur — à valider avec SCAF.');
  }

  let qCorniche = 0;
  if(n.options.brickLedge.actif && n.options.brickLedge.lineaire > 0){
    const cor = getCorniche(n.gamme, n.epaisseurMm);
    qCorniche = Math.ceil(n.options.brickLedge.lineaire / LONGUEUR_BLOC_M * (1 + PERTE_PCT/100));
    ajouter(panier, cor.ref, qCorniche);
    if(cor.note) notes.push(cor.note);
  }

  let taperTopLineaire = 0;
  if(n.options.taperTop.actif) taperTopLineaire = n.options.taperTop.lineaire;

  // ---- Accessoires liés aux blocs (bouchons, fond de linteau, clips, raidisseurs) ----
  const epaisseurNumerique = (typeof n.epaisseurMm === 'number') ? n.epaisseurMm : null;

  if(epaisseurNumerique && REF_BOUCHON[epaisseurNumerique]){
    let nbBouchons = 0;
    n.ouvertures.forEach(o=>{ nbBouchons += 2 * arrondiSupTolerant(o.hauteur, HAUTEUR_BLOC_M) * o.qte; });
    ajouter(panier, REF_BOUCHON[epaisseurNumerique], nbBouchons);
  }

  if(epaisseurNumerique && REF_LINTEAU[epaisseurNumerique]){
    let nbSegmentsLinteau = 0;
    n.ouvertures.forEach(o=>{
      // Le fond de linteau se pose uniquement en partie haute de l'ouverture,
      // quel que soit son type : une seule rangee par ouverture.
      nbSegmentsLinteau += arrondiSupTolerant(o.largeur, LONGUEUR_LINTEAU_SEGMENT_M) * o.qte;
    });
    ajouter(panier, REF_LINTEAU[epaisseurNumerique], nbSegmentsLinteau);
  }

  let detailClips = null;
  {
    const nbCoinsTotalClips = n.coins.ext90 + n.coins.int90 + n.coins.ext45 + n.coins.int45;
    const nbClipsDroits = arrondiSupTolerant(n.lineaire, LONGUEUR_BLOC_M) * 4 * coursesPourAngles;
    const nbClipsCoins = nbCoinsTotalClips * 4 * coursesPourAngles;
    const nbClipsTotal = nbClipsDroits + nbClipsCoins;
    if(nbClipsTotal > 0){
      const cartons = Math.ceil(nbClipsTotal / CLIPS_PAR_CARTON);
      ajouter(panier, REF_CLIPS, cartons);
      detailClips = { brut: nbClipsTotal, cartons };
    }
  }

  let detailRaidisseur = null;
  if(n.lineaire > 0){
    if(epaisseurNumerique && REF_RAIDISSEUR[epaisseurNumerique]){
      const multiplicateurRaidisseur = nCoursesPleins >= 3 ? 2 : 1; // 2ème rang + dernier rang distincts à partir de 3 cours, sinon ils se confondent
      const longueurRaidisseur = multiplicateurRaidisseur * n.lineaire;
      const lots = arrondiSupTolerant(longueurRaidisseur, LONGUEUR_RAIDISSEUR_LOT_M);
      ajouter(panier, REF_RAIDISSEUR[epaisseurNumerique], lots);
      detailRaidisseur = { ref: REF_RAIDISSEUR[epaisseurNumerique], brutMl: longueurRaidisseur, lots };
    } else if(epaisseurNumerique === 102){
      notes.push('Raidisseurs : aucune référence catalogue pour 102mm — à confirmer avec SCAF si nécessaire pour cette épaisseur.');
    }
  }

  // ---- Volume de béton (Tableau 2.2.3) ----
  let volumeBeton = null;
  const vb = (typeof n.epaisseurMm === 'number') ? VOLUME_BETON[n.epaisseurMm] : null;
  if(n.gamme === 'standard' && vb){
    volumeBeton = qDroit*vb.droit + qAngle90*vb.angle90 + qAngle45*vb.angle45 + qAppoint*vb.correcteur + qCorniche*vb.corniche;
  } else if(qDroit > 0 || qAngle90 > 0 || qCorniche > 0){
    notes.push('Volume de béton non calculé pour cette gamme/épaisseur (table officielle disponible uniquement pour la série Standard, 102 à 305mm) — à estimer avec SCAF.');
  }

  let locationEnsembles = 0, locationMontant = 0;
  if(n.location.actif && n.lineaire > 0){
    locationEnsembles = arrondiSupTolerant(n.lineaire, n.location.espacement);
    locationMontant = locationEnsembles * LOCATION_PRIX_ENSEMBLE;
  }

  return { panier, notes, armatureLignes, surfaceBrute, surfaceOuvertures, surfaceNette, surfaceRefend, gableSurface, radiusSurface, taperTopLineaire, volumeBeton, detailClips, detailRaidisseur, locationEnsembles, locationMontant, locationEspacement: n.location.espacement, footprintHorsTout: footprint.aireHorsTout, footprintHabitable: footprint.aireHabitable, nCoursesPleins, coursAppoint };
}


// ===== normalisation des entrées (sparse -> complet) =====
// Permet à un LLM (bot Telegram) ou à un appel HTTP de ne fournir que le strict nécessaire.
const NIVEAU_DEFAUT = {
  nom:'RDC', gamme:'standard', epaisseurMm:152, rajoutPSE:25,
  lineaire:0, hauteur:2.5, ajustement:'exact',
  releve:{ murs:[], finitionsCm:3, angleDepart:'sortant90' },
  location:{ actif:false, espacement:1.7 },
  coins:{ int90:0, ext90:0, int45:0, ext45:0 },
  ouvertures:[],
  armature:{ actif:false, espaceH:457, espaceV:406, nappe:'simple', diametre:'HA10' },
  refend:{ actif:false, lineaire:0, hauteur:2.5, gamme:'standard', epaisseurMm:152, rajoutPSE:25, angles90:0, angles45:0 },
  options:{
    brickLedge:{ actif:false, lineaire:0 }, taperTop:{ actif:false, lineaire:0 },
    tWalls:{ actif:false, nb:0 }, gableEnds:{ actif:false, largeur:0, hauteur:0, qte:0 },
    radius:{ actif:false, rayonExt:0, rayonInt:0, angle:90 },
  },
};

function fusion(base, patch){
  const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
  if(!patch || typeof patch !== 'object') return out;
  Object.keys(patch).forEach(k=>{
    const v = patch[k];
    if(v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])){
      out[k] = fusion(base[k], v);
    } else if(v !== undefined && v !== null){ out[k] = v; }
  });
  return out;
}

function normaliserNiveau(input){
  const n = fusion(NIVEAU_DEFAUT, input || {});
  n.releve.murs = (n.releve.murs || []).map((m,i)=>({ id:i+1, longueur:Number(m.longueur)||0, angle:m.angle||'sortant90' }));
  // Si un relevé est fourni, le linéaire en découle (source de vérité géométrique).
  if(n.releve.murs.length){ n.lineaire = parseFloat(calculerReleveNiveau(n).perimetre.toFixed(2)); }
  n.ouvertures = (n.ouvertures || []).map((o,i)=>({
    id:i+1, type:o.type||'fenetre',
    largeur:Number(o.largeur)||0, hauteur:Number(o.hauteur)||0, qte:Number(o.qte)||0,
  }));
  return n;
}

// ===== point d'entrée unique =====
// entree : { niveaux:[ ...niveaux sparse... ] }
// sortie : panier de références + géométrie + notes. AUCUN prix (les prix restent en base).
function chiffrer(entree){
  const gabaritFlag = { necessaire:false };
  const niveaux = (entree && entree.niveaux || []).map(normaliserNiveau);
  if(!niveaux.length) throw new Error('Aucun niveau fourni');

  const detail = niveaux.map(n=>{
    const r = calculerNiveauUnique(n, gabaritFlag);
    if(!n.releve.murs.length){ r.footprintHorsTout = null; r.footprintHabitable = null; }
    return { nom:n.nom, lineaire:n.lineaire, hauteur:n.hauteur, gamme:n.gamme, epaisseurMm:n.epaisseurMm, ...r };
  });

  const panier = {};
  detail.forEach(r=>Object.keys(r.panier).forEach(ref=>ajouter(panier, ref, r.panier[ref])));
  if(gabaritFlag.necessaire) ajouter(panier, REF_ONE1_GABARIT, 1); // outil réutilisable, 1 par projet

  const som = (f)=>detail.reduce((s,r)=>s + (f(r)||0), 0);
  return {
    lignes: Object.keys(panier).map(ref=>({ ref, qte: panier[ref] })),
    panier,
    niveaux: detail,
    totaux: {
      surfaceNette: som(r=>r.surfaceNette) + som(r=>r.surfaceRefend),
      volumeBeton: detail.every(r=>r.volumeBeton !== null) ? som(r=>r.volumeBeton) : null,
      locationMontantHT: som(r=>r.locationMontant),
      footprintHorsTout: som(r=>r.footprintHorsTout) || null,
      footprintHabitable: som(r=>r.footprintHabitable) || null,
      armature: detail.flatMap(r=>r.armatureLignes),
    },
    notes: Array.from(new Set(detail.flatMap(r=>r.notes))),
  };
}

return {
  // API principale
  chiffrer, normaliserNiveau, calculerNiveauUnique, calculerReleveNiveau, getRefs,
  // helpers consommes par le portail pro
  ajouter, coursesInfo, epaisseurCoreMm, arrondiSupTolerant,
  // constantes affichees ou reutilisees par l'interface
  NIVEAU_DEFAUT, GAMMES, EPAISSEURS_PAR_GAMME, RAJOUTS_PSE_PLUS, NIVEAU_PRESETS,
  TABLE_ARMATURE, TOURNANTS_RELEVE, TOURNANT_LABEL,
  LONGUEUR_BLOC_M, HAUTEUR_BLOC_M, HAUTEUR_CORRECTEUR_M, PERTE_PCT, WASTE_OUVERTURE_PCT,
  LOCATION_PRIX_ENSEMBLE, REF_CLIPS, REF_RAIDISSEUR, REF_ONE1_GABARIT,
  VERSION: '2026-08-08',
};
});
