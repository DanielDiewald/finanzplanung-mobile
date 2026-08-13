const LOCAL_ENTRY_PATTERN=/^\.\/projects\/[a-z0-9](?:[a-z0-9-]{0,62})\/index\.html$/;

export function validateGameEntry(entry,{required=true}={}){
  const value=String(entry||'').trim();
  if(!value)return !required;
  if(value.includes('..')||value.startsWith('/')||value.startsWith('//')||/^[a-z][a-z0-9+.-]*:/i.test(value))return false;
  return LOCAL_ENTRY_PATTERN.test(value);
}

export function resolveGameEntry(entry,baseUrl=new URL('../',import.meta.url)){
  if(!validateGameEntry(entry))throw new Error('Ungültiger Game-Entry-Path.');
  const base=new URL('./',baseUrl);
  const url=new URL(entry.replace(/^\.\//,''),base);
  const projectsRoot=new URL('./projects/',base);
  if(url.origin!==projectsRoot.origin||!url.pathname.startsWith(projectsRoot.pathname))throw new Error('Game-Entry liegt außerhalb von capy/games/projects/.');
  return url;
}

function randomId(prefix){
  const uuid=globalThis.crypto?.randomUUID?.();
  if(uuid)return `${prefix}${uuid}`;
  return `${prefix}${Date.now().toString(36)}_${Math.random().toString(36).slice(2,12)}`;
}

export function createGameLoader({frame,statusElement,onStatusChange=()=>{}}={}){
  if(!frame)throw new Error('Game-Frame fehlt.');
  let session=null,loadTimer=0;
  const clearLoadTimer=()=>{if(loadTimer){clearTimeout(loadTimer);loadTimer=0;}};
  const setStatus=status=>{
    if(status!=='loading')clearLoadTimer();
    if(session)session.status=status;
    if(statusElement)statusElement.textContent=status==='loading'?'Spiel wird geladen …':status==='ready'?'Bereit':status==='playing'?'Läuft':status==='paused'?'Pausiert':status==='finished'?'Beendet':status==='error'?'Fehler':'';
    onStatusChange(status,session);
  };
  const post=message=>{if(frame.contentWindow)frame.contentWindow.postMessage(message,'*');};

  frame.addEventListener('error',()=>{if(session){session.error='Spiel konnte nicht geladen werden.';setStatus('error');}});

  return Object.freeze({
    open(game){
      if(!game?.enabled||!['available','experimental'].includes(game.status))throw new Error('Dieses Spiel kann aktuell nicht gestartet werden.');
      const url=resolveGameEntry(game.entry);
      const sessionId=randomId('game_session_'),runId=randomId('game_run_');
      url.searchParams.set('capytGameId',game.id);
      url.searchParams.set('capytSessionId',sessionId);
      clearLoadTimer();
      session={sessionId,runId,gameId:game.id,game,startedAt:new Date().toISOString(),status:'loading',finishedResult:null,error:''};
      setStatus('loading');
      frame.src=url.href;
      loadTimer=setTimeout(()=>{if(session?.sessionId===sessionId&&session.status==='loading'){session.error='Spiel konnte nicht initialisiert werden.';setStatus('error');}},12000);
      return session;
    },
    session:()=>session,
    isSource(source){return Boolean(session&&frame.contentWindow&&source===frame.contentWindow);},
    setStatus,
    post,
    pause(){if(!session||session.status!=='playing')return false;setStatus('paused');post({type:'capyt.game.lifecycle',state:'paused',gameId:session.gameId,sessionId:session.sessionId});return true;},
    resume(){if(!session||session.status!=='paused')return false;setStatus('playing');post({type:'capyt.game.lifecycle',state:'playing',gameId:session.gameId,sessionId:session.sessionId});return true;},
    themeChanged(theme){if(session)post({type:'capyt.theme.changed',theme,gameId:session.gameId,sessionId:session.sessionId});},
    finish(result){if(!session)return;session.finishedResult=result;setStatus('finished');},
    close(){
      clearLoadTimer();
      if(session)post({type:'capyt.game.lifecycle',state:'closed',gameId:session.gameId,sessionId:session.sessionId});
      frame.removeAttribute('src');
      try{frame.src='about:blank';}catch{}
      const previous=session;session=null;
      if(statusElement)statusElement.textContent='';
      onStatusChange('closed',previous);
      return previous;
    }
  });
}
