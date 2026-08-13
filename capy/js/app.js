import { formatCents, parseEuroToCents } from '../../js/utils.js';
import { loadCapyConfig } from './config.js';
import { addJournal, applyRemoteCapy, availableCoins, loadCapyState, queueCoinOp, saveCapyState, touchCare } from './shared-state.js';
import { applyElapsedDecay, applyFood, applyPet, applyPlay, canPlay, chooseVisual, currentPhase, genderCopy } from './engine.js';
import { createStashDeposit, loadFinanceContext, stashBalanceCents } from './finance-adapter.js';

const $=id=>document.getElementById(id);
const els={
  enabledState:$('enabledState'),disabledState:$('disabledState'),headerTitle:$('headerTitle'),coinIconTop:$('coinIconTop'),coinCountTop:$('coinCountTop'),coinCountShop:$('coinCountShop'),
  pages:[...document.querySelectorAll('.page')],nav:[...document.querySelectorAll('[data-nav]')],capyName:$('capyName'),capyGender:$('capyGender'),capyMeta:$('capyMeta'),phasePill:$('phasePill'),scene:$('scene'),capyImage:$('capyImage'),effectsLayer:$('effectsLayer'),moodValue:$('moodValue'),statusHint:$('statusHint'),
  hungerValue:$('hungerValue'),happinessValue:$('happinessValue'),energyValue:$('energyValue'),bondValue:$('bondValue'),hungerBar:$('hungerBar'),happinessBar:$('happinessBar'),energyBar:$('energyBar'),bondBar:$('bondBar'),
  petButton:$('petButton'),playButton:$('playButton'),openFoodButton:$('openFoodButton'),foodList:$('foodList'),inventoryList:$('inventoryList'),journalList:$('journalList'),
  stashValueMini:$('stashValueMini'),stashValue:$('stashValue'),stashLocked:$('stashLocked'),stashWithdrawable:$('stashWithdrawable'),stashUnlockHint:$('stashUnlockHint'),vorratNameMini:$('vorratNameMini'),vorratName:$('vorratName'),topUpAmount:$('topUpAmount'),coinRewardHint:$('coinRewardHint'),topUpButton:$('topUpButton'),
  setupModal:$('setupModal'),openSafeButton:$('openSafeButton'),finishSetupButton:$('finishSetupButton'),nameInput:$('nameInput'),genderInfo:$('genderInfo'),revealTitle:$('revealTitle'),setupStages:[...document.querySelectorAll('[data-setup-stage]')],toast:$('toast')
};

let config;
let capy;
let plan=null;
let transactions=[];
let runtimeVisual='';
let runtimeTimer=0;
let toastTimer=0;

boot().catch(error=>{
  console.error(error);
  document.body.insertAdjacentHTML('afterbegin',`<div style="padding:1rem;background:#8b1e35;color:white">Capy konnte nicht gestartet werden: ${escapeHtml(error.message)}</div>`);
});

async function boot(){
  config=await loadCapyConfig();
  capy=await loadCapyState(config.behavior.initialNeeds);
  await refreshFinance(true);
  configureVisualAssets();
  bindEvents();
  if(capy.enabled&&capy.care.initialized){
    applyElapsedDecay(capy.care,config.behavior);
    touchCare(capy);
    await saveCapyState(capy);
  }
  renderAll();
  if(capy.enabled&&!capy.care.initialized){showSetupStage('safe');els.setupModal.showModal();}
  setInterval(async()=>{
    if(!capy.enabled||!capy.care.initialized)return;
    applyElapsedDecay(capy.care,config.behavior);touchCare(capy);await saveCapyState(capy);renderAll();
  },Math.max(15000,Number(config.behavior.decayTickMs)||60000));
  document.addEventListener('visibilitychange',async()=>{if(document.visibilityState==='visible'){await refreshFinance(true);if(capy.enabled&&capy.care.initialized){applyElapsedDecay(capy.care,config.behavior);touchCare(capy);await saveCapyState(capy);}renderAll();}});
}

async function refreshFinance(applyRemote=false){
  const finance=await loadFinanceContext();plan=finance.plan;transactions=finance.transactions;
  if(applyRemote){
    if(plan?.capy){capy=applyRemoteCapy(capy,plan.capy,plan.acknowledgedExportIds||[]);await saveCapyState(capy);}
    else {capy.enabled=false;capy.budgetId='';await saveCapyState(capy);}
  }
}

