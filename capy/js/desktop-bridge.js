(() => {
  'use strict';
  const CAPY_BUDGET_ID='capy-vorrat';
  let economy={coinsPerEuro:1,minimumTopUpCents:100,coinImage:'./assets/ui/coins.png',vorratCategory:'Capy Vorrat',stashLockMonths:1};
  fetch('../capy/settings/economy.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(v=>{if(v)economy={...economy,...v};renderHost();}).catch(()=>{});

  function now(){return new Date().toISOString();}
  function clockDate(){const d=globalThis.__CAPY_NOW__?new Date(globalThis.__CAPY_NOW__):new Date();return Number.isNaN(d.getTime())?new Date():d;}
  function dateString(d=clockDate()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function validDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''));}
  function monthOfDate(value){return validDate(value)?String(value).slice(0,7):'';}
  function lockMonths(){const n=Number(economy.stashLockMonths);return Number.isFinite(n)?Math.max(0,Math.floor(n)):1;}
  function addMonthsToDate(value,count=lockMonths()){
    if(!validDate(value))return '';
    const [year,month,day]=String(value).split('-').map(Number),index=(month-1)+Math.max(0,Math.floor(Number(count)||0));
    const targetYear=year+Math.floor(index/12),targetMonth=((index%12)+12)%12,lastDay=new Date(targetYear,targetMonth+1,0).getDate();
    return `${targetYear}-${String(targetMonth+1).padStart(2,'0')}-${String(Math.min(day,lastDay)).padStart(2,'0')}`;
  }
  function referenceDate(ym=selectedMonth){const today=dateString();return monthOfDate(today)===ym?today:`${ym}-01`;}
  function txDate(tx,ym){return validDate(tx?.date)?String(tx.date):`${ym}-01`;}
  function unlockDate(tx,ym){return validDate(tx?.capyUnlockDate)?String(tx.capyUnlockDate):addMonthsToDate(txDate(tx,ym));}
  function ensureState(){
    if(!isPlainObject(state.capy))state.capy={};
    const c=state.capy;
    c.version=2;c.enabled=Boolean(c.enabled);c.budgetId=CAPY_BUDGET_ID;c.coins=Math.max(0,Math.floor(asNumber(c.coins)));
    if(!Array.isArray(c.appliedCoinOps))c.appliedCoinOps=[];
    if(!isPlainObject(c.care))c.care=null;
    if(!c.updatedAt)c.updatedAt=now();
    return c;
  }
  function budgetName(){const c=ensureState(),name=String(c.care?.name||'').trim();return globalThis.CapytCapyNaming?.budgetName(name)||'Capy-Vorrat';}
  function ensureBudget(create=ensureState().enabled){
    const c=ensureState(); let b=(state.variableBudgets||[]).find(x=>String(x.id)===CAPY_BUDGET_ID),changed=false;
    if(!b&&!create)return {budget:null,changed:false};
    if(!b){b={id:CAPY_BUDGET_ID,description:budgetName(),category:String(economy.vorratCategory||'Capy Vorrat'),amount:0,interval:'monthly',nextDue:state.meta.start,startBalance:0,capyManaged:true};state.variableBudgets.push(b);changed=true;}
    const desired=budgetName(); if(b.description!==desired){b.description=desired;changed=true;} if(b.category!==String(economy.vorratCategory||'Capy Vorrat')){b.category=String(economy.vorratCategory||'Capy Vorrat');changed=true;}
    if(!b.capyManaged){b.capyManaged=true;changed=true;} if(b.amount!==0){b.amount=0;changed=true;} if(b.interval!=='monthly'){b.interval='monthly';changed=true;}
    c.budgetId=CAPY_BUDGET_ID; return {budget:b,changed};
  }
  function balanceCents(ym=selectedMonth){const result=currentResults()[ym];return Math.max(0,Math.round(asNumber(result?.budgetDetails?.[CAPY_BUDGET_ID]?.closingBalance)*100));}
  function movements(){
    const rows=[];
    for(const ym of planningMonths())for(const tx of (state.months[ym]?.budgetTransactions||[])){
      const relevant=String(tx.budgetId||tx.fromBudgetId||tx.toBudgetId)===CAPY_BUDGET_ID||String(tx.fromBudgetId)===CAPY_BUDGET_ID||String(tx.toBudgetId)===CAPY_BUDGET_ID;
      if(!relevant||!['cash_to_budget','budget_to_cash'].includes(tx.type))continue;
      rows.push({tx,month:ym,date:txDate(tx,ym),unlockDate:tx.type==='cash_to_budget'?unlockDate(tx,ym):''});
    }
    return rows.sort((a,b)=>a.date.localeCompare(b.date)||String(a.tx.id).localeCompare(String(b.tx.id)));
  }
  function lockStatus(ym=selectedMonth){
    const asOf=referenceDate(ym),balance=balanceCents(ym),rows=movements();let matured=0,withdrawn=0;const futureUnlocks=[];
    for(const row of rows){const cents=Math.round(asNumber(row.tx.amount)*100);if(row.tx.type==='cash_to_budget'){if(row.unlockDate<=asOf)matured+=cents;else if(row.date<=asOf)futureUnlocks.push(row.unlockDate);}else if(row.date<=asOf)withdrawn+=cents;}
    const withdrawable=Math.max(0,Math.min(balance,matured-withdrawn));
    return {asOf,lockMonths:lockMonths(),balanceCents:balance,withdrawableCents:withdrawable,lockedCents:Math.max(0,balance-withdrawable),nextUnlockDate:futureUnlocks.sort()[0]||''};
  }
  function history(){
    const today=dateString();
    return movements().slice().reverse().slice(0,100).map(row=>({id:String(row.tx.id),month:row.month,date:row.date,type:row.tx.type,amountCents:Math.round(asNumber(row.tx.amount)*100),note:String(row.tx.note||''),unlockDate:row.unlockDate,locked:row.tx.type==='cash_to_budget'&&row.unlockDate>today}));
  }
  function snapshot(){const c=ensureState();ensureBudget(c.enabled);const lock=lockStatus();return {enabled:c.enabled,budgetId:CAPY_BUDGET_ID,budgetName:budgetName(),stashBalanceCents:lock.balanceCents,withdrawableStashCents:lock.withdrawableCents,lockedStashCents:lock.lockedCents,nextUnlockDate:lock.nextUnlockDate,stashLockMonths:lock.lockMonths,coins:c.coins,coinsPerEuro:Math.max(0,Number(economy.coinsPerEuro)||1),minimumTopUpCents:Math.max(1,Math.floor(Number(economy.minimumTopUpCents)||100)),coinImage:String(economy.coinImage||'./assets/ui/coins.png'),month:selectedMonth,history:history()};}
  function syncSnapshot(ym){const c=ensureState();ensureBudget(c.enabled);const lock=lockStatus(ym);return {enabled:c.enabled,budgetId:CAPY_BUDGET_ID,budgetName:budgetName(),stashBalanceCents:lock.balanceCents,withdrawableStashCents:lock.withdrawableCents,lockedStashCents:lock.lockedCents,nextUnlockDate:lock.nextUnlockDate,stashLockMonths:lock.lockMonths,coins:c.coins,acknowledgedCoinOpIds:c.appliedCoinOps.slice(-5000),care:c.care?deepClone(c.care):null};}
  function setEnabled(enabled){const c=ensureState();c.enabled=Boolean(enabled);c.updatedAt=now();ensureBudget();updateAndSave(c.enabled?'Capy aktiviert':'Capy pausiert');if(!c.enabled&&activeView==='capy')showView('basics');renderHost();}
  function topUp(amountCents){
    const c=ensureState();if(!c.enabled)throw new Error('Capy ist pausiert.');const cents=Number(amountCents);if(!Number.isSafeInteger(cents)||cents<Math.max(1,Number(economy.minimumTopUpCents)||100))throw new Error('Bitte einen g\u00fcltigen Aufladebetrag eingeben.');
    const data=state.months[selectedMonth];if(!data)throw new Error('Monat nicht gefunden.');if(data.locked)throw new Error('Der ausgew\u00e4hlte Monat ist bereits abgeschlossen.');ensureBudget();
    const date=referenceDate(selectedMonth),capyUnlockDate=addMonthsToDate(date);
    data.budgetTransactions=data.budgetTransactions||[];data.budgetTransactions.push({id:uid('capy-vorrat'),type:'cash_to_budget',budgetId:CAPY_BUDGET_ID,fromBudgetId:'',toBudgetId:CAPY_BUDGET_ID,amount:roundMoney(cents/100),date,capyUnlockDate,note:`Capy Vorrat aufgeladen \u00b7 gesperrt bis ${capyUnlockDate}`});
    const reward=Math.max(1,Math.floor((cents/100)*(Number(economy.coinsPerEuro)||1)));c.coins+=reward;c.updatedAt=now();updateAndSave(`Capy Vorrat aufgeladen \u00b7 ${reward} Coin${reward===1?'':'s'}`);return snapshot();
  }
  function withdraw(amountCents){
    const c=ensureState();if(!c.enabled)throw new Error('Capy ist pausiert.');const cents=Number(amountCents);if(!Number.isSafeInteger(cents)||cents<=0)throw new Error('Bitte einen g\u00fcltigen Auszahlungsbetrag eingeben.');
    const data=state.months[selectedMonth];if(!data)throw new Error('Monat nicht gefunden.');if(data.locked)throw new Error('Der ausgew\u00e4hlte Monat ist bereits abgeschlossen.');ensureBudget();
    const lock=lockStatus(selectedMonth);if(cents>lock.withdrawableCents){const available=(lock.withdrawableCents/100).toFixed(2).replace('.',',');throw new Error(`Aktuell sind nur ${available} EUR zur Auszahlung freigegeben. Einzahlungen bleiben ${lock.lockMonths} Monat${lock.lockMonths===1?'':'e'} gesperrt.`);}
    const date=referenceDate(selectedMonth);data.budgetTransactions=data.budgetTransactions||[];data.budgetTransactions.push({id:uid('capy-auszahlung'),type:'budget_to_cash',budgetId:CAPY_BUDGET_ID,fromBudgetId:CAPY_BUDGET_ID,toBudgetId:'',amount:roundMoney(cents/100),date,note:'Capy Vorrat ausgezahlt'});
    c.updatedAt=now();updateAndSave('Capy Vorrat ausgezahlt');return snapshot();
  }
  function applyMobileSync(payload){
    if(!payload||typeof payload!=='object')return {coinOps:0,care:false,enabled:false};const c=ensureState(),known=new Set(c.appliedCoinOps.map(String));let coinOps=0,enabledChanged=false;
    if(typeof payload.enabled==='boolean'&&c.enabled!==payload.enabled){c.enabled=payload.enabled;enabledChanged=true;}
    for(const op of Array.isArray(payload.coinOps)?payload.coinOps:[]){const id=String(op?.id||'');if(!id||known.has(id))continue;const delta=Math.trunc(Number(op.delta)||0);c.coins=Math.max(0,c.coins+delta);c.appliedCoinOps.push(id);known.add(id);coinOps++;}
    c.appliedCoinOps=[...new Set(c.appliedCoinOps.map(String))].slice(-5000);
    let care=false;const remote=payload.care&&typeof payload.care==='object'?payload.care:null;if(remote){const rt=Date.parse(remote.updatedAt||'')||0,lt=Date.parse(c.care?.updatedAt||'')||0;if(!c.care||rt>=lt){c.care=deepClone(remote);care=true;}}
    c.updatedAt=now();const {changed}=ensureBudget(c.enabled);if(changed||coinOps||care||enabledChanged)saveState('Capy Mobile-Daten übernommen');if(!c.enabled&&activeView==='capy')showView('basics');renderHost();return {coinOps,care,enabled:enabledChanged};
  }
  function decorateBasics(){
    const toggle=document.getElementById('capyFeatureEnabled');if(toggle)toggle.checked=ensureState().enabled;const status=document.getElementById('capyFeatureBudgetName');if(status)status.textContent=budgetName();
    document.querySelectorAll(`[data-collection="variableBudgets"][data-id="${CAPY_BUDGET_ID}"]`).forEach(el=>{el.disabled=true;el.title='Dieses Budget wird von Capy verwaltet.';});
    const del=document.querySelector(`[data-delete="variableBudgets"][data-id="${CAPY_BUDGET_ID}"]`);if(del){del.disabled=true;del.title='Capy-Budget wird \u00fcber die Capy-Einstellung verwaltet.';}
  }
  function renderHost(){
    const c=ensureState();const {changed}=ensureBudget(c.enabled);if(changed)saveState('Capy-Budget aktualisiert');const nav=document.getElementById('capyDesktopNav');if(nav)nav.classList.toggle('hidden',!c.enabled);decorateBasics();const frame=document.getElementById('capyDesktopFrame');frame?.contentWindow?.postMessage({type:'capyt-capy-refresh',theme:document.documentElement?.dataset?.theme||'',themePreference:document.documentElement?.dataset?.themePreference||''},'*');
  }
  function openMonth(){showView('month');}
  globalThis.CapytCapyDesktopBridge={snapshot,syncSnapshot,setEnabled,topUp,withdraw,lockStatus,lockDateFor:date=>addMonthsToDate(date),applyMobileSync,renderHost,openMonth,isEnabled:()=>ensureState().enabled,budgetId:CAPY_BUDGET_ID};
  document.getElementById('capyFeatureEnabled')?.addEventListener('change',e=>{if(!e.target.checked){const name=ensureState().care?.name||'Capy';if(!confirm(`Capy-Begleiter pausieren?\n\n${name} und dein Fortschritt bleiben gespeichert. Während der Pause verändern sich seine Bedürfnisse nicht.`)){e.target.checked=true;return;}}setEnabled(e.target.checked);});
  renderHost();
  if(location.hash==='#capy')showView(ensureState().enabled?'capy':'basics');
})();
