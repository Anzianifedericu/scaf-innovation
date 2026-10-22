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
    const P=sommetsDe(niv);
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

  /* ---------------- catalogue elargi ----------------
     Conventions : contour donne par ses sommets (premier en 0,0, sens horaire),
     mur de 152 mm (nu interieur a 0,286 m), refends seulement sous un plancher
     (vide sanitaire, ou niveau qui porte un etage) ; au dernier niveau les
     refends deviennent des cloisons, sauf un mur separatif de logement. */
  const E = 0.286, D = E/2;
  const F  = (L=1.0,H=1.2,vr=true)=>({largeur:L,hauteur:H,nature:'fenetre',materiau:'pvc',volet:vr});
  const PETITE = ()=>F(0.6,0.75,false);
  const ENTREE = ()=>({largeur:1.0,hauteur:2.15,nature:'porte-entree',materiau:'alu'});
  const BAIE = (L=2.4)=>({largeur:L,hauteur:2.15,nature:'baie',materiau:'alu',volet:true});
  const PF = ()=>({largeur:0.9,hauteur:2.15,nature:'porte-fenetre',materiau:'pvc',volet:true});
  const GARAGE = ()=>({largeur:2.4,hauteur:2.0,nature:'porte-garage',materiau:'alu'});
  const PASSAGE = ()=>({largeur:0.8,hauteur:0.6,nature:'passage'});
  // position le long d'un segment a->b, par la coordonnee qui varie
  const tSur = (a,b,pos)=> Math.abs(b[0]-a[0])>1e-9 ? (pos-a[0])/(b[0]-a[0]) : (pos-a[1])/(b[1]-a[1]);
  const surMur = (pts,i,pos,o)=>({sur:'mur',i,t:tSur(pts[i],pts[(i+1)%pts.length],pos),...o});
  const surLigne = (sur,i,l,pos,o)=>({sur,i,seg:1,t:tSur(l[0],l[1],pos),largeur:0.83,hauteur:2.04,nature:'porte',materiau:'bois',...(o||{})});
  const L2 = l=>({pts:[P(l[0][0],l[0][1]),P(l[1][0],l[1][1])]});
  const mk = (nom,h,pts,o={})=>niveau(nom,h,pts,{...o, refends:(o.refends||[]).map(r=>{ const x=L2(r.l||r); if(r.separatif) x.separatif=true; return x; }), cloisons:(o.cloisons||[]).map(L2)});
  const pc = (x,y,nom)=>({x,y,nom});

  Object.assign(MODELES, {
    /* ---------- petites maisons ---------- */
    'pp2': { cat:'petites', nom:'Plain-pied 2 chambres', desc:'10 × 8 m · environ 70 m² : séjour-cuisine, 2 chambres, salle de bain, WC',
      construire(){
        const pts=[[0,0],[10,0],[10,-8],[0,-8]], ry=-4, R=[[[E,ry],[10-E,ry]]];
        const vs=mk('Vide sanitaire',1.2,pts,{refends:R, ouvertures:[surMur(pts,3,-4,PASSAGE()), surLigne('refend',0,R[0],5,PASSAGE())]});
        const rdc=mk('RDC',2.7,pts,{refends:R,
          cloisons:[3.6,5.6,6.8].map(x=>[[x,-E],[x,ry+D]]),
          ouvertures:[ surMur(pts,0,1.9,F()), surMur(pts,0,4.6,PETITE()), surMur(pts,0,8.2,F()),
            surMur(pts,2,4,BAIE()), surMur(pts,2,8.5,ENTREE()), surMur(pts,2,1.5,F(1.2,1.2)),
            ...[2.4,4.6,6.2,8.0].map(x=>surLigne('refend',0,R[0],x)) ],
          pieces:[pc(1.9,-2,'Chambre parentale'),pc(4.6,-2,'Salle de bain'),pc(6.2,-2,'WC'),pc(8.3,-2,'Chambre 2'),pc(5,-6,'Séjour-cuisine')] });
        return [vs,rdc];
      }},
    'village': { cat:'petites', nom:'Maison de village à étage', desc:'6 × 10 m sur deux niveaux · façades avant et arrière, idéale en centre ancien',
      construire(){
        const pts=[[0,0],[6,0],[6,-10],[0,-10]], ry=-5, R=()=>[[[E,ry],[6-E,ry]]];
        const vs=mk('Vide sanitaire',1.2,pts,{refends:R(), ouvertures:[surMur(pts,3,-2.5,PASSAGE()), surLigne('refend',0,R()[0],3,PASSAGE())]});
        const rdc=mk('RDC',2.7,pts,{refends:R(),
          cloisons:[[[2.4,-E],[2.4,ry+D]]],
          ouvertures:[ surMur(pts,2,1.4,ENTREE()), surMur(pts,2,4.0,F(1.2,1.4)), surMur(pts,0,4.0,F()),
            surLigne('refend',0,R()[0],1.4), surLigne('refend',0,R()[0],4.0) ],
          pieces:[pc(1.3,-2.5,'Entrée'),pc(4,-2.5,'Cuisine'),pc(3,-7.5,'Séjour')] });
        const r1=mk('R+1',2.5,pts,{refends:R(),
          cloisons:[[[3.4,-E],[3.4,ry+D]],[[3.4,ry-D],[3.4,-10+E]]],
          ouvertures:[ surMur(pts,0,1.8,F()), surMur(pts,0,4.6,PETITE()), surMur(pts,2,1.8,F()), surMur(pts,2,4.5,F()),
            surLigne('refend',0,R()[0],4.6) ],
          pieces:[pc(1.8,-2.5,'Chambre 1'),pc(4.6,-2.5,'Salle de bain'),pc(1.8,-7.5,'Chambre 2'),pc(4.6,-7.5,'Bureau')] });
        return [vs,rdc,r1];
      }},
    'studio': { cat:'petites', nom:'Studio ou annexe', desc:'7 × 5,5 m · environ 30 m² : pièce de vie et salle d\'eau, pour un jardin ou un locatif',
      construire(){
        const pts=[[0,0],[7,0],[7,-5.5],[0,-5.5]];
        const vs=mk('Vide sanitaire',1.2,pts,{ouvertures:[surMur(pts,3,-2.75,PASSAGE())]});
        const rdc=mk('RDC',2.6,pts,{
          cloisons:[[[5,-E],[5,-2.4]],[[5,-2.4],[7-E,-2.4]]],
          ouvertures:[ surMur(pts,2,2.5,PF()), surMur(pts,2,4.6,F()), surMur(pts,0,6,PETITE()), surMur(pts,3,-2.75,ENTREE()) ],
          pieces:[pc(2.5,-2.7,'Pièce de vie'),pc(5.9,-1.3,"Salle d'eau")] });
        rdc.ouvertures.push({sur:'cloison',i:1,seg:1,t:0.5,largeur:0.73,hauteur:2.04,nature:'porte',materiau:'bois'});
        return [vs,rdc];
      }},

    /* ---------- grandes villas ---------- */
    'villa4': { cat:'villas', nom:'Villa plain-pied 4 chambres', desc:'17 × 9,5 m · environ 140 m² : grand séjour, 4 chambres dont une suite, 2 salles d\'eau',
      construire(){
        const W=17, pts=[[0,0],[W,0],[W,-9.5],[0,-9.5]], ry=-4.6, R=[[[E,ry],[W-E,ry]]];
        const vs=mk('Vide sanitaire',1.2,pts,{refends:R, ouvertures:[surMur(pts,3,-4.75,PASSAGE()), surLigne('refend',0,R[0],8.5,PASSAGE())]});
        const rdc=mk('RDC',2.7,pts,{refends:R,
          cloisons:[4.2,6.0,9.0,11.0,13.9].map(x=>[[x,-E],[x,ry+D]]).concat([[[11.8,ry-D],[11.8,-9.5+E]],[[15.4,-6.9],[15.4,-9.5+E]],[[15.4,-6.9],[W-E,-6.9]]]),
          ouvertures:[ surMur(pts,0,2.2,F(1.2,1.2)), surMur(pts,0,5.1,PETITE()), surMur(pts,0,7.5,F()), surMur(pts,0,10,PETITE()), surMur(pts,0,12.45,F()), surMur(pts,0,15.3,F()),
            surMur(pts,2,4,BAIE()), surMur(pts,2,8,BAIE(3.0)), surMur(pts,2,11,F(1.2,1.2)), surMur(pts,2,13.5,ENTREE()), surMur(pts,3,-7,F(1.2,1.2)),
            ...[2.2,5.1,7.5,10.0,12.6,15.0].map(x=>surLigne('refend',0,R[0],x)),
            {sur:'cloison',i:7,seg:1,t:0.5,largeur:0.73,hauteur:2.04,nature:'porte',materiau:'bois'} ],
          pieces:[pc(2.2,-2.4,'Chambre parentale'),pc(5.1,-2.4,"Salle d'eau"),pc(7.5,-2.4,'Chambre 2'),pc(10,-2.4,'Salle de bain'),
            pc(12.45,-2.4,'Chambre 3'),pc(15.3,-2.4,'Chambre 4'),pc(6,-7,'Séjour-cuisine'),pc(13.6,-6,'Entrée'),pc(16.05,-8.2,'WC')] });
        return [vs,rdc];
      }},
    'villa-u': { cat:'villas', nom:'Villa en U avec patio', desc:'16 × 14 m · séjour ouvert sur un patio, 2 ailes : suite parentale et chambres',
      construire(){
        const pts=[[0,0],[16,0],[16,-14],[10.5,-14],[10.5,-6],[5.5,-6],[5.5,-14],[0,-14]];
        const vs=mk('Vide sanitaire',1.2,pts,{refends:[[[5.5,-E],[5.5,-6+E]],[[10.5,-E],[10.5,-6+E]]], ouvertures:[surMur(pts,7,-10,PASSAGE()), surMur(pts,1,-10,PASSAGE())]});
        const C=[ [[4.0,-E],[4.0,-6]], [[12.0,-E],[12.0,-6]], [[E,-6],[5.5-E,-6]], [[10.5+E,-6],[16-E,-6]], [[E,-10.2],[5.5-E,-10.2]], [[10.5+E,-10.2],[16-E,-10.2]] ];
        const rdc=mk('RDC',2.7,pts,{
          cloisons:C,
          ouvertures:[ surMur(pts,0,8,ENTREE()), surMur(pts,0,2.1,F()), surMur(pts,0,13.9,F()),
            surMur(pts,4,8,BAIE(3.0)), surMur(pts,3,-8,PF()), surMur(pts,5,-8,PF()),
            surMur(pts,1,-12,PETITE()), surMur(pts,1,-8,F()), surMur(pts,7,-8,F()), surMur(pts,7,-12,PETITE()),
            surLigne('cloison',0,C[0],-3), surLigne('cloison',1,C[1],-3), surLigne('cloison',2,C[2],4.6), surLigne('cloison',3,C[3],11.4),
            surLigne('cloison',4,C[4],2.75), surLigne('cloison',5,C[5],13.25) ],
          pieces:[pc(2.1,-3,'Chambre 3'),pc(8,-3,'Séjour-cuisine'),pc(13.9,-3,'Bureau'),pc(2.75,-8,'Chambre 2'),pc(2.75,-12,"Salle d'eau"),
            pc(13.25,-8,'Suite parentale'),pc(13.25,-12,'Salle de bain')] });
        return [vs,rdc];
      }},
    'villa-etage': { cat:'villas', nom:'Villa à étage avec suite', desc:'12 × 9 m sur deux niveaux · chambre au rez-de-chaussée, suite parentale à l\'étage',
      construire(){
        const pts=[[0,0],[12,0],[12,-9],[0,-9]], ry=-4.5, R=()=>[[[E,ry],[12-E,ry]]];
        const vs=mk('Vide sanitaire',1.2,pts,{refends:R(), ouvertures:[surMur(pts,3,-4.5,PASSAGE()), surLigne('refend',0,R()[0],6,PASSAGE())]});
        const rdc=mk('RDC',2.7,pts,{refends:R(),
          cloisons:[3.5,4.7,6.6].map(x=>[[x,-E],[x,ry+D]]),
          ouvertures:[ surMur(pts,0,1.9,ENTREE()), surMur(pts,0,4.1,PETITE()), surMur(pts,0,9.2,F()),
            surMur(pts,2,3,BAIE(3.0)), surMur(pts,2,8,BAIE()), surMur(pts,3,-6.5,F(1.2,1.2)),
            ...[1.9,4.1,5.6,9.2].map(x=>surLigne('refend',0,R()[0],x)) ],
          pieces:[pc(1.9,-2.3,'Entrée'),pc(4.1,-2.3,'WC'),pc(5.65,-2.3,'Buanderie'),pc(9.2,-2.3,'Chambre 4'),pc(6,-6.7,'Séjour-cuisine')] });
        const r1=mk('R+1',2.5,pts,{refends:R(),
          cloisons:[2.4,5.6,7.6].map(x=>[[x,-E],[x,ry+D]]).concat([7.0,8.8].map(x=>[[x,ry-D],[x,-9+E]])),
          ouvertures:[ surMur(pts,0,4,F()), surMur(pts,0,6.6,PETITE()), surMur(pts,0,9.7,F()),
            surMur(pts,2,3.5,PF()), surMur(pts,2,10.3,PETITE()), surMur(pts,1,-6.7,F()),
            surLigne('refend',0,R()[0],1.3), surLigne('cloison',0,[[2.4,-E],[2.4,ry+D]],-2.4), surLigne('refend',0,R()[0],6.6) ],
          pieces:[pc(1.3,-2.3,'Dégagement'),pc(4,-2.3,'Chambre 2'),pc(6.6,-2.3,'Salle de bain'),pc(9.7,-2.3,'Chambre 3'),
            pc(3.6,-6.7,'Suite parentale'),pc(7.9,-6.7,'Dressing'),pc(10.4,-6.7,"Salle d'eau")] });
        return [vs,rdc,r1];
      }},

    /* ---------- terrain en pente ---------- */
    'pente': { cat:'pente', nom:'Maison sur terrain en pente', desc:'12 × 9 m · garage et cave semi-enterrés, maison de plain-pied au-dessus côté route',
      construire(){
        const pts=[[0,0],[12,0],[12,-9],[0,-9]], rx=6, R=()=>[[[rx,-E],[rx,-9+E]]];
        const ss=mk('Garage et cave',2.5,pts,{refends:R(),
          cloisons:[[[rx+D,-4.5],[12-E,-4.5]]],
          ouvertures:[ surMur(pts,2,3.2,GARAGE()), surMur(pts,1,-2.3,PETITE()), surLigne('refend',0,R()[0],-6.7), surLigne('cloison',0,[[rx+D,-4.5],[12-E,-4.5]],9) ],
          pieces:[pc(3,-4.5,'Garage'),pc(9,-2.4,'Cave'),pc(9,-6.7,'Buanderie')] });
        ss.enterre = true;
        const rdc=mk('RDC',2.7,pts,{refends:R(),
          cloisons:[-3.5,-5.5].map(y=>[[rx+D,y],[12-E,y]]),
          ouvertures:[ surMur(pts,0,3,ENTREE()), surMur(pts,2,3,BAIE(3.0)), surMur(pts,3,-2,F(1.2,1.2)), surMur(pts,0,9,F()), surMur(pts,2,9,F()), surMur(pts,1,-4.5,PETITE()),
            ...[-1.9,-4.5,-7.1].map(y=>surLigne('refend',0,R()[0],y)) ],
          pieces:[pc(3,-4.5,'Séjour-cuisine'),pc(9,-1.9,'Chambre 1'),pc(9,-4.5,'Salle de bain'),pc(9,-7.1,'Chambre 2')] });
        return [ss,rdc];
      }},

    /* ---------- locatif et bi-famille ---------- */
    'maison-t2': { cat:'locatif', nom:'Maison + T2 indépendant', desc:'16 × 9 m · maison 2 chambres et T2 locatif séparés par un mur séparatif',
      construire(){
        const pts=[[0,0],[16,0],[16,-9],[0,-9]], ry=-4.5, sep={l:[[10,-E],[10,-9+E]],separatif:true};
        const lm=[[E,ry],[10-D,ry]], lt=[[10+D,ry],[16-E,ry]];
        const vs=mk('Vide sanitaire',1.2,pts,{refends:[sep,lm,lt], ouvertures:[surMur(pts,3,-4.5,PASSAGE()), surLigne('refend',0,sep.l,-2.3,PASSAGE()), surLigne('refend',1,lm,5,PASSAGE())]});
        const rdc=mk('RDC',2.7,pts,{refends:[sep,lm],
          cloisons:[ [[3.6,-E],[3.6,ry+D]], [[5.6,-E],[5.6,ry+D]], lt, [[13.2,-E],[13.2,ry+D]] ],
          ouvertures:[ surMur(pts,0,1.9,F()), surMur(pts,0,4.6,PETITE()), surMur(pts,0,7.8,F()), surMur(pts,2,3,BAIE()), surMur(pts,2,7.5,ENTREE()),
            surMur(pts,0,11.6,F()), surMur(pts,0,14.5,PETITE()), surMur(pts,2,12,PF()), surMur(pts,2,14.6,ENTREE()),
            surLigne('refend',1,lm,1.9), surLigne('refend',1,lm,4.6), surLigne('refend',1,lm,7.8),
            surLigne('cloison',2,lt,11.6), surLigne('cloison',2,lt,14.5) ],
          pieces:[pc(1.9,-2.3,'Chambre 1'),pc(4.6,-2.3,'Salle de bain'),pc(7.8,-2.3,'Chambre 2'),pc(5,-6.7,'Séjour-cuisine'),
            pc(11.6,-2.3,'T2 · Chambre'),pc(14.5,-2.3,"T2 · Salle d'eau"),pc(13,-6.7,'T2 · Séjour')] });
        return [vs,rdc];
      }},
    'jumelees': { cat:'locatif', nom:'Maisons jumelées', desc:'2 × 7 × 9 m · deux maisons de 2 chambres côte à côte, mur séparatif commun',
      construire(){
        const pts=[[0,0],[14,0],[14,-9],[0,-9]], ry=-4.5, sep={l:[[7,-E],[7,-9+E]],separatif:true};
        const la=[[E,ry],[7-D,ry]], lb=[[7+D,ry],[14-E,ry]];
        const vs=mk('Vide sanitaire',1.2,pts,{refends:[sep,la,lb], ouvertures:[surMur(pts,3,-4.5,PASSAGE()), surMur(pts,1,-4.5,PASSAGE())]});
        const rdc=mk('RDC',2.7,pts,{refends:[sep,la,lb],
          cloisons:[2.9,4.4,9.6,11.1].map(x=>[[x,-E],[x,ry+D]]),
          ouvertures:[ surMur(pts,0,1.6,F()), surMur(pts,0,3.65,PETITE()), surMur(pts,0,5.7,F()), surMur(pts,2,2.3,BAIE()), surMur(pts,2,5.6,ENTREE()),
            surMur(pts,0,8.3,F()), surMur(pts,0,10.35,PETITE()), surMur(pts,0,12.4,F()), surMur(pts,2,11.7,BAIE()), surMur(pts,2,8.4,ENTREE()),
            ...[1.6,3.65,5.7].map(x=>surLigne('refend',1,la,x)), ...[8.3,10.35,12.4].map(x=>surLigne('refend',2,lb,x)) ],
          pieces:[pc(1.6,-2.3,'A · Chambre 1'),pc(3.65,-2.3,'A · SdB'),pc(5.7,-2.3,'A · Chambre 2'),pc(3.5,-6.7,'A · Séjour-cuisine'),
            pc(8.3,-2.3,'B · Chambre 2'),pc(10.35,-2.3,'B · SdB'),pc(12.4,-2.3,'B · Chambre 1'),pc(10.5,-6.7,'B · Séjour-cuisine')] });
        return [vs,rdc];
      }},
    'collectif': { cat:'locatif', nom:'Petit collectif R+1', desc:'12 × 9 m · deux T3 superposés, un par niveau',
      construire(){
        const pts=[[0,0],[12,0],[12,-9],[0,-9]], ry=-4.5, R=()=>[[[E,ry],[12-E,ry]]];
        const plan=(nom,h,suffixe,entree)=>mk(nom,h,pts,{refends:R(),
          cloisons:[3.8,5.8,8.6].map(x=>[[x,-E],[x,ry+D]]),
          ouvertures:[ surMur(pts,0,2,F()), surMur(pts,0,4.8,PETITE()), surMur(pts,0,7.2,F()), surMur(pts,2,3,BAIE()), surMur(pts,2,8,F(1.2,1.2)),
            ...(entree?[surMur(pts,1,-2.3,ENTREE())]:[surMur(pts,1,-2.3,PETITE())]),
            ...[2.0,4.8,7.2,10.1].map(x=>surLigne('refend',0,R()[0],x)) ],
          pieces:[pc(2,-2.3,`${suffixe} · Chambre 1`),pc(4.8,-2.3,`${suffixe} · SdB`),pc(7.2,-2.3,`${suffixe} · Chambre 2`),pc(10.1,-2.3,`${suffixe} · Entrée`),pc(6,-6.7,`${suffixe} · Séjour-cuisine`)] });
        const vs=mk('Vide sanitaire',1.2,pts,{refends:R(), ouvertures:[surMur(pts,3,-4.5,PASSAGE()), surLigne('refend',0,R()[0],6,PASSAGE())]});
        return [vs, plan('RDC',2.7,'T3 RDC',true), plan('R+1',2.5,'T3 étage',false)];
      }},
  });
  MODELES['plain-pied'].cat = 'villas'; MODELES['etage'].cat = 'villas'; MODELES['villa-l'].cat = 'villas';
  const CATEGORIES = { petites:'Petites maisons', villas:'Maisons et villas', pente:'Terrain en pente', locatif:'Locatif et bi-famille' };

  /* Sous la toiture, les fermettes portent d'un mur exterieur a l'autre : le
     dernier niveau n'a pas de refend, ses murs interieurs sont des cloisons.
     Les refends ne restent que sous un plancher (vide sanitaire, ou niveau
     qui porte un etage). */
  function sousToiture(niv){
    const garde = niv.refends.filter(r=>r.separatif), conv = niv.refends.filter(r=>!r.separatif);
    if(!conv.length) return;
    const ep = horsTout(niv)/2, ec = EP_CLOISON/2;
    const lignes = conv.map(r=>({pts:r.pts.map(p=>({...p}))}));
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
    // renumerotation : refend garde -> nouvel indice de refend, refend converti -> indice de cloison
    const vers = niv.refends.map(r=> r.separatif ? {sur:'refend', i:garde.indexOf(r)} : {sur:'cloison', i:conv.indexOf(r)});
    niv.ouvertures.forEach(o=>{
      if(o.sur==='refend'){ const v=vers[o.i]; o.sur=v.sur; o.i=v.i; }
      else if(o.sur==='cloison'){ o.i += conv.length; }
    });
    niv.cloisons = lignes.concat(niv.cloisons||[]);
    niv.refends = garde;
  }
  function appliquerToiture(liste){
    liste.forEach((n,k)=>{ if(n.hauteur>=1.8 && !liste.slice(k+1).some(m=>m.murs.length)) sousToiture(n); });
    return liste;
  }

  function chargerModele(cle){
    const m = MODELES[cle]; if(!m) return;
    if(niveaux.some(n=>n.murs.length) && !confirm('Remplacer votre tracé actuel par ce modèle ?')) return;
    niveaux = appliquerToiture(m.construire());
    iNiveau = niveaux.findIndex(n=>n.nom==='RDC'); if(iNiveau<0) iNiveau = Math.max(0, niveaux.length-1);
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
    const lv = appliquerToiture(m.construire()), nv = lv.find(n=>n.nom==='RDC') || lv.filter(n=>n.hauteur>=1.8).pop();
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
          <p>Une douzaine de maisons prêtes à adapter : petites maisons, villas, terrain en pente, locatif.</p></button>
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
      ${Object.entries(CATEGORIES).map(([c,titre])=>`
        <div class="pm-section"><h4 style="margin-top:6px">${titre}</h4></div>
        <div class="pm-grille" style="padding-top:4px">${Object.entries(MODELES).filter(([,m])=>m.cat===c).map(([k,m])=>`
          <button class="pm-carte" data-m="${k}">${vignette(m)}<h3>${m.nom}</h3><p>${m.desc}</p></button>`).join('')}
        </div>`).join('')}`, true);
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
      (n.terrasses||[]).forEach(t=>lignes.push(`${n.nom} : terrasse${t.couverte?' couverte':''} ${(t.x1-t.x0).toFixed(2)} × ${(t.y1-t.y0).toFixed(2)} m = ${surfaceTerrasse(t).toFixed(1)} m²`));
      if(window.texteToiture && n===niveaux[niveaux.length-1]){ const tt=texteToiture(); if(tt) lignes.push(tt); }
      if((n.mursLibres||[]).length) lignes.push(`${n.nom} : ${n.mursLibres.length} mur(s) libre(s), ${n.mursLibres.reduce((t,r)=>t+longueurPoly(r.pts),0).toFixed(2)} m`);
    });
    if(window.textePlanchersEscaliers) lignes.push(...textePlanchersEscaliers());
    return lignes.filter(Boolean).join('\n');
  }
  window.resumeProjetMaison = resume;
  const horsHabitable = nom => /garage|terrasse|cave/i.test(nom);
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
