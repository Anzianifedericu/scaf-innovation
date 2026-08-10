// SCAF Ménage — logique boutique (vanilla JS, pas de build)

const SUPABASE_URL = "https://crbvlowxxmspjnyculzl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyYnZsb3d4eG1zcGpueWN1bHpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMjU0NTgsImV4cCI6MjEwMDYwMTQ1OH0.5Cyas303BU5XYrI8b3YE3f-_5TIdrt_9027rDi9P4CE";

/* ---------------- Compte pro (portail SIRET partagé avec Nudura/BTP) ---------------- */
const PRO_PORTAL_WEBHOOK = "https://hook.eu1.make.com/h9t0hai8vsaqlhnmf6tfnyy6cjv581xm";
const PRO_TOKEN_KEY = "scaf_pro_token";
const PRO_DISCOUNT_MENAGE = 0.20; // -20% catalogue Ménage/Parex uniquement

let proAccess = null; // null = pas encore vérifié, false = pas pro, {raisonSociale,...} = pro validé

async function checkProAccess() {
  /* Remplace par la session unifiee de pro-btp.js (initPro).
     Conserve pour compatibilite : ne fait plus d'appel Airtable. */
  proAccess = false;
}

function isProBase() {
  return !!proAccess;
}

function proPrice(price_eur) {
  return Number(price_eur) * (1 - PRO_DISCOUNT_MENAGE);
}

// Affiche le prix pro uniquement si le compte est valide — un particulier ne voit jamais ce prix, ni dans le HTML ni dans le JS execute
function priceDisplayBase(price_eur) {
  if (isPro()) {
    return `<span class="card-price">${eur(proPrice(price_eur))} <span style="font-size:11px;color:#495765;font-weight:400">HT pro</span></span>`;
  }
  return `<span class="card-price">${eur(price_eur)}</span>`;
}

function updateProBadge() {
  const el = document.getElementById("pro-badge");
  if (!el) return;
  el.style.display = isPro() ? "inline-block" : "none";
  if (isPro()) el.textContent = `Compte pro — ${proAccess.raisonSociale || ""}`;
}


const CATEGORIES = {
  "BAGS": { label: "Sacs & Poubelles", icon: "bag" },
  "SPONGES SCOURERS": { label: "Éponges & Grattoirs", icon: "sponge" },
  "CLEANING CLOTHS": { label: "Chiffons", icon: "cloth" },
  "PERSONNEL CLEANING": { label: "Balais & Brosses", icon: "broom" },
  "CLEANING SYSTEMS": { label: "Systèmes de nettoyage", icon: "mop" },
  "CLEANING SETS": { label: "Kits de nettoyage", icon: "bucket" },
  "KITCHEN COOKING & STORAGE": { label: "Cuisine & Conservation", icon: "wrap" },
  "GLOVES": { label: "Gants", icon: "glove" },
  "MOPS": { label: "Serpillières", icon: "mop" },
};

// Départements de la boutique unifiée. D'autres pourront être ajoutés ici plus tard.
const DEPARTMENTS = {
  "menage": { label: "Ménage", tag: "Entretien & maison" },
  "nudura": { label: "Nudura ICF", tag: "Coffrage isolant" },
  "etancheite": { label: "Étanchéité TEXSA", tag: "Membranes & drainage" },
};

function deptLabel(dept) {
  return (DEPARTMENTS[dept] && DEPARTMENTS[dept].label) || dept || "Autre";
}

function catLabel(cat) {
  return (CATEGORIES[cat] && CATEGORIES[cat].label) || cat || "Autre";
}

