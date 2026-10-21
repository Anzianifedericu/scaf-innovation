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
    return rectangles(sommetsDe(niv).slice(0,-1))
      .filter(R=>!dessusP.some(P=>dansPoly(P,(R.x0+R.x1)/2,(R.y0+R.y1)/2)))
      .map(R=>({...R, cle:cle(R)}));
  }
  function toitDe(niv){ return niv.toiture || (niv.toiture = { general:{...DEFAUT}, parties:{} }); }
  function reglage(niv, z){ const t=toitDe(niv); return { ...DEFAUT, ...t.general, ...(z && t.parties[z.cle] || {}) }; }
  window.zonesToiture = zones;
  window.reglageToiture = reglage;

  /* Aretes de la partie posees sur le contour : elles portent l'acrotere d'un toit plat. */
  function aretesExterieures(niv, z){
    const P=sommetsDe(niv).slice(0,-1);
    const sur=q=>P.some((a,i)=>distSegment(q,a,P[(i+1)%P.length])<0.02);
    const c=[{x:z.x0,y:z.y0},{x:z.x1,y:z.y0},{x:z.x1,y:z.y1},{x:z.x0,y:z.y1}];
    return c.map((a,i)=>[a,c[(i+1)%4]]).filter(([a,b])=>sur({x:(a.x+b.x)/2,y:(a.y+b.y)/2}));
  }
  window.aretesToitPlat = aretesExterieures;

  /* Surfaces d'une partie de toit. */
  function mesures(niv, z){
    const r=reglage(niv,z), W=z.x1-z.x0, D=z.y1-z.y0;
    if(r.type==='plat'){
      const acro=aretesExterieures(niv,z).reduce((t,[a,b])=>t+Math.hypot(b.x-a.x,b.y-a.y),0);
      return { type:r.type, projetee:W*D, rampant:W*D, acrotere:acro };
    }
    const d=r.debord, proj=(W+2*d)*(D+2*d), p=r.pente/100;
    return { type:r.type, projetee:proj, rampant:proj*Math.sqrt(1+p*p), acrotere:0 };
  }
  function resume(niv){
    const zs=zones(niv); if(!zs.length) return null;
    return zs.map(z=>{ const r=reglage(niv,z), m=mesures(niv,z);
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
    const zs=zones(niv); if(!zs.length) return '';
    const actif = mode==='toiture';
    const {po,tr}=o; let g='';
    if(!actif){
      // hors du mode Toiture : un simple rappel discret du faitage
      return '';
    }
    g+=`<defs><pattern id="hachPlat" patternUnits="userSpaceOnUse" width="0.3" height="0.3"><path d="M0,0.3 L0.3,0" stroke="#8E8A82" stroke-width="0.03"/></pattern>
      <marker id="flToit" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#8A3B1E"/></marker></defs>`;
    zs.forEach((z,k)=>{
      const r=reglage(niv,z), sel=zoneSel===z.cle, col=sel?'#C0392B':'#8A3B1E', w=tr*(sel?2.2:1.3);
      const d=r.type==='plat'?0:r.debord;
      const X0=z.x0-d, X1=z.x1+d, Y0=z.y0-d, Y1=z.y1+d, W=X1-X0, D=Y1-Y0, xm=(X0+X1)/2, ym=(Y0+Y1)/2;
      const L=(a,b,dash)=>`<line x1="${a[0]}" y1="${-a[1]}" x2="${b[0]}" y2="${-b[1]}" stroke="${col}" stroke-width="${w}" ${dash?`stroke-dasharray="${po*.5} ${po*.3}"`:''} />`;
      const fl=(a,b)=>`<line x1="${a[0]}" y1="${-a[1]}" x2="${b[0]}" y2="${-b[1]}" stroke="#8A3B1E" stroke-width="${tr*1.2}" marker-end="url(#flToit)"/>`;
      g+=`<rect x="${X0}" y="${-Y1}" width="${W}" height="${D}" fill="${r.type==='plat'?'url(#hachPlat)':'rgba(180,83,47,.10)'}" stroke="${col}" stroke-width="${w}" stroke-dasharray="${r.type==='plat'?'':`${po*.6} ${po*.35}`}"/>`;
      if(r.type==='4pans'){
        if(W>=D){ const A=[X0+D/2,ym], B=[X1-D/2,ym]; g+=L(A,B)+L([X0,Y0],A)+L([X0,Y1],A)+L([X1,Y0],B)+L([X1,Y1],B); }
        else    { const A=[xm,Y0+W/2], B=[xm,Y1-W/2]; g+=L(A,B)+L([X0,Y0],A)+L([X1,Y0],A)+L([X0,Y1],B)+L([X1,Y1],B); }
      } else if(r.type==='diamant'){
        [[X0,Y0],[X1,Y0],[X1,Y1],[X0,Y1]].forEach(c=>g+=L(c,[xm,ym]));
      } else if(r.type==='2pans'){
        const enX = r.sens==='x' || (r.sens==='auto' && W>=D);
        if(enX){ g+=L([X0,ym],[X1,ym]); g+=fl([xm,ym+D*0.08],[xm,Y1-D*0.08])+fl([xm,ym-D*0.08],[xm,Y0+D*0.08]); }
        else   { g+=L([xm,Y0],[xm,Y1]); g+=fl([xm+W*0.08,ym],[X1-W*0.08,ym])+fl([xm-W*0.08,ym],[X0+W*0.08,ym]); }
      } else if(r.type==='1pan'){
        const v={N:[0,1],S:[0,-1],E:[1,0],O:[-1,0]}[r.bas]||[0,-1];
        g+=fl([xm-v[0]*W*0.3, ym-v[1]*D*0.3],[xm+v[0]*W*0.3, ym+v[1]*D*0.3]);
      } else if(r.type==='plat'){
        aretesExterieures(niv,z).forEach(([a,b])=>g+=`<line x1="${a.x}" y1="${-a.y}" x2="${b.x}" y2="${-b.y}" stroke="#4A4741" stroke-width="${tr*3}"/>`);
      }
      const m=mesures(niv,z);
      const t1=r.type==='plat' ? `Toit plat · acrotère ${f2(r.acrotere)} m` : `${TYPES[r.type]} · ${r.pente} %`;
      const t2=r.type==='plat' ? `${f1(m.projetee)} m² · ${f1(m.acrotere)} ml d'acrotère` : `${f1(m.rampant)} m² de couverture`;
      g+=`<g style="pointer-events:none"><rect x="${xm-po*5.2}" y="${-ym-po*1.05}" width="${po*10.4}" height="${po*2.3}" rx="${po*.3}" fill="rgba(255,255,255,.88)"/>
        <text x="${xm}" y="${-ym}" font-size="${po*.85}" font-family="IBM Plex Sans,sans-serif" font-weight="600" fill="${col}" text-anchor="middle">${t1}</text>
        <text x="${xm}" y="${-ym+po*.95}" font-size="${po*.75}" font-family="IBM Plex Mono,monospace" fill="${col}" text-anchor="middle">${t2}</text></g>`;
    });
    return g;
  }
  (window.dessinsPlan = window.dessinsPlan || []).push(dessin);

  /* ---------------- clic et reglages ---------------- */
  window.clicToiture = function(p){
    const niv=N(), z=zones(niv).find(z=>{ const d=reglage(niv,z).type==='plat'?0:reglage(niv,z).debord;
      return p.x>=z.x0-d&&p.x<=z.x1+d&&p.y>=z.y0-d&&p.y<=z.y1+d; });
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
    document.getElementById('etoSensB').hidden = r.type!=='2pans';
    document.getElementById('etoBasB').hidden = r.type!=='1pan';
    document.getElementById('etoAcroB').hidden = r.type!=='plat';
    document.getElementById('etoTout').hidden = !z;
    document.getElementById('etoGeneral').hidden = !(z && toitDe(niv).parties[z.cle]);
    document.getElementById('etoAide').textContent = zs.length>1 && !z ? `Votre toit compte ${zs.length} parties : ces réglages s'appliquent à toutes ; cliquez une partie sur le plan pour la régler à part.` : '';
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
})();
