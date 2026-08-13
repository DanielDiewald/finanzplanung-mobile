import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { TextDecoder, TextEncoder } from 'node:util';
import { validatePlanPayload, buildTransactionPayload, encodeFP1, decodeFP1, validateMobileTransaction } from '../js/services/sync.js';
import { buildDisplayState } from '../js/services/finance.js';
import { currentPhase } from '../capy/js/engine.js';

const raw=JSON.parse(fs.readFileSync(new URL('../fixtures/sample-plan.json',import.meta.url),'utf8'));
const care={initialized:true,name:'Momo',gender:'weiblich',hunger:70,happiness:80,energy:60,bond:30,inventory:{carrot:2},lastUpdate:1786600000000,updatedAt:'2026-08-13T10:00:00.000Z'};

function capyPlan(){
  return validatePlanPayload({...raw,
    budgets:[...raw.budgets,{id:'capy-vorrat',name:'Momo Vorrat',category:'Capy Vorrat',plannedCents:0,reserveCents:0,spentCents:0,availableCents:2500}],
    capy:{enabled:true,budgetId:'capy-vorrat',budgetName:'Momo Vorrat',stashBalanceCents:2500,coins:19,acknowledgedCoinOpIds:['coin-1'],care}
  });
}

test('Capy-Plan bleibt in kompaktem FP1-P vollständig erhalten',async()=>{
  const plan=capyPlan();
  const code=await encodeFP1('P',plan,{forceEncoding:'C'});
  const decoded=await decodeFP1(code,{expectedType:'P'});
  assert.equal(decoded.capy.enabled,true);
  assert.equal(decoded.capy.budgetName,'Momo Vorrat');
  assert.equal(decoded.capy.coins,19);
  assert.deepEqual(decoded.capy.acknowledgedCoinOpIds,['coin-1']);
  assert.equal(decoded.capy.care.name,'Momo');
  assert.equal(decoded.capy.care.gender,'weiblich');
});

test('Capy-only Sync funktioniert ohne normale Finanzbuchung',async()=>{
  const plan=capyPlan();
  const capy={version:1,enabled:true,budgetId:'capy-vorrat',coinOps:[{id:'coin-op-2',delta:-3,reason:'Karotte gekauft',relatedTransactionId:'stash-link-1',createdAt:'2026-08-13T11:00:00.000Z'}],care:{...care,updatedAt:'2026-08-13T11:01:00.000Z'}};
  const payload=buildTransactionPayload({plan,transactions:[],settings:{deviceId:'phone-1',deviceName:'Handy'},capy,exportId:'capy-only'});
  assert.equal(payload.transactions.length,0);
  const decoded=await decodeFP1(await encodeFP1('T',payload,{forceEncoding:'C'}),{expectedType:'T'});
  assert.equal(decoded.exportId,'capy-only');
  assert.equal(decoded.capy.coinOps[0].delta,-3);
  assert.equal(decoded.capy.coinOps[0].relatedTransactionId,'stash-link-1');
  assert.equal(decoded.capy.care.inventory.carrot,2);
});

test('Vorrat-Aufladung ist eine erlaubte interne FP1-Buchungsart',()=>{
  const tx=validateMobileTransaction({id:'stash-1',recordRevision:1,createdAt:'2026-08-13T11:00:00.000Z',updatedAt:'2026-08-13T11:00:00.000Z',date:'2026-08-13',month:'2026-08',kind:'capy_stash_deposit',amountCents:1000,budgetId:'capy-vorrat',category:'Capy Vorrat',description:'Momo Vorrat aufgeladen',note:''});
  assert.equal(tx.kind,'capy_stash_deposit');
  assert.equal(tx.budgetId,'capy-vorrat');
});

test('Mobile Vorrat-Aufladung verschiebt Vermögen intern und erzeugt keine Ausgabe',()=>{
  const plan=capyPlan();
  const beforeTotal=plan.totalAssetsCents,beforeNormal=plan.normalBalanceCents,beforeAccount=plan.accountBalanceCents;
  const d=buildDisplayState(plan,[{id:'stash-1',planId:plan.planId,recordRevision:1,createdAt:'2026-08-13T11:00:00.000Z',updatedAt:'2026-08-13T11:00:00.000Z',date:'2026-08-13',month:'2026-08',kind:'capy_stash_deposit',amountCents:1000,budgetId:'capy-vorrat',category:'Capy Vorrat',description:'Aufladen',note:'',status:'local',deleted:false}]);
  assert.equal(d.plan.normalBalanceCents,beforeNormal-1000);
  assert.equal(d.plan.budgets.find(b=>b.id==='capy-vorrat').availableCents,3500);
  assert.equal(d.plan.totalAssetsCents,beforeTotal);
  assert.equal(d.plan.accountBalanceCents,beforeAccount);
  assert.equal(d.mobileDelta.capyDepositCents,1000);
});

