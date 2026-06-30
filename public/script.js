const SUPABASE_URL = "https://azgahpygwlrrmozbjrqo.supabase.co";
const SUPABASE_KEY = "sb_publishable_fVRUhodws3p_7UVjnODJwg_7UpsyJwQ";
const BILLING_PORTAL_URL = "TON_LIEN_PORTAIL_CLIENT_STRIPE_ICI";
const STRIPE_SUB_URL = "https://buy.stripe.com/test_bJe14ogCUgxNbgm5Fg4Ni00";
const STRIPE_CREDITS_100_URL = "https://buy.stripe.com/test_aFadRa4Uc1CTckq0kW4Ni02";
const STRIPE_CREDITS_1000_URL = "https://buy.stripe.com/test_eVq28s86o5T92JQ0kW4Ni01";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let data = { user:null, profile:null, plan:"free", credits:0, history:[] };
let currentPrompt = "";
let currentFakeCode = "";
let currentTab = "prompt";
const HISTORY_KEY = "siteo_history_v5_multi";

const $ = (id) => document.getElementById(id);
const els = {
  form:$("templateForm"), resultText:$("resultText"), copyBtn:$("copyBtn"), downloadBtn:$("downloadBtn"), resetBtn:$("resetBtn"),
  creditCount:$("creditCount"), accountStatus:$("accountStatus"), planStatus:$("planStatus"), dashCredits:$("dashCredits"), dashEmail:$("dashEmail"), dashPlan:$("dashPlan"), dashUsername:$("dashUsername"), dashVerified:$("dashVerified"), dashCreated:$("dashCreated"),
  userNotice:$("userNotice"), historyList:$("historyList"), clearHistoryBtn:$("clearHistoryBtn"),
  openLoginBtn:$("openLoginBtn"), openSignupBtn:$("openSignupBtn"), heroSignupBtn:$("heroSignupBtn"), lockedSignupBtn:$("lockedSignupBtn"), lockedLoginBtn:$("lockedLoginBtn"),
  signupBtn:$("signupBtn"), loginBtn:$("loginBtn"), openResetBtn:$("openResetBtn"), resetPasswordBtn:$("resetPasswordBtn"), switchToLoginBtn:$("switchToLoginBtn"), switchToSignupBtn:$("switchToSignupBtn"),
  logoutBtn:$("logoutBtn"), upgradeBtn:$("upgradeBtn"), proBtn:$("proBtn"), freeBtn:$("freeBtn"), cancelSubBtn:$("cancelSubBtn"), buy100Btn:$("buy100Btn"), buy1000Btn:$("buy1000Btn"), mobileMenuBtn:$("mobileMenuBtn"), navLinks:$("navLinks"), toast:$("toast")
};

function notify(message) {
  if (!els.toast) return alert(message);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 3500);
}
function openModal(id) { $(id)?.classList.remove("hidden"); }
function closeModal(id) { $(id)?.classList.add("hidden"); }
function loadLocalHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; } }
function saveLocalHistory() { localStorage.setItem(HISTORY_KEY, JSON.stringify(data.history)); }
function isLoggedIn() { return Boolean(data.user); }
function isEmailConfirmed() { return Boolean(data.user?.email_confirmed_at || data.user?.confirmed_at); }

async function initAuth() {
  data.history = loadLocalHistory();
  const { data: sessionData } = await supabaseClient.auth.getSession();
  data.user = sessionData?.session?.user || null;
  if (data.user) { await ensureProfile(); await loadProfile(); }
  updateUI();
  supabaseClient.auth.onAuthStateChange(async (_event, session) => {
    data.user = session?.user || null;
    if (data.user) { await ensureProfile(); await loadProfile(); }
    else { data.profile = null; data.plan = "free"; data.credits = 0; }
    updateUI();
  });
}