function phIcon(cat) {
  // Placeholder icon shown until real product photos are added.
  const icon = (CATEGORIES[cat] && CATEGORIES[cat].icon) || "bag";
  const paths = {
    bag: '<path d="M20 30 L20 90 Q20 95 25 95 L75 95 Q80 95 80 90 L80 30 Z" fill="none" stroke="currentColor" stroke-width="4"/><path d="M35 30 L35 18 Q35 10 50 10 Q65 10 65 18 L65 30" fill="none" stroke="currentColor" stroke-width="4"/>',
    sponge: '<rect x="15" y="30" width="70" height="45" rx="8" fill="none" stroke="currentColor" stroke-width="4"/><path d="M25 42 h50 M25 54 h50 M25 66 h50" stroke="currentColor" stroke-width="3"/>',
    cloth: '<path d="M15 20 Q50 10 85 20 L80 85 Q50 95 20 85 Z" fill="none" stroke="currentColor" stroke-width="4"/>',
    broom: '<line x1="50" y1="10" x2="50" y2="65" stroke="currentColor" stroke-width="4"/><path d="M30 65 L70 65 L78 92 L22 92 Z" fill="none" stroke="currentColor" stroke-width="4"/>',
    mop: '<line x1="50" y1="8" x2="50" y2="55" stroke="currentColor" stroke-width="4"/><path d="M25 55 Q50 50 75 55 L70 88 Q50 95 30 88 Z" fill="none" stroke="currentColor" stroke-width="4"/>',
    bucket: '<path d="M25 35 L30 90 Q30 95 35 95 L65 95 Q70 95 70 90 L75 35" fill="none" stroke="currentColor" stroke-width="4"/><ellipse cx="50" cy="35" rx="25" ry="8" fill="none" stroke="currentColor" stroke-width="4"/><path d="M30 40 Q50 25 70 40" fill="none" stroke="currentColor" stroke-width="4"/>',
    wrap: '<circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" stroke-width="4"/><path d="M50 15 L50 85 M15 50 L85 50" stroke="currentColor" stroke-width="2" opacity=".5"/>',
    glove: '<path d="M35 90 L35 45 Q35 20 42 20 Q46 20 46 30 L46 45 M46 30 L46 15 Q46 8 51 8 Q56 8 56 15 L56 45 M56 20 Q56 12 61 12 Q66 12 66 20 L66 45 M66 28 Q66 22 71 22 Q76 22 76 28 L76 55 Q76 90 60 90 Z" fill="none" stroke="currentColor" stroke-width="3.5"/>',
  };
  return `<svg class="ph-icon" viewBox="0 0 100 100" fill="none">${paths[icon] || paths.bag}</svg>`;
}

function productPhoto(sku, category) {
  // Photo réelle si disponible dans /assets/products/, sinon icône de repli.
  const src = `/boutique/assets/products/${sku}.jpg`;
  return `<img src="${src}" alt="" loading="lazy" style="max-width:160px;max-height:160px;width:auto;height:auto;object-fit:contain" data-fallback-category="${category}" onerror="handlePhotoError(this)">`;
}

function handlePhotoError(imgEl) {
  imgEl.onerror = null;
  const category = imgEl.getAttribute("data-fallback-category");
  const wrapper = document.createElement("span");
  wrapper.innerHTML = phIcon(category);
  imgEl.replaceWith(wrapper.firstElementChild);
}

function shareButtons(url, title) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const icons = {
    facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.5A10 10 0 1 0 12 2m5.8 14.1c-.3.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-5-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5.3.6.9 2.1 1 2.2.1.2.1.4 0 .6-.1.2-.1.3-.3.5l-.4.5c-.1.2-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.6.3.1.5.1.6-.1.2-.2.7-.8.9-1.1.2-.3.4-.2.6-.1l1.9.9c.2.1.4.2.5.3.1.2.1.9-.2 1.6"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.6 10.6 20.4 3h-2.1l-5.5 6.6L8.3 3H2.7l7.2 10.2L2.7 21h2.1l6-7.1 5 7.1h5.6zM11.4 12.8l-.7-1L5.1 4.6h2.4l4.5 6.3.7 1 5.9 8.2h-2.4z"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.5.4l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7.5-.4l-2 2a5 5 0 0 0 7 7l1-1"/></svg>',
  };
  return `
    <div class="share-row">
      <span class="share-label">Partager</span>
      <a class="share-btn" href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener" aria-label="Partager sur Facebook">${icons.facebook}</a>
      <a class="share-btn" href="https://api.whatsapp.com/send?text=${t}%20${u}" target="_blank" rel="noopener" aria-label="Partager sur WhatsApp">${icons.whatsapp}</a>
      <a class="share-btn" href="https://twitter.com/intent/tweet?url=${u}&text=${t}" target="_blank" rel="noopener" aria-label="Partager sur X">${icons.x}</a>
      <a class="share-btn" href="mailto:?subject=${t}&body=${u}" aria-label="Partager par email">${icons.email}</a>
      <button type="button" class="share-btn" onclick="copyShareLink(this,'${url.replace(/'/g, "\\'")}')" aria-label="Copier le lien">${icons.link}</button>
    </div>`;
}

function copyShareLink(btn, url) {
  navigator.clipboard.writeText(url).then(() => {
    btn.classList.add("copied");
    setTimeout(() => btn.classList.remove("copied"), 1500);
  });
}

