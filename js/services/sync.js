import { deepClone, safeCents, uuid } from '../utils.js';

export const FP_VERSION = 1;
export const PREFIX = 'FP1';

const te = new TextEncoder(), td = new TextDecoder();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i=0;i<bytes.length;i++) {
    crc ^= bytes[i];
    for (let j=0;j<8;j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
export function crcHex(bytes) { return crc32(bytes).toString(16).toUpperCase().padStart(8,'0'); }
export function bytesToBase64Url(bytes) {
  let binary=''; const chunk=0x8000;
  for (let i=0;i<bytes.length;i+=chunk) binary += String.fromCharCode(...bytes.subarray(i,i+chunk));
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export function base64UrlToBytes(text) {
  const base64=String(text).replace(/-/g,'+').replace(/_/g,'/') + '='.repeat((4-String(text).length%4)%4);
  let binary; try { binary=atob(base64); } catch { throw new Error('FP1-Code enthält ungültige Base64URL-Daten.'); }
  const out=new Uint8Array(binary.length); for(let i=0;i<binary.length;i++) out[i]=binary.charCodeAt(i); return out;
}
async function streamTransform(bytes, format, operation) {
  const Ctor = operation==='compress' ? globalThis.CompressionStream : globalThis.DecompressionStream;
  if (!Ctor) throw new Error(`${operation==='compress'?'Komprimierung':'Dekomprimierung'} wird von diesem Browser nicht unterstützt.`);
  const stream = new Blob([bytes]).stream().pipeThrough(new Ctor(format));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
export async function compressBytes(bytes) { return streamTransform(bytes,'deflate','compress'); }
export async function decompressBytes(bytes) { return streamTransform(bytes,'deflate','decompress'); }

function canonicalStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonicalStringify(value[k])}`).join(',')}}`;
}

function compactDonutForTransport(d={}) {
  return [String(d.title||''),String(d.centerLabel||''),String(d.centerSubtext||''),Number(d.totalCents)||0,(Array.isArray(d.segments)?d.segments:[]).map(s=>[String(s.key||''),String(s.label||''),Number(s.amountCents)||0,String(s.group||'cost'),String(s.color||''),(Array.isArray(s.details)?s.details:[]).map(x=>[String(x.label||''),Number(x.amountCents)||0])])];
}
function expandDonutFromTransport(a=[], mode='planned') {
  return {mode,title:a[0]||'',centerLabel:a[1]||'',centerSubtext:a[2]||'',totalCents:a[3]||0,segments:(Array.isArray(a[4])?a[4]:[]).map(s=>({key:s[0]||'',label:s[1]||'',amountCents:s[2]||0,group:s[3]||'cost',color:s[4]||'',details:(Array.isArray(s[5])?s[5]:[]).map(d=>({label:d[0]||'',amountCents:d[1]||0}))}))};
}
function compactPayloadForTransport(type,payload) {
  if(type==='P') return {
    v:1,t:'P',p:payload.planId,n:payload.planName||'',r:payload.revision,m:payload.month,c:payload.createdAt,
    s:[payload.source?.app||'',payload.source?.dataVersion??null],
    a:payload.accountBalanceCents,q:payload.normalBalanceCents,f:payload.freeAvailableCents,x:payload.minimumCashBufferCents,
    b:payload.budgetAssetsCents,y:payload.savingsAssetsCents,z:payload.totalAssetsCents,
    B:(payload.budgets||[]).map(b=>[b.id,b.name,b.category,b.interval||'',b.plannedCents,b.reserveCents,b.spentCents,b.availableCents,b.color||'']),
    G:(payload.savingsGoals||[]).map(g=>[g.id,g.name,g.balanceCents,g.targetCents]),
    D:[compactDonutForTransport(payload.donuts?.planned),compactDonutForTransport(payload.donuts?.actual)],
    A:(payload.acknowledgedTransactions||[]).map(a=>[a.id,a.recordRevision]),
    I:payload.acknowledgedTransactionIds||[],E:payload.acknowledgedExportIds||[],L:payload.lastSync??null
  };
  return {
    v:1,t:'T',p:payload.planId,b:payload.basePlanRevision,m:payload.month,e:payload.exportId,g:payload.generatedAt,d:payload.deviceId,n:payload.deviceName||'',
    T:(payload.transactions||[]).map(x=>[x.id,x.recordRevision,x.op,x.createdAt,x.updatedAt,x.date,x.month,x.kind,x.amountCents,x.budgetId||'',x.category,x.description||'',x.note||''])
  };
}
function expandCompactPayload(type,x) {
  if(!x||typeof x!=='object'||Array.isArray(x)) throw new Error('Kompakte FP1-Nutzdaten sind ungültig.');
  if(type==='P') return {
    protocolVersion:x.v,type:'P',planId:x.p,planName:x.n||'',revision:x.r,month:x.m,createdAt:x.c,source:{app:x.s?.[0]||'',dataVersion:x.s?.[1]??null},
    accountBalanceCents:x.a,normalBalanceCents:x.q,freeAvailableCents:x.f,minimumCashBufferCents:x.x,budgetAssetsCents:x.b,savingsAssetsCents:x.y,totalAssetsCents:x.z,
    budgets:(Array.isArray(x.B)?x.B:[]).map(b=>({id:b[0],name:b[1],category:b[2],interval:b[3]||'monthly',plannedCents:b[4],reserveCents:b[5],spentCents:b[6],availableCents:b[7],color:b[8]||''})),
    savingsGoals:(Array.isArray(x.G)?x.G:[]).map(g=>({id:g[0],name:g[1],balanceCents:g[2],targetCents:g[3]})),
    donuts:{planned:expandDonutFromTransport(x.D?.[0]||[],'planned'),actual:expandDonutFromTransport(x.D?.[1]||[],'actual')},
    acknowledgedTransactions:(Array.isArray(x.A)?x.A:[]).map(a=>({id:a[0],recordRevision:a[1]})),acknowledgedTransactionIds:Array.isArray(x.I)?x.I:[],acknowledgedExportIds:Array.isArray(x.E)?x.E:[],lastSync:x.L??null
  };
  return {
    protocolVersion:x.v,type:'T',planId:x.p,basePlanRevision:x.b,month:x.m,exportId:x.e,generatedAt:x.g,deviceId:x.d,deviceName:x.n||'',
    transactions:(Array.isArray(x.T)?x.T:[]).map(t=>({id:t[0],recordRevision:t[1],op:t[2],createdAt:t[3],updatedAt:t[4],date:t[5],month:t[6],kind:t[7],amountCents:t[8],budgetId:t[9]||'',category:t[10],description:t[11]||'',note:t[12]||''}))
  };
}

export async function encodeFP1(type, payload, { forceEncoding='' }={}) {
  if (!['P','T'].includes(type)) throw new Error('Unbekannter FP1-Code-Typ.');
  const normalized={...deepClone(payload),protocolVersion:FP_VERSION,type};
  let encoding=forceEncoding || (globalThis.CompressionStream ? 'C' : 'N');
  let transport=normalized;
  if(encoding==='C') transport=compactPayloadForTransport(type,normalized);
  const raw=te.encode(canonicalStringify(transport));
  let body;
  if (encoding==='C'||encoding==='Z') body=await compressBytes(raw); else if (encoding==='N') body=raw; else throw new Error('Unbekannte FP1-Kodierung.');
  return `${PREFIX}-${type}-${encoding}-${crcHex(body)}-${bytesToBase64Url(body)}`;
}

export function inspectCodePrefix(code) {
  const cleaned=String(code||'').trim().replace(/\s+/g,''); const parts=cleaned.split('-');
  if (parts.length < 5) throw new Error('Kein vollständiger FP1-Code.');
  const [prefix,type,encoding,checksum,...rest]=parts;
  if (prefix !== PREFIX) { if (/^FP\d+$/.test(prefix)) throw new Error(`Nicht unterstützte Protokollversion: ${prefix}.`); throw new Error('Ungültiges Synchronisationspräfix.'); }
  if (!['P','T'].includes(type)) throw new Error(`Unbekannter FP1-Code-Typ: ${type || '–'}.`);
  if (!['C','Z','N'].includes(encoding)) throw new Error(`Unbekannte FP1-Kodierung: ${encoding || '–'}.`);
  if (!/^[0-9A-Fa-f]{8}$/.test(checksum)) throw new Error('Ungültige FP1-Prüfsumme.');
  return { cleaned,prefix,type,encoding,checksum:checksum.toUpperCase(),payloadText:rest.join('-') };
}

export async function decodeFP1(code, { expectedType='' }={}) {
  const header=inspectCodePrefix(code); if (expectedType && header.type!==expectedType) throw new Error(`Falscher Code-Typ. Erwartet: FP1-${expectedType}.`);
  const body=base64UrlToBytes(header.payloadText); if (crcHex(body)!==header.checksum) throw new Error('Prüfsummenfehler: Der Synchronisationscode ist beschädigt oder unvollständig.');
  let raw; try { raw=(header.encoding==='C'||header.encoding==='Z')?await decompressBytes(body):body; } catch (err) { throw new Error(`FP1-Daten konnten nicht dekomprimiert werden: ${err.message}`); }
  let payload; try { payload=JSON.parse(td.decode(raw)); } catch { throw new Error('FP1-Nutzdaten sind kein gültiges JSON.'); }
  if(header.encoding==='C') payload=expandCompactPayload(header.type,payload);
  if (payload.protocolVersion!==FP_VERSION) throw new Error(`Nicht unterstützte interne Protokollversion: ${payload.protocolVersion}.`);
  if (payload.type!==header.type) throw new Error('Code-Typ und Nutzdaten-Typ stimmen nicht überein.');
  return header.type==='P' ? validatePlanPayload(payload) : validateTransactionPayload(payload);
}

function str(value,name,{required=true,max=500}={}) { const s=String(value??'').trim(); if(required&&!s) throw new Error(`${name} fehlt.`); if(s.length>max) throw new Error(`${name} ist zu lang.`); return s; }
function int(value,name,{min=0,max=Number.MAX_SAFE_INTEGER}={}) { const n=Number(value); if(!Number.isSafeInteger(n)||n<min||n>max) throw new Error(`${name} ist ungültig.`); return n; }
function cents(value,name,{allowNegative=true}={}) { try { return safeCents(value,{allowNegative}); } catch { throw new Error(`${name} ist kein gültiger Cent-Betrag.`); } }
function iso(value,name) { const s=str(value,name); if(Number.isNaN(Date.parse(s))) throw new Error(`${name} ist kein gültiger ISO-Zeitpunkt.`); return s; }
function month(value,name='Monat') { const s=str(value,name); if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(s)) throw new Error(`${name} ist ungültig.`); return s; }
function day(value,name='Datum') { const s=str(value,name); if(!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(s)||Number.isNaN(Date.parse(`${s}T00:00:00`))) throw new Error(`${name} ist ungültig.`); return s; }

function normalizeDetails(details=[]) { if(!Array.isArray(details)) return []; return details.slice(0,500).map((d,i)=>({ label:str(d?.label||`Position ${i+1}`,'Detailbezeichnung',{max:160}), amountCents:cents(d?.amountCents??0,'Detailbetrag',{allowNegative:false}) })).filter(x=>x.amountCents>0); }
function normalizeSegments(segments=[]) {
  if(!Array.isArray(segments)) throw new Error('Donut-Segmente müssen eine Liste sein.');
  return segments.slice(0,100).map((s,i)=>({ key:str(s?.key||`segment-${i+1}`,'Segment-ID',{max:80}), label:str(s?.label||'Segment','Segmentname',{max:120}), amountCents:cents(s?.amountCents??0,'Segmentbetrag',{allowNegative:false}), group:['cost','reserve','saving','available'].includes(s?.group)?s.group:'cost', color:/^#[0-9a-f]{6}$/i.test(String(s?.color||''))?String(s.color):'#4c86af', details:normalizeDetails(s?.details) })).filter(x=>x.amountCents>0);
}
function normalizeDonut(d, mode) {
  const x=d&&typeof d==='object'?d:{}; const segments=normalizeSegments(x.segments||[]); const totalCalc=segments.reduce((s,v)=>s+v.amountCents,0);
  return { mode, title:str(x.title|| (mode==='planned'?'Geplante Geldverwendung':'Nur tatsächliche Ausgaben'),'Donut-Titel',{max:160}), centerLabel:str(x.centerLabel|| (mode==='planned'?'Geplant':'Ausgaben'),'Donut-Mitte',{max:80}), centerSubtext:str(x.centerSubtext||'','Donut-Hinweis',{required:false,max:160}), totalCents:x.totalCents==null?totalCalc:cents(x.totalCents,'Donut-Summe',{allowNegative:false}), segments };
}

export function validatePlanPayload(input) {
  if (!input || typeof input!=='object' || Array.isArray(input)) throw new Error('PLAN-CODE enthält kein Objekt.');
  const planId=str(input.planId,'Plan-ID',{max:120}), revision=int(input.revision,'Sync-Revision',{min:0}), ym=month(input.month), createdAt=iso(input.createdAt,'Erstellungszeitpunkt');
  if(!Array.isArray(input.budgets)) throw new Error('Budgetliste fehlt.');
  const seen=new Set();
  const budgets=input.budgets.slice(0,500).map((b,i)=>{
    const id=str(b?.id,`Budget-ID ${i+1}`,{max:160}); if(seen.has(id)) throw new Error(`Doppelte Budget-ID im Plan: ${id}.`); seen.add(id);
    return { id, name:str(b?.name||b?.description||`Budget ${i+1}`,'Budgetname',{max:120}), category:str(b?.category||'Sonstiges','Budgetkategorie',{max:120}), plannedCents:cents(b?.plannedCents??0,'Planbetrag',{allowNegative:false}), reserveCents:cents(b?.reserveCents??0,'Budgetrücklage',{allowNegative:false}), spentCents:cents(b?.spentCents??0,'Budgetverbrauch',{allowNegative:false}), availableCents:cents(b?.availableCents??0,'Budget verfügbar',{allowNegative:true}), color:/^#[0-9a-f]{6}$/i.test(String(b?.color||''))?String(b.color):'' };
  });
  const goals=Array.isArray(input.savingsGoals)?input.savingsGoals.slice(0,200).map((g,i)=>({id:str(g?.id||`goal-${i+1}`,'Sparziel-ID',{max:160}),name:str(g?.name||'Sparziel','Sparzielname',{max:120}),balanceCents:cents(g?.balanceCents??0,'Sparziel-Stand',{allowNegative:false}),targetCents:cents(g?.targetCents??0,'Sparziel-Ziel',{allowNegative:false})})):[];
  const accountBalanceCents=input.accountBalanceCents==null?null:cents(input.accountBalanceCents,'Kontostand');
  return { ...deepClone(input), protocolVersion:FP_VERSION,type:'P',planId,revision,month:ym,createdAt,
    source:input.source&&typeof input.source==='object'?deepClone(input.source):{},
    accountBalanceCents, normalBalanceCents:cents(input.normalBalanceCents??accountBalanceCents??0,'Normales Guthaben'), freeAvailableCents:cents(input.freeAvailableCents??0,'Frei verfügbar'), minimumCashBufferCents:cents(input.minimumCashBufferCents??0,'Mindestpuffer',{allowNegative:false}), budgetAssetsCents:cents(input.budgetAssetsCents??budgets.reduce((s,b)=>s+b.availableCents,0),'Budgetvermögen'), savingsAssetsCents:cents(input.savingsAssetsCents??0,'Sparvermögen',{allowNegative:false}), totalAssetsCents:cents(input.totalAssetsCents??0,'Gesamtvermögen'), budgets, savingsGoals:goals,
    donuts:{ planned:normalizeDonut(input.donuts?.planned||{},'planned'), actual:normalizeDonut(input.donuts?.actual||{},'actual') },
    acknowledgedTransactions:Array.isArray(input.acknowledgedTransactions)?input.acknowledgedTransactions.slice(0,5000).map(x=>({id:str(x?.id,'Bestätigte Transaktions-ID',{max:160}),recordRevision:int(x?.recordRevision??1,'Bestätigte Buchungsrevision',{min:1,max:1000000})})):[], acknowledgedTransactionIds:Array.isArray(input.acknowledgedTransactionIds)?[...new Set(input.acknowledgedTransactionIds.map(x=>String(x)).filter(Boolean))].slice(0,5000):[], acknowledgedExportIds:Array.isArray(input.acknowledgedExportIds)?[...new Set(input.acknowledgedExportIds.map(x=>String(x)).filter(Boolean))].slice(0,1000):[], lastSync:input.lastSync&&typeof input.lastSync==='object'?deepClone(input.lastSync):null };
}

export function validateMobileTransaction(t,index=0) {
  if(!t||typeof t!=='object') throw new Error(`Buchung ${index+1} ist ungültig.`); const kind=str(t.kind,'Buchungsart',{max:40}); if(!['budget_expense','expense','income'].includes(kind)) throw new Error(`Unbekannte Buchungsart: ${kind}.`);
  const amountCents=cents(t.amountCents,'Betrag',{allowNegative:false}); if(amountCents<=0) throw new Error('Betrag muss größer als 0 sein.'); const date=day(t.date); const m=month(t.month||date.slice(0,7)); if(m!==date.slice(0,7)) throw new Error('Buchungsmonat und Datum stimmen nicht überein.');
  const op=t.op==='delete'?'delete':'upsert'; const recordRevision=int(t.recordRevision??1,'Buchungsrevision',{min:1,max:1000000});
  return { id:str(t.id,'Transaktions-ID',{max:160}),recordRevision,op,createdAt:iso(t.createdAt,'Erfassungszeitpunkt'),updatedAt:iso(t.updatedAt||t.createdAt,'Änderungszeitpunkt'),date,month:m,kind,amountCents,budgetId:kind==='budget_expense'?str(t.budgetId,'Budget-ID',{max:160}):'',category:str(t.category||'Sonstiges','Kategorie',{max:120}),description:str(t.description||'','Beschreibung',{required:false,max:100}),note:str(t.note||'','Notiz',{required:false,max:300}) };
}
export function validateTransactionPayload(input) {
  if(!input||typeof input!=='object'||Array.isArray(input)) throw new Error('TRANSAKTIONS-CODE enthält kein Objekt.'); if(!Array.isArray(input.transactions)) throw new Error('Transaktionsliste fehlt.');
  const rows=input.transactions.map(validateMobileTransaction); const ids=new Set(); for(const row of rows){ if(ids.has(row.id)) throw new Error(`Doppelte Transaktions-ID im Code: ${row.id}.`); ids.add(row.id); }
  return { ...deepClone(input),protocolVersion:FP_VERSION,type:'T',planId:str(input.planId,'Plan-ID',{max:120}),basePlanRevision:int(input.basePlanRevision,'Basis-Revision',{min:0}),month:month(input.month),exportId:str(input.exportId||uuid(),'Export-ID',{max:160}),generatedAt:iso(input.generatedAt,'Exportzeitpunkt'),deviceId:str(input.deviceId,'Geräte-ID',{max:160}),deviceName:str(input.deviceName||'','Gerätename',{required:false,max:60}),transactions:rows };
}

export function buildTransactionPayload({plan,transactions,settings,exportId=uuid()}) {
  if(!plan) throw new Error('Kein Plan vorhanden.'); if(!transactions?.length) throw new Error('Keine nicht bestätigten Buchungen vorhanden.');
  return validateTransactionPayload({ protocolVersion:1,type:'T',planId:plan.planId,basePlanRevision:plan.revision,month:plan.month,exportId,generatedAt:new Date().toISOString(),deviceId:settings.deviceId,deviceName:settings.deviceName||'',transactions:transactions.map(t=>({id:t.id,recordRevision:t.recordRevision||1,op:t.deleted?'delete':'upsert',createdAt:t.createdAt,updatedAt:t.updatedAt,date:t.date,month:t.month,kind:t.kind,amountCents:t.amountCents,budgetId:t.budgetId||'',category:t.category,description:t.description||'',note:t.note||''})) });
}

export function dedupeTransactionImport(existingIds, payload) {
  const known=new Set([...existingIds].map(String)); const fresh=[],duplicates=[];
  for(const tx of payload.transactions){ if(known.has(tx.id)) duplicates.push(tx); else { known.add(tx.id); fresh.push(tx); } }
  return { fresh,duplicates };
}
