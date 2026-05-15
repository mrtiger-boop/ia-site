import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

console.log(
  "CLE OPENROUTER :",
  process.env.OPENROUTER_API_KEY
    ? "OK"
    : "MANQUANTE"
);

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));

app.post("/api/generate", async (req, res) => {

  try {

    const { prompt } = req.body;

    if (!process.env.OPENROUTER_API_KEY) {

      return res.json({

        html:
        "<h1>Clé API manquante</h1>",

        css:
        "",

        js:
        "Ajoute OPENROUTER_API_KEY dans .env"

      });

    }

    const response =
    await fetch(

      "https://openrouter.ai/api/v1/chat/completions",

      {

        method:
        "POST",

        headers:{

          Authorization:
          `Bearer ${process.env.OPENROUTER_API_KEY}`,

          "Content-Type":
          "application/json",

          "HTTP-Referer":
          "http://localhost:3000",

          "X-Title":
          "MrTiger X AI"

        },

        body:

        JSON.stringify({

          model:
          "openrouter/auto",

          messages:[

            {

              role:
              "system",

              content:
`
Tu es une IA qui crée des templates web.

Réponds uniquement avec JSON :

{
"html":"...",
"css":"...",
"js":"..."
}

Pas de texte autour.
Pas de markdown.
`

            },

            {

              role:
              "user",

              content:
              prompt

            }

          ]

        })

      }

    );

    const ai =
    await response.json();

    console.log(
      "REPONSE :",
      JSON.stringify(
        ai,
        null,
        2
      )
    );

    if(
      !response.ok
    ){

      return res.json({

        html:
        "<h1>Erreur OpenRouter</h1>",

        css:
        "",

        js:
        JSON.stringify(
          ai,
          null,
          2
        )

      });

    }

    let content =

    ai
    .choices?.[0]
    ?.message
    ?.content;

    if(
      !content
    ){

      return res.json({

        html:
        "<h1>Aucune réponse IA</h1>",

        css:
        "",

        js:
        JSON.stringify(
          ai,
          null,
          2
        )

      });

    }

    content =

    content

    .replace(
      /```json/g,
      ""
    )

    .replace(
      /```/g,
      ""
    )

    .trim();

    const parsed =
    JSON.parse(
      content
    );

    return res.json({

      html:
      parsed.html
      ||
      "<h1>HTML vide</h1>",

      css:
      parsed.css
      ||
      "",

      js:
      parsed.js
      ||
      ""

    });

  }

  catch(error){

    console.error(
      "ERREUR :",
      error
    );

    return res
    .status(500)

    .json({

      html:
      "<h1>Erreur serveur</h1>",

      css:
      "",

      js:
      String(
        error
      )

    });

  }

});

app.listen(

3000,

()=>{

console.log(
"http://localhost:3000"
);

}

);