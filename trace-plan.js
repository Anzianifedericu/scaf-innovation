/*!
 * trace-plan.js — traceur de plan pour le calculateur Nudura SCAF Innovation
 * Chargé par estimation-pro-nudura.html. Aucune dépendance.
 *
 * S'ouvre en fenêtre modale sur un niveau, et renvoie le relevé complet :
 * murs (longueur + tournant), angles, refends, ouvertures, jonctions en T.
 * C'est la page qui applique ensuite ces valeurs au niveau et laisse
 * nudura-engine.js faire le chiffrage — ce module ne calcule aucun prix.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.TracePlan = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';

const SNAP = 0.25;        // le dessin donne la forme, les cotes se corrigent au clavier
const ACCROCHE = 0.45;    // distance d'accrochage aux murs existants
const JONCTION = 0.12;    // tolérance pour considérer qu'un refend touche un mur

/* ===================== géométrie ===================== */

function sommets(murs){
  const p = [{x:0,y:0}];
  murs.forEach(m=>{ const d=p[p.length-1];
    p.push({x:d.x+m.dx*m.longueur, y:d.y+m.dy*m.longueur}); });
  return p;
}

function aireSignee(murs, ferme){
  const p = sommets(murs).slice(0, ferme ? -1 : undefined);
  if(p.length < 3) return 0;
  let a=0;
  for(let i=0;i<p.length;i++){ const q=p[(i+1)%p.length]; a += p[i].x*q.y - q.x*p[i].y; }
  return a/2;
}

// Normale pointant hors du contour : c'est de ce côté qu'on rejette les cotes.
function normaleExt(murs, ferme, m){
  return aireSignee(murs,ferme) > 0 ? {x:m.dy, y:-m.dx} : {x:-m.dy, y:m.dx};
}

// Type de tournant à chaque sommet, selon le sens de parcours du contour.
function angles(murs, ferme){
  const r = {s90:0, r90:0, s45:0, r45:0, liste:[]};
  if(!ferme || murs.length < 3) return r;
  const anti = aireSignee(murs,ferme) > 0;
  for(let i=0;i<murs.length;i++){
    const a = murs[(i-1+murs.length)%murs.length], b = murs[i];
    const cz  = a.dx*b.dy - a.dy*b.dx;
    const cos = Math.max(-1, Math.min(1, a.dx*b.dx + a.dy*b.dy));
    const deg = Math.round(Math.acos(cos)*180/Math.PI);
    if(deg < 3){ r.liste.push('droit'); continue; }
    const sortant = anti ? cz > 0 : cz < 0;
    const t = Math.abs(deg-90) <= 3 ? (sortant?'s90':'r90')
            : Math.abs(deg-45) <= 3 ? (sortant?'s45':'r45') : 'autres';
    if(r[t] !== undefined) r[t]++;
    r.liste.push(t);
  }
  return r;
}

const longueurPoly = (pts)=>{
  let l=0; for(let i=1;i<pts.length;i++) l+=Math.hypot(pts[i].x-pts[i-1].x, pts[i].y-pts[i-1].y);
  return l;
};

// Un refend qui change de direction consomme un bloc d'angle par cours.
function anglesRefends(refends){
  let n90=0, n45=0;
  refends.forEach(r=>{
    for(let i=1;i<r.pts.length-1;i++){
      const a={x:r.pts[i].x-r.pts[i-1].x, y:r.pts[i].y-r.pts[i-1].y};
      const b={x:r.pts[i+1].x-r.pts[i].x, y:r.pts[i+1].y-r.pts[i].y};
      const la=Math.hypot(a.x,a.y), lb=Math.hypot(b.x,b.y);
      if(!la||!lb) continue;
      const c=Math.max(-1, Math.min(1, (a.x*b.x+a.y*b.y)/(la*lb)));
      const d=Math.round(Math.acos(c)*180/Math.PI);
      if(Math.abs(d-90)<=3) n90++; else if(Math.abs(d-45)<=3) n45++;
    }
  });
  return {n90, n45};
}

function distSegment(p,a,b){
  const vx=b.x-a.x, vy=b.y-a.y, l2=vx*vx+vy*vy;
  if(l2===0) return Math.hypot(p.x-a.x, p.y-a.y);
  let t=((p.x-a.x)*vx+(p.y-a.y)*vy)/l2; t=Math.max(0,Math.min(1,t));
  return Math.hypot(p.x-(a.x+t*vx), p.y-(a.y+t*vy));
}

function tousSegments(etat){
  const s=[], p=sommets(etat.murs);
  for(let i=0;i<etat.murs.length;i++) s.push([p[i], p[i+1]]);
  etat.refends.forEach(r=>{ for(let i=1;i<r.pts.length;i++) s.push([r.pts[i-1], r.pts[i]]); });
  return s;
}

