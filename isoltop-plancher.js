/* Panneau Isoltop. Ne touche pas au tracé des murs. */
(function () {
  const MONTAGES = {
    "aucun": { label: "Pas de plancher", litres: 0 },
    "elitech-r4": { label: "ELITech R4 à languette", litres: 77 },
    "elitech-r5": { label: "ELITech R5 à languette", litres: 80 },
    "elitech-r6": { label: "ELITech R6 à languette", litres: 84 },
    "hourdinov-12": { label: "Hourdinov 12+5", litres: 73 },
    "hourdinov-15": { label: "Hourdinov 15+5", litres: 77 },
    "hourdinov-20": { label: "Hourdinov 20+5", litres: 84 },
    "hourdinov-25": { label: "Hourdinov 25+5", litres: 90 }
  };
  const LIMITE = {
    "elitech-r4": 5.8, "elitech-r5": 5.8, "elitech-r6": 5.8,
    "hourdinov-12": 5.1, "hourdinov-15": 6, "hourdinov-20": 6, "hourdinov-25": 8.1
  };

  function f(n, d) {
    return n.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  window.marquagePlancherIsoltop = function () { return ""; };

  window.rendrePlancherIsoltop = function () {
    const host = document.getElementById("plancher-isoltop");
    if (!host || typeof niveaux === "undefined") return;
    const i = typeof iNiveau === "number" ? iNiveau : 0;
    const niv = niveaux[i];
    if (!niv) return;
    if (!MONTAGES[niv.isoltop]) niv.isoltop = "aucun";
    const ps = niv.poutres || [];
    const longs = ps.map(b => Math.hypot(b.b.x - b.a.x, b.b.y - b.a.y)).filter(l => l > 0.15);
    const portee = longs.length ? Math.max(...longs) : 0;
    const ml = longs.reduce((s, l) => s + l + 0.1, 0);
    const aire = niv.ferme && typeof surfaceHabitable === "function" ? surfaceHabitable(niv) : 0;
    const m = MONTAGES[niv.isoltop];
    const lim = LIMITE[niv.isoltop] || 8.1;
    const opts = Object.entries(MONTAGES).map(([k, v]) =>
      `<option value="${k}"${k === niv.isoltop ? " selected" : ""}>${v.label}</option>`).join("");
    const alerte = niv.isoltop !== "aucun" && portee > lim + 0.05
      ? `<p class="note" style="color:#A32020">Portée ${f(portee, 2)} m, au-delà de ${f(lim, 1)} m pour ce montage.</p>` : "";
    host.innerHTML = `<h3>Plancher Isoltop — ${niv.nom}</h3>
      <p class="note">Bouton Plancher : deux clics par poutrelle. Les murs restent le mode Contour.</p>
      <label>Montage <select id="isoMontage">${opts}</select></label>
      <label>Hauteur du plancher
        <input id="isoCote" type="number" step="0.01" placeholder="libre"
               value="${niv.cotePlancher == null ? "" : niv.cotePlancher}" style="width:72px"> m
      </label>
      <table>
        <tr><td>Poutrelles</td><td>${longs.length}${longs.length ? " · " + f(ml, 1) + " ml" : ""}</td></tr>
        <tr><td>Portée la plus longue</td><td>${longs.length ? f(portee, 2) + " m" : "—"}</td></tr>
        <tr><td>Béton hors chaînages</td><td>${aire && m.litres ? f(aire * m.litres / 1000, 2) + " m³" : "—"}</td></tr>
      </table>
      ${alerte}`;
    const sel = document.getElementById("isoMontage");
    if (sel) sel.onchange = () => { niv.isoltop = sel.value; rendre(); if (typeof rendreScene === "function") rendreScene(); };
    const cote = document.getElementById("isoCote");
    if (cote) cote.oninput = () => {
      const n = parseFloat(String(cote.value).replace(",", "."));
      niv.cotePlancher = Number.isFinite(n) ? n : null;
    };
  };

  function rendre() { window.rendrePlancherIsoltop(); }
  if (document.readyState !== "loading") rendre();
  else document.addEventListener("DOMContentLoaded", rendre);
})();
