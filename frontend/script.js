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
    if(data.command === "index") window.location.href = "index.html";
    if(data.command === "info") window.location.href = "info.html";
    if(data.command === "contact") window.location.href = "contact.html";
    if(data.command === "visite") window.location.href = "visite.html";
  }
}, 2000);

// Gestion boutons sur index.html
document.querySelectorAll("button[data-pair]").forEach(btn => {
  btn.addEventListener("click", async () => {
    const pair = btn.dataset.pair;
    await fetch("/visit", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({visitorId, page: `Paire choisie: ${pair}`})
    });
    alert(`Tu as choisi: ${pair}`);
    localStorage.setItem("chosenPair", pair);
  });
});

// Afficher la paire choisie sur info.html
const chosenPair = localStorage.getItem("chosenPair");
if(chosenPair && document.getElementById("chosen-pair")){
  document.getElementById("chosen-pair").src = `images/${chosenPair.replace(/\s+/g,"_")}.jpg`;
}