// Segments pouvant recevoir une ouverture : murs du contour et segments de refend.
function supports(etat){
  const out=[], p=sommets(etat.murs);
  etat.murs.forEach((m,i)=>out.push({sur:'mur', i, a:p[i], b:p[i+1], longueur:m.longueur, dx:m.dx, dy:m.dy}));
  etat.refends.forEach((r,ri)=>{
    for(let k=1;k<r.pts.length;k++){
      const a=r.pts[k-1], b=r.pts[k], l=Math.hypot(b.x-a.x, b.y-a.y);
      if(l>0) out.push({sur:'refend', i:ri, seg:k, a, b, longueur:l, dx:(b.x-a.x)/l, dy:(b.y-a.y)/l});
    }
  });
  return out;
}
const memeSupport = (o,s)=> o.sur===s.sur && o.i===s.i && (s.sur==='mur' || o.seg===s.seg);

// Chaque extrémité de refend qui bute sur un mur est une jonction en T.
function jonctionsT(etat){
  let n=0;
  etat.refends.forEach((r,ri)=>{
    [r.pts[0], r.pts[r.pts.length-1]].forEach(bout=>{
      const autres=[], p=sommets(etat.murs);
      for(let i=0;i<etat.murs.length;i++) autres.push([p[i], p[i+1]]);
      etat.refends.forEach((o,oi)=>{ if(oi!==ri) for(let i=1;i<o.pts.length;i++) autres.push([o.pts[i-1], o.pts[i]]); });
      if(autres.some(([a,b])=>distSegment(bout,a,b) < JONCTION)) n++;
    });
  });
  return n;
}

/* ===================== rendu du plan ===================== */

