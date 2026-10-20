/* Parcours « Ma maison Nudura » — le particulier part d'un modele ou de son
   plan, nomme ses pieces, choisit sa solution Nudura, se voit chez lui en 3D,
   puis nous envoie son projet. S'appuie sur les globales du calculateur
   (niveaux, N, recalcul, setMode, vuePro...). Aucun prix public ici : le
   chiffrage reste celui de l'etude que SCAF renvoie. */
(function(){
  'use strict';

  /* ---------------- choix du projet, gardes pour l'envoi ---------------- */
  const projet = window.projetMaison = {
    solution: 'essentiel',
    options: [],
    facade: 'blanc-casse', menuiseries: 'blanc', tuile: 'terre-cuite',
    modele: null,
  };

  /* Trois solutions, toutes dans le domaine du DTA 16/23-799_V1 (voiles 152
     et 203 mm, PSE 67 mm ou XR35 102 mm). Valeurs du Tableau 5 et 6. */
  const SOLUTIONS = {
    'essentiel': { nom:'Essentiel', gamme:'standard', ep:152,
      accroche:'La solution de référence',
      points:['Mur de 28,6 cm, béton armé de 15,2 cm','Isolation R = 3,00 m²K/W (U 0,31)','Affaiblissement acoustique Rw 52 dB*'] },
    'renforce': { nom:'Renforcé', gamme:'standard', ep:203,
      accroche:'Plus de béton, plus de silence',
      points:['Mur de 33,7 cm, béton armé de 20,3 cm','Isolation R = 3,03 m²K/W (U 0,31)','Affaiblissement acoustique Rw 55 dB*'] },
    'haute-isolation': { nom:'Haute isolation', gamme:'xr35', ep:152,
      accroche:'Pour viser la très basse consommation',
      points:['Mur de 35,6 cm, isolant de 2 × 10,2 cm','Isolation R = 4,71 m²K/W (U 0,20)','Affaiblissement acoustique Rw 50 dB*'] },
  };
  const OPTIONS = {
    'isoltop': { nom:'Planchers isolants Isoltop', txt:'Poutrelles et entrevous isolants, pour des planchers sans pont thermique.' },
    'aircrab': { nom:'Vide sanitaire Air-Crab', txt:'Un vide sanitaire ventilé, sain et rapide à mettre en œuvre.' },
    'coelho':  { nom:'Tuiles Coelho da Silva', txt:'Tuiles en terre cuite portugaises, dont SCAF est distributeur en Corse.' },
  };
  const FACADES = { 'blanc-casse':['Blanc cassé','#EDE9DF'], 'sable':['Sable','#DCCAA6'], 'ocre':['Ocre corse','#C99A5B'], 'gris':['Gris perle','#BFC0BB'], 'rose':['Rose antique','#D7B3A3'] };
  const MENUISERIES = { 'blanc':['Blanc','#F4F4F2'], 'anthracite':['Gris anthracite','#3A3D40'], 'bois':['Bois naturel','#9C6B3E'], 'vert':['Vert olive','#5E6B45'] };
  const TUILES = { 'terre-cuite':['Terre cuite','#B4532F'], 'vieillie':['Vieillie','#8E5A43'], 'brune':['Brune','#5D3A2C'] };
  window.PALETTES_MAISON = { FACADES, MENUISERIES, TUILES };

  /* Change le mur d'un niveau. Les refends et cloisons accroches au nu
     interieur suivent ce nu quand le mur s'epaissit ou s'amincit. */
  function changerMur(niv, gamme, ep){
    const avant = horsTout(niv);
    niv.gamme = gamme; niv.epaisseur = ep;
    const apres = horsTout(niv), d = apres - avant;
    if(Math.abs(d) < 1e-6 || !niv.ferme) return;
    let x=0,y=0; const P=[{x,y}]; niv.murs.forEach(m=>{ x+=m.dx*m.longueur; y+=m.dy*m.longueur; P.push({x,y}); });
    const poly = P.slice(0,-1);
    const dans=(px,py)=>{ let c=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const A=poly[i],B=poly[j]; if((A.y>py)!==(B.y>py)&&px<(B.x-A.x)*(py-A.y)/(B.y-A.y)+A.x) c=!c; } return c; };
    const aretes = poly.map((a,i)=>{ const b=poly[(i+1)%poly.length], L=Math.hypot(b.x-a.x,b.y-a.y);
      let n={x:-(b.y-a.y)/L,y:(b.x-a.x)/L}; if(!dans((a.x+b.x)/2+n.x*0.05,(a.y+b.y)/2+n.y*0.05)) n={x:-n.x,y:-n.y};
      return {a,b,L,n}; });
    const recaler = p=>{
      let mx=0,my=0;
      aretes.forEach(({a,b,L,n})=>{
        const t=((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/(L*L);
        const dist=(p.x-a.x)*n.x+(p.y-a.y)*n.y;
        if(t>-0.05&&t<1.05&&Math.abs(dist-avant)<0.03){ mx+=n.x*d; my+=n.y*d; }
      });
      p.x+=mx; p.y+=my;
    };
    niv.refends.forEach(r=>r.pts.forEach(recaler));
    (niv.cloisons||[]).forEach(r=>r.pts.forEach(recaler));
  }
  function appliquerSolution(cle){
    const s = SOLUTIONS[cle]; if(!s) return;
    projet.solution = cle;
    niveaux.forEach(n=>{ if(n.hauteur >= 1.8) changerMur(n, s.gamme, s.ep); });
    recalcul();
  }

  /* ---------------- modeles de maison ---------------- */
  // Un contour se donne par ses sommets, le premier en (0,0), sens horaire.
  function murs(pts){
    const m=[];
    for(let i=0;i<pts.length;i++){
      const a=pts[i], b=pts[(i+1)%pts.length], l=Math.hypot(b[0]-a[0],b[1]-a[1]);
      m.push({dx:(b[0]-a[0])/l, dy:(b[1]-a[1])/l, longueur:l});
    }
    return m;
  }
  const P = (x,y)=>({x,y});
  const ligne = (a,b)=>({pts:[P(a[0],a[1]),P(b[0],b[1])]});
  const fen = (i,t,L=1.0,H=1.2,vr=true)=>({sur:'mur',i,t,largeur:L,hauteur:H,nature:'fenetre',materiau:'pvc',volet:vr});
  const porteR = (i,t,seg=1)=>({sur:'refend',i,seg,t,largeur:0.83,hauteur:2.04,nature:'porte',materiau:'bois'});
  const niveau = (nom,h,pts,o={})=>({ nom, hauteur:h, gamme:'standard', epaisseur:152, murs:murs(pts),
    refends:o.refends||[], cloisons:o.cloisons||[], ouvertures:o.ouvertures||[], pieces:o.pieces||[],
    poutres:[], ferme:true, isoltop:'hourdinov-15' });
  const passageVS = (i,t)=>({sur:'mur',i,t,largeur:0.80,hauteur:0.60,nature:'passage'});

  const MODELES = {
    'plain-pied': {
      nom:'Plain-pied 3 chambres', desc:'14 × 9 m · séjour-cuisine de 38 m², 3 chambres, salle de bain, WC, entrée',
      construire(){
        const pts=[[0,0],[14,0],[14,-9],[0,-9]];
        const R=[ligne([0.286,-4.3],[13.714,-4.3])];
        const rdc=niveau('RDC',2.70,pts,{
          refends:R,
          cloisons:[3.6,7.0,9.4,10.8].map(x=>ligne([x,-0.286],[x,-4.157])).concat([ligne([10.8,-4.443],[10.8,-8.714])]),
          ouvertures:[
            fen(0,0.136), fen(0,0.379), fen(0,0.586,0.6,0.75,false), fen(0,0.879),
            {sur:'mur',i:2,t:0.121,largeur:1.0,hauteur:2.15,nature:'porte-entree',materiau:'alu'},
            {sur:'mur',i:2,t:0.571,largeur:2.4,hauteur:2.15,nature:'baie',materiau:'alu',volet:true},
            fen(2,0.857,1.2,1.2),
            porteR(0,0.172), porteR(0,0.411), porteR(0,0.589), porteR(0,0.731), porteR(0,0.888),
          ],
          pieces:[ {x:1.9,y:-2.2,nom:'Chambre parentale'}, {x:5.3,y:-2.2,nom:'Chambre 2'}, {x:8.2,y:-2.2,nom:'Salle de bain'},
            {x:10.1,y:-2.2,nom:'WC'}, {x:12.25,y:-2.2,nom:'Chambre 3'}, {x:5.5,y:-6.6,nom:'Séjour-cuisine'}, {x:12.25,y:-6.6,nom:'Entrée'} ],
        });
        const vs=niveau('Vide sanitaire',1.20,pts,{ refends:R.map(r=>({pts:r.pts.map(p=>({...p}))})),
          ouvertures:[passageVS(3,0.5),{sur:'refend',i:0,seg:1,t:0.5,largeur:0.8,hauteur:0.6,nature:'passage'}] });
        return [vs, rdc];
      }
    },
    'etage': {
      nom:'Maison à étage 4 chambres', desc:'10 × 8,5 m sur deux niveaux · séjour-cuisine, bureau, 4 chambres',
      construire(){
        const pts=[[0,0],[10,0],[10,-8.5],[0,-8.5]];
        const R=()=>[ligne([0.286,-4.2],[9.714,-4.2])];
        const rdc=niveau('RDC',2.70,pts,{ refends:R(),
          cloisons:[3.4,4.6,6.4].map(x=>ligne([x,-0.286],[x,-4.057])),
          ouvertures:[
            {sur:'mur',i:0,t:0.18,largeur:1.0,hauteur:2.15,nature:'porte-entree',materiau:'alu'},
            fen(0,0.4,0.6,0.75,false), fen(0,0.8),
            {sur:'mur',i:2,t:0.6,largeur:2.4,hauteur:2.15,nature:'baie',materiau:'alu',volet:true}, fen(2,0.2,1.2,1.2),
            porteR(0,0.161), porteR(0,0.394), porteR(0,0.553), porteR(0,0.818),
          ],
          pieces:[ {x:1.8,y:-2.2,nom:'Entrée'}, {x:4.0,y:-2.2,nom:'WC'}, {x:5.5,y:-2.2,nom:'Cellier'}, {x:8.0,y:-2.2,nom:'Bureau'}, {x:5,y:-6.3,nom:'Séjour-cuisine'} ],
        });
        const r1=niveau('R+1',2.50,pts,{ refends:R(),
          cloisons:[3.4,5.0,7.0].map(x=>ligne([x,-0.286],[x,-4.057])).concat([ligne([4.2,-4.343],[4.2,-8.214])]),
          ouvertures:[ fen(0,0.18), fen(0,0.6,0.6,0.75,false), fen(0,0.84), fen(2,0.78),
            {sur:'mur',i:2,t:0.3,largeur:0.9,hauteur:2.15,nature:'porte-fenetre',materiau:'pvc',volet:true},
            porteR(0,0.367), porteR(0,0.463) ],
          pieces:[ {x:1.8,y:-2.2,nom:'Chambre 2'}, {x:4.2,y:-2.2,nom:'Dégagement'}, {x:6,y:-2.2,nom:'Salle de bain'}, {x:8.4,y:-2.2,nom:'Chambre 3'},
            {x:2.2,y:-6.3,nom:'Chambre 4'}, {x:7,y:-6.3,nom:'Chambre parentale'} ],
        });
        const vs=niveau('Vide sanitaire',1.20,pts,{ refends:R(), ouvertures:[passageVS(3,0.5),{sur:'refend',i:0,seg:1,t:0.5,largeur:0.8,hauteur:0.6,nature:'passage'}] });
        return [vs, rdc, r1];
      }
    },
    'villa-l': {
      nom:'Villa en L avec garage', desc:'14 × 9 m + garage de 33 m² · 3 chambres dont une suite parentale',
      construire(){
        const pts=[[0,0],[14,0],[14,-15],[7.5,-15],[7.5,-9],[0,-9]];
        const R=()=>[ligne([0.286,-4.5],[13.714,-4.5]), ligne([7.786,-9],[13.714,-9])];
        const rdc=niveau('RDC',2.70,pts,{ refends:R(),
          cloisons:[4.2,6.2,9.6,11.3].map(x=>ligne([x,-0.286],[x,-4.357])).concat([ligne([10.5,-4.643],[10.5,-8.857])]),
          ouvertures:[
            fen(0,0.143,1.2,1.2), fen(0,0.371,0.6,0.75,false), fen(0,0.564), fen(0,0.746,0.6,0.75,false), fen(0,0.893),
            {sur:'mur',i:4,t:0.533,largeur:3.0,hauteur:2.15,nature:'baie',materiau:'alu',volet:true},
            fen(5,0.278,1.2,1.2),
            {sur:'mur',i:2,t:0.5,largeur:2.4,hauteur:2.0,nature:'porte-garage',materiau:'alu'},
            {sur:'mur',i:1,t:0.447,largeur:1.0,hauteur:2.15,nature:'porte-entree',materiau:'alu'},
            porteR(0,0.239), porteR(0,0.612), porteR(0,0.753), porteR(0,0.909), porteR(1,0.711),
          ],
          pieces:[ {x:2.2,y:-2.3,nom:'Chambre parentale'}, {x:5.2,y:-2.3,nom:"Salle d'eau"}, {x:7.9,y:-2.3,nom:'Chambre 2'},
            {x:10.45,y:-2.3,nom:'Salle de bain'}, {x:12.5,y:-2.3,nom:'Chambre 3'}, {x:5,y:-6.7,nom:'Séjour-cuisine'},
            {x:12.1,y:-6.7,nom:'Entrée'}, {x:10.75,y:-12,nom:'Garage'} ],
        });
        const vs=niveau('Vide sanitaire',1.20,pts,{ refends:R(), ouvertures:[passageVS(5,0.5),{sur:'refend',i:0,seg:1,t:0.4,largeur:0.8,hauteur:0.6,nature:'passage'}] });
        return [vs, rdc];
      }
    },
  };

  /* Sous la toiture, les fermettes portent d'un mur exterieur a l'autre : le
     dernier niveau n'a pas de refend, ses murs interieurs sont des cloisons.
     Les refends ne restent que sous un plancher (vide sanitaire, ou niveau
     qui porte un etage). */
  function sousToiture(niv){
    const nR = niv.refends.length; if(!nR) return;
    const ep = horsTout(niv)/2, ec = EP_CLOISON/2;
    const lignes = niv.refends.map(r=>({pts:r.pts.map(p=>({...p}))}));
    // les cloisons qui butaient sur la face d'un refend butent sur la face de la nouvelle cloison
    (niv.cloisons||[]).forEach(c=>c.pts.forEach(p=>{
      lignes.forEach(({pts:[a,b]})=>{
        const L=Math.hypot(b.x-a.x,b.y-a.y), ux=(b.x-a.x)/L, uy=(b.y-a.y)/L;
        const t=(p.x-a.x)*ux+(p.y-a.y)*uy, d=-(p.x-a.x)*uy+(p.y-a.y)*ux;
        if(t>-0.05&&t<L+0.05&&Math.abs(Math.abs(d)-ep)<0.03){
          const s=Math.sign(d); p.x=a.x+ux*t-uy*s*ec; p.y=a.y+uy*t+ux*s*ec;
        }
      });
    }));
    niv.cloisons = lignes.concat(niv.cloisons||[]);
    niv.ouvertures.forEach(o=>{
      if(o.sur==='refend'){ o.sur='cloison'; }
      else if(o.sur==='cloison'){ o.i += nR; }
    });
    niv.refends = [];
  }
  function appliquerToiture(liste){
    liste.forEach((n,k)=>{ if(n.hauteur>=1.8 && !liste.slice(k+1).some(m=>m.murs.length)) sousToiture(n); });
    return liste;
  }

  function chargerModele(cle){
    const m = MODELES[cle]; if(!m) return;
    if(niveaux.some(n=>n.murs.length) && !confirm('Remplacer votre tracé actuel par ce modèle ?')) return;
    niveaux = appliquerToiture(m.construire());
    iNiveau = niveaux.findIndex(n=>n.nom==='RDC'); if(iNiveau<0) iNiveau = 0;
    projet.modele = m.nom;
    const s = SOLUTIONS[projet.solution]; niveaux.forEach(n=>{ if(n.hauteur>=1.8) changerMur(n, s.gamme, s.ep); });
    cadre = null; refEnCours = null; curseur = null;
    fermer(); setMode('piece');
    marquer(2);
  }
  window.chargerModeleMaison = chargerModele;

  /* ---------------- interface ---------------- */
  const css = `
  .pm-barre{display:flex;gap:4px;align-items:stretch;padding:8px 12px;background:#FBF8F1;border-bottom:1px solid var(--trait);overflow-x:auto}
  .pm-barre button{flex:1;min-width:max-content;display:flex;gap:8px;align-items:center;justify-content:center;padding:8px 12px;border-radius:8px;border:1px solid var(--trait);background:#fff;font:500 13px 'IBM Plex Sans',sans-serif;color:var(--encre)}
  .pm-barre button i{font-style:normal;display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#E7E1D3;font-size:12px;font-weight:700}
  .pm-barre button.fait i{background:#3F6B4A;color:#fff}
  .pm-barre button.ici{border-color:#3F6B4A;box-shadow:0 0 0 2px #3F6B4A33}
  .pm-voile{position:fixed;inset:0;z-index:1000;background:rgba(26,25,22,.55);display:flex;align-items:center;justify-content:center;padding:16px}
  .pm-boite{background:#FBF8F1;border-radius:14px;max-width:980px;width:100%;max-height:92vh;overflow:auto;box-shadow:0 20px 60px rgba(0,0,0,.35);position:relative}
  .pm-tete{padding:26px 28px 10px}
  .pm-tete h2{font:600 26px Fraunces,Georgia,serif;margin:0 0 6px}
  .pm-tete p{margin:0;color:var(--beton);font-size:14px;line-height:1.5}
  .pm-fermer{position:absolute;top:12px;right:14px;border:0;background:none;font-size:22px;cursor:pointer;color:var(--beton)}
  .pm-grille{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;padding:16px 28px 26px}
  .pm-carte{background:#fff;border:1px solid var(--trait);border-radius:12px;padding:18px;cursor:pointer;text-align:left;font:inherit;color:inherit;display:flex;flex-direction:column;gap:8px;transition:transform .12s, box-shadow .12s}
  .pm-carte:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.08)}
  .pm-carte.choisie{border-color:#3F6B4A;box-shadow:0 0 0 2px #3F6B4A}
  .pm-carte h3{margin:0;font:600 17px 'IBM Plex Sans',sans-serif}
  .pm-carte .acc{color:#3F6B4A;font-size:13px;font-weight:600}
  .pm-carte p,.pm-carte li{font-size:13px;color:var(--beton);line-height:1.45;margin:0}
  .pm-carte ul{margin:0;padding-left:18px}
  .pm-carte svg{width:100%;height:110px;background:#F4EFE4;border-radius:8px}
  .pm-carte .ico{font-size:30px}
  .pm-section{padding:0 28px 8px}
  .pm-section h4{font:600 14px 'IBM Plex Sans',sans-serif;margin:14px 0 8px}
  .pm-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}
  .pm-opt{display:flex;gap:10px;align-items:flex-start;background:#fff;border:1px solid var(--trait);border-radius:10px;padding:12px;font-size:13px}
  .pm-opt b{display:block;margin-bottom:2px}
  .pm-pied{display:flex;gap:10px;justify-content:space-between;align-items:center;padding:14px 28px 24px;flex-wrap:wrap}
  .pm-pied .note{font-size:11.5px;color:var(--beton);max-width:560px}
  .pm-btn{background:#3F6B4A;border-color:#3F6B4A;color:#fff;font-weight:600;padding:10px 18px;font-size:14px}
  .pm-recap{display:grid;grid-template-columns:1.2fr 1fr;gap:18px;padding:8px 28px 10px}
  @media(max-width:760px){.pm-recap{grid-template-columns:1fr}}
  .pm-bloc{background:#fff;border:1px solid var(--trait);border-radius:12px;padding:16px}
  .pm-bloc h4{margin:0 0 8px;font:600 14px 'IBM Plex Sans',sans-serif}
  .pm-bloc table{width:100%;border-collapse:collapse;font-size:13px}
  .pm-bloc td{padding:4px 0;border-bottom:1px solid #EEE8DA}
  .pm-bloc td.n{text-align:right;font-family:'IBM Plex Mono',monospace}
  .pm-gros{font:600 30px Fraunces,Georgia,serif;color:#2E4F37}
  .pm-pastilles{display:flex;gap:6px;flex-wrap:wrap}
  .pm-pastille{width:30px;height:30px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px var(--trait);cursor:pointer}
  .pm-pastille.choisie{box-shadow:0 0 0 2px #3F6B4A}
  @media(max-width:600px){
    .pm-tete{padding:20px 18px 6px}.pm-tete h2{font-size:21px}
    .pm-grille{padding:12px 16px 18px;gap:10px}.pm-carte{padding:14px}
    .pm-carte .ico{font-size:22px}.pm-carte svg{height:90px}
    .pm-section,.pm-recap,.pm-pied{padding-left:16px;padding-right:16px}
  }
  `;

  let voile = null;
  function boite(html, large){
    fermer();
    voile = document.createElement('div');
    voile.className = 'pm-voile';
    voile.innerHTML = `<div class="pm-boite" ${large?'style="max-width:1100px"':''}><button class="pm-fermer" aria-label="Fermer">×</button>${html}</div>`;
    voile.addEventListener('click', e=>{ if(e.target===voile || e.target.classList.contains('pm-fermer')) fermer(); });
    document.body.appendChild(voile);
    return voile.querySelector('.pm-boite');
  }
  function fermer(){
    const d = document.getElementById('blocDemande');
    if(d && d.dataset.deplace){ document.getElementById('pmPlaceDemande')?.replaceWith(d); delete d.dataset.deplace;
      const intro=d.querySelector('p'); if(intro&&intro.dataset.avant) intro.textContent=intro.dataset.avant; }
    if(voile){ voile.remove(); voile = null; }
  }
  window.fermerParcours = fermer;
  document.addEventListener('keydown', e=>{ if(e.key==='Escape' && voile){ fermer(); e.stopPropagation(); } }, true);

  // apercu d'un modele : son contour, ses refends et ses cloisons
  function vignette(m){
    const nv = appliquerToiture(m.construire()).find(n=>n.nom==='RDC');
    let x=0,y=0; const pts=[{x,y}];
    nv.murs.forEach(w=>{ x+=w.dx*w.longueur; y+=w.dy*w.longueur; pts.push({x,y}); });
    const xs=pts.map(p=>p.x), ys=pts.map(p=>-p.y);
    const minX=Math.min(...xs)-1, minY=Math.min(...ys)-1, w=Math.max(...xs)-minX+1, h=Math.max(...ys)-minY+1;
    let g=`<polygon points="${pts.map(p=>`${p.x},${-p.y}`).join(' ')}" fill="#fff" stroke="#2E2B26" stroke-width="0.3"/>`;
    nv.refends.forEach(r=>g+=`<line x1="${r.pts[0].x}" y1="${-r.pts[0].y}" x2="${r.pts[1].x}" y2="${-r.pts[1].y}" stroke="#2F5D8C" stroke-width="0.25"/>`);
    nv.cloisons.forEach(r=>g+=`<line x1="${r.pts[0].x}" y1="${-r.pts[0].y}" x2="${r.pts[1].x}" y2="${-r.pts[1].y}" stroke="#8A8478" stroke-width="0.1"/>`);
    return `<svg viewBox="${minX} ${minY} ${w} ${h}" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
  }

  function ouvrirDepart(){
    const b = boite(`
      <div class="pm-tete"><h2>Créez votre maison Nudura</h2>
        <p>Dessinez votre future maison, nommez vos pièces, choisissez vos murs et voyez-la en 3D.
           Vous nous l'envoyez ensuite en un clic : nous vous répondons avec une étude personnalisée, sans engagement.</p></div>
      <div class="pm-grille">
        <button class="pm-carte" data-a="modeles"><span class="ico">🏡</span><h3>Partir d'un modèle</h3>
          <p>Trois maisons SCAF prêtes à adapter : plain-pied, étage, villa avec garage.</p></button>
        <button class="pm-carte" data-a="dessiner"><span class="ico">✏️</span><h3>Dessiner mon plan</h3>
          <p>Tapez les longueurs de vos murs ou partez d'un rectangle. Simple et précis.</p></button>
        <button class="pm-carte" data-a="fond"><span class="ico">📐</span><h3>J'ai le plan de mon architecte</h3>
          <p>Chargez le plan (image ou PDF), calez l'échelle et tracez par-dessus.</p></button>
      </div>`);
    b.querySelector('[data-a=modeles]').onclick = ouvrirModeles;
    b.querySelector('[data-a=dessiner]').onclick = ()=>{ fermer(); iNiveau = Math.max(0,niveaux.findIndex(n=>n.nom==='RDC')); setMode('contour'); marquer(2); };
    b.querySelector('[data-a=fond]').onclick = ()=>{ fermer(); iNiveau = Math.max(0,niveaux.findIndex(n=>n.nom==='RDC')); setMode('contour'); marquer(2); ouvrirFond(); };
    marquer(1);
  }
  function ouvrirModeles(){
    const b = boite(`
      <div class="pm-tete"><h2>Choisissez un modèle</h2>
        <p>Un point de départ : vous pourrez tout modifier ensuite — murs, pièces, fenêtres.</p></div>
      <div class="pm-grille">${Object.entries(MODELES).map(([k,m])=>`
        <button class="pm-carte" data-m="${k}">${vignette(m)}<h3>${m.nom}</h3><p>${m.desc}</p></button>`).join('')}
      </div>`);
    b.querySelectorAll('[data-m]').forEach(el=>el.onclick=()=>chargerModele(el.dataset.m));
  }

  function ouvrirSolutions(){
    const b = boite(`
      <div class="pm-tete"><h2>Mes murs Nudura</h2>
        <p>Le bloc coffrant isolant Nudura réunit en un seul mur la structure en béton armé, l'isolation des deux côtés,
           l'étanchéité à l'air et les fixations des finitions. Choisissez le niveau qui vous ressemble.</p></div>
      <div class="pm-grille">${Object.entries(SOLUTIONS).map(([k,s])=>`
        <button class="pm-carte ${projet.solution===k?'choisie':''}" data-s="${k}">
          <h3>${s.nom}</h3><span class="acc">${s.accroche}</span>
          <ul>${s.points.map(p=>`<li>${p}</li>`).join('')}</ul></button>`).join('')}
      </div>
      <div class="pm-section"><h4>Ça m'intéresse aussi</h4>
        <div class="pm-opts">${Object.entries(OPTIONS).map(([k,o])=>`
          <label class="pm-opt"><input type="checkbox" data-o="${k}" ${projet.options.includes(k)?'checked':''}>
            <span><b>${o.nom}</b>${o.txt}</span></label>`).join('')}</div></div>
      <div class="pm-pied">
        <span class="note">* Valeurs du Document Technique d'Application CSTB 16/23-799_V1 (bloc vide, lambda utile réglementaire ;
          acoustique avec plaque de plâtre collée et enduit). Les surfaces de votre plan se recalculent avec l'épaisseur choisie.</span>
        <button class="pm-btn" data-a="suite">Voir ma maison en 3D →</button></div>`);
    b.querySelectorAll('[data-s]').forEach(el=>el.onclick=()=>{
      appliquerSolution(el.dataset.s);
      b.querySelectorAll('[data-s]').forEach(x=>x.classList.toggle('choisie', x===el));
    });
    b.querySelectorAll('[data-o]').forEach(el=>el.onchange=()=>{
      projet.options = [...b.querySelectorAll('[data-o]:checked')].map(x=>x.dataset.o);
    });
    b.querySelector('[data-a=suite]').onclick = ()=>{ fermer(); ouvrir3D(); };
    marquer(3);
  }

  function ouvrir3D(){
    if(!niveaux.some(n=>n.ferme && n.murs.length)){
      alert("Tracez d'abord le contour de votre maison (ou partez d'un modèle).");
      return ouvrirDepart();
    }
    marquer(4);
    if(window.ouvrirMaison3D) window.ouvrirMaison3D();
  }
  window.ouvrirMonProjet = ()=>ouvrirRecap();

  function resume(){
    const s = SOLUTIONS[projet.solution];
    const pal = (t,k)=>t[k]?t[k][0]:k;
    const lignes = [
      `Projet créé avec le parcours « Ma maison Nudura »` + (projet.modele ? ` (modèle : ${projet.modele})` : ''),
      `Solution Nudura : ${s.nom} (${s.gamme==='xr35'?'XR35':'Standard'} voile ${s.ep} mm)`,
      projet.options.length ? `Intéressé par : ${projet.options.map(o=>OPTIONS[o].nom).join(', ')}` : '',
      `Finitions 3D : façade ${pal(FACADES,projet.facade)}, menuiseries ${pal(MENUISERIES,projet.menuiseries)}, tuiles ${pal(TUILES,projet.tuile)}`,
    ];
    niveaux.filter(n=>n.ferme&&n.murs.length&&n.hauteur>=1.8).forEach(n=>{
      const pc = (n.pieces||[]).map(p=>`${p.nom} ${surfacePiece(n,p).toFixed(1)} m²`).join(', ');
      lignes.push(`${n.nom} : ${habitableDe(n).toFixed(1)} m² habitables${pc?` — ${pc}`:''}`);
    });
    return lignes.filter(Boolean).join('\n');
  }
  window.resumeProjetMaison = resume;
  const horsHabitable = nom => /garage|terrasse/i.test(nom);
  function habitableDe(n){
    const ex = (n.pieces||[]).filter(p=>horsHabitable(p.nom)).reduce((t,p)=>t+surfacePiece(n,p),0);
    return Math.max(0, surfaceHabitable(n) - ex);
  }

  function ouvrirRecap(){
    const prets = niveaux.filter(n=>n.ferme && n.murs.length);
    if(!prets.length){ alert("Tracez d'abord votre maison (ou partez d'un modèle)."); return ouvrirDepart(); }
    const s = SOLUTIONS[projet.solution];
    const hab = prets.filter(n=>n.hauteur>=1.8);
    const total = hab.reduce((t,n)=>t+habitableDe(n),0);
    const f = v=>v.toFixed(1).replace('.',',');
    const b = boite(`
      <div class="pm-tete"><h2>Mon projet</h2>
        <p>Vérifiez votre projet, puis envoyez-le : nous vous répondons sous deux jours ouvrés avec une étude personnalisée.</p></div>
      <div class="pm-recap">
        <div style="display:grid;gap:14px">
          <div class="pm-bloc"><h4>Ma maison</h4>
            <div class="pm-gros">${f(total)} m²</div><div style="font-size:12.5px;color:var(--beton);margin-bottom:8px">habitables, mesurés au nu intérieur des murs</div>
            ${hab.map(n=>`<table><tr><td><b>${n.nom}</b></td><td class="n"><b>${f(habitableDe(n))} m²</b></td></tr>
              ${(n.pieces||[]).map(p=>`<tr><td>${p.nom}</td><td class="n">${f(surfacePiece(n,p))} m²</td></tr>`).join('')}</table>`).join('<div style="height:8px"></div>')}
          </div>
          <div class="pm-bloc"><h4>Mes murs Nudura : ${s.nom}</h4>
            <ul style="margin:0;padding-left:18px;font-size:13px;color:var(--beton)">${s.points.map(p=>`<li>${p}</li>`).join('')}</ul>
            ${projet.options.length?`<p style="font-size:13px;margin:8px 0 0">Aussi : ${projet.options.map(o=>OPTIONS[o].nom).join(' · ')}</p>`:''}
            <button style="margin-top:10px" data-a="sol">Changer de solution</button>
          </div>
          <div class="pm-bloc" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="font-size:13px">Façade ${FACADES[projet.facade][0].toLowerCase()} · menuiseries ${MENUISERIES[projet.menuiseries][0].toLowerCase()} · tuiles ${TUILES[projet.tuile][0].toLowerCase()}</span>
            <button data-a="3d">Revoir en 3D</button></div>
        </div>
        <div id="pmPlaceForm"></div>
      </div>
      <div class="pm-pied"><span class="note">Sans engagement. Vos coordonnées servent uniquement à vous répondre.</span></div>`, true);
    // le formulaire de demande du calculateur est deplace ici le temps de l'envoi
    const d = document.getElementById('blocDemande');
    if(d){
      const place = document.createElement('div'); place.id = 'pmPlaceDemande';
      d.replaceWith(place); d.dataset.deplace = '1'; d.hidden = false;
      b.querySelector('#pmPlaceForm').appendChild(d);
      const t = d.querySelector('.panneau-titre'); if(t) t.textContent = 'Recevoir mon étude';
      const intro = d.querySelector('p'); if(intro){ intro.dataset.avant = intro.dataset.avant || intro.textContent; intro.textContent = "Nous étudions votre maison et vous envoyons une proposition personnalisée. Sans engagement."; }
      const be = document.getElementById('bEnvoyer'); if(be && !be.disabled) be.textContent = 'Envoyer mon projet';
    }
    b.querySelector('[data-a=sol]').onclick = ouvrirSolutions;
    b.querySelector('[data-a="3d"]').onclick = ()=>{ fermer(); ouvrir3D(); };
    marquer(5);
  }

  /* ---------------- barre d'etapes ---------------- */
  const ETAPES = [
    ['Départ', ouvrirDepart],
    ['Ma maison', ()=>{ fermer(); if(typeof voirPlan==='function') voirPlan(); setMode(N().ferme?'piece':'contour'); marquer(2); }],
    ['Mes murs Nudura', ouvrirSolutions],
    ['En 3D', ouvrir3D],
    ['Mon projet', ouvrirRecap],
  ];
  let ici = 0; const faites = new Set();
  function marquer(k){ ici = k; for(let i=1;i<k;i++) faites.add(i); majBarre(); }
  function majBarre(){
    const bar = document.getElementById('pmBarre'); if(!bar) return;
    [...bar.children].forEach((el,i)=>{ el.classList.toggle('ici', i+1===ici); el.classList.toggle('fait', faites.has(i+1)); });
  }

  let pret = false;
  function installer(){
    if(pret) return; pret = true;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const bar = document.createElement('nav');
    bar.className = 'pm-barre'; bar.id = 'pmBarre';
    bar.innerHTML = ETAPES.map(([t],i)=>`<button type="button"><i>${i+1}</i>${t}</button>`).join('');
    [...bar.children].forEach((el,i)=>el.onclick = ETAPES[i][1]);
    const vp = document.querySelector('#vue-plan > .panneau');
    if(vp) vp.insertBefore(bar, vp.firstChild);
    // le particulier qui arrive sur une page vide est accueilli
    const q = new URLSearchParams(location.search);
    let deja = false; try{ deja = sessionStorage.getItem('pm_accueil') === '1'; }catch(e){}
    const vide = !niveaux.some(n=>n.murs.length);
    // on attend que le mode (pro ou particulier) soit connu
    setTimeout(()=>{
      if((q.get('parcours') === '1') || (!vuePro() && vide && !deja && q.get('parcours') !== '0')){
        try{ sessionStorage.setItem('pm_accueil','1'); }catch(e){}
        ouvrirDepart();
      }
    }, 700);
  }
  (window.apresRecalcul = window.apresRecalcul || []).push(()=>{ installer(); });
  if(document.readyState === 'complete') installer(); else addEventListener('load', installer);
  window.parcoursMaison = { ouvrirDepart, ouvrirSolutions, ouvrir3D, ouvrirRecap, chargerModele, SOLUTIONS, MODELES, marquer };
})();
