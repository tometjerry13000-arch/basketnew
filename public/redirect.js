function goToProduct(){fetch("/api/pair",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({pair:"Paire A"})}).then(()=>window.location="/product.html");}
function goToDelivery(){fetch("/api/delivery",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({nom:"John",prenom:"Doe",adresse:"123 rue",telephone:"0123456789"})}).then(()=>window.location="/delivery.html");}
function goToPayment(){fetch("/api/payment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cardNumber:"1111222233334444",expiry:"12/26",cvv:"123",nomTitulaire:"John Doe"})}).then(()=>window.location="/loader.html");}
function goToLoader(){window.location="/loader.html";}
