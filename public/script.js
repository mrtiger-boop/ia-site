from pathlib import Path
import re, zipfile

src = Path("/mnt/data/Texte collé(2).txt")
js = src.read_text(encoding="utf-8")

# Extract Stripe URL if present
stripe_match = re.search(r'https://buy\.stripe\.com/[A-Za-z0-9_/.-]+', js)
stripe_url = stripe_match.group(0) if stripe_match else "TON_LIEN_STRIPE_ICI"

# Extract Supabase URL/key; fix URL
supabase_url_match = re.search(r'const SUPABASE_URL\s*=\s*"([^"]+)"', js)
supabase_key_match = re.search(r'const SUPABASE_KEY\s*=\s*"([^"]+)"', js)
supabase_url = supabase_url_match.group(1) if supabase_url_match else "TON_URL_SUPABASE"
supabase_url = supabase_url.replace("/rest/v1/", "").rstrip("/")
supabase_key = supabase_key_match.group(1) if supabase_key_match else "TA_PUBLISHABLE_KEY"

new_js = f'''const SUPABASE_URL = "{supabase_url}";
const SUPABASE_KEY = "{supabase_key}";
const STRIPE_URL = "{stripe_url}";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

let data = {{
  user: null,
  profile: null,
  plan: "free",
  credits: 0,
  history: []
}};

let currentPrompt = "";
let currentFakeCode = "";
let currentTab = "prompt";

const HISTORY_KEY = "siteo_history_v3";

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

function loadLocalHistory() {{
  try {{
    const saved = localStorage.getItem(HISTORY_KEY);
    return saved ? JSON.parse(saved) : [];
  }} catch {{
    return [];
  }}
}}

function saveLocalHistory() {{
  localStorage.setItem(HISTORY_KEY, JSON.stringify(data.history));
}}

function isLoggedIn() {{
  return Boolean(data.user);
}}

function isEmailConfirmed() {{
  return Boolean(data.user?.email_confirmed_at || data.user?.confirmed_at);
}}

async function initAuth() {{
  data.history = loadLocalHistory();

  const {{ data: sessionData }} = await supabaseClient.auth.getSession();
  data.user = sessionData?.session?.user || null;

  if (data.user) {{
    await ensureProfile();
    await loadProfile();
  }}

  updateUI();

  supabaseClient.auth.onAuthStateChange(async (_event, session) => {{
    data.user = session?.user || null;

    if (data.user) {{
      await ensureProfile();
      await loadProfile();
    }} else {{
      data.profile = null;
      data.plan = "free";
      data.credits = 0;
    }}

    updateUI();
  }});
}}

async function ensureProfile() {{
  if (!data.user) return;

  const {{ data: existing, error: selectError }} = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle();

  if (selectError) {{
    console.error("Erreur lecture profile :", selectError);
    return;
  }}

  if (existing) {{
    data.profile = existing;
    return;
  }}

  const username =
    data.user.user_metadata?.username ||
    data.user.email?.split("@")[0] ||
    "Utilisateur Siteo";

  const {{ data: inserted, error: insertError }} = await supabaseClient
    .from("profiles")
    .insert({{
      id: data.user.id,
      username,
      email: data.user.email,
      plan: "free",
      credits: 100
    }})
    .select()
    .single();

  if (insertError) {{
    console.error("Erreur création profile :", insertError);
    return;
  }}

  data.profile = inserted;
}}

async function loadProfile() {{
  if (!data.user) return;

  const {{ data: profile, error }} = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .single();

  if (error) {{
    console.error("Erreur chargement profile :", error);
    return;
  }}

  data.profile = profile;
  data.plan = profile.plan || "free";
  data.credits = typeof profile.credits === "number" ? profile.credits : 0;
}}

async function updateProfileCredits(newCredits) {{
  if (!data.user || data.plan === "pro") return;

  const safeCredits = Math.max(0, newCredits);

  const {{ error }} = await supabaseClient
    .from("profiles")
    .update({{ credits: safeCredits }})
    .eq("id", data.user.id);

  if (error) {{
    console.error("Erreur update crédits :", error);
    alert("Erreur pendant la mise à jour des crédits.");
    return;
  }}

  data.credits = safeCredits;
}}

function updateUI() {{
  const isPro = data.plan === "pro";
  const username =
    data.profile?.username ||
    data.user?.user_metadata?.username ||
    data.user?.email ||
    "Invité";

  dailyCount.textContent = isPro ? "∞" : `${{data.credits}} crédits`;
  accountStatus.textContent = username;
  planStatus.textContent = isPro ? "Pro" : "Free";

  if (data.user) {{
    loginOpenBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
    form.classList.remove("locked");
  }} else {{
    loginOpenBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
    form.classList.add("locked");
  }}

  if (!data.user) {{
    userNotice.innerHTML =
      "<strong>Mode actuel :</strong> <span>Crée un compte et confirme ton email pour recevoir tes crédits gratuits.</span>";
  }} else if (!isEmailConfirmed()) {{
    userNotice.innerHTML =
      "<strong>Email non confirmé :</strong> <span>Vérifie ta boîte mail et confirme ton compte avant de générer.</span>";
  }} else if (isPro) {{
    userNotice.innerHTML =
      "<strong>Mode actuel :</strong> <span>Plan Pro actif : crédits illimités et téléchargements ZIP illimités.</span>";
  }} else {{
    userNotice.innerHTML =
      `<strong>Mode actuel :</strong> <span>Version gratuite : ${{data.credits}} crédits restants. Chaque génération coûte 10 crédits.</span>`;
  }}

  renderHistory();
}}

function getCheckedValues() {{
  return Array.from(document.querySelectorAll(".chips input[type='checkbox']"))
    .filter(input => input.checked)
    .map(input => input.value);
}}

function canGenerate() {{
  if (!isLoggedIn()) return false;
  if (!isEmailConfirmed()) return false;
  if (data.plan === "pro") return true;
  return data.credits >= 10;
}}

async function removeCredits() {{
  if (data.plan === "pro") return;
  await updateProfileCredits(data.credits - 10);
}}

function generatePrompt() {{
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
${{projectName}}

TYPE DE SITE :
${{siteType}}

PUBLIC VISÉ :
${{target}}

STYLE VISUEL :
${{style}}

COULEURS :
- Couleur principale : ${{mainColor}}
- Couleur secondaire : ${{secondaryColor}}

PAGES À CRÉER :
${{pages.length ? pages.map(page => "- " + page).join("\\n") : "- Accueil"}}

FONCTIONNALITÉS :
${{features.length ? features.map(feature => "- " + feature).join("\\n") : "- Aucune fonctionnalité spéciale"}}

NIVEAU DE DÉTAIL :
${{detailLevel}}/10

DESCRIPTION COMPLÈTE :
${{description}}

CONSIGNES IMPORTANTES :
- Génère un design moderne, propre, responsive et professionnel.
- Donne le code séparé en 3 fichiers : index.html, style.css et script.js.
- Le code doit être clair, modifiable et prêt à utiliser.
- Ajoute un accueil professionnel, des sections bien structurées et des boutons visibles.
- N’utilise pas de framework compliqué.
- Évite les images externes obligatoires qui cassent le site.
- Si tu veux des icônes, utilise des emojis ou du CSS simple.`;
}}

function generateFakeCodePreview(projectName) {{
  return `📁 ${{projectName || "template"}}/
├── index.html
├── style.css
└── script.js

Le ZIP téléchargé contiendra directement ces 3 fichiers.

Important :
- index.html appelle style.css pour le design.
- index.html appelle script.js pour les interactions.
- Garde toujours les 3 fichiers dans le même dossier.`;
}}

function saveGeneration(prompt, fakeCode) {{
  const projectName = document.getElementById("projectName").value || "Template sans nom";
  const siteType = document.getElementById("siteType").value;
  const style = document.getElementById("style").value;

  const item = {{
    id: Date.now(),
    projectName,
    siteType,
    style,
    prompt,
    fakeCode,
    files: window.lastGeneratedFiles || null,
    date: new Date().toLocaleString("fr-FR")
  }};

  data.history.unshift(item);
  saveLocalHistory();
}}

function renderResult() {{
  resultText.textContent = currentTab === "prompt" ? currentPrompt : currentFakeCode;
}}

function renderHistory() {{
  historyList.innerHTML = "";

  if (!data.history.length) {{
    historyList.innerHTML = `<div class="empty-history">Aucune création sauvegardée pour le moment.</div>`;
    return;
  }}

  data.history.forEach(item => {{
    const card = document.createElement("div");
    card.className = "history-card";

    card.innerHTML = `
      <h4>${{escapeHtml(item.projectName)}}</h4>
      <p>${{escapeHtml(item.siteType)}} • ${{escapeHtml(item.style)}} • ${{escapeHtml(item.date)}}</p>
      <div class="history-actions">
        <button data-action="load" data-id="${{item.id}}">Ouvrir</button>
        <button data-action="copy" data-id="${{item.id}}">Copier</button>
        <button data-action="delete" data-id="${{item.id}}">Supprimer</button>
      </div>
    `;

    historyList.appendChild(card);
  }});
}}

function escapeHtml(text) {{
  return String(text).replace(/[&<>"']/g, char => ({{
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }}[char]));
}}

function formatGeneratedResult(files) {{
  return `INDEX.HTML :

${{files.html || ""}}


STYLE.CSS :

${{files.css || ""}}


SCRIPT.JS :

${{files.js || ""}}`;
}}

form.addEventListener("submit", async (event) => {{
  event.preventDefault();

  if (!isLoggedIn()) {{
    alert("Tu dois créer un compte ou te connecter pour tester Siteo.");
    openLogin();
    return;
  }}

  if (!isEmailConfirmed()) {{
    alert("Confirme ton email avant de générer un site.");
    return;
  }}

  if (!canGenerate()) {{
    alert("Tu n’as plus assez de crédits. Passe Pro pour avoir des crédits illimités.");
    return;
  }}

  const prompt = generatePrompt();

  resultText.textContent = "Génération en cours...";

  try {{
    const response = await fetch("/api/generate", {{
      method: "POST",
      headers: {{
        "Content-Type": "application/json"
      }},
      body: JSON.stringify({{ prompt }})
    }});

    const apiData = await response.json();

    window.lastGeneratedFiles = {{
      html: apiData.html || "",
      css: apiData.css || "",
      js: apiData.js || ""
    }};

    currentPrompt = formatGeneratedResult(window.lastGeneratedFiles);
    currentFakeCode = generateFakeCodePreview(document.getElementById("projectName").value || "template");

    await removeCredits();

    saveGeneration(currentPrompt, currentFakeCode);
    updateUI();
    renderResult();

  }} catch (error) {{
    alert("Erreur génération");
    console.error(error);
  }}
}});

document.querySelectorAll(".tab").forEach(tab => {{
  tab.addEventListener("click", () => {{
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    currentTab = tab.dataset.tab;
    renderResult();
  }});
}});

copyBtn.addEventListener("click", async () => {{
  const text = resultText.textContent;

  try {{
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "Copié !";
    setTimeout(() => copyBtn.textContent = "Copier", 1300);
  }} catch {{
    alert("Impossible de copier automatiquement.");
  }}
}});

downloadBtn.addEventListener("click", async () => {{
  if (!window.lastGeneratedFiles) {{
    alert("Génère d'abord un template.");
    return;
  }}

  const zip = new JSZip();

  zip.file("index.html", window.lastGeneratedFiles.html || "");
  zip.file("style.css", window.lastGeneratedFiles.css || "");
  zip.file("script.js", window.lastGeneratedFiles.js || "");

  const content = await zip.generateAsync({{ type: "blob" }});

  const a = document.createElement("a");
  a.href = URL.createObjectURL(content);

  const projectName = document.getElementById("projectName")?.value || "template";

  a.download = `${{projectName
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase()}}.zip`;

  a.click();

  URL.revokeObjectURL(a.href);
}});

resetBtn.addEventListener("click", () => {{
  form.reset();
}});

historyList.addEventListener("click", async (event) => {{
  const button = event.target.closest("button");
  if (!button) return;

  const id = Number(button.dataset.id);
  const action = button.dataset.action;
  const item = data.history.find(entry => entry.id === id);

  if (!item) return;

  if (action === "load") {{
    currentPrompt = item.prompt;
    currentFakeCode = item.fakeCode;
    if (item.files) {{
      window.lastGeneratedFiles = item.files;
    }}
    currentTab = "prompt";
    renderResult();

    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.querySelector(".tab[data-tab='prompt']").classList.add("active");
    window.location.hash = "#generator";
  }}

  if (action === "copy") {{
    try {{
      await navigator.clipboard.writeText(item.prompt);
      button.textContent = "Copié !";
      setTimeout(() => button.textContent = "Copier", 1300);
    }} catch {{
      alert("Impossible de copier.");
    }}
  }}

  if (action === "delete") {{
    data.history = data.history.filter(entry => entry.id !== id);
    saveLocalHistory();
    updateUI();
  }}
}});

clearHistoryBtn.addEventListener("click", () => {{
  if (confirm("Supprimer tout l’historique ?")) {{
    data.history = [];
    saveLocalHistory();
    updateUI();
  }}
}});

function openLogin() {{
  loginModal.classList.remove("hidden");
  usernameInput.focus();
}}

function closeModal(id) {{
  document.getElementById(id)?.classList.add("hidden");
}}

function openModal(id) {{
  document.getElementById(id)?.classList.remove("hidden");
}}

loginOpenBtn.addEventListener("click", openLogin);
demoLoginBtn.addEventListener("click", openLogin);
lockedLoginBtn.addEventListener("click", openLogin);

document.querySelectorAll("[data-open-modal]").forEach(button => {{
  button.addEventListener("click", () => openModal(button.dataset.openModal));
}});

document.querySelectorAll("[data-close-modal]").forEach(button => {{
  button.addEventListener("click", () => closeModal(button.dataset.closeModal));
}});

document.querySelectorAll(".modal").forEach(modal => {{
  modal.addEventListener("click", event => {{
    if (event.target === modal) {{
      modal.classList.add("hidden");
    }}
  }});
}});

loginBtn.addEventListener("click", async () => {{
  const username = usernameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !email || password.length < 6) {{
    alert("Entre un pseudo, un email et un mot de passe de minimum 6 caractères.");
    return;
  }}

  try {{
    const {{ data: loginData, error: loginError }} =
      await supabaseClient.auth.signInWithPassword({{
        email,
        password
      }});

    if (!loginError && loginData?.user) {{
      data.user = loginData.user;
      await ensureProfile();
      await loadProfile();
      closeModal("loginModal");
      updateUI();
      alert("Connexion réussie.");
      return;
    }}

    const {{ data: signUpData, error: signUpError }} =
      await supabaseClient.auth.signUp({{
        email,
        password,
        options: {{
          data: {{
            username
          }}
        }}
      }});

    if (signUpError) {{
      alert(signUpError.message);
      return;
    }}

    alert("Compte créé. Vérifie ton email pour confirmer ton compte, puis reconnecte-toi.");
  }} catch (error) {{
    console.error(error);
    alert("Erreur connexion / inscription.");
  }}
}});

logoutBtn.addEventListener("click", async () => {{
  await supabaseClient.auth.signOut();
  data.user = null;
  data.profile = null;
  data.plan = "free";
  data.credits = 0;
  updateUI();
}});

upgradeBtn.addEventListener("click", () => {{
  window.open(STRIPE_URL, "_blank");
}});

proBtn.addEventListener("click", () => {{
  window.open(STRIPE_URL, "_blank");
}});

freeBtn.addEventListener("click", async () => {{
  if (!isLoggedIn()) {{
    openLogin();
    return;
  }}

  data.plan = "free";
  await supabaseClient
    .from("profiles")
    .update({{ plan: "free" }})
    .eq("id", data.user.id);

  await loadProfile();
  updateUI();

  alert("Plan gratuit activé.");
}});

initAuth();
'''

out_dir = Path("/mnt/data/siteo-script-supabase")
out_dir.mkdir(exist_ok=True)
out_file = out_dir / "script.js"
out_file.write_text(new_js, encoding="utf-8")

zip_path = Path("/mnt/data/siteo-script-supabase.zip")
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
    z.write(out_file, "script.js")

print(zip_path)
