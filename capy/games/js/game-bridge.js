import { GAME_API_VERSION, gameHasCapability } from './game-hub.js';
import { recordSubmittedScore, processFinishedRun } from './game-rewards.js';

const REQUEST_CAPABILITY=Object.freeze({
  'capyt.game.getCapy':'capy.read','capyt.game.getAppInfo':'app.read','capyt.game.getTheme':'theme.read','capyt.game.storage.get':'game.storage','capyt.game.storage.set':'game.storage','capyt.game.storage.remove':'game.storage','capyt.game.submitScore':'game.score','capyt.game.finish':'game.score'
});
const REQUEST_TYPES=new Set(['capyt.game.ready','capyt.game.start',...Object.keys(REQUEST_CAPABILITY)]);

function cleanRequestId(value){const id=String(value||'');return /^[A-Za-z0-9_-]{1,120}$/.test(id)?id:'';}
function response(post,requestId,ok,data=null,error=''){post({type:'capyt.game.response',requestId,ok,data,error:String(error||'')});}

export function createGameBridge({loader,getCapySnapshot,getAppInfo,getTheme,storage,getState,saveState,queueCoins,onFinished=()=>{},onError=()=>{}}){
  if(!loader)throw new Error('Game Loader fehlt.');

  const handle=async event=>{
    const session=loader.session();if(!session||!loader.isSource(event.source))return;
    const message=event.data;if(!message||typeof message!=='object'||Array.isArray(message))return;
    const type=String(message.type||''),requestId=cleanRequestId(message.requestId),gameId=String(message.gameId||'');
    if(!REQUEST_TYPES.has(type)){if(requestId)response(loader.post,requestId,false,null,'Unbekannte Game-Nachricht.');return;}
    if(!requestId)return;
    if(gameId!==session.gameId){response(loader.post,requestId,false,null,'Game-ID stimmt nicht mit der aktiven Session überein.');return;}
    if(String(message.sessionId||'')!==session.sessionId){response(loader.post,requestId,false,null,'Game-Session ist ungültig.');return;}
    if(['finished','error'].includes(session.status)&&type!=='capyt.game.ready'){response(loader.post,requestId,false,null,'Game-Session ist bereits beendet.');return;}
    const capability=REQUEST_CAPABILITY[type];
    if(capability&&!gameHasCapability(session.game,capability)){response(loader.post,requestId,false,null,`Capability ${capability} ist nicht erlaubt.`);return;}

    try{
      if(type==='capyt.game.ready'){
        loader.setStatus('ready');
        const init={apiVersion:GAME_API_VERSION,gameId:session.gameId,sessionId:session.sessionId,runId:session.runId,theme:getTheme(),capabilities:[...session.game.capabilities]};
        if(gameHasCapability(session.game,'capy.read'))init.capy=getCapySnapshot();
        if(gameHasCapability(session.game,'app.read'))init.app=getAppInfo();
        loader.post({type:'capyt.game.init',requestId,ok:true,data:init});
        return;
      }
      if(type==='capyt.game.start'){
        if(!['ready','paused'].includes(session.status))throw new Error('Game kann in diesem Zustand nicht gestartet werden.');
        loader.setStatus('playing');response(loader.post,requestId,true,{state:'playing',runId:session.runId});return;
      }
      if(type==='capyt.game.getCapy'){response(loader.post,requestId,true,getCapySnapshot());return;}
      if(type==='capyt.game.getAppInfo'){response(loader.post,requestId,true,getAppInfo());return;}
      if(type==='capyt.game.getTheme'){response(loader.post,requestId,true,{theme:getTheme()});return;}
      if(type==='capyt.game.storage.get'){response(loader.post,requestId,true,{value:await storage.get(session.gameId,message.key)});return;}
      if(type==='capyt.game.storage.set'){response(loader.post,requestId,true,{value:await storage.set(session.gameId,message.key,message.value)});return;}
      if(type==='capyt.game.storage.remove'){response(loader.post,requestId,true,{removed:await storage.remove(session.gameId,message.key)});return;}
      if(type==='capyt.game.submitScore'){
        const score=recordSubmittedScore(getState(),session.game,message.result||{});await saveState();response(loader.post,requestId,true,score);return;
      }
      if(type==='capyt.game.finish'){
        const result=processFinishedRun({state:getState(),game:session.game,result:message.result||{},runId:session.runId,allowCoins:gameHasCapability(session.game,'coins.reward'),queueCoins:(amount,reason)=>queueCoins(amount,reason)});
        await saveState();loader.finish(result);response(loader.post,requestId,true,result);onFinished(result,session);return;
      }
    }catch(error){onError(error,session,message);response(loader.post,requestId,false,null,error?.message||'Game-Anfrage fehlgeschlagen.');}
  };

  window.addEventListener('message',handle);
  return Object.freeze({destroy:()=>window.removeEventListener('message',handle),handle});
}
