import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { TextDecoder, TextEncoder } from 'node:util';
import { buildTransactionPayload, decodeFP1, encodeFP1 } from '../js/services/sync.js';
import { webcrypto } from 'node:crypto';

const addon=fs.readFileSync(new URL('../desktop-integration/mobile-sync-addon.js',import.meta.url),'utf8');

function makeContext(){
  const state={
    meta:{mobileSync:{planId:'plan-1',revision:4,importedTransactions:{},acknowledgedExportIds:[]}},
    months:{
      '2026-08':{locked:false,budgetUsage:{},budgetUsageConfirmed:false,incomes:[],expenses:[]},
      '2026-07':{locked:true,budgetUsage:{},budgetUsageConfirmed:true,incomes:[],expenses:[]}
    },
    savingsGoals:[]
  };
  const budgets=[{id:'budget-food',description:'Lebensmittel',category:'Lebensmittel',amount:350,interval:'monthly'}];
  const ctx={
    console, TextEncoder, TextDecoder, crypto:webcrypto,
    btoa:s=>Buffer.from(s,'binary').toString('base64'),
    atob:s=>Buffer.from(s,'base64').toString('binary'),
    __FP1_ENABLE_TEST_HOOKS__:true,
    state,
    document:{getElementById(){return null;}},
    isPlainObject:x=>Boolean(x)&&typeof x==='object'&&!Array.isArray(x),
    deepClone:x=>structuredClone(x),
    asNumber:x=>Number.isFinite(Number(x))?Number(x):0,
    roundMoney:x=>Math.round((Number(x)+Number.EPSILON)*100)/100,
    allBudgetItems:()=>budgets,
    saveState:()=>{}, renderAll:()=>{},
    currentResults:()=>({'2026-08':{actualBankBalance:4500,effectiveEndingBalance:2200,freeAvailable:1700,minimumCashBuffer:500,budgetClosingTotal:1000,savingsAssetsTotal:1200,totalAssets:4400,budgetDetails:{'budget-food':{reserve:350,spent:128.4,closingBalance:221.6}},goalBalancesAfter:{}}}), buildMonthAllocationData:()=>({title:'Geplante Geldverwendung',centerLabel:'Geplant',centerSubtext:'',total:350,segments:[{key:'reserves',label:'Budgetrücklagen',amount:350,group:'reserve',color:'#8a5a00',details:[{label:'Lebensmittel',amount:350}]}]}), buildMonthExpenseData:()=>({title:'Nur tatsächliche Ausgaben',centerLabel:'Ausgaben',centerSubtext:'',total:128.4,segments:[{key:'budgetSpent',label:'Budgetverbrauch',amount:128.4,group:'cost',color:'#b7791f',details:[{label:'Lebensmittel',amount:128.4}]}]}),
    selectedMonth:'2026-08', isValidMonth:()=>true, ensurePlanningThrough:()=>{}, planningMonths:()=>['2026-08'], monthName:x=>x,
    compareMonths:(a,b)=>a.localeCompare(b), CURRENT_DATA_VERSION:10, money:x=>String(x)
  };
  ctx.globalThis=ctx;
  vm.runInNewContext(addon,ctx,{filename:'mobile-sync-addon.js'});
  return {ctx,state,api:ctx.__FP1_DESKTOP_TEST_API__};
}

function tx(overrides={}){
  return {id:'tx-1',recordRevision:1,op:'upsert',createdAt:'2026-08-11T17:00:00.000Z',updatedAt:'2026-08-11T17:00:00.000Z',date:'2026-08-11',month:'2026-08',kind:'budget_expense',amountCents:2990,budgetId:'budget-food',category:'Lebensmittel',description:'Billa',note:'',...overrides};
}

function payload(transactions){return {planId:'plan-1',basePlanRevision:3,month:'2026-08',transactions};}