async function fetchProducts({ department = "menage", category = null, search = null } = {}) {
  let url = `${SUPABASE_URL}/rest/v1/shop_catalogue?select=*&order=category.asc,name.asc`;
  if (department) url += `&department=eq.${encodeURIComponent(department)}`;
  if (category) url += `&category=eq.${encodeURIComponent(category)}`;
  if (search) url += `&name=ilike.*${encodeURIComponent(search)}*`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error("Impossible de charger le catalogue");
  return res.json();
}

async function fetchProduct(sku) {
  const url = `${SUPABASE_URL}/rest/v1/shop_catalogue?select=*&sku=eq.${encodeURIComponent(sku)}&active=eq.true`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error("Produit introuvable");
  const rows = await res.json();
  return rows[0] || null;
}

async function fetchCategories(department = "menage") {
  const products = await fetchProducts({ department });
  const set = new Set(products.map((p) => p.category));
  return Array.from(set);
}

/* ---------------- Cart (localStorage) ---------------- */
const CART_KEY = "scaf_menage_cart_v1";

function getCart() {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY)) || [];
  } catch {
    return [];
  }
}
function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}
function addToCart(product, qty = 1) {
  const cart = getCart();
  const existing = cart.find((l) => l.sku === product.sku);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      sku: product.sku,
      name: product.name,
      category: product.category,
      price_eur: product.price_eur,
      qty,
    });
  }
  saveCart(cart);
  openCartDrawer();
}
function updateCartQty(sku, qty) {
  let cart = getCart();
  if (qty <= 0) {
    cart = cart.filter((l) => l.sku !== sku);
  } else {
    const line = cart.find((l) => l.sku === sku);
    if (line) line.qty = qty;
  }
  saveCart(cart);
  renderCartDrawer();
}
function cartTotal(cart) {
  const raw = cart.reduce((sum, l) => sum + l.price_eur * l.qty, 0);
  return Math.round(raw * 100) / 100;
}
function cartCount(cart) {
  return cart.reduce((sum, l) => sum + l.qty, 0);
}
function updateCartBadge() {
  const el = document.getElementById("cart-count");
  if (el) el.textContent = cartCount(getCart());
}

function eur(n) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

