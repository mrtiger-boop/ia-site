const SUPABASE_URL = "https://azgahpygwlrrmozbjrqo.supabase.co";
const SUPABASE_KEY = "sb_publishable_fVRUhodws3p_7UVjnODJwg_7UpsyJwQ";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
  user: null,
  profile: null,
  plan: "free",
  credits: 0,
  history: [],
  generatedFiles: null
};

const HISTORY_KEY = "siteo_v8_history";
const COMMUNITY_KEY = "siteo_v8_community";
const LEAF_KEY = "siteo_leaves_enabled";

const $ = (id) => document.getElementById(id);

const els = {
  openLoginBtn: $("openLoginBtn"),
  openSignupBtn: $("openSignupBtn"),
  logoutBtn: $("logoutBtn"),
  signupBtn: $("signupBtn"),
  loginBtn: $("loginBtn"),
  openResetBtn: $("openResetBtn"),
  resetPasswordBtn: $("resetPasswordBtn"),
  switchToLoginBtn: $("switchToLoginBtn"),
  switchToSignupBtn: $("switchToSignupBtn"),
  signupModal: $("signupModal"),
  loginModal: $("loginModal"),
  resetModal: $("resetModal"),
  toast: $("toast"),
  mobileMenuBtn: $("mobileMenuBtn"),
  navLinks: $("navLinks"),
  creditCount: $("creditCount"),
  planStatus: $("planStatus"),
  accountStatus: $("accountStatus"),
  dashUsername: $("dashUsername"),
  dashEmail: $("dashEmail"),
  dashVerified: $("dashVerified"),
  dashCredits: $("dashCredits"),
  dashPlan: $("dashPlan"),
  templateForm: $("templateForm"),
  resultText: $("resultText"),
  sitePreview: $("sitePreview"),
  downloadBtn: $("downloadBtn"),
  copyBtn: $("copyBtn"),
  buy100Btn: $("buy100Btn"),
  buy1000Btn: $("buy1000Btn"),
  proBtn: $("proBtn"),
  cancelSubBtn: $("cancelSubBtn"),
  clearHistoryBtn: $("clearHistoryBtn"),
  historyList: $("historyList"),
  shareForm: $("shareForm"),
  communityGrid: $("communityGrid"),
  leafToggle: $("leafToggle"),
  leafLayer: $("leafLayer")
};

function notify(message) {
  if (!els.toast) return alert(message);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 3500);
}

function openModal(id) { $(id)?.classList.remove("hidden"); }
function closeModal(id) { $(id)?.classList.add("hidden"); }

function safeJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}

function saveHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history));
}

function isEmailConfirmed() {
  return Boolean(state.user?.email_confirmed_at || state.user?.confirmed_at);
}

async function initAuth() {
  state.history = safeJSON(HISTORY_KEY, []);

  const { data } = await supabaseClient.auth.getSession();
  state.user = data?.session?.user || null;

  if (state.user) {
    await ensureProfile();
    await loadProfile();
  }

  updateUI();

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    state.user = session?.user || null;

    if (state.user) {
      await ensureProfile();
      await loadProfile();
    } else {
      state.profile = null;
      state.plan = "free";
      state.credits = 0;
    }

    updateUI();
  });
}