function dessiner(etat, svg, vue){
  const pts = sommets(etat.murs);
  const tous = [...pts];
  etat.refends.forEach(r=>tous.push(...r.pts));
  if(vue.refEnCours) tous.push(...vue.refEnCours.pts);
  if(vue.curseur) tous.push(vue.curseur);
  if(etat.filigrane) etat.filigrane.forEach(([a,b])=>{ tous.push(a,b); });

  const xs=tous.map(p=>p.x), ys=tous.map(p=>p.y);
  const minX=Math.min(0,...xs), maxX=Math.max(0,...xs);
  const minY=Math.min(0,...ys), maxY=Math.max(0,...ys);
  const w=Math.max(6, maxX-minX), h=Math.max(4, maxY-minY);
  const pad=Math.max(w,h)*0.18+1.2, vbW=w+pad*2, vbH=h+pad*2;
  svg.setAttribute('viewBox', `${minX-pad} ${-(maxY+pad)} ${vbW} ${vbH}`);

  const u=Math.max(vbW,vbH), tr=u/300, po=u/48, ra=u/140, dec=po*1.55;
  let g='';

  const g0=Math.floor(minX-pad), g1=Math.ceil(maxX+pad);
  const h0=Math.floor(minY-pad), h1=Math.ceil(maxY+pad);
  for(let x=g0;x<=g1;x++) g+=`<line x1="${x}" y1="${-h0}" x2="${x}" y2="${-h1}" stroke="#E8E0CD" stroke-width="${tr*.6}"/>`;
  for(let y=h0;y<=h1;y++) g+=`<line x1="${g0}" y1="${-y}" x2="${g1}" y2="${-y}" stroke="#E8E0CD" stroke-width="${tr*.6}"/>`;

  if(etat.filigrane) etat.filigrane.forEach(([a,b])=>{
    g+=`<line x1="${a.x}" y1="${-a.y}" x2="${b.x}" y2="${-b.y}" stroke="#C9C2B2" stroke-width="${tr*2.6}" stroke-linecap="square"/>`;
  });

  if(etat.ferme && pts.length>3)
    g+=`<polygon points="${pts.map(p=>`${p.x},${-p.y}`).join(' ')}" fill="rgba(63,107,74,.07)"/>`;

  const survolMur = (i)=> vue.mode==='ouverture' && vue.survol && vue.survol.sur==='mur' && vue.survol.i===i;

  etat.murs.forEach((m,i)=>{
    const a=pts[i], b=pts[i+1], sv=survolMur(i);
    g+=`<line x1="${a.x}" y1="${-a.y}" x2="${b.x}" y2="${-b.y}" stroke="${sv?'#5B8FB0':'#2E2B26'}" stroke-width="${tr*(sv?3:2.2)}" stroke-linecap="square"/>`;
    const nx=etat.ferme?normaleExt(etat.murs,etat.ferme,m):{x:-m.dy,y:m.dx};
    const mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
    g+=`<line x1="${mx+nx.x*dec*.35}" y1="${-(my+nx.y*dec*.35)}" x2="${mx+nx.x*dec*.72}" y2="${-(my+nx.y*dec*.72)}" stroke="#D6CBB4" stroke-width="${tr*.8}"/>`;
    g+=`<text x="${mx+nx.x*dec}" y="${-(my+nx.y*dec)}" font-size="${po}" font-family="ui-monospace,monospace" fill="#6B6459" text-anchor="middle" dominant-baseline="middle">${m.longueur.toFixed(2)}</text>`;
  });

  const traceRefend=(r,couleur,ri)=>{
    for(let i=1;i<r.pts.length;i++){
      const a=r.pts[i-1], b=r.pts[i];
      const sv=vue.mode==='ouverture'&&vue.survol&&vue.survol.sur==='refend'&&vue.survol.i===ri&&vue.survol.seg===i;
      g+=`<line x1="${a.x}" y1="${-a.y}" x2="${b.x}" y2="${-b.y}" stroke="${sv?'#5B8FB0':couleur}" stroke-width="${tr*(sv?2.6:1.7)}" stroke-linecap="round"/>`;
      const mx=(a.x+b.x)/2, my=(a.y+b.y)/2, l=Math.hypot(b.x-a.x,b.y-a.y);
      const dx=(b.x-a.x)/l, dy=(b.y-a.y)/l;
      g+=`<text x="${mx-dy*po*.8}" y="${-(my+dx*po*.8)}" font-size="${po*.88}" font-family="ui-monospace,monospace" fill="${couleur}" text-anchor="middle" dominant-baseline="middle">${l.toFixed(2)}</text>`;
    }
    r.pts.forEach(p=>g+=`<circle cx="${p.x}" cy="${-p.y}" r="${ra*.8}" fill="${couleur}"/>`);
  };
  etat.refends.forEach((r,ri)=>traceRefend(r,'#3A6A8C',ri));
  if(vue.refEnCours) traceRefend(vue.refEnCours,'#C08A2E');

  etat.ouvertures.forEach(o=>{
    const s=supports(etat).find(x=>memeSupport(o,x)); if(!s) return;
    const c={x:s.a.x+(s.b.x-s.a.x)*o.t, y:s.a.y+(s.b.y-s.a.y)*o.t};
    const d=o.largeur/2;
    const x1=c.x-s.dx*d, y1=c.y-s.dy*d, x2=c.x+s.dx*d, y2=c.y+s.dy*d;
    g+=`<line x1="${x1}" y1="${-y1}" x2="${x2}" y2="${-y2}" stroke="#FCFAF5" stroke-width="${tr*(s.sur==='mur'?2.6:1.9)}"/>`;
    g+=`<line x1="${x1}" y1="${-y1}" x2="${x2}" y2="${-y2}" stroke="#5B8FB0" stroke-width="${tr*1.4}"/>`;
    const n={x:-s.dy,y:s.dx};
    [[x1,y1],[x2,y2]].forEach(([px,py])=>{
      g+=`<line x1="${px-n.x*tr*1.9}" y1="${-(py-n.y*tr*1.9)}" x2="${px+n.x*tr*1.9}" y2="${-(py+n.y*tr*1.9)}" stroke="#5B8FB0" stroke-width="${tr*1.2}"/>`;
    });
    const nx = s.sur==='mur'&&etat.ferme ? normaleExt(etat.murs,etat.ferme,s) : n;
    g+=`<text x="${c.x-nx.x*po*.95}" y="${-(c.y-nx.y*po*.95)}" font-size="${po*.8}" font-family="ui-monospace,monospace" fill="#5B8FB0" text-anchor="middle" dominant-baseline="middle">${o.largeur.toFixed(2)}×${o.hauteur.toFixed(2)}</text>`;
  });

  if(vue.curseur && vue.mode!=='ouverture'){
    let dep=null;
    if(vue.mode==='contour' && !etat.ferme && pts.length) dep=pts[pts.length-1];
    if(vue.mode==='refend' && vue.refEnCours) dep=vue.refEnCours.pts[vue.refEnCours.pts.length-1];
    if(dep){
      const d=Math.hypot(vue.curseur.x-dep.x, vue.curseur.y-dep.y);
      g+=`<line x1="${dep.x}" y1="${-dep.y}" x2="${vue.curseur.x}" y2="${-vue.curseur.y}" stroke="#C08A2E" stroke-width="${tr*2}" stroke-dasharray="${u/90} ${u/140}"/>`;
      if(d>.05) g+=`<text x="${(dep.x+vue.curseur.x)/2}" y="${-((dep.y+vue.curseur.y)/2)-po*.7}" font-size="${po}" font-family="ui-monospace,monospace" fill="#C08A2E" text-anchor="middle" font-weight="500">${d.toFixed(2)} m</text>`;
    }
    if(vue.mode==='refend' && !vue.refEnCours)
      g+=`<circle cx="${vue.curseur.x}" cy="${-vue.curseur.y}" r="${ra}" fill="#C08A2E"/>`;
  }

  const ang=angles(etat.murs, etat.ferme);
  pts.slice(0, etat.ferme?-1:undefined).forEach((p,i)=>{
    let c='#6B6459';
    if(etat.ferme){ const t=ang.liste[i];
      c=(t==='s90'||t==='s45')?'#A8481F':(t==='r90'||t==='r45')?'#3F6B4A':'#6B6459'; }
    else if(i===0) c='#3F6B4A';
    g+=`<circle cx="${p.x}" cy="${-p.y}" r="${ra}" fill="${c}"/>`;
  });
  if(!etat.ferme && pts.length>2 && vue.mode==='contour')
    g+=`<circle cx="0" cy="0" r="${ra*2.4}" fill="none" stroke="#3F6B4A" stroke-width="${tr}" stroke-dasharray="${u/120} ${u/160}"/>`;

  svg.innerHTML=g;
}