function configureVisualAssets(){
  const iconPath=String(config.economy.coinImage||'');
  if(iconPath){els.coinIconTop.src=iconPath;els.coinIconTop.addEventListener('error',()=>{els.coinIconTop.hidden=true;},{once:true});}else els.coinIconTop.hidden=true;
  const room=config.behavior.room||{};
  if(room.backgroundImage){els.scene.style.backgroundImage=`url("${String(room.backgroundImage).replaceAll('"','\\"')}")`;els.scene.style.backgroundPosition=room.backgroundPosition||'center';els.scene.style.backgroundSize=room.backgroundSize||'cover';}
  const rate=Number(config.economy.coinsPerEuro)||1;
  els.coinRewardHint.textContent=`1,00 € = ${formatCoin(rate)} Coin${rate===1?'':'s'} · Preise in settings/items.json`;
}

function bindEvents(){
  els.nav.forEach(button=>button.addEventListener('click',()=>navigate(button.dataset.nav)));
  document.querySelectorAll('[data-nav-target]').forEach(button=>button.addEventListener('click',()=>navigate(button.dataset.navTarget)));
  els.openFoodButton.addEventListener('click',()=>navigate('shop'));
  els.openSafeButton.addEventListener('click',()=>{
    const genders=(config.behavior.genders||['weiblich','männlich']).filter(g=>g==='weiblich'||g==='männlich');
    capy.care.gender=genders[Math.floor(Math.random()*genders.length)]||'männlich';
    const info=genderCopy(capy.care.gender);els.genderInfo.textContent=`Zufällig bestimmt: ${info.label} ${info.mark}`;els.revealTitle.textContent='Hallo! Ich bin dein neues Capy.';showSetupStage('name');setTimeout(()=>els.nameInput.focus(),180);
  });
  els.finishSetupButton.addEventListener('click',finishSetup);els.nameInput.addEventListener('keydown',event=>{if(event.key==='Enter')finishSetup();});
  els.petButton.addEventListener('click',petCapy);els.playButton.addEventListener('click',playCapy);els.topUpButton.addEventListener('click',topUpVorrat);
}

async function finishSetup(){
  const name=els.nameInput.value.trim();if(!name){showToast('Bitte gib deinem Capy einen Namen.');els.nameInput.focus();return;}
  capy.care.initialized=true;capy.care.name=name.slice(0,20);capy.care.lastUpdate=Date.now();
  addJournal(capy,'home',`${capy.care.name} ist in den Vorrat eingezogen.`,config.behavior.maxJournalEntries);touchCare(capy);await saveCapyState(capy);els.setupModal.close();setRuntimeVisual('celebrate',animationMs('celebrate',1300),'capy--celebrate');spawnEffect('confetti',38,27,true);spawnEffect('sparkle',68,24,true);renderAll();showToast(`Willkommen, ${capy.care.name}!`);
}

function navigate(page){
  if(!['home','shop','stash'].includes(page))return;
  els.pages.forEach(el=>el.classList.toggle('is-active',el.dataset.page===page));els.nav.forEach(el=>el.classList.toggle('is-active',el.dataset.nav===page));els.headerTitle.textContent=page==='home'?'Zuhause':page==='shop'?'Shop':'Vorrat';window.scrollTo({top:0,behavior:'smooth'});
}

async function petCapy(){
  const phase=currentPhase(config.behavior);
  if(phase.key==='night'&&config.behavior.sleep?.blocksPet!==false){spawnEffect('zzz',68,24,false);showToast(`${capy.care.name||'Capy'} schläft.`);return;}
  applyPet(capy.care,config.behavior);addJournal(capy,'heart',`${capy.care.name||'Capy'} wurde gestreichelt.`,config.behavior.maxJournalEntries);touchCare(capy);await saveCapyState(capy);animateCapy('capy--pet',animationMs('pet',520));spawnEffect('heart',61,30,true);renderAll();
}
async function playCapy(){
  if(currentPhase(config.behavior).key==='night'&&config.behavior.sleep?.blocksPlay!==false)return;
  if(!canPlay(capy.care,config.behavior)){showToast(`${capy.care.name||'Capy'} ist zu müde zum Spielen.`);return;}
  applyPlay(capy.care,config.behavior);addJournal(capy,'play',`${capy.care.name||'Capy'} hat mit dir gespielt.`,config.behavior.maxJournalEntries);touchCare(capy);await saveCapyState(capy);animateCapy('capy--play',animationMs('play',760));spawnEffect('sparkle',38,29,true);renderAll();
}