/* ---------------- Cart drawer UI (injected on every page) ---------------- */
function injectCartDrawer() {
  if (document.getElementById("cart-drawer")) return;
  const overlay = document.createElement("div");
  overlay.className = "cart-overlay";
  overlay.id = "cart-overlay";
  const drawer = document.createElement("div");
  drawer.className = "cart-drawer";
  drawer.id = "cart-drawer";
  drawer.innerHTML = `
    <div class="cart-head">
      <strong class="display">Votre panier</strong>
      <button aria-label="Fermer le panier" id="cart-close">&times;</button>
    </div>
    <div class="cart-items" id="cart-items"></div>
    <div class="cart-foot" id="cart-foot"></div>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(drawer);
  overlay.addEventListener("click", closeCartDrawer);
  document.getElementById("cart-close").addEventListener("click", closeCartDrawer);
  renderCartDrawer();
}

function renderCartDrawer() {
  const cart = getCart();
  const itemsEl = document.getElementById("cart-items");
  const footEl = document.getElementById("cart-foot");
  if (!itemsEl) return;
  if (cart.length === 0) {
    itemsEl.innerHTML = `<div class="cart-empty">Votre panier est vide.<br>Parcourez le catalogue pour ajouter des produits.</div>`;
    footEl.innerHTML = "";
    return;
  }
  itemsEl.innerHTML = cart
    .map(
      (l) => `
    <div class="cart-line">
      <div class="cart-line-thumb">${productPhoto(l.sku, l.category)}</div>
      <div class="cart-line-info">
        <div class="cart-line-name">${l.name}</div>
        <div class="cart-line-meta">
          <span>
            <button class="qty-btn" data-sku="${l.sku}" data-delta="-1" style="border:none;background:none;font-size:14px;padding:0 6px;">−</button>
            ${l.qty}
            <button class="qty-btn" data-sku="${l.sku}" data-delta="1" style="border:none;background:none;font-size:14px;padding:0 6px;">+</button>
          </span>
          <span>${eur(l.price_eur * l.qty)}</span>
        </div>
        <button class="cart-line-remove" data-sku="${l.sku}" data-remove="1">Retirer</button>
      </div>
    </div>`
    )
    .join("");
  footEl.innerHTML = `
    <div class="cart-total-row"><span>Total</span><strong>${eur(cartTotal(cart))}</strong></div>
    <a class="btn btn-primary" style="width:100%;justify-content:center" href="/boutique/checkout.html">Passer commande</a>
  `;
  itemsEl.querySelectorAll("[data-remove]").forEach((btn) =>
    btn.addEventListener("click", () => updateCartQty(btn.dataset.sku, 0))
  );
  itemsEl.querySelectorAll(".qty-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const cart = getCart();
      const line = cart.find((l) => l.sku === btn.dataset.sku);
      if (line) updateCartQty(btn.dataset.sku, line.qty + parseInt(btn.dataset.delta, 10));
    })
  );
}

function openCartDrawer() {
  renderCartDrawer();
  document.getElementById("cart-overlay").classList.add("open");
  document.getElementById("cart-drawer").classList.add("open");
}
function closeCartDrawer() {
  document.getElementById("cart-overlay").classList.remove("open");
  document.getElementById("cart-drawer").classList.remove("open");
}

/* ---------------- Header/Footer injection ---------------- */
function injectHeader() {
  const el = document.getElementById("site-header");
  if (!el) return;
  el.innerHTML = `
    <div class="header-inner">
      <a class="brand" href="/boutique/">
        <span class="brand-mark">SM</span>
        <span class="brand-text"><strong>SCAF Ménage</strong><span>Entretien & maison</span></span>
      </a>
      <div class="header-actions">
        <a href="https://scaf-innovation.com" class="icon-btn" style="display:none" id="link-back"></a>
        <span id="pro-badge" style="display:none;font-size:11.5px;background:#EAF2ED;color:#2F5945;border-radius:20px;padding:5px 10px;font-weight:600"></span>
        <button class="icon-btn" id="preorder-open-btn">
          Pré-demande <span class="cart-count" id="preorder-count">0</span>
        </button>
        <button class="icon-btn" id="cart-open-btn">
          Panier <span class="cart-count" id="cart-count">0</span>
        </button>
      </div>
    </div>
  `;
  document.getElementById("cart-open-btn").addEventListener("click", openCartDrawer);
  document.getElementById("preorder-open-btn").addEventListener("click", openPreorderDrawer);
}

function injectFooter() {
  const el = document.getElementById("site-footer");
  if (!el) return;
  el.innerHTML = `
    <div class="wrap footer-grid">
      <div>
        <h4>SCAF Ménage</h4>
        <p style="max-width:32ch;opacity:.85">Produits d'entretien et de nettoyage pour la maison, livrés en Corse. Une activité de SARL SCAF Innovation, Borgo.</p>
      </div>
      <div>
        <h4>Boutique</h4>
        <a href="/boutique/">Catalogue</a>
        <a href="/boutique/checkout.html">Mon panier</a>
      </div>
      <div>
        <h4>Informations</h4>
        <a href="/boutique/mentions-legales.html">Mentions légales</a>
        <a href="/boutique/cgv.html">CGV</a>
        <a href="/boutique/retours.html">Livraison &amp; retours</a>
        <a href="https://scaf-innovation.com">SCAF Innovation (BTP)</a>
      </div>
    </div>
    <div class="wrap footer-bottom">
      SARL SCAF Innovation — 775 Avenue de Valrose, 20290 Borgo — SIRET 791 805 906 00058
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  injectHeader();
  injectFooter();
  injectCartDrawer();
  injectPreorderDrawer();
  updateCartBadge();
  updatePreorderBadge();
  initChatbot();
});

const CHATBOT_WEBHOOK_URL = "https://hook.eu1.make.com/9fix6i7zj996t8c3iclfe4owoh1dpja6";
let chatbotHistory = [];

