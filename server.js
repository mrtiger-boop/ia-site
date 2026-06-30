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

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || "http://localhost:3000";

console.log("OPENROUTER :", process.env.OPENROUTER_API_KEY ? "OK" : "MANQUANTE");
console.log("STRIPE :", process.env.STRIPE_SECRET_KEY ? "OK" : "MANQUANTE");
console.log("SUPABASE :", supabaseAdmin ? "OK" : "MANQUANT");
console.log("PUBLIC_SITE_URL :", PUBLIC_SITE_URL);

app.use(cors());

app.post(
  "/api/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    if (!stripe || !supabaseAdmin || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(500).send("Stripe/Supabase webhook non configuré.");
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      console.error("Webhook Stripe invalide :", error.message);
      return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const pack = session.metadata?.pack;

        if (!userId || !pack) return res.json({ received: true });

        if (pack === "pro") {
          await setUserPro(userId, session.customer, session.subscription);
        }

        if (pack === "credits_100") {
          await addCredits(userId, 100);
        }

        if (pack === "credits_1000") {
          await addCredits(userId, 1000);
        }
      }

      if (event.type === "customer.subscription.updated") {
        const sub = event.data.object;
        const userId = sub.metadata?.user_id;

        if (userId) {
          if (["active", "trialing"].includes(sub.status)) {
            await setUserPro(userId, sub.customer, sub.id);
          }

          if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
            await setUserFree(userId);
          }
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
  }
);

app.use(express.json({ limit: "8mb" }));
app.use(express.static(path.join(__dirname, "public")));

async function addCredits(userId, amount) {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Lecture crédits impossible :", error);
    return;
  }

  const current = Number(profile?.credits || 0);
  const next = current + Number(amount);

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ credits: next })
    .eq("id", userId);

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
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ plan: "free", stripe_subscription_id: null })
    .eq("id", userId);

  if (error) console.error("Retour Free impossible :", error);
}

function safeJsonParse(content) {
  if (!content) return null;

  const cleaned = content.replace(/```json/g, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      try {
        return JSON.parse(cleaned.slice(first, last + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: "Stripe non configuré." });

    const { userId, email, type } = req.body;

    if (!userId || !type) {
      return res.status(400).json({ error: "Utilisateur ou type manquant." });
    }

    const map = {
      pro: { priceId: process.env.PRICE_PRO, mode: "subscription", pack: "pro", cancel: "/shop?payment=cancel" },
      credits_100: { priceId: process.env.PRICE_100, mode: "payment", pack: "credits_100", cancel: "/shop?payment=cancel" },
      credits_1000: { priceId: process.env.PRICE_1000, mode: "payment", pack: "credits_1000", cancel: "/shop?payment=cancel" }
    };

    const selected = map[type];

    if (!selected?.priceId) {
      return res.status(400).json({ error: "Produit Stripe invalide ou PRICE manquant." });
    }

    const config = {
      mode: selected.mode,
      customer_email: email || undefined,
      line_items: [{ price: selected.priceId, quantity: 1 }],
      success_url: `${PUBLIC_SITE_URL}/dashboard?payment=success`,
      cancel_url: `${PUBLIC_SITE_URL}${selected.cancel}`,
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

app.post("/api/create-portal-session", async (req, res) => {
  try {
    if (!stripe || !supabaseAdmin) {
      return res.status(500).json({ error: "Stripe/Supabase non configuré." });
    }

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: "Utilisateur manquant." });

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

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

async function callOpenRouter(messages) {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": PUBLIC_SITE_URL,
      "X-Title": "Siteo"
    },
    body: JSON.stringify({
      model: "openrouter/auto",
      messages
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(JSON.stringify(data));
  }

  return data.choices?.[0]?.message?.content || "";
}

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt, mode = "create", existingSite = "" } = req.body;

    if (!process.env.OPENROUTER_API_KEY) {
      return res.json({
        html: "<h1>Clé API OpenRouter manquante</h1>",
        css: "body{font-family:Arial;padding:40px}",
        js: "console.log('Ajoute OPENROUTER_API_KEY dans Render ou .env')"
      });
    }

    const system = `
Tu es Siteo, un générateur de sites web premium.
Tu réponds uniquement en JSON valide, sans markdown.
Format obligatoire :
{
  "html": "...",
  "css": "...",
  "js": "..."
}

Règles :
- Crée un site web moderne, complet, responsive, premium.
- Le HTML doit être complet avec doctype, head, body.
- Le HTML doit relier style.css et script.js.
- Le CSS doit être riche, propre, responsive, sombre ou premium selon la demande.
- Le JS doit ajouter des interactions utiles sans dépendances obligatoires.
- Utilise de vraies sections : hero, fonctionnalités, stats, avis, FAQ, CTA, footer.
- Optimise SEO, accessibilité, titres, boutons.
- Pas d'images locales obligatoires.
- Évite les frameworks.
`;

    const userContent =
      mode === "improve"
        ? `Améliore ce site existant selon la demande suivante :\n${prompt}\n\nSITE EXISTANT :\n${existingSite}`
        : prompt;

    const content = await callOpenRouter([
      { role: "system", content: system },
      { role: "user", content: userContent }
    ]);

    const parsed = safeJsonParse(content);

    if (!parsed) {
      return res.json({
        html: "<h1>Réponse IA non lisible</h1>",
        css: "",
        js: content
      });
    }

    return res.json({
      html: parsed.html || "<h1>HTML vide</h1>",
      css: parsed.css || "",
      js: parsed.js || ""
    });
  } catch (error) {
    console.error("Erreur génération IA :", error);
    return res.status(500).json({
      html: "<h1>Erreur serveur</h1>",
      css: "body{font-family:Arial;padding:40px}",
      js: String(error)
    });
  }
});

app.get("/google85eef80a332bd1ef.html", (req, res) => {
  res.type("text/html");
  res.send("google-site-verification: google85eef80a332bd1ef.html");
});

const pages = ["generate", "dashboard", "shop", "community", "help", "privacy"];

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
app.listen(PORT, () => console.log(`Siteo V8 lancé sur le port ${PORT}`));
