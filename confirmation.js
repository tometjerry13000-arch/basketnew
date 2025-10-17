const visitorId = localStorage.getItem("visitorId");

// Vérification toutes les 2 secondes
setInterval(async () => {
  const res = await fetch(`/get-command?visitorId=${visitorId}`);
  const data = await res.json();
  if (data.command === "return_home") {
    window.location.href = "index.html";
  }
}, 2000);
