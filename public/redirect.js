async function pollRedirect(){
  const res = await fetch('/api/status');
  const data = await res.json();
  if(data.redirect){
    window.location.href = data.redirect;
  }
  setTimeout(pollRedirect,1000);
}
pollRedirect();