function initChatbot() {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <button id="chatbot-toggle" class="chatbot-toggle" aria-label="Ouvrir le chat">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
    </button>
    <div id="chatbot-panel" class="chatbot-panel" hidden>
      <div class="chatbot-head">
        <span>Un conseiller SCAF</span>
        <button id="chatbot-close" aria-label="Fermer">&times;</button>
      </div>
      <div id="chatbot-messages" class="chatbot-messages">
        <div class="chatbot-msg bot">Bonjour ! Une question sur nos produits, la livraison en Corse, ou nos systèmes de construction ? Je suis là pour vous aider.</div>
      </div>
      <form id="chatbot-form" class="chatbot-form">
        <input type="text" id="chatbot-input" placeholder="Votre question…" autocomplete="off">
        <button type="submit" aria-label="Envoyer">→</button>
      </form>
    </div>
  `;
  document.body.appendChild(wrap);

  const panel = document.getElementById("chatbot-panel");
  document.getElementById("chatbot-toggle").addEventListener("click", () => {
    panel.hidden = !panel.hidden;
  });
  document.getElementById("chatbot-close").addEventListener("click", () => {
    panel.hidden = true;
  });

  document.getElementById("chatbot-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("chatbot-input");
    const text = input.value.trim();
    if (!text) return;
    const messages = document.getElementById("chatbot-messages");
    messages.insertAdjacentHTML("beforeend", `<div class="chatbot-msg user">${text}</div>`);
    input.value = "";
    messages.insertAdjacentHTML("beforeend", `<div class="chatbot-msg bot" id="chatbot-typing">…</div>`);
    messages.scrollTop = messages.scrollHeight;

    try {
      const res = await fetch(CHATBOT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: chatbotHistory.join("\n") }),
      });
      const data = await res.json();
      document.getElementById("chatbot-typing")?.remove();
      messages.insertAdjacentHTML("beforeend", `<div class="chatbot-msg bot">${data.reply || "Désolé, je n'ai pas pu répondre. Réessayez."}</div>`);
      chatbotHistory.push("Visiteur: " + text, "Assistant: " + (data.reply || ""));
      if (chatbotHistory.length > 12) chatbotHistory = chatbotHistory.slice(-12);
    } catch (err) {
      document.getElementById("chatbot-typing")?.remove();
      messages.insertAdjacentHTML("beforeend", `<div class="chatbot-msg bot">Désolé, une erreur est survenue. Vous pouvez nous contacter directement à scafinnovation@gmail.com.</div>`);
    }
    messages.scrollTop = messages.scrollHeight;
  });
}

// ---------- Gestion du stock (badge + actions de repli) ----------

/* ---------------- Pré-demande cart (localStorage) — produits en rupture ---------------- */
const PREORDER_KEY = "scaf_menage_preorder_v1";

function getPreorderCart() {
  try {
    return JSON.parse(localStorage.getItem(PREORDER_KEY)) || [];
  } catch {
    return [];
  }
}
function savePreorderCart(cart) {
  localStorage.setItem(PREORDER_KEY, JSON.stringify(cart));
  updatePreorderBadge();
}
function addToPreorderCart(product, qty = 1) {
  const cart = getPreorderCart();
  const existing = cart.find((l) => l.sku === product.sku);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({ sku: product.sku, name: product.name, price_eur: product.price_eur, qty });
  }
  savePreorderCart(cart);
  openPreorderDrawer();
}
function updatePreorderQty(sku, qty) {
  let cart = getPreorderCart();
  if (qty <= 0) {
    cart = cart.filter((l) => l.sku !== sku);
  } else {
    const line = cart.find((l) => l.sku === sku);
    if (line) line.qty = qty;
  }
  savePreorderCart(cart);
  renderPreorderDrawer();
}
function preorderCount(cart) {
  return cart.reduce((sum, l) => sum + l.qty, 0);
}
function updatePreorderBadge() {
  const el = document.getElementById("preorder-count");
  if (el) el.textContent = preorderCount(getPreorderCart());
}

function injectPreorderDrawer() {
  if (document.getElementById("preorder-drawer")) return;
  const overlay = document.createElement("div");
  overlay.className = "cart-overlay";
  overlay.id = "preorder-overlay";
  const drawer = document.createElement("div");
  drawer.className = "cart-drawer";
  drawer.id = "preorder-drawer";
  drawer.innerHTML = `
    <div class="cart-head">
      <strong class="display">Ma pré-demande</strong>
      <button aria-label="Fermer" id="preorder-close">&times;</button>
    </div>
    <div class="cart-items" id="preorder-items"></div>
    <div class="cart-foot" id="preorder-foot"></div>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(drawer);
  overlay.addEventListener("click", closePreorderDrawer);
  document.getElementById("preorder-close").addEventListener("click", closePreorderDrawer);
  renderPreorderDrawer();
}

