import { escapeHtml, formatCents, formatMonth, percent, setHidden } from '../utils.js';

function groupLabel(group){ return group==='reserve'?'Reservierungen':group==='saving'?'Sparen / Vermögensverschiebung':group==='available'?'Noch verfügbar':'Tatsächliche Kosten'; }

function drawDonut(canvas,data,selectedKey,onSelect){
  const rect=canvas.getBoundingClientRect(); const cssSize=Math.max(220,Math.min(rect.width||320,390)); const dpr=Math.min(3,window.devicePixelRatio||1);
  canvas.width=Math.round(cssSize*dpr); canvas.height=Math.round(cssSize*dpr); const ctx=canvas.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,cssSize,cssSize);
  const cx=cssSize/2,cy=cssSize/2,r=cssSize*.39,line=cssSize*.16,total=data?.totalCents||0,segments=data?.segments||[]; const hits=[];
  ctx.lineWidth=line; ctx.lineCap='butt';
  if(!(total>0)){ ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue('--line').trim()||'#d6d9de'; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke(); }
  else {
    let angle=-Math.PI/2; const gap=Math.min(.025,Math.PI*2/(segments.length*20||1));
    for(const segment of segments){ const span=(segment.amountCents/total)*Math.PI*2; const a0=angle+gap/2,a1=angle+span-gap/2; if(a1>a0){ ctx.strokeStyle=segment.color||'#6079b8'; ctx.globalAlpha=selectedKey&&selectedKey!==segment.key?.toString()?.trim()?0.42:1; ctx.beginPath(); ctx.arc(cx,cy,r,a0,a1); ctx.stroke(); ctx.globalAlpha=1; hits.push({key:segment.key,start:angle,end:angle+span}); } angle+=span; }
  }
  canvas.onclick=(event)=>{ if(!(total>0)) return; const box=canvas.getBoundingClientRect(),x=event.clientX-box.left-box.width/2,y=event.clientY-box.top-box.height/2; const dist=Math.hypot(x,y); if(dist<box.width*.22||dist>box.width*.49) return; let a=Math.atan2(y,x); if(a<-Math.PI/2)a+=Math.PI*2; const hit=hits.find(h=>a>=h.start&&a<h.end); if(hit)onSelect?.(hit.key); };
}