async function topUpVorrat(){
  const cents=parseEuroToCents(els.topUpAmount.value);
  const minimum=Math.max(1,Number(config.economy.minimumTopUpCents)||100);
  if(!Number.isSafeInteger(cents)||cents<minimum){showToast(`Mindestens ${formatCents(minimum)} aufladen.`);return;}
  if(!plan?.capy?.enabled){showToast('Bitte zuerst einen aktuellen Capy-Plan synchronisieren.');return;}
  const coins=Math.max(1,Math.floor((cents/100)*(Number(config.economy.coinsPerEuro)||1)));
  try{
    const tx=await createStashDeposit({plan,amountCents:cents,name:capy.care.name||'Capy'});queueCoinOp(capy,coins,`Vorrat +${formatCents(cents)}`,tx.id);addJournal(capy,'coin',`${formatCents(cents)} in ${vorratName()} gelegt · +${coins} Coin${coins===1?'':'s'}.`,config.behavior.maxJournalEntries);touchCare(capy);await saveCapyState(capy);els.topUpAmount.value='';await refreshFinance(false);renderAll();spawnEffect('coin',50,34,true);showToast(`+${coins} Coin${coins===1?'':'s'} · beim nächsten Sync zum PC übertragen.`);
  }catch(error){showToast(error.message);}
}

async function buyItem(item){
  const price=Math.max(0,Math.floor(Number(item.priceCoins)||0));
  if(availableCoins(capy)<price){showToast('Nicht genug Coins. Lade zuerst deinen Vorrat auf.');return;}
  queueCoinOp(capy,-price,`${item.name} gekauft`);capy.care.inventory[item.id]=Math.max(0,Math.floor(Number(capy.care.inventory[item.id])||0))+1;addJournal(capy,'shop',`${item.name} für ${price} Coin${price===1?'':'s'} gekauft.`,config.behavior.maxJournalEntries);touchCare(capy);await saveCapyState(capy);renderAll();showToast(`${item.name} liegt jetzt im Inventar.`);
}

async function feedItem(item){
  const count=Math.max(0,Math.floor(Number(capy.care.inventory[item.id])||0));
  if(count<1){showToast(`${item.name} ist nicht im Inventar.`);return;}
  if(currentPhase(config.behavior).key==='night'&&config.behavior.sleep?.blocksFood!==false){showToast(`${capy.care.name||'Capy'} schläft gerade.`);return;}
  capy.care.inventory[item.id]=count-1;applyFood(capy.care,item);addJournal(capy,'food',`${capy.care.name||'Capy'} hat ${item.name} bekommen.`,config.behavior.maxJournalEntries);touchCare(capy);await saveCapyState(capy);setRuntimeVisual('eating',animationMs('feed',900),'capy--feed');spawnEffect('heart',63,31,false);renderAll();showToast(`${item.name} verfüttert.`);
}

function renderAll(){
  const enabled=Boolean(capy.enabled&&plan?.capy?.enabled);els.disabledState.classList.toggle('hidden',enabled);els.enabledState.classList.toggle('hidden',!enabled);document.querySelector('.capy-nav').classList.toggle('hidden',!enabled);if(!enabled)return;
  renderProfile();renderNeeds();renderWallet();renderShop();renderInventory();renderJournal();renderCapy();
}