async function ensureProfile() {
  if (!data.user) return;
  const { data: existing, error: selectError } = await supabaseClient.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  if (selectError) { console.error("Erreur lecture profile :", selectError); return; }
  if (existing) { data.profile = existing; return; }
  const username = data.user.user_metadata?.username || data.user.email?.split("@")[0] || "Utilisateur Siteo";
  const { data: inserted, error: insertError } = await supabaseClient.from("profiles").insert({
    id:data.user.id, username, email:data.user.email, plan:"free", credits:100
  }).select().single();
  if (insertError) { console.error("Erreur création profile :", insertError); return; }
  data.profile = inserted;
}

async function loadProfile() {
  if (!data.user) return;

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (error) {
    console.error("Erreur chargement profile :", error);
    return;
  }

  console.log("PROFILE :", profile);

  data.profile = profile;
  data.plan = profile.plan || "free";
  data.credits = Number(profile.credits || 100);

  console.log("CREDITS :", data.credits);
}

async function updateProfileCredits(newCredits) {
  if (!data.user || data.plan === "pro") return;

  const safeCredits = Math.max(0, Number(newCredits));

  const { data: updatedProfile, error } = await supabaseClient
    .from("profiles")
    .update({ credits: safeCredits })
    .eq("id", data.user.id)
    .select()
    .single();

  if (error) {
    console.error("Erreur update crédits :", error);
    notify("Erreur pendant la mise à jour des crédits.");
    return;
  }

  console.log("PROFILE MIS À JOUR :", updatedProfile);

  data.profile = updatedProfile;
  data.credits = Number(updatedProfile.credits ?? safeCredits);
}

function dateFr(value) {
  if (!value) return "-";
  try { return new Date(value).toLocaleDateString("fr-FR"); } catch { return "-"; }
}

function updateUI() {
  const isPro = data.plan === "pro";
  const username = data.profile?.username || data.user?.user_metadata?.username || data.user?.email || "Invité";
  data.credits = Number(data.credits || 100);
  const creditsText = isPro ? "∞" : `${data.credits} crédits`;
  if (els.creditCount) els.creditCount.textContent = creditsText;
  if (els.accountStatus) els.accountStatus.textContent = username;
  if (els.planStatus) els.planStatus.textContent = isPro ? "Pro" : "Free";
  if (els.dashCredits) els.dashCredits.textContent = creditsText;
  if (els.dashEmail) els.dashEmail.textContent = data.user?.email || "Invité";
  if (els.dashPlan) els.dashPlan.textContent = isPro ? "Pro" : "Free";
  if (els.dashUsername) els.dashUsername.textContent = username;
  if (els.dashVerified) els.dashVerified.textContent = isEmailConfirmed() ? "Email confirmé" : "Email non confirmé";
  if (els.dashCreated) els.dashCreated.textContent = dateFr(data.profile?.created_at || data.user?.created_at);

  if (els.openLoginBtn && els.openSignupBtn && els.logoutBtn) {
    if (data.user) { els.openLoginBtn.classList.add("hidden"); els.openSignupBtn.classList.add("hidden"); els.logoutBtn.classList.remove("hidden"); }
    else { els.openLoginBtn.classList.remove("hidden"); els.openSignupBtn.classList.remove("hidden"); els.logoutBtn.classList.add("hidden"); }
  }
  if (els.form) { if (data.user) els.form.classList.remove("locked"); else els.form.classList.add("locked"); }

  if (els.userNotice) {
    if (!data.user) els.userNotice.innerHTML = "<strong>Compte requis :</strong> <span>Crée un compte et confirme ton email pour recevoir tes 100 crédits gratuits.</span>";
    else if (!isEmailConfirmed()) els.userNotice.innerHTML = "<strong>Email non confirmé :</strong> <span>Vérifie ta boîte mail et confirme ton compte avant de générer.</span>";
    else if (isPro) els.userNotice.innerHTML = "<strong>Plan Pro :</strong> <span>Crédits illimités. L'annulation se fait via Stripe et l'accès reste actif jusqu'à la fin de période.</span>";
    else els.userNotice.innerHTML = `<strong>Plan gratuit :</strong> <span>${data.credits} crédits restants. Tu peux acheter des crédits dans la boutique.</span>`;
  }
  renderHistory();
}

