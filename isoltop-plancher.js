/* Estimation Isoltop pour le calculateur Nudura.
   Choix de montage libre sur chaque niveau, vide sanitaire compris.
   Ne touche pas au moteur de blocs. */
(function () {
  const ENTRAXE = 0.60;
  const APPUI = 0.05;
  const H_ENTREVOUS = 1.20;
  const ETAI = 1.50;

  const MONTAGES = {
    "elitech-r4": { label: "ELITech R4 à languette", litres: 77, languette: true },
    "elitech-r5": { label: "ELITech R5 à languette", litres: 80, languette: true },
    "elitech-r6": { label: "ELITech R6 à languette", litres: 84, languette: true },
    "hourdinov-12": { label: "Hourdinov 12+5", litres: 73, languette: false },
    "hourdinov-15": { label: "Hourdinov 15+5", litres: 77, languette: false },
    "hourdinov-20": { label: "Hourdinov 20+5", litres: 84, languette: false },
    "hourdinov-25": { label: "Hourdinov 25+5", litres: 90, languette: false },
    "aucun": { label: "Pas de plancher Isoltop", litres: 0, languette: false }
  };

  function defaut(niv, i) {
    if (/vide/i.test(niv.nom || "") || i === 0) return "elitech-r5";
    if (/comble|toit/i.test(niv.nom || "")) return "hourdinov-20";
    return "hourdinov-15";
  }

  function choix(niv, i) {
    if (!niv.isoltop) niv.isoltop = defaut(niv, i);
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
    let a = 0;
    for (let i = 0; i < dedans.length; i++) {
      const q = dedans[(i + 1) % dedans.length];
      a += dedans[i].x * q.y - q.x * dedans[i].y;
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    dedans.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    return {
      pts: dedans, aire: Math.abs(a / 2),
      minX, minY, maxX, maxY,
      largeur: maxX - minX, profondeur: maxY - minY
    };
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
      portee, entraxe, nBeams, coupe, ml: nBeams * coupe,
      nHourdis: Math.ceil((nSpaces * portee) / H_ENTREVOUS),
      nEtais: Math.max(0, Math.ceil(portee / ETAI) - 1) * nBeams
    };
  }

  function svg(geom, calc) {
    const W = 260, H = 140, pad = 10;
    const s = Math.min((W - pad * 2) / Math.max(geom.largeur, 0.1), (H - pad * 2) / Math.max(geom.profondeur, 0.1));
    const ox = pad + ((W - pad * 2) - geom.largeur * s) / 2;
    const oy = pad + ((H - pad * 2) - geom.profondeur * s) / 2;
    const X = x => ox + (x - geom.minX) * s;
    const Y = y => oy + (geom.maxY - y) * s;
    const poly = geom.pts.map(p => X(p.x).toFixed(1) + "," + Y(p.y).toFixed(1)).join(" ");
    let beams = "";
    const spanX = geom.largeur <= geom.profondeur;
    for (let i = 0; i < calc.nBeams; i++) {
      const t = i / Math.max(1, calc.nBeams - 1);
      if (spanX) {
        const y = Y(geom.minY + t * geom.profondeur);
        beams += `<line x1="${X(geom.minX)}" y1="${y}" x2="${X(geom.maxX)}" y2="${y}" stroke="#2f3d4a" stroke-width="1.4"/>`;
      } else {
        const x = X(geom.minX + t * geom.largeur);
        beams += `<line x1="${x}" y1="${Y(geom.minY)}" x2="${x}" y2="${Y(geom.maxY)}" stroke="#2f3d4a" stroke-width="1.4"/>`;
      }
    }
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" aria-hidden="true"><polygon points="${poly}" fill="#f3e7c8" stroke="#8d3d14"/>${beams}</svg>`;
  }

  function f(n, d) { return n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }); }

  function options(cur) {
    return Object.entries(MONTAGES).map(([k, m]) =>
      `<option value="${k}"${k === cur ? " selected" : ""}>${m.label}</option>`).join("");
  }

  function rendre() {
    const host = document.getElementById("plancher-isoltop");
    if (!host || typeof niveaux === "undefined") return;
    let aire = 0, ml = 0, beams = 0, litres = 0;
    const rows = niveaux.map((niv, i) => {
      choix(niv, i);
      const geom = interieur(niv);
      const m = MONTAGES[niv.isoltop];
      let detail = "Contour non fermé — le choix est déjà enregistré.";
      if (niv.isoltop === "aucun") detail = "Ce niveau ne reçoit pas de plancher Isoltop.";
      else if (geom) {
        const c = calepiner(geom);
        const L = geom.aire * m.litres;
        aire += geom.aire; ml += c.ml; beams += c.nBeams; litres += L;
        detail = `${f(geom.aire, 1)} m² · ${c.nBeams} poutrelles · ${f(c.ml, 1)} ml · coupe ${f(c.coupe, 2)} m · entraxe ${f(c.entraxe * 100, 1)} cm · ${c.nHourdis} entrevous · ${f(L / 1000, 2)} m³ béton${m.languette ? " · languette" : ""}<br>${svg(geom, c)}`;
        if (niv.isoltopToit && niv.isoltop !== "aucun") {
          aire += geom.aire; ml += c.ml; beams += c.nBeams; litres += L;
          detail += `<br>Toiture-terrasse : mêmes quantités, étanchéité hors lot.`;
        }
      }
      const toit = i === niveaux.length - 1
        ? `<label><input type="checkbox" data-toit="${i}"${niv.isoltopToit ? " checked" : ""}> Aussi en toiture-terrasse</label>`
        : "";
      return `<tr><td><b>${niv.nom}</b><br>
        <select data-iso="${i}">${options(niv.isoltop)}</select>
        ${toit}<br><span class="note">${detail}</span></td></tr>`;
    }).join("");
    host.innerHTML = `
      <h3>Plancher Isoltop</h3>
      <p class="note">Un choix par niveau, vide sanitaire compris. Le + des onglets ajoute un étage. Suggestion : languette en vide sanitaire, Hourdinov au-dessus. Rien n'est imposé.</p>
      <table><tbody>${rows}</tbody></table>
      <p class="note">${aire ? `${f(aire, 1)} m² · ${beams} poutrelles · ${f(ml, 1)} ml · ${f(litres / 1000, 2)} m³ hors chaînages.` : "Refermez un contour pour les quantités."} Offre et plan de pose : Isoltop.</p>`;
    host.querySelectorAll("[data-iso]").forEach(el => {
      el.onchange = () => { niveaux[+el.dataset.iso].isoltop = el.value; rendre(); };
    });
    host.querySelectorAll("[data-toit]").forEach(el => {
      el.onchange = () => { niveaux[+el.dataset.toit].isoltopToit = el.checked; rendre(); };
    });
  }

  window.rendrePlancherIsoltop = rendre;
  if (document.readyState !== "loading") rendre();
  else document.addEventListener("DOMContentLoaded", rendre);
})();
