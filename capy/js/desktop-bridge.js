(() => {
  'use strict';
  const CAPY_BUDGET_ID='capy-vorrat';
  let economy={coinsPerEuro:1,minimumTopUpCents:100,coinImage:'./assets/ui/coins.png',vorratCategory:'Capy Vorrat'};
  fetch('../capy/settings/economy.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(v=>{if(v)economy={...economy,...v};renderHost();}).catch(()=>{});

  function now(){return new Date().toISOString();}
  function ensureState(){
    if(!isPlainObject(state.capy))state.capy={};
    const c=state.capy;
    c.version=1;c.enabled=Boolean(c.enabled);c.budgetId=CAPY_BUDGET_ID;c.coins=Math.max(0,Math.floor(asNumber(c.coins)));
    if(!Array.isArray(c.appliedCoinOps))c.appliedCoinOps=[];
    if(!isPlainObject(c.care))c.care=null;
    if(!c.updatedAt)c.updatedAt=now();
    return c;
  }
  function budgetName(){const c=ensureState(),name=String(c.care?.name||'').trim();return `${name||'Capy'} Vorrat`;}
  function ensureBudget(create=ensureState().enabled){
    const c=ensureState(); let b=(state.variableBudgets||[]).find(x=>String(x.id)===CAPY_BUDGET_ID),changed=false;
    if(!b&&!create)return {budget:null,changed:false};
    if(!b){b={id:CAPY_BUDGET_ID,description:budgetName(),category:String(economy.vorratCategory||'Capy Vorrat'),amount:0,interval:'monthly',nextDue:state.meta.start,startBalance:0,capyManaged:true};state.variableBudgets.push(b);changed=true;}
    const desired=budgetName(); if(b.description!==desired){b.description=desired;changed=true;} if(b.category!==String(economy.vorratCategory||'Capy Vorrat')){b.category=String(economy.vorratCategory||'Capy Vorrat');changed=true;}
    if(!b.capyManaged){b.capyManaged=true;changed=true;} if(b.amount!==0){b.amount=0;changed=true;} if(b.interval!=='monthly'){b.interval='monthly';changed=true;}
    c.budgetId=CAPY_BUDGET_ID; return {budget:b,changed};
  }
  function balanceCents(ym=selectedMonth){const result=currentResults()[ym];return Math.round(asNumber(result?.budgetDetails?.[CAPY_BUDGET_ID]?.closingBalance)*100);}
  function history(){
    const rows=[];for(const ym of planningMonths()){for(const tx of (state.months[ym]?.budgetTransactions||[])){if(String(tx.budgetId||tx.fromBudgetId||tx.toBudgetId)!==CAPY_BUDGET_ID&&String(tx.fromBudgetId)!==CAPY_BUDGET_ID&&String(tx.toBudgetId)!==CAPY_BUDGET_ID)continue;if(!['cash_to_budget','budget_to_cash'].includes(tx.type))continue;rows.push({id:String(tx.id),month:ym,type:tx.type,amountCents:Math.round(asNumber(tx.amount)*100),note:String(tx.note||'')});}}
    return rows.reverse().slice(0,100);
  }
  function snapshot(){const c=ensureState();ensureBudget(c.enabled);return {enabled:c.enabled,budgetId:CAPY_BUDGET_ID,budgetName:budgetName(),stashBalanceCents:balanceCents(),coins:c.coins,coinsPerEuro:Math.max(0,Number(economy.coinsPerEuro)||1),minimumTopUpCents:Math.max(1,Math.floor(Number(economy.minimumTopUpCents)||100)),coinImage:String(economy.coinImage||'./assets/ui/coins.png'),month:selectedMonth,history:history()};}
  function syncSnapshot(ym){const c=ensureState();ensureBudget(c.enabled);return {enabled:c.enabled,budgetId:CAPY_BUDGET_ID,budgetName:budgetName(),stashBalanceCents:balanceCents(ym),coins:c.coins,acknowledgedCoinOpIds:c.appliedCoinOps.slice(-5000),care:c.care?deepClone(c.care):null};}
  function setEnabled(enabled){const c=ensureState();c.enabled=Boolean(enabled);c.updatedAt=now();ensureBudget();updateAndSave(c.enabled?'Capy aktiviert':'Capy deaktiviert');if(!c.enabled&&activeView==='capy')showView('basics');renderHost();}
  function topUp(amountCents){
    const c=ensureState();if(!c.enabled)throw new Error('Capy ist deaktiviert.');const cents=Number(amountCents);if(!Number.isSafeInteger(cents)||cents<Math.max(1,Number(economy.minimumTopUpCents)||100))throw new Error('Bitte einen gültigen Aufladebetrag eingeben.');
    const data=state.months[selectedMonth];if(!data)throw new Error('Monat nicht gefunden.');if(data.locked)throw new Error('Der ausgewählte Monat ist bereits abgeschlossen.');ensureBudget();
    data.budgetTransactions=data.budgetTransactions||[];data.budgetTransactions.push({id:uid('capy-vorrat'),type:'cash_to_budget',budgetId:CAPY_BUDGET_ID,fromBudgetId:'',toBudgetId:CAPY_BUDGET_ID,amount:roundMoney(cents/100),date:'',note:'Capy Vorrat aufgeladen'});
    const reward=Math.max(1,Math.floor((cents/100)*(Number(economy.coinsPerEuro)||1)));c.coins+=reward;c.updatedAt=now();updateAndSave(`Capy Vorrat aufgeladen · ${reward} Coin${reward===1?'':'s'}`);return snapshot();
  }
  function applyMobileSync(payload){
    if(!payload||typeof payload!=='object')return {coinOps:0,care:false};const c=ensureState(),known=new Set(c.appliedCoinOps.map(String));let coinOps=0;
    for(const op of Array.isArray(payload.coinOps)?payload.coinOps:[]){const id=String(op?.id||'');if(!id||known.has(id))continue;const delta=Math.trunc(Number(op.delta)||0);c.coins=Math.max(0,c.coins+delta);c.appliedCoinOps.push(id);known.add(id);coinOps++;}
    c.appliedCoinOps=[...new Set(c.appliedCoinOps.map(String))].slice(-5000);
    let care=false;const remote=payload.care&&typeof payload.care==='object'?payload.care:null;if(remote){const rt=Date.parse(remote.updatedAt||'')||0,lt=Date.parse(c.care?.updatedAt||'')||0;if(!c.care||rt>=lt){c.care=deepClone(remote);care=true;}}
    c.updatedAt=now();const {changed}=ensureBudget(c.enabled);if(changed||coinOps||care)saveState('Capy Mobile-Daten übernommen');renderHost();return {coinOps,care};
  }
  function decorateBasics(){
    const toggle=document.getElementById('capyFeatureEnabled');if(toggle)toggle.checked=ensureState().enabled;const status=document.getElementById('capyFeatureBudgetName');if(status)status.textContent=budgetName();
    document.querySelectorAll(`[data-collection="variableBudgets"][data-id="${CAPY_BUDGET_ID}"]`).forEach(el=>{el.disabled=true;el.title='Dieses Budget wird von Capy verwaltet.';});
    const del=document.querySelector(`[data-delete="variableBudgets"][data-id="${CAPY_BUDGET_ID}"]`);if(del){del.disabled=true;del.title='Capy-Budget wird über die Capy-Einstellung verwaltet.';}
  }
  function renderHost(){
    const c=ensureState();const {changed}=ensureBudget(c.enabled);if(changed)saveState('Capy-Budget aktualisiert');const nav=document.getElementById('capyDesktopNav');if(nav)nav.classList.toggle('hidden',!c.enabled);decorateBasics();const frame=document.getElementById('capyDesktopFrame');frame?.contentWindow?.postMessage({type:'capyt-capy-refresh'},'*');
  }
  function openMonth(){showView('month');}
  globalThis.CapytCapyDesktopBridge={snapshot,syncSnapshot,setEnabled,topUp,applyMobileSync,renderHost,openMonth,isEnabled:()=>ensureState().enabled,budgetId:CAPY_BUDGET_ID};
  document.getElementById('capyFeatureEnabled')?.addEventListener('change',e=>setEnabled(e.target.checked));
  renderHost();
  if(location.hash==='#capy')showView(ensureState().enabled?'capy':'basics');
})();