/* ===================== résultat pour le moteur ===================== */

// Convertit le tracé au format attendu par nudura-engine.js.
function releve(etat){
  const ang = angles(etat.murs, etat.ferme);
  const ar  = anglesRefends(etat.refends);

  // Le moteur attend le tournant EN FIN de chaque mur.
  const murs = etat.murs.map((m,i)=>({
    longueur: parseFloat(m.longueur.toFixed(3)),
    angle: ang.liste.length ? (ang.liste[(i+1)%etat.murs.length] === 'droit' ? 'droit'
          : ang.liste[(i+1)%etat.murs.length] === 's90' ? 'sortant90'
          : ang.liste[(i+1)%etat.murs.length] === 'r90' ? 'rentrant90'
          : ang.liste[(i+1)%etat.murs.length] === 's45' ? 'sortant45'
          : ang.liste[(i+1)%etat.murs.length] === 'r45' ? 'rentrant45' : 'sortant90')
          : 'sortant90',
  }));

  // Les ouvertures identiques sont regroupées : le moteur raisonne en quantités.
  const paquets = {};
  etat.ouvertures.forEach(o=>{
    const nature = o.nature==='porte' ? 'porte' : 'fenetre';
    const cle = `${nature}|${o.largeur.toFixed(2)}|${o.hauteur.toFixed(2)}`;
    if(!paquets[cle]) paquets[cle] = { type:nature, largeur:o.largeur, hauteur:o.hauteur, qte:0 };
    paquets[cle].qte++;
  });

  const lineaireRefend = etat.refends.reduce((s,r)=>s+longueurPoly(r.pts), 0);

  return {
    murs,
    perimetre: parseFloat(etat.murs.reduce((s,m)=>s+m.longueur,0).toFixed(2)),
    coins: { ext90: ang.s90 + ang.r90, int90: 0, ext45: ang.s45 + ang.r45, int45: 0 },
    refend: {
      actif: lineaireRefend > 0,
      lineaire: parseFloat(lineaireRefend.toFixed(2)),
      angles90: ar.n90, angles45: ar.n45,
    },
    tWalls: jonctionsT(etat),
    ouvertures: Object.values(paquets),
    ferme: etat.ferme,
  };
}

/* ===================== fenêtre modale ===================== */

