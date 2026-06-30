import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("CLE OPENROUTER :", process.env.OPENROUTER_API_KEY ? "OK" : "MANQUANTE");

app.use(cors());
app.use(express.json({ limit: "4mb" }));
app.use(express.static(path.join(__dirname, "public")));

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

const pages = [
  "generate",
  "dashboard",
  "shop",
  "pricing",
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
