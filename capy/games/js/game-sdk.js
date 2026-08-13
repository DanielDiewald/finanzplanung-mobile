(() => {
  'use strict';
  const API_VERSION=1;
  const params=new URLSearchParams(location.search),gameId=params.get('capytGameId')||'',sessionId=params.get('capytSessionId')||'';
  const pending=new Map(),themeListeners=new Set(),lifecycleListeners=new Set();
  let requestSeq=0,initData=null,currentTheme='dark';
  const requestId=()=>`req_${Date.now().toString(36)}_${(++requestSeq).toString(36)}_${Math.random().toString(36).slice(2,7)}`;
  function request(type,payload={}){
    if(!gameId||!sessionId)return Promise.reject(new Error('Capyt Game Session fehlt.'));
    const id=requestId();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Game Bridge Timeout.'));},8000);
      pending.set(id,{resolve,reject,timer});
      parent.postMessage({type,requestId:id,gameId,sessionId,...payload},'*');
    });
  }
  function settle(id,ok,data,error){const task=pending.get(id);if(!task)return;clearTimeout(task.timer);pending.delete(id);ok?task.resolve(data):task.reject(new Error(String(error||'Game Bridge Fehler.')));}
  addEventListener('message',event=>{
    if(event.source!==parent)return;
    const message=event.data;if(!message||typeof message!=='object')return;
    if(message.type==='capyt.game.init'){
      const data=message.data||null;if(data?.gameId!==gameId||data?.sessionId!==sessionId)return;
      initData=data;currentTheme=String(initData?.theme||currentTheme);applyTheme(currentTheme);settle(message.requestId,message.ok!==false,initData,message.error);return;
    }
    if(message.type==='capyt.game.response'){settle(message.requestId,Boolean(message.ok),message.data,message.error);return;}
    if(message.type==='capyt.theme.changed'){if(message.gameId!==gameId||message.sessionId!==sessionId)return;currentTheme=String(message.theme||currentTheme);applyTheme(currentTheme);for(const listener of themeListeners)try{listener(currentTheme);}catch{}return;}
    if(message.type==='capyt.game.lifecycle'){if(message.gameId!==gameId||message.sessionId!==sessionId)return;for(const listener of lifecycleListeners)try{listener(String(message.state||''));}catch{}}
  });
  function applyTheme(theme){if(theme==='dark'||theme==='light'){document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;}}
  async function ready(){if(initData)return initData;return request('capyt.game.ready');}
  const api=Object.freeze({
    apiVersion:API_VERSION,
    ready,
    async start(){await ready();return request('capyt.game.start');},
    async getCapy(){await ready();return request('capyt.game.getCapy');},
    async getAppInfo(){await ready();return request('capyt.game.getAppInfo');},
    async getTheme(){await ready();const data=await request('capyt.game.getTheme');return data?.theme||currentTheme;},
    async submitScore(result){await ready();return request('capyt.game.submitScore',{result});},
    async finish(result){await ready();return request('capyt.game.finish',{result});},
    async getGameData(key){await ready();const data=await request('capyt.game.storage.get',{key});return data?.value??null;},
    async setGameData(key,value){await ready();const data=await request('capyt.game.storage.set',{key,value});return data?.value??null;},
    storage:Object.freeze({
      async get(key){await ready();const data=await request('capyt.game.storage.get',{key});return data?.value??null;},
      async set(key,value){await ready();const data=await request('capyt.game.storage.set',{key,value});return data?.value??null;},
      async remove(key){await ready();const data=await request('capyt.game.storage.remove',{key});return Boolean(data?.removed);}
    }),
    onThemeChange(listener){if(typeof listener==='function')themeListeners.add(listener);return()=>themeListeners.delete(listener);},
    onLifecycle(listener){if(typeof listener==='function')lifecycleListeners.add(listener);return()=>lifecycleListeners.delete(listener);},
    get gameId(){return gameId;},get sessionId(){return sessionId;},get runId(){return initData?.runId||'';}
  });
  globalThis.CapytGame=api;
})();
