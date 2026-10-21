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
  @media (max-width:760px){
    #vue-plan > .panneau{flex-direction:column !important}
    #barreLat{flex:none;width:auto;max-height:42vh;border-right:0;border-bottom:1px solid var(--trait)}
  }
  @media print{ #barreLat{display:none !important} }
  `;
  let pret = false, aside, zone, selNiv, etatNiv;

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

    // ordre des sections
    const sParcours = section('Mon parcours', false); sParcours.parentNode.id = 'blParcours'; sParcours.parentNode.hidden = true;
    const sNiv = section('Niveau', true);
    sNiv.innerHTML = `<select class="bl-niv" aria-label="Niveau affiché"></select><div class="bl-niv-etat"></div>
      <button type="button" onclick="ajouterNiveau()">+ Ajouter un niveau au-dessus</button>`;
    selNiv = sNiv.querySelector('select'); etatNiv = sNiv.querySelector('.bl-niv-etat');
    selNiv.onchange = ()=> allerNiveau(Number(selNiv.value));
    const sTracer = section('Tracer', true);
    const sOutils = section('Outils', false);
    const reglages = document.createElement('div'); reglages.className = 'bl-reglages'; aside.appendChild(reglages);
    const sLeg = section('Légende', false);

    // outils de trace
    const modes = panneau.querySelector('.panneau-tete .modes'); if(modes) sTracer.appendChild(modes);
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
    ['porteeInfo','fondBarre','agrandirBarre','editTerr','editSel','editPiece','editOuv','editMur','cotesBarre'].forEach(id=>{
      const e = document.getElementById(id); if(e) reglages.appendChild(e);
    });
    const pb = panneau.querySelector('.plancher-barre'); if(pb) reglages.appendChild(pb);
    const aide = document.getElementById('aide'); if(aide) reglages.appendChild(aide);
    const env = document.getElementById('enveloppe'); if(env) sLeg.appendChild(env);
    const leg = panneau.querySelector('.legende'); if(leg) sLeg.appendChild(leg);

    // le plan prend toute la place restante
    zone.appendChild(scene);
    const fichier = document.getElementById('fichierFond'); if(fichier) zone.appendChild(fichier);
    panneau.appendChild(aside);
    panneau.appendChild(zone);

    // on se souvient des sections ouvertes ou fermees
    aside.querySelectorAll('.bl-sec').forEach((d,i)=>{
      const cle = 'bl_sec_'+i;
      try{ const v = localStorage.getItem(cle); if(v!==null) d.open = v==='1'; }catch(e){}
      d.addEventListener('toggle', ()=>{ try{ localStorage.setItem(cle, d.open?'1':'0'); }catch(e){} });
    });
    addEventListener('resize', ()=>{ if(typeof rendreScene==='function') rendreScene(); });
    majNiveaux(); rangerParcours();
    if(typeof rendreScene==='function') requestAnimationFrame(()=>rendreScene());
  }

  function rangerParcours(){
    const bar = document.getElementById('pmBarre'), sec = document.getElementById('blParcours');
    if(!bar || !sec) return;
    if(bar.parentNode !== sec.querySelector('.bl-corps')){
      sec.querySelector('.bl-corps').appendChild(bar); sec.hidden = false;
      // ouvert par defaut pour le client, replie pour SCAF, sauf choix deja fait
      let choix = null; try{ choix = localStorage.getItem('bl_sec_0'); }catch(e){}
      if(choix === null) sec.open = !(typeof vuePro==='function' && vuePro());
    }
  }

  function majNiveaux(){
    if(!selNiv || typeof niveaux === 'undefined') return;
    const etat = n => n.ferme
      ? (n.hauteur>=1.8 ? `${perimetre(n).toFixed(1).replace('.',',')} m de murs · ${surfaceHabitable(n).toFixed(1).replace('.',',')} m²` : `${perimetre(n).toFixed(1).replace('.',',')} m de murs`)
      : (n.murs.length ? 'tracé en cours' : 'vide');
    let h = '';
    for(let i=niveaux.length-1;i>=0;i--) h += `<option value="${i}" ${i===iNiveau?'selected':''}>${niveaux[i].nom}</option>`;
    if(selNiv.innerHTML !== h) selNiv.innerHTML = h;
    selNiv.value = String(iNiveau);
    etatNiv.textContent = niveaux[iNiveau] ? etat(niveaux[iNiveau]) : '';
  }

  (window.apresRecalcul = window.apresRecalcul || []).push(()=>{
    if(!pret) installer();
    majNiveaux(); rangerParcours();
  });
  if(document.readyState === 'complete') setTimeout(()=>{ if(!pret) installer(); }, 0);
  else addEventListener('load', ()=>{ if(!pret) installer(); });
})();