test('Tagesphasen werden aus behavior.json statt aus festen Uhrzeiten gelesen',()=>{
  const behavior={phaseSchedule:{morning:{from:5,to:8,label:'Früh'},day:{from:8,to:16,label:'Tag'},evening:{from:16,to:20,label:'Abend'},night:{from:20,to:5,label:'Nacht'}}};
  assert.deepEqual(currentPhase(behavior,'auto',new Date(2026,7,13,6,30)),{key:'morning',label:'Früh'});
  assert.deepEqual(currentPhase(behavior,'auto',new Date(2026,7,13,21,0)),{key:'night',label:'Nacht'});
});

test('behavior.json bietet nur weiblich und männlich an und Raum-Pfad ist leer',()=>{
  const behavior=JSON.parse(fs.readFileSync(new URL('../capy/settings/behavior.json',import.meta.url),'utf8'));
  assert.deepEqual(behavior.genders,['weiblich','männlich']);
  assert.equal(behavior.room.backgroundImage,'');
  assert.equal(behavior.sleep.blocksFood,true);
  assert.ok(behavior.animationMs.feed>0);
});

test('Desktop-Bridge erstellt Vorrat erst nach Aktivierung und dedupliziert Coin-Operationen',()=>{
  const bridgeCode=fs.readFileSync(new URL('../capy/js/desktop-bridge.js',import.meta.url),'utf8');
  const state={meta:{start:'2026-08'},capy:{version:1,enabled:false,budgetId:'capy-vorrat',coins:0,appliedCoinOps:[],care:null},variableBudgets:[],months:{'2026-08':{locked:false,budgetTransactions:[]}}};
  let seq=0;
  const ctx={
    console,state,selectedMonth:'2026-08',activeView:'overview',location:{hash:''},
    fetch:()=>Promise.reject(new Error('offline test')),
    document:{getElementById:()=>null,querySelectorAll:()=>[],querySelector:()=>null},
    isPlainObject:x=>Boolean(x)&&typeof x==='object'&&!Array.isArray(x),asNumber:x=>Number.isFinite(Number(x))?Number(x):0,
    currentResults:()=>({'2026-08':{budgetDetails:{'capy-vorrat':{closingBalance:state.months['2026-08'].budgetTransactions.reduce((sum,tx)=>sum+(tx.type==='cash_to_budget'?tx.amount:-tx.amount),0)}}}}),
    planningMonths:()=>['2026-08'],uid:()=>`id-${++seq}`,roundMoney:x=>Math.round(x*100)/100,deepClone:x=>structuredClone(x),
    saveState:()=>{},updateAndSave:()=>{},showView:()=>{}
  };
  ctx.globalThis=ctx;
  vm.runInNewContext(bridgeCode,ctx,{filename:'desktop-bridge.js'});
  const api=ctx.CapytCapyDesktopBridge;
  assert.equal(state.variableBudgets.length,0);
  api.setEnabled(true);
  assert.equal(state.variableBudgets.length,1);
  assert.equal(state.variableBudgets[0].id,'capy-vorrat');
  api.topUp(1000);
  assert.equal(state.capy.coins,10);
  assert.equal(state.months['2026-08'].budgetTransactions[0].amount,10);
  const sync={coinOps:[{id:'spend-1',delta:-3,reason:'Food',createdAt:'2026-08-13T12:00:00.000Z'}],care:{...care,updatedAt:'2026-08-13T12:00:00.000Z'}};
  api.applyMobileSync(sync);api.applyMobileSync(sync);
  assert.equal(state.capy.coins,7);
  assert.deepEqual(Array.from(state.capy.appliedCoinOps),['spend-1']);
  assert.equal(state.variableBudgets[0].description,'Momo Vorrat');
});