function renderProfile(){
  const phase=currentPhase(config.behavior);const gender=genderCopy(capy.care.gender);const name=capy.care.initialized?capy.care.name:'Capy';els.capyName.textContent=name;els.capyGender.textContent=capy.care.initialized?gender.mark:'';els.capyMeta.textContent=capy.care.initialized?`${gender.label} · ${phase.label} · ${formatCoin(availableCoins(capy))} Coins`:'Noch nicht eingerichtet';els.phasePill.textContent=phase.label;
}
function renderNeeds(){setNeed(els.hungerValue,els.hungerBar,capy.care.hunger);setNeed(els.happinessValue,els.happinessBar,capy.care.happiness);setNeed(els.energyValue,els.energyBar,capy.care.energy);setNeed(els.bondValue,els.bondBar,capy.care.bond);}
function renderWallet(){
  const coins=availableCoins(capy),stash=stashBalanceCents(plan,transactions),name=vorratName();const pendingLocked=(transactions||[]).filter(t=>!t.deleted&&t.status!=='confirmed'&&t.kind==='capy_stash_deposit').reduce((sum,t)=>sum+(Number(t.amountCents)||0),0);const locked=Math.max(0,Number(plan?.capy?.lockedStashCents)||0)+pendingLocked;const withdrawable=Math.max(0,Number(plan?.capy?.withdrawableStashCents)||0);els.coinCountTop.textContent=formatCoin(coins);els.coinCountShop.textContent=formatCoin(coins);els.stashValueMini.textContent=formatCents(stash);els.stashValue.textContent=formatCents(stash);els.stashLocked.textContent=formatCents(Math.min(stash,locked));els.stashWithdrawable.textContent=formatCents(Math.min(stash,withdrawable));els.stashUnlockHint.textContent=plan?.capy?.nextUnlockDate?`Nächste Freigabe am ${formatDate(plan.capy.nextUnlockDate)}. Auszahlung erfolgt am PC.`:`Einzahlungen bleiben ${Math.max(0,Number(plan?.capy?.stashLockMonths??config.economy.stashLockMonths)||0)} Monat${Number(plan?.capy?.stashLockMonths??config.economy.stashLockMonths)===1?'':'e'} gesperrt. Auszahlung erfolgt am PC.`;els.vorratNameMini.textContent=name;els.vorratName.textContent=name;
}
function renderShop(){
  const coins=availableCoins(capy);els.foodList.innerHTML=config.items.length?config.items.map(item=>{const count=Math.max(0,Math.floor(Number(capy.care.inventory[item.id])||0)),price=Math.max(0,Math.floor(Number(item.priceCoins)||0));return `<article class="food-card" data-item="${escapeHtml(item.id)}"><div class="food-icon"><img src="${escapeHtml(item.asset)}" alt=""></div><div class="food-copy"><div class="food-title"><strong>${escapeHtml(item.name)}</strong><span class="price">◉ ${price}</span></div><p>${escapeHtml(item.description||'')}</p><div class="food-meta"><span>Hunger +${Number(item.hunger)||0}</span><span>Glück +${Number(item.happiness)||0}</span><span>Bindung +${Number(item.bond)||0}</span><span>Inventar ${count}</span></div></div><div class="food-actions"><button type="button" data-buy="${escapeHtml(item.id)}" ${coins<price?'disabled':''}>Kaufen · ${price} ◉</button><button type="button" class="primary" data-feed="${escapeHtml(item.id)}" ${count<1?'disabled':''}>Füttern</button></div></article>`;}).join(''):'<div class="empty">Keine Items aktiviert.</div>';
  els.foodList.querySelectorAll('[data-buy]').forEach(button=>button.addEventListener('click',()=>buyItem(config.items.find(item=>item.id===button.dataset.buy))));els.foodList.querySelectorAll('[data-feed]').forEach(button=>button.addEventListener('click',()=>feedItem(config.items.find(item=>item.id===button.dataset.feed))));
}
function renderInventory(){
  const rows=config.items.map(item=>({item,count:Math.max(0,Math.floor(Number(capy.care.inventory[item.id])||0))})).filter(row=>row.count>0);els.inventoryList.innerHTML=rows.length?rows.map(({item,count})=>`<div class="inventory-row"><img src="${escapeHtml(item.asset)}" alt=""><div><strong>${escapeHtml(item.name)}</strong><small>${count}× vorhanden</small></div><button type="button" data-inventory-feed="${escapeHtml(item.id)}">Füttern</button></div>`).join(''):'<div class="empty">Noch keine Foods im Inventar.</div>';els.inventoryList.querySelectorAll('[data-inventory-feed]').forEach(button=>button.addEventListener('click',()=>feedItem(config.items.find(item=>item.id===button.dataset.inventoryFeed))));
}
function renderJournal(){const rows=capy.care.journal||[];els.journalList.innerHTML=rows.length?rows.slice(0,30).map(entry=>`<div class="journal-entry"><div class="journal-icon">${journalIcon(entry.type)}</div><div><small>${escapeHtml(entry.time||'')}</small><p>${escapeHtml(entry.text||'')}</p></div></div>`).join(''):'<div class="empty">Noch keine Ereignisse.</div>';}
function renderCapy(){
  const phase=currentPhase(config.behavior);const visual=runtimeVisual||chooseVisual(capy.care,phase,config.behavior);els.capyImage.src=`./assets/capy/capy-${visual}.png`;const mood=moodCopy(visual);els.capyImage.alt=`${capy.care.name||'Capy'} – ${mood.label}`;els.moodValue.textContent=mood.label;els.statusHint.textContent=mood.hint;els.capyImage.className=`capy ${runtimeVisual?els.capyImage.className.split(' ').find(x=>x.startsWith('capy--')&&x!=='capy--idle')||'capy--idle':visual==='sleeping'?'capy--sleeping':'capy--idle'}`;const sleeping=phase.key==='night';els.playButton.disabled=sleeping;els.openFoodButton.disabled=sleeping;if(sleeping&&!els.effectsLayer.querySelector('.effect--zzz'))spawnEffect('zzz',68,24,false);
}

