/* Estimation Isoltop pour le calculateur Nudura.
   Ne touche pas au moteur de blocs. Les chiffres sont indicatifs :
   l'offre et le plan de pose restent ceux d'Isoltop. */
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
    "hourdinov-25": { label: "Hourdinov 25+5", litres: 90, languette: false }
  };

  const opts = { terrasse: false, bas: "elitech-r5", etage: "hourdinov-15", toit: "hourdinov-20" };

  function estVideSanitaire(niv, i) {
    return /vide/i.test(niv.nom || "") || i === 0;
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
    const aire = Math.abs(a / 2);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    dedans.forEach(p => {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    return { pts: dedans, aire, minX, minY, maxX, maxY, largeur: maxX - minX, profondeur: maxY - minY };
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
    const nHourdis = Math.ceil((nSpaces * portee) / H_ENTREVOUS);
    const nFiles = Math.max(0, Math.ceil(portee / ETAI) - 1);
    return {
      sens: spanX ? "sens de la largeur du plan" : "sens de la profondeur du plan",
      portee, repart, entraxe, nBeams, coupe, ml: nBeams * coupe,
      nHourdis, nEtais: nFiles * nBeams, nFiles
    };
  }

  function planchers() {
    if (typeof niveaux === "undefined") return [];
    const out = [];
    const fermes = niveaux.map((n, i) => ({ n, i, geom: interieur(n) })).filter(x => x.geom);
    if (!fermes.length) return out;
    const dernier = fermes[fermes.length - 1].i;
    fermes.forEach((support, k) => {
      const auDessus = niveaux[support.i + 1];
      const bas = estVideSanitaire(support.n, support.i) && k === 0;
      if (auDessus) {
        out.push({
          titre: bas ? "Plancher sur vide sanitaire" : "Plancher d'étage — " + (auDessus.nom || ("niveau " + (support.i + 2))),
          support: support.n.nom,
          montage: bas ? opts.bas : opts.etage,
          geom: support.geom,
          languette: bas
        });
      } else if (bas && fermes.length === 1) {
        out.push({
          titre: "Plancher bas (entrevous à languette)",
          support: support.n.nom,
          montage: opts.bas,
          geom: support.geom,
          languette: true
        });
      }
      if (opts.terrasse && support.i === dernier) {
        out.push({
          titre: "Plancher toiture-terrasse",
          support: support.n.nom,
          montage: opts.toit,
          geom: support.geom,
          languette: false,
          toit: true
        });
      }
    });
    return out;
  }

  function svg(geom, calc) {
    const W = 280, H = 160, pad = 12;
    const sx = (W - pad * 2) / Math.max(geom.largeur, 0.1);
    const sy = (H - pad * 2) / Math.max(geom.profondeur, 0.1);
    const s = Math.min(sx, sy);
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

  function rendre() {
    const host = document.getElementById("plancher-isoltop");
    if (!host) return;
    const liste = planchers();
    const sel = (id, cur) => Object.entries(MONTAGES).map(([k, m]) =>
      `<option value="${k}"${k === cur ? " selected" : ""}>${m.label}</option>`).join("");
    let rows = "";
    let aire = 0, ml = 0, beams = 0, litres = 0;
    liste.forEach(p => {
      const c = calepiner(p.geom);
      const m = MONTAGES[p.montage];
      const L = p.geom.aire * m.litres;
      aire += p.geom.aire; ml += c.ml; beams += c.nBeams; litres += L;
      rows += `<tr><td><b>${p.titre}</b><br>${p.support} · ${m.label}${p.languette ? " · languette" : ""}${p.toit ? " · étanchéité hors lot" : ""}<br>${svg(p.geom, c)}</td>
        <td>${f(p.geom.aire, 1)} m²<br>${c.nBeams} poutrelles<br>${f(c.ml, 1)} ml<br>coupe ${f(c.coupe, 2)} m<br>entraxe ${f(c.entraxe * 100, 1)} cm<br>${c.nHourdis} entrevous<br>${f(L / 1000, 2)} m³ béton</td></tr>`;
    });
    host.innerHTML = `
      <h3>Plancher Isoltop</h3>
      <p class="note">Estimation au nu intérieur. Le vide sanitaire porte des entrevous à languette. Les étages suivent s'ils existent. Isoltop établit l'offre et le plan de pose.</p>
      <label>Montage vide sanitaire / plancher bas
        <select id="isoBas">${sel("isoBas", opts.bas)}</select></label>
      <label>Montage étages
        <select id="isoEtage">${sel("isoEtage", opts.etage)}</select></label>
      <label><input type="checkbox" id="isoToit"${opts.terrasse ? " checked" : ""}> Plancher à la place de la toiture</label>
      <label>Montage toiture-terrasse
        <select id="isoToitM">${sel("isoToitM", opts.toit)}</select></label>
      ${liste.length ? `<table><tbody>${rows}</tbody></table>
        <p class="note">${f(aire, 1)} m² · ${beams} poutrelles · ${f(ml, 1)} ml · ${f(litres / 1000, 2)} m³ de béton hors chaînages, trémies et murs.</p>`
        : `<p class="note">Refermez un contour pour estimer le plancher.</p>`}`;
    const bind = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.onchange = () => { opts[key] = el.type === "checkbox" ? el.checked : el.value; rendre(); };
    };
    bind("isoBas", "bas");
    bind("isoEtage", "etage");
    bind("isoToit", "terrasse");
    bind("isoToitM", "toit");
  }

  window.rendrePlancherIsoltop = rendre;
  if (document.readyState !== "loading") rendre();
  else document.addEventListener("DOMContentLoaded", rendre);
})();