function getCheckedValues() { return Array.from(document.querySelectorAll(".chips input[type='checkbox']")).filter(i => i.checked).map(i => i.value); }
function canGenerate() { if (!isLoggedIn()) return false; if (!isEmailConfirmed()) return false; if (data.plan === "pro") return true; return data.credits >= 10; }
async function removeCredits() { if (data.plan === "pro") return; await updateProfileCredits(data.credits - 10); }

function generatePrompt() {
  const projectName = $("projectName")?.value || "Template sans nom";
  const siteType = $("siteType")?.value || "Site web";
  const style = $("style")?.value || "Premium";
  const target = $("target")?.value || "public général";
  const mainColor = $("mainColor")?.value || "bleu profond";
  const secondaryColor = $("secondaryColor")?.value || "vert émeraude";
  const detailLevel = $("detailLevel")?.value || "8";
  const description = $("description")?.value || "Aucune description supplémentaire.";
  const allChecked = getCheckedValues();
  const pagesList = ["Accueil","À propos","Services","Boutique","Blog","FAQ","Contact","Dashboard"];
  const featuresList = ["Connexion","Paiement","Abonnement","Formulaire","Téléchargement ZIP","Espace utilisateur","Animations","Mode sombre"];
  const pages = allChecked.filter(v => pagesList.includes(v));
  const features = allChecked.filter(v => featuresList.includes(v));
  return `Crée un site web complet.

NOM DU PROJET :
${projectName}

TYPE DE SITE :
${siteType}

PUBLIC VISÉ :
${target}

STYLE VISUEL :
${style}

COULEURS :
- Couleur principale : ${mainColor}
- Couleur secondaire : ${secondaryColor}

PAGES À CRÉER :
${pages.length ? pages.map(p => "- " + p).join("\n") : "- Accueil"}

FONCTIONNALITÉS :
${features.length ? features.map(f => "- " + f).join("\n") : "- Aucune fonctionnalité spéciale"}

NIVEAU DE DÉTAIL :
${detailLevel}/10

DESCRIPTION COMPLÈTE :
${description}

CONSIGNES IMPORTANTES :
- Génère un design moderne, original, responsive et professionnel.
- Donne le code séparé en 3 fichiers : index.html, style.css et script.js.
- Le HTML doit être complet avec doctype, head et body.
- Le HTML doit relier style.css et script.js.
- Le code doit être clair, modifiable et prêt à utiliser.
- Ajoute des sections bien structurées, des cartes, boutons visibles et animations légères.
- N'utilise pas de framework compliqué.
- Évite les images externes obligatoires qui cassent le site.
- Si tu veux des icônes, utilise des emojis ou du CSS simple.`;
}

function generateFakeCodePreview(projectName) {
  return `📁 ${projectName || "template"}/
├── index.html
├── style.css
└── script.js

Le ZIP téléchargé contiendra directement ces 3 fichiers.

Important :
- index.html appelle style.css pour le design.
- index.html appelle script.js pour les interactions.
- Garde toujours les 3 fichiers dans le même dossier.`;
}

function saveGeneration(prompt, fakeCode) {
  const projectName = $("projectName")?.value || "Template sans nom";
  const siteType = $("siteType")?.value || "Site web";
  const style = $("style")?.value || "Premium";
  data.history.unshift({ id:Date.now(), projectName, siteType, style, prompt, fakeCode, files:window.lastGeneratedFiles || null, date:new Date().toLocaleString("fr-FR") });
  saveLocalHistory();
}

function renderResult() { if (els.resultText) els.resultText.textContent = currentTab === "prompt" ? currentPrompt : currentFakeCode; }

function renderHistory() {
  if (!els.historyList) return;
  els.historyList.innerHTML = "";
  if (!data.history.length) {
    els.historyList.innerHTML = `<div class="empty-history">Aucune création sauvegardée pour le moment.</div>`;
    return;
  }
  data.history.forEach(item => {
    const card = document.createElement("div");
    card.className = "history-card";
    card.innerHTML = `<h4>${escapeHtml(item.projectName)}</h4><p>${escapeHtml(item.siteType)} • ${escapeHtml(item.style)} • ${escapeHtml(item.date)}</p><div class="history-actions"><button data-action="load" data-id="${item.id}">Ouvrir</button><button data-action="copy" data-id="${item.id}">Copier</button><button data-action="delete" data-id="${item.id}">Supprimer</button></div>`;
    els.historyList.appendChild(card);
  });
}

