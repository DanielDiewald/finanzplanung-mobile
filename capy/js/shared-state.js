import { deepClone, uuid } from '../../js/utils.js';
import { getMeta, setMeta } from '../../js/services/storage.js';

export const CAPY_META_KEY = 'capyState';
export const CAPY_STATE_VERSION = 1;

function initialCare(initialNeeds={}) {
  return {
    initialized: false,
    name: '',
    gender: '',
    hunger: Number(initialNeeds.hunger ?? 64),
    happiness: Number(initialNeeds.happiness ?? 76),
    energy: Number(initialNeeds.energy ?? 82),
    bond: Number(initialNeeds.bond ?? 18),
    inventory: {},
    journal: [],
    lastUpdate: Date.now(),
    updatedAt: new Date().toISOString()
  };
}

export function defaultCapyState(initialNeeds={}) {
  return {
    version: CAPY_STATE_VERSION,
    enabled: false,
    budgetId: '',
    baseCoins: 0,
    coinOps: [],
    care: initialCare(initialNeeds),
    careDirty: false,
    preparedExportIds: []
  };
}

export function normalizeCapyState(value, initialNeeds={}) {
  const fallback=defaultCapyState(initialNeeds);
  const raw=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const careRaw=raw.care&&typeof raw.care==='object'&&!Array.isArray(raw.care)?raw.care:{};
  const inventory=careRaw.inventory&&typeof careRaw.inventory==='object'&&!Array.isArray(careRaw.inventory)?careRaw.inventory:{};
  const journal=Array.isArray(careRaw.journal)?careRaw.journal.slice(0,120):[];
  return {
    version: CAPY_STATE_VERSION,
    enabled: Boolean(raw.enabled),
    budgetId: String(raw.budgetId||''),
    baseCoins: Math.max(0, Math.floor(Number(raw.baseCoins)||0)),
    coinOps: Array.isArray(raw.coinOps) ? raw.coinOps.slice(0,1000).map(op=>({
      id:String(op?.id||uuid()),
      delta:Math.trunc(Number(op?.delta)||0),
      reason:String(op?.reason||''),
      relatedTransactionId:String(op?.relatedTransactionId||''),
      createdAt:String(op?.createdAt||new Date().toISOString())
    })).filter(op=>op.delta!==0) : [],
    care: {
      ...fallback.care,
      ...deepClone(careRaw),
      initialized:Boolean(careRaw.initialized),
      name:String(careRaw.name||'').slice(0,20),
      gender:String(careRaw.gender||''),
      hunger:clamp(careRaw.hunger ?? fallback.care.hunger),
      happiness:clamp(careRaw.happiness ?? fallback.care.happiness),
      energy:clamp(careRaw.energy ?? fallback.care.energy),
      bond:clamp(careRaw.bond ?? fallback.care.bond),
      inventory:Object.fromEntries(Object.entries(inventory).map(([id,count])=>[String(id),Math.max(0,Math.floor(Number(count)||0))])),
      journal,
      lastUpdate:Number(careRaw.lastUpdate)||Date.now(),
      updatedAt:String(careRaw.updatedAt||new Date().toISOString())
    },
    careDirty:Boolean(raw.careDirty),
    preparedExportIds:Array.isArray(raw.preparedExportIds)?[...new Set(raw.preparedExportIds.map(String).filter(Boolean))].slice(-100):[]
  };
}

export async function loadCapyState(initialNeeds={}) {
  return normalizeCapyState(await getMeta(CAPY_META_KEY,null),initialNeeds);
}

export async function saveCapyState(state) {
  const normalized=normalizeCapyState(state);
  await setMeta(CAPY_META_KEY,normalized);
  return normalized;
}

export function availableCoins(state) {
  const base=Math.max(0,Math.floor(Number(state?.baseCoins)||0));
  const pending=(state?.coinOps||[]).reduce((sum,op)=>sum+Math.trunc(Number(op?.delta)||0),0);
  return Math.max(0,base+pending);
}

export function queueCoinOp(state, delta, reason='', relatedTransactionId='') {
  const amount=Math.trunc(Number(delta)||0);
  if(!amount)return null;
  const op={id:uuid(),delta:amount,reason:String(reason||''),relatedTransactionId:String(relatedTransactionId||''),createdAt:new Date().toISOString()};
  state.coinOps=[...(state.coinOps||[]),op];
  state.careDirty=true;
  return op;
}

export function touchCare(state) {
  state.care.updatedAt=new Date().toISOString();
  state.careDirty=true;
  return state;
}

export function buildCapySyncPayload(state) {
  if(!state)return null;
  const care=deepClone(state.care||{});
  delete care.journal;
  return {
    version:1,
    enabled:Boolean(state.enabled),
    budgetId:String(state.budgetId||''),
    coinOps:(state.coinOps||[]).map(op=>({id:String(op.id),delta:Math.trunc(Number(op.delta)||0),reason:String(op.reason||''),relatedTransactionId:String(op.relatedTransactionId||''),createdAt:String(op.createdAt||new Date().toISOString())})),
    care
  };
}

export function capyHasPendingSync(state) {
  return Boolean(state?.careDirty || (state?.coinOps||[]).length);
}

export function markCapyPrepared(state, exportId) {
  if(!state||!exportId)return state;
  state.preparedExportIds=[...new Set([...(state.preparedExportIds||[]),String(exportId)])].slice(-100);
  return state;
}

export function applyRemoteCapy(state, remoteCapy, acknowledgedExportIds=[]) {
  const local=normalizeCapyState(state);
  const remote=remoteCapy&&typeof remoteCapy==='object'?remoteCapy:{};
  local.enabled=Boolean(remote.enabled);
  local.budgetId=String(remote.budgetId||local.budgetId||'');

  const ackCoinOps=new Set((remote.acknowledgedCoinOpIds||[]).map(String));
  local.coinOps=(local.coinOps||[]).filter(op=>!ackCoinOps.has(String(op.id)));
  local.baseCoins=Math.max(0,Math.floor(Number(remote.coins)||0));

  const exportAckSet=new Set((acknowledgedExportIds||[]).map(String));
  const careWasAcknowledged=(local.preparedExportIds||[]).some(id=>exportAckSet.has(String(id)));
  if(careWasAcknowledged){
    local.careDirty=false;
    local.preparedExportIds=[];
  }

  const remoteCare=remote.care&&typeof remote.care==='object'?remote.care:null;
  const remoteUpdated=remoteCare?.updatedAt ? Date.parse(remoteCare.updatedAt) : 0;
  const localUpdated=local.care?.updatedAt ? Date.parse(local.care.updatedAt) : 0;
  if(remoteCare && (!local.care.initialized || (!local.careDirty && remoteUpdated>=localUpdated))){
    const journal=local.care.journal||[];
    local.care={...local.care,...deepClone(remoteCare),journal};
  }
  return normalizeCapyState(local);
}

export function addJournal(state,type,text,maxEntries=80){
  const entry={id:uuid(),type:String(type||'event'),text:String(text||''),time:new Intl.DateTimeFormat('de-AT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date())};
  state.care.journal=[entry,...(state.care.journal||[])].slice(0,Math.max(1,Number(maxEntries)||80));
  return entry;
}

export function clamp(value){return Math.max(0,Math.min(100,Number(value)||0));}
