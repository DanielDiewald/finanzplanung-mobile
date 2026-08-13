import { validateGameEntry } from './game-loader.js';

export const GAME_API_VERSION=1;
export const GAME_STATUSES=Object.freeze(['available','coming_soon','disabled','experimental']);
export const GAME_CAPABILITIES=Object.freeze(['capy.read','game.storage','game.score','coins.reward','theme.read','app.read','capy.effect','inventory.read','inventory.reward','finance.read.summary']);
const ACTIVE_CAPABILITIES=new Set(['capy.read','game.storage','game.score','coins.reward','theme.read','app.read']);

function text(value,max=240){return String(value??'').trim().slice(0,max);}
function int(value,fallback=0){const n=Number(value);return Number.isFinite(n)?Math.trunc(n):fallback;}

export function normalizeGameRegistry(input){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('games.json enthält kein Objekt.');
  if(Number(input.schemaVersion)!==1)throw new Error('Nicht unterstützte Game-Registry-Version.');
  if(!Array.isArray(input.games))throw new Error('Game-Liste fehlt.');
  const ids=new Set();
  const games=input.games.map((raw,index)=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error(`Game ${index+1} ist ungültig.`);
    const id=text(raw.id,64);
    if(!/^[a-z0-9](?:[a-z0-9-]{0,62})$/.test(id))throw new Error(`Ungültige Game-ID: ${id||'(leer)'}.`);
    if(ids.has(id))throw new Error(`Doppelte Game-ID: ${id}.`);ids.add(id);
    const status=text(raw.status,32)||'disabled';
    if(!GAME_STATUSES.includes(status))throw new Error(`Unbekannter Game-Status: ${status}.`);
    const enabled=Boolean(raw.enabled);
    const entry=text(raw.entry,240);
    const launchable=enabled&&['available','experimental'].includes(status);
    if(!validateGameEntry(entry,{required:launchable}))throw new Error(`Ungültiger Entry-Path für ${id}.`);
    const capabilities=Array.isArray(raw.capabilities)?[...new Set(raw.capabilities.map(x=>text(x,80)).filter(Boolean))]:[];
    for(const capability of capabilities){
      if(!GAME_CAPABILITIES.includes(capability))throw new Error(`Unbekannte Capability ${capability} in ${id}.`);
      if(!ACTIVE_CAPABILITIES.has(capability))throw new Error(`Capability ${capability} ist in Game API 1 noch nicht freigeschaltet.`);
    }
    const rewards=raw.rewards&&typeof raw.rewards==='object'&&!Array.isArray(raw.rewards)?raw.rewards:{};
    const resultValidation=raw.resultValidation&&typeof raw.resultValidation==='object'&&!Array.isArray(raw.resultValidation)?raw.resultValidation:{};
    return {
      id,name:text(raw.name,80)||id,description:text(raw.description,220),status,enabled,version:text(raw.version,40)||'0.0.0',entry,icon:text(raw.icon,8),image:text(raw.image,240),orientation:['portrait','landscape','any'].includes(raw.orientation)?raw.orientation:'portrait',order:int(raw.order,index*10),tags:Array.isArray(raw.tags)?raw.tags.map(x=>text(x,40)).filter(Boolean).slice(0,20):[],
      rewards:{enabled:Boolean(rewards.enabled),currency:rewards.currency==='coins'?'coins':'coins',maxCoinsPerRun:Math.max(0,int(rewards.maxCoinsPerRun)),dailyRewardLimit:Math.max(0,int(rewards.dailyRewardLimit)),cooldownMs:Math.max(0,int(rewards.cooldownMs)),strategy:rewards.strategy&&typeof rewards.strategy==='object'?structuredCloneSafe(rewards.strategy):{}},
      resultValidation:{minScore:int(resultValidation.minScore,0),maxScore:Math.max(0,int(resultValidation.maxScore,100000000)),minDurationMs:Math.max(0,int(resultValidation.minDurationMs,0)),maxDurationMs:Math.max(0,int(resultValidation.maxDurationMs,86400000))},
      capabilities,
      offlineAssets:Array.isArray(raw.offlineAssets)?raw.offlineAssets.map(x=>text(x,240)).filter(x=>validateOfflineAsset(x,id)).slice(0,100):[]
    };
  });
  return {schemaVersion:1,apiVersion:Number(input.apiVersion)||GAME_API_VERSION,games};
}

