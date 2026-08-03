import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || "http://localhost:3000";
const GENERATION_COST = 10;
// Modèles gratuits OpenRouter (aucun crédit requis). Plusieurs de secours car les modèles
// gratuits partagés sont souvent limités en débit (429) selon l'heure — on tente le suivant
// automatiquement plutôt que de faire échouer toute la génération.
const FREE_MODELS = [
  "openai/gpt-oss-20b:free",
  "nvidia/nemotron-3-nano-30b-a3b:free"
];

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

console.log("OPENROUTER :", process.env.OPENROUTER_API_KEY ? "OK" : "MANQUANTE");
console.log("STRIPE :", process.env.STRIPE_SECRET_KEY ? "OK" : "MANQUANTE");
console.log("SUPABASE :", supabaseAdmin ? "OK" : "MANQUANT");

app.use(cors());

// Vérifie le token Supabase envoyé par le client (Authorization: Bearer <access_token>) et
// renvoie l'utilisateur réel — on ne fait plus jamais confiance à un userId fourni par le body.
async function getUserFromRequest(req) {
  if (!supabaseAdmin) return null;
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

async function requireUser(req, res, next) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Non authentifié." });
  req.authUser = user;
  next();
}

app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe || !supabaseAdmin || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).send("Stripe/Supabase webhook non configuré.");
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error("Webhook Stripe invalide :", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  // Idempotence : Stripe peut renvoyer le même événement plusieurs fois (retries).
  const { error: dedupeError } = await supabaseAdmin.from("processed_stripe_events").insert({ event_id: event.id });
  if (dedupeError) {
    console.log(`Événement Stripe ${event.id} déjà traité, ignoré.`);
    return res.json({ received: true });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.user_id;
      const pack = session.metadata?.pack;
      if (!userId || !pack) return res.json({ received: true });

      if (pack === "pro") await setUserPro(userId, session.customer, session.subscription);
      if (pack === "credits_100") await addCredits(userId, 100);
      if (pack === "credits_1000") await addCredits(userId, 1000);
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object;
      const userId = sub.metadata?.user_id;
      if (userId) {
        if (["active", "trialing"].includes(sub.status)) await setUserPro(userId, sub.customer, sub.id);
        if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) await setUserFree(userId);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const userId = sub.metadata?.user_id;
      if (userId) await setUserFree(userId);
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("Erreur webhook Stripe :", error);
    return res.status(500).json({ error: "Erreur traitement webhook." });
  }
});

app.use(express.json({ limit: "14mb" }));
app.use(express.static(path.join(__dirname, "public")));

async function addCredits(userId, amount) {
  const { data: profile, error } = await supabaseAdmin.from("profiles").select("credits").eq("id", userId).single();
  if (error) return console.error("Lecture crédits impossible :", error);
  const next = Number(profile?.credits || 0) + Number(amount);
  const { error: updateError } = await supabaseAdmin.from("profiles").update({ credits: next }).eq("id", userId);
  if (updateError) console.error("Ajout crédits impossible :", updateError);
}

async function setUserPro(userId, stripeCustomerId, stripeSubscriptionId) {
  const update = { plan: "pro" };
  if (stripeCustomerId) update.stripe_customer_id = String(stripeCustomerId);
  if (stripeSubscriptionId) update.stripe_subscription_id = String(stripeSubscriptionId);
  const { error } = await supabaseAdmin.from("profiles").update(update).eq("id", userId);
  if (error) console.error("Activation Pro impossible :", error);
}

async function setUserFree(userId) {
  const { error } = await supabaseAdmin.from("profiles").update({ plan: "free", stripe_subscription_id: null }).eq("id", userId);
  if (error) console.error("Retour Free impossible :", error);
}

async function callOpenRouter(messages, max_tokens = 2500) {
  let lastError;
  for (const model of FREE_MODELS) {
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": PUBLIC_SITE_URL,
          "X-Title": "Siteo"
        },
        body: JSON.stringify({ model, messages, max_tokens })
      });

      const data = await response.json();
      if (!response.ok) {
        lastError = new Error(JSON.stringify(data));
        console.warn(`Modèle ${model} indisponible, essai du suivant :`, data.error?.message || data);
        continue;
      }

      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) return content;
      lastError = new Error("Réponse vide du modèle.");
    } catch (error) {
      lastError = error;
      console.warn(`Erreur réseau sur ${model}, essai du suivant :`, error.message);
    }
  }
  throw lastError || new Error("Tous les modèles gratuits ont échoué.");
}

