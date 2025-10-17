const visitorId = localStorage.getItem("visitorId");

// Vérification toutes les 2 secondes
setInterval(async () => {
  const res = await fetch(`/get-command?visitorId=${visitorId}`);
  const data = await res.json();
  if (data.command === "confirm_payment") {
    // Redirection vers page confirmation
    window.location.href = "confirmation.html";
  }
}, 2000);