function renderPreorderDrawer() {
  const cart = getPreorderCart();
  const itemsEl = document.getElementById("preorder-items");
  const footEl = document.getElementById("preorder-foot");
  if (!itemsEl) return;

  if (cart.length === 0) {
    itemsEl.innerHTML = `<div class="cart-empty">Aucun produit en attente.<br>Ajoutez des produits actuellement en rupture pour recevoir une seule estimation groupée.</div>`;
    footEl.innerHTML = "";
    return;
  }

  itemsEl.innerHTML = cart
    .map(
      (l) => `
    <div class="cart-line">
      <div class="cart-line-thumb">${productPhoto(l.sku)}</div>
      <div class="cart-line-info">
        <div class="cart-line-name">${l.name}</div>
        <div class="cart-line-meta">
          <span>
            <button class="qty-btn" data-sku="${l.sku}" data-delta="-1" style="border:none;background:none;font-size:14px;padding:0 6px;">−</button>
            ${l.qty}
            <button class="qty-btn" data-sku="${l.sku}" data-delta="1" style="border:none;background:none;font-size:14px;padding:0 6px;">+</button>
          </span>
          <span>${eur(l.price_eur * l.qty)}</span>
        </div>
        <button class="cart-line-remove" data-sku="${l.sku}" data-remove="1">Retirer</button>
      </div>
    </div>`
    )
    .join("");

  footEl.innerHTML = `
    <div class="cart-total-row"><span>Total prévisionnel</span><strong>${eur(cartTotal(cart))}</strong></div>
    <div class="form-group" style="margin-top:10px">
      <label for="preorder-email">Votre e-mail</label>
      <input type="email" id="preorder-email" placeholder="vous@exemple.fr" required>
    </div>
    <button class="btn btn-primary" style="width:100%;justify-content:center" id="preorder-submit-btn">Envoyer ma pré-demande</button>
  `;

  itemsEl.querySelectorAll("[data-remove]").forEach((btn) =>
    btn.addEventListener("click", () => updatePreorderQty(btn.dataset.sku, 0))
  );
  itemsEl.querySelectorAll(".qty-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      const cart = getPreorderCart();
      const line = cart.find((l) => l.sku === btn.dataset.sku);
      if (line) updatePreorderQty(btn.dataset.sku, line.qty + parseInt(btn.dataset.delta, 10));
    })
  );
  document.getElementById("preorder-submit-btn").addEventListener("click", submitPreorder);
}

async function submitPreorder() {
  const cart = getPreorderCart();
  if (cart.length === 0) return;
  const emailInput = document.getElementById("preorder-email");
  const email = emailInput.value.trim();
  if (!email) {
    emailInput.focus();
    return;
  }
  const btn = document.getElementById("preorder-submit-btn");
  btn.disabled = true;
  btn.textContent = "Envoi en cours…";

  const preOrderId = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now());
  const rows = cart.map((l) => ({
    sku: l.sku,
    email,
    nom_produit: l.name,
    quantite: l.qty,
    prix_unitaire_eur: l.price_eur,
    pre_order_id: preOrderId,
  }));

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/stock_alerts`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(rows),
    });
    if (!res.ok) throw new Error("insert failed");
    localStorage.removeItem(PREORDER_KEY);
    updatePreorderBadge();
    document.getElementById("preorder-items").innerHTML = `<div class="cart-empty">Pré-demande envoyée ✓<br>Nous vous recontactons dès que possible.</div>`;
    document.getElementById("preorder-foot").innerHTML = "";
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Envoyer ma pré-demande";
    alert("Une erreur est survenue. Vous pouvez nous contacter directement à scafinnovation@gmail.com.");
  }
}

function openPreorderDrawer() {
  renderPreorderDrawer();
  document.getElementById("preorder-overlay").classList.add("open");
  document.getElementById("preorder-drawer").classList.add("open");
}
function closePreorderDrawer() {
  document.getElementById("preorder-overlay").classList.remove("open");
  document.getElementById("preorder-drawer").classList.remove("open");
}

/* ---------------- Gestion du stock (badge + bouton pré-demande) ---------------- */

function inStock(p) {
  return p.stock_status === "en_stock";
}

function stockBlock(p) {
  if (inStock(p)) {
    return `<button class="card-add" data-sku="${p.sku}" aria-label="Ajouter au panier">+</button>`;
  }
  return `
    <div class="stock-out-actions" onclick="event.preventDefault();event.stopPropagation()">
      <span class="badge-out-of-stock">Actuellement pas en stock</span>
      <button class="btn-mini" onclick='addToPreorderCartFromCard(${JSON.stringify(p).replace(/'/g, "&apos;")})'>Ajouter à ma pré-demande</button>
    </div>`;
}

function addToPreorderCartFromCard(p) {
  addToPreorderCart(p, 1);
}
