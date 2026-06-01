const STORAGE_KEY = "siteo_ai_data_v2";

const defaultData = {
  user: null,
  plan: "free",
  credits: 100,
  history: []
};

let data = loadData();
let currentPrompt = "";
let currentFakeCode = "";
let currentTab = "prompt";

const form = document.getElementById("templateForm");
const resultText = document.getElementById("resultText");
const copyBtn = document.getElementById("copyBtn");
const downloadBtn = document.getElementById("downloadBtn");
const resetBtn = document.getElementById("resetBtn");

const dailyCount = document.getElementById("dailyCount");
const accountStatus = document.getElementById("accountStatus");
const planStatus = document.getElementById("planStatus");
const userNotice = document.getElementById("userNotice");

const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");

const loginModal = document.getElementById("loginModal");
const loginOpenBtn = document.getElementById("loginOpenBtn");
const demoLoginBtn = document.getElementById("demoLoginBtn");
const lockedLoginBtn = document.getElementById("lockedLoginBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const usernameInput = document.getElementById("usernameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");

const upgradeBtn = document.getElementById("upgradeBtn");
const proBtn = document.getElementById("proBtn");
const freeBtn = document.getElementById("freeBtn");

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return structuredClone(defaultData);
  }

  try {
    const parsed = JSON.parse(saved);
    return { ...structuredClone(defaultData), ...parsed };
  } catch {
    return structuredClone(defaultData);
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function ensureCreditsField() {
  if (typeof data.credits !== "number") {
    data.credits = 100;
    saveData();
  }
}

function isLoggedIn() {
  return Boolean(data.user);
}

function updateUI() {
  ensureCreditsField();

  const isPro = data.plan === "pro";
  const username = data.user ? data.user.username : "Invité";

  dailyCount.textContent = isPro ? "∞" : `${data.credits} crédits`;
  accountStatus.textContent = username;
  planStatus.textContent = isPro ? "Pro" : "Free";

  if (data.user) {
    loginOpenBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    form.classList.remove("locked");
  } else {
    loginOpenBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    form.classList.add("locked");
  }

  userNotice.innerHTML = isPro
    ? "<strong>Mode actuel :</strong> <span>Plan Pro actif : crédits illimités et téléchargements ZIP illimités.</span>"
    : `<strong>Mode actuel :</strong> <span>Version gratuite : ${data.credits} crédits restants. Chaque génération coûte 10 crédits.</span>`;

  renderHistory();
}

function getCheckedValues() {
  return Array.from(document.querySelectorAll(".chips input[type='checkbox']"))
    .filter(input => input.checked)
    .map(input => input.value);
}

function canGenerate() {
  ensureCreditsField();

  if (!isLoggedIn()) {
    return false;
  }

  if (data.plan === "pro") {
    return true;
  }

  return data.credits >= 10;
}

function removeCredits() {
  ensureCreditsField();

  if (data.plan === "pro") {
    return;
  }

  data.credits = Math.max(0, data.credits - 10);
}

function generatePrompt() {
  const projectName = document.getElementById("projectName").value || "Template sans nom";
  const siteType = document.getElementById("siteType").value;
  const style = document.getElementById("style").value;
  const target = document.getElementById("target").value || "public général";
  const mainColor = document.getElementById("mainColor").value || "vert naturel";
  const secondaryColor = document.getElementById("secondaryColor").value || "beige clair";
  const detailLevel = document.getElementById("detailLevel").value;
  const description = document.getElementById("description").value || "Aucune description supplémentaire.";

  const allChecked = getCheckedValues();
  const pagesList = ["Accueil", "À propos", "Services", "Boutique", "Blog", "FAQ", "Contact", "Dashboard"];
  const featuresList = ["Connexion", "Paiement", "Abonnement", "Formulaire", "Téléchargement ZIP", "Espace utilisateur", "Animations", "Mode sombre"];

  const pages = allChecked.filter(value => pagesList.includes(value));
  const features = allChecked.filter(value => featuresList.includes(value));

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
${pages.length ? pages.map(page => "- " + page).join("\n") : "- Accueil"}

FONCTIONNALITÉS :
${features.length ? features.map(feature => "- " + feature).join("\n") : "- Aucune fonctionnalité spéciale"}

NIVEAU DE DÉTAIL :
${detailLevel}/10

DESCRIPTION COMPLÈTE :
${description}

CONSIGNES IMPORTANTES :
- Génère un design moderne, propre, responsive et professionnel.
- Donne le code séparé en 3 fichiers : index.html, style.css et script.js.
- Le code doit être clair, modifiable et prêt à utiliser.
- Ajoute un accueil professionnel, des sections bien structurées et des boutons visibles.
- N’utilise pas de framework compliqué.
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
  const projectName = document.getElementById("projectName").value || "Template sans nom";
  const siteType = document.getElementById("siteType").value;
  const style = document.getElementById("style").value;

  const item = {
    id: Date.now(),
    projectName,
    siteType,
    style,
    prompt,
    fakeCode,
    files: window.lastGeneratedFiles || null,
    date: new Date().toLocaleString("fr-FR")
  };

  data.history.unshift(item);
  saveData();
}

function renderResult() {
  resultText.textContent = currentTab === "prompt" ? currentPrompt : currentFakeCode;
}

function renderHistory() {
  historyList.innerHTML = "";

  if (!data.history.length) {
    historyList.innerHTML = `<div class="empty-history">Aucune création sauvegardée pour le moment.</div>`;
    return;
  }

  data.history.forEach(item => {
    const card = document.createElement("div");
    card.className = "history-card";

    card.innerHTML = `
      <h4>${escapeHtml(item.projectName)}</h4>
      <p>${escapeHtml(item.siteType)} • ${escapeHtml(item.style)} • ${escapeHtml(item.date)}</p>
      <div class="history-actions">
        <button data-action="load" data-id="${item.id}">Ouvrir</button>
        <button data-action="copy" data-id="${item.id}">Copier</button>
        <button data-action="delete" data-id="${item.id}">Supprimer</button>
      </div>
    `;

    historyList.appendChild(card);
  });
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function formatGeneratedResult(files) {
  return `INDEX.HTML :

${files.html || ""}


STYLE.CSS :

${files.css || ""}


SCRIPT.JS :

${files.js || ""}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!isLoggedIn()) {
    alert("Tu dois créer un compte ou te connecter pour tester Siteo.");
    openLogin();
    return;
  }

  if (!canGenerate()) {
    alert("Tu n’as plus assez de crédits. Passe Pro pour avoir des crédits illimités.");
    return;
  }

  const prompt = generatePrompt();

  resultText.textContent = "Génération en cours...";

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    });

    const apiData = await response.json();

    window.lastGeneratedFiles = {
      html: apiData.html || "",
      css: apiData.css || "",
      js: apiData.js || ""
    };

    currentPrompt = formatGeneratedResult(window.lastGeneratedFiles);
    currentFakeCode = generateFakeCodePreview(document.getElementById("projectName").value || "template");

    removeCredits();

    saveGeneration(currentPrompt, currentFakeCode);
    saveData();
    updateUI();
    renderResult();

  } catch (error) {
    alert("Erreur génération");
    console.error(error);
  }
});

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentTab = tab.dataset.tab;
    renderResult();
  });
});

copyBtn.addEventListener("click", async () => {
  const text = resultText.textContent;

  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "Copié !";
    setTimeout(() => copyBtn.textContent = "Copier", 1300);
  } catch {
    alert("Impossible de copier automatiquement.");
  }
});

downloadBtn.addEventListener("click", async () => {
  if (!window.lastGeneratedFiles) {
    alert("Génère d'abord un template.");
    return;
  }

  const zip = new JSZip();

  zip.file("index.html", window.lastGeneratedFiles.html || "");
  zip.file("style.css", window.lastGeneratedFiles.css || "");
  zip.file("script.js", window.lastGeneratedFiles.js || "");

  const content = await zip.generateAsync({ type: "blob" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(content);

  const projectName = document.getElementById("projectName")?.value || "template";

  a.download = `${projectName
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase()}.zip`;

  a.click();

  URL.revokeObjectURL(a.href);
});

resetBtn.addEventListener("click", () => {
  form.reset();
});

historyList.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  const item = data.history.find(entry => entry.id === id);

  if (!item) return;

  if (action === "load") {
    currentPrompt = item.prompt;
    currentFakeCode = item.fakeCode;
    if (item.files) {
      window.lastGeneratedFiles = item.files;
    }
    currentTab = "prompt";
    renderResult();

    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.querySelector(".tab[data-tab='prompt']").classList.add("active");
    window.location.hash = "#generator";
  }

  if (action === "copy") {
    try {
      await navigator.clipboard.writeText(item.prompt);
      button.textContent = "Copié !";
      setTimeout(() => button.textContent = "Copier", 1300);
    } catch {
      alert("Impossible de copier.");
    }
  }

  if (action === "delete") {
    data.history = data.history.filter(entry => entry.id !== id);
    saveData();
    updateUI();
  }
});

clearHistoryBtn.addEventListener("click", () => {
  if (confirm("Supprimer tout l’historique ?")) {
    data.history = [];
    saveData();
    updateUI();
  }
});

function openLogin() {
  loginModal.classList.remove("hidden");
  usernameInput.focus();
}

function closeModal(id) {
  document.getElementById(id)?.classList.add("hidden");
}

function openModal(id) {
  document.getElementById(id)?.classList.remove("hidden");
}

loginOpenBtn.addEventListener("click", openLogin);
demoLoginBtn.addEventListener("click", openLogin);
lockedLoginBtn.addEventListener("click", openLogin);

document.querySelectorAll("[data-open-modal]").forEach(button => {
  button.addEventListener("click", () => openModal(button.dataset.openModal));
});

document.querySelectorAll("[data-close-modal]").forEach(button => {
  button.addEventListener("click", () => closeModal(button.dataset.closeModal));
});

document.querySelectorAll(".modal").forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) {
      modal.classList.add("hidden");
    }
  });
});

loginBtn.addEventListener("click", () => {
  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !email || password.length < 4) {
    alert("Entre un pseudo, un email et un mot de passe de minimum 4 caractères.");
    return;
  }

  const isNewUser = !data.user;

  data.user = {
    username,
    email
  };

  if (isNewUser && typeof data.credits !== "number") {
    data.credits = 100;
  }

  saveData();
  closeModal("loginModal");
  updateUI();
});

logoutBtn.addEventListener("click", () => {
  data.user = null;
  data.plan = "free";
  saveData();
  updateUI();
});

function activatePro() {
  if (!isLoggedIn()) {
    alert("Connecte-toi avant d’activer le plan Pro.");
    openLogin();
    return;
  }

  data.plan = "pro";
  saveData();
  updateUI();

  alert("Plan Pro activé. Crédits illimités.");
}

upgradeBtn.addEventListener("click", activatePro);
proBtn.addEventListener("click", activatePro);

freeBtn.addEventListener("click", () => {
  data.plan = "free";

  if (typeof data.credits !== "number" || data.credits < 1) {
    data.credits = 100;
  }

  saveData();
  updateUI();

  alert("Plan gratuit activé. Tu as 100 crédits.");
});

updateUI();
