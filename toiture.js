/* Toiture : le client choisit la forme de son toit, partie par partie.
   L'emprise de chaque niveau est decoupee en rectangles ; ceux qui ne sont pas
   couverts par le niveau du dessus recoivent une toiture : quatre pans, deux
   pans, un pan, pointe de diamant, ou toit plat en dalle avec acrotere.
   Le plan montre les faitages et les aretiers, la 3D les dessine, et les
   surfaces (couverture, toit plat, acrotere) partent avec la demande. */
(function(){
  'use strict';
  const TYPES = {
    '4pans':   'Quatre pans',
    '2pans':   'Deux pans',
    '1pan':    'Un pan (monopente)',
    'diamant': 'Pointe de diamant',
    'plat':    'Toit plat en dalle',
  };
  const DEFAUT = { type:'4pans', pente:30, debord:0.45, sens:'auto', bas:'S', acrotere:0.60 };
  let zoneSel = null;
  const f2 = v => (Math.round(v*100)/100).toFixed(2).replace('.',',');
  const f1 = v => (Math.round(v*10)/10).toFixed(1).replace('.',',');

  /* Decoupe d'un polygone a angles droits en rectangles (bandes fusionnees). */
  function rectangles(pts){
    const ortho = pts.every((p,i)=>{ const q=pts[(i+1)%pts.length]; return Math.abs(p.x-q.x)<1e-6||Math.abs(p.y-q.y)<1e-6; });
    const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
    if(!ortho) return [{x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)}];
    const Y=[...new Set(ys.map(v=>+v.toFixed(4)))].sort((a,b)=>a-b), out=[];
    for(let j=0;j+1<Y.length;j++){
      const ym=(Y[j]+Y[j+1])/2, cr=[];
      for(let i=0;i<pts.length;i++){ const a=pts[i], b=pts[(i+1)%pts.length];
        if((a.y>ym)!==(b.y>ym)) cr.push(a.x+(ym-a.y)*(b.x-a.x)/(b.y-a.y)); }
      cr.sort((a,b)=>a-b);
      for(let i=0;i+1<cr.length;i+=2){
        const prev = out.find(r=>Math.abs(r.x0-cr[i])<1e-6&&Math.abs(r.x1-cr[i+1])<1e-6&&Math.abs(r.y1-Y[j])<1e-6);
        if(prev) prev.y1=Y[j+1]; else out.push({x0:cr[i],x1:cr[i+1],y0:Y[j],y1:Y[j+1]});
      }
    }
    return out;
  }
  window.rectanglesToit = rectangles;

  const dansPoly=(poly,x,y)=>{ let c=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const a=poly[i],b=poly[j]; if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x) c=!c; } return c; };
  const cle = R => [R.x0,R.y0,R.x1,R.y1].map(v=>v.toFixed(2)).join('|');

  /* Les parties de toit d'un niveau : ses rectangles non couverts par un niveau au-dessus. */
  function zones(niv){
    if(!niv || !niv.ferme || niv.murs.length<3 || estVS(niv)) return [];
    const i = niveaux.indexOf(niv);
    const dessusP = niveaux.slice(i+1).filter(n=>n.ferme&&n.murs.length>2).map(n=>sommetsDe(n).slice(0,-1));
    const P=sommetsDe(niv).slice(0,-1);
    const ortho = P.every((p,i)=>{ const q=P[(i+1)%P.length]; return Math.abs(p.x-q.x)<1e-6||Math.abs(p.y-q.y)<1e-6; });
    if(!ortho){ const xs=P.map(p=>p.x), ys=P.map(p=>p.y); const R={x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};
      return dessusP.length ? [] : [{...R, poly:P, cle:'poly'}]; }
    return rectangles(P)
      .filter(R=>!dessusP.some(Q=>dansPoly(Q,(R.x0+R.x1)/2,(R.y0+R.y1)/2)))
      .map(R=>({...R, cle:cle(R)}));
  }
  function toitDe(niv){ return niv.toiture || (niv.toiture = { general:{...DEFAUT}, parties:{} }); }
  function reglage(niv, z){ const t=toitDe(niv); return { ...DEFAUT, ...t.general, ...(z && t.parties[z.cle] || {}) }; }
  window.zonesToiture = zones;
  window.reglageToiture = reglage;

  /* ---------------- un seul toit par forme ----------------
     Les rectangles qui partagent les memes reglages sont reunis : leur contour
     commun recoit UN toit (une maison en L a un toit en L, avec ses noues).
     Le toit a pans est le squelette droit du contour (CGAL, en WebAssembly). */
  const URL_SQ = 'https://cdn.jsdelivr.net/npm/straight-skeleton@2.0.1/dist/index.js';
  let sqPret = false, sqCharge = null;
  function chargerSquelette(){
    if(sqPret) return Promise.resolve(true);
    if(sqCharge) return sqCharge;
    sqCharge = new Promise((ok)=>{
      const s=document.createElement('script'); s.src=URL_SQ;
      s.onload=()=>{ try{ window.SkeletonBuilder.init().then(()=>{ sqPret=true; ok(true); if(typeof recalcul==='function') recalcul(); }).catch(()=>ok(false)); }catch(e){ ok(false); } };
      s.onerror=()=>ok(false);
      document.head.appendChild(s);
    });
    return sqCharge;
  }
  window.chargerSquelette = chargerSquelette;

  const aireS = r => { let a=0; for(let i=0;i<r.length;i++){ const p=r[i], q=r[(i+1)%r.length]; a+=p.x*q.y-q.x*p.y; } return a/2; };
  /* Contour(s) de l'union de rectangles : boucles exterieures (sens direct) et trous. */
  function contoursUnion(rects){
    const xs=[...new Set(rects.flatMap(r=>[+r.x0.toFixed(4),+r.x1.toFixed(4)]))].sort((a,b)=>a-b);
    const ys=[...new Set(rects.flatMap(r=>[+r.y0.toFixed(4),+r.y1.toFixed(4)]))].sort((a,b)=>a-b);
    const pris=(i,j)=>{ if(i<0||j<0||i>=xs.length-1||j>=ys.length-1) return false;
      const cx=(xs[i]+xs[i+1])/2, cy=(ys[j]+ys[j+1])/2; return rects.some(r=>cx>r.x0&&cx<r.x1&&cy>r.y0&&cy<r.y1); };
    const aretes=[];
    for(let i=0;i<xs.length-1;i++) for(let j=0;j<ys.length-1;j++){ if(!pris(i,j)) continue;
      const x0=xs[i],x1=xs[i+1],y0=ys[j],y1=ys[j+1];
      if(!pris(i,j-1)) aretes.push([[x0,y0],[x1,y0]]);
      if(!pris(i+1,j)) aretes.push([[x1,y0],[x1,y1]]);
      if(!pris(i,j+1)) aretes.push([[x1,y1],[x0,y1]]);
      if(!pris(i-1,j)) aretes.push([[x0,y1],[x0,y0]]);
    }
    const k=p=>p[0].toFixed(4)+','+p[1].toFixed(4), dep=new Map();
    aretes.forEach((a,n)=>{ const c=k(a[0]); if(!dep.has(c)) dep.set(c,[]); dep.get(c).push(n); });
    const vu=new Set(), boucles=[];
    aretes.forEach((a,n)=>{ if(vu.has(n)) return; const b=[]; let cur=n, g=0;
      while(!vu.has(cur) && g++<10000){ vu.add(cur); b.push({x:aretes[cur][0][0],y:aretes[cur][0][1]});
        const suiv=(dep.get(k(aretes[cur][1]))||[]).find(m=>!vu.has(m)); if(suiv===undefined) break; cur=suiv; }
      // points alignes
      const r=[]; for(let i=0;i<b.length;i++){ const a0=b[(i-1+b.length)%b.length], p=b[i], c=b[(i+1)%b.length];
        if(Math.abs((p.x-a0.x)*(c.y-p.y)-(p.y-a0.y)*(c.x-p.x))>1e-9) r.push(p); }
      if(r.length>=3) boucles.push(r); });
    const ext=boucles.filter(b=>aireS(b)>0), trous=boucles.filter(b=>aireS(b)<0);
    return ext.map(o=>({ ext:o, trous:trous.filter(t=>dansPoly(o,t[0].x+1e-6,t[0].y+1e-6)) }));
  }
  /* Decalage vers l'exterieur d'un contour (debord de toit), angles en onglet. */
  function decaler(r, d, sens=1){
    if(!d) return r.map(p=>({...p}));
    const n=r.length, s=aireS(r)>0?1:-1, out=[];
    for(let i=0;i<n;i++){
      const a=r[(i-1+n)%n], p=r[i], b=r[(i+1)%n];
      const n1=nrmExt(a,p,s), n2=nrmExt(p,b,s), dd=1+n1.x*n2.x+n1.y*n2.y;
      out.push({x:p.x+(n1.x+n2.x)/(dd||1)*d*sens, y:p.y+(n1.y+n2.y)/(dd||1)*d*sens});
    }
    return out;
  }
  function nrmExt(a,b,s){ const L=Math.hypot(b.x-a.x,b.y-a.y)||1; return {x:(b.y-a.y)/L*s, y:-(b.x-a.x)/L*s}; }
  /* Squelette droit : sommets [x,y,t] et faces (indices), ou null si non charge. */
  const cacheSq=new Map();
  function squelette(ext, trous){
    if(!sqPret) return null;
    const ring=(r,ccw)=>{ let q=r.map(p=>[+p.x.toFixed(4),+p.y.toFixed(4)]); if((aireS(r)>0)!==ccw) q=q.reverse(); q.push(q[0]); return q; };
    const entree=[ring(ext,true), ...(trous||[]).map(t=>ring(t,false))];
    const c=JSON.stringify(entree); if(cacheSq.has(c)) return cacheSq.get(c);
    let res=null; try{ res=window.SkeletonBuilder.buildFromPolygon(entree); }catch(e){ res=null; }
    if(cacheSq.size>40) cacheSq.clear(); cacheSq.set(c,res); return res;
  }
  /* Groupes de toit d'un niveau : chaque groupe = un reglage + ses formes. */
  function groupes(niv){
    const zs=zones(niv); if(!zs.length) return [];
    const parCle=new Map();
    zs.forEach(z=>{ const r=reglage(niv,z), c=JSON.stringify(r); if(!parCle.has(c)) parCle.set(c,{reglage:r, zones:[]}); parCle.get(c).zones.push(z); });
    return [...parCle.values()].map(g=>{
      const formes = g.zones.some(z=>z.poly) ? [{ext:g.zones.find(z=>z.poly).poly, trous:[]}] : contoursUnion(g.zones);
      return { ...g, formes };
    });
  }
  window.groupesToiture = groupes;
  window.squeletteToit = squelette;
  window.decalerToit = decaler;
  window.aireToit = aireS;

  /* Geometrie 3D (ou plan) d'une forme de toit : faces en [x,y,hauteur]. */
  function facesToit(forme, r){
    const p=r.pente/100, d=r.type==='plat'?0:r.debord;
    const ext=decaler(forme.ext, d), trous=(forme.trous||[]).map(t=>decaler(t,-d));
    const tuiles=[], pignons=[];
    if(r.type==='plat') return { tuiles, pignons, ext };
    const convexe = ext.every((q,i)=>{ const a=ext[(i-1+ext.length)%ext.length], b=ext[(i+1)%ext.length]; return ((q.x-a.x)*(b.y-q.y)-(q.y-a.y)*(b.x-q.x))*(aireS(ext)>0?1:-1) >= -1e-9; });
    if(r.type==='1pan'){
      const v={N:[0,-1],S:[0,1],E:[-1,0],O:[1,0]}[r.bas]||[0,1];   // montee vers le cote oppose au bas
      const proj=q=>q.x*v[0]+q.y*v[1], m0=Math.min(...ext.map(proj));
      const z=q=>(proj(q)-m0)*p;
      tuiles.push(ext.map(q=>[q.x,q.y,z(q)]));
      forme.ext.forEach((a,i)=>{ const b=forme.ext[(i+1)%forme.ext.length]; const za=z(a), zb=z(b);
        if(za>0.01||zb>0.01) pignons.push([[a.x,a.y,0],[b.x,b.y,0],[b.x,b.y,zb],[a.x,a.y,za]]); });
      return { tuiles, pignons, ext };
    }
    if(r.type==='diamant' && convexe && !trous.length){
      const c={x:ext.reduce((s,q)=>s+q.x,0)/ext.length, y:ext.reduce((s,q)=>s+q.y,0)/ext.length};
      const h=Math.min(...ext.map((a,i)=>{ const b=ext[(i+1)%ext.length], L=Math.hypot(b.x-a.x,b.y-a.y)||1; return Math.abs((b.x-a.x)*(a.y-c.y)-(a.x-c.x)*(b.y-a.y))/L; }))*p;
      ext.forEach((a,i)=>{ const b=ext[(i+1)%ext.length]; tuiles.push([[a.x,a.y,0],[b.x,b.y,0],[c.x,c.y,h]]); });
      return { tuiles, pignons, ext };
    }
    if(r.type==='2pans' && r.sens!=='auto' && ext.length===4 && !trous.length){
      const xs=ext.map(q=>q.x), ys=ext.map(q=>q.y), X0=Math.min(...xs), X1=Math.max(...xs), Y0=Math.min(...ys), Y1=Math.max(...ys);
      if(r.sens==='x'){ const h=(Y1-Y0)/2*p, ym=(Y0+Y1)/2;
        tuiles.push([[X0,Y0,0],[X1,Y0,0],[X1,ym,h],[X0,ym,h]],[[X1,Y1,0],[X0,Y1,0],[X0,ym,h],[X1,ym,h]]);
        pignons.push([[X0,Y0,0],[X0,ym,h],[X0,Y1,0]],[[X1,Y0,0],[X1,Y1,0],[X1,ym,h]]);
        return { tuiles, pignons, ext, aretes:[[[X0,ym,h],[X1,ym,h]]] }; }
      else { const h=(X1-X0)/2*p, xm=(X0+X1)/2;
        tuiles.push([[X0,Y0,0],[xm,Y0,h],[xm,Y1,h],[X0,Y1,0]],[[X1,Y1,0],[xm,Y1,h],[xm,Y0,h],[X1,Y0,0]]);
        pignons.push([[X0,Y0,0],[X1,Y0,0],[xm,Y0,h]],[[X1,Y1,0],[X0,Y1,0],[xm,Y1,h]]);
        return { tuiles, pignons, ext, aretes:[[[xm,Y0,h],[xm,Y1,h]]] }; }
    }
    const sq=squelette(ext,trous); if(!sq) return null;
    const V=sq.vertices.map(v=>[v[0],v[1],v[2]*p]);
    if(r.type==='2pans'){
      // pignons : chaque face triangulaire dont le sommet n'appartient qu'a elle devient verticale
      const tri=sq.polygons.filter(f=>f.length===3);
      const compte=new Map(); tri.forEach(f=>{ const s=f.find(i=>sq.vertices[i][2]>1e-6); if(s!==undefined) compte.set(s,(compte.get(s)||0)+1); });
      const pig=new Set();
      tri.forEach(f=>{ const s=f.find(i=>sq.vertices[i][2]>1e-6); if(s===undefined||compte.get(s)!==1) return;
        const [i,j]=f.filter(k=>k!==s), A=V[i], B=V[j], L2=(B[0]-A[0])**2+(B[1]-A[1])**2; if(!L2) return;
        const t=((V[s][0]-A[0])*(B[0]-A[0])+(V[s][1]-A[1])*(B[1]-A[1]))/L2;
        V[s]=[A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t, V[s][2]]; pig.add(f); });
      sq.polygons.forEach(f=>(pig.has(f)?pignons:tuiles).push(f.map(i=>V[i])));
      return { tuiles, pignons, ext, aretes:aretesSq(sq.polygons,V,ext) };
    }
    sq.polygons.forEach(f=>tuiles.push(f.map(i=>V[i])));
    return { tuiles, pignons, ext, aretes:aretesSq(sq.polygons,V,ext) };
  }
  /* Lignes du toit vues de dessus (faitages, aretiers, noues) : aretes de faces hors contour. */
  function aretesSq(polys, V, ext){
    const vues=new Map();
    polys.forEach(f=>f.forEach((i,k)=>{ const j=f[(k+1)%f.length], c=i<j?i+'-'+j:j+'-'+i; vues.set(c,[i,j]); }));
    return [...vues.values()].filter(([i,j])=>V[i][2]>1e-6||V[j][2]>1e-6).map(([i,j])=>[V[i],V[j]]);
  }
  window.facesToit = facesToit;

  /* Aretes de la partie posees sur le contour : elles portent l'acrotere d'un toit plat. */
  function aretesExterieures(niv, z){
    const P=sommetsDe(niv).slice(0,-1);
    const sur=q=>P.some((a,i)=>distSegment(q,a,P[(i+1)%P.length])<0.02);
    const c=[{x:z.x0,y:z.y0},{x:z.x1,y:z.y0},{x:z.x1,y:z.y1},{x:z.x0,y:z.y1}];
    return c.map((a,i)=>[a,c[(i+1)%4]]).filter(([a,b])=>sur({x:(a.x+b.x)/2,y:(a.y+b.y)/2}));
  }
  window.aretesToitPlat = aretesExterieures;

  /* Surfaces d'un groupe de toit (une forme ou plusieurs). */
  function surContourNiv(niv, q){ const P=sommetsDe(niv).slice(0,-1); return P.some((a,i)=>distSegment(q,a,P[(i+1)%P.length])<0.02); }
  function acroteresForme(niv, forme){
    const out=[]; forme.ext.forEach((a,i)=>{ const b=forme.ext[(i+1)%forme.ext.length]; if(surContourNiv(niv,{x:(a.x+b.x)/2,y:(a.y+b.y)/2})) out.push([a,b]); }); return out;
  }
  window.acroteresForme = acroteresForme;
  function mesuresGroupe(niv, g){
    const r=g.reglage; let proj=0, acro=0;
    g.formes.forEach(f=>{
      if(r.type==='plat'){ proj+=Math.abs(aireS(f.ext))-(f.trous||[]).reduce((s,h)=>s+Math.abs(aireS(h)),0);
        acro+=acroteresForme(niv,f).reduce((s,[a,b])=>s+Math.hypot(b.x-a.x,b.y-a.y),0); }
      else { proj+=Math.abs(aireS(decaler(f.ext,r.debord)))-(f.trous||[]).reduce((s,h)=>s+Math.abs(aireS(decaler(h,-r.debord))),0); }
    });
    const pp=r.type==='plat'?0:r.pente/100;
    return { type:r.type, projetee:proj, rampant:proj*Math.sqrt(1+pp*pp), acrotere:acro };
  }
  function resume(niv){
    const gs=groupes(niv); if(!gs.length) return null;
    return gs.map(g=>{ const r=g.reglage, m=mesuresGroupe(niv,g);
      return { type:r.type, libelle:TYPES[r.type], pente:r.type==='plat'?0:r.pente, debord:r.type==='plat'?0:r.debord,
        acrotere_h:r.type==='plat'?r.acrotere:0, surface_projetee:+m.projetee.toFixed(2), surface_rampant:+m.rampant.toFixed(2), acrotere_ml:+m.acrotere.toFixed(2) }; });
  }
  window.toitureResume = resume;
  // tout le niveau sous une dalle : il porte un plancher (analyse des portees)
  window.toitPlat = niv => { const zs=zones(niv); return zs.length>0 && zs.every(z=>reglage(niv,z).type==='plat'); };
  window.texteToiture = function(){
    const L=[];
    niveaux.forEach(n=>{
      const r=resume(n); if(!r) return;
      const tuile=r.filter(x=>x.type!=='plat'), plat=r.filter(x=>x.type==='plat');
      const types=[...new Set(r.map(x=>x.libelle))].join(', ');
      let t=`${n.nom} : toiture ${types}`;
      if(tuile.length) t+=` — couverture ${tuile.reduce((s,x)=>s+x.surface_rampant,0).toFixed(1)} m² (pente ${[...new Set(tuile.map(x=>x.pente))].join('/')} %)`;
      if(plat.length) t+=` — toit plat ${plat.reduce((s,x)=>s+x.surface_projetee,0).toFixed(1)} m², acrotère ${plat.reduce((s,x)=>s+x.acrotere_ml,0).toFixed(1)} ml`;
      L.push(t);
    });
    return L.join('\n');
  };

  /* ---------------- dessin sur le plan ---------------- */
  function dessin(niv, o){
    if(mode!=='toiture') return '';
    const gs=groupes(niv); if(!gs.length) return '';
    if(!sqPret) chargerSquelette();
    const {po,tr}=o; let g='';
    g+=`<defs><pattern id="hachPlat" patternUnits="userSpaceOnUse" width="0.3" height="0.3"><path d="M0,0.3 L0.3,0" stroke="#8E8A82" stroke-width="0.03"/></pattern>
      <marker id="flToit" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#8A3B1E"/></marker></defs>`;
    const pts=r=>r.map(q=>`${q.x},${-q.y}`).join(' ');
    gs.forEach(gr=>{
      const r=gr.reglage, sel=gr.zones.some(z=>z.cle===zoneSel), col=sel?'#C0392B':'#8A3B1E', w=tr*(sel?2:1.3);
      gr.formes.forEach(f=>{
        const fc=facesToit(f,r), ext=fc?fc.ext:decaler(f.ext, r.type==='plat'?0:r.debord);
        g+=`<polygon points="${pts(ext)}" fill="${r.type==='plat'?'url(#hachPlat)':'rgba(180,83,47,.10)'}" stroke="${col}" stroke-width="${w}" ${r.type==='plat'?'':`stroke-dasharray="${po*.6} ${po*.35}"`}/>`;
        (f.trous||[]).forEach(h=>g+=`<polygon points="${pts(h)}" fill="#FCFAF5" stroke="${col}" stroke-width="${w}"/>`);
        if(fc&&fc.aretes) fc.aretes.forEach(([a,b])=>g+=`<line x1="${a[0]}" y1="${-a[1]}" x2="${b[0]}" y2="${-b[1]}" stroke="${col}" stroke-width="${w}"/>`);
        if(fc&&r.type==='2pans') fc.pignons.forEach(pg=>{ const bas=pg.filter(q=>q[2]<1e-6); if(bas.length>=2) g+=`<line x1="${bas[0][0]}" y1="${-bas[0][1]}" x2="${bas[1][0]}" y2="${-bas[1][1]}" stroke="${col}" stroke-width="${w*2.2}"/>`; });
        if(fc&&r.type==='diamant'&&!fc.aretes) fc.tuiles.forEach(t3=>g+=`<line x1="${t3[0][0]}" y1="${-t3[0][1]}" x2="${t3[2][0]}" y2="${-t3[2][1]}" stroke="${col}" stroke-width="${w}"/>`);
        if(r.type==='plat') acroteresForme(niv,f).forEach(([a,b])=>g+=`<line x1="${a.x}" y1="${-a.y}" x2="${b.x}" y2="${-b.y}" stroke="#4A4741" stroke-width="${tr*3}"/>`);
        if(!fc && r.type!=='plat') g+=`<text x="${ext[0].x}" y="${-ext[0].y-po}" font-size="${po*.8}" fill="${col}">calcul du toit…</text>`;
      });
      if(r.type==='1pan'){ const z=gr.zones.reduce((m,q)=>(q.x1-q.x0)*(q.y1-q.y0)>(m.x1-m.x0)*(m.y1-m.y0)?q:m), xm=(z.x0+z.x1)/2, ym=(z.y0+z.y1)/2, W=z.x1-z.x0, D=z.y1-z.y0;
        const v={N:[0,1],S:[0,-1],E:[1,0],O:[-1,0]}[r.bas]||[0,-1];
        g+=`<line x1="${xm-v[0]*W*0.3}" y1="${-(ym-v[1]*D*0.3)}" x2="${xm+v[0]*W*0.3}" y2="${-(ym+v[1]*D*0.3)}" stroke="#8A3B1E" stroke-width="${tr*1.2}" marker-end="url(#flToit)"/>`; }
      const m=mesuresGroupe(niv,gr);
      const z=gr.zones.reduce((a,q)=>(q.x1-q.x0)*(q.y1-q.y0)>(a.x1-a.x0)*(a.y1-a.y0)?q:a), xm=(z.x0+z.x1)/2, ym=(z.y0+z.y1)/2;
      const t1=r.type==='plat' ? `Toit plat · acrotère ${f2(r.acrotere)} m` : `${TYPES[r.type]} · ${r.pente} %`;
      const t2=r.type==='plat' ? `${f1(m.projetee)} m² · ${f1(m.acrotere)} ml d'acrotère` : `${f1(m.rampant)} m² de couverture`;
      g+=`<g style="pointer-events:none"><rect x="${xm-po*5.2}" y="${-ym-po*1.05}" width="${po*10.4}" height="${po*2.3}" rx="${po*.3}" fill="rgba(255,255,255,.9)"/>
        <text x="${xm}" y="${-ym}" font-size="${po*.85}" font-family="IBM Plex Sans,sans-serif" font-weight="600" fill="${col}" text-anchor="middle">${t1}</text>
        <text x="${xm}" y="${-ym+po*.95}" font-size="${po*.75}" font-family="IBM Plex Mono,monospace" fill="${col}" text-anchor="middle">${t2}</text></g>`;
    });
    if(zoneSel){ const z=zones(niv).find(q=>q.cle===zoneSel); if(z&&!z.poly) g+=`<rect x="${z.x0}" y="${-z.y1}" width="${z.x1-z.x0}" height="${z.y1-z.y0}" fill="rgba(192,57,43,.08)" stroke="#C0392B" stroke-width="${tr*1.5}" stroke-dasharray="${po*.3} ${po*.25}"/>`; }
    return g;
  }
  (window.dessinsPlan = window.dessinsPlan || []).push(dessin);

  /* ---------------- clic et reglages ---------------- */
  window.clicToiture = function(p){
    const niv=N(), z=zones(niv).find(z=>z.poly ? dansPoly(z.poly,p.x,p.y) : (p.x>=z.x0&&p.x<=z.x1&&p.y>=z.y0&&p.y<=z.y1));
    zoneSel = z ? z.cle : null;
    recalcul();
  };
  window.viderToiture = ()=>{ zoneSel=null; };

  function zoneCourante(niv){ return zoneSel ? zones(niv).find(z=>z.cle===zoneSel) : null; }
  function rendreBarre(){
    const bar=document.getElementById('editToit'); if(!bar) return;
    if(mode!=='toiture'){ bar.hidden=true; zoneSel=null; return; }
    bar.hidden=false;
    const niv=N(), zs=zones(niv), z=zoneCourante(niv);
    const msg=document.getElementById('etoMsg');
    if(!zs.length){
      msg.textContent = estVS(niv) ? "Le vide sanitaire n'a pas de toiture : choisissez le dernier niveau dans la liste Niveau." :
        "Ce niveau est entièrement couvert par l'étage du dessus : choisissez le dernier niveau.";
      bar.querySelectorAll('.eto-c').forEach(e=>e.hidden=true); return;
    }
    msg.textContent='';
    bar.querySelectorAll('.eto-c').forEach(e=>e.hidden=false);
    const r=reglage(niv,z);
    document.getElementById('etoTitre').textContent = z ? `Partie ${zs.findIndex(x=>x.cle===z.cle)+1} de la toiture` : (zs.length>1?'Toute la toiture':'Toiture');
    const v=(id,val)=>{ const e=document.getElementById(id); if(document.activeElement!==e) e.value=val; };
    v('etoType', r.type); v('etoPente', String(r.pente).replace('.',',')); v('etoDeb', String(r.debord).replace('.',','));
    v('etoSens', r.sens); v('etoBas', r.bas); v('etoAcro', String(r.acrotere).replace('.',','));
    document.getElementById('etoPenteB').hidden = r.type==='plat';
    document.getElementById('etoDebB').hidden = r.type==='plat';
    document.getElementById('etoSensB').hidden = !(r.type==='2pans' && zs.length===1 && !zs[0].poly);
    document.getElementById('etoBasB').hidden = r.type!=='1pan';
    document.getElementById('etoAcroB').hidden = r.type!=='plat';
    document.getElementById('etoTout').hidden = !z;
    document.getElementById('etoGeneral').hidden = !(z && toitDe(niv).parties[z.cle]);
    document.getElementById('etoAide').textContent = zs.length>1 && !z ? `Ces réglages s'appliquent à tout le toit, qui ne forme qu'un seul ensemble. Pour traiter une partie à part (garage en toit plat…), cliquez-la sur le plan.` : '';
    // totaux
    const res=resume(niv)||[];
    const tuile=res.filter(x=>x.type!=='plat'), plat=res.filter(x=>x.type==='plat');
    document.getElementById('etoResume').innerHTML =
      (tuile.length?`<div>Couverture : <b>${f1(tuile.reduce((s,x)=>s+x.surface_rampant,0))} m²</b></div>`:'')+
      (plat.length?`<div>Toit plat : <b>${f1(plat.reduce((s,x)=>s+x.surface_projetee,0))} m²</b> · acrotère <b>${f1(plat.reduce((s,x)=>s+x.acrotere_ml,0))} ml</b></div>`:'')+
      zs.filter(z=>reglage(niv,z).type==='plat').map(z=>{ const e=horsTout(niv), pt=Math.min(z.x1-z.x0,z.y1-z.y0)-2*e, lim=6.0;
        return pt>lim+0.05 ? `<div style="color:#8A1C16">Dalle de ${f2(pt)} m de portée : au-delà de ${f1(lim)} m, prévoir un mur porteur ou une poutre.</div>`
          : `<div style="color:#2E5236">Dalle : portée ${f2(pt)} m.</div>`; }).join('');
  }
  window.majToiture = function(){
    const niv=N(), z=zoneCourante(niv), t=toitDe(niv);
    const num=id=>parseFloat(String(document.getElementById(id).value).replace(',','.'));
    const val={ type:document.getElementById('etoType').value, sens:document.getElementById('etoSens').value, bas:document.getElementById('etoBas').value };
    const pe=num('etoPente'), de=num('etoDeb'), ac=num('etoAcro');
    if(pe>=0&&pe<=150) val.pente=pe; if(de>=0&&de<=2) val.debord=de; if(ac>=0&&ac<=2) val.acrotere=ac;
    if(z) t.parties[z.cle] = { ...(t.parties[z.cle]||{}), ...val };
    else { t.general = { ...t.general, ...val }; t.parties = {}; }
    recalcul();
  };
  window.toitPourTout = function(){
    const niv=N(), z=zoneCourante(niv), t=toitDe(niv); if(!z) return;
    t.general = reglage(niv,z); t.parties={}; zoneSel=null; recalcul();
  };
  window.toitGeneral = function(){
    const niv=N(), z=zoneCourante(niv), t=toitDe(niv); if(!z) return;
    delete t.parties[z.cle]; recalcul();
  };
  (window.apresRecalcul = window.apresRecalcul || []).push(rendreBarre);
  window.TYPES_TOIT = TYPES;
  // le toit se calcule des que l'on ouvre l'outil
  document.addEventListener('click', e=>{ if(e.target && e.target.id==='mToiture') chargerSquelette(); }, true);
})();