function escapeHtml(text) { return String(text).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c])); }
function formatGeneratedResult(files) { return `INDEX.HTML :

${files.html || ""}


STYLE.CSS :

${files.css || ""}


SCRIPT.JS :

${files.js || ""}`; }

els.form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isLoggedIn()) { notify("Tu dois créer un compte ou te connecter."); openModal("signupModal"); return; }
  if (!isEmailConfirmed()) { notify("Confirme ton email avant de générer un site."); return; }
  if (!canGenerate()) { notify("Tu n'as plus assez de crédits."); return; }
  const prompt = generatePrompt();
  if (els.resultText) els.resultText.textContent = "Génération en cours...";
  try {
    const response = await fetch("/api/generate", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ prompt }) });
    const apiData = await response.json();
    window.lastGeneratedFiles = { html:apiData.html || "", css:apiData.css || "", js:apiData.js || "" };
    currentPrompt = formatGeneratedResult(window.lastGeneratedFiles);
    currentFakeCode = generateFakeCodePreview($("projectName")?.value || "template");
    await removeCredits();
    saveGeneration(currentPrompt, currentFakeCode);
    updateUI(); renderResult(); notify("Site généré avec succès.");
  } catch (error) { console.error(error); notify("Erreur génération."); }
});

document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => { document.querySelectorAll(".tab").forEach(t => t.classList.remove("active")); tab.classList.add("active"); currentTab = tab.dataset.tab; renderResult(); }));

els.copyBtn?.addEventListener("click", async () => { try { await navigator.clipboard.writeText(els.resultText?.textContent || ""); notify("Copié."); } catch { notify("Impossible de copier."); } });

els.downloadBtn?.addEventListener("click", async () => {
  if (!window.lastGeneratedFiles) { notify("Génère d'abord un site."); return; }
  const zip = new JSZip();
  zip.file("index.html", window.lastGeneratedFiles.html || "");
  zip.file("style.css", window.lastGeneratedFiles.css || "");
  zip.file("script.js", window.lastGeneratedFiles.js || "");
  const content = await zip.generateAsync({ type:"blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(content);
  const projectName = $("projectName")?.value || "template";
  a.download = `${projectName.replace(/[^a-z0-9]/gi,"-").toLowerCase()}.zip`;
  a.click(); URL.revokeObjectURL(a.href);
});

els.resetBtn?.addEventListener("click", () => els.form?.reset());

els.historyList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button"); if (!button) return;
  const id = Number(button.dataset.id); const action = button.dataset.action; const item = data.history.find(e => e.id === id); if (!item) return;
  if (action === "load") { currentPrompt = item.prompt; currentFakeCode = item.fakeCode; if (item.files) window.lastGeneratedFiles = item.files; currentTab = "prompt"; renderResult(); location.href = "generate.html#generator"; }
  if (action === "copy") { await navigator.clipboard.writeText(item.prompt); notify("Copié."); }
  if (action === "delete") { data.history = data.history.filter(e => e.id !== id); saveLocalHistory(); updateUI(); }
});

els.clearHistoryBtn?.addEventListener("click", () => { if (confirm("Supprimer tout l'historique ?")) { data.history = []; saveLocalHistory(); updateUI(); } });

els.openSignupBtn?.addEventListener("click", () => openModal("signupModal"));
els.heroSignupBtn?.addEventListener("click", () => openModal("signupModal"));
els.lockedSignupBtn?.addEventListener("click", () => openModal("signupModal"));
els.openLoginBtn?.addEventListener("click", () => openModal("loginModal"));
els.lockedLoginBtn?.addEventListener("click", () => openModal("loginModal"));
els.switchToLoginBtn?.addEventListener("click", () => { closeModal("signupModal"); openModal("loginModal"); });
els.switchToSignupBtn?.addEventListener("click", () => { closeModal("loginModal"); openModal("signupModal"); });
els.openResetBtn?.addEventListener("click", () => { closeModal("loginModal"); openModal("resetModal"); });
els.mobileMenuBtn?.addEventListener("click", () => els.navLinks?.classList.toggle("open"));

