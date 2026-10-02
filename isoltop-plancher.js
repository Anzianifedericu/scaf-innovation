/* Calepinage Isoltop au nu intérieur, de mur à mur, refends compris.
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
    if (niv.isoltopSens !== "x" && niv.isoltopSens !== "y" && niv.isoltopSens !== "auto") niv.isoltopSens = "auto";
    if (typeof niv.isoltopToit !== "boolean") niv.isoltopToit = false;
    return niv;
  }
  function epMur(niv) {
    return (typeof HORS_TOUT !== "undefined" && HORS_TOUT[niv.epaisseur]) || 0.286;
  }
  function interieur(niv) {
    if (!niv || !niv.ferme || !niv.murs || niv.murs.length < 3) return null;
    if (typeof sommetsDe !== "function" || typeof versInterieur !== "function") return null;
    const pts = sommetsDe(niv).slice(0, -1);
    if (pts.length < 3) return null;
    const ep = epMur(niv);
    const anti = typeof aireSignee === "function" && aireSignee(niv) > 0;
    const dedans = versInterieur(pts, ep, anti);
    let a = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    dedans.forEach((p, i) => {
      const q = dedans[(i + 1) % dedans.length];
      a += p.x * q.y - q.x * p.y;
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    });
    let refA = 0;
    (niv.refends || []).forEach(r => {
      if (typeof longueurPoly === "function") refA += longueurPoly(r.pts) * ep;
    });
    return {
      pts: dedans, ep, aireBrute: Math.abs(a / 2),
      aire: Math.max(0, Math.abs(a / 2) - refA),
      minX, minY, maxX, maxY,
      largeur: maxX - minX, profondeur: maxY - minY
    };
  }

  function traverse(poly, horizontal, coord) {
    const hits = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      const aT = horizontal ? a.y : a.x, bT = horizontal ? b.y : b.x;
      const aU = horizontal ? a.x : a.y, bU = horizontal ? b.x : b.y;
      if ((aT <= coord && bT > coord) || (bT <= coord && aT > coord)) {
        const t = (coord - aT) / (bT - aT);
        hits.push(aU + t * (bU - aU));
      }
    }
    hits.sort((p, q) => p - q);
    const segs = [];
    for (let i = 0; i + 1 < hits.length; i += 2) {
      if (hits[i + 1] - hits[i] > 0.2) segs.push([hits[i], hits[i + 1]]);
    }
    return segs;
  }
  function surLeContour(niv, a, b) {
    if (typeof sommetsDe !== "function") return false;
    const ext = sommetsDe(niv).slice(0, -1);
    const dist = (p, c, d) => {
      const vx = d.x - c.x, vy = d.y - c.y, l2 = vx * vx + vy * vy;
      if (!l2) return Math.hypot(p.x - c.x, p.y - c.y);
      let t = ((p.x - c.x) * vx + (p.y - c.y) * vy) / l2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(p.x - (c.x + t * vx), p.y - (c.y + t * vy));
    };
    for (let i = 0; i < ext.length; i++) {
      const c = ext[i], d = ext[(i + 1) % ext.length];
      if (dist(a, c, d) < 0.25 && dist(b, c, d) < 0.25) return true;
    }
    return false;
  }
  function obstacles(niv, horizontal, coord, ep) {
    const half = ep / 2, iv = [];
    (niv.refends || []).forEach(r => {
      for (let i = 1; i < r.pts.length; i++) {
        const a = r.pts[i - 1], b = r.pts[i];
        if (surLeContour(niv, a, b)) continue;
        const aT = horizontal ? a.y : a.x, bT = horizontal ? b.y : b.x;
        const aU = horizontal ? a.x : a.y, bU = horizontal ? b.x : b.y;
        if (coord < Math.min(aT, bT) - half || coord > Math.max(aT, bT) + half) continue;
        const lo = Math.min(aU, bU) - half, hi = Math.max(aU, bU) + half;
        if (hi - lo > 0.05) iv.push([lo, hi]);
      }
    });
    return iv;
  }
  function soustraire(segs, iv) {
    let out = segs.map(s => s.slice());
    iv.forEach(([c, d]) => {
      const next = [];
      out.forEach(([a, b]) => {
        if (d <= a + 0.02 || c >= b - 0.02) { next.push([a, b]); return; }
        if (c > a + 0.25) next.push([a, c]);
        if (d < b - 0.25) next.push([d, b]);
      });
      out = next;
    });
    return out.filter(([a, b]) => b - a > 0.35);
  }
  function poser(geom, niv, horizontal) {
    const min = horizontal ? geom.minY : geom.minX;
    const max = horizontal ? geom.maxY : geom.maxX;
    const ampleur = max - min;
    if (ampleur < 0.4) return null;
    const nSpaces = Math.max(1, Math.round(ampleur / ENTRAXE));
    const entraxe = ampleur / nSpaces;
    const poutres = [];
    for (let i = 0; i <= nSpaces; i++) {
      const coord = min + i * entraxe;
      soustraire(traverse(geom.pts, horizontal, coord), obstacles(niv, horizontal, coord, geom.ep))
        .forEach(([a, b]) => poutres.push({ a, b, coord, long: b - a }));
    }
    if (!poutres.length) return null;
    const mlUtile = poutres.reduce((s, p) => s + p.long, 0);
    const moy = mlUtile / poutres.length;
    return {
      horizontal, entraxe, nSpaces, poutres,
      nBeams: poutres.length,
      ml: poutres.reduce((s, p) => s + p.long + 2 * APPUI, 0),
      moy,
      nHourdis: Math.max(1, Math.ceil(mlUtile / H_ENT)),
      nEtais: poutres.reduce((s, p) => s + Math.max(0, Math.ceil(p.long / ETAI) - 1), 0)
    };
  }
  function sensRefend(niv) {
    let hx = 0, hy = 0;
    (niv.refends || []).forEach(r => {
      for (let i = 1; i < r.pts.length; i++) {
        const a = r.pts[i - 1], b = r.pts[i];
        const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y), l = Math.hypot(dx, dy);
        if (dx >= dy) hx += l; else hy += l;
      }
    });
    if (hx > hy + 0.8) return false;
    if (hy > hx + 0.8) return true;
    return null;
  }
  function calepiner(geom, niv) {
    if (!geom || geom.aire < 0.5) return null;
    const px = poser(geom, niv, true);
    const py = poser(geom, niv, false);
    const force = niv.isoltopSens === "x" ? true : niv.isoltopSens === "y" ? false : sensRefend(niv);
    if (force === true && px) return px;
    if (force === false && py) return py;
    if (px && py) return px.moy <= py.moy ? px : py;
    return px || py;
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
    const geom = interieur(niv);
    return { niv, i, geom, calc: geom ? calepiner(geom, niv) : null };
  }

  window.marquagePlancherIsoltop = function (tr) {
    const e = etatCourant();
    if (!e || e.niv.isoltop === "aucun" || !e.calc) return "";
    const c = e.calc;
    const ep = Math.max(tr * 1.15, 0.025);
    const pts = e.geom.pts.map(p => `${p.x},${-p.y}`).join(" ");
    const beams = c.poutres.map(p => c.horizontal
      ? `<line x1="${p.a}" y1="${-p.coord}" x2="${p.b}" y2="${-p.coord}" stroke="#1F3A5F" stroke-width="${ep}" stroke-linecap="butt"/>`
      : `<line x1="${p.coord}" y1="${-p.a}" x2="${p.coord}" y2="${-p.b}" stroke="#1F3A5F" stroke-width="${ep}" stroke-linecap="butt"/>`
    ).join("");
    let sx = 0, sy = 0;
    e.geom.pts.forEach(p => { sx += p.x; sy += p.y; });
    const mx = sx / e.geom.pts.length, my = sy / e.geom.pts.length;
    const fs = Math.max(tr * 9, 0.18);
    return `<g id="iso-plancher">
      <defs><clipPath id="iso-clip"><polygon points="${pts}"/></clipPath></defs>
      <polygon points="${pts}" fill="rgba(31,58,95,.07)"/>
      <g clip-path="url(#iso-clip)">${beams}</g>
      <text x="${mx}" y="${-my}" text-anchor="middle" font-size="${fs}" fill="#1F3A5F"
        font-family="IBM Plex Sans,sans-serif" font-weight="600">${c.nBeams} poutrelles · mur à mur</text>
    </g>`;
  };

  window.choisirNiveauIsoltop = function (v) {
    const i = Number(v);
    if (!Number.isInteger(i) || typeof niveaux === "undefined" || !niveaux[i]) return;
    if (typeof allerNiveau === "function") allerNiveau(i);
  };
  window.choisirPlancherIsoltop = function (v) {
    const e = etatCourant();
    if (!e || !MONTAGES[v]) return;
    e.niv.isoltop = v;
    if (typeof rendreScene === "function") rendreScene();
    rendre();
  };
  window.choisirSensIsoltop = function (v) {
    const e = etatCourant();
    if (!e) return;
    e.niv.isoltopSens = v === "x" || v === "y" ? v : "auto";
    if (typeof rendreScene === "function") rendreScene();
    rendre();
  };

  function carte(niv, i, courant) {
    choix(niv, i);
    const m = MONTAGES[niv.isoltop];
    const geom = interieur(niv);
    const c = geom && niv.isoltop !== "aucun" ? calepiner(geom, niv) : null;
    const chiffres = c ? `<div class="chiffres">
      <div><b>${f(geom.aire, 1)} m²</b><span>entre murs, hors refends</span></div>
      <div><b>${c.nBeams}</b><span>poutrelles · ${f(c.ml, 1)} ml</span></div>
      <div><b>${f(c.moy + 2 * APPUI, 2)} m</b><span>coupe moyenne, appui 5 cm</span></div>
      <div><b>${f(geom.aire * m.litres / 1000, 2)} m³</b><span>béton hors chaînages</span></div>
    </div>` : `<p class="attente">${niv.isoltop === "aucun" ? "Aucun plancher sur ce niveau." : "Fermez le contour : les poutrelles suivent les murs."}</p>`;
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
    const selNiv = document.getElementById("selNiveau");
    if (selNiv) {
      const optsNiv = niveaux.map((n, k) =>
        `<option value="${k}"${k === i ? " selected" : ""}>${n.nom}</option>`).join("");
      if (selNiv.dataset.cle !== optsNiv) {
        selNiv.innerHTML = optsNiv;
        selNiv.dataset.cle = optsNiv;
      }
      selNiv.value = String(i);
    }
    const sel = document.getElementById("selPlancher");
    if (sel && niv) {
      const html = options(niv.isoltop);
      if (sel.dataset.cle !== i + html) {
        sel.innerHTML = html;
        sel.value = niv.isoltop;
        sel.dataset.cle = i + html;
      } else if (sel.value !== niv.isoltop) sel.value = niv.isoltop;
    }
    const sens = document.getElementById("selSens");
    if (sens && niv && sens.value !== niv.isoltopSens) sens.value = niv.isoltopSens;
    const resume = document.getElementById("plancher-resume");
    const geom = niv ? interieur(niv) : null;
    const c = geom && niv.isoltop !== "aucun" ? calepiner(geom, niv) : null;
    if (resume && niv) {
      resume.textContent = !geom
        ? "Fermez le contour : le plancher suit les murs"
        : niv.isoltop === "aucun"
          ? "Pas de plancher sur ce niveau"
          : c.nBeams + " poutrelles de mur à mur · " + f(geom.aire, 1) + " m² · entraxe " + f(c.entraxe * 100, 0) + " cm";
    }
    const host = document.getElementById("plancher-isoltop");
    if (!host) return;
    const ordre = [i, ...niveaux.map((_, k) => k).filter(k => k !== i)];
    host.innerHTML = `<h3>Plancher Isoltop</h3>
      <p class="note">Le plancher s'arrête au nu intérieur des murs et se coupe sur les refends. L'épaisseur du bloc (102 à 305 mm) est celle du niveau.</p>
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
