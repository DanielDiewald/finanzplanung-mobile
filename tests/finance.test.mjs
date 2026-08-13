import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildDisplayState, pendingSummary } from '../js/services/finance.js';
import { validatePlanPayload } from '../js/services/sync.js';
const plan=validatePlanPayload(JSON.parse(fs.readFileSync(new URL('../fixtures/sample-plan.json',import.meta.url),'utf8')));
const base={planId:plan.planId,basePlanRevision:plan.revision,recordRevision:1,createdAt:'2026-08-11T17:00:00.000Z',updatedAt:'2026-08-11T17:00:00.000Z',date:'2026-08-11',month:'2026-08',category:'Sonstiges',description:'',note:'',status:'local',preparedExportIds:[],deleted:false};
test('Budgetausgabe reduziert verfügbares Budget und Ist-Donut sofort',()=>{const d=buildDisplayState(plan,[{...base,id:'a',kind:'budget_expense',amountCents:2990,budgetId:'budget-food',category:'Lebensmittel'}]);const food=d.plan.budgets.find(x=>x.id==='budget-food');assert.equal(food.availableCents,19170);assert.equal(food.spentCents,15830);assert.equal(d.plan.donuts.actual.segments.find(x=>x.key==='budgetSpent').amountCents,20830);assert.equal(d.plan.freeAvailableCents,120000);assert.equal(d.plan.totalAssetsCents,440170);});
test('Budgetüberziehung belastet normales/freies Guthaben, nicht doppelt reservierten Anteil',()=>{const d=buildDisplayState(plan,[{...base,id:'b',kind:'budget_expense',amountCents:30000,budgetId:'budget-food',category:'Lebensmittel'}]);assert.equal(d.mobileDelta.budgetOverspendCents,7840);assert.equal(d.plan.freeAvailableCents,112160);assert.equal(d.plan.donuts.planned.segments.find(x=>x.key==='overspend').amountCents,7840);});
test('sonstige Ausgabe reduziert frei verfügbar und ergänzt extra-Segment',()=>{const d=buildDisplayState(plan,[{...base,id:'c',kind:'expense',amountCents:5000,budgetId:'',category:'Reparatur'}]);assert.equal(d.plan.freeAvailableCents,115000);assert.equal(d.plan.donuts.actual.segments.find(x=>x.key==='extra').amountCents,5000);});
test('zusätzliche Einnahme erhöht normales/freies und Gesamtvermögen',()=>{const d=buildDisplayState(plan,[{...base,id:'d',kind:'income',amountCents:30000,budgetId:'',category:'Bonus'}]);assert.equal(d.plan.freeAvailableCents,150000);assert.equal(d.plan.totalAssetsCents,473160);assert.equal(d.plan.accountBalanceCents,480000);});
test('bestätigte Buchung wird nicht erneut auf Desktop-Stand aufgeschlagen',()=>{const d=buildDisplayState(plan,[{...base,id:'e',kind:'expense',amountCents:5000,status:'confirmed'}]);assert.equal(d.plan.freeAvailableCents,120000);});
test('fehlende Budget-ID wird erkannt und nicht als verfügbar abgezogen',()=>{const d=buildDisplayState(plan,[{...base,id:'f',kind:'budget_expense',amountCents:1000,budgetId:'gone',category:'Lebensmittel'}]);assert.equal(d.missingBudgetTransactions.length,1);assert.equal(d.plan.budgetAssetsCents,93160);assert.equal(d.plan.freeAvailableCents,119000);assert.equal(d.mobileDelta.budgetOverspendCents,1000);});
test('gelöschte Tombstones beeinflussen Monatswerte nicht',()=>{const d=buildDisplayState(plan,[{...base,id:'g',kind:'expense',amountCents:5000,deleted:true}]);assert.equal(d.plan.freeAvailableCents,120000);});

test('Sync-Zusammenfassung behält offene Buchungen aus älteren Monaten',()=>{const rows=[{...base,id:'old',month:'2026-07',date:'2026-07-31',kind:'expense',amountCents:1200},{...base,id:'now',kind:'income',amountCents:3000},{...base,id:'done',kind:'expense',amountCents:500,status:'confirmed'}];const s=pendingSummary(rows,plan);assert.equal(s.count,2);assert.equal(s.expensesCents,1200);assert.equal(s.incomeCents,3000);});
test('Verfügbar-Donut enthält Budgetstand und mobile Buchungsdetails',()=>{const d=buildDisplayState(plan,[{...base,id:'detail',kind:'budget_expense',amountCents:2990,budgetId:'budget-food',category:'Lebensmittel',description:'Billa'}]);const seg=d.plan.availableDonut.segments.find(x=>x.key==='budget-food');assert.ok(seg.details.some(x=>x.label==='Bisher ausgegeben'&&x.amountCents===15830));assert.ok(seg.details.some(x=>x.label.includes('Billa')&&x.amountCents===2990));});


test('Capy-Guthaben erscheint im Verfügbar-Donut erst als freigegebener Anteil',()=>{
  const capyPlan=structuredClone(plan);
  capyPlan.budgets.push({id:'capy-vorrat',name:"Momo's Vorrat",category:'Capy Vorrat',interval:'monthly',plannedCents:0,reserveCents:0,spentCents:0,availableCents:2500,color:''});
  capyPlan.capy={enabled:true,budgetId:'capy-vorrat',budgetName:"Momo's Vorrat",stashBalanceCents:2500,withdrawableStashCents:0,lockedStashCents:2500,nextUnlockDate:'2026-09-13',stashLockMonths:1,coins:0};
  const locked=buildDisplayState(capyPlan,[]);
  assert.equal(locked.plan.availableDonut.segments.some(x=>x.key==='capy-vorrat'),false);
  capyPlan.capy.withdrawableStashCents=1000; capyPlan.capy.lockedStashCents=1500;
  const partlyUnlocked=buildDisplayState(capyPlan,[]);
  const segment=partlyUnlocked.plan.availableDonut.segments.find(x=>x.key==='capy-vorrat');
  assert.equal(segment.amountCents,1000);
  assert.equal(segment.details.find(x=>x.label==='Noch verfügbar').amountCents,1000);
});
