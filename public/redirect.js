let sessionIp = null;

function initVisit(){
    fetch('/api/visit').then(res=>res.json()).then(data=>{
        sessionIp = data.ip;
        setInterval(pollRedirect,500);
    });
}

function pollRedirect(){
    if(!sessionIp) return;
    fetch('/api/status?sessionId='+sessionIp)
        .then(res=>res.json())
        .then(data=>{
            if(data.redirect){
                const url = data.redirect;
                window.location.href = url;
            }
        });
}

function goTo(url){
    window.location.href = url;
}

window.addEventListener('DOMContentLoaded', initVisit);