function structuredCloneSafe(value){try{return globalThis.structuredClone?structuredClone(value):JSON.parse(JSON.stringify(value));}catch{return {};}}
function validateOfflineAsset(value,id){
  const v=String(value||'');
  if(v.includes('..')||v.startsWith('/')||/^[a-z][a-z0-9+.-]*:/i.test(v))return false;
  return v.startsWith(`./projects/${id}/`);
}

export function visibleGames(registry){return (registry?.games||[]).filter(game=>game.enabled).sort((a,b)=>a.order-b.order||a.name.localeCompare(b.name,'de'));}
export function canLaunchGame(game){return Boolean(game?.enabled&&['available','experimental'].includes(game.status)&&validateGameEntry(game.entry));}
export function gameHasCapability(game,capability){return Boolean(game?.capabilities?.includes(capability));}

export async function loadGameRegistry(url='./games/games.json',fetcher=fetch){
  const response=await fetcher(url,{cache:'no-cache'});
  if(!response.ok)throw new Error(`Game Registry konnte nicht geladen werden (HTTP ${response.status}).`);
  return normalizeGameRegistry(await response.json());
}

export function renderGameHub(container,games,{getStats=()=>null,onPlay=()=>{},offlineReady=()=>true}={}){
  if(!container)return;
  container.replaceChildren();
  if(!games.length){const empty=document.createElement('div');empty.className='game-hub-empty';empty.textContent='Noch keine Minispiele verfügbar.';container.append(empty);return;}
  for(const game of games){
    const stats=getStats(game.id)||{};
    const card=document.createElement('article');card.className=`game-card game-card--${game.status}`;card.dataset.gameId=game.id;
    const icon=document.createElement('div');icon.className='game-card-icon';icon.textContent=game.icon||'🎮';
    const body=document.createElement('div');body.className='game-card-body';
    const titleRow=document.createElement('div');titleRow.className='game-card-title';
    const title=document.createElement('h3');title.textContent=game.name;titleRow.append(title);
    if(game.status==='experimental'){const badge=document.createElement('span');badge.className='game-badge';badge.textContent='Alpha';titleRow.append(badge);}
    const description=document.createElement('p');description.textContent=game.description;
    const meta=document.createElement('div');meta.className='game-card-meta';
    if(game.rewards.enabled){const reward=document.createElement('span');reward.textContent=`🪙 bis zu ${game.rewards.maxCoinsPerRun}`;meta.append(reward);}
    const score=document.createElement('span');score.textContent=Number.isFinite(Number(stats.bestScore))?`🏆 ${new Intl.NumberFormat('de-AT').format(Number(stats.bestScore))}`:'Noch kein Highscore';meta.append(score);
    if(Number.isFinite(Number(stats.lastScore))){const last=document.createElement('span');last.textContent=`Zuletzt ${new Intl.NumberFormat('de-AT').format(Number(stats.lastScore))}`;meta.append(last);}
    const actions=document.createElement('div');actions.className='game-card-actions';
    if(game.status==='coming_soon'){
      const status=document.createElement('span');status.className='game-status-copy';status.textContent='Bald verfügbar';actions.append(status);
    }else if(canLaunchGame(game)){
      const ready=offlineReady(game);
      const button=document.createElement('button');button.type='button';button.className='game-play-button';button.textContent=ready?'Spielen':'Offline nicht verfügbar';button.disabled=!ready;button.addEventListener('click',()=>onPlay(game));actions.append(button);
    }
    body.append(titleRow,description,meta,actions);card.append(icon,body);container.append(card);
  }
}