function cleanCode(text) {
  return String(text || "")
    .replace(/```html/g, "")
    .replace(/```css/g, "")
    .replace(/```js/g, "")
    .replace(/```javascript/g, "")
    .replace(/```/g, "")
    .trim();
}

app.post("/api/generate", requireUser, async (req, res) => {
  try {
    if (!supabaseAdmin) return res.status(500).json({ error: "Supabase non configuré." });

    const userId = req.authUser.id;
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("plan, credits")
      .eq("id", userId)
      .single();

    if (profileError || !profile) return res.status(400).json({ error: "Profil introuvable." });

    const isPro = profile.plan === "pro";
    if (!isPro && Number(profile.credits) < GENERATION_COST) {
      return res.status(402).json({ error: "Crédits insuffisants." });
    }

    const { prompt, mode = "create", existingSite = "" } = req.body;

    if (!process.env.OPENROUTER_API_KEY) {
      return res.json({
        html: "<h1>Clé OpenRouter manquante</h1>",
        css: "body{font-family:Arial;padding:40px}",
        js: "console.log('Ajoute OPENROUTER_API_KEY')"
      });
    }

    const finalPrompt =
      mode === "improve"
        ? `Améliore ce site existant : ${prompt}\n\nSITE EXISTANT:\n${existingSite}`
        : prompt;

    const html = cleanCode(await callOpenRouter([
      { role: "system", content: `Tu génères uniquement le fichier HTML complet d'un site premium. Pas de markdown. Le HTML doit lier style.css et script.js.` },
      { role: "user", content: finalPrompt }
    ], 2800));

    const css = cleanCode(await callOpenRouter([
      { role: "system", content: `Tu génères uniquement le CSS du site. Pas de markdown. CSS premium, responsive, animations, glassmorphism. Maximum 350 lignes.` },
      { role: "user", content: `Voici le HTML :\n${html}\n\nCrée le CSS premium correspondant.` }
    ], 2800));

    const js = cleanCode(await callOpenRouter([
      { role: "system", content: `Tu génères uniquement le JavaScript du site. Pas de markdown. JS simple, propre, interactions utiles. Maximum 120 lignes.` },
      { role: "user", content: `Voici le HTML :\n${html}\n\nVoici le CSS :\n${css}\n\nCrée le JavaScript correspondant.` }
    ], 1600));

    let newCredits = profile.credits;
    if (!isPro) {
      newCredits = Number(profile.credits) - GENERATION_COST;
      const { error: deductError } = await supabaseAdmin.from("profiles").update({ credits: newCredits }).eq("id", userId);
      if (deductError) console.error("Déduction crédits impossible :", deductError);
    }

    return res.json({ html, css, js, credits: newCredits, plan: profile.plan });
  } catch (error) {
    console.error("Erreur génération :", error);
    return res.status(500).json({
      html: "<h1>Erreur serveur</h1>",
      css: "",
      js: String(error)
    });
  }
});

app.post("/api/create-checkout-session", requireUser, async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: "Stripe non configuré." });

    const { type } = req.body;
    const userId = req.authUser.id;
    const email = req.authUser.email;

    const map = {
      pro: { priceId: process.env.PRICE_PRO, mode: "subscription", pack: "pro" },
      credits_100: { priceId: process.env.PRICE_100, mode: "payment", pack: "credits_100" },
      credits_1000: { priceId: process.env.PRICE_1000, mode: "payment", pack: "credits_1000" }
    };

    const selected = map[type];
    if (!selected?.priceId) return res.status(400).json({ error: "Produit Stripe invalide." });

    const config = {
      mode: selected.mode,
      customer_email: email || undefined,
      line_items: [{ price: selected.priceId, quantity: 1 }],
      success_url: `${PUBLIC_SITE_URL}/dashboard?payment=success`,
      cancel_url: `${PUBLIC_SITE_URL}/shop?payment=cancel`,
      metadata: { user_id: userId, pack: selected.pack }
    };

    if (selected.mode === "subscription") {
      config.subscription_data = { metadata: { user_id: userId, pack: selected.pack } };
    }

    const session = await stripe.checkout.sessions.create(config);
    return res.json({ url: session.url });
  } catch (error) {
    console.error("Erreur Checkout Stripe :", error);
    return res.status(500).json({ error: "Erreur Stripe Checkout." });
  }
});

app.post("/api/create-portal-session", requireUser, async (req, res) => {
  try {
    if (!stripe || !supabaseAdmin) return res.status(500).json({ error: "Stripe/Supabase non configuré." });

    const userId = req.authUser.id;
    const { data: profile, error } = await supabaseAdmin.from("profiles").select("stripe_customer_id").eq("id", userId).single();

    if (error || !profile?.stripe_customer_id) {
      return res.status(400).json({ error: "Aucun abonnement Stripe trouvé." });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${PUBLIC_SITE_URL}/dashboard`
    });

    return res.json({ url: portal.url });
  } catch (error) {
    console.error("Erreur portail Stripe :", error);
    return res.status(500).json({ error: "Erreur portail Stripe." });
  }
});

app.get("/google85eef80a332bd1ef.html", (req, res) => {
  res.type("text/html");
  res.send("google-site-verification: google85eef80a332bd1ef.html");
});

const pages = [
  "generate", "dashboard", "shop", "community", "projects", "templates",
  "roadmap", "help", "privacy", "builder"
];

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/:page", (req, res) => {
  const page = req.params.page;
  if (pages.includes(page)) {
    return res.sendFile(path.join(__dirname, "public", `${page}.html`));
  }
  return res.redirect("/");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Siteo lancé sur le port ${PORT}`));
