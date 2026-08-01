#!/usr/bin/env python3
"""
Applique le lien "Espace Pro" (header desktop + panneau mobile) sur toutes
les pages -fr.html du site SCAF Innovation.

v3 : le bouton CTA principal (texte et lien) varie d'une page à l'autre
("Devis" / "Étude gratuite" / etc.) — la détection se fait donc par motif
(regex) sur la structure (<div class="nav-right">...<a class="btn">...
avant le bouton burger, et .../<a class="btn">...</div></header> pour le
panneau mobile), plus par exact match sur le CSS partagé.

Gère aussi le format "bundle" (Claude Design export, HTML encodé en JSON
dans une balise <script type="__bundler/template">) utilisé par certaines
pages (ex: fr.html).

Usage :
    python3 appliquer-espace-pro.py

À exécuter à la racine du dépôt. Modifie les fichiers en place.
"""

import glob
import json
import os
import re
import sys

CSS_BLOC = '''  .btn-ghost{background:transparent; border:1.5px solid var(--nuit); color:var(--nuit);}
  .btn-ghost:hover{background:rgba(0,0,0,0.04);}
  .btn-pro{display:inline-flex; align-items:center; gap:6px; font-family:'IBM Plex Sans',sans-serif; font-weight:600; font-size:0.84rem; padding:9px 16px; background:transparent; border:1.5px solid var(--nuit); color:var(--nuit); text-decoration:none; white-space:nowrap; transition:background .15s, border-color .15s;}
  .btn-pro:hover{background:rgba(0,0,0,0.04); border-color:var(--terracotta); color:var(--terracotta);}
  .btn-pro svg{flex:0 0 auto;}'''

CSS_ANCIEN = '''  .btn-ghost{background:transparent; border:1.5px solid var(--nuit); color:var(--nuit);}
  .btn-ghost:hover{background:rgba(0,0,0,0.04);}'''

MEDIA_NOUVEAU = '''  @media (max-width:760px){
    .nav-links{display:none;}
    .nav-right .btn{display:none;}
    .nav-right .btn-pro{display:none;}
    .burger{display:flex;}
  }'''

MEDIA_ANCIEN = '''  @media (max-width:760px){
    .nav-links{display:none;}
    .nav-right .btn{display:none;}
    .burger{display:flex;}
  }'''

ESPACE_PRO_DESKTOP = '''      <a href="connexion-pro.html" class="btn-pro">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Espace Pro
      </a>
      '''

ESPACE_PRO_MOBILE = '''    <a href="connexion-pro.html">Espace Pro</a>
    '''

# Motif : le premier <a ... class="btn">...</a> qui apparait entre
# <div class="nav-right"> et le bouton burger (CTA desktop du header)
RE_NAV_DESKTOP = re.compile(
    r'(<div class="nav-right">.*?)(<a href="[^"]*" class="btn">[^<]*</a>)(\s*<button class="burger")',
    re.DOTALL,
)

# Motif : le <a ... class="btn">...</a> juste avant la fermeture du panneau
# mobile et du header (CTA mobile, dupliqué du desktop)
RE_MOBILE_PANEL = re.compile(
    r'(<a href="[^"]*" class="btn">[^<]*</a>)(\s*</div>\s*</header>)'
)


def patcher_html(html):
    """Applique les remplacements sur le HTML décodé. Retourne (html_modifie, erreur)."""
    if "connexion-pro.html" in html:
        return None, "déjà appliqué"

    if CSS_ANCIEN not in html:
        return None, "bloc CSS .btn-ghost introuvable, structure différente"
    if MEDIA_ANCIEN not in html:
        return None, "media query mobile introuvable, structure différente"
    if not RE_NAV_DESKTOP.search(html):
        return None, "CTA desktop (nav-right -> bouton burger) introuvable, structure différente"
    if not RE_MOBILE_PANEL.search(html):
        return None, "CTA mobile (avant fermeture du panneau) introuvable, structure différente"

    html = html.replace(CSS_ANCIEN, CSS_BLOC, 1)
    html = html.replace(MEDIA_ANCIEN, MEDIA_NOUVEAU, 1)
    html = RE_NAV_DESKTOP.sub(lambda m: m.group(1) + ESPACE_PRO_DESKTOP + m.group(2) + m.group(3), html, count=1)
    html = RE_MOBILE_PANEL.sub(lambda m: ESPACE_PRO_MOBILE + m.group(1) + m.group(2), html, count=1)

    return html, None


def trouver_ligne_template(lines):
    for i, line in enumerate(lines):
        if i > 0 and lines[i - 1].strip() == '<script type="__bundler/template">':
            return i
    return None


def traiter_fichier_bundle(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    lines = content.split("\n")
    idx = trouver_ligne_template(lines)
    if idx is None:
        return "ERREUR : balise __bundler/template introuvable"

    try:
        html = json.loads(lines[idx])
    except Exception as e:
        return f"ERREUR : JSON du template illisible ({e})"

    html_modifie, erreur = patcher_html(html)
    if erreur == "déjà appliqué":
        return "déjà appliqué, ignoré"
    if erreur:
        return f"ERREUR : {erreur}"

    reencoded = json.dumps(html_modifie, ensure_ascii=False).replace("/", "\\u002F")
    lines[idx] = reencoded
    rebuilt = "\n".join(lines)

    with open(path, "w", encoding="utf-8") as f:
        f.write(rebuilt)

    return "OK — modifié (format bundle)"


def traiter_fichier_html_simple(path):
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()

    html_modifie, erreur = patcher_html(html)
    if erreur == "déjà appliqué":
        return "déjà appliqué, ignoré"
    if erreur:
        return f"ERREUR : {erreur}"

    with open(path, "w", encoding="utf-8") as f:
        f.write(html_modifie)

    return "OK — modifié (HTML simple)"


def traiter_fichier(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    if '<script type="__bundler/template">' in content:
        return traiter_fichier_bundle(path)
    else:
        return traiter_fichier_html_simple(path)


def main():
    fichiers = sorted(set(glob.glob("*-fr.html") + (["fr.html"] if os.path.exists("fr.html") else [])))

    if not fichiers:
        print("Aucun fichier -fr.html trouvé dans le répertoire courant.")
        sys.exit(1)

    print(f"{len(fichiers)} fichier(s) trouvé(s) :\n")
    for f in fichiers:
        resultat = traiter_fichier(f)
        print(f"  {f} -> {resultat}")


if __name__ == "__main__":
    main()