test('Desktop-Addon klassifiziert neue, doppelte und aktualisierte Buchungsrevisionen',()=>{
  const {api,state}=makeContext();
  let rows=api.fp1Classification(payload([tx()]));
  assert.equal(rows[0].status,'new');
  api.fp1ApplyOne(rows[0].tx);
  assert.equal(state.months['2026-08'].budgetUsage['budget-food'],29.9);

  rows=api.fp1Classification(payload([tx()]));
  assert.equal(rows[0].status,'duplicate');

  rows=api.fp1Classification(payload([tx({recordRevision:2,amountCents:3990})]));
  assert.equal(rows[0].status,'update');
  api.fp1ApplyOne(rows[0].tx);
  assert.equal(state.months['2026-08'].budgetUsage['budget-food'],39.9);
});

test('Desktop-Addon kann eine bereits importierte Revision per Tombstone rückgängig machen',()=>{
  const {api,state}=makeContext();
  api.fp1ApplyOne(tx());
  const deletion=tx({recordRevision:2,op:'delete'});
  const row=api.fp1Classification(payload([deletion]))[0];
  assert.equal(row.status,'update');
  api.fp1ApplyOne(row.tx);
  assert.equal(state.months['2026-08'].budgetUsage['budget-food'],0);
  assert.equal(state.meta.mobileSync.importedTransactions['tx-1'].deleted,true);
});

test('Desktop-Addon weist gesperrte Monate und unbekannte Budget-IDs ab',()=>{
  const {api}=makeContext();
  const locked=api.fp1Classification(payload([tx({id:'locked',month:'2026-07',date:'2026-07-31'})]))[0];
  assert.equal(locked.status,'error');
  assert.match(locked.message,/gesperrt/);
  const missing=api.fp1Classification(payload([tx({id:'missing',budgetId:'budget-gone'})]))[0];
  assert.equal(missing.status,'error');
  assert.match(missing.message,/Budget-ID/);
});

test('Desktop-Addon importiert zusätzliche Einnahmen/Ausgaben in Desktop-Monatsarrays',()=>{
  const {api,state}=makeContext();
  api.fp1ApplyOne(tx({id:'expense-1',kind:'expense',budgetId:'',category:'Reparatur',amountCents:1250}));
  api.fp1ApplyOne(tx({id:'income-1',kind:'income',budgetId:'',category:'Bonus',amountCents:30000}));
  assert.equal(state.months['2026-08'].expenses.length,1);
  assert.equal(state.months['2026-08'].expenses[0].amount,12.5);
  assert.equal(state.months['2026-08'].incomes.length,1);
  assert.equal(state.months['2026-08'].incomes[0].amount,300);
});


test('Desktop FP1-P wird vom Mobile-Decoder identisch verstanden',async()=>{
  const {api}=makeContext();
  const payload=api.fp1PlanPayload('2026-08');
  const code=await api.fp1Encode('P',payload);
  const decoded=await decodeFP1(code,{expectedType:'P'});
  assert.equal(decoded.planId,'plan-1');
  assert.equal(decoded.budgets[0].id,'budget-food');
  assert.equal(decoded.budgets[0].availableCents,22160);
  assert.equal(decoded.donuts.actual.segments[0].amountCents,12840);
  assert.equal(decoded.freeAvailableCents,170000);
});

test('Mobile FP1-T wird vom Desktop-Decoder verstanden',async()=>{
  const {api}=makeContext();
  const plan={planId:'plan-1',revision:4,month:'2026-08'};
  const mobileTx={id:'cross-1',recordRevision:1,createdAt:'2026-08-11T17:00:00.000Z',updatedAt:'2026-08-11T17:00:00.000Z',date:'2026-08-11',month:'2026-08',kind:'budget_expense',amountCents:2990,budgetId:'budget-food',category:'Lebensmittel',description:'Billa',note:''};
  const payload=buildTransactionPayload({plan,transactions:[mobileTx],settings:{deviceId:'dev-1',deviceName:'Test'},exportId:'exp-cross'});
  const code=await encodeFP1('T',payload,{forceEncoding:'N'});
  const decoded=await api.fp1Decode(code,'T');
  assert.equal(decoded.exportId,'exp-cross');
  assert.equal(decoded.transactions[0].id,'cross-1');
  assert.equal(decoded.transactions[0].amountCents,2990);
});
