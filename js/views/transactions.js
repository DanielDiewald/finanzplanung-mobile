import { escapeHtml, formatCents, formatDate, todayLocal } from '../utils.js';
import { groupTransactionsByDate, statusLabel } from '../services/finance.js';

function dayHeading(date){const today=todayLocal();const yd=new Date();yd.setDate(yd.getDate()-1);const yesterday=todayLocal(yd);return date===today?'Heute':date===yesterday?'Gestern':formatDate(date);}
function capyStatus(t){if(t.status==='confirmed')return 'Gebucht';if(t.status==='rejected')return `Nicht übernommen${t.rejectionReason?` · ${t.rejectionReason}`:''}`;return 'Wartet auf PC';}

export function renderTransactions({plan,transactions,filter='all',budgetFilter='',onEdit}){
  const budgetMap=new Map((plan?.budgets||[]).map(b=>[b.id,b]));
  const selector=document.getElementById('transactionBudgetFilter'),current=selector.value;
  const categories=[...new Set(transactions.map(t=>t.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'de'));
  selector.innerHTML=`<option value="">Alle</option>${(plan?.budgets||[]).map(b=>`<option value="budget:${escapeHtml(b.id)}">${escapeHtml(b.name)}</option>`).join('')}${categories.map(c=>`<option value="category:${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}`;
  selector.value=budgetFilter||current||'';
  document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===filter));

  let rows=transactions.slice();
  if(filter==='expense')rows=rows.filter(t=>['budget_expense','expense'].includes(t.kind));
  else if(filter==='income')rows=rows.filter(t=>t.kind==='income');
  else if(filter==='pending')rows=rows.filter(t=>t.status!=='confirmed');
  if(budgetFilter.startsWith('budget:'))rows=rows.filter(t=>t.budgetId===budgetFilter.slice(7));
  else if(budgetFilter.startsWith('category:'))rows=rows.filter(t=>t.category===budgetFilter.slice(9));

  const outCents=rows.filter(t=>['budget_expense','expense'].includes(t.kind)).reduce((s,t)=>s+t.amountCents,0),inCents=rows.filter(t=>t.kind==='income').reduce((s,t)=>s+t.amountCents,0),capyCents=rows.filter(t=>t.kind==='capy_stash_deposit').reduce((s,t)=>s+t.amountCents,0);
  document.getElementById('transactionsSummary').innerHTML=`${rows.length} Buchung${rows.length===1?'':'en'} · Ausgaben <strong>${formatCents(outCents)}</strong>${inCents?` · Einnahmen <strong>${formatCents(inCents)}</strong>`:''}${capyCents?` · Capy-Vorrat <strong>${formatCents(capyCents)}</strong>`:''}`;

  const list=document.getElementById('transactionList'),groups=groupTransactionsByDate(rows);
  list.innerHTML=groups.length?groups.map(([date,items])=>`<section class="transaction-group"><h3>${dayHeading(date)}</h3><div class="transaction-group-list">${items.map(t=>{
    if(t.kind==='capy_stash_deposit'){
      const reward=Math.max(0,Math.floor(Number(t.capyCoinReward)||0)),pending=t.status!=='confirmed'&&t.status!=='rejected';
      return `<div class="transaction-row capy-transaction-row${pending?' is-pending':''}${t.status==='rejected'?' is-rejected':''}"><span class="transaction-main"><strong>${escapeHtml(plan?.capy?.budgetName||t.description||'Capy-Vorrat')}</strong><small><span class="sync-dot ${t.status==='confirmed'?'confirmed':t.status==='rejected'?'rejected':''}"></span>${escapeHtml(capyStatus(t))}${reward?` · +${reward} 🪙`:''}</small></span><span class="transaction-amount capy-transfer">${formatCents(t.amountCents)}</span></div>`;
    }
    const name=t.description||t.category||(t.kind==='income'?'Einnahme':'Ausgabe'),secondary=t.kind==='budget_expense'?(budgetMap.get(t.budgetId)?.name||`${t.category} · Budget nicht mehr vorhanden`):t.category;
    return `<button type="button" class="transaction-row" data-transaction-id="${escapeHtml(t.id)}"><span class="transaction-main"><strong>${escapeHtml(name)}</strong><small><span class="sync-dot ${t.status==='confirmed'?'confirmed':t.status==='rejected'?'rejected':t.status==='local'?'local':''}"></span>${escapeHtml(secondary)} · ${escapeHtml(statusLabel(t.status))}</small></span><span class="transaction-amount ${t.kind==='income'?'income':''}">${t.kind==='income'?'+':'−'}${formatCents(t.amountCents)}</span></button>`;
  }).join('')}</div></section>`).join(''):'<div class="empty-state compact-empty"><h3>Keine Buchungen</h3><p>Für diesen Filter sind keine mobilen Buchungen vorhanden.</p></div>';
  list.querySelectorAll('[data-transaction-id]').forEach(b=>b.addEventListener('click',()=>onEdit?.(b.dataset.transactionId)));
}
