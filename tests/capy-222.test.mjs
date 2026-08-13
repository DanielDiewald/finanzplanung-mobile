import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { validatePlanPayload, encodeFP1, decodeFP1 } from '../js/services/sync.js';
import { buildDisplayState, statusLabel } from '../js/services/finance.js';
import { defaultCapyState, availableCoins, setCapyEnabled, buildCapySyncPayload, applyRemoteCapy } from '../capy/js/shared-state.js';
import { createPetSession, movePetSession, petRewardForSession, pointInRect } from '../capy/js/interactions.js';
import { applyItem } from '../capy/js/engine.js';

const html=fs.readFileSync(new URL('../capy/index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../capy/css/capy.css',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../capy/js/app.js',import.meta.url),'utf8');
const itemConfig=JSON.parse(fs.readFileSync(new URL('../capy/settings/items.json',import.meta.url),'utf8'));
const items=itemConfig.items;
const behavior=JSON.parse(fs.readFileSync(new URL('../capy/settings/behavior.json',import.meta.url),'utf8'));

function vmBridgeState(overrides={}){
  return {
    meta:{start:'2026-08'},
    capy:{version:1,enabled:true,budgetId:'capy-vorrat',coins:25,appliedCoinOps:[],care:{initialized:true,name:'Momo',gender:'weiblich',hunger:70,happiness:80,energy:60,bond:30,inventory:{carrot:2},updatedAt:'2026-08-13T10:00:00.000Z'}},
    variableBudgets:[{id:'capy-vorrat',description:'Momo Vorrat',category:'Capy Vorrat',amount:0,interval:'monthly',nextDue:'2026-08',startBalance:0,capyManaged:true}],
    months:{'2026-08':{locked:false,budgetTransactions:[{id:'existing-deposit',type:'cash_to_budget',budgetId:'capy-vorrat',fromBudgetId:'',toBudgetId:'capy-vorrat',amount:20,date:'2026-08-13',capyUnlockDate:'2026-09-13',note:'bestehend'}]}},
    ...overrides
  };
}

function runBridge(state){
  const naming=fs.readFileSync(new URL('../capy/js/naming.js',import.meta.url),'utf8');
  const code=fs.readFileSync(new URL('../capy/js/desktop-bridge.js',import.meta.url),'utf8');
  const ctx={
    console,state,selectedMonth:'2026-08',activeView:'overview',location:{hash:''},confirm:()=>true,
    fetch:()=>Promise.reject(new Error('offline test')),
    document:{getElementById:()=>null,querySelectorAll:()=>[],querySelector:()=>null,documentElement:{dataset:{theme:'dark',themePreference:'dark'}}},
    isPlainObject:x=>Boolean(x)&&typeof x==='object'&&!Array.isArray(x),asNumber:x=>Number.isFinite(Number(x))?Number(x):0,
    currentResults:()=>({'2026-08':{budgetDetails:{'capy-vorrat':{closingBalance:20}}}}),planningMonths:()=>['2026-08'],
    uid:prefix=>`${prefix}-new`,roundMoney:x=>Math.round(x*100)/100,deepClone:x=>structuredClone(x),saveState:()=>{},updateAndSave:()=>{},showView:()=>{}
  };
  ctx.globalThis=ctx;
  vm.runInNewContext(naming,ctx,{filename:'naming.js'});
  vm.runInNewContext(code,ctx,{filename:'desktop-bridge-222.js'});
  return ctx.CapytCapyDesktopBridge;
}

test('Character Creator speichert Geschlecht erst beim finalen Erstellen und bietet kein divers',()=>{
  assert.deepEqual(behavior.genders,['weiblich','männlich']);
  assert.match(html,/data-gender="männlich"/);
  assert.match(html,/data-gender="weiblich"/);
  assert.doesNotMatch(html,/data-gender="divers"/i);
  assert.match(app,/let[^;]*setupGender=['"]männlich['"]/);
  assert.match(app,/function selectSetupGender\([^)]*\).*setupGender=gender/s);
  assert.match(app,/function finishSetup\([^)]*\).*capy\.care\.gender=setupGender/s);
});

test('Streicheln verlangt echte Distanz, beachtet Cooldown, Happiness-Cap und Session-Limit',()=>{
  const cfg=behavior.petting;
  const session=createPetSession(7,10,10);
  movePetSession(session,40,10);
  assert.equal(petRewardForSession(session,cfg,50,0,10_000),0);
  movePetSession(session,140,10);
  assert.equal(petRewardForSession(session,cfg,50,0,10_000),4);
  session.awarded=4; session.distance=cfg.requiredDistance;
  assert.equal(petRewardForSession(session,cfg,54,9_000,10_000),0);
  assert.equal(petRewardForSession(session,cfg,99,0,20_000),1);
  session.awarded=12;
  assert.equal(petRewardForSession(session,cfg,50,0,30_000),0);
  assert.match(app,/pointercancel/);
  assert.match(app,/onPetCancel/);
});

test('Mobile Game nutzt Pointer Events, Drag-Ghost und eine echte Capy-Drop-Zone',()=>{
  for(const eventName of ['pointerdown','pointermove','pointerup','pointercancel']) assert.match(app,new RegExp(eventName));
  assert.match(html,/id="dragGhost"/);
  assert.match(css,/\.drag-ghost\{position:fixed/);
  assert.match(css,/\.capy\.is-drop-target/);
  assert.equal(pointInRect(50,50,{left:0,right:100,top:0,bottom:100}),true);
  assert.equal(pointInRect(150,50,{left:0,right:100,top:0,bottom:100}),false);
  assert.match(app,/updateDropTarget\(event\.clientX,event\.clientY\).*useItem\(current\.item\).*returnGhost\(current\)/s);
  assert.match(app,/cancelItemPointer/);
});

test('Shop kauft nur; Inventar enthält food, toy und care ohne direkten Füttern-Button',()=>{
  assert.deepEqual(new Set(items.map(x=>x.type)),new Set(['food','toy','care']));
  assert.doesNotMatch(html,/>\s*Füttern\s*</i);
  assert.doesNotMatch(html,/data-feed/i);
  assert.match(app,/buyItem/);
  assert.match(app,/data-drag-item/);
});

test('Item-Effekte kommen aus JSON und werden generisch auf den Capy angewendet',()=>{
  const carrot=items.find(x=>x.id==='carrot');
  const care={hunger:50,happiness:50,energy:50,bond:20};
  const delta=applyItem(care,carrot);
  assert.equal(care.hunger,50+Number(carrot.effects.hunger||0));
  assert.equal(care.happiness,50+Number(carrot.effects.happiness||0));
  assert.equal(delta.hunger,Number(carrot.effects.hunger||0));
  assert.equal(carrot.interaction.target,'capy');
});

test('Mobile Hauptansicht bleibt im Viewport und berücksichtigt Safe Areas',()=>{
  assert.match(css,/body\{height:100dvh;overflow:hidden;overscroll-behavior:none/);
  assert.match(css,/\.capy-game\{height:100dvh;padding-top:env\(safe-area-inset-top\);padding-bottom:env\(safe-area-inset-bottom\);overflow:hidden/);
  assert.match(css,/\.scene\{[^}]*touch-action:none;user-select:none/);
  assert.match(css,/\.sheet-card\{[^}]*min-height:35dvh/);
  assert.match(css,/max-height:65dvh/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  for(const label of ['Shop','Inventar','Spielen','Vorrat','Mehr']) assert.match(html,new RegExp(`>${label}<`));
});

test('Pause erhält Capy-Werte und wird als echter synchronisierbarer State geführt',()=>{
  const state=defaultCapyState();
  Object.assign(state,{enabled:true,baseCoins:42,coinOps:[{id:'buy-1',delta:-2,reason:'Ball',relatedTransactionId:'',createdAt:'2026-08-13T10:00:00.000Z'}]});
  Object.assign(state.care,{initialized:true,name:'Momo',gender:'weiblich',inventory:{carrot:3},hunger:61,happiness:72,energy:83});
  const before={...state.care,inventory:{...state.care.inventory}};
  setCapyEnabled(state,false);
  assert.equal(state.enabled,false);
  assert.equal(state.enabledDirty,true);
  assert.equal(state.baseCoins,42);
  assert.deepEqual(state.care.inventory,before.inventory);
  assert.equal(state.care.hunger,before.hunger);
  assert.equal(state.care.happiness,before.happiness);
  assert.equal(state.care.energy,before.energy);
  assert.equal(buildCapySyncPayload(state).enabled,false);
  assert.match(app,/if\(!capy\.enabled\|\|!capy\.care\.initialized\)return;applyElapsedDecay/);
});

test('Abgelehnte mobile Capy-Buchung wird nicht als endgültige Coin-Gutschrift gezählt',()=>{
  const local=defaultCapyState();
  local.enabled=true; local.baseCoins=20;
  local.coinOps=[{id:'reward-1',delta:10,reason:'Vorrat',relatedTransactionId:'capy_tx_123',createdAt:'2026-08-13T10:00:00.000Z'}];
  assert.equal(availableCoins(local),30);
  const remote={enabled:true,budgetId:'capy-vorrat',coins:20,acknowledgedCoinOpIds:[],care:null};
  const rejected=applyRemoteCapy(local,remote,[],[{id:'capy_tx_123',recordRevision:1,status:'rejected',reason:'Monat ist gesperrt',updatedAt:'2026-08-13T11:00:00.000Z'}]);
  assert.equal(availableCoins(rejected),20);
  assert.equal(rejected.coinOps.length,1,'Coin-Op bleibt für Retry erhalten');
  assert.deepEqual(rejected.rejectedTransactionIds,['capy_tx_123']);
});

test('Rejected Capy-Finanztransaktion verändert Mobile-Finanzoverlay nicht und bleibt sichtbar markierbar',()=>{
  const plan=validatePlanPayload({protocolVersion:1,type:'P',planId:'p',planName:'P',revision:1,month:'2026-08',createdAt:'2026-08-13T10:00:00.000Z',source:{app:'test',dataVersion:1},accountBalanceCents:100000,normalBalanceCents:80000,freeAvailableCents:50000,minimumCashBufferCents:10000,budgetAssetsCents:20000,savingsAssetsCents:0,totalAssetsCents:100000,budgets:[{id:'capy-vorrat',name:"Momo's Vorrat",category:'Capy Vorrat',interval:'monthly',plannedCents:0,reserveCents:0,spentCents:0,availableCents:20000}],savingsGoals:[],donuts:{planned:{mode:'planned',title:'P',centerLabel:'P',centerSubtext:'',totalCents:0,segments:[]},actual:{mode:'actual',title:'A',centerLabel:'A',centerSubtext:'',totalCents:0,segments:[]}},capy:{enabled:true,budgetId:'capy-vorrat',budgetName:"Momo's Vorrat",stashBalanceCents:20000,withdrawableStashCents:0,lockedStashCents:20000,stashLockMonths:1,coins:20}});
  const tx={id:'capy_tx_1',planId:'p',recordRevision:1,createdAt:'2026-08-13T10:01:00.000Z',updatedAt:'2026-08-13T10:01:00.000Z',date:'2026-08-13',month:'2026-08',kind:'capy_stash_deposit',amountCents:1000,budgetId:'capy-vorrat',category:'Capy Vorrat',description:'Aufladen',note:'',status:'rejected',deleted:false};
  const display=buildDisplayState(plan,[tx]);
  assert.equal(display.pending.length,0);
  assert.equal(display.plan.normalBalanceCents,80000);
  assert.equal(statusLabel('rejected'),'Nicht übernommen');
});

test('FP1-P transportiert abgelehnte Transaktionsergebnisse inklusive Grund',async()=>{
  const input={protocolVersion:1,type:'P',planId:'p',planName:'P',revision:3,month:'2026-08',createdAt:'2026-08-13T10:00:00.000Z',source:{app:'test',dataVersion:1},accountBalanceCents:0,normalBalanceCents:0,freeAvailableCents:0,minimumCashBufferCents:0,budgetAssetsCents:0,savingsAssetsCents:0,totalAssetsCents:0,budgets:[],savingsGoals:[],donuts:{planned:{mode:'planned',title:'P',centerLabel:'P',centerSubtext:'',totalCents:0,segments:[]},actual:{mode:'actual',title:'A',centerLabel:'A',centerSubtext:'',totalCents:0,segments:[]}},transactionResults:[{id:'capy_tx_x',recordRevision:1,status:'rejected',reason:'Monat ist gesperrt',updatedAt:'2026-08-13T12:00:00.000Z'}],capy:{enabled:true,budgetId:'capy-vorrat',budgetName:"Momo's Vorrat",stashBalanceCents:0,withdrawableStashCents:0,lockedStashCents:0,stashLockMonths:1,coins:0}};
  const code=await encodeFP1('P',validatePlanPayload(input),{forceEncoding:'C'});
  const out=await decodeFP1(code,{expectedType:'P'});
  assert.equal(out.transactionResults[0].status,'rejected');
  assert.equal(out.transactionResults[0].reason,'Monat ist gesperrt');
});

test('2.2.1a Budgetname wird ohne Duplikat migriert und bestehende Bezüge bleiben erhalten',()=>{
  const state=vmBridgeState();
  const originalBudget=state.variableBudgets[0];
  const originalTx=state.months['2026-08'].budgetTransactions[0];
  runBridge(state);
  assert.equal(state.variableBudgets.length,1);
  assert.equal(state.variableBudgets[0],originalBudget);
  assert.equal(state.variableBudgets[0].description,"Momo's Vorrat");
  assert.equal(state.variableBudgets[0].id,'capy-vorrat');
  assert.equal(state.months['2026-08'].budgetTransactions[0],originalTx);
  assert.equal(originalTx.budgetId,'capy-vorrat');
  assert.equal(originalTx.capyUnlockDate,'2026-09-13');
});