const CSS = `
.tp-fond{position:fixed;inset:0;background:rgba(30,28,24,.55);z-index:9000;
  display:flex;align-items:center;justify-content:center;padding:18px}
.tp-boite{background:#F4EEE1;border-radius:10px;width:min(1100px,100%);max-height:94vh;
  display:flex;flex-direction:column;overflow:hidden;box-shadow:0 18px 48px rgba(0,0,0,.3)}
.tp-tete{display:flex;justify-content:space-between;align-items:center;gap:12px;
  padding:12px 16px;border-bottom:1px solid #D6CBB4;background:#fff}
.tp-titre{font-weight:600;font-size:15px;color:#2E2B26}
.tp-corps{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:0;overflow:hidden;flex:1}
@media(max-width:880px){.tp-corps{grid-template-columns:1fr}}
.tp-plan{background:#FCFAF5;display:flex;flex-direction:column;min-width:0}
.tp-svg{flex:1;width:100%;min-height:340px;cursor:crosshair;touch-action:none}
.tp-cote{border-left:1px solid #D6CBB4;background:#fff;overflow-y:auto;padding-bottom:10px}
.tp-barre{display:flex;gap:6px;flex-wrap:wrap;padding:9px 12px;border-bottom:1px solid #D6CBB4;background:#fff}
.tp-b{font:500 12.5px system-ui,sans-serif;padding:6px 11px;border-radius:6px;border:1px solid #D6CBB4;
  background:#F4EEE1;color:#2E2B26;cursor:pointer}
.tp-b:hover:not(:disabled){background:#EDE5D4}
.tp-b:disabled{opacity:.4;cursor:not-allowed}
.tp-b.on{background:#3F6B4A;border-color:#3F6B4A;color:#fff}
.tp-b.on-bleu{background:#3A6A8C;border-color:#3A6A8C;color:#fff}
.tp-b.on-ciel{background:#5B8FB0;border-color:#5B8FB0;color:#fff}
.tp-b.valider{background:#3F6B4A;border-color:#3F6B4A;color:#fff;font-weight:600}
.tp-modes{display:flex;border:1px solid #D6CBB4;border-radius:6px;overflow:hidden}
.tp-modes .tp-b{border:0;border-radius:0}
.tp-modes .tp-b+.tp-b{border-left:1px solid #D6CBB4}
.tp-aide{padding:7px 12px;font-size:11.5px;color:#6B6459;background:#EDE5D4;border-top:1px solid #D6CBB4}
.tp-aide kbd{font:500 10.5px ui-monospace,monospace;background:#fff;border:1px solid #D6CBB4;border-radius:3px;padding:1px 4px}
.tp-bloc{padding:9px 12px;border-bottom:1px solid #EDE5D4}
.tp-bloc h4{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6B6459;font-weight:500;margin-bottom:6px}
.tp-l{display:flex;justify-content:space-between;padding:4px 0;font-size:13px}
.tp-l b{font:500 14px ui-monospace,monospace}
.tp-etat{margin:9px 12px;padding:8px 11px;border-radius:6px;font-size:12px;border:1px solid}
.tp-ok{background:#F1F6F2;border-color:#CBDCCF;color:#3F6B4A}
.tp-ko{background:#FBF1EC;border-color:#EBCFC0;color:#A8481F}
.tp-nu{background:#EDE5D4;border-color:#D6CBB4;color:#6B6459}
.tp-tab{width:100%;border-collapse:collapse;font-size:12.5px}
.tp-tab td{padding:3px 0;border-bottom:1px solid #F4EEE1}
.tp-tab input{width:64px;font:500 12.5px ui-monospace,monospace;padding:3px 5px;
  border:1px solid #D6CBB4;border-radius:4px;background:#fff}
.tp-tab select{font:500 12px system-ui,sans-serif;padding:3px 4px;border:1px solid #D6CBB4;border-radius:4px;background:#fff}
.tp-tab .tp-x{border:0;background:none;color:#6B6459;cursor:pointer;font-size:13px}
.tp-tab .tp-x:hover{color:#A8481F}
.tp-num{font:500 11px ui-monospace,monospace;color:#6B6459;width:26px}
`;

