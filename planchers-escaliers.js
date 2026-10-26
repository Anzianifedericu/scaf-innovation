/* Planchers libres et escaliers du traceur, et saisie a la souris des objets.
   - Planchers : zones rectangulaires posees ou l'on veut (dans la maison ou
     dehors) : plancher sur vide sanitaire, plancher d'etage, plancher
     terrasse, balcon en porte-a-faux, dalle pleine. Chaque zone a son sens de
     poutrelles et sa hauteur (au sol ou en haut du niveau) ; la portee est
     controlee.
   - Escaliers : droit, quart tournant, deux quarts tournants (U),
     helicoidal ; les marches sont calculees sur la hauteur d'etage et la
     tremie apparait au niveau du dessus.
   - Souris : un objet sous la souris se saisit et se glisse directement,
     dans l'outil Selection comme dans l'outil qui l'a cree. */
(function(){
  'use strict';
  const f2 = v => (Math.round(v*100)/100).toFixed(2).replace('.',',');
  const f1 = v => v.toFixed(1).replace('.',',');

  const TYPES_PL = {
    vs:       { l:'Plancher sur vide sanitaire', c:'Isoltop / poutrelles-hourdis', coul:'#4F7A45', limite:6.5, alt:'haut', poutrelles:true },
    etage:    { l:"Plancher d'étage",            c:'poutrelles-hourdis',           coul:'#2F6690', limite:6.5, alt:'haut', poutrelles:true },
    terrasse: { l:'Plancher terrasse',           c:'dalle extérieure',             coul:'#9A7A3C', limite:6.5, alt:'bas',  poutrelles:true },
    balcon:   { l:'Balcon (porte-à-faux)',       c:'dalle en console',             coul:'#8E3F74', limite:1.8, alt:'haut', poutrelles:false },
    dalle:    { l:'Dalle pleine béton',          c:'coulée en place',              coul:'#6B655A', limite:5.0, alt:'haut', poutrelles:false },
    aircrab:  { l:'Plancher Air-Crab (vide sanitaire ventilé)', c:'coffrage perdu Air-Crab, coulé sur le sol', coul:'#2E7D7A', limite:999, alt:'bas', poutrelles:false, aircrab:true },
  };
  /* Air-Crab : hauteurs de vide d'air disponibles (table aircrab_parametres,
     seule source des quantites, cote serveur). Le Mini se vend au m2. */
  const HAUTEURS_AC = { aircrab:[5,10,15,20,25,30], mini:[5,7.5,10,12.5] };
  const SYS_AC = { aircrab:'Air-Crab (cupola + pieds)', mini:'Mini Air-Crab' };
  const acChoisi = { sys:'aircrab', h:10 };
  const avecAC = (z,t)=>{ if(TYPES_PL[t]&&TYPES_PL[t].aircrab){ z.acSys=z.acSys||acChoisi.sys; if(!HAUTEURS_AC[z.acSys].includes(z.acH)) z.acH=HAUTEURS_AC[z.acSys].includes(acChoisi.h)?acChoisi.h:HAUTEURS_AC[z.acSys][0]; } return z; };
  const fh = v => String(v).replace('.',',');
  /* Zones Air-Crab d'un niveau, au format attendu par estimer-nudura. */
  window.aircrabDe = niv => (niv.planchers||[]).filter(z=>z.type==='aircrab').map((z,i)=>({
    nom:'Air-Crab '+(i+1), systeme:z.acSys||'aircrab', hauteur_cm:z.acH||10,
    surface_m2:+(Math.abs(z.x1-z.x0)*Math.abs(z.y1-z.y0)).toFixed(2) }));
  const TYPES_ESC = {
    droit:  { l:'Escalier droit' },
    quart:  { l:'Escalier quart tournant' },
    demi:   { l:'Escalier deux quarts tournants (U)' },
    helico: { l:'Escalier hélicoïdal' },
  };
  window.TYPES_PLANCHER = TYPES_PL; window.TYPES_ESCALIER = TYPES_ESC;
  window.plTypeChoisi = 'etage'; window.escTypeChoisi = 'droit';

  const planchersDe = (niv=N()) => niv.planchers || (niv.planchers=[]);
  const escaliersDe = (niv=N()) => niv.escaliers || (niv.escaliers=[]);
  window.planchersDe = planchersDe; window.escaliersDe = escaliersDe;

  let plA = null;          // premier coin d'un plancher en cours
  let plSel = null, escSel = null;
  let tire = null;         // glissement en cours
  let survolPt = null;     // point survole (apercu)
  window.viderSelPlEsc = ()=>{ plSel=null; escSel=null; plA=null; };

  /* ---------------- geometrie ---------------- */
  const dansPoly = (P,x,y)=>{ let c=false; for(let i=0,j=P.length-1;i<P.length;j=i++){ const a=P[i],b=P[j]; if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) c=!c; } return c; };
  const contour = niv => niv.ferme ? sommetsDe(niv).slice(0,-1) : [];
  const indexNiv = niv => niveaux.indexOf(niv);
  const dessusDe = niv => { const i=indexNiv(niv); return i>=0&&i<niveaux.length-1 ? niveaux[i+1] : null; };
  const dessousDe = niv => { const i=indexNiv(niv); return i>0 ? niveaux[i-1] : null; };

  /* Portee libre dans la zone : les poutrelles s'appuient sur les bords de
     la zone et sur les murs porteurs (contour et refends) qui la traversent. */
  function porteeLibre(z, sens, niv){
    const alt=z.alt||(TYPES_PL[z.type]||TYPES_PL.etage).alt;
    const nv = niv ? (alt==='bas' ? (dessousDe(niv)||niv) : niv) : null;
    const segs=[];
    if(nv){
      const P=contour(nv); for(let i=0;i<P.length;i++) segs.push([P[i],P[(i+1)%P.length]]);
      (nv.refends||[]).forEach(r=>{ for(let k=1;k<r.pts.length;k++) segs.push([r.pts[k-1],r.pts[k]]); });
    }
    const X = sens==='x', a0=X?z.x0:z.y0, a1=X?z.x1:z.y1, c0=X?z.y0:z.x0, c1=X?z.y1:z.x1;
    let pire=0;
    for(let j=1;j<=7;j++){
      const c=c0+(c1-c0)*j/8, us=[a0,a1];
      segs.forEach(([p,q])=>{
        const pu=X?p.x:p.y, qu=X?q.x:q.y, pc=X?p.y:p.x, qc=X?q.y:q.x;
        if(Math.abs(qu-pu)>Math.abs(qc-pc)) return;          // mur parallele aux poutrelles
        if(c<Math.min(pc,qc)-1e-6||c>Math.max(pc,qc)+1e-6||Math.abs(qc-pc)<1e-6) return;
        const u=pu+(qu-pu)*(c-pc)/(qc-pc);
        if(u>a0+0.05&&u<a1-0.05) us.push(u);
      });
      us.sort((p,q)=>p-q);
      for(let k=1;k<us.length;k++) pire=Math.max(pire, us[k]-us[k-1]);
    }
    return pire;
  }
  function mesurePl(z, niv){
    const W=z.x1-z.x0, D=z.y1-z.y0, t=TYPES_PL[z.type]||TYPES_PL.etage;
    if(niv===undefined) niv=(niveaux.find(n=>(n.planchers||[]).includes(z)))||null;
    // sens des poutrelles : x = elles vont de gauche a droite ; en auto, le sens de plus petite portee
    const px=t.poutrelles?porteeLibre(z,'x',niv):W, py=t.poutrelles?porteeLibre(z,'y',niv):D;
    const sens = z.sens==='x'||z.sens==='y' ? z.sens : (px<=py ? 'x' : 'y');
    const portee = t.poutrelles ? (sens==='x'?px:py) : Math.min(W,D);
    const travers = sens==='x'?D:W;
    const n = t.poutrelles ? Math.max(1, Math.round(travers/0.60)) : 0;
    let alerte = '';
    if(z.type==='balcon'){ if(portee>t.limite) alerte=`porte-à-faux ${f2(portee)} m : au-delà de ${f2(t.limite)} m, poteaux ou étude BET`; }
    else if(portee>t.limite) alerte=`portée ${f2(portee)} m : au-delà de ${f2(t.limite)} m, prévoir un mur porteur ou une poutre`;
    return { W, D, surface:W*D, sens, portee, n, alerte };
  }
  window.mesurePlancher = mesurePl;

  // hauteur a franchir : etage plus epaisseur du plancher
  function marchesDe(niv){
    const H = (niv.hauteur||2.5) + 0.22;
    const n = Math.max(3, Math.ceil(H/0.185));
    const hm = H/n;
    const g = Math.max(0.22, Math.min(0.30, 0.63-2*hm));   // loi de Blondel
    return { H, n, hm, g };
  }
  // marches en coordonnees locales (montee vers +y), centrees sur l'emprise
  function geoEsc(e, niv){
    const {n,hm,g} = marchesDe(niv), L=e.larg||0.9, s=e.cote==='g'?-1:1;
    const nt = n-1;          // la derniere marche est le plancher du dessus
    let marches = [];        // {poly:[{x,y}], k}
    const rect=(x0,y0,x1,y1)=>[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}];
    if(e.type==='quart'){
      const n1 = Math.max(1, Math.round((nt-1)*0.6)), n2 = Math.max(0, nt-1-n1);
      for(let i=0;i<n1;i++) marches.push(rect(0,i*g,L,(i+1)*g));
      marches.push(rect(0,n1*g,L,n1*g+L));                       // palier d'angle
      for(let i=0;i<n2;i++) marches.push(rect(L+i*g,n1*g,L+(i+1)*g,n1*g+L));
    } else if(e.type==='demi'){
      const n1 = Math.max(1, Math.ceil((nt-1)/2)), n2 = Math.max(0, nt-1-n1), jour=0.10;
      for(let i=0;i<n1;i++) marches.push(rect(0,i*g,L,(i+1)*g));
      const yP=n1*g;
      marches.push(rect(0,yP,2*L+jour,yP+L));
      for(let i=0;i<n2;i++) marches.push(rect(L+jour,yP-(i+1)*g,2*L+jour,yP-i*g));
    } else if(e.type==='helico'){
      const R = Math.max(0.8, L+0.12), r0=0.10, pas = Math.min(Math.PI/6, (Math.PI*2*0.95)/nt);
      for(let i=0;i<nt;i++){
        const a0=-Math.PI/2+i*pas, a1=a0+pas, P=[];
        P.push({x:R+r0*Math.cos(a0), y:R+r0*Math.sin(a0)});
        for(let k=0;k<=4;k++){ const a=a0+(a1-a0)*k/4; P.push({x:R+R*Math.cos(a), y:R+R*Math.sin(a)}); }
        P.push({x:R+r0*Math.cos(a1), y:R+r0*Math.sin(a1)});
        marches.push(P);
      }
    } else {
      for(let i=0;i<nt;i++) marches.push(rect(0,i*g,L,(i+1)*g));
    }
    // miroir pour un tournant a gauche
    if(s<0) marches = marches.map(P=>P.map(p=>({x:-p.x,y:p.y})).reverse());
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
    marches.forEach(P=>P.forEach(p=>{ x0=Math.min(x0,p.x); x1=Math.max(x1,p.x); y0=Math.min(y0,p.y); y1=Math.max(y1,p.y); }));
    if(e.type==='helico'){ const R=Math.max(0.8,(e.larg||0.9)+0.12); x0=s<0?-2*R:0; x1=s<0?0:2*R; y0=0; y1=2*R; }
    const cx=(x0+x1)/2, cy=(y0+y1)/2, a=(e.rot||0)*Math.PI/180, co=Math.cos(a), si=Math.sin(a);
    const T = p=>{ const x=p.x-cx, y=p.y-cy; return { x:e.x+x*co-y*si, y:e.y+x*si+y*co }; };
    const emprise = [{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}].map(T);
    return { marches: marches.map(P=>P.map(T)), emprise, n, hm, g, nt,
             centre: e.type==='helico' ? T({x:s<0?-Math.max(0.8,(e.larg||0.9)+0.12):Math.max(0.8,(e.larg||0.9)+0.12), y:Math.max(0.8,(e.larg||0.9)+0.12)}) : null };
  }
  window.geoEscalier = geoEsc;

  const centreDe = P => P.reduce((m,p)=>({x:m.x+p.x/P.length, y:m.y+p.y/P.length}),{x:0,y:0});
  function escSous(p, niv=N()){
    const es=escaliersDe(niv);
    for(let i=es.length-1;i>=0;i--){ if(dansPoly(geoEsc(es[i],niv).emprise,p.x,p.y)) return i; }
    return null;
  }
  function plSous(p, niv=N()){
    const ps=planchersDe(niv);
    // la plus petite zone d'abord : un balcon pose sur un grand plancher reste saisissable
    let best=null, aire=Infinity;
    ps.forEach((z,i)=>{ if(p.x>=z.x0&&p.x<=z.x1&&p.y>=z.y0&&p.y<=z.y1){ const s=(z.x1-z.x0)*(z.y1-z.y0); if(s<aire){aire=s;best=i;} } });
    return best;
  }

  /* Plancher sur tout le niveau : le contour est decoupe en rectangles. */
  function rectanglesContour(niv){
    const P=contour(niv); if(P.length<3) return [];
    const xs=[...new Set(P.map(p=>+p.x.toFixed(3)))].sort((a,b)=>a-b), ys=[...new Set(P.map(p=>+p.y.toFixed(3)))].sort((a,b)=>a-b);
    const ortho = P.every((p,i)=>{ const q=P[(i+1)%P.length]; return Math.abs(p.x-q.x)<1e-3||Math.abs(p.y-q.y)<1e-3; });
    if(!ortho){ return [{x0:xs[0],y0:ys[0],x1:xs[xs.length-1],y1:ys[ys.length-1]}]; }
    let bandes=[];
    for(let j=0;j+1<ys.length;j++){
      const ym=(ys[j]+ys[j+1])/2; let run=null;
      for(let i=0;i+1<xs.length;i++){
        const dans=dansPoly(P,(xs[i]+xs[i+1])/2,ym);
        if(dans){ if(!run) run={x0:xs[i],x1:xs[i+1],y0:ys[j],y1:ys[j+1]}; else run.x1=xs[i+1]; }
        else if(run){ bandes.push(run); run=null; }
      }
      if(run) bandes.push(run);
    }
    // fusion verticale des bandes de memes abscisses
    let fusion=true;
    while(fusion){ fusion=false;
      for(let a=0;a<bandes.length&&!fusion;a++) for(let b=0;b<bandes.length&&!fusion;b++){
        const A=bandes[a],B=bandes[b];
        if(a!==b&&Math.abs(A.x0-B.x0)<1e-3&&Math.abs(A.x1-B.x1)<1e-3&&Math.abs(A.y1-B.y0)<1e-3){ A.y1=B.y1; bandes.splice(b,1); fusion=true; }
      } }
    return bandes;
  }
  window.plancherToutNiveau = function(){
    const niv=N(), t=window.plTypeChoisi||'etage';
    const rs=rectanglesContour(niv);
    if(!rs.length){ verdict('ko',"Fermez d'abord le contour du niveau."); return; }
    rs.forEach(r=>planchersDe(niv).push(avecAC({ ...r, type:t, sens:'auto', alt:TYPES_PL[t].alt }, t)));
    plSel=planchersDe(niv).length-1; recalcul();
  };

  function verdict(c, t){ const v=document.getElementById('verdict'); if(v){ v.className='verdict '+c; v.textContent=t; } }

  /* ---------------- dessin en plan ---------------- */
  function dessin(niv, o){
    const {po,tr}=o; let g='';
    const actif = mode==='zone'||mode==='deplacer';
    g+=`<defs><marker id="flEsc" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#3B3A36"/></marker></defs>`;
    const pts=P=>P.map(q=>`${q.x},${-q.y}`).join(' ');
    // planchers
    planchersDe(niv).forEach((z,i)=>{
      const t=TYPES_PL[z.type]||TYPES_PL.etage, m=mesurePl(z), s=actif&&i===plSel, col=m.alerte?'#B03A2E':t.coul;
      const W=z.x1-z.x0, D=z.y1-z.y0;
      g+=`<rect x="${z.x0}" y="${-z.y1}" width="${W}" height="${D}" fill="${t.coul}" fill-opacity="${actif?0.10:0.05}" stroke="${s?'#C0392B':col}" stroke-width="${tr*(s?2.4:1.2)}" stroke-dasharray="${s?'':`${po*.5} ${po*.3}`}" style="pointer-events:none"/>`;
      if(actif||mode==='plancher'){
        // sens des poutrelles : quelques traits
        if(t.poutrelles){ const k=Math.min(6,Math.max(2,m.n));
          for(let j=1;j<=k;j++){ if(m.sens==='x'){ const y=z.y0+D*j/(k+1); g+=`<line x1="${z.x0+0.1}" y1="${-y}" x2="${z.x1-0.1}" y2="${-y}" stroke="${t.coul}" stroke-opacity=".55" stroke-width="${tr*.8}"/>`; }
            else { const x=z.x0+W*j/(k+1); g+=`<line x1="${x}" y1="${-(z.y0+0.1)}" x2="${x}" y2="${-(z.y1-0.1)}" stroke="${t.coul}" stroke-opacity=".55" stroke-width="${tr*.8}"/>`; } } }
        else g+=`<line x1="${z.x0}" y1="${-z.y0}" x2="${z.x1}" y2="${-z.y1}" stroke="${t.coul}" stroke-opacity=".35" stroke-width="${tr*.8}"/><line x1="${z.x0}" y1="${-z.y1}" x2="${z.x1}" y2="${-z.y0}" stroke="${t.coul}" stroke-opacity=".35" stroke-width="${tr*.8}"/>`;
        const fs=Math.min(po*.85, Math.max(0.12, Math.min(W,D)/5));
        g+=`<text x="${(z.x0+z.x1)/2}" y="${-(z.y0+z.y1)/2-fs*.2}" font-size="${fs}" font-family="IBM Plex Sans,sans-serif" font-weight="600" fill="${col}" text-anchor="middle" style="pointer-events:none">${t.l.replace(/ \(.*\)/,'')}</text>`;
        g+=`<text x="${(z.x0+z.x1)/2}" y="${-(z.y0+z.y1)/2+fs*1.0}" font-size="${fs*.85}" font-family="IBM Plex Sans,sans-serif" fill="${col}" text-anchor="middle" style="pointer-events:none">${f1(m.surface)} m² · ${z.type==='aircrab'?`${z.acSys==='mini'?'Mini ':''}Air-Crab ${fh(z.acH||10)} cm`:`${z.type==='balcon'?'avancée':'portée'} ${f2(m.portee)} m${m.alerte?' ⚠':''}`}</text>`;
        if(s) [[z.x0,z.y0],[z.x1,z.y0],[z.x1,z.y1],[z.x0,z.y1]].forEach(([x,y])=>g+=`<rect x="${x-po*.25}" y="${-y-po*.25}" width="${po*.5}" height="${po*.5}" fill="#fff" stroke="#C0392B" stroke-width="${tr}"/>`);
      }
    });
    if(mode==='zone'&&plA&&survolPt){
      const x0=Math.min(plA.x,survolPt.x), x1=Math.max(plA.x,survolPt.x), y0=Math.min(plA.y,survolPt.y), y1=Math.max(plA.y,survolPt.y);
      g+=`<rect x="${x0}" y="${-y1}" width="${x1-x0}" height="${y1-y0}" fill="#2F6690" fill-opacity=".08" stroke="#2F6690" stroke-width="${tr*1.4}" stroke-dasharray="${po*.4} ${po*.25}"/>`;
      g+=`<text x="${(x0+x1)/2}" y="${-y1-po*.4}" font-size="${po*.8}" fill="#2F6690" text-anchor="middle">${f2(x1-x0)} × ${f2(y1-y0)} m</text>`;
    }
    // escaliers de ce niveau
    escaliersDe(niv).forEach((e,i)=>{
      const G=geoEsc(e,niv), s=(mode==='escalier'||mode==='deplacer')&&i===escSel, col=s?'#C0392B':'#3B3A36';
      g+=`<polygon points="${pts(G.emprise)}" fill="#FFFDF8" fill-opacity=".85" stroke="${col}" stroke-width="${tr*(s?2.2:1.3)}"/>`;
      G.marches.forEach(P=>g+=`<polygon points="${pts(P)}" fill="none" stroke="${col}" stroke-width="${tr*.7}"/>`);
      const c0=centreDe(G.marches[0]), c1=centreDe(G.marches[G.marches.length-1]);
      // ligne de foulee : du depart a l'arrivee, par le milieu des marches
      const pas=Math.max(1,Math.floor(G.marches.length/8)), lf=G.marches.filter((_,k)=>k%pas===0||k===G.marches.length-1).map(centreDe);
      g+=`<polyline points="${pts(lf)}" fill="none" stroke="${col}" stroke-width="${tr*1.1}" marker-end="url(#flEsc)"/>`;
      g+=`<circle cx="${c0.x}" cy="${-c0.y}" r="${po*.18}" fill="${col}"/>`;
      g+=`<text x="${c0.x}" y="${-c0.y+po*.9}" font-size="${po*.65}" font-family="IBM Plex Sans,sans-serif" fill="${col}" text-anchor="middle" style="pointer-events:none">montée</text>`;
      const ce=centreDe(G.emprise);
      if(mode==='escalier'||mode==='deplacer'||s) g+=`<text x="${ce.x}" y="${-ce.y}" font-size="${po*.7}" font-family="IBM Plex Sans,sans-serif" font-weight="600" fill="${col}" text-anchor="middle" style="pointer-events:none" paint-order="stroke" stroke="#fff" stroke-width="${po*.15}">${G.n} marches de ${f1(G.hm*100)} cm</text>`;
      void c1;
    });
    // tremies des escaliers du niveau du dessous
    const bas=dessousDe(niv);
    if(bas) escaliersDe(bas).forEach(e=>{
      const G=geoEsc(e,bas), c=centreDe(G.emprise);
      g+=`<polygon points="${pts(G.emprise)}" fill="#fff" fill-opacity=".6" stroke="#3B3A36" stroke-width="${tr*1.2}" stroke-dasharray="${po*.45} ${po*.25}"/>`;
      g+=`<line x1="${G.emprise[0].x}" y1="${-G.emprise[0].y}" x2="${G.emprise[2].x}" y2="${-G.emprise[2].y}" stroke="#3B3A36" stroke-width="${tr*.6}"/>`;
      g+=`<line x1="${G.emprise[1].x}" y1="${-G.emprise[1].y}" x2="${G.emprise[3].x}" y2="${-G.emprise[3].y}" stroke="#3B3A36" stroke-width="${tr*.6}"/>`;
      g+=`<text x="${c.x}" y="${-c.y-po*.3}" font-size="${po*.7}" font-family="IBM Plex Sans,sans-serif" font-weight="600" fill="#3B3A36" text-anchor="middle" paint-order="stroke" stroke="#fff" stroke-width="${po*.15}" style="pointer-events:none">Trémie escalier</text>`;
    });
    // apercu de l'escalier a poser
    if(mode==='escalier'&&survolPt&&escSel===null&&!estVS(niv)){
      const G=geoEsc({type:window.escTypeChoisi,x:survolPt.x,y:survolPt.y,larg:reglEsc.larg,rot:reglEsc.rot,cote:reglEsc.cote},niv);
      g+=`<polygon points="${pts(G.emprise)}" fill="#3B3A36" fill-opacity=".06" stroke="#3B3A36" stroke-width="${tr}" stroke-dasharray="${po*.35} ${po*.25}" style="pointer-events:none"/>`;
    }
    return g;
  }
  (window.dessinsPlan = window.dessinsPlan || []).push(dessin);

  /* ---------------- reglages (barre laterale) ---------------- */
  const reglEsc = { larg:0.90, rot:0, cote:'d' };
  let panneau=null;
  function creerPanneau(){
    panneau=document.createElement('div'); panneau.id='editPlEsc'; panneau.className='edit-mur'; panneau.hidden=true;
    panneau.style.cssText='display:flex;flex-direction:column;gap:6px;padding:10px 12px';
    const dest=document.querySelector('#barreLat .bl-reglages') || document.getElementById('editSel')?.parentNode;
    if(dest) dest.insertBefore(panneau, dest.firstChild); else document.body.appendChild(panneau);
  }
  const opt=(o,v)=>Object.entries(o).map(([k,t])=>`<option value="${k}" ${k===v?'selected':''}>${t.l||t}</option>`).join('');
  function rendrePanneau(){
    if(!panneau||!panneau.isConnected){ panneau=document.getElementById('editPlEsc'); if(!panneau) creerPanneau(); }
    const rg=document.querySelector('#barreLat .bl-reglages'); if(rg && panneau.parentNode!==rg) rg.insertBefore(panneau, rg.firstChild);
    const niv=N();
    const z = plSel!==null ? planchersDe(niv)[plSel] : null, e = escSel!==null ? escaliersDe(niv)[escSel] : null;
    const voir = mode==='zone' || mode==='escalier' || (mode==='deplacer'&&(z||e));
    if(!voir){ panneau.hidden=true; return; }
    panneau.hidden=false;
    let h='';
    if(mode==='zone' || z){
      const t = z ? z.type : window.plTypeChoisi;
      const m = z ? mesurePl(z) : null;
      h+=`<b>${z?`Plancher ${plSel+1}`:'Poser un plancher'}</b>
        <label>Type <select data-pl="type">${opt(TYPES_PL,t)}</select></label>
        <small style="color:#6B6459">${TYPES_PL[t].c}</small>
        <label>Hauteur <select data-pl="alt"><option value="haut" ${(z?z.alt||TYPES_PL[z.type].alt:TYPES_PL[t].alt)==='haut'?'selected':''}>en haut de ce niveau (plancher haut)</option><option value="bas" ${(z?z.alt||TYPES_PL[z.type].alt:TYPES_PL[t].alt)==='bas'?'selected':''}>au sol de ce niveau</option></select></label>`;
      if(TYPES_PL[t].aircrab){
        const sys = z ? (z.acSys||'aircrab') : acChoisi.sys, hh = z ? z.acH : acChoisi.h;
        h+=`<label>Système <select data-pl="acSys">${Object.entries(SYS_AC).map(([k,l])=>`<option value="${k}" ${k===sys?'selected':''}>${l}</option>`).join('')}</select></label>
          <label>Vide d'air <select data-pl="acH">${HAUTEURS_AC[sys].map(v=>`<option value="${v}" ${v===hh?'selected':''}>${fh(v)} cm</option>`).join('')}</select></label>
          <small style="color:#6B6459">Quantités (cupolas, pieds, bases, béton, treillis) calculées au métré.</small>`;
      }
      if(TYPES_PL[t].poutrelles) h+=`<label>Poutrelles <select data-pl="sens"><option value="auto" ${!z||!z.sens||z.sens==='auto'?'selected':''}>sens le plus court (auto)</option><option value="x" ${z&&z.sens==='x'?'selected':''}>de gauche à droite</option><option value="y" ${z&&z.sens==='y'?'selected':''}>de haut en bas</option></select></label>`;
      if(z){
        h+=`<div style="display:flex;gap:6px;align-items:center">L <input data-pl="W" value="${f2(m.W)}" style="width:64px"> × l <input data-pl="D" value="${f2(m.D)}" style="width:64px"> m</div>
          <div style="font-size:12.5px">${f1(m.surface)} m²${z.type==='aircrab'?'':` · ${z.type==='balcon'?'avancée':'portée'} ${f2(m.portee)} m${m.n?` · ≈ ${m.n} poutrelles`:''}`}</div>
          ${m.alerte?`<div style="font-size:12.5px;color:#B03A2E">⚠ ${m.alerte}</div>`:''}
          <div style="display:flex;gap:6px"><button type="button" data-act="supPl">Supprimer</button><button type="button" data-act="fermer">Fermer</button></div>`;
      } else {
        h+=`<small>Cliquez deux coins opposés sur le plan, dans la maison ou dehors (balcon, terrasse).</small>
          <button type="button" data-act="tout">Plancher sur tout le niveau</button>`;
      }
    }
    if(mode==='escalier' || e){
      const t = e ? e.type : window.escTypeChoisi, r = e || reglEsc, md=marchesDe(niv), dz=dessusDe(niv);
      h+=`<b>${e?`Escalier ${escSel+1}`:'Poser un escalier'}</b>
        <label>Type <select data-es="type">${opt(TYPES_ESC,t)}</select></label>
        <label>Largeur <select data-es="larg">${[0.70,0.80,0.90,1.00,1.20].map(v=>`<option value="${v}" ${Math.abs((r.larg||0.9)-v)<1e-3?'selected':''}>${f2(v)} m</option>`).join('')}</select></label>
        ${t!=='droit'?`<label>Tourne <select data-es="cote"><option value="d" ${r.cote!=='g'?'selected':''}>à droite</option><option value="g" ${r.cote==='g'?'selected':''}>à gauche</option></select></label>`:''}
        <button type="button" data-act="pivoter">Pivoter de 90°</button>
        <div style="font-size:12.5px">${md.n} marches de ${f1(md.hm*100)} cm · giron ${Math.round(md.g*100)} cm · à franchir ${f2(md.H)} m</div>
        ${!dz?`<div style="font-size:12.5px;color:#B03A2E">Pas de niveau au-dessus : ajoutez un étage pour que l'escalier y mène.</div>`:''}
        ${estVS(niv)?`<div style="font-size:12.5px;color:#B03A2E">Pas d'escalier dans le vide sanitaire : choisissez le RDC.</div>`:''}
        ${e?`<div style="display:flex;gap:6px"><button type="button" data-act="supEsc">Supprimer</button><button type="button" data-act="fermer">Fermer</button></div>`
           :`<small>Cliquez sur le plan pour poser l'escalier (pied de l'escalier vers le bas). Glissez-le ensuite pour l'ajuster.</small>`}`;
    }
    if(panneau.dataset.h!==h){ panneau.innerHTML=h; panneau.dataset.h=h; }
  }
  document.addEventListener('change', ev=>{
    const el=ev.target; if(!el.closest||!el.closest('#editPlEsc')) return;
    const niv=N(), z=plSel!==null?planchersDe(niv)[plSel]:null, e=escSel!==null?escaliersDe(niv)[escSel]:null;
    const n=v=>parseFloat(String(v).replace(',','.'));
    if(el.dataset.pl){
      const k=el.dataset.pl;
      if(k==='type'){ if(z){ z.type=el.value; z.alt=TYPES_PL[el.value].alt; avecAC(z, el.value); } else window.plTypeChoisi=el.value; }
      else if(k==='acSys'){ const c=z||acChoisi; if(z) z.acSys=el.value; else acChoisi.sys=el.value;
        const L=HAUTEURS_AC[el.value]; const hc=z?z.acH:acChoisi.h; if(!L.includes(hc)){ if(z) z.acH=L[0]; else acChoisi.h=L[0]; } }
      else if(k==='acH'){ const v=parseFloat(el.value); if(z) z.acH=v; else acChoisi.h=v; }
      else if(k==='alt'){ if(z) z.alt=el.value; else plAltChoisie=el.value; }
      else if(k==='sens'){ if(z) z.sens=el.value; else plSensChoisi=el.value; }
      else if(z&&(k==='W'||k==='D')){ const v=n(el.value); if(v>0.2){ if(k==='W') z.x1=z.x0+v; else z.y1=z.y0+v; } }
    }
    if(el.dataset.es){
      const k=el.dataset.es, cible=e||reglEsc;
      if(k==='type'){ if(e) e.type=el.value; else window.escTypeChoisi=el.value; }
      else if(k==='larg') cible.larg=n(el.value);
      else if(k==='cote') cible.cote=el.value;
    }
    if(window.syncOutil) syncOutil();
    recalcul();
  });
  let plAltChoisie=null, plSensChoisi='auto';
  document.addEventListener('click', ev=>{
    const b=ev.target.closest&&ev.target.closest('#editPlEsc [data-act]'); if(!b) return;
    const niv=N(), a=b.dataset.act;
    if(a==='supPl'&&plSel!==null){ planchersDe(niv).splice(plSel,1); plSel=null; }
    else if(a==='supEsc'&&escSel!==null){ escaliersDe(niv).splice(escSel,1); escSel=null; }
    else if(a==='fermer'){ plSel=null; escSel=null; }
    else if(a==='tout'){ window.plancherToutNiveau(); return; }
    else if(a==='pivoter'){ const c=escSel!==null?escaliersDe(niv)[escSel]:reglEsc; c.rot=((c.rot||0)+90)%360; }
    recalcul();
  });

  /* ---------------- souris ---------------- */
  const pas5 = (p,libre)=> libre ? p : { x:Math.round(p.x*20)/20, y:Math.round(p.y*20)/20 };
  function objetSous(p){
    const niv=N();
    const ei=escSous(p,niv); if(ei!==null) return {k:'esc', i:ei};
    if(mode==='deplacer'||mode==='ouverture'||mode==='piece'||mode==='terrasse'){
      const o=ouvertureSous(p); if(o!==null && (mode==='deplacer'||mode==='ouverture')) return {k:'ouv', i:o};
      const pc=pieceSous(p); if(pc!==null && (mode==='deplacer'||mode==='piece')) return {k:'piece', i:pc};
      if(mode==='piece') return null;
      if(mode==='deplacer'){
        const ml=libreSous(p); if(ml) return {k:'libre', i:ml.i, seg:ml.seg||1};
        const s=segmentSousCurseur(p); if(s&&s.sur==='refend') return {k:'refend', i:s.i, seg:s.seg||1};
        if(s) return null;            // mur exterieur ou cloison : poignees d'origine
      }
      const ts=terrasseSous(p); if(ts!==null && (mode==='deplacer'||mode==='terrasse')) return {k:'terr', i:ts};
      if(mode!=='deplacer') return null;
    }
    if(mode==='deplacer'||mode==='zone'){ const zi=plSous(p,niv); if(zi!==null) return {k:'pl', i:zi}; }
    return null;
  }
  function photo(ob){
    const niv=N();
    if(ob.k==='esc'){ const e=escaliersDe(niv)[ob.i]; return {x:e.x,y:e.y}; }
    if(ob.k==='pl'){ return {...planchersDe(niv)[ob.i]}; }
    if(ob.k==='terr'){ return {...terrassesDe(niv)[ob.i]}; }
    if(ob.k==='piece'){ const pc=piecesDe(niv)[ob.i]; return {x:pc.x,y:pc.y}; }
    if(ob.k==='libre') return { pts: mursLibresDe(niv)[ob.i].pts.map(q=>({...q})) };
    if(ob.k==='refend') return { pts: niv.refends[ob.i].pts.map(q=>({...q})) };
    if(ob.k==='ouv') return { t: niv.ouvertures[ob.i].t };
    return {};
  }
  function deplacer(ob, d0, dx, dy, p){
    const niv=N();
    if(ob.k==='esc'){ const e=escaliersDe(niv)[ob.i]; e.x=d0.x+dx; e.y=d0.y+dy; }
    else if(ob.k==='pl'||ob.k==='terr'){ const z=(ob.k==='pl'?planchersDe(niv):terrassesDe(niv))[ob.i]; z.x0=d0.x0+dx; z.x1=d0.x1+dx; z.y0=d0.y0+dy; z.y1=d0.y1+dy; }
    else if(ob.k==='piece'){ const pc=piecesDe(niv)[ob.i]; pc.x=d0.x+dx; pc.y=d0.y+dy; }
    else if(ob.k==='libre'){ mursLibresDe(niv)[ob.i].pts=d0.pts.map(q=>({x:q.x+dx,y:q.y+dy})); }
    else if(ob.k==='refend'){ niv.refends[ob.i].pts=d0.pts.map(q=>({x:q.x+dx,y:q.y+dy})); }
    else if(ob.k==='ouv'){
      const o=niv.ouvertures[ob.i], sp=supportDe(niv,o); if(!sp) return;
      const L=Math.hypot(sp.b.x-sp.a.x,sp.b.y-sp.a.y);
      const t=((p.x-sp.a.x)*(sp.b.x-sp.a.x)+(p.y-sp.a.y)*(sp.b.y-sp.a.y))/(L*L);
      o.t=Math.max(o.largeur/(2*L), Math.min(1-o.largeur/(2*L), Math.round(t*L*20)/20/L));
    }
  }
  function choisir(ob){
    // l'objet saisi devient l'objet selectionne, ses reglages s'ouvrent
    sel=null; ouvSel=null; pieceSel=null; terrSel=null; plSel=null; escSel=null;
    if(ob.k==='esc') escSel=ob.i; else if(ob.k==='pl') plSel=ob.i;
    else if(ob.k==='ouv') ouvSel=ob.i; else if(ob.k==='piece') pieceSel=ob.i; else if(ob.k==='terr') terrSel=ob.i;
    else if(ob.k==='libre') sel={type:'libre', i:ob.i, seg:ob.seg||1};
    else if(ob.k==='refend') sel={type:'refend', i:ob.i, seg:ob.seg||1};
  }
  const sceneEl = ()=>document.getElementById('scene');
  const surScene = ev => { const s=sceneEl(); return s && ev.target && s.contains(ev.target); };

  let mangerClic = false;
  document.addEventListener('click', ev=>{ if(mangerClic && surScene(ev)){ mangerClic=false; ev.stopPropagation(); ev.preventDefault(); } }, true);
  document.addEventListener('pointerdown', ev=>{
    mangerClic = false;
    if(!surScene(ev) || ev.button!==0 || (typeof pince!=='undefined'&&pince) || (typeof calage!=='undefined'&&calage)) return;
    const p=versMetres(ev);
    if(mode==='deplacer' && poigneeSous(p)) return;          // poignees : comportement d'origine
    if(mode==='zone' && plA) return;                            // second coin d'un plancher
    if(mode==='terrasse' && terrA) return;
    const ob=objetSous(p); if(!ob) return;
    ev.stopPropagation(); ev.preventDefault();
    tire={ ob, x0:ev.clientX, y0:ev.clientY, p0:p, d0:photo(ob), bouge:false };
    sceneEl().style.cursor='grabbing';
  }, true);
  window.addEventListener('pointermove', ev=>{
    if(!tire) return;
    if(!tire.bouge && Math.hypot(ev.clientX-tire.x0, ev.clientY-tire.y0)<4) return;
    tire.bouge=true;
    const p=versMetres(ev), d=pas5({x:p.x-tire.p0.x, y:p.y-tire.p0.y}, ev.shiftKey);
    deplacer(tire.ob, tire.d0, d.x, d.y, p);
    rendreScene();
  }, true);
  document.addEventListener('pointerup', ev=>{
    if(!tire) return;
    const t=tire; tire=null; sceneEl().style.cursor='';
    ev.stopPropagation();
    mangerClic = true;                 // le clic qui suit ne doit rien creer
    choisir(t.ob);
    recalcul();
  }, true);

  // outils Planchers et Escaliers : survol, clics, touches
  document.addEventListener('pointermove', ev=>{
    if(!surScene(ev)||tire) return;
    if(mode==='zone'||mode==='escalier'){
      ev.stopPropagation();
      const p=versMetres(ev); survolPt = pas5(p, ev.shiftKey);
      sceneEl().style.cursor = objetSous(p) ? 'move' : 'crosshair';
      rendreScene(); return;
    }
    survolPt=null;
  }, true);
  window.addEventListener('pointermove', ev=>{
    // apres le survol d'origine : un objet saisissable affiche la main
    if(tire||!surScene(ev)) return;
    if(['deplacer','ouverture','piece','terrasse'].includes(mode) && !(typeof prise!=='undefined'&&prise)){
      const s=sceneEl(); if(s.style.cursor==='grab'||s.style.cursor==='grabbing') return;
      if(objetSous(versMetres(ev))) s.style.cursor='move'; else if(s.style.cursor==='move') s.style.cursor='';
    }
  });
  document.addEventListener('click', ev=>{
    if(!surScene(ev) || (mode!=='zone'&&mode!=='escalier')) return;
    ev.stopPropagation();
    if(Date.now()<ignorerClic) return;
    const niv=N(), p=pas5(versMetres(ev), ev.shiftKey);
    if(mode==='zone'){
      if(!plA){ plA=p; plSel=null; recalcul(); return; }
      if(Math.abs(p.x-plA.x)<0.3||Math.abs(p.y-plA.y)<0.3) return;
      const t=window.plTypeChoisi||'etage';
      planchersDe(niv).push(avecAC({ x0:Math.min(plA.x,p.x), y0:Math.min(plA.y,p.y), x1:Math.max(plA.x,p.x), y1:Math.max(plA.y,p.y),
        type:t, sens:plSensChoisi||'auto', alt:plAltChoisie||TYPES_PL[t].alt }, t));
      plA=null; plSel=planchersDe(niv).length-1; recalcul(); return;
    }
    if(mode==='escalier'){
      if(estVS(niv)){ verdict('ko',"Pas d'escalier dans le vide sanitaire : choisissez le RDC dans la liste Niveau."); return; }
      if(escSel!==null){ escSel=null; recalcul(); return; }
      escaliersDe(niv).push({ type:window.escTypeChoisi||'droit', x:p.x, y:p.y, larg:reglEsc.larg, rot:reglEsc.rot, cote:reglEsc.cote });
      escSel=escaliersDe(niv).length-1;
      if(!dessusDe(niv)) verdict('neutre',"Escalier posé. Ajoutez un niveau au-dessus pour qu'il y mène : la trémie y sera dessinée.");
      recalcul();
    }
  }, true);
  document.addEventListener('keydown', ev=>{
    const tg=document.activeElement&&document.activeElement.tagName;
    if(tg==='INPUT'||tg==='SELECT'||tg==='TEXTAREA') return;
    const niv=N();
    const aSel = plSel!==null || escSel!==null;
    if(!(mode==='zone'||mode==='escalier'||(mode==='deplacer'&&aSel))) return;
    if(ev.key==='Escape'){ ev.stopPropagation(); ev.preventDefault();
      if(plA) plA=null; else { plSel=null; escSel=null; } recalcul(); return; }
    if((ev.key==='Delete'||ev.key==='Backspace') && aSel){ ev.stopPropagation(); ev.preventDefault();
      if(plSel!==null){ planchersDe(niv).splice(plSel,1); plSel=null; } else { escaliersDe(niv).splice(escSel,1); escSel=null; }
      recalcul(); return; }
    if((ev.key==='r'||ev.key==='R') && (mode==='escalier'||escSel!==null)){
      const c=escSel!==null?escaliersDe(niv)[escSel]:reglEsc; c.rot=((c.rot||0)+90)%360; recalcul(); }
  }, true);

  /* le bouton Annuler retire le dernier plancher ou escalier */
  const annulerOrig = window.annuler;
  window.annuler = function(){
    const niv=N();
    if(mode==='zone'){ if(plA) plA=null; else planchersDe(niv).pop(); plSel=null; return recalcul(); }
    if(mode==='escalier'){ escaliersDe(niv).pop(); escSel=null; return recalcul(); }
    return annulerOrig.apply(this, arguments);
  };
  /* nouveaux outils : meme garde que les autres (contour ferme) */
  const setModeOrig = window.setMode;
  window.setMode = function(m){
    if((m==='zone'||m==='escalier') && !N().ferme){ verdict('ko',"Refermez d'abord le contour de ce niveau."); return; }
    plA=null; plSel=null; escSel=null; survolPt=null;
    setModeOrig(m);
  };
  // une selection d'origine efface la notre
  const selOrig = window.selectionnerA;
  if(selOrig) window.selectionnerA = function(p){ const ob=objetSous(p); if(mode==='deplacer'&&ob&&(ob.k==='pl'||ob.k==='esc')){ choisir(ob); return recalcul(); } plSel=null; escSel=null; return selOrig(p); };

  (window.apresRecalcul = window.apresRecalcul || []).push(()=>{
    const z=document.getElementById('mZone'), e=document.getElementById('mEscalier');
    if(z) z.classList.toggle('actif', mode==='zone');
    if(e) e.classList.toggle('actif', mode==='escalier');
    if(mode!=='zone'&&mode!=='deplacer') plSel=null;
    if(mode!=='escalier'&&mode!=='deplacer') escSel=null;
    const niv=N();
    if(plSel!==null&&!planchersDe(niv)[plSel]) plSel=null;
    if(escSel!==null&&!escaliersDe(niv)[escSel]) escSel=null;
    rendrePanneau();
  });

  /* ---------------- 3D ---------------- */
  window.tremies3D = function(niv){
    const bas=dessousDe(niv); if(!bas) return [];
    return escaliersDe(bas).map(e=>geoEsc(e,bas).emprise);
  };
  window.objets3D = window.objets3D || [];
  window.objets3D.push(function({THREE, maison, niv, base, h, vs, C, ombre, pts, dessusPret}){
    const mBeton=new THREE.MeshStandardMaterial({color:C('#C9C3B6'),roughness:.95});
    const mBois=new THREE.MeshStandardMaterial({color:C('#B98E5E'),roughness:.7});
    const mVerre=new THREE.MeshStandardMaterial({color:C('#9DC0D4'),roughness:.1,transparent:true,opacity:.35});
    const mGc=new THREE.MeshStandardMaterial({color:C('#4A4741'),roughness:.6});
    // planchers : on dessine ce que la maison ne dessine pas deja (dehors, ou sans etage dessus)
    planchersDe(niv).forEach(z=>{
      const W=z.x1-z.x0, D=z.y1-z.y0, cx=(z.x0+z.x1)/2, cy=(z.y0+z.y1)/2;
      const dedans = pts.length>2 && dansPoly(pts,cx,cy);
      const alt=z.alt||TYPES_PL[z.type].alt;
      if(dedans && (alt==='bas' || dessusPret)) return;
      const y0 = alt==='haut' ? base+h : base-0.22;
      const m=new THREE.Mesh(new THREE.BoxGeometry(W,0.22,D), z.type==='terrasse'?new THREE.MeshStandardMaterial({color:C('#CDBFA6'),roughness:.95}):mBeton);
      m.position.set(cx, y0+0.11, -cy); maison.add(ombre(m));
      // garde-corps sur les bords libres d'un plancher en hauteur
      if(alt==='haut' || z.type==='balcon'){
        const yG=y0+0.22, cotes=[[z.x0,z.y0,z.x1,z.y0],[z.x1,z.y0,z.x1,z.y1],[z.x1,z.y1,z.x0,z.y1],[z.x0,z.y1,z.x0,z.y0]];
        cotes.forEach(([ax,ay,bx,by])=>{
          const mx=(ax+bx)/2, my=(ay+by)/2, L=Math.hypot(bx-ax,by-ay);
          // un bord colle a la facade n'a pas de garde-corps
          let contre=false; for(let i=0;i<pts.length&&!contre;i++){ const a=pts[i], b=pts[(i+1)%pts.length];
            const vx=b.x-a.x, vy=b.y-a.y, l2=vx*vx+vy*vy; if(!l2) continue; let t=((mx-a.x)*vx+(my-a.y)*vy)/l2; t=Math.max(0,Math.min(1,t));
            if(Math.hypot(mx-(a.x+t*vx), my-(a.y+t*vy))<0.35) contre=true; }
          if(contre || (pts.length>2 && dansPoly(pts,mx,my))) return;
          const vitre=new THREE.Mesh(new THREE.BoxGeometry(L,1.0,0.02), mVerre);
          vitre.position.set(mx, yG+0.5, -my); vitre.rotation.y=Math.atan2(by-ay,bx-ax); maison.add(vitre);
          const lisse=new THREE.Mesh(new THREE.BoxGeometry(L,0.05,0.06), mGc);
          lisse.position.set(mx, yG+1.0, -my); lisse.rotation.y=Math.atan2(by-ay,bx-ax); maison.add(lisse);
        });
      }
    });
    // escaliers : une marche par giron, posee a sa hauteur
    if(!vs) escaliersDe(niv).forEach(e=>{
      const G=geoEsc(e,niv);
      G.marches.forEach((P,k)=>{
        const forme=new THREE.Shape(P.map(p=>new THREE.Vector2(p.x,p.y)));
        const y1=base+(k+1)*G.hm, ep=Math.min(0.06, G.hm);
        const mm=new THREE.Mesh(new THREE.ExtrudeGeometry(forme,{depth:ep,bevelEnabled:false}), mBois);
        mm.rotation.x=-Math.PI/2; mm.position.y=y1-ep; maison.add(ombre(mm));
        // limon : un plein sous la marche pour un escalier droit ou tournant
        if(e.type!=='helico'){ const pl=new THREE.Mesh(new THREE.ExtrudeGeometry(forme,{depth:Math.max(0.01,y1-ep-base),bevelEnabled:false}), mBeton);
          pl.rotation.x=-Math.PI/2; pl.position.y=base; maison.add(pl); }
      });
      if(e.type==='helico' && G.centre){ const fut=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,G.H||h+0.22,12), mGc); fut.position.set(G.centre.x, base+(h+0.22)/2, -G.centre.y); maison.add(fut); }
    });
  });

  /* ---------------- resume pour la demande ---------------- */
  window.resumePlanchersEscaliers = function(n){
    return {
      planchers: planchersDe(n).map(z=>{ const m=mesurePl(z); return { type:z.type, libelle:TYPES_PL[z.type].l, longueur:+m.W.toFixed(2), largeur:+m.D.toFixed(2), surface:+m.surface.toFixed(2), portee:+m.portee.toFixed(2), sens:m.sens, hauteur:z.alt||TYPES_PL[z.type].alt, poutrelles:m.n, alerte:m.alerte||null }; }),
      escaliers: escaliersDe(n).map(e=>{ const md=marchesDe(n); return { type:e.type, libelle:TYPES_ESC[e.type].l, largeur:e.larg||0.9, marches:md.n, hauteur_marche_cm:+(md.hm*100).toFixed(1), giron_cm:Math.round(md.g*100) }; }),
    };
  };
  window.textePlanchersEscaliers = function(){
    const l=[];
    niveaux.forEach(n=>{
      planchersDe(n).forEach(z=>{ const m=mesurePl(z); l.push(`${n.nom} : ${TYPES_PL[z.type].l} ${f2(m.W)} × ${f2(m.D)} m (${f1(m.surface)} m²)`); });
      escaliersDe(n).forEach(e=>{ const md=marchesDe(n); l.push(`${n.nom} : ${TYPES_ESC[e.type].l}, ${f2(e.larg||0.9)} m de large, ${md.n} marches`); });
    });
    return l;
  };
})();