async function ensureProfile() {
  if (!state.user) return;

  const { data: existing } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", state.user.id)
    .maybeSingle();

  if (existing) {
    state.profile = existing;
    return;
  }

  const username = state.user.user_metadata?.username || state.user.email?.split("@")[0] || "Utilisateur Siteo";

  const { data, error } = await supabaseClient
    .from("profiles")
    .insert({
      id: state.user.id,
      username,
      email: state.user.email,
      plan: "free",
      credits: 100
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    return;
  }

  state.profile = data;
}

async function loadProfile() {
  if (!state.user) return;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", state.user.id)
    .single();

  if (error) {
    console.error("Profile error", error);
    return;
  }

  state.profile = data;
  state.plan = data.plan || "free";
  state.credits = Number(data.credits ?? 100);
}

async function updateCredits(next) {
  if (!state.user || state.plan === "pro") return;

  const safe = Math.max(0, Number(next));

  const { data, error } = await supabaseClient
    .from("profiles")
    .update({ credits: safe })
    .eq("id", state.user.id)
    .select()
    .single();

  if (error) {
    console.error(error);
    notify("Erreur mise à jour crédits.");
    return;
  }

  state.profile = data;
  state.credits = Number(data.credits ?? safe);
}

function updateUI() {
  const username = state.profile?.username || state.user?.user_metadata?.username || state.user?.email || "Invité";
  const isPro = state.plan === "pro";
  const creditsText = isPro ? "∞" : `${Number(state.credits ?? 0)} crédits`;

  if (els.creditCount) els.creditCount.textContent = creditsText;
  if (els.planStatus) els.planStatus.textContent = isPro ? "Pro" : "Free";
  if (els.accountStatus) els.accountStatus.textContent = username;

  if (els.dashUsername) els.dashUsername.textContent = username;
  if (els.dashEmail) els.dashEmail.textContent = state.user?.email || "Connecte-toi pour voir ton profil.";
  if (els.dashVerified) els.dashVerified.textContent = isEmailConfirmed() ? "Email confirmé" : "Email non confirmé";
  if (els.dashCredits) els.dashCredits.textContent = creditsText;
  if (els.dashPlan) els.dashPlan.textContent = isPro ? "Pro" : "Free";

  if (els.openLoginBtn && els.openSignupBtn && els.logoutBtn) {
    if (state.user) {
      els.openLoginBtn.classList.add("hidden");
      els.openSignupBtn.classList.add("hidden");
      els.logoutBtn.classList.remove("hidden");
    } else {
      els.openLoginBtn.classList.remove("hidden");
      els.openSignupBtn.classList.remove("hidden");
      els.logoutBtn.classList.add("hidden");
    }
  }

  renderHistory();
  renderCommunity();
}

function getActiveGeneratorMode() {
  const active = document.querySelector(".tab.active[data-generator-tab]");
  return active?.dataset.generatorTab || "create";
}

function buildPrompt() {
  const mode = getActiveGeneratorMode();

  if (mode === "improve") {
    return $("improvePrompt")?.value || "Améliore ce site en version premium.";
  }

  const project = $("projectName")?.value || "Site sans nom";
  const type = $("siteType")?.value || "Landing page";
  const style = $("style")?.value || "Premium";
  const desc = $("description")?.value || "Créer un site complet, moderne, responsive et professionnel.";

  return `Créer un site web complet.

Nom : ${project}
Type : ${type}
Style : ${style}

Description :
${desc}

Inclure :
- hero premium
- statistiques
- fonctionnalités
- avis clients
- FAQ
- CTA
- footer complet
- animations légères
- responsive mobile
- SEO propre`;
}

function updatePreview(files) {
  if (!els.sitePreview || !files) return;

  const srcdoc = files.html
    .replace("</head>", `<style>${files.css || ""}</style></head>`)
    .replace("</body>", `<script>${files.js || ""}<\/script></body>`);

  els.sitePreview.srcdoc = srcdoc;
}

function formatResult(files) {
  return `INDEX.HTML\n\n${files.html || ""}\n\nSTYLE.CSS\n\n${files.css || ""}\n\nSCRIPT.JS\n\n${files.js || ""}`;
}

async function generateSite(event) {
  event.preventDefault();

  if (!state.user) {
    openModal("signupModal");
    return notify("Crée un compte ou connecte-toi.");
  }

  if (!isEmailConfirmed()) {
    return notify("Confirme ton email avant de générer.");
  }

  if (state.plan !== "pro" && state.credits < 10) {
    return notify("Tu n'as plus assez de crédits.");
  }

  const mode = getActiveGeneratorMode();
  const prompt = buildPrompt();
  const existingSite = $("existingSiteCode")?.value || "";

  if (els.resultText) els.resultText.textContent = "Création en cours...";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, mode, existingSite })
    });

    const files = await response.json();

    state.generatedFiles = {
      html: files.html || "",
      css: files.css || "",
      js: files.js || ""
    };

    if (state.plan !== "pro") {
      await updateCredits(state.credits - 10);
    }

    state.history.unshift({
      id: Date.now(),
      title: $("projectName")?.value || (mode === "improve" ? "Site amélioré" : "Site généré"),
      date: new Date().toLocaleString("fr-FR"),
      files: state.generatedFiles
    });

    saveHistory();
    updatePreview(state.generatedFiles);
    if (els.resultText) els.resultText.textContent = formatResult(state.generatedFiles);
    updateUI();
    notify("Site généré avec succès.");
  } catch (error) {
    console.error(error);
    notify("Erreur génération.");
  }
}

async function startCheckout(type) {
  if (!state.user) {
    openModal("loginModal");
    return notify("Connecte-toi avant d'acheter.");
  }

  try {
    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: state.user.id, email: state.user.email, type })
    });

    const data = await res.json();

    if (!data.url) {
      console.error(data);
      return notify(data.error || "Erreur Stripe.");
    }

    window.location.href = data.url;
  } catch (error) {
    console.error(error);
    notify("Erreur paiement.");
  }
}

