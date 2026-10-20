/* Maquette 3D de la maison tracee : murs Nudura a leur epaisseur reelle,
   refends, cloisons, ouvertures avec leurs menuiseries, planchers, pieces
   nommees et toiture en tuiles. Le visiteur choisit ses couleurs et regarde
   le soleil tourner autour de sa maison. Three.js est charge a la demande. */
(function(){
  'use strict';
  const BASE = 'https://cdn.jsdelivr.net/npm/three@0.128.0/';
  let charge = null;
  function chargerThree(){
    if(window.THREE && THREE.OrbitControls) return Promise.resolve();
    if(charge) return charge;
    const js = src => new Promise((ok,ko)=>{ const s=document.createElement('script'); s.src=src; s.onload=ok; s.onerror=ko; document.head.appendChild(s); });
    charge = js(BASE+'build/three.min.js').then(()=>js(BASE+'examples/js/controls/OrbitControls.js'));
    return charge;
  }

  const css = `
  .m3-voile{position:fixed;inset:0;z-index:1100;background:#111;display:flex}
  .m3-vue{flex:1;position:relative;min-width:0}
  .m3-vue canvas{display:block;width:100%;height:100%;touch-action:none}
  .m3-panneau{width:300px;max-width:42vw;background:#FBF8F1;overflow:auto;padding:18px 18px 24px;display:flex;flex-direction:column;gap:14px}
  .m3-panneau h3{margin:0;font:600 20px Fraunces,Georgia,serif}
  .m3-panneau h4{margin:0 0 6px;font:600 13px 'IBM Plex Sans',sans-serif;color:#2E2B26}
  .m3-panneau p{margin:0;font-size:12.5px;color:#6B6459;line-height:1.45}
  .m3-pastilles{display:flex;gap:7px;flex-wrap:wrap}
  .m3-pastille{width:32px;height:32px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #CFC6B3;cursor:pointer;padding:0}
  .m3-pastille.choisie{box-shadow:0 0 0 3px #3F6B4A}
  .m3-seg{display:flex;gap:4px;flex-wrap:wrap}
  .m3-seg button{flex:1;padding:7px 8px}
  .m3-seg button.actif{background:#3F6B4A;border-color:#3F6B4A;color:#fff}
  .m3-fermer{position:absolute;top:12px;left:12px;z-index:2;background:rgba(255,255,255,.92)}
  .m3-aide{position:absolute;bottom:12px;left:12px;right:12px;text-align:center;color:#fff;font-size:12px;text-shadow:0 1px 3px #000;pointer-events:none}
  .m3-charge{position:absolute;inset:0;display:grid;place-items:center;color:#fff;font:500 15px 'IBM Plex Sans',sans-serif}
  .m3-suite{background:#3F6B4A;border-color:#3F6B4A;color:#fff;font-weight:600;padding:11px;font-size:14px}
  @media(max-width:760px){.m3-voile{flex-direction:column}.m3-panneau{width:auto;max-width:none;max-height:42vh}}
  `;

  let etat = null; // { renderer, scene, camera, controls, raf, groupes... }
  const reglages = { vue:'exterieur', heure:15, niveauMax:null };

  function fermer(){
    if(!etat) return;
    cancelAnimationFrame(etat.raf);
    removeEventListener('resize', etat.redim);
    etat.renderer.dispose();
    etat.voile.remove();
    etat = null;
  }

  async function ouvrir(){
    if(etat) fermer();
    if(!document.getElementById('m3css')){ const st=document.createElement('style'); st.id='m3css'; st.textContent=css; document.head.appendChild(st); }
    const pr = window.projetMaison || {};
    const { FACADES, MENUISERIES, TUILES } = window.PALETTES_MAISON;
    const voile = document.createElement('div'); voile.className='m3-voile';
    const elev = niveaux.filter(n=>n.ferme&&n.murs.length&&n.hauteur>=1.8);
    voile.innerHTML = `
      <div class="m3-vue"><button class="m3-fermer">← Retour au plan</button>
        <div class="m3-charge">Construction de votre maison…</div>
        <div class="m3-aide">Faites tourner avec la souris ou un doigt · molette ou deux doigts pour zoomer</div></div>
      <aside class="m3-panneau">
        <div><h3>Ma maison en 3D</h3><p>Maquette indicative, construite à partir de votre plan. Choisissez vos couleurs.</p></div>
        <div><h4>Vue</h4><div class="m3-seg" data-g="vue">
          <button data-v="exterieur">Extérieur</button><button data-v="interieur">Intérieur</button></div></div>
        ${elev.length>1?`<div><h4>Niveaux affichés</h4><div class="m3-seg" data-g="niv">
          ${elev.map(n=>`<button data-v="${n.nom}">${n.nom==='RDC'?'RDC':'Jusqu\'au '+n.nom}</button>`).join('')}</div></div>`:''}
        <div><h4>Façade (enduit)</h4><div class="m3-pastilles" data-g="facade">${Object.entries(FACADES).map(([k,[l,c]])=>`<button class="m3-pastille" title="${l}" data-v="${k}" style="background:${c}"></button>`).join('')}</div></div>
        <div><h4>Menuiseries</h4><div class="m3-pastilles" data-g="menuiseries">${Object.entries(MENUISERIES).map(([k,[l,c]])=>`<button class="m3-pastille" title="${l}" data-v="${k}" style="background:${c}"></button>`).join('')}</div></div>
        <div><h4>Tuiles</h4><div class="m3-pastilles" data-g="tuile">${Object.entries(TUILES).map(([k,[l,c]])=>`<button class="m3-pastille" title="${l}" data-v="${k}" style="background:${c}"></button>`).join('')}</div></div>
        <div><h4>Soleil : <span id="m3h">15 h</span></h4><input type="range" min="7" max="20" step="0.25" value="${reglages.heure}" id="m3soleil" style="width:100%">
          <p>Le haut du plan est orienté au nord.</p></div>
        <button class="m3-suite">Mon projet →</button>
        <p style="font-size:11px">Rendu non contractuel : toiture, couleurs et proportions sont données à titre d'illustration.</p>
      </aside>`;
    document.body.appendChild(voile);
    const vue = voile.querySelector('.m3-vue');
    voile.querySelector('.m3-fermer').onclick = ()=>{ fermer(); };
    voile.querySelector('.m3-suite').onclick = ()=>{ fermer(); window.ouvrirMonProjet && window.ouvrirMonProjet(); };

    try{ await chargerThree(); }
    catch(e){ voile.querySelector('.m3-charge').textContent = "La 3D n'a pas pu se charger. Vérifiez votre connexion."; return; }
    voile.querySelector('.m3-charge').remove();

    const renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio||1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    vue.insertBefore(renderer.domElement, vue.firstChild);
    const scene = new THREE.Scene();
    const ciel = new THREE.Color('#BFD7EA').convertSRGBToLinear();
    scene.background = ciel;
    scene.fog = new THREE.Fog(ciel, 60, 160);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.maxPolarAngle = Math.PI*0.495; controls.minDistance = 3; controls.maxDistance = 90;

    scene.add(new THREE.HemisphereLight('#EAF3FF', '#7A8B5C', 0.45));
    const soleil = new THREE.DirectionalLight('#FFF4DE', 1.0);
    soleil.castShadow = true; soleil.shadow.mapSize.set(2048,2048);
    Object.assign(soleil.shadow.camera, { left:-30, right:30, top:30, bottom:-30, near:1, far:120 });
    scene.add(soleil); scene.add(soleil.target);

    etat = { renderer, scene, camera, controls, voile, soleil, maison:null, raf:0 };
    etat.redim = ()=>{ const r=vue.getBoundingClientRect(); renderer.setSize(r.width, r.height, false); camera.aspect=r.width/Math.max(1,r.height); camera.updateProjectionMatrix(); };
    addEventListener('resize', etat.redim); etat.redim();

    const sol = new THREE.Mesh(new THREE.CircleGeometry(120, 64), new THREE.MeshLambertMaterial({ color:new THREE.Color('#7E9A55').convertSRGBToLinear() }));
    sol.rotation.x = -Math.PI/2; sol.receiveShadow = true; scene.add(sol); etat.sol = sol;

    // reglages
    const marquerChoix = ()=>{
      voile.querySelectorAll('[data-g]').forEach(gp=>{
        const g = gp.dataset.g, v = g==='vue' ? reglages.vue : g==='niv' ? reglages.niveauMax : pr[g];
        gp.querySelectorAll('[data-v]').forEach(b=>b.classList.toggle(gp.classList.contains('m3-seg')?'actif':'choisie', b.dataset.v===v));
      });
    };
    voile.querySelectorAll('[data-g]').forEach(gp=>gp.addEventListener('click', e=>{
      const b = e.target.closest('[data-v]'); if(!b) return;
      const g = gp.dataset.g;
      if(g==='vue') reglages.vue = b.dataset.v;
      else if(g==='niv') reglages.niveauMax = b.dataset.v;
      else pr[g] = b.dataset.v;
      construire(); marquerChoix();
    }));
    const curseurSol = voile.querySelector('#m3soleil');
    curseurSol.oninput = ()=>{ reglages.heure = +curseurSol.value; placerSoleil(); };
    if(!reglages.niveauMax || !elev.some(n=>n.nom===reglages.niveauMax)) reglages.niveauMax = elev.length ? elev[elev.length-1].nom : null;
    marquerChoix();
    construire(true);
    placerSoleil();

    const boucle = ()=>{ etat.raf = requestAnimationFrame(boucle); controls.update(); renderer.render(scene, camera); };
    boucle();
  }

  function placerSoleil(){
    const h = reglages.heure, a = (h-6)/14*Math.PI, R = 60;
    const c = etat.centre || new THREE.Vector3();
    etat.soleil.position.set(c.x + Math.cos(a)*R, Math.max(4, Math.sin(a)*R*0.85), c.z + Math.sin(a)*R*0.75);
    etat.soleil.target.position.copy(c);
    etat.soleil.intensity = 0.35 + 0.75*Math.max(0, Math.sin(a));
    etat.soleil.color.set(h<8.5||h>18.5 ? '#FFD2A1' : '#FFF4DE');
    const lab = document.getElementById('m3h');
    if(lab){ const hh=Math.floor(h), mm=Math.round((h-hh)*60); lab.textContent = `${hh} h${mm?String(mm).padStart(2,'0'):''}`; }
  }

  /* ---------------- geometrie ---------------- */
  function sommetsPlan(niv){ let x=0,y=0; const p=[{x,y}]; niv.murs.forEach(m=>{ x+=m.dx*m.longueur; y+=m.dy*m.longueur; p.push({x,y}); }); return p.slice(0,-1); }
  function dansPoly(poly,x,y){ let c=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const P=poly[i],Q=poly[j]; if((P.y>y)!==(Q.y>y)&&x<(Q.x-P.x)*(y-P.y)/(Q.y-P.y)+P.x) c=!c; } return c; }

  // Allege des ouvertures : linteau commun a 2,15 m, sauf portes et baies qui descendent au sol.
  function bornesOuv(o, h){
    if(o.nature==='passage') return [0.30, Math.min(h-0.1, 0.30+o.hauteur)];
    const sol = ['porte','porte-entree','porte-garage','porte-fenetre','baie'].includes(o.nature);
    if(sol) return [0, Math.min(h-0.05, o.hauteur)];
    const haut = Math.min(h-0.2, 2.15);
    return [Math.max(0.2, haut-o.hauteur), haut];
  }

  function construire(premier){
    const pr = window.projetMaison || {};
    const { FACADES, MENUISERIES, TUILES } = window.PALETTES_MAISON;
    if(etat.maison){ etat.scene.remove(etat.maison); etat.maison.traverse(o=>{ if(o.geometry) o.geometry.dispose(); }); }
    const maison = new THREE.Group(); etat.maison = maison; etat.scene.add(maison);

    const C = c => new THREE.Color(c).convertSRGBToLinear();
    const mat = c => new THREE.MeshStandardMaterial({ color:C(c), roughness:0.9, metalness:0 });
    const mFacade = mat(FACADES[pr.facade||'blanc-casse'][1]);
    const mInt = mat('#F3EFE7'), mCloison = mat('#FAF8F3');
    const mMenu = new THREE.MeshStandardMaterial({ color:C(MENUISERIES[pr.menuiseries||'blanc'][1]), roughness:0.5 });
    const mVerre = new THREE.MeshStandardMaterial({ color:C('#7FA9C4'), roughness:0.1, metalness:0.2, transparent:true, opacity:0.45 });
    const mSol = mat('#D9C7A5'), mDalle = mat('#B9B4AA');
    const mTuile = new THREE.MeshStandardMaterial({ color:C(TUILES[pr.tuile||'terre-cuite'][1]), roughness:0.85, flatShading:true, side:THREE.DoubleSide });
    const mVS = mat('#B8B2A6');

    const ombre = m => { m.castShadow = true; m.receiveShadow = true; return m; };
    // un pave le long d'un segment du plan : de a vers b, epais de e vers n (normale), entre y0 et y1
    function pave(a, b, n, e, y0, y1, m, decal=0){
      const dx=b.x-a.x, dy=b.y-a.y, L=Math.hypot(dx,dy); if(L<0.01||y1-y0<0.01) return;
      const g = new THREE.BoxGeometry(L, y1-y0, e);
      const me = new THREE.Mesh(g, m);
      const cx=(a.x+b.x)/2 + n.x*(e/2+decal), cy=(a.y+b.y)/2 + n.y*(e/2+decal);
      me.position.set(cx, (y0+y1)/2, -cy);
      me.rotation.y = Math.atan2(dy, dx);
      maison.add(ombre(me));
    }
    // un mur perce de ses ouvertures : on pose les trumeaux, les alleges et les linteaux
    function murPerce(a, b, n, e, base, h, ouvs, mExt, mIntr){
      const L=Math.hypot(b.x-a.x,b.y-a.y), ux=(b.x-a.x)/L, uy=(b.y-a.y)/L;
      const P=u=>({x:a.x+ux*u, y:a.y+uy*u});
      const trous = ouvs.map(o=>{ const c=o.t*L, w=Math.min(o.largeur, L-0.1); const [s0,s1]=bornesOuv(o,h); return {u0:Math.max(0,c-w/2), u1:Math.min(L,c+w/2), s0, s1, o}; })
                        .sort((p,q)=>p.u0-q.u0);
      let u=0;
      trous.forEach(t=>{
        if(t.u0>u) pave(P(u),P(t.u0),n,e,base,base+h,mExt);
        pave(P(t.u0),P(t.u1),n,e,base,base+t.s0,mExt);
        pave(P(t.u0),P(t.u1),n,e,base+t.s1,base+h,mExt);
        menuiserie(P(t.u0),P(t.u1),n,e,base+t.s0,base+t.s1,t.o);
        u=Math.max(u,t.u1);
      });
      if(u<L) pave(P(u),b,n,e,base,base+h,mExt);
    }
    function menuiserie(a,b,n,e,y0,y1,o){
      if(o.nature==='passage') return;
      const ep=0.07, recul=Math.min(0.12, e/3);
      if(o.nature==='porte'||o.nature==='porte-entree'||o.nature==='porte-garage'){
        pave(a,b,n,ep,y0,y1, o.nature==='porte'&&o.sur==='refend' ? new THREE.MeshStandardMaterial({color:C('#B98E5E'),roughness:.7}) : mMenu, recul);
        return;
      }
      // cadre et vitrage
      const L=Math.hypot(b.x-a.x,b.y-a.y), ux=(b.x-a.x)/L, uy=(b.y-a.y)/L, c=0.06;
      const P=u=>({x:a.x+ux*u,y:a.y+uy*u});
      pave(a,b,n,ep,y0,y0+c,mMenu,recul); pave(a,b,n,ep,y1-c,y1,mMenu,recul);
      pave(a,P(c),n,ep,y0,y1,mMenu,recul); pave(P(L-c),b,n,ep,y0,y1,mMenu,recul);
      if(L>1.3) pave(P(L/2-c/2),P(L/2+c/2),n,ep,y0,y1,mMenu,recul);
      pave(P(c),P(L-c),n,0.02,y0+c,y1-c,mVerre,recul+0.025);
      if(o.volet){ // coffre de volet roulant, cote interieur
        pave(a,b,n,0.18,y1-0.02,y1+0.2,mMenu,e-0.18);
      }
    }
    function texte(t, sous){
      const cv=document.createElement('canvas'); cv.width=512; cv.height=160;
      const x=cv.getContext('2d');
      x.fillStyle='rgba(255,255,255,0.88)'; const r=26;
      x.beginPath(); x.moveTo(r,0); x.arcTo(512,0,512,160,r); x.arcTo(512,160,0,160,r); x.arcTo(0,160,0,0,r); x.arcTo(0,0,512,0,r); x.fill();
      x.fillStyle='#2E4F37'; x.textAlign='center'; x.font='600 54px "IBM Plex Sans", sans-serif'; x.fillText(t,256,70);
      x.font='500 44px "IBM Plex Mono", monospace'; x.fillStyle='#3F6B4A'; x.fillText(sous,256,130);
      const sp=new THREE.Sprite(new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(cv), depthTest:false }));
      sp.scale.set(2.4,0.75,1); sp.renderOrder=10; return sp;
    }

    // empilement des niveaux : le vide sanitaire est a demi enterre
    const prets = niveaux.filter(n=>n.ferme&&n.murs.length);
    const iMax = prets.findIndex(n=>n.nom===reglages.niveauMax);
    let base = 0, solY = null, sommet = null, minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    prets.forEach((niv, k)=>{
      const vs = niv.hauteur < 1.8;
      const h = niv.hauteur;
      if(vs && solY===null) solY = base + h*0.5;
      if(!vs && solY===null) solY = base;
      const cache = reglages.vue==='interieur' && iMax>=0 && k>iMax && !vs;
      const pts = sommetsPlan(niv), e = horsTout(niv);
      pts.forEach(p=>{ minX=Math.min(minX,p.x); maxX=Math.max(maxX,p.x); minY=Math.min(minY,p.y); maxY=Math.max(maxY,p.y); });
      if(cache){ base += h + 0.22; return; }
      // dalle basse
      const forme = new THREE.Shape(pts.map(p=>new THREE.Vector2(p.x,p.y)));
      const dalle = new THREE.Mesh(new THREE.ExtrudeGeometry(forme,{depth:0.22,bevelEnabled:false}), vs?[mDalle,mVS]:[mSol,mFacade]);
      dalle.rotation.x = -Math.PI/2; dalle.position.y = base - 0.22; maison.add(ombre(dalle));
      // murs exterieurs
      for(let i=0;i<pts.length;i++){
        const a=pts[i], b=pts[(i+1)%pts.length], L=Math.hypot(b.x-a.x,b.y-a.y);
        let n={x:-(b.y-a.y)/L, y:(b.x-a.x)/L};
        const mx=(a.x+b.x)/2+n.x*0.05, my=(a.y+b.y)/2+n.y*0.05;
        if(!dansPoly(pts,mx,my)) n={x:-n.x,y:-n.y};
        murPerce(a,b,n,e,base,h,niv.ouvertures.filter(o=>o.sur==='mur'&&o.i===i), vs?mVS:mFacade);
      }
      // refends et cloisons
      niv.refends.forEach((r,ri)=>{ for(let s=1;s<r.pts.length;s++){
        const a=r.pts[s-1], b=r.pts[s], L=Math.hypot(b.x-a.x,b.y-a.y); if(L<0.05) continue;
        const n={x:-(b.y-a.y)/L,y:(b.x-a.x)/L};
        const a2={x:a.x-n.x*e/2,y:a.y-n.y*e/2}, b2={x:b.x-n.x*e/2,y:b.y-n.y*e/2};
        murPerce(a2,b2,n,e,base,h,niv.ouvertures.filter(o=>o.sur==='refend'&&o.i===ri&&(o.seg??1)===s), vs?mVS:mInt);
      }});
      if(!vs) (niv.cloisons||[]).forEach(r=>{ for(let s=1;s<r.pts.length;s++){
        const a=r.pts[s-1], b=r.pts[s], L=Math.hypot(b.x-a.x,b.y-a.y); if(L<0.05) continue;
        const n={x:-(b.y-a.y)/L,y:(b.x-a.x)/L};
        pave({x:a.x-n.x*0.035,y:a.y-n.y*0.035},{x:b.x-n.x*0.035,y:b.y-n.y*0.035},n,0.07,base,base+Math.min(h,2.5),mCloison);
      }});
      // pieces nommees, en vue interieure
      if(!vs && reglages.vue==='interieur' && (iMax<0 || k===iMax)) (niv.pieces||[]).forEach(pc=>{
        const s = surfacePiece(niv,pc); if(!s) return;
        const sp = texte(pc.nom, s.toFixed(1).replace('.',',')+' m²'); sp.position.set(pc.x, base+1.1, -pc.y); maison.add(sp);
      });
      sommet = { niv, base, h, pts };
      base += h + 0.22;
    });

    // toiture : quatre pans sur chaque rectangle de l'emprise du dernier niveau
    if(sommet && reglages.vue==='exterieur'){
      const yT = sommet.base + sommet.h;
      const plafond = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(sommet.pts.map(p=>new THREE.Vector2(p.x,p.y))),{depth:0.22,bevelEnabled:false}), [mDalle,mFacade]);
      plafond.rotation.x=-Math.PI/2; plafond.position.y=yT; maison.add(ombre(plafond));
      rectangles(sommet.pts).forEach(R=>toit(R, yT+0.22, mTuile));
    }

    etat.sol.position.y = (solY ?? 0) - 0.01;
    const c = new THREE.Vector3((minX+maxX)/2, (solY??0)+2, -(minY+maxY)/2);
    etat.centre = c;
    if(premier){
      const t = Math.max(maxX-minX, maxY-minY, 8);
      etat.camera.position.set(c.x + t*0.95, c.y + t*0.75, c.z + t*1.25);
      etat.controls.target.copy(c); etat.controls.update();
    }
    placerSoleil();

    // decoupe d'un polygone a angles droits en rectangles (bandes horizontales fusionnees)
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
    function toit(R, y, m){
      const d=0.45, pente=0.30;
      const x0=R.x0-d, x1=R.x1+d, z0=-(R.y1+d), z1=-(R.y0-d);
      const W=x1-x0, D=z1-z0, court=Math.min(W,D), hR=court/2*pente;
      let A,B; // extremites du faitage
      if(W>=D){ A=[x0+D/2, y+hR, (z0+z1)/2]; B=[x1-D/2, y+hR, (z0+z1)/2]; }
      else    { A=[(x0+x1)/2, y+hR, z0+W/2]; B=[(x0+x1)/2, y+hR, z1-W/2]; }
      const c00=[x0,y,z0], c10=[x1,y,z0], c11=[x1,y,z1], c01=[x0,y,z1];
      const tri=[];
      const T=(p,q,r)=>tri.push(...p,...q,...r);
      if(W>=D){ T(c00,c10,B); T(c00,B,A); T(c11,c01,A); T(c11,A,B); T(c01,c00,A); T(c10,c11,B); }
      else    { T(c10,c11,B); T(c10,B,A); T(c01,c00,A); T(c01,A,B); T(c00,c10,A); T(c11,c01,B); }
      const g=new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tri,3)); g.computeVertexNormals();
      const me=new THREE.Mesh(g,m); me.castShadow=true; me.receiveShadow=true; maison.add(me);
    }
  }

  window.ouvrirMaison3D = ouvrir;
  window.fermerMaison3D = fermer;
})();
