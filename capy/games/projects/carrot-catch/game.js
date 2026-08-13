(() => {
  'use strict';
  const DURATION_MS=20000;
  const scoreEl=document.getElementById('score'),timeEl=document.getElementById('time'),field=document.getElementById('field'),carrot=document.getElementById('carrot'),intro=document.getElementById('intro'),start=document.getElementById('start'),capyCopy=document.getElementById('capyCopy'),message=document.getElementById('message');
  let score=0,endTimer=0,tickTimer=0,running=false,remainingMs=DURATION_MS,segmentStartedAt=0;
  const place=()=>{const rect=field.getBoundingClientRect(),margin=46;const x=margin+Math.random()*Math.max(1,rect.width-margin*2),y=margin+Math.random()*Math.max(1,rect.height-margin*2);carrot.style.left=`${x}px`;carrot.style.top=`${y}px`;};
  const currentRemaining=()=>segmentStartedAt?Math.max(0,remainingMs-(performance.now()-segmentStartedAt)):remainingMs;
  const updateTime=()=>{if(!running)return;timeEl.textContent=String(Math.ceil(currentRemaining()/1000));};
  const clearTimers=()=>{clearTimeout(endTimer);clearInterval(tickTimer);endTimer=0;tickTimer=0;};
  const pauseTimers=()=>{if(!running||!segmentStartedAt)return;remainingMs=currentRemaining();segmentStartedAt=0;clearTimers();updateTime();};
  const resumeTimers=()=>{if(!running||segmentStartedAt)return;if(remainingMs<=0){void finish();return;}segmentStartedAt=performance.now();updateTime();tickTimer=setInterval(updateTime,200);endTimer=setTimeout(()=>void finish(),remainingMs);};
  async function finish(){if(!running)return;remainingMs=currentRemaining();running=false;segmentStartedAt=0;clearTimers();carrot.hidden=true;const durationMs=Math.max(1000,Math.round(DURATION_MS-remainingMs));message.hidden=false;message.textContent='Ergebnis wird gepr\u00fcft \u2026';try{await CapytGame.finish({score,durationMs});message.textContent='Geschafft!';}catch(error){message.textContent=error.message||'Ergebnis konnte nicht gesendet werden.';}}
  async function begin(){if(running)return;start.disabled=true;message.hidden=true;try{const init=await CapytGame.ready();const capy=init.capy||await CapytGame.getCapy();capyCopy.textContent=`${capy?.name||'Capy'} schaut zu. Fang so viele Karotten wie m\u00f6glich.`;await CapytGame.start();score=0;remainingMs=DURATION_MS;segmentStartedAt=0;scoreEl.textContent='0';timeEl.textContent='20';intro.hidden=true;carrot.hidden=false;running=true;place();resumeTimers();}catch(error){start.disabled=false;capyCopy.textContent=error.message||'Spiel konnte nicht gestartet werden.';}}
  carrot.addEventListener('click',()=>{if(!running||!segmentStartedAt)return;score+=1;scoreEl.textContent=String(score);place();});
  start.addEventListener('click',()=>void begin());
  CapytGame.ready().then(init=>{const capy=init?.capy;capyCopy.textContent=`${capy?.name||'Capy'} schaut zu. Fang so viele Karotten wie m\u00f6glich.`;}).catch(error=>{capyCopy.textContent=error.message||'Game Bridge nicht verf\u00fcgbar.';start.disabled=true;});
  CapytGame.onLifecycle(state=>{if(state==='paused')pauseTimers();if(state==='playing')resumeTimers();if(state==='closed'){running=false;segmentStartedAt=0;clearTimers();}});
})();
