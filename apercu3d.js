/* Apercu 3D en direct : une petite maquette dans le coin du plan, reconstruite
   a chaque mur pose. Elle reutilise le constructeur de maison3d.js (memes murs,
   ouvertures, toiture), sans ombres et sans boucle d'animation : on ne dessine
   que quand le plan change ou que le visiteur fait tourner la maison.
   Ordinateur uniquement (decision du 20/10/2026). Aucun calcul de quantites. */
(function(){
  'use strict';
  const CLE = 'scaf_apercu3d_replie';
  const css = `
  .a3-ancre{position:relative;height:0;z-index:50}
  .a3-boite{position:fixed;right:16px;bottom:16px;width:320px;height:230px;background:#BFD7EA;border:1px solid #CFC6B3;border-radius:10px;overflow:hidden;box-shadow:0 4px 14px rgba(46,43,38,.18)}
  .a3-boite canvas{display:block;width:100%;height:100%;touch-action:none;cursor:grab}
  .a3-tete{position:absolute;top:0;left:0;right:0;display:flex;align-items:center;gap:6px;padding:6px 8px;background:linear-gradient(rgba(251,248,241,.94),rgba(251,248,241,.78));font:600 12px 'IBM Plex Sans',sans-serif;color:#2E2B26;z-index:1}
  .a3-tete span{flex:1}
  .a3-tete button{padding:2px 8px;font-size:12px;line-height:1.4}
  .a3-msg{position:absolute;inset:30px 10px 10px;display:grid;place-items:center;text-align:center;font:500 12.5px 'IBM Plex Sans',sans-serif;color:#2E4F37}
  .a3-boite.replie{height:auto;width:auto;background:#FBF8F1}
  .a3-boite.replie .a3-tete{position:static}
  .a3-boite.replie canvas,.a3-boite.replie .a3-msg{display:none}
  @media(max-width:960px){.a3-ancre{display:none}}
  body.resultats .a3-ancre{display:none}
  @media print{.a3-ancre{display:none}}
  `;

  let ctx = null, ancre = null, boite = null, minuterie = 0, enCours = false;
  const lire = ()=>{ try{ return localStorage.getItem(CLE)==='1'; }catch(e){ return false; } };
  const ecrire = v=>{ try{ localStorage.setItem(CLE, v?'1':'0'); }catch(e){} };
  const pret = ()=> typeof niveaux!=='undefined' && niveaux.some(n=>n.ferme && n.murs.length);

  function installer(){
    if(ancre) return;
    const scene = document.getElementById('scene');
    if(!scene || !window.maison3D) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    ancre = document.createElement('div'); ancre.className = 'a3-ancre';
    ancre.innerHTML = `<div class="a3-boite${lire()?' replie':''}">
      <div class="a3-tete"><span>Ma maison en 3D</span>
        <button type="button" data-a="plein" title="Voir en grand, choisir les couleurs">Agrandir</button>
        <button type="button" data-a="plier" title="Replier / déplier">${lire()?'▴':'▾'}</button></div>
      <div class="a3-msg">Fermez le contour de votre maison : elle apparaîtra ici en 3D.</div></div>`;
    scene.after(ancre);
    boite = ancre.firstElementChild;
    boite.querySelector('[data-a=plein]').onclick = ()=>{
      if(!pret()) return alert("Tracez d'abord le contour de votre maison.");
      window.ouvrirMaison3D && window.ouvrirMaison3D();
    };
    boite.querySelector('[data-a=plier]').onclick = e=>{
      const r = !boite.classList.contains('replie');
      boite.classList.toggle('replie', r); ecrire(r);
      e.currentTarget.textContent = r ? '▴' : '▾';
      if(!r){ redim(); planifier(); }
    };
  }

  async function demarrer(){
    if(ctx || enCours) return;
    enCours = true;
    const msg = boite.querySelector('.a3-msg');
    msg.textContent = 'Construction de votre maison…';
    try{ await maison3D.chargerThree(); if(window.chargerSquelette) await chargerSquelette(); }
    catch(e){ msg.textContent = "La 3D n'a pas pu se charger."; enCours = false; return; }
    const renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio||1));
    renderer.outputEncoding = THREE.sRGBEncoding;
    boite.insertBefore(renderer.domElement, boite.querySelector('.a3-msg'));
    const scene = new THREE.Scene();
    const ciel = new THREE.Color('#BFD7EA').convertSRGBToLinear();
    scene.background = ciel; scene.fog = new THREE.Fog(ciel, 60, 160);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.maxPolarAngle = Math.PI*0.495; controls.minDistance = 3; controls.maxDistance = 90;
    scene.add(new THREE.HemisphereLight('#EAF3FF', '#7A8B5C', 0.6));
    const soleil = new THREE.DirectionalLight('#FFF4DE', 1.0);
    scene.add(soleil); scene.add(soleil.target);
    const sol = new THREE.Mesh(new THREE.CircleGeometry(120, 48), new THREE.MeshLambertMaterial({ color:new THREE.Color('#7E9A55').convertSRGBToLinear() }));
    sol.rotation.x = -Math.PI/2; scene.add(sol);
    ctx = { renderer, scene, camera, controls, soleil, sol, maison:null, reglages:{ vue:'exterieur', heure:15, niveauMax:null } };
    controls.addEventListener('change', dessiner);
    new ResizeObserver(redim).observe(boite);
    enCours = false;
    redim(); construire(true);
  }

  function redim(){
    if(!ctx || boite.classList.contains('replie')) return;
    const r = boite.getBoundingClientRect(); if(r.width<10) return;
    ctx.renderer.setSize(r.width, r.height, false);
    ctx.camera.aspect = r.width/Math.max(1,r.height); ctx.camera.updateProjectionMatrix();
    dessiner();
  }
  function dessiner(){ if(ctx) ctx.renderer.render(ctx.scene, ctx.camera); }

  let dejaCadre = false;
  function construire(premier){
    const msg = boite.querySelector('.a3-msg');
    if(!pret()){ msg.style.display=''; msg.textContent='Fermez le contour de votre maison : elle apparaîtra ici en 3D.'; ctx.renderer.domElement.style.visibility='hidden'; dejaCadre=false; return; }
    msg.style.display='none'; ctx.renderer.domElement.style.visibility='';
    const cadrer = premier || !dejaCadre;
    try{ maison3D.construire(cadrer, ctx); dejaCadre = true; }
    catch(e){ console.error(e); }
    // la vignette est petite : on recule la camera pour voir toute la maison
    if(cadrer){ const t=ctx.controls.target; ctx.camera.position.sub(t).multiplyScalar(1.15).add(t); ctx.controls.update(); }
    dessiner();
  }

  function planifier(){
    installer();
    if(!boite || boite.classList.contains('replie')) return;
    if(document.body.classList.contains('resultats') || innerWidth<=960) return;
    if(maison3D.ouvert()) return; // la vue plein ecran est ouverte
    if(!pret() && !ctx) return;
    clearTimeout(minuterie);
    minuterie = setTimeout(()=>{ ctx ? construire(false) : demarrer(); }, 350);
  }

  window.apercu3dMaj = planifier;
  if(document.readyState==='loading') addEventListener('DOMContentLoaded', installer); else installer();
  (window.apresRecalcul = window.apresRecalcul || []).push(planifier);
})();
