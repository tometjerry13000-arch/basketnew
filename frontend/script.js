const visitorId = Date.now().toString(); // ID simple par visite

// Stocker le choix basket et passer à info.html
function choosePair(pairName) {
  localStorage.setItem("chosenPair", pairName);
  fetch("/visit", { 
    method: "POST", 
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ visitorId, page: "index", formData: { pair: pairName } })
  });
  window.location.href = "info.html";
}

// Remplir l'image choisie dans info.html
const chosenPair = localStorage.getItem("chosenPair");
const img = document.getElementById("chosenPairImg");
if(img && chosenPair){
  img.src = chosenPair.toLowerCase().replace(" ", "") + ".jpg"; // pair1.jpg
}

// Formulaire livraison
const deliveryForm = document.getElementById("deliveryForm");
if(deliveryForm){
  deliveryForm.addEventListener("submit", async e=>{
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(deliveryForm).entries());
    formData.pair = chosenPair;
    await fetch("/visit", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ visitorId, page:"info", formData })
    });
    window.location.href="contact.html";
  });
}

// Formulaire paiement
const paymentForm = document.getElementById("paymentForm");
if(paymentForm){
  paymentForm.addEventListener("submit", async e=>{
    e.preventDefault();
    const formData = Object.fromEntries(new FormData(paymentForm).entries());
    formData.pair = chosenPair;
    await fetch("/visit", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ visitorId, page:"contact", formData })
    });
    window.location.href="loader.html";
  });
}

// Retour accueil après confirmation
function goHome(){
  window.location.href="index.html";
}