export function renderMonth({display,donutMode='planned',selectedSegment='',onSegment,onBudget}){
  const noPlan=document.getElementById('noPlanState'), content=document.getElementById('monthContent'), fab=document.getElementById('fabExpense');
  setHidden(noPlan,Boolean(display)); setHidden(content,!display); setHidden(fab,!display); if(!display)return;
  const p=display.plan;
  const warnings=document.getElementById('monthWarnings');
  if(warnings) warnings.innerHTML=display.missingBudgetTransactions.length?`<div class="notice warn"><strong>${display.missingBudgetTransactions.length} mobile Budgetbuchung${display.missingBudgetTransactions.length===1?'':'en'} mit nicht mehr vorhandener Budget-ID.</strong><br>Der Betrag wird vorsichtshalber als Belastung des frei verfügbaren Guthabens behandelt. Bitte beim Desktop-Import zuordnen oder korrigieren.</div>`:'';
  document.getElementById('monthHeading').textContent=formatMonth(p.month); document.getElementById('planRevisionBadge').textContent=`Rev. ${p.revision}`;
  document.getElementById('freeAvailableValue').textContent=formatCents(p.freeAvailableCents); document.getElementById('freeAvailableValue').classList.toggle('negative',p.freeAvailableCents<0);
  document.getElementById('freeAvailableMeta').textContent=p.minimumCashBufferCents?`nach ${formatCents(p.minimumCashBufferCents)} Mindestpuffer`:'ohne Mindestpuffer';
  document.getElementById('accountBalanceValue').textContent=p.accountBalanceCents===null?'–':formatCents(p.accountBalanceCents); document.getElementById('accountBalanceHint').textContent=p.accountBalanceCents===null?'nicht übermittelt':'Desktop + lokale Buchungen';
  document.getElementById('budgetAssetsValue').textContent=formatCents(p.budgetAssetsCents); document.getElementById('savingsAssetsValue').textContent=formatCents(p.savingsAssetsCents); document.getElementById('totalAssetsValue').textContent=formatCents(p.totalAssetsCents);
  document.querySelectorAll('[data-donut-mode]').forEach(b=>b.classList.toggle('active',b.dataset.donutMode===donutMode));
  const data=donutMode==='actual'?p.donuts.actual:donutMode==='available'?p.availableDonut:p.donuts.planned;
  document.getElementById('donutTitle').textContent=data.title; document.getElementById('donutCenterLabel').textContent=data.centerLabel; document.getElementById('donutCenterValue').textContent=formatCents(data.totalCents);
  document.getElementById('donutHelp').textContent=donutMode==='planned'?'Desktop-Werte für die Geldverwendung; lokale Ist-Buchungen ergänzen nur neue tatsächliche Vorgänge und Überziehungen.':donutMode==='actual'?'Tatsächlicher Vermögensverbrauch laut Desktop plus noch nicht bestätigte mobile Ausgaben.':'Aktuell noch verfügbare Beträge in den Budgets. Neue mobile Budgetausgaben werden sofort abgezogen.';
  const legend=document.getElementById('donutLegend'); let lastGroup='';
  legend.innerHTML=data.segments.length?data.segments.map(s=>{const title=s.group!==lastGroup?`<div class="donut-group-title">${escapeHtml(groupLabel(s.group))}</div>`:'';lastGroup=s.group;return `${title}<button type="button" class="donut-row ${selectedSegment===s.key?'active':''}" data-segment="${escapeHtml(s.key)}"><span class="donut-swatch" style="background:${s.color}"></span><span class="donut-name">${escapeHtml(s.label)}</span><span class="donut-value">${formatCents(s.amountCents)}<small>${percent(s.amountCents,data.totalCents).toFixed(1).replace('.',',')} %</small></span></button>`}).join(''):'<div class="empty-inline">Keine Werte für diese Ansicht.</div>';
  legend.querySelectorAll('[data-segment]').forEach(b=>b.addEventListener('click',()=>onSegment?.(b.dataset.segment)));
  drawDonut(document.getElementById('donutCanvas'),data,selectedSegment,onSegment);
  const selected=data.segments.find(s=>s.key===selectedSegment),details=document.getElementById('donutDetails');
  if(!selected){details.innerHTML='';setHidden(details,true);} else {details.innerHTML=`<h3>${escapeHtml(selected.label)} · ${formatCents(selected.amountCents)}</h3>${selected.details?.length?`<div>${selected.details.map(d=>`<div class="detail-row"><span>${escapeHtml(d.label)}</span><strong>${formatCents(d.amountCents)}</strong></div>`).join('')}</div>`:'<p class="help">Keine weitere Aufschlüsselung vorhanden.</p>'}`;setHidden(details,false);}
  const budgetList=document.getElementById('budgetList'); document.getElementById('budgetCount').textContent=String(p.budgets.length);
  budgetList.innerHTML=p.budgets.length?p.budgets.map(b=>{ const baseline=Math.max(0,b.plannedCents,b.spentCents+Math.max(0,b.availableCents));const ratio=baseline?Math.min(100,Math.max(0,(b.spentCents/baseline)*100)):0;return `<button type="button" class="budget-card" data-budget-id="${escapeHtml(b.id)}"><div class="budget-top"><div><div class="budget-name">${escapeHtml(b.name)}</div><div class="budget-category">${escapeHtml(b.category)}</div></div><div class="budget-available ${b.availableCents<0?'negative':''}">${formatCents(b.availableCents)}<small>verfügbar</small></div></div><div class="progress"><span style="width:${ratio.toFixed(1)}%"></span></div><div class="budget-meta"><span>Ausgegeben ${formatCents(b.spentCents)}</span><span>Plan ${formatCents(b.plannedCents)}</span></div></button>`}).join(''):'<div class="empty-inline">Keine Budgets im Plan-Code.</div>';
  budgetList.querySelectorAll('[data-budget-id]').forEach(b=>b.addEventListener('click',()=>onBudget?.(b.dataset.budgetId)));
}