async function openPortal() {
  if (!state.user) {
    openModal("loginModal");
    return;
  }

  try {
    const res = await fetch("/api/create-portal-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: state.user.id })
    });

    const data = await res.json();

    if (!data.url) return notify(data.error || "Aucun abonnement à gérer.");
    window.location.href = data.url;
  } catch (error) {
    console.error(error);
    notify("Erreur portail Stripe.");
  }
}

async function downloadZip() {
  if (!state.generatedFiles) return notify("Génère d'abord un site.");

  const zip = new JSZip();
  zip.file("index.html", state.generatedFiles.html || "");
  zip.file("style.css", state.generatedFiles.css || "");
  zip.file("script.js", state.generatedFiles.js || "");
  zip.file("README.txt", "Site généré avec Siteo.studio");

  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "siteo-site.zip";
  a.click();
  URL.revokeObjectURL(a.href);
}

function renderHistory() {
  if (!els.historyList) return;

  if (!state.history.length) {
    els.historyList.innerHTML = `<div class="history-item">Aucune création pour le moment.</div>`;
    return;
  }

  els.historyList.innerHTML = state.history
    .slice(0, 12)
    .map(item => `<div class="history-item"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.date)}</p></div>`)
    .join("");
}

function renderCommunity() {
  if (!els.communityGrid) return;

  const items = safeJSON(COMMUNITY_KEY, [
    {
      id: 1,
      title: "Portfolio Roblox",
      description: "Un portfolio sombre et premium pour présenter des créations Roblox.",
      image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800",
      url: "#",
      likes: 12,
      comments: ["Très propre !", "J'aime le style."]
    },
    {
      id: 2,
      title: "Landing SaaS IA",
      description: "Une page de présentation moderne pour un outil IA.",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800",
      url: "#",
      likes: 24,
      comments: ["Design incroyable."]
    }
  ]);

  els.communityGrid.innerHTML = items.map(item => `
    <article class="site-card">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}">
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description)}</p>
      <p class="meta">❤️ ${item.likes || 0} likes • 💬 ${(item.comments || []).length} commentaires</p>
      <div class="site-card-actions">
        <button class="ghost-btn like-btn" data-id="${item.id}">Liker</button>
        <button class="ghost-btn comment-btn" data-id="${item.id}">Commenter</button>
        <a class="primary-btn" href="${escapeHtml(item.url || "#")}" target="_blank">Voir</a>
      </div>
    </article>
  `).join("");

  els.communityGrid.querySelectorAll(".like-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.dataset.id);
      const list = safeJSON(COMMUNITY_KEY, items);
      const item = list.find(x => x.id === id);
      if (item) item.likes = Number(item.likes || 0) + 1;
      localStorage.setItem(COMMUNITY_KEY, JSON.stringify(list));
      renderCommunity();
    });
  });

  els.communityGrid.querySelectorAll(".comment-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const text = prompt("Ton commentaire :");
      if (!text) return;
      const id = Number(btn.dataset.id);
      const list = safeJSON(COMMUNITY_KEY, items);
      const item = list.find(x => x.id === id);
      if (item) {
        item.comments = item.comments || [];
        item.comments.push(text);
      }
      localStorage.setItem(COMMUNITY_KEY, JSON.stringify(list));
      renderCommunity();
    });
  });
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c]));
}

function initLeaves() {
  const enabled = localStorage.getItem(LEAF_KEY) === "true";
  updateLeafButton(enabled);

  if (enabled) startLeaves();

  els.leafToggle?.addEventListener("click", () => {
    const next = !(localStorage.getItem(LEAF_KEY) === "true");
    localStorage.setItem(LEAF_KEY, String(next));
    updateLeafButton(next);
    if (next) startLeaves();
    else stopLeaves();
  });
}

let leafTimer = null;

function updateLeafButton(enabled) {
  if (els.leafToggle) els.leafToggle.textContent = enabled ? "🍃 Feuilles ON" : "🍃 Feuilles OFF";
}

function startLeaves() {
  if (!els.leafLayer || leafTimer) return;
  leafTimer = setInterval(() => {
    const leaf = document.createElement("span");
    leaf.className = "leaf";
    leaf.textContent = ["🍃","🍂","🌿"][Math.floor(Math.random()*3)];
    leaf.style.left = Math.random() * 100 + "vw";
    leaf.style.animationDuration = 5 + Math.random() * 6 + "s";
    leaf.style.fontSize = 16 + Math.random() * 18 + "px";
    els.leafLayer.appendChild(leaf);
    setTimeout(() => leaf.remove(), 12000);
  }, 350);
}

