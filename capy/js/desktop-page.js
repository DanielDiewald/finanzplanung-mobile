const $=id=>document.getElementById(id);
const bridge=()=>window.parent?.CapytCapyDesktopBridge;
const money=cents=>new Intl.NumberFormat('de-AT',{style:'currency',currency:'EUR'}).format((Number(cents)||0)/100);
const monthName=ym=>{if(!/^\d{4}-\d{2}$/.test(String(ym||'')))return '–';const [y,m]=ym.split('-').map(Number);return new Intl.DateTimeFormat('de-AT',{month:'long',year:'numeric'}).format(new Date(y,m-1,1));};
function parseEuro(value){const clean=String(value||'').trim().replace(/\s/g,'').replace(/\./g,'').replace(',','.');const n=Number(clean);return Number.isFinite(n)?Math.round(n*100):NaN;}

async function render(){
  const api=bridge();
  if(!api){$('disabledNotice').classList.remove('hidden');$('disabledNotice').textContent='Capy-Brücke zum Finanzplan ist nicht verfügbar.';$('content').classList.add('hidden');$('historyCard').classList.add('hidden');return;}
  const s=api.snapshot();
  $('disabledNotice').classList.toggle('hidden',s.enabled);
  $('content').classList.toggle('hidden',!s.enabled);
  $('historyCard').classList.toggle('hidden',!s.enabled);
  $('title').textContent=s.budgetName;
  $('stash').textContent=money(s.stashBalanceCents);
  $('coins').textContent=String(s.coins);
  $('coinRate').textContent=`${s.coinsPerEuro} Coin${s.coinsPerEuro===1?'':'s'} / €`;
  $('month').textContent=monthName(s.month);
  $('budgetName').textContent=s.budgetName;
  $('topUpHint').textContent=`Mindestens ${money(s.minimumTopUpCents)}. Je 1 € erhältst du ${s.coinsPerEuro} Coin${s.coinsPerEuro===1?'':'s'}.`;
  const img=$('coinIcon'),fallback=$('coinFallback');
  img.style.display='inline-block';fallback.style.display='none';img.src=s.coinImage||'./assets/ui/coins.png';img.onerror=()=>{img.style.display='none';fallback.style.display='grid';};
  $('history').innerHTML=s.history.length?s.history.map(row=>`<div class="history-row"><div><strong>${row.type==='budget_to_cash'?'Aus Vorrat entnommen':'Vorrat aufgeladen'}</strong><br><small>${monthName(row.month)}${row.note?` · ${escapeHtml(row.note)}`:''}</small></div><strong>${row.type==='budget_to_cash'?'-':'+'}${money(row.amountCents)}</strong></div>`).join(''):'<div class="empty">Noch keine Vorrat-Bewegungen.</div>';
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
$('topUp').addEventListener('click',()=>{try{const cents=parseEuro($('topUpAmount').value);bridge().topUp(cents);$('topUpAmount').value='';render();}catch(error){alert(error.message);}});
$('openMonth').addEventListener('click',()=>bridge()?.openMonth());
window.addEventListener('message',event=>{if(event.data?.type==='capyt-capy-refresh')render();});
render();
