const $=id=>document.getElementById(id);
const bridge=()=>window.parent?.CapytCapyDesktopBridge;
const money=cents=>new Intl.NumberFormat('de-AT',{style:'currency',currency:'EUR'}).format((Number(cents)||0)/100);
const monthName=ym=>{if(!/^\d{4}-\d{2}$/.test(String(ym||'')))return '\u2013';const [y,m]=ym.split('-').map(Number);return new Intl.DateTimeFormat('de-AT',{month:'long',year:'numeric'}).format(new Date(y,m-1,1));};
const dateName=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return '\u2013';const [y,m,d]=String(value).split('-').map(Number);return new Intl.DateTimeFormat('de-AT',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(y,m-1,d));};
function parseEuro(value){const clean=String(value||'').trim().replace(/\s/g,'').replace(/\./g,'').replace(',','.');const n=Number(clean);return Number.isFinite(n)?Math.round(n*100):NaN;}
function syncTheme(payload={}){
  let effective=String(payload.theme||''),preference=String(payload.themePreference||'');
  try{const parentRoot=window.parent?.document?.documentElement;effective=effective||String(parentRoot?.dataset?.theme||'');preference=preference||String(parentRoot?.dataset?.themePreference||'');}catch{}
  if(effective==='dark'||effective==='light'){document.documentElement.dataset.theme=effective;document.documentElement.style.colorScheme=effective;}
  if(preference)document.documentElement.dataset.themePreference=preference;
}

async function render(){
  syncTheme();
  const api=bridge();
  if(!api){$('disabledNotice').classList.remove('hidden');$('disabledNotice').textContent='Capy-Br\u00fccke zum Finanzplan ist nicht verf\u00fcgbar.';$('content').classList.add('hidden');$('historyCard').classList.add('hidden');return;}
  const s=api.snapshot();
  $('disabledNotice').classList.toggle('hidden',s.enabled);
  $('content').classList.toggle('hidden',!s.enabled);
  $('historyCard').classList.toggle('hidden',!s.enabled);
  $('title').textContent=s.budgetName;
  $('stash').textContent=money(s.stashBalanceCents);
  $('lockedStash').textContent=money(s.lockedStashCents);
  $('withdrawableStash').textContent=money(s.withdrawableStashCents);
  $('nextUnlock').textContent=s.nextUnlockDate?dateName(s.nextUnlockDate):'Alles freigegeben';
  $('coins').textContent=String(s.coins);
  $('coinRate').textContent=`${s.coinsPerEuro} Coin${s.coinsPerEuro===1?'':'s'} / \u20ac`;
  $('month').textContent=monthName(s.month);
  $('budgetName').textContent=s.budgetName;
  $('topUpHint').textContent=`Mindestens ${money(s.minimumTopUpCents)}. Je 1 \u20ac erh\u00e4ltst du ${s.coinsPerEuro} Coin${s.coinsPerEuro===1?'':'s'}. Neue Einzahlungen sind ${s.stashLockMonths} Monat${s.stashLockMonths===1?'':'e'} gesperrt.`;
  $('withdrawHint').textContent=s.withdrawableStashCents>0?`${money(s.withdrawableStashCents)} sind aktuell auszahlbar.`:(s.nextUnlockDate?`N\u00e4chste Freigabe am ${dateName(s.nextUnlockDate)}.`:'Aktuell ist kein Guthaben auszahlbar.');
  $('withdraw').disabled=s.withdrawableStashCents<=0;
  const img=$('coinIcon'),fallback=$('coinFallback');
  img.style.display='inline-block';fallback.style.display='none';img.src=s.coinImage||'./assets/ui/coins.png';img.onerror=()=>{img.style.display='none';fallback.style.display='grid';};
  $('history').innerHTML=s.history.length?s.history.map(row=>`<div class="history-row"><div><strong>${row.type==='budget_to_cash'?'Aus Vorrat ausgezahlt':'Vorrat aufgeladen'}</strong><br><small>${dateName(row.date)}${row.type==='cash_to_budget'&&row.unlockDate?` \u00b7 ${row.locked?'gesperrt':'freigegeben'} ab ${dateName(row.unlockDate)}`:''}${row.note?` \u00b7 ${escapeHtml(row.note)}`:''}</small></div><strong>${row.type==='budget_to_cash'?'-':'+'}${money(row.amountCents)}</strong></div>`).join(''):'<div class="empty">Noch keine Vorrat-Bewegungen.</div>';
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
$('topUp').addEventListener('click',()=>{try{const cents=parseEuro($('topUpAmount').value);bridge().topUp(cents);$('topUpAmount').value='';render();}catch(error){alert(error.message);}});
$('withdraw').addEventListener('click',()=>{try{const cents=parseEuro($('withdrawAmount').value);bridge().withdraw(cents);$('withdrawAmount').value='';render();}catch(error){alert(error.message);}});
$('openMonth').addEventListener('click',()=>bridge()?.openMonth());
window.addEventListener('message',event=>{if(event.data?.type==='capyt-capy-refresh'){syncTheme(event.data);render();}});
syncTheme();
render();