function stopLeaves() {
  clearInterval(leafTimer);
  leafTimer = null;
  if (els.leafLayer) els.leafLayer.innerHTML = "";
}

function initEvents() {
  els.mobileMenuBtn?.addEventListener("click", () => els.navLinks?.classList.toggle("open"));

  els.openSignupBtn?.addEventListener("click", () => openModal("signupModal"));
  els.openLoginBtn?.addEventListener("click", () => openModal("loginModal"));
  els.switchToLoginBtn?.addEventListener("click", () => { closeModal("signupModal"); openModal("loginModal"); });
  els.switchToSignupBtn?.addEventListener("click", () => { closeModal("loginModal"); openModal("signupModal"); });
  els.openResetBtn?.addEventListener("click", () => { closeModal("loginModal"); openModal("resetModal"); });

  document.querySelectorAll("[data-close-modal]").forEach(btn => {
    btn.addEventListener("click", () => closeModal(btn.dataset.closeModal));
  });

  document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", e => {
      if (e.target === modal) modal.classList.add("hidden");
    });
  });

  els.signupBtn?.addEventListener("click", async () => {
    const username = $("signupUsername")?.value.trim();
    const email = $("signupEmail")?.value.trim();
    const password = $("signupPassword")?.value.trim();

    if (!username || !email || !password || password.length < 6) return notify("Informations invalides.");

    const { error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { username }, emailRedirectTo: window.location.origin }
    });

    if (error) return notify(error.message);
    notify("Compte créé. Vérifie ton email.");
    closeModal("signupModal");
    openModal("loginModal");
  });

  els.loginBtn?.addEventListener("click", async () => {
    const email = $("loginEmail")?.value.trim();
    const password = $("loginPassword")?.value.trim();

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) return notify(error.message);

    state.user = data.user;
    await ensureProfile();
    await loadProfile();
    closeModal("loginModal");
    updateUI();
    notify("Connecté.");
  });

  els.resetPasswordBtn?.addEventListener("click", async () => {
    const email = $("resetEmail")?.value.trim();
    if (!email) return notify("Entre ton email.");

    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) return notify(error.message);

    closeModal("resetModal");
    notify("Email envoyé.");
  });

  els.logoutBtn?.addEventListener("click", async () => {
    await supabaseClient.auth.signOut();
    state.user = null;
    state.profile = null;
    state.plan = "free";
    state.credits = 0;
    updateUI();
  });

  document.querySelectorAll("[data-generator-tab]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-generator-tab]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".generator-tab-panel").forEach(p => p.classList.remove("active"));
      $(`${btn.dataset.generatorTab}Panel`)?.classList.add("active");
    });
  });

  $("templateGrid")?.querySelectorAll("[data-template]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelector('[data-generator-tab="create"]')?.click();
      if ($("description")) $("description").value = btn.dataset.template;
      notify("Modèle ajouté au prompt.");
    });
  });

  els.templateForm?.addEventListener("submit", generateSite);
  els.downloadBtn?.addEventListener("click", downloadZip);
  els.copyBtn?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(els.resultText?.textContent || "");
    notify("Code copié.");
  });

  els.buy100Btn?.addEventListener("click", () => startCheckout("credits_100"));
  els.buy1000Btn?.addEventListener("click", () => startCheckout("credits_1000"));
  els.proBtn?.addEventListener("click", () => startCheckout("pro"));
  els.cancelSubBtn?.addEventListener("click", openPortal);

  els.clearHistoryBtn?.addEventListener("click", () => {
    state.history = [];
    saveHistory();
    renderHistory();
  });

  els.shareForm?.addEventListener("submit", e => {
    e.preventDefault();
    const list = safeJSON(COMMUNITY_KEY, []);
    list.unshift({
      id: Date.now(),
      title: $("shareTitle")?.value || "Site sans titre",
      description: $("shareDescription")?.value || "",
      image: $("shareImage")?.value || "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=800",
      url: $("shareUrl")?.value || "#",
      likes: 0,
      comments: []
    });
    localStorage.setItem(COMMUNITY_KEY, JSON.stringify(list));
    els.shareForm.reset();
    renderCommunity();
    notify("Site publié dans la galerie.");
  });
}

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add("visible");
  });
}, { threshold: .12 });

document.querySelectorAll(".reveal").forEach(el => observer.observe(el));

initEvents();
initLeaves();
initAuth();