function ouvrir(options){
  const opt = options || {};
  const etat = {
    murs: [], refends: [], ouvertures: [], ferme: false,
    filigrane: opt.filigrane || null,
  };
  const vue = { mode:'contour', ortho:true, curseur:null, refEnCours:null, survol:null };

  if(!document.getElementById('tp-css')){
    const st=document.createElement('style'); st.id='tp-css'; st.textContent=CSS;
    document.head.appendChild(st);
  }

  const fond=document.createElement('div');
  fond.className='tp-fond';
  fond.innerHTML=`
    <div class="tp-boite" role="dialog" aria-modal="true" aria-label="Tracé du plan">
      <div class="tp-tete">
        <span class="tp-titre">Tracé du plan — ${opt.nom || 'niveau'}</span>
        <div style="display:flex;gap:7px">
          <button class="tp-b" data-a="annuler-tout">Fermer sans enregistrer</button>
          <button class="tp-b valider" data-a="valider">Utiliser ce tracé</button>
        </div>
      </div>
      <div class="tp-corps">
        <div class="tp-plan">
          <div class="tp-barre">
            <div class="tp-modes">
              <button class="tp-b on" data-m="contour">Contour</button>
              <button class="tp-b" data-m="refend">Refends</button>
              <button class="tp-b" data-m="ouverture">Ouvertures</button>
            </div>
            <button class="tp-b on" data-a="ortho">Angles droits</button>
            <button class="tp-b" data-a="annuler">Annuler</button>
            <button class="tp-b" data-a="fermer">Fermer le contour</button>
            <button class="tp-b" data-a="effacer">Effacer</button>
          </div>
          <svg class="tp-svg" viewBox="0 0 100 62" preserveAspectRatio="xMidYMid meet"></svg>
          <p class="tp-aide"></p>
        </div>
        <div class="tp-cote"></div>
      </div>
    </div>`;
  document.body.appendChild(fond);

  const svg = fond.querySelector('.tp-svg');
  const cote = fond.querySelector('.tp-cote');
  const aide = fond.querySelector('.tp-aide');

  /* ---- interactions ---- */

  function versMetres(e){
    const r=svg.getBoundingClientRect(), vb=svg.viewBox.baseVal;
    const k=Math.min(r.width/vb.width, r.height/vb.height);
    const dx=(r.width-vb.width*k)/2, dy=(r.height-vb.height*k)/2;
    return { x: vb.x+(e.clientX-r.left-dx)/k, y: -(vb.y+(e.clientY-r.top-dy)/k) };
  }

  function accrocher(p){
    let best=null, dmin=ACCROCHE;
    const cibles=[...tousSegments(etat)];
    if(etat.filigrane) cibles.push(...etat.filigrane);
    cibles.forEach(([a,b])=>{
      const vx=b.x-a.x, vy=b.y-a.y, l2=vx*vx+vy*vy; if(!l2) return;
      let t=((p.x-a.x)*vx+(p.y-a.y)*vy)/l2; t=Math.max(0,Math.min(1,t));
      const q={x:a.x+t*vx, y:a.y+t*vy}, d=Math.hypot(p.x-q.x, p.y-q.y);
      if(d<dmin){ dmin=d; best=q; }
    });
    return best||p;
  }

  function contraindre(p, libre, depart){
    if(!depart) return accrocher(p);
    let dx=p.x-depart.x, dy=p.y-depart.y;
    if(vue.ortho && !libre){ if(Math.abs(dx)>=Math.abs(dy)) dy=0; else dx=0; }
    const l=Math.hypot(dx,dy);
    if(l>0){ const s=Math.max(SNAP, Math.round(l/SNAP)*SNAP); dx=dx/l*s; dy=dy/l*s; }
    return accrocher({x:depart.x+dx, y:depart.y+dy});
  }

  const depart = ()=> vue.mode==='contour'
    ? (etat.ferme ? null : sommets(etat.murs).slice(-1)[0])
    : (vue.mode==='refend' && vue.refEnCours ? vue.refEnCours.pts[vue.refEnCours.pts.length-1] : null);

  function supportSousCurseur(p){
    let best=null, dmin=0.6;
    supports(etat).forEach(s=>{
      const vx=s.b.x-s.a.x, vy=s.b.y-s.a.y, l2=vx*vx+vy*vy; if(!l2) return;
      let t=((p.x-s.a.x)*vx+(p.y-s.a.y)*vy)/l2; t=Math.max(0,Math.min(1,t));
      const q={x:s.a.x+t*vx, y:s.a.y+t*vy}, d=Math.hypot(p.x-q.x, p.y-q.y);
      if(d<dmin){ dmin=d; best={...s, t}; }
    });
    return best;
  }

  svg.addEventListener('mousemove', e=>{
    const p=versMetres(e);
    if(vue.mode==='ouverture'){
      const s=supportSousCurseur(p);
      const n = s?{sur:s.sur, i:s.i, seg:s.seg}:null;
      if(JSON.stringify(n)!==JSON.stringify(vue.survol)){ vue.survol=n; rendre(); }
      return;
    }
    if(vue.mode==='contour' && etat.ferme){ vue.curseur=null; return rendre(); }
    vue.curseur=contraindre(p, e.shiftKey, depart());
    rendre();
  });
  svg.addEventListener('mouseleave', ()=>{ vue.curseur=null; vue.survol=null; rendre(); });

  svg.addEventListener('click', e=>{
    const brut=versMetres(e);
    if(vue.mode==='ouverture'){
      const s=supportSousCurseur(brut); if(!s) return;
      const prises=etat.ouvertures.filter(o=>memeSupport(o,s)).reduce((t,o)=>t+o.largeur,0);
      const reste=s.longueur-prises;
      if(reste<0.5) return;
      etat.ouvertures.push({ sur:s.sur, i:s.i, seg:s.seg, t:s.t,
        largeur: Math.min(s.sur==='refend'?0.90:1.00, Math.max(0.5, reste-0.2)),
        hauteur: s.sur==='refend'?2.10:1.20,
        nature:  s.sur==='refend'?'porte':'fenetre' });
      rendre(); return;
    }
    const p=contraindre(brut, e.shiftKey, depart());
    if(vue.mode==='contour'){
      if(etat.ferme) return;
      if(etat.murs.length>2 && Math.hypot(p.x,p.y)<0.9){ fermerContour(); return; }
      const a=sommets(etat.murs).slice(-1)[0];
      const dx=p.x-a.x, dy=p.y-a.y, l=Math.hypot(dx,dy);
      if(l<0.2) return;
      etat.murs.push({dx:dx/l, dy:dy/l, longueur:l});
    } else {
      if(!vue.refEnCours) vue.refEnCours={pts:[p]};
      else{
        const d=vue.refEnCours.pts[vue.refEnCours.pts.length-1];
        if(Math.hypot(p.x-d.x, p.y-d.y)<0.2) return;
        vue.refEnCours.pts.push(p);
      }
    }
    rendre();
  });

  svg.addEventListener('dblclick', ()=>{ if(vue.mode==='refend') validerRefend(); });

  function auClavier(e){
    if(e.key==='Escape'){ e.preventDefault(); annulerDernier(); }
    if(e.key==='Enter' && vue.mode==='refend'){ e.preventDefault(); validerRefend(); }
  }
  document.addEventListener('keydown', auClavier);

  function validerRefend(){
    if(vue.refEnCours && vue.refEnCours.pts.length>1) etat.refends.push(vue.refEnCours);
    vue.refEnCours=null; vue.curseur=null; rendre();
  }
  function fermerContour(){
    if(etat.murs.length<3) return;
    const d=sommets(etat.murs).slice(-1)[0], l=Math.hypot(d.x,d.y);
    if(l>0.2) etat.murs.push({dx:-d.x/l, dy:-d.y/l, longueur:l});
    etat.ferme=true; vue.curseur=null; rendre();
  }
  function annulerDernier(){
    if(vue.mode==='ouverture'){ etat.ouvertures.pop(); }
    else if(vue.mode==='refend'){
      if(vue.refEnCours){ vue.refEnCours.pts.pop(); if(!vue.refEnCours.pts.length) vue.refEnCours=null; }
      else if(etat.refends.length) supprimerRefend(etat.refends.length-1);
    } else {
      if(etat.ferme) etat.ferme=false; else etat.murs.pop();
    }
    vue.curseur=null; rendre();
  }
  function supprimerRefend(i){
    etat.ouvertures=etat.ouvertures.filter(o=>!(o.sur==='refend'&&o.i===i));
    etat.ouvertures.forEach(o=>{ if(o.sur==='refend'&&o.i>i) o.i--; });
    etat.refends.splice(i,1);
  }
  function setMode(m){
    if((m==='refend'||m==='ouverture') && !etat.ferme){ rendre('Refermez d\'abord le contour.'); return; }
    if(vue.mode==='refend' && m!=='refend') validerRefend();
    vue.mode=m; vue.curseur=null; vue.survol=null;
    fond.querySelectorAll('[data-m]').forEach(b=>{
      b.classList.toggle('on', b.dataset.m==='contour'&&m==='contour');
      b.classList.toggle('on-bleu', b.dataset.m==='refend'&&m==='refend');
      b.classList.toggle('on-ciel', b.dataset.m==='ouverture'&&m==='ouverture');
    });
    rendre();
  }

  fond.addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.m) return setMode(b.dataset.m);
    switch(b.dataset.a){
      case 'ortho': vue.ortho=!vue.ortho; b.classList.toggle('on', vue.ortho); break;
      case 'annuler': annulerDernier(); break;
      case 'fermer': fermerContour(); break;
      case 'effacer': etat.murs=[]; etat.refends=[]; etat.ouvertures=[]; etat.ferme=false;
                      vue.refEnCours=null; setMode('contour'); break;
      case 'annuler-tout': quitter(); break;
      case 'valider':
        if(!etat.ferme){ rendre('Refermez le contour avant de valider.'); return; }
        if(opt.onValider) opt.onValider(releve(etat));
        quitter(); break;
    }
  });

  function quitter(){
    document.removeEventListener('keydown', auClavier);
    fond.remove();
  }

  /* ---- panneau latéral ---- */

  function rendre(message){
    dessiner(etat, svg, vue);

    aide.innerHTML = vue.mode==='contour'
      ? `Cliquez pour poser chaque angle. <kbd>Maj</kbd> libère l'angle droit, <kbd>Échap</kbd> annule. Cliquez sur le point de départ pour refermer.`
      : vue.mode==='refend'
      ? `Tracez un refend d'un mur à l'autre. <kbd>Entrée</kbd> ou double-clic le termine.`
      : `Cliquez sur un mur ou un refend pour y poser une ouverture.`;

    const r = releve(etat);
    const ang = angles(etat.murs, etat.ferme);
    let h='';

    h+=`<div class="tp-bloc"><h4>Relevé</h4>
      <div class="tp-l"><span>Périmètre</span><b>${r.perimetre.toFixed(2)} m</b></div>
      <div class="tp-l"><span>Angles à 90°</span><b>${etat.ferme?r.coins.ext90:'—'}</b></div>
      ${r.coins.ext45?`<div class="tp-l"><span>Angles à 45°</span><b>${r.coins.ext45}</b></div>`:''}
      ${r.refend.actif?`<div class="tp-l"><span>Refends</span><b>${r.refend.lineaire.toFixed(2)} m</b></div>
      ${r.refend.angles90?`<div class="tp-l"><span>Angles de refend</span><b>${r.refend.angles90}</b></div>`:''}
      <div class="tp-l"><span>Jonctions en T</span><b>${r.tWalls}</b></div>`:''}
      ${r.ouvertures.length?`<div class="tp-l"><span>Ouvertures</span><b>${etat.ouvertures.length}</b></div>`:''}
    </div>`;

    // état du tracé
    let cls='tp-nu', txt='';
    if(message){ cls='tp-ko'; txt=message; }
    else if(!etat.murs.length){ txt='Cliquez dans le quadrillage pour poser le premier angle.'; }
    else if(!etat.ferme){
      const d=sommets(etat.murs).slice(-1)[0], e=Math.hypot(d.x,d.y);
      txt = e<0.5&&etat.murs.length>2
        ? 'Le contour revient près du départ — cliquez sur le point vert pour le refermer.'
        : `Contour ouvert : ${etat.murs.length} mur${etat.murs.length>1?'s':''}, écart de ${e.toFixed(2)} m.`;
    } else {
      const ec = ang.s90-ang.r90 + (ang.s45-ang.r45)/2;
      if(Math.abs(ec-4)>0.01){ cls='tp-ko'; txt=`Contour incohérent : sortants moins rentrants devrait valoir 4, et vaut ${ec}.`; }
      else { cls='tp-ok'; txt=`Contour cohérent — ${ang.s90} sortant${ang.s90>1?'s':''}, ${ang.r90} rentrant${ang.r90>1?'s':''}.`; }
    }
    h+=`<div class="tp-etat ${cls}">${txt}</div>`;

    if(etat.murs.length){
      h+=`<div class="tp-bloc"><h4>Murs</h4><table class="tp-tab">`+
        etat.murs.map((m,i)=>`<tr><td class="tp-num">${i+1}</td>
          <td><input type="number" step="0.001" min="0.01" value="${m.longueur.toFixed(3)}" data-mur="${i}"></td>
          <td style="text-align:right;color:#6B6459;font-size:11.5px">${
            etat.ferme ? ({s90:'sortant',r90:'rentrant',s45:'sortant 45',r45:'rentrant 45',droit:'aligné'}[ang.liste[(i+1)%etat.murs.length]]||'—') : ''
          }</td></tr>`).join('')+`</table></div>`;
    }

    if(etat.refends.length){
      h+=`<div class="tp-bloc"><h4>Refends</h4><table class="tp-tab">`+
        etat.refends.map((rf,i)=>`<tr><td class="tp-num">${i+1}</td>
          <td><b>${longueurPoly(rf.pts).toFixed(2)} m</b></td>
          <td style="text-align:right"><button class="tp-x" data-rmref="${i}">✕</button></td></tr>`).join('')+
        `</table></div>`;
    }

    if(etat.ouvertures.length){
      h+=`<div class="tp-bloc"><h4>Ouvertures</h4><table class="tp-tab">`+
        etat.ouvertures.map((o,i)=>`<tr>
          <td class="tp-num" style="color:${o.sur==='refend'?'#3A6A8C':'#6B6459'}">${o.sur==='mur'?'M':'R'}${o.i+1}</td>
          <td><select data-ouv="${i}" data-c="nature">
            <option value="fenetre" ${o.nature==='fenetre'?'selected':''}>Fenêtre</option>
            <option value="porte" ${o.nature==='porte'?'selected':''}>Porte</option>
          </select></td>
          <td><input type="number" step="0.01" min="0.1" value="${o.largeur.toFixed(2)}" data-ouv="${i}" data-c="largeur"></td>
          <td><input type="number" step="0.01" min="0.1" value="${o.hauteur.toFixed(2)}" data-ouv="${i}" data-c="hauteur"></td>
          <td><button class="tp-x" data-rmouv="${i}">✕</button></td></tr>`).join('')+
        `</table></div>`;
    }

    cote.innerHTML=h;

    // boutons contextuels
    fond.querySelector('[data-a="fermer"]').disabled = vue.mode!=='contour' || etat.ferme || etat.murs.length<3;
    fond.querySelector('[data-a="annuler"]').disabled = !etat.murs.length && !etat.refends.length && !etat.ouvertures.length;
  }

  cote.addEventListener('change', e=>{
    const t=e.target;
    if(t.dataset.mur!==undefined){
      const v=parseFloat(t.value); if(v>0){ etat.murs[+t.dataset.mur].longueur=v; rendre(); }
    } else if(t.dataset.ouv!==undefined){
      const o=etat.ouvertures[+t.dataset.ouv], c=t.dataset.c;
      if(c==='nature'){ o.nature=t.value; if(t.value==='porte'&&o.hauteur<2) o.hauteur=2.10; }
      else { const v=parseFloat(t.value); if(v>0) o[c]=v; }
      rendre();
    }
  });
  cote.addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    if(b.dataset.rmref!==undefined){ supprimerRefend(+b.dataset.rmref); rendre(); }
    if(b.dataset.rmouv!==undefined){ etat.ouvertures.splice(+b.dataset.rmouv,1); rendre(); }
  });

  rendre();
  return { fermer: quitter };
}

return { ouvrir, releve, angles, anglesRefends, jonctionsT, VERSION:'2026-08-14' };
});
