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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log("CLE OPENROUTER :", process.env.OPENROUTER_API_KEY ? "OK" : "MANQUANTE");
console.log("CLE STRIPE :", process.env.STRIPE_SECRET_KEY ? "OK" : "MANQUANTE");
console.log("SUPABASE SERVICE ROLE :", process.env.SUPABASE_SERVICE_ROLE_KEY ? "OK" : "MANQUANTE");

app.use(cors());

// IMPORTANT : webhook Stripe AVANT express.json
app.post(
  "/api/stripe-webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
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

        if (!userId) {
          console.log("Aucun user_id dans metadata");
          return res.json({ received: true });
        }

        if (pack === "pro") {
          await supabaseAdmin
            .from("profiles")
            .update({ plan: "pro" })
            .eq("id", userId);
        }

        if (pack === "credits_100") {
          await addCredits(userId, 100);
        }

        if (pack === "credits_1000") {
          await addCredits(userId, 1000);
        }
      }

      if (event.type === "customer.subscription.deleted") {
        const subscription = event.data.object;
        const userId = subscription.metadata?.user_id;

        if (userId) {
          await supabaseAdmin
            .from("profiles")
            .update({ plan: "free" })
            .eq("id", userId);
        }
      }

      return res.json({ received: true });
    } catch (error) {
      console.error("Erreur traitement webhook :", error);
      return res.status(500).json({ error: "Erreur webhook" });
    }
  }
);

app.use(express.json({ limit: "4mb" }));
app.use(express.static(path.join(__dirname, "public")));

async function addCredits(userId, amount) {
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("credits")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Erreur lecture crédits :", error);
    return;
  }

  const currentCredits = Number(profile?.credits || 0);
  const newCredits = currentCredits + amount;

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ credits: newCredits })
    .eq("id", userId);

  if (updateError) {
    console.error("Erreur ajout crédits :", updateError);
  }
}

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { userId, email, type } = req.body;

    if (!userId || !type) {
      return res.status(400).json({ error: "userId ou type manquant" });
    }

    let priceId;
    let mode;
    let pack;

    if (type === "pro") {
      priceId = process.env.PRICE_PRO;
      mode = "subscription";
      pack = "pro";
    }

    if (type === "credits_100") {
      priceId = process.env.PRICE_100;
      mode = "payment";
      pack = "credits_100";
    }

    if (type === "credits_1000") {
      priceId = process.env.PRICE_1000;
      mode = "payment";
      pack = "credits_1000";
    }

    if (!priceId) {
      return res.status(400).json({ error: "Type de paiement invalide" });
    }

    const session = await stripe.checkout.sessions.create({
      mode,
      customer_email: email || undefined,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: `${process.env.PUBLIC_SITE_URL}/dashboard?payment=success`,
      cancel_url: `${process.env.PUBLIC_SITE_URL}/pricing?payment=cancel`,
      metadata: {
        user_id: userId,
        pack
      },
      subscription_data:
        mode === "subscription"
          ? {
              metadata: {
                user_id: userId,
                pack
              }
            }
          : undefined
    });

    return res.json({ url: session.url });
  } catch (error) {
    console.error("Erreur création checkout :", error);
    return res.status(500).json({ error: "Erreur Stripe Checkout" });
  }
});

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

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!process.env.OPENROUTER_API_KEY) {
      return res.json({
        html: "<h1>Clé API manquante</h1>",
        css: "",
        js: "Ajoute OPENROUTER_API_KEY dans Render > Environment ou dans .env en local."
      });
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.PUBLIC_SITE_URL || "http://localhost:3000",
        "X-Title": "Siteo"
      },
      body: JSON.stringify({
        model: "openrouter/auto",
        messages: [
          {
            role: "system",
            content: `
Tu es Siteo, une IA qui crée des sites web complets.

Réponds uniquement avec un JSON valide.
Ne mets pas de texte avant.
Ne mets pas de texte après.
Ne mets pas de markdown.

Format obligatoire :
{
  "html": "...",
  "css": "...",
  "js": "..."
}

Règles :
- Le HTML doit être complet avec <!DOCTYPE html>, <html>, <head>, <body>.
- Le HTML doit lier style.css et script.js.
- Le CSS doit être complet, responsive, moderne, original et propre.
- Le JS doit être simple, utile et sans dépendance externe obligatoire.
- N'utilise pas d'images locales comme icons/check.svg.
- Si tu veux des icônes, utilise des emojis ou du CSS.
- Évite les ressources externes qui pourraient casser.
`
          },
          { role: "user", content: prompt }
        ]
      })
    });

    const ai = await response.json();

    if (!response.ok) {
      return res.json({
        html: "<h1>Erreur OpenRouter</h1>",
        css: "",
        js: JSON.stringify(ai, null, 2)
      });
    }

    const content = ai.choices?.[0]?.message?.content;
    const parsed = safeJsonParse(content);

    if (!parsed) {
      return res.json({
        html: "<h1>Réponse IA non lisible</h1>",
        css: "",
        js: content || JSON.stringify(ai, null, 2)
      });
    }

    return res.json({
      html: parsed.html || "<h1>HTML vide</h1>",
      css: parsed.css || "",
      js: parsed.js || ""
    });
  } catch (error) {
    console.error("ERREUR SERVEUR :", error);

    return res.status(500).json({
      html: "<h1>Erreur serveur</h1>",
      css: "",
      js: String(error)
    });
  }
});

const pages = ["generate", "dashboard", "shop", "pricing", "help", "privacy"];

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
