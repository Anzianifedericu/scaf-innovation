/* Barre laterale du traceur : les onglets, outils et reglages passent sur le
   cote, en listes deroulantes, pour laisser toute la hauteur au plan.
   Les elements gardent leurs identifiants : le reste du code ne change pas. */
(function(){
  'use strict';
  const css = `
  #vue-plan > .panneau{display:flex !important;flex-direction:row !important;align-items:stretch}
  #barreLat{flex:0 0 268px;width:268px;border-right:1px solid var(--trait);background:#FBF8F1;overflow-y:auto;display:flex;flex-direction:column}
  #zonePlan{flex:1;min-width:0;display:flex;flex-direction:column;position:relative}
  body.plein #zonePlan #scene{flex:1 1 0;height:0;min-height:0}
  #barreLat .bl-sec{border-bottom:1px solid var(--trait)}
  #barreLat .bl-sec > summary{list-style:none;cursor:pointer;padding:10px 14px;font:600 12.5px 'IBM Plex Sans',sans-serif;
    text-transform:uppercase;letter-spacing:.06em;color:#6B6459;display:flex;justify-content:space-between;align-items:center}
  #barreLat .bl-sec > summary::-webkit-details-marker{display:none}
  #barreLat .bl-sec > summary::after{content:'▾';font-size:12px;transition:transform .15s}
  #barreLat .bl-sec:not([open]) > summary::after{transform:rotate(-90deg)}
  #barreLat .bl-corps{padding:0 12px 12px;display:flex;flex-direction:column;gap:5px}
  #barreLat .bl-corps button{width:100%;text-align:left;padding:8px 11px;border-radius:7px}
  #barreLat .modes{display:flex;flex-direction:column;border:0;border-radius:0;overflow:visible;gap:5px}
  #barreLat .modes button{border:1px solid var(--trait);border-radius:7px}
  #barreLat .barre{display:flex;flex-direction:column;gap:5px}
  #barreLat .pm-barre{flex-direction:column;padding:0;border:0;background:none;gap:5px;overflow:visible}
  #barreLat .pm-barre button{justify-content:flex-start;flex:none}
  #barreLat select.bl-niv{width:100%;font:500 14px 'IBM Plex Sans',sans-serif;padding:9px 10px;border:1px solid var(--trait);border-radius:7px;background:#fff}
  #barreLat .bl-rang{display:flex;gap:6px;margin-top:4px}
  #barreLat .bl-rang button{flex:1;text-align:center}
  #barreLat .bl-niv-etat{font-size:12px;color:#6B6459;padding:0 2px}
  #barreLat .bl-reglages{display:flex;flex-direction:column}
  #barreLat .bl-reglages > *{border-top:1px solid var(--trait)}
  #barreLat .edit-mur,#barreLat .fond-barre,#barreLat .cotes-barre,#barreLat .plancher-barre{padding:10px 12px}
  #barreLat .edit-mur > b,#barreLat .fond-barre > b{flex-basis:100%}
  #barreLat .cotes-barre .grp{width:100%;gap:6px}
  #barreLat .cotes-barre .grp > b{flex-basis:100%}
  #barreLat .cotes-barre .grp > input{flex:1 1 60px;min-width:0;width:auto}
  #barreLat .cotes-barre #coteL{flex:1 1 calc(100% - 30px)}
  #barreLat .cotes-barre .fl{flex:1 1 calc(25% - 5px);min-width:0;padding:4px 0}
  #barreLat .cotes-barre #bFinRefend, #barreLat .cotes-barre #grpRect > button{flex-basis:100%}
  #barreLat .cotes-barre > button{width:100%}
  #barreLat .edit-mur input:not([type=checkbox]){width:90px}
  #barreLat .edit-mur select{max-width:100%}
  #barreLat .aide{margin:0;padding:10px 12px;font-size:12px}
  #barreLat .portee-info{font-size:12.5px}
  #barreLat .legende{display:flex;flex-direction:column;gap:4px;padding:0}
  #barreLat .enveloppe{padding:0 0 8px;font-size:12px}
  #onglets{display:none !important}
  /* navigation en haut : parcours, vues, niveaux */
  header.hd-nav{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px 16px}
  body:not(.plein) header.hd-nav .sub{display:none}
  header .hd-centre{flex:1;display:flex;justify-content:center;min-width:0}
  header .pm-barre{padding:0;border:0;background:none;gap:4px;overflow-x:auto}
  header .pm-barre button{flex:none;padding:5px 10px;font-size:12.5px}
  header .pm-barre button i{width:19px;height:19px;font-size:11px}
  header .hd-droite{display:flex;gap:8px;align-items:center}
  #navNiv{display:flex;align-items:center;gap:6px;padding:6px 12px;border-bottom:1px solid var(--trait);background:#FBF8F1;overflow-x:auto;flex:none}
  #navNiv .nn-tit{font:600 11.5px 'IBM Plex Sans',sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#9A9286;margin-right:4px}
  #navNiv button.nn{padding:6px 13px;border-radius:7px;border:1px solid var(--trait);background:#fff;font:500 13px 'IBM Plex Sans',sans-serif;white-space:nowrap}
  #navNiv button.nn.actif{background:var(--encre);color:#fff;border-color:var(--encre)}
  #navNiv button.nn small{opacity:.7;margin-left:5px;font-size:11px}
  #navNiv button.nn-plus{border-style:dashed}
  #navNiv .nn-etat{margin-left:auto;font-size:12px;color:#6B6459;white-space:nowrap}
  /* outils de trace sur deux colonnes */
  #barreLat .modes{display:grid !important;grid-template-columns:1fr 1fr}
  #barreLat .modes .bl-grp{grid-column:1/-1}
  #barreLat .modes button{padding:7px 8px;font-size:12.5px;line-height:1.2}
  #barreLat .bl-grp{font:600 11px 'IBM Plex Sans',sans-serif;text-transform:uppercase;letter-spacing:.06em;color:#9A9286;margin:6px 2px 0}
  #barreLat select#blOutil{margin-bottom:4px}
  #barreLat #editPlEsc label{display:flex;flex-direction:column;gap:3px;font-size:12.5px}
  #barreLat #editPlEsc select{width:100%;padding:6px 8px;border:1px solid var(--trait);border-radius:6px;background:#fff}
  @media (max-width:760px){
    #vue-plan > .panneau{flex-direction:column !important}
    #barreLat{flex:none;width:auto;max-height:42vh;border-right:0;border-bottom:1px solid var(--trait)}
  }
  @media print{ #barreLat{display:none !important} }
  `;
  let pret = false, aside, zone, selNiv;

  function section(titre, ouvert){
    const d = document.createElement('details');
    d.className = 'bl-sec'; if(ouvert) d.open = true;
    d.innerHTML = `<summary>${titre}</summary><div class="bl-corps"></div>`;
    aside.appendChild(d);
    return d.querySelector('.bl-corps');
  }

  function installer(){
    const panneau = document.querySelector('#vue-plan > .panneau');
    const scene = document.getElementById('scene');
    if(!panneau || !scene) return;
    pret = true;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    aside = document.createElement('aside'); aside.id = 'barreLat';
    zone = document.createElement('div'); zone.id = 'zonePlan';

    // a gauche : uniquement ce qui sert a construire
    const sTracer = section('Construire', true);
    const sOutils = section('Outils', false);
    const reglages = document.createElement('div'); reglages.className = 'bl-reglages'; aside.appendChild(reglages);
    const sLeg = section('Légende', false);

    // outils de trace
    const modes = panneau.querySelector('.panneau-tete .modes');
    if(modes){ sTracer.appendChild(listeOutils()); grouper(modes); sTracer.appendChild(modes); }
    // actions et menu « Plus » deplie
    const barre = panneau.querySelector('.panneau-tete .barre');
    if(barre){
      const plus = barre.querySelector('#menuPlus');
      if(plus){ const menu = plus.querySelector('.menu'); if(menu) [...menu.children].forEach(c=>barre.appendChild(c)); plus.remove(); }
      sOutils.appendChild(barre);
      // Annuler et Fermer servent sans cesse : ils restent visibles sous les outils de trace
      const rang = document.createElement('div'); rang.className = 'bl-rang';
      ['bAnnuler','bFermer'].forEach(id=>{ const e=barre.querySelector('#'+id); if(e) rang.appendChild(e); });
      sTracer.appendChild(rang);
    }
    const tete = panneau.querySelector('.panneau-tete'); if(tete) tete.remove();

    // reglages contextuels : tout ce qui etait sous le plan
    ['porteeInfo','fondBarre','editToit','agrandirBarre','editTerr','editSel','editPiece','editOuv','editMur','cotesBarre'].forEach(id=>{
      const e = document.getElementById(id); if(e) reglages.appendChild(e);
    });
    const pb = panneau.querySelector('.plancher-barre'); if(pb) reglages.appendChild(pb);
    const aide = document.getElementById('aide'); if(aide) reglages.appendChild(aide);
    const env = document.getElementById('enveloppe'); if(env) sLeg.appendChild(env);
    const leg = panneau.querySelector('.legende'); if(leg) sLeg.appendChild(leg);

    // au-dessus du plan : la navigation entre les niveaux
    const nav = document.createElement('div'); nav.id = 'navNiv';
    zone.appendChild(nav); selNiv = nav;
    // dans l'en-tete : le parcours au centre, les vues a droite
    const hd = document.querySelector('header');
    if(hd){
      hd.classList.add('hd-nav');
      const centre = document.createElement('div'); centre.className = 'hd-centre'; centre.id = 'hdParcours';
      const vues = hd.querySelector('.vues');
      const droite = document.createElement('div'); droite.className = 'hd-droite';
      if(vues) droite.appendChild(vues);
      hd.appendChild(centre); hd.appendChild(droite);
    }
    // le plan prend toute la place restante
    zone.appendChild(scene);
    const fichier = document.getElementById('fichierFond'); if(fichier) zone.appendChild(fichier);
    panneau.appendChild(aside);
    panneau.appendChild(zone);

    // on se souvient des sections ouvertes ou fermees
    aside.querySelectorAll('.bl-sec').forEach((d,i)=>{
      const cle = 'bl2_sec_'+i;
      try{ const v = localStorage.getItem(cle); if(v!==null) d.open = v==='1'; }catch(e){}
      d.addEventListener('toggle', ()=>{ try{ localStorage.setItem(cle, d.open?'1':'0'); }catch(e){} });
    });
    addEventListener('resize', ()=>{ if(typeof rendreScene==='function') rendreScene(); });
    majNiveaux(); rangerParcours();
    if(typeof rendreScene==='function') requestAnimationFrame(()=>rendreScene());
  }

  /* Une liste deroulante de tous les outils, avec leurs variantes :
     type d'ouverture, de plancher, d'escalier. */
  function listeOutils(){
    const sel = document.createElement('select'); sel.id='blOutil'; sel.className='bl-niv'; sel.setAttribute('aria-label','Outil de tracé');
    const g = (titre, items)=>`<optgroup label="${titre}">${items.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</optgroup>`;
    const T = (typeof TYPES_OUV!=='undefined') ? TYPES_OUV : {};
    const P = window.TYPES_PLANCHER || {}, E = window.TYPES_ESCALIER || {};
    sel.innerHTML =
      g('Murs', [['contour','Contour de la maison'],['refend','Murs porteurs (refends)'],['cloison','Cloisons'],['agrandir','Agrandir (garage, pièce)'],['murlibre','Mur libre (muret, clôture)']]) +
      g('Ouvertures', [['ouverture','Ouverture (type automatique)'], ...Object.entries(T).map(([k,v])=>['ouverture|'+k, v.l])]) +
      g('Pièces', [['piece','Nommer les pièces']]) +
      g('Planchers', [...Object.entries(P).map(([k,v])=>['zone|'+k, v.l]), ['plancher','Poutrelles une à une (détail)']]) +
      g('Escaliers', Object.entries(E).map(([k,v])=>['escalier|'+k, v.l])) +
      g('Extérieur et toit', [['terrasse','Terrasse (surface)'],['toiture','Toiture']]) +
      g('Modifier', [['deplacer','Sélection : choisir, glisser, régler']]);
    sel.onchange = ()=>{
      const [m, sous] = sel.value.split('|');
      if(m==='ouverture') window.natureOuvChoisie = sous || null;
      if(m==='zone' && sous) window.plTypeChoisi = sous;
      if(m==='escalier' && sous) window.escTypeChoisi = sous;
      setMode(m);
      syncOutil();
    };
    return sel;
  }
  window.syncOutil = function(){
    const sel = document.getElementById('blOutil'); if(!sel || typeof mode==='undefined') return;
    const sous = mode==='ouverture' ? window.natureOuvChoisie : mode==='zone' ? window.plTypeChoisi : mode==='escalier' ? window.escTypeChoisi : null;
    const v = sous ? mode+'|'+sous : mode;
    if([...sel.options].some(o=>o.value===v)) sel.value = v;
    else if([...sel.options].some(o=>o.value===mode)) sel.value = mode;
  };
  // les boutons d'outils rangés par famille
  function grouper(modes){
    const familles = [['Murs',['mContour','mRefend','mCloison','mAgrandir','mLibre']], ['Ouvertures et pièces',['mOuv','mPiece']],
      ['Planchers et escaliers',['mZone','mEscalier','mPlancher']], ['Extérieur et toit',['mTerrasse','mToiture']], ['Modifier',['mDep']]];
    familles.forEach(([titre, ids])=>{
      const h = document.createElement('div'); h.className='bl-grp'; h.textContent=titre; modes.appendChild(h);
      ids.forEach(id=>{ const b=modes.querySelector('#'+id); if(b) modes.appendChild(b); });
    });
  }

  function rangerParcours(){
    const bar = document.getElementById('pmBarre'), dest = document.getElementById('hdParcours');
    if(bar && dest && bar.parentNode !== dest) dest.appendChild(bar);
  }

  function majNiveaux(){
    if(!selNiv || typeof niveaux === 'undefined') return;
    const etat = n => n.ferme
      ? (n.hauteur>=1.8 ? `${perimetre(n).toFixed(1).replace('.',',')} m de murs · ${surfaceHabitable(n).toFixed(1).replace('.',',')} m²` : `${perimetre(n).toFixed(1).replace('.',',')} m de murs`)
      : (n.murs.length ? 'tracé en cours' : 'vide');
    const court = n => !n.ferme ? (n.murs.length?'en cours':'vide') : (n.hauteur>=1.8 ? `${surfaceHabitable(n).toFixed(0)} m²` : '✓');
    let h = '<span class="nn-tit">Niveaux</span>';
    niveaux.forEach((n,i)=>{ h += `<button type="button" class="nn ${i===iNiveau?'actif':''}" data-i="${i}">${n.nom}<small>${court(n)}</small></button>`; });
    h += `<button type="button" class="nn nn-plus" data-plus="1">+ Niveau</button>`;
    h += `<span class="nn-etat">${niveaux[iNiveau] ? niveaux[iNiveau].nom+' · '+etat(niveaux[iNiveau]) : ''}</span>`;
    if(selNiv.dataset.h !== h){ selNiv.innerHTML = h; selNiv.dataset.h = h;
      selNiv.querySelectorAll('button[data-i]').forEach(b=>b.onclick=()=>allerNiveau(Number(b.dataset.i)));
      const pl = selNiv.querySelector('[data-plus]'); if(pl) pl.onclick=()=>ajouterNiveau(); }
  }

  (window.apresRecalcul = window.apresRecalcul || []).push(()=>{
    if(!pret) installer();
    majNiveaux(); rangerParcours(); window.syncOutil();
  });
  if(document.readyState === 'complete') setTimeout(()=>{ if(!pret) installer(); }, 0);
  else addEventListener('load', ()=>{ if(!pret) installer(); });
})();
