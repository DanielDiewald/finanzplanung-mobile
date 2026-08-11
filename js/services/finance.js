import { deepClone, DONUT_COLORS, stableColor, sum } from '../utils.js';

function addSegment(donut,key,label,amountCents,color,detail,group='cost') {
  if (!(amountCents > 0)) return;
  let segment=donut.segments.find(s=>s.key===key);
  if(!segment){ segment={key,label,amountCents:0,group,color,details:[]}; donut.segments.push(segment); }
  segment.amountCents += amountCents;
  if(detail) segment.details.push({label:detail.label||label,amountCents});
  donut.totalCents = donut.segments.reduce((s,x)=>s+x.amountCents,0);
}

export function currentPendingTransactions(transactions, plan) {
  if(!plan) return []; return transactions.filter(t=>t.planId===plan.planId && t.month===plan.month && t.status!=='confirmed');
}

export function buildDisplayState(plan, transactions=[]) {
  if(!plan) return null;
  const out={ plan:deepClone(plan), pending:currentPendingTransactions(transactions,plan), missingBudgetTransactions:[], mobileDelta:{incomeCents:0,otherExpenseCents:0,budgetExpenseCents:0,budgetOverspendCents:0,accountCents:0,normalCents:0,totalAssetsCents:0} };
  out.plan.donuts={ planned:deepClone(plan.donuts.planned), actual:deepClone(plan.donuts.actual) };
  const budgetById=new Map(out.plan.budgets.map(b=>[b.id,b]));
  for(const tx of out.pending) {
    if(tx.deleted) continue;
    const label=tx.description || tx.category || (tx.kind==='income'?'Einnahme':'Ausgabe');
    if(tx.kind==='income') {
      out.mobileDelta.incomeCents += tx.amountCents; out.mobileDelta.accountCents += tx.amountCents; out.mobileDelta.normalCents += tx.amountCents; out.mobileDelta.totalAssetsCents += tx.amountCents;
    } else if(tx.kind==='expense') {
      out.mobileDelta.otherExpenseCents += tx.amountCents; out.mobileDelta.accountCents -= tx.amountCents; out.mobileDelta.normalCents -= tx.amountCents; out.mobileDelta.totalAssetsCents -= tx.amountCents;
      addSegment(out.plan.donuts.actual,'extra','Zusätzliche Ausgaben',tx.amountCents,DONUT_COLORS.extra,{label:`Mobil: ${label}`},'cost');
      addSegment(out.plan.donuts.planned,'extra','Zusätzliche Ausgaben',tx.amountCents,DONUT_COLORS.extra,{label:`Mobil: ${label}`},'cost');
    } else if(tx.kind==='budget_expense') {
      out.mobileDelta.budgetExpenseCents += tx.amountCents; out.mobileDelta.accountCents -= tx.amountCents; out.mobileDelta.totalAssetsCents -= tx.amountCents;
      const budget=budgetById.get(tx.budgetId);
      if(!budget){
        out.missingBudgetTransactions.push(tx);
        out.mobileDelta.budgetOverspendCents += tx.amountCents;
        out.mobileDelta.normalCents -= tx.amountCents;
        addSegment(out.plan.donuts.actual,'budgetSpent','Budgetverbrauch',tx.amountCents,DONUT_COLORS.budgetSpent,{label:`Mobil: ${label} · unbekanntes Budget`},'cost');
        addSegment(out.plan.donuts.planned,'overspend','Budgetüberziehung',tx.amountCents,DONUT_COLORS.overspend,{label:`Mobil: ${label} · Budget-ID nicht mehr vorhanden`},'cost');
        continue;
      }
      const cover=Math.min(tx.amountCents,Math.max(0,budget.availableCents)); const overspend=tx.amountCents-cover;
      budget.spentCents += tx.amountCents; budget.availableCents -= cover; out.plan.budgetAssetsCents -= cover;
      if(overspend>0){ out.mobileDelta.budgetOverspendCents += overspend; out.mobileDelta.normalCents -= overspend; addSegment(out.plan.donuts.planned,'overspend','Budgetüberziehung',overspend,DONUT_COLORS.overspend,{label:`Mobil: ${budget.name} · ${label}`},'cost'); }
      addSegment(out.plan.donuts.actual,'budgetSpent','Budgetverbrauch',tx.amountCents,DONUT_COLORS.budgetSpent,{label:`Mobil: ${budget.name} · ${label}`},'cost');
    }
  }
  out.plan.normalBalanceCents += out.mobileDelta.normalCents;
  out.plan.freeAvailableCents += out.mobileDelta.normalCents;
  out.plan.totalAssetsCents += out.mobileDelta.totalAssetsCents;
  if(out.plan.accountBalanceCents!==null) out.plan.accountBalanceCents += out.mobileDelta.accountCents;
  out.plan.budgetAssetsCents = out.plan.budgets.reduce((s,b)=>s+b.availableCents,0);
  out.plan.availableDonut={ mode:'available',title:'Noch verfügbar',centerLabel:'Verfügbar',centerSubtext:'in Alltagsbudgets',segments:out.plan.budgets.filter(b=>b.availableCents>0).map((b,i)=>{
    const mobileRows=transactions.filter(t=>!t.deleted && t.planId===plan.planId && t.month===plan.month && t.kind==='budget_expense' && t.budgetId===b.id).sort((a,z)=>String(z.date).localeCompare(String(a.date)) || String(z.createdAt).localeCompare(String(a.createdAt)));
    return {key:b.id,label:b.name,amountCents:b.availableCents,group:'available',color:b.color||stableColor(i),details:[
      {label:'Geplanter Budgetbetrag',amountCents:b.plannedCents},
      {label:'Bisher ausgegeben',amountCents:b.spentCents},
      {label:'Noch verfügbar',amountCents:b.availableCents},
      ...mobileRows.slice(0,30).map(t=>({label:`Mobil ${t.date} · ${t.description||t.category}`,amountCents:t.amountCents}))
    ]};
  }) };
  out.plan.availableDonut.totalCents=sum(out.plan.availableDonut.segments.map(x=>x.amountCents));
  return out;
}

export function transactionsForBudget(transactions,plan,budgetId) { return transactions.filter(t=>t.planId===plan.planId && t.month===plan.month && t.kind==='budget_expense' && t.budgetId===budgetId).sort((a,b)=>String(b.date).localeCompare(String(a.date))); }
export function pendingSummary(transactions,plan) {
  const rows=plan ? transactions.filter(t=>t.planId===plan.planId && t.status!=='confirmed') : []; const active=rows.filter(t=>!t.deleted); return { count:rows.length, deletedCount:rows.length-active.length, expensesCents:active.filter(t=>t.kind!=='income').reduce((s,t)=>s+t.amountCents,0), incomeCents:active.filter(t=>t.kind==='income').reduce((s,t)=>s+t.amountCents,0), rows };
}
export function groupTransactionsByDate(rows) {
  const map=new Map(); for(const t of rows){ if(!map.has(t.date)) map.set(t.date,[]); map.get(t.date).push(t); } return [...map.entries()].sort((a,b)=>b[0].localeCompare(a[0]));
}
export function statusLabel(status) { return status==='confirmed'?'Bestätigt':status==='prepared'?'Vorbereitet':'Lokal'; }