document.querySelectorAll("[data-close-modal]").forEach(btn => btn.addEventListener("click", () => closeModal(btn.dataset.closeModal)));
document.querySelectorAll(".modal").forEach(modal => modal.addEventListener("click", e => { if (e.target === modal) modal.classList.add("hidden"); }));

els.signupBtn?.addEventListener("click", async () => {
  const username = $("signupUsername")?.value.trim();
  const email = $("signupEmail")?.value.trim();
  const password = $("signupPassword")?.value.trim();
  if (!username || !email || !password || password.length < 6) { notify("Entre un pseudo, un email et un mot de passe de minimum 6 caractères."); return; }
  try {
    const { error } = await supabaseClient.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: window.location.origin } });
    if (error) { notify(error.message); return; }
    notify("Compte créé. Vérifie ton email, puis connecte-toi.");
    closeModal("signupModal"); openModal("loginModal");
  } catch (error) { console.error(error); notify("Erreur pendant l'inscription."); }
});

els.loginBtn?.addEventListener("click", async () => {
  const email = $("loginEmail")?.value.trim();
  const password = $("loginPassword")?.value.trim();
  if (!email || !password) { notify("Entre ton email et ton mot de passe."); return; }
  try {
    const { data: loginData, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) { notify(error.message); return; }
    data.user = loginData.user;
    await ensureProfile(); await loadProfile();
    closeModal("loginModal"); updateUI();
    notify(isEmailConfirmed() ? "Connexion réussie." : "Connexion réussie, mais ton email n'est pas encore confirmé.");
  } catch (error) { console.error(error); notify("Erreur pendant la connexion."); }
});

els.resetPasswordBtn?.addEventListener("click", async () => {
  const email = $("resetEmail")?.value.trim();
  if (!email) { notify("Entre ton email."); return; }
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) { notify(error.message); return; }
  notify("Email de réinitialisation envoyé."); closeModal("resetModal");
});

els.logoutBtn?.addEventListener("click", async () => { await supabaseClient.auth.signOut(); data.user = null; data.profile = null; data.plan = "free"; data.credits = 0; updateUI(); notify("Déconnecté."); });

function openStripe(url, label) {
  if (!url || url.includes("TON_LIEN")) { notify(`Ajoute ton lien Stripe pour : ${label} dans script.js`); return; }
  window.open(url, "_blank");
}
els.upgradeBtn?.addEventListener("click", () => openStripe(STRIPE_SUB_URL, "abonnement Pro"));
els.proBtn?.addEventListener("click", () => openStripe(STRIPE_SUB_URL, "abonnement Pro"));
els.buy100Btn?.addEventListener("click", () => openStripe(STRIPE_CREDITS_100_URL, "100 crédits"));
els.buy1000Btn?.addEventListener("click", () => openStripe(STRIPE_CREDITS_1000_URL, "1000 crédits"));
els.cancelSubBtn?.addEventListener("click", () => openStripe(BILLING_PORTAL_URL, "portail client Stripe"));

els.freeBtn?.addEventListener("click", async () => {
  if (!isLoggedIn()) { openModal("loginModal"); return; }
  const { error } = await supabaseClient.from("profiles").update({ plan:"free" }).eq("id", data.user.id);
  if (error) { notify("Impossible de modifier le plan."); return; }
  await loadProfile(); updateUI(); notify("Plan gratuit activé.");
});

const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add("visible"); }), { threshold:.12 });
document.querySelectorAll(".reveal").forEach(el => observer.observe(el));

document.querySelectorAll(".magnetic").forEach(el => {
  el.addEventListener("mousemove", e => { const r = el.getBoundingClientRect(); el.style.transform = `translate(${(e.clientX-r.left-r.width/2)/10}px, ${(e.clientY-r.top-r.height/2)/10}px)`; });
  el.addEventListener("mouseleave", () => el.style.transform = "");
});

initAuth();