function animationMs(key,fallback){return Math.max(1,Number(config?.behavior?.animationMs?.[key])||fallback);}
function setNeed(valueEl,barEl,value){const safe=Math.max(0,Math.min(100,Number(value)||0));valueEl.textContent=`${Math.round(safe)}%`;barEl.style.width=`${safe}%`;}
function vorratName(){return `${capy.care.name||'Capy'} Vorrat`;}
function formatCoin(value){return new Intl.NumberFormat('de-AT',{maximumFractionDigits:0}).format(Math.max(0,Math.floor(Number(value)||0)));}
function formatDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return '–';const [y,m,d]=String(value).split('-').map(Number);return new Intl.DateTimeFormat('de-AT',{day:'2-digit',month:'2-digit',year:'numeric'}).format(new Date(y,m-1,d));}
function moodCopy(visual){const name=capy.care.name||'Capy';return {neutral:{label:'Entspannt',hint:`${name} macht es sich im Vorrat gemütlich.`},happy:{label:'Glücklich',hint:`${name} fühlt sich richtig wohl.`},hungry:{label:'Hungrig',hint:`${name} hätte gern ein Food aus dem Inventar.`},sleepy:{label:'Müde',hint:`${name} wird langsam schläfrig.`},sleeping:{label:'Schläft',hint:`${name} ruht bis zum nächsten Morgen.`},eating:{label:'Mampft',hint:`${name} genießt das Food.`},celebrate:{label:'Feiert',hint:`${name} freut sich über seinen Vorrat.`}}[visual]||{label:'Entspannt',hint:`${name} ist da.`};}
function showSetupStage(name){els.setupStages.forEach(stage=>stage.classList.toggle('is-active',stage.dataset.setupStage===name));}
function animateCapy(className,duration){clearTimeout(runtimeTimer);els.capyImage.className=`capy ${className}`;runtimeTimer=setTimeout(()=>{els.capyImage.className='capy capy--idle';renderCapy();},duration);}
function setRuntimeVisual(visual,duration,className){runtimeVisual=visual;clearTimeout(runtimeTimer);els.capyImage.className=`capy ${className}`;runtimeTimer=setTimeout(()=>{runtimeVisual='';renderCapy();},duration);}
function spawnEffect(kind,left,top,large){const src=`./assets/effects/${kind}.png`;const img=document.createElement('img');img.src=src;img.alt='';img.className=`effect effect--${kind}${large?' effect--large':''}`;img.style.left=`${left}%`;img.style.top=`${top}%`;els.effectsLayer.appendChild(img);setTimeout(()=>img.remove(),kind==='zzz'?animationMs('zzz',3300):animationMs('effect',1800));}
function showToast(text){clearTimeout(toastTimer);els.toast.textContent=text;els.toast.classList.add('is-visible');toastTimer=setTimeout(()=>els.toast.classList.remove('is-visible'),2600);}
function journalIcon(type){return {home:'⌂',heart:'♥',play:'✦',food:'🥕',shop:'◉',coin:'◉'}[type]||'•';}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
