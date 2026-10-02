/* Calepinage Isoltop. Le dessin est réinjecté à chaque rendu du plan.
   N'intervient pas dans le moteur de blocs. */
(function () {
  const ENTRAXE = 0.60, APPUI = 0.05, H_ENT = 1.20, ETAI = 1.50;
  const MONTAGES = {
    "elitech-r4": { label: "ELITech R4 à languette", litres: 77, languette: true },
    "elitech-r5": { label: "ELITech R5 à languette", litres: 80, languette: true },
    "elitech-r6": { label: "ELITech R6 à languette", litres: 84, languette: true },
    "hourdinov-12": { label: "Hourdinov 12+5", litres: 73, languette: false },
    "hourdinov-15": { label: "Hourdinov 15+5", litres: 77, languette: false },
    "hourdinov-20": { label: "Hourdinov 20+5", litres: 84, languette: false },
    "hourdinov-25": { label: "Hourdinov 25+5", litres: 90, languette: false },
    "aucun": { label: "Pas de plancher", litres: 0, languette: false }
  };

  function defaut(niv, i) {
    if (/vide/i.test(niv.nom || "") || i === 0) return "elitech-r5";
    if (/comble|toit/i.test(niv.nom || "")) return "hourdinov-20";
    return "hourdinov-15";
  }
  function choix(niv, i) {
    if (!MONTAGES[niv.isoltop]) niv.isoltop = defaut(niv, i);
    if (typeof niv.isoltopToit !== "boolean") niv.isoltopToit = false;
    return niv;
  }
  function interieur(niv) {
    if (!niv || !niv.ferme || !niv.murs || niv.murs.length < 3) return null;
    if (typeof sommetsDe !== "function" || typeof versInterieur !== "function") return null;
    const pts = sommetsDe(niv).slice(0, -1);
    if (pts.length < 3) return null;
    const ep = (typeof HORS_TOUT !== "undefined" && HORS_TOUT[niv.epaisseur]) || 0.286;
    const anti = typeof aireSignee === "function" && aireSignee(niv) > 0;
    const dedans = versInterieur(pts, ep, anti);
    let a = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    dedans.forEach((p, i) => {
      const q = dedans[(i + 1) % dedans.length];
      a += p.x * q.y - q.x * p.y;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    return { pts: dedans, aire: Math.abs(a / 2), minX, minY, maxX, maxY, largeur: maxX - minX, profondeur: maxY - minY };
  }
  function calepiner(geom) {
    if (!geom || geom.aire < 0.5) return null;
    const spanX = geom.largeur <= geom.profondeur;
    const portee = spanX ? geom.largeur : geom.profondeur;
    const repart = spanX ? geom.profondeur : geom.largeur;
    const nSpaces = Math.max(1, Math.round(repart / ENTRAXE));
    const entraxe = repart / nSpaces;
    const nBeams = nSpaces + 1;
    const coupe = portee + 2 * APPUI;
    return {
      spanX, portee, repart, entraxe, nBeams, coupe, ml: nBeams * coupe,
      nHourdis: Math.ceil((nSpaces * portee) / H_ENT),
      nEtais: Math.max(0, Math.ceil(portee / ETAI) - 1) * nBeams
    };
  }
  function f(n, d) { return n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function options(cur) {
    return Object.entries(MONTAGES).map(([k, m]) =>
      `<option value="${k}"${k === cur ? " selected" : ""}>${m.label}</option>`).join("");
  }

  function etatCourant() {
    if (typeof niveaux === "undefined" || typeof N !== "function") return null;
    const i = typeof iNiveau === "number" ? iNiveau : 0;
    const niv = niveaux[i];
    if (!niv) return null;
    choix(niv, i);
    return { niv, i, geom: interieur(niv), calc: null };
  }

  window.marquagePlancherIsoltop = function (tr) {
    const e = etatCourant();
    if (!e || e.niv.isoltop === "aucun") return "";
    const c = e.geom && calepiner(e.geom);
    if (!c) return "";
    const ep = Math.max(tr * 1.35, 0.03);
    const pts = e.geom.pts.map(p => `${p.x},${-p.y}`).join(" ");
    let beams = "";
    for (let i = 0; i < c.nBeams; i++) {
      const t = c.nBeams === 1 ? 0.5 : i / (c.nBeams - 1);
      if (c.spanX) {
        const y = e.geom.minY + t * e.geom.profondeur;
        beams += `<line x1="${e.geom.minX}" y1="${-y}" x2="${e.geom.maxX}" y2="${-y}" stroke="#1F3A5F" stroke-width="${ep}" stroke-linecap="butt"/>`;
      } else {
        const x = e.geom.minX + t * e.geom.largeur;
        beams += `<line x1="${x}" y1="${-e.geom.minY}" x2="${x}" y2="${-e.geom.maxY}" stroke="#1F3A5F" stroke-width="${ep}" stroke-linecap="butt"/>`;
      }
    }
    const mx = (e.geom.minX + e.geom.maxX) / 2;
    const my = (e.geom.minY + e.geom.maxY) / 2;
    const fs = Math.max(tr * 11, 0.22);
    return `<g id="iso-plancher">
      <defs><clipPath id="iso-clip"><polygon points="${pts}"/></clipPath></defs>
      <polygon points="${pts}" fill="rgba(31,58,95,.06)"/>
      <g clip-path="url(#iso-clip)">${beams}</g>
      <text x="${mx}" y="${-my}" text-anchor="middle" font-size="${fs}" fill="#1F3A5F"
        font-family="IBM Plex Sans,sans-serif" font-weight="600">${c.nBeams} poutrelles</text>
    </g>`;
  };

  window.choisirPlancherIsoltop = function (v) {
    const e = etatCourant();
    if (!e || !MONTAGES[v]) return;
    e.niv.isoltop = v;
    if (typeof rendreScene === "function") rendreScene();
    rendre();
  };

  function carte(niv, i, courant) {
    choix(niv, i);
    const m = MONTAGES[niv.isoltop];
    const geom = interieur(niv);
    const c = geom && niv.isoltop !== "aucun" ? calepiner(geom) : null;
    const chiffres = c ? `<div class="chiffres">
      <div><b>${f(geom.aire, 1)} m²</b><span>nu intérieur</span></div>
      <div><b>${c.nBeams}</b><span>poutrelles · ${f(c.ml, 1)} ml</span></div>
      <div><b>${f(c.coupe, 2)} m</b><span>coupe, appui 5 cm</span></div>
      <div><b>${f(geom.aire * m.litres / 1000, 2)} m³</b><span>béton hors chaînages</span></div>
    </div>` : `<p class="attente">${niv.isoltop === "aucun" ? "Aucun plancher sur ce niveau." : "Fermez le contour : les poutrelles se dessinent alors sur le plan."}</p>`;
    const toit = i === niveaux.length - 1
      ? `<label><input type="checkbox" data-toit="${i}"${niv.isoltopToit ? " checked" : ""}> Aussi en toiture-terrasse</label>` : "";
    return `<article class="carte${courant ? " actif" : ""}">
      <div class="ligne"><b>${niv.nom}${courant ? " · sur le plan" : ""}</b>
        <select data-iso="${i}">${options(niv.isoltop)}</select></div>
      ${toit}${chiffres}
    </article>`;
  }

  function rendre() {
    if (typeof niveaux === "undefined") return;
    const i = typeof iNiveau === "number" ? iNiveau : 0;
    const niv = niveaux[i];
    if (niv) choix(niv, i);
    const sel = document.getElementById("selPlancher");
    const resume = document.getElementById("plancher-resume");
    if (sel && niv) {
      const html = options(niv.isoltop);
      if (sel.dataset.cle !== i + html) {
        sel.innerHTML = html;
        sel.value = niv.isoltop;
        sel.dataset.cle = i + html;
      } else if (sel.value !== niv.isoltop) sel.value = niv.isoltop;
    }
    if (resume && niv) {
      const geom = interieur(niv);
      const c = geom && niv.isoltop !== "aucun" ? calepiner(geom) : null;
      resume.textContent = !geom
        ? "Fermez le contour pour voir les poutrelles"
        : niv.isoltop === "aucun"
          ? "Pas de plancher sur ce niveau"
          : c.nBeams + " poutrelles · entraxe " + f(c.entraxe * 100, 0) + " cm · " + f(geom.aire, 1) + " m²";
    }
    const host = document.getElementById("plancher-isoltop");
    if (!host) return;
    const ordre = [i, ...niveaux.map((_, k) => k).filter(k => k !== i)];
    host.innerHTML = `<h3>Plancher Isoltop</h3>
      <p class="note">Le menu au-dessus du plan règle le niveau affiché. Chaque niveau garde son choix, vide sanitaire compris.</p>
      ${ordre.map(k => carte(niveaux[k], k, k === i)).join("")}`;
    host.querySelectorAll("[data-iso]").forEach(el => {
      el.onchange = () => { niveaux[+el.dataset.iso].isoltop = el.value; rendre(); if (typeof rendreScene === "function") rendreScene(); };
    });
    host.querySelectorAll("[data-toit]").forEach(el => {
      el.onchange = () => { niveaux[+el.dataset.toit].isoltopToit = el.checked; rendre(); };
    });
  }

  window.rendrePlancherIsoltop = rendre;
  if (document.readyState !== "loading") rendre();
  else document.addEventListener("DOMContentLoaded", rendre);
})();
