import { DB_NAME, DB_VERSION, deepClone, uuid } from '../utils.js';

let dbPromise;
function req(request) { return new Promise((resolve,reject)=>{ request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error); }); }
function txDone(tx) { return new Promise((resolve,reject)=>{ tx.oncomplete=()=>resolve(); tx.onabort=()=>reject(tx.error || new Error('IndexedDB-Transaktion abgebrochen.')); tx.onerror=()=>reject(tx.error); }); }

export function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve,reject)=>{
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('plans')) db.createObjectStore('plans', { keyPath:'planId' });
      if (!db.objectStoreNames.contains('transactions')) {
        const s = db.createObjectStore('transactions', { keyPath:'id' });
        s.createIndex('planId','planId',{unique:false}); s.createIndex('month','month',{unique:false}); s.createIndex('status','status',{unique:false}); s.createIndex('date','date',{unique:false});
      }
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath:'key' });
      if (!db.objectStoreNames.contains('syncHistory')) {
        const s = db.createObjectStore('syncHistory', { keyPath:'id' }); s.createIndex('planId','planId',{unique:false}); s.createIndex('createdAt','createdAt',{unique:false});
      }
    };
    r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); r.onblocked=()=>reject(new Error('IndexedDB ist durch einen anderen Tab blockiert.'));
  });
  return dbPromise;
}

async function store(name, mode='readonly') { const db=await openDatabase(); const tx=db.transaction(name,mode); return { tx, store:tx.objectStore(name) }; }
export async function getMeta(key, fallback=null) { const {store:s}=await store('meta'); const row=await req(s.get(key)); return row ? row.value : fallback; }
export async function setMeta(key,value) { const {tx,store:s}=await store('meta','readwrite'); s.put({key,value}); await txDone(tx); return value; }
const MONTH_VISUAL_DEFAULT_VERSION = 2;

export async function getSettings() {
  let settings = await getMeta('settings', null);
  if (!settings) {
    settings={ deviceId:uuid(), deviceName:'', theme:'system', selectedMonthVisualMode:'donut', monthVisualDefaultVersion:MONTH_VISUAL_DEFAULT_VERSION, selectedDonutMode:'planned' };
    await setMeta('settings',settings);
  }
  const needsVisualDefaultMigration = Number(settings.monthVisualDefaultVersion || 0) < MONTH_VISUAL_DEFAULT_VERSION;
  const selectedMonthVisualMode = needsVisualDefaultMigration
    ? 'donut'
    : (['buffer','donut'].includes(settings.selectedMonthVisualMode) ? settings.selectedMonthVisualMode : 'donut');
  const normalized = { deviceId:settings.deviceId || uuid(), deviceName:String(settings.deviceName||''), theme:['system','light','dark'].includes(settings.theme)?settings.theme:'system', selectedMonthVisualMode, monthVisualDefaultVersion:MONTH_VISUAL_DEFAULT_VERSION, selectedDonutMode:['planned','actual','available'].includes(settings.selectedDonutMode)?settings.selectedDonutMode:'planned' };
  if (needsVisualDefaultMigration || settings.selectedMonthVisualMode !== selectedMonthVisualMode) await setMeta('settings',{...settings,...normalized});
  return normalized;
}
export async function saveSettings(patch) { const current=await getSettings(); const next={...current,...deepClone(patch)}; if (!next.deviceId) next.deviceId=uuid(); await setMeta('settings',next); return next; }

export async function savePlan(plan) {
  const db=await openDatabase(); const tx=db.transaction(['plans','meta'],'readwrite'); tx.objectStore('plans').put(deepClone(plan)); tx.objectStore('meta').put({key:'currentPlanId',value:plan.planId}); await txDone(tx); return plan;
}
export async function getPlan(planId) { if (!planId) return null; const {store:s}=await store('plans'); return (await req(s.get(planId))) || null; }
export async function getCurrentPlan() { const planId=await getMeta('currentPlanId',''); return planId ? getPlan(planId) : null; }
export async function listPlans() { const {store:s}=await store('plans'); return await req(s.getAll()); }

export async function saveTransaction(transaction) { const {tx,store:s}=await store('transactions','readwrite'); s.put(deepClone(transaction)); await txDone(tx); return transaction; }
export async function getTransaction(id) { const {store:s}=await store('transactions'); return (await req(s.get(id))) || null; }
export async function deleteTransaction(id) { const {tx,store:s}=await store('transactions','readwrite'); s.delete(id); await txDone(tx); }
export async function listTransactions({planId='',month='',status=''}={}) {
  const {store:s}=await store('transactions'); let rows;
  if (planId) rows=await req(s.index('planId').getAll(planId)); else rows=await req(s.getAll());
  if (month) rows=rows.filter(x=>x.month===month); if (status) rows=rows.filter(x=>x.status===status);
  return rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)) || String(b.createdAt).localeCompare(String(a.createdAt)));
}
export async function putManyTransactions(rows) { if (!rows.length) return; const {tx,store:s}=await store('transactions','readwrite'); rows.forEach(x=>s.put(deepClone(x))); await txDone(tx); }

export async function addSyncHistory(entry) { const row={...deepClone(entry),id:entry.id||uuid(),createdAt:entry.createdAt||new Date().toISOString()}; const {tx,store:s}=await store('syncHistory','readwrite'); s.put(row); await txDone(tx); return row; }
export async function listSyncHistory(planId='') { const {store:s}=await store('syncHistory'); const rows=planId?await req(s.index('planId').getAll(planId)):await req(s.getAll()); return rows.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))); }

export async function markAcknowledged(plan) {
  const rows=await listTransactions({planId:plan.planId});
  const txIds=new Set((plan.acknowledgedTransactionIds||[]).map(String)); const exact=new Set((plan.acknowledgedTransactions||[]).map(x=>`${String(x.id)}@${Number(x.recordRevision)||1}`)); const exportIds=new Set((plan.acknowledgedExportIds||[]).map(String));
  let changed=0;
  for (const row of rows) {
    if (row.status==='confirmed') continue;
    const prepared=Array.isArray(row.preparedExportIds)?row.preparedExportIds:[];
    if (exact.has(`${row.id}@${row.recordRevision||1}`) || ((row.recordRevision||1)===1 && txIds.has(row.id)) || prepared.some(id=>exportIds.has(id))) { row.status='confirmed'; row.confirmedAt=plan.createdAt||new Date().toISOString(); changed++; }
  }
  if (changed) await putManyTransactions(rows.filter(r=>r.status==='confirmed'));
  return changed;
}

export async function exportAllData() {
  return { format:'finanzplanung-mobile-backup', version:1, exportedAt:new Date().toISOString(), currentPlanId:await getMeta('currentPlanId',''), settings:await getSettings(), capyState:await getMeta('capyState',null), plans:await listPlans(), transactions:await listTransactions(), syncHistory:await listSyncHistory() };
}
export async function resetAllData() {
  const db=await openDatabase(); const tx=db.transaction(['plans','transactions','meta','syncHistory'],'readwrite');
  for (const n of ['plans','transactions','meta','syncHistory']) tx.objectStore(n).clear(); await txDone(tx); db.close(); dbPromise=null;
}
