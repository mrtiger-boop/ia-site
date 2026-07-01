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
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const supabaseAdmin =
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    : null;

app.use(cors());

app.post("/api/stripe-webhook", express.raw({ type: "application/json" }), async (req, res) => {
  return res.json({ received: true });
});

app.use(express.json({ limit: "14mb" }));
app.use(express.static(path.join(__dirname, "public")));

async function callOpenRouter(messages, max_tokens = 2500) {
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
      messages,
      max_tokens
    })
  });

  const data = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(data));
  return data.choices?.[0]?.message?.content?.trim() || "";
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

app.post("/api/generate", async (req, res) => {
  try {
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
      {
        role: "system",
        content: `Tu génères uniquement le fichier HTML complet d'un site premium. Pas de markdown. Le HTML doit lier style.css et script.js.`
      },
      {
        role: "user",
        content: finalPrompt
      }
    ], 2800));

    const css = cleanCode(await callOpenRouter([
      {
        role: "system",
        content: `Tu génères uniquement le CSS du site. Pas de markdown. CSS premium, responsive, animations, glassmorphism. Maximum 350 lignes.`
      },
      {
        role: "user",
        content: `Voici le HTML :\n${html}\n\nCrée le CSS premium correspondant.`
      }
    ], 2800));

    const js = cleanCode(await callOpenRouter([
      {
        role: "system",
        content: `Tu génères uniquement le JavaScript du site. Pas de markdown. JS simple, propre, interactions utiles. Maximum 120 lignes.`
      },
      {
        role: "user",
        content: `Voici le HTML :\n${html}\n\nVoici le CSS :\n${css}\n\nCrée le JavaScript correspondant.`
      }
    ], 1600));

    return res.json({ html, css, js });
  } catch (error) {
    console.error("Erreur génération :", error);
    return res.status(500).json({
      html: "<h1>Erreur serveur</h1>",
      css: "",
      js: String(error)
    });
  }
});

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    if (!stripe) return res.status(500).json({ error: "Stripe non configuré." });

    const { userId, email, type } = req.body;

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
    return res.status(500).json({ error: "Erreur Stripe Checkout." });
  }
});

app.post("/api/create-portal-session", async (req, res) => {
  try {
    if (!stripe || !supabaseAdmin) {
      return res.status(500).json({ error: "Stripe/Supabase non configuré." });
    }

    const { userId } = req.body;

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (!profile?.stripe_customer_id) {
      return res.status(400).json({ error: "Aucun abonnement Stripe trouvé." });
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${PUBLIC_SITE_URL}/dashboard`
    });

    return res.json({ url: portal.url });
  } catch (error) {
    return res.status(500).json({ error: "Erreur portail Stripe." });
  }
});

app.get("/google85eef80a332bd1ef.html", (req, res) => {
  res.type("text/html");
  res.send("google-site-verification: google85eef80a332bd1ef.html");
});

const pages = [
  "generate",
  "dashboard",
  "shop",
  "community",
  "projects",
  "templates",
  "components",
  "academy",
  "leaderboard",
  "roadmap",
  "marketplace",
  "showcase",
  "analytics",
  "settings",
  "help",
  "privacy"
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
