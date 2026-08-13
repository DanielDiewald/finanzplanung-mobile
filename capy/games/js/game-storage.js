const MAX_DATA_BYTES=16*1024;
const MAX_PROCESSED_RUNS=500;

function plain(value){return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function safeScore(value){if(value==null||value==='')return null;const n=Number(value);return Number.isFinite(n)?Math.trunc(n):null;}
function clone(value){return globalThis.structuredClone?structuredClone(value):JSON.parse(JSON.stringify(value));}

export function normalizeGamesState(value){
  const raw=plain(value)?value:{};
  const out={};
  for(const [rawId,rawRecord] of Object.entries(raw).slice(0,200)){
    const id=String(rawId).slice(0,64);if(!/^[a-z0-9](?:[a-z0-9-]{0,62})$/.test(id)||!plain(rawRecord))continue;
    const data=plain(rawRecord.data)?clone(rawRecord.data):{};
    const rewardDays=plain(rawRecord.rewardDays)?Object.fromEntries(Object.entries(rawRecord.rewardDays).slice(-60).map(([day,amount])=>[String(day).slice(0,10),Math.max(0,Math.trunc(Number(amount)||0))])):{};
    out[id]={
      bestScore:safeScore(rawRecord.bestScore),lastScore:safeScore(rawRecord.lastScore),plays:Math.max(0,Math.trunc(Number(rawRecord.plays)||0)),lastPlayedAt:String(rawRecord.lastPlayedAt||''),totalCoinsEarned:Math.max(0,Math.trunc(Number(rawRecord.totalCoinsEarned)||0)),lastRewardAt:String(rawRecord.lastRewardAt||''),
      rewardDays,processedRunIds:Array.isArray(rawRecord.processedRunIds)?[...new Set(rawRecord.processedRunIds.map(String).filter(Boolean))].slice(-MAX_PROCESSED_RUNS):[],data
    };
  }
  return out;
}

export function ensureGameRecord(state,gameId){
  if(!state||typeof state!=='object')throw new Error('Capy-State fehlt.');
  if(!state.games||typeof state.games!=='object'||Array.isArray(state.games))state.games={};
  const id=String(gameId||'');if(!/^[a-z0-9](?:[a-z0-9-]{0,62})$/.test(id))throw new Error('Ungültige Game-ID.');
  if(!state.games[id])state.games[id]={bestScore:null,lastScore:null,plays:0,lastPlayedAt:'',totalCoinsEarned:0,lastRewardAt:'',rewardDays:{},processedRunIds:[],data:{}};
  return state.games[id];
}

function validKey(key){return /^[A-Za-z0-9._-]{1,80}$/.test(String(key||''));}
function validateValue(value){
  let encoded='';try{encoded=JSON.stringify(value);}catch{throw new Error('Game-Daten müssen JSON-kompatibel sein.');}
  if(encoded===undefined)throw new Error('Game-Daten dürfen nicht undefined sein.');
  if(new TextEncoder().encode(encoded).byteLength>MAX_DATA_BYTES)throw new Error('Game-Daten sind zu groß.');
  return clone(value);
}

export function createGameStorage({getState,saveState}){
  if(typeof getState!=='function'||typeof saveState!=='function')throw new Error('Game Storage benötigt State-Adapter.');
  return Object.freeze({
    async get(gameId,key){if(!validKey(key))throw new Error('Ungültiger Storage-Key.');const record=ensureGameRecord(getState(),gameId);return key in record.data?clone(record.data[key]):null;},
    async set(gameId,key,value){if(!validKey(key))throw new Error('Ungültiger Storage-Key.');const record=ensureGameRecord(getState(),gameId);record.data[key]=validateValue(value);await saveState();return clone(record.data[key]);},
    async remove(gameId,key){if(!validKey(key))throw new Error('Ungültiger Storage-Key.');const record=ensureGameRecord(getState(),gameId);delete record.data[key];await saveState();return true;}
  });
}
