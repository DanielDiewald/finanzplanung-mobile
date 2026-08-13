import { APP_VERSION, formatCents, parseEuroToCents } from '../../js/utils.js';
import { loadCapyConfig } from './config.js';
import { addJournal, applyRemoteCapy, availableCoins, loadCapyState, queueCoinOp, saveCapyState, setCapyEnabled, touchCare } from './shared-state.js';
import { applyElapsedDecay, applyItem, applyPet, applyPlay, autoSleepThresholds, canPlay, chooseVisual, currentPhase, genderCopy, isCapySleeping, updateAutoSleepState } from './engine.js';
import { createStashDeposit, loadFinanceContext, stashBalanceCents } from './finance-adapter.js';
import { consumePetAffectionProgress, consumePetHeartProgress, createPetSession, itemEffectLabel, movePetSession, petAffectionRewardForSession, petHeartBurstForSession, pointInExpandedRect, pointInRect } from './interactions.js';
import { canLaunchGame, loadGameRegistry, renderGameHub, visibleGames } from '../games/js/game-hub.js';
import { createGameLoader, resolveGameEntry } from '../games/js/game-loader.js';
import { createGameBridge } from '../games/js/game-bridge.js';
import { createGameStorage } from '../games/js/game-storage.js';

const $=id=>document.getElementById(id);
const els={
  inactiveState:$('inactiveState'),inactiveTitle:$('inactiveTitle'),inactiveCopy:$('inactiveCopy'),enabledState:$('enabledState'),capyApp:$('capyApp'),
  capyName:$('capyName'),capyMeta:$('capyMeta'),coinIconTop:$('coinIconTop'),coinCountTop:$('coinCountTop'),coinCountShop:$('coinCountShop'),
  hungerValue:$('hungerValue'),happinessValue:$('happinessValue'),energyValue:$('energyValue'),bondValue:$('bondValue'),hungerBar:$('hungerBar'),happinessBar:$('happinessBar'),energyBar:$('energyBar'),bondBar:$('bondBar'),phasePill:$('phasePill'),moodValue:$('moodValue'),statusHint:$('statusHint'),
  scene:$('scene'),capyHitbox:$('capyHitbox'),capyGroundShadow:$('capyGroundShadow'),capyImage:$('capyImage'),effectsLayer:$('effectsLayer'),floatingLayer:$('floatingLayer'),dropHint:$('dropHint'),playButton:$('playButton'),inventoryBadge:$('inventoryBadge'),shopList:$('shopList'),inventoryList:$('inventoryList'),journalList:$('journalList'),
  selectedFeedBar:$('selectedFeedBar'),selectedFeedItem:$('selectedFeedItem'),selectedFeedImage:$('selectedFeedImage'),selectedFeedName:$('selectedFeedName'),selectedFeedEffect:$('selectedFeedEffect'),selectedFeedCount:$('selectedFeedCount'),clearSelectedFeed:$('clearSelectedFeed'),
  vorratName:$('vorratName'),stashValue:$('stashValue'),stashLocked:$('stashLocked'),stashWithdrawable:$('stashWithdrawable'),stashUnlockHint:$('stashUnlockHint'),topUpAmount:$('topUpAmount'),coinRewardHint:$('coinRewardHint'),topUpButton:$('topUpButton'),capyTransactions:$('capyTransactions'),pauseCapyButton:$('pauseCapyButton'),
  setupModal:$('setupModal'),nameInput:$('nameInput'),genderInfo:$('genderInfo'),finishSetupButton:$('finishSetupButton'),creatorPreview:$('creatorPreview'),genderButtons:[...document.querySelectorAll('[data-gender]')],
  gameHubSheet:$('gameHubSheet'),gameHubList:$('gameHubList'),gameHubState:$('gameHubState'),gamePlayer:$('gamePlayer'),gameFrame:$('gameFrame'),gamePlayerClose:$('gamePlayerClose'),gamePlayerTitle:$('gamePlayerTitle'),gamePlayerStatus:$('gamePlayerStatus'),gameLoading:$('gameLoading'),gameError:$('gameError'),gameErrorCopy:$('gameErrorCopy'),gameErrorBack:$('gameErrorBack'),gameResult:$('gameResult'),gameResultTitle:$('gameResultTitle'),gameResultScore:$('gameResultScore'),gameResultHighscore:$('gameResultHighscore'),gameResultReward:$('gameResultReward'),gameResultAgain:$('gameResultAgain'),gameResultHub:$('gameResultHub'),
  sheets:[...document.querySelectorAll('[data-sheet]')],dragGhost:$('dragGhost'),feedDragTutorial:$('feedDragTutorial'),toast:$('toast')
};

let config,capy,plan=null,transactions=[];
let gameRegistry=null,gameList=[],gameLoader=null,gameBridge=null,gameStorage=null,lastGame=null;
const offlineGameIds=new Set();
let runtimeVisual='',runtimeTimer=0,actionClass='',idleTimer=0,idleMotionTimer=0,idleMotionClass='',toastTimer=0,petPulseTimer=0,feedTutorialTimer=0,lastPetHapticAt=0;
let setupGender='männlich';
let petSession=null;
let drag=null,selectedFeedItemId='';
const FEED_DRAG_TUTORIAL_KEY='capyt.capy.feedDragTutorialSeen.v1';
let feedTutorialSeenThisSession=false;

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
  await initializeGames();
  if(capy.enabled&&capy.care.initialized){applyElapsedDecay(capy.care,config.behavior);touchCare(capy);capy=await saveCapyState(capy);}
  renderAll();
  scheduleIdleMotion();
  if(capy.enabled&&!capy.care.initialized)openCreator();

  setInterval(async()=>{if(!capy.enabled||!capy.care.initialized)return;applyElapsedDecay(capy.care,config.behavior);touchCare(capy);capy=await saveCapyState(capy);renderAll();},Math.max(15000,Number(config.behavior.decayTickMs)||60000));
  document.addEventListener('visibilitychange',async()=>{
    if(document.visibilityState!=='visible'){gameLoader?.pause();return;}
    gameLoader?.resume();
    await refreshFinance(true);
    if(capy.enabled&&capy.care.initialized){applyElapsedDecay(capy.care,config.behavior);touchCare(capy);capy=await saveCapyState(capy);}
    renderAll();
    scheduleIdleMotion();
  });
}

async function refreshFinance(applyRemote=false){
  const finance=await loadFinanceContext();
  plan=finance.plan;
  transactions=finance.transactions;
  if(applyRemote){capy=applyRemoteCapy(capy,plan?.capy||{enabled:false},plan?.acknowledgedExportIds||[],plan?.transactionResults||[]);capy=await saveCapyState(capy);}
}

function configureVisualAssets(){
  const iconPath=String(config.economy.coinImage||'');
  if(iconPath){els.coinIconTop.src=iconPath;els.coinIconTop.addEventListener('error',()=>{els.coinIconTop.hidden=true;},{once:true});}else els.coinIconTop.hidden=true;
  const room=config.behavior.room||{};
  if(room.backgroundImage){els.scene.style.backgroundImage=`url("${String(room.backgroundImage).replaceAll('"','\\"')}")`;els.scene.style.backgroundPosition=room.backgroundPosition||'center';els.scene.style.backgroundSize=room.backgroundSize||'cover';}
  const rate=Number(config.economy.coinsPerEuro)||1;
  els.coinRewardHint.textContent=`1,00 € = ${formatCoin(rate)} Coin${rate===1?'':'s'} · Coins sind vom Echtgeld-Vorrat getrennt.`;
  document.documentElement.style.setProperty('--drag-return-ms',`${Math.max(0,Number(config.behavior.inventoryDrag?.returnAnimationMs)||180)}ms`);
  document.documentElement.style.setProperty('--drag-consume-ms',`${Math.max(0,Number(config.behavior.inventoryDrag?.consumeAnimationMs)||140)}ms`);
}

function bindEvents(){
  document.querySelectorAll('[data-open-sheet]').forEach(button=>button.addEventListener('click',()=>openSheet(button.dataset.openSheet)));
  document.querySelectorAll('[data-close-sheet]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog')?.close()));
  els.sheets.forEach(sheet=>sheet.addEventListener('pointerdown',event=>{if(event.target===sheet)sheet.close();}));
  document.querySelector('[data-open-main="settings"]')?.addEventListener('click',()=>{location.href='../#/settings';});
  els.playButton.addEventListener('click',()=>void openGameHub());
  els.topUpButton.addEventListener('click',()=>void topUpVorrat());
  els.pauseCapyButton.addEventListener('click',()=>void pauseCapy());
  els.genderButtons.forEach(button=>button.addEventListener('click',()=>selectSetupGender(button.dataset.gender)));
  els.finishSetupButton.addEventListener('click',()=>void finishSetup());
  els.nameInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();void finishSetup();}});
  els.setupModal.addEventListener('cancel',event=>event.preventDefault());
  els.gamePlayerClose.addEventListener('click',()=>void requestCloseGame());
  els.gameErrorBack.addEventListener('click',()=>void returnToGameHub());
  els.gameResultHub.addEventListener('click',()=>void returnToGameHub());
  els.gameResultAgain.addEventListener('click',()=>void restartLastGame());
  els.gamePlayer.addEventListener('cancel',event=>{event.preventDefault();void requestCloseGame();});
  window.addEventListener('online',()=>void refreshGameHubAvailability());
  window.addEventListener('offline',()=>void refreshGameHubAvailability());
  window.addEventListener('capyt-themechange',()=>gameLoader?.themeChanged(currentTheme()));

  els.capyHitbox.addEventListener('pointerdown',onPetDown);
  els.capyHitbox.addEventListener('pointermove',onPetMove);
  els.capyHitbox.addEventListener('pointerup',onPetEnd);
  els.capyHitbox.addEventListener('pointercancel',onPetCancel);
  els.selectedFeedItem.addEventListener('pointerdown',event=>startItemPointer(event,selectedFeedItemId,'feed-slot'));
  els.clearSelectedFeed.addEventListener('click',()=>{selectedFeedItemId='';renderSelectedFeedItem();});

  document.addEventListener('dragstart',event=>{if(event.target.closest?.('#capyApp,.bottom-sheet,.setup-modal,#dragGhost'))event.preventDefault();});
  document.addEventListener('selectstart',event=>{if(isGameInteractionTarget(event.target)&&!isTextInput(event.target))event.preventDefault();});
  document.addEventListener('contextmenu',event=>{if(isGameInteractionTarget(event.target)&&!isTextInput(event.target))event.preventDefault();});
  window.addEventListener('blur',cancelActivePointerState);
  setupSheetGestures();
}

function setupSheetGestures(){
  els.sheets.forEach(dialog=>{
    const sheet=dialog.querySelector('.sheet-card');
    const handle=sheet?.querySelector('.sheet-handle');
    if(!sheet||!handle)return;

    let pointerId=null,startY=0,dragY=0,startTime=0,dismissing=false;
    const reset=()=>{
      pointerId=null;dragY=0;dismissing=false;
      sheet.classList.remove('is-dragging','is-dismissing');
      sheet.style.removeProperty('--sheet-drag-y');
    };
    const finishClose=()=>{if(dialog.open)dialog.close();reset();};
    const dismiss=()=>{
      if(dismissing)return;
      dismissing=true;
      sheet.classList.remove('is-dragging');
      sheet.classList.add('is-dismissing');
      sheet.style.setProperty('--sheet-drag-y',`${Math.max(48,dragY)}px`);
      requestAnimationFrame(()=>sheet.style.setProperty('--sheet-drag-y','110dvh'));
      let closed=false;
      const complete=()=>{if(closed)return;closed=true;finishClose();};
      sheet.addEventListener('transitionend',complete,{once:true});
      setTimeout(complete,280);
    };
    const snapBack=()=>{
      sheet.classList.remove('is-dragging');
      sheet.style.setProperty('--sheet-drag-y','0px');
      setTimeout(()=>{if(!dismissing)sheet.style.removeProperty('--sheet-drag-y');},230);
    };

    handle.addEventListener('pointerdown',event=>{
      if(event.pointerType==='mouse'&&event.button!==0)return;
      if(!dialog.open||dismissing)return;
      pointerId=event.pointerId;startY=event.clientY;dragY=0;startTime=performance.now();
      sheet.classList.add('is-dragging');
      handle.setPointerCapture?.(pointerId);
      event.preventDefault();
    });
    handle.addEventListener('pointermove',event=>{
      if(pointerId===null||event.pointerId!==pointerId)return;
      dragY=Math.max(0,event.clientY-startY);
      sheet.style.setProperty('--sheet-drag-y',`${dragY}px`);
      event.preventDefault();
    });
    handle.addEventListener('pointerup',event=>{
      if(pointerId===null||event.pointerId!==pointerId)return;
      const elapsed=Math.max(1,performance.now()-startTime);
      const velocity=dragY/elapsed;
      const threshold=Math.min(140,Math.max(86,sheet.getBoundingClientRect().height*.16));
      try{handle.releasePointerCapture?.(pointerId);}catch{}
      pointerId=null;
      if(dragY>=threshold||(dragY>=42&&velocity>.55))dismiss();else snapBack();
      event.preventDefault();
    });
    handle.addEventListener('pointercancel',event=>{
      if(pointerId===null||event.pointerId!==pointerId)return;
      try{handle.releasePointerCapture?.(pointerId);}catch{}
      pointerId=null;snapBack();event.preventDefault();
    });
    dialog.addEventListener('close',reset);
  });
}

function isTextInput(target){return Boolean(target?.closest?.('input,textarea,select,[contenteditable="true"]'));}
function isGameInteractionTarget(target){return Boolean(target?.closest?.('#capyApp,.inventory-item,.selected-feed-item,.drag-ghost,.game-nav,.bottom-sheet')) ;}
function cancelActivePointerState(){
  if(petSession)void finishPetSession(petSession.pointerId,true);
  if(drag){const current=drag;clearTimeout(current.timer);cleanupPointerListeners(current.node);if(current.active)returnGhost(current);else{cleanupDragVisual();drag=null;}}
}

function openCreator(){setupGender=(config.behavior.genders||[]).includes('männlich')?'männlich':'weiblich';selectSetupGender(setupGender);els.nameInput.value=capy.care.name||'';if(!els.setupModal.open)els.setupModal.showModal();setTimeout(()=>els.nameInput.focus(),100);}
function selectSetupGender(gender){if(!['männlich','weiblich'].includes(gender))return;setupGender=gender;els.genderButtons.forEach(button=>button.classList.toggle('is-active',button.dataset.gender===gender));const info=genderCopy(gender);els.genderInfo.textContent=`${info.mark} ${info.label} ausgewählt · gespeichert wird erst mit „Capy erstellen“.`;}
async function finishSetup(){
  const name=els.nameInput.value.trim();
  if(!name){showToast('Bitte gib deinem Capy einen Namen.');els.nameInput.focus();return;}
  if(!['männlich','weiblich'].includes(setupGender)){showToast('Bitte wähle männlich oder weiblich.');return;}
  capy.care.initialized=true;capy.care.name=name.slice(0,20);capy.care.gender=setupGender;capy.care.lastUpdate=Date.now();
  addJournal(capy,'home',`${capy.care.name} ist eingezogen.`,config.behavior.maxJournalEntries);touchCare(capy);capy=await saveCapyState(capy);
  els.setupModal.close();setRuntimeVisual('celebrate',animationMs('celebrate',1300),'capy--celebrate');spawnEffect('confetti',36,28,true);spawnEffect('sparkle',66,24,true);showFloating(`${capy.care.name} ist da!`,50,42);renderAll();scheduleIdleMotion();
}

function openSheet(id){
  if(!capy.enabled||!capy.care.initialized)return;
  const target=$(id);if(!target)return;
  els.sheets.forEach(sheet=>{if(sheet!==target&&sheet.open)sheet.close();});
  if(!target.open)target.showModal();
  if(id==='inventorySheet')renderInventory();if(id==='shopSheet')renderShop();if(id==='stashSheet')renderWallet();if(id==='moreSheet')renderJournal();if(id==='gameHubSheet')renderGames();
}

async function initializeGames(){
  gameStorage=createGameStorage({getState:()=>capy,saveState:async()=>{capy=await saveCapyState(capy);}});
  gameLoader=createGameLoader({frame:els.gameFrame,statusElement:els.gamePlayerStatus,onStatusChange:status=>{
    els.gameLoading.hidden=status!=='loading';
    if(status==='ready'||status==='playing'||status==='paused')els.gameLoading.hidden=true;
    if(status==='error'){els.gameLoading.hidden=true;showGameError(gameLoader.session()?.error||'Das Spiel konnte nicht geladen werden.');}
  }});
  gameBridge=createGameBridge({
    loader:gameLoader,getCapySnapshot:gameCapySnapshot,getAppInfo:gameAppInfo,getTheme:currentTheme,storage:gameStorage,getState:()=>capy,
    saveState:async()=>{capy=await saveCapyState(capy);renderWallet();},
    queueCoins:(amount,reason)=>queueCoinOp(capy,amount,reason),
    onFinished:result=>showGameResult(result),onError:error=>console.warn('Capyt Game Bridge:',error)
  });
  try{
    gameRegistry=await loadGameRegistry('./games/games.json');gameList=visibleGames(gameRegistry);await refreshOfflineAvailability();renderGames();
  }catch(error){
    console.error('Game Registry:',error);gameRegistry=null;gameList=[];showHubState(`Minispiele konnten nicht geladen werden: ${error.message}`);renderGames();
  }
}

async function refreshOfflineAvailability(){
  offlineGameIds.clear();if(!('caches' in window))return;
  await Promise.all(gameList.filter(canLaunchGame).map(async game=>{
    try{
      const urls=[resolveGameEntry(game.entry).href,...(game.offlineAssets||[]).map(asset=>new URL(`./games/${String(asset).replace(/^\.\//,'')}`,location.href).href)];
      const matches=await Promise.all(urls.map(url=>caches.match(url)));if(matches.every(Boolean))offlineGameIds.add(game.id);
    }catch{}
  }));
}
async function refreshGameHubAvailability(){await refreshOfflineAvailability();renderGames();if(!navigator.onLine)showHubState('Offline-Modus: gecachte Games bleiben spielbar.');else if(gameRegistry)hideHubState();}
function offlineReady(game){return navigator.onLine||offlineGameIds.has(game.id);}
function renderGames(){renderGameHub(els.gameHubList,gameList,{getStats:id=>capy.games?.[id]||null,onPlay:game=>void startMinigame(game),offlineReady});}
function showHubState(text){els.gameHubState.hidden=false;els.gameHubState.textContent=text;}
function hideHubState(){els.gameHubState.hidden=true;els.gameHubState.textContent='';}
async function openGameHub(){
  if(!capy.enabled||!capy.care.initialized)return;
  await refreshOfflineAvailability();renderGames();if(!navigator.onLine)showHubState('Offline-Modus: gecachte Games bleiben spielbar.');else if(gameRegistry)hideHubState();openSheet('gameHubSheet');
}
function currentTheme(){return ['light','dark'].includes(document.documentElement.dataset.theme)?document.documentElement.dataset.theme:(globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches?'dark':'light');}
function gameCapySnapshot(){return {name:String(capy.care.name||'Capy'),gender:String(capy.care.gender||''),hunger:Math.round(Number(capy.care.hunger)||0),happiness:Math.round(Number(capy.care.happiness)||0),energy:Math.round(Number(capy.care.energy)||0),affection:Math.round(Number(capy.care.bond)||0),sleeping:isCapySleeping(capy.care,config.behavior,currentPhase(config.behavior))};}
function gameAppInfo(){return {version:APP_VERSION,platform:String(navigator.userAgentData?.platform||navigator.platform||''),locale:String(navigator.language||'de-AT'),online:Boolean(navigator.onLine),pwa:Boolean(globalThis.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone)};}
async function startMinigame(game){
  if(!canLaunchGame(game)){showToast('Dieses Spiel ist noch nicht verfügbar.');return;}
  if(!offlineReady(game)){showToast('Dieses Spiel ist offline noch nicht verfügbar.');return;}
  lastGame=game;els.gameHubSheet.open&&els.gameHubSheet.close();els.gamePlayerTitle.textContent=game.name;els.gameResult.hidden=true;els.gameError.hidden=true;els.gameLoading.hidden=false;
  try{gameLoader.open(game);if(!els.gamePlayer.open)els.gamePlayer.showModal();gameLoader.themeChanged(currentTheme());}
  catch(error){if(!els.gamePlayer.open)els.gamePlayer.showModal();showGameError(error.message);}
}
function showGameError(message){els.gameLoading.hidden=true;els.gameResult.hidden=true;els.gameError.hidden=false;els.gameErrorCopy.textContent=message||'Unbekannter Fehler.';}
function showGameResult(result){
  els.gameLoading.hidden=true;els.gameError.hidden=true;els.gameResult.hidden=false;
  const versus=result?.display?.type==='versus'?result.display:null;
  if(versus){
    els.gameResultTitle.textContent=versus.won?'Sieg':'Punktestand';
    els.gameResultScore.textContent=`${Number(versus.playerPoints)||0} : ${Number(versus.rivalPoints)||0}`;
    const difficulty=String(versus.difficultyLabel||versus.difficulty||'').trim();
    els.gameResultHighscore.textContent=`${difficulty?`${difficulty} · `:''}Erster bei ${Number(versus.targetScore)||5}`;
  }else{
    els.gameResultTitle.textContent=result.newHighScore?'Neuer Highscore!':'Geschafft!';
    els.gameResultScore.textContent=new Intl.NumberFormat('de-AT').format(Number(result.score)||0);
    els.gameResultHighscore.textContent=`Bester Score: ${new Intl.NumberFormat('de-AT').format(Number(result.bestScore)||0)}`;
  }
  els.gameResultReward.textContent=result.coinsAwarded>0?`+${result.coinsAwarded} 🪙`:result.duplicate?'Run bereits verarbeitet':'Keine Coins für diesen Run';renderGames();renderWallet();
}
async function requestCloseGame(){
  const status=gameLoader?.session()?.status;if(status==='playing'&&!confirm('Spiel verlassen?\n\nDer aktuelle Lauf wird beendet.'))return;closeGamePlayer();await openGameHub();
}
function closeGamePlayer(){gameLoader?.close();if(els.gamePlayer.open)els.gamePlayer.close();els.gameResult.hidden=true;els.gameError.hidden=true;els.gameLoading.hidden=false;}
async function returnToGameHub(){closeGamePlayer();await openGameHub();}
async function restartLastGame(){const game=lastGame;closeGamePlayer();if(game)await startMinigame(game);}

function petBlocked(){return isCapySleeping(capy.care,config.behavior,currentPhase(config.behavior))&&config.behavior.sleep?.blocksPet!==false;}
function onPetDown(event){
  if(event.pointerType==='mouse'&&event.button!==0)return;
  if(!capy.enabled||!capy.care.initialized||config.behavior.petting?.enabled===false)return;
  if(petBlocked()){spawnEffect('zzz',68,24,false);showToast(`${capy.care.name||'Capy'} schläft.`);return;}
  petSession=createPetSession(event.pointerId,event.clientX,event.clientY,{rubMode:true});
  els.capyHitbox.classList.add('is-petting');els.capyImage.classList.add('is-petting');
  els.capyHitbox.setPointerCapture?.(event.pointerId);
  event.preventDefault();
}
function onPetMove(event){
  if(!petSession||event.pointerId!==petSession.pointerId)return;
  const rect=els.capyHitbox.getBoundingClientRect(),inside=pointInExpandedRect(event.clientX,event.clientY,rect,config.behavior.petting?.hitPaddingPx||24);
  movePetSession(petSession,event.clientX,event.clientY,{inside,movementThreshold:config.behavior.petting?.movementThreshold||8});
  if(inside&&petSession.lastDelta){updatePetReaction(petSession.lastDelta);triggerPetHaptic('rub');}else clearPetReaction(false);
  const now=Date.now(),heartCount=petHeartBurstForSession(petSession,config.behavior.petting,now);
  if(heartCount>0){consumePetHeartProgress(petSession,config.behavior.petting,now);showPetHearts(heartCount);}
  const affection=petAffectionRewardForSession(petSession,config.behavior.petting,capy.care.bond,capy.care.happiness,now);
  if(affection.bond>0||affection.happiness>0){consumePetAffectionProgress(petSession,config.behavior.petting,now);awardPetAffection(affection);}
  event.preventDefault();
}
function awardPetAffection(reward){
  const applied=applyPet(capy.care,config.behavior,reward.happiness,reward.bond);
  petSession.happinessAwarded+=Math.max(0,Number(applied.happiness)||0);petSession.bondAwarded+=Math.max(0,Number(applied.bond)||0);petSession.awarded+=Math.max(0,Number(applied.happiness)||0);
  touchCare(capy);renderNeeds();
  clearTimeout(petPulseTimer);els.capyImage.classList.add('is-pet-reward');
  petPulseTimer=setTimeout(()=>els.capyImage.classList.remove('is-pet-reward'),220);
  showPetHearts(Math.max(3,Number(config.behavior.petting?.maxHeartBurst)||5),true);
  triggerPetHaptic('affection');
}
function showPetHearts(count=1,strong=false){
  const total=Math.max(1,Math.min(7,Math.floor(Number(count)||1)));
  for(let index=0;index<total;index+=1){
    const heart=document.createElement('span');heart.className=`pet-heart${strong?' is-strong':''}`;heart.textContent='❤️';
    heart.style.left=`${50+(index-(total-1)/2)*5+(Math.random()-.5)*4}%`;heart.style.top=`${37+(Math.random()-.5)*5}%`;heart.style.setProperty('--heart-delay',`${index*28}ms`);heart.style.setProperty('--heart-drift',`${(index-(total-1)/2)*7}px`);
    els.floatingLayer.appendChild(heart);setTimeout(()=>heart.remove(),1050+index*28);
  }
}
function triggerPetHaptic(kind='rub'){
  const cfg=config.behavior.petting||{},ms=Math.max(0,Number(cfg.hapticMs)||0),cooldown=Math.max(0,Number(cfg.hapticCooldownMs)||90),now=Date.now(),navigatorRef=globalThis.navigator;
  if(!ms||now-lastPetHapticAt<cooldown||typeof navigatorRef?.vibrate!=='function')return false;
  const rewardPattern=Array.isArray(cfg.hapticRewardPattern)?cfg.hapticRewardPattern.map(value=>Math.max(0,Math.round(Number(value)||0))).filter((value,index)=>value>0||index%2===1):[24,32,34];
  const pattern=kind==='affection'&&rewardPattern.length?rewardPattern:ms;
  lastPetHapticAt=now;try{return navigatorRef.vibrate(pattern)!==false;}catch{return false;}
}
function onPetEnd(event){if(!petSession||event.pointerId!==petSession.pointerId)return;void finishPetSession(event.pointerId,false);event.preventDefault();}
function onPetCancel(event){if(!petSession||event.pointerId!==petSession.pointerId)return;void finishPetSession(event.pointerId,true);}
async function finishPetSession(pointerId,cancelled){
  const finished=petSession;if(!finished||finished.pointerId!==pointerId)return;
  finished.active=false;petSession=null;clearPetReaction(true);
  els.capyHitbox.classList.remove('is-petting');els.capyImage.classList.remove('is-petting');
  try{els.capyHitbox.releasePointerCapture?.(pointerId);}catch{}
  if(finished.affectionAwards>0||finished.bondAwarded>0||finished.happinessAwarded>0){addJournal(capy,'heart',`${capy.care.name||'Capy'} wurde ausgiebig gestreichelt.`,config.behavior.maxJournalEntries);touchCare(capy);capy=await saveCapyState(capy);renderNeeds();}
  if(!cancelled&&finished.affectionAwards>0)animateCapy('capy--happy-bounce',animationMs('pet',520));
  scheduleIdleMotion();
}
function updatePetReaction(delta){
  const dx=Math.max(-5,Math.min(5,Number(delta.x||0)*.16)),dy=Math.max(-3,Math.min(3,Number(delta.y||0)*.1)),tilt=Math.max(-3,Math.min(3,Number(delta.x||0)/18));
  els.capyImage.style.setProperty('--pet-shift-x',`${dx}px`);els.capyImage.style.setProperty('--pet-shift-y',`${dy}px`);els.capyImage.style.setProperty('--pet-tilt',`${tilt}deg`);
  if(els.capyGroundShadow){const movement=Math.min(1,Math.hypot(Number(delta.x)||0,Number(delta.y)||0)/42),shadowX=Math.max(-3,Math.min(3,dx*.55));els.capyGroundShadow.style.setProperty('--shadow-pet-x',`${shadowX}px`);els.capyGroundShadow.style.setProperty('--shadow-pet-scale-x',String(1-movement*.07));els.capyGroundShadow.style.setProperty('--shadow-pet-scale-y',String(1-movement*.05));els.capyGroundShadow.style.setProperty('--shadow-pet-opacity',String(.78-movement*.08));}
}
function clearPetReaction(resetDirection=true){
  els.capyImage.style.removeProperty('--pet-shift-x');els.capyImage.style.removeProperty('--pet-shift-y');els.capyImage.style.removeProperty('--pet-tilt');
  if(els.capyGroundShadow){els.capyGroundShadow.style.removeProperty('--shadow-pet-x');els.capyGroundShadow.style.removeProperty('--shadow-pet-scale-x');els.capyGroundShadow.style.removeProperty('--shadow-pet-scale-y');els.capyGroundShadow.style.removeProperty('--shadow-pet-opacity');}
  if(resetDirection&&petSession)petSession.lastDirection=null;
}

async function playCapy(){
  if(isCapySleeping(capy.care,config.behavior,currentPhase(config.behavior))&&config.behavior.sleep?.blocksPlay!==false){showToast(`${capy.care.name||'Capy'} schläft.`);return;}
  if(!canPlay(capy.care,config.behavior)){showToast(`${capy.care.name||'Capy'} ist zu müde zum Spielen.`);return;}
  const before={happiness:capy.care.happiness,energy:capy.care.energy};applyPlay(capy.care,config.behavior);addJournal(capy,'play',`${capy.care.name||'Capy'} hat mit dir gespielt.`,config.behavior.maxJournalEntries);touchCare(capy);capy=await saveCapyState(capy);
  animateCapy('capy--play',animationMs('play',760));spawnEffect('sparkle',38,29,true);showFloating(`${signed(capy.care.happiness-before.happiness)} ❤️  ${signed(capy.care.energy-before.energy)} ⚡`,47,31);renderAll();
}

async function buyItem(item){
  if(!item)return;
  const price=Math.max(0,Math.floor(Number(item.priceCoins)||0)),count=Math.max(0,Math.floor(Number(capy.care.inventory[item.id])||0));
  if(availableCoins(capy)<price){showToast('Nicht genug Coins.');return;}
  if(item.stackable!==false&&count>=item.maxStack){showToast(`${item.name} hat bereits den maximalen Stack.`);return;}
  queueCoinOp(capy,-price,`${item.name} gekauft`);capy.care.inventory[item.id]=count+1;addJournal(capy,'shop',`${item.name} für ${price} Coins gekauft.`,config.behavior.maxJournalEntries);touchCare(capy);capy=await saveCapyState(capy);showFloating(`-${price} 🪙   +1`,50,48);renderAll();showToast(`${item.name} liegt jetzt im Inventar.`);
}

function bindInventoryDrag(){els.inventoryList.querySelectorAll('[data-drag-item]').forEach(node=>node.addEventListener('pointerdown',event=>startItemPointer(event,node.dataset.dragItem,'inventory')));}
function startItemPointer(event,itemId,sourceKind='inventory'){
  if(event.pointerType==='mouse'&&event.button!==0)return;
  const item=config.items.find(x=>x.id===itemId),count=Math.max(0,Math.floor(Number(capy.care.inventory[itemId])||0));if(!item||count<1)return;
  if(drag)return;
  const source=event.currentTarget.getBoundingClientRect(),holdDelay=Math.max(0,Number(config.behavior.inventoryDrag?.holdDelayMs)||80);
  const selectionOnly=sourceKind==='inventory'&&item.type==='food';
  drag={pointerId:event.pointerId,item,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,source,sourceKind,selectionOnly,startedAt:Date.now(),active:false,used:false,timer:0,node:event.currentTarget};
  event.currentTarget.setPointerCapture?.(event.pointerId);
  if(!selectionOnly)drag.timer=setTimeout(()=>activateDrag(event.clientX,event.clientY),holdDelay);
  event.currentTarget.addEventListener('pointermove',moveItemPointer);
  event.currentTarget.addEventListener('pointerup',endItemPointer,{once:true});
  event.currentTarget.addEventListener('pointercancel',cancelItemPointer,{once:true});
  event.preventDefault();
}
function activateDrag(x,y){
  if(!drag||drag.active)return;
  drag.active=true;
  if(drag.sourceKind==='inventory'&&$('inventorySheet')?.open)$('inventorySheet').close();
  const count=Math.max(0,Math.floor(Number(capy.care.inventory[drag.item.id])||0));
  els.dragGhost.querySelector('img').src=drag.item.asset;els.dragGhost.querySelector('span').textContent=`x${count}`;
  els.dragGhost.classList.remove('hidden','is-returning','is-consuming');positionGhost(x,y);updateDropTarget(x,y);
}
function moveItemPointer(event){
  if(!drag||event.pointerId!==drag.pointerId)return;
  drag.x=event.clientX;drag.y=event.clientY;
  if(drag.selectionOnly){event.preventDefault();return;}
  const threshold=Math.max(0,Number(config.behavior.inventoryDrag?.movementThreshold)||5),moved=Math.hypot(drag.x-drag.startX,drag.y-drag.startY);
  if(!drag.active&&moved>=threshold)activateDrag(drag.x,drag.y);
  if(drag.active){positionGhost(drag.x,drag.y);updateDropTarget(drag.x,drag.y);}
  event.preventDefault();
}
function positionGhost(x,y){els.dragGhost.style.left=`${x}px`;els.dragGhost.style.top=`${y}px`;}
function itemUseAllowed(item){const sleeping=isCapySleeping(capy.care,config.behavior,currentPhase(config.behavior));if(item?.type==='food'&&sleeping&&config.behavior.sleep?.blocksFood!==false)return false;if(item?.type==='toy'&&sleeping&&config.behavior.sleep?.blocksPlay!==false)return false;return true;}
function updateDropTarget(x,y){
  const over=Boolean(drag?.item)&&itemUseAllowed(drag.item)&&pointInRect(x,y,els.capyHitbox.getBoundingClientRect());
  els.scene.classList.toggle('is-drop-active',over);els.capyHitbox.classList.toggle('is-drop-target',over);els.capyImage.classList.toggle('is-drop-target',over);return over;
}
async function endItemPointer(event){
  if(!drag||event.pointerId!==drag.pointerId)return;
  clearTimeout(drag.timer);const current=drag,node=drag.node;cleanupPointerListeners(node);
  try{node.releasePointerCapture?.(event.pointerId);}catch{}
  if(current.active&&updateDropTarget(event.clientX,event.clientY)&&!current.used){current.used=true;consumeGhost(current);drag=null;await useItem(current.item);}else if(!current.active&&current.sourceKind==='inventory'&&current.item.type==='food'){cleanupDragVisual();drag=null;selectFeedItem(current.item);}else{if(current.active)returnGhost(current);else cleanupDragVisual();drag=null;}
  event.preventDefault();
}
function cancelItemPointer(event){
  if(!drag||event.pointerId!==drag.pointerId)return;
  clearTimeout(drag.timer);const current=drag,node=drag.node;cleanupPointerListeners(node);if(current.active)returnGhost(current);else cleanupDragVisual();drag=null;try{node.releasePointerCapture?.(event.pointerId);}catch{}event.preventDefault();
}
function cleanupPointerListeners(node){node?.removeEventListener('pointermove',moveItemPointer);}
function returnGhost(current){
  const x=current.source.left+current.source.width/2,y=current.source.top+current.source.height/2;els.dragGhost.classList.add('is-returning');positionGhost(x,y);setTimeout(()=>{cleanupDragVisual();if(drag===current)drag=null;},Math.max(0,Number(config.behavior.inventoryDrag?.returnAnimationMs)||180));
}
function consumeGhost(current){
  const rect=els.capyHitbox.getBoundingClientRect();els.dragGhost.classList.add('is-consuming');positionGhost(rect.left+rect.width/2,rect.top+rect.height*.55);setTimeout(cleanupDragVisual,Math.max(0,Number(config.behavior.inventoryDrag?.consumeAnimationMs)||140));
}
function cleanupDragVisual(){els.scene.classList.remove('is-drop-active');els.capyHitbox.classList.remove('is-drop-target');els.capyImage.classList.remove('is-drop-target');els.dragGhost.classList.add('hidden');els.dragGhost.classList.remove('is-returning','is-consuming');}

function selectFeedItem(item){
  if(!item||item.type!=='food')return;
  const count=Math.max(0,Math.floor(Number(capy.care.inventory[item.id])||0));if(count<1)return;
  selectedFeedItemId=item.id;
  if($('inventorySheet')?.open)$('inventorySheet').close();
  renderSelectedFeedItem();
  showFeedDragTutorialOnce();
}
function renderSelectedFeedItem(){
  const item=config?.items?.find(x=>x.id===selectedFeedItemId),count=item?Math.max(0,Math.floor(Number(capy.care.inventory[item.id])||0)):0;
  if(!item||item.type!=='food'||count<1){selectedFeedItemId='';els.selectedFeedBar.classList.add('hidden');return;}
  els.selectedFeedImage.src=item.asset;els.selectedFeedName.textContent=item.name;els.selectedFeedEffect.textContent=itemEffectLabel(item);els.selectedFeedCount.textContent=`x${count}`;els.selectedFeedBar.classList.remove('hidden');
}

async function useItem(item){
  const count=Math.max(0,Math.floor(Number(capy.care.inventory[item.id])||0));if(count<1){showToast(`${item.name} ist nicht mehr im Inventar.`);return;}
  const sleeping=isCapySleeping(capy.care,config.behavior,currentPhase(config.behavior));
  if(item.type==='food'&&sleeping&&config.behavior.sleep?.blocksFood!==false){showToast(`${capy.care.name||'Capy'} schläft gerade.`);return;}
  if(item.type==='toy'&&sleeping&&config.behavior.sleep?.blocksPlay!==false){showToast(`${capy.care.name||'Capy'} schläft gerade.`);return;}
  capy.care.inventory[item.id]=count-1;const delta=applyItem(capy.care,item);updateAutoSleepState(capy.care,config.behavior);addJournal(capy,item.type,`${capy.care.name||'Capy'} hat ${item.name} benutzt.`,config.behavior.maxJournalEntries);touchCare(capy);capy=await saveCapyState(capy);
  if(selectedFeedItemId===item.id&&capy.care.inventory[item.id]<1)selectedFeedItemId='';
  const animation=item.interaction?.animation||'eat';
  if(animation==='eat'){setRuntimeVisual('eating',animationMs('feed',900),'capy--feed');}
  else if(animation==='play'){animateCapy('capy--play',animationMs('play',760));spawnEffect('sparkle',40,30,true);}
  else{animateCapy('capy--care',animationMs('pet',520));spawnEffect('sparkle',60,30,false);}
  showFloating(effectFeedback(delta),54,33);renderAll();
}

async function topUpVorrat(){
  const cents=parseEuroToCents(els.topUpAmount.value),minimum=Math.max(1,Number(config.economy.minimumTopUpCents)||100);if(!Number.isSafeInteger(cents)||cents<minimum){showToast(`Mindestens ${formatCents(minimum)} aufladen.`);return;}if(!plan?.capy?.budgetId){showToast('Bitte zuerst einen aktuellen Capy-Plan synchronisieren.');return;}
  const coins=Math.max(1,Math.floor((cents/100)*(Number(config.economy.coinsPerEuro)||1)));
  try{const tx=await createStashDeposit({plan,amountCents:cents,name:capy.care.name||'Capy',coinReward:coins});queueCoinOp(capy,coins,`Vorrat +${formatCents(cents)}`,tx.id);addJournal(capy,'coin',`${formatCents(cents)} in ${vorratName()} gelegt · ${coins} Coins warten auf PC-Bestätigung.`,config.behavior.maxJournalEntries);touchCare(capy);capy=await saveCapyState(capy);els.topUpAmount.value='';await refreshFinance(false);renderAll();spawnEffect('coin',50,34,true);showFloating(`+${coins} 🪙`,50,35);showToast('Buchung ist sofort unter Buchungen sichtbar und wartet auf den PC.');}catch(error){showToast(error.message);}
}

async function pauseCapy(){const name=capy.care.name||'Capy';if(!confirm(`Capy-Begleiter pausieren?\n\n${name} und dein Fortschritt bleiben gespeichert. Während der Pause verändern sich seine Bedürfnisse nicht.`))return;setCapyEnabled(capy,false);capy=await saveCapyState(capy);els.sheets.forEach(sheet=>sheet.open&&sheet.close());selectedFeedItemId='';renderAll();showToast(`${name} pausiert. Der Zustand wird beim nächsten FP1-Sync übertragen.`);}

function renderAll(){
  const active=Boolean(capy.enabled);els.inactiveState.classList.toggle('hidden',active);els.enabledState.classList.toggle('hidden',!active);
  if(!active){const initialized=Boolean(capy.care.initialized);els.inactiveTitle.textContent=initialized?`${capy.care.name||'Capy'} · pausiert`:'Capy · Alpha';els.inactiveCopy.textContent=initialized?'Dein Capy und sein Fortschritt bleiben gespeichert. Vorrat, Sperren und ausstehende Finanztransaktionen bleiben erhalten.':'Aktiviere Capy am PC unter Grundlagen und synchronisiere den Plan mit diesem Gerät.';return;}
  renderProfile();renderNeeds();renderWallet();renderShop();renderInventory();renderSelectedFeedItem();renderJournal();renderCapy();
}
function renderProfile(){const phase=currentPhase(config.behavior),gender=genderCopy(capy.care.gender),name=capy.care.initialized?capy.care.name:'Capy';els.capyName.textContent=name;els.capyMeta.textContent=capy.care.initialized?`${gender.mark} ${gender.label} · Capy · Alpha`:'Capy · Alpha';els.phasePill.textContent=phase.label;}
function renderNeeds(){setNeed(els.hungerValue,els.hungerBar,capy.care.hunger);setNeed(els.happinessValue,els.happinessBar,capy.care.happiness);setNeed(els.energyValue,els.energyBar,capy.care.energy);setNeed(els.bondValue,els.bondBar,capy.care.bond);}
function renderWallet(){
  const coins=availableCoins(capy),stash=stashBalanceCents(plan,transactions),name=vorratName();
  const pendingLocked=(transactions||[]).filter(t=>!t.deleted&&t.status!=='confirmed'&&t.status!=='rejected'&&t.kind==='capy_stash_deposit').reduce((sum,t)=>sum+(Number(t.amountCents)||0),0),locked=Math.max(0,Number(plan?.capy?.lockedStashCents)||0)+pendingLocked,withdrawable=Math.max(0,Number(plan?.capy?.withdrawableStashCents)||0);
  els.coinCountTop.textContent=formatCoin(coins);els.coinCountShop.textContent=formatCoin(coins);els.vorratName.textContent=name;els.stashValue.textContent=formatCents(stash);els.stashLocked.textContent=formatCents(Math.min(stash,locked));els.stashWithdrawable.textContent=formatCents(Math.min(stash,withdrawable));els.stashUnlockHint.textContent=plan?.capy?.nextUnlockDate?`Nächste Freigabe: ${formatDate(plan.capy.nextUnlockDate)}`:`Einzahlungen bleiben ${Math.max(0,Number(plan?.capy?.stashLockMonths??config.economy.stashLockMonths)||0)} Monat${Number(plan?.capy?.stashLockMonths??config.economy.stashLockMonths)===1?'':'e'} gesperrt.`;renderCapyTransactions();
}
function renderShop(){
  const coins=availableCoins(capy);els.shopList.innerHTML=config.items.length?config.items.map(item=>{const price=Math.max(0,Math.floor(Number(item.priceCoins)||0)),count=Math.max(0,Math.floor(Number(capy.care.inventory[item.id])||0));return `<article class="shop-item"><img src="${escapeHtml(item.asset)}" alt="" draggable="false"><div class="shop-item-copy"><strong>${escapeHtml(item.name)}</strong><span class="item-type">${escapeHtml(typeLabel(item.type))}</span><small>${escapeHtml(itemEffectLabel(item))}</small></div><button type="button" data-buy="${escapeHtml(item.id)}" ${coins<price||count>=item.maxStack?'disabled':''}>${price} 🪙 · Kaufen</button></article>`;}).join(''):'<div class="empty">Keine Items aktiviert.</div>';els.shopList.querySelectorAll('[data-buy]').forEach(button=>button.addEventListener('click',()=>void buyItem(config.items.find(item=>item.id===button.dataset.buy))));
}
function renderInventory(){
  const rows=config.items.map(item=>({item,count:Math.max(0,Math.floor(Number(capy.care.inventory[item.id])||0))})).filter(row=>row.count>0),total=rows.reduce((sum,row)=>sum+row.count,0);els.inventoryBadge.textContent=String(total);els.inventoryBadge.classList.toggle('hidden',total<1);
  els.inventoryList.innerHTML=rows.length?rows.map(({item,count})=>`<div class="inventory-item${item.type==='food'?' is-food':''}" data-drag-item="${escapeHtml(item.id)}" role="button" tabindex="0"><img src="${escapeHtml(item.asset)}" alt="" draggable="false"><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(itemEffectLabel(item))}</small><em>x${count}</em>${item.type==='food'?'<span class="inventory-select-hint">Antippen zum Auswählen</span>':''}</div></div>`).join(''):'<div class="empty">Noch keine Items. Kaufe etwas im Shop.</div>';bindInventoryDrag();
}
function renderJournal(){const rows=capy.care.journal||[];els.journalList.innerHTML=rows.length?rows.slice(0,24).map(entry=>`<div class="journal-entry"><span>${journalIcon(entry.type)}</span><div><small>${escapeHtml(entry.time||'')}</small><p>${escapeHtml(entry.text||'')}</p></div></div>`).join(''):'<div class="empty">Noch keine Ereignisse.</div>';}
function renderCapyTransactions(){
  const rows=(transactions||[]).filter(t=>!t.deleted&&t.kind==='capy_stash_deposit').slice(0,20);
  els.capyTransactions.innerHTML=rows.length?rows.map(t=>{const pending=t.status!=='confirmed'&&t.status!=='rejected',status=t.status==='confirmed'?'Gebucht':t.status==='rejected'?`Nicht übernommen${t.rejectionReason?` · ${escapeHtml(t.rejectionReason)}`:''}`:'Wartet auf PC',reward=Math.max(0,Math.floor(Number(t.capyCoinReward)||0));return `<div class="capy-tx${pending?' pending':''}${t.status==='rejected'?' rejected':''}"><strong>${escapeHtml(vorratName())}</strong><b>${formatCents(t.amountCents)}</b><small>${status}${reward?` · +${reward} 🪙`:''}</small></div>`;}).join(''):'<div class="empty">Noch keine mobilen Capy-Buchungen.</div>';
}
function renderCapy(){
  const phase=currentPhase(config.behavior),visual=runtimeVisual||chooseVisual(capy.care,phase,config.behavior);els.capyImage.src=`./assets/capy/capy-${visual}.png`;const mood=moodCopy(visual);els.capyHitbox.setAttribute('aria-label',`${capy.care.name||'Capy'} – ${mood.label}`);els.moodValue.textContent=mood.label;els.statusHint.textContent=mood.hint;syncCapyClasses(visual);if(phase.key==='night'&&!els.effectsLayer.querySelector('.effect--zzz'))spawnEffect('zzz',68,24,false);
}
function syncCapyClasses(visual=null){
  const currentVisual=visual||runtimeVisual||chooseVisual(capy.care,currentPhase(config.behavior),config.behavior),base=actionClass|| (currentVisual==='sleeping'?'capy--sleeping':'capy--idle'),classes=['capy',base];
  const activeIdleMotion=idleMotionClass&&!actionClass&&!runtimeVisual&&!petSession&&!drag?idleMotionClass:'';
  if(activeIdleMotion)classes.push(activeIdleMotion);if(petSession)classes.push('is-petting');if(els.capyHitbox.classList.contains('is-drop-target'))classes.push('is-drop-target');els.capyImage.className=classes.join(' ');
  if(els.capyGroundShadow){const motion=activeIdleMotion||base;const shadowClasses=['capy-ground-shadow',`shadow--${String(motion).replace(/^capy--/,'')}`];if(petSession)shadowClasses.push('is-petting');if(els.capyHitbox.classList.contains('is-drop-target'))shadowClasses.push('is-drop-target');els.capyGroundShadow.className=shadowClasses.join(' ');}
}

function scheduleIdleMotion(){
  clearTimeout(idleTimer);clearTimeout(idleMotionTimer);idleMotionClass='';
  if(!capy?.enabled||!capy?.care?.initialized||isCapySleeping(capy.care,config.behavior,currentPhase(config.behavior))||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
  const min=Math.max(500,Number(config.behavior.animations?.idleMinDelayMs)||1500),max=Math.max(min,Number(config.behavior.animations?.idleMaxDelayMs)||4500),delay=min+Math.random()*(max-min);
  idleTimer=setTimeout(()=>{
    if(petSession||drag||runtimeVisual||actionClass||isCapySleeping(capy.care,config.behavior,currentPhase(config.behavior))){scheduleIdleMotion();return;}
    idleMotionClass=chooseIdleMotion();syncCapyClasses();
    idleMotionTimer=setTimeout(()=>{idleMotionClass='';syncCapyClasses();scheduleIdleMotion();},Math.max(240,Number(config.behavior.animations?.idleMotionMs)||700));
  },delay);
}
function chooseIdleMotion(){
  const t=config.behavior.visualThresholds||{};
  if(capy.care.energy<=Number(t.sleepyEnergyAtOrBelow??34))return 'capy--idle-drowsy';
  if(capy.care.hunger<=Number(t.hungryAtOrBelow??24))return 'capy--idle-hungry';
  const variants=capy.care.happiness>=Number(t.happyHappinessAtOrAbove??88)?['capy--idle-happy','capy--idle-look-left','capy--idle-look-right','capy--idle-bob']:['capy--idle-look-left','capy--idle-look-right','capy--idle-bob','capy--idle-blink'];
  return variants[Math.floor(Math.random()*variants.length)];
}

function animationMs(key,fallback){return Math.max(1,Number(config?.behavior?.animationMs?.[key])||fallback);}
function setNeed(valueEl,barEl,value){const safe=Math.max(0,Math.min(100,Number(value)||0));valueEl.textContent=`${Math.round(safe)}%`;barEl.style.width=`${safe}%`;}
function vorratName(){return String(plan?.capy?.budgetName||globalThis.CapytCapyNaming?.budgetName(capy.care.name||'Capy')||'Capy-Vorrat');}
function formatCoin(value){return new Intl.NumberFormat('de-AT',{maximumFractionDigits:0}).format(Math.max(0,Math.floor(Number(value)||0)));}
function formatDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value||'')))return '–';const [y,m,d]=String(value).split('-').map(Number);return new Intl.DateTimeFormat('de-AT',{day:'2-digit',month:'long'}).format(new Date(y,m-1,d));}
function moodCopy(visual){const name=capy.care.name||'Capy';return {neutral:{label:'Entspannt',hint:`Rubbel ${name} sanft hin und her.`},happy:{label:'Glücklich',hint:`${name} fühlt sich richtig wohl.`},hungry:{label:'Hungrig',hint:`${name} hat Hunger.`},sleepy:{label:'Müde',hint:`${name} wird langsam schläfrig.`},sleeping:{label:'Schläft',hint:capy.care.autoSleeping?`${name} lädt Energie bis ${Math.round(autoSleepThresholds(config.behavior).wakeAt)}% auf.`:`${name} ruht bis zum Morgen.`},eating:{label:'Mampft',hint:`${name} genießt das Item.`},celebrate:{label:'Feiert',hint:`${name} freut sich.`}}[visual]||{label:'Entspannt',hint:`${name} ist da.`};}
function animateCapy(className,duration){clearTimeout(runtimeTimer);actionClass=className;syncCapyClasses();runtimeTimer=setTimeout(()=>{actionClass='';renderCapy();scheduleIdleMotion();},duration);}
function setRuntimeVisual(visual,duration,className){runtimeVisual=visual;actionClass=className;clearTimeout(runtimeTimer);renderCapy();runtimeTimer=setTimeout(()=>{runtimeVisual='';actionClass='';renderCapy();scheduleIdleMotion();},duration);}
function spawnEffect(kind,left,top,large){const img=document.createElement('img');img.src=`./assets/effects/${kind}.png`;img.alt='';img.draggable=false;img.className=`effect effect--${kind}${large?' effect--large':''}`;img.style.left=`${left}%`;img.style.top=`${top}%`;els.effectsLayer.appendChild(img);setTimeout(()=>img.remove(),kind==='zzz'?animationMs('zzz',3300):animationMs('effect',1800));}
function showFloating(text,left=50,top=50){const el=document.createElement('div');el.className='floating-feedback';el.textContent=text;el.style.left=`${left}%`;el.style.top=`${top}%`;els.floatingLayer.appendChild(el);setTimeout(()=>el.remove(),1400);}
function feedDragTutorialSeen(){if(feedTutorialSeenThisSession)return true;try{return localStorage.getItem(FEED_DRAG_TUTORIAL_KEY)==='1';}catch{return false;}}
function showFeedDragTutorialOnce(){
  if(!els.feedDragTutorial||feedDragTutorialSeen())return;
  feedTutorialSeenThisSession=true;try{localStorage.setItem(FEED_DRAG_TUTORIAL_KEY,'1');}catch{}
  clearTimeout(feedTutorialTimer);els.feedDragTutorial.classList.remove('hidden');feedTutorialTimer=setTimeout(()=>els.feedDragTutorial.classList.add('hidden'),3600);
}
function showToast(text){clearTimeout(toastTimer);els.toast.textContent=text;els.toast.classList.add('is-visible');toastTimer=setTimeout(()=>els.toast.classList.remove('is-visible'),2800);}
function effectFeedback(delta){const parts=[];if(delta.hunger)parts.push(`${signed(delta.hunger)} 🍎`);if(delta.happiness)parts.push(`${signed(delta.happiness)} ❤️`);if(delta.energy)parts.push(`${signed(delta.energy)} ⚡`);if(delta.bond)parts.push(`${signed(delta.bond)} ✦`);return parts.join('  ')||'✓';}
function signed(value){const n=Math.round(Number(value)||0);return `${n>0?'+':''}${n}`;}
function typeLabel(type){return {food:'Food',toy:'Spielzeug',care:'Pflege'}[type]||'Item';}
function journalIcon(type){return {home:'⌂',heart:'♥',play:'✦',food:'🥕',toy:'🎮',care:'✨',shop:'🛒',coin:'🪙'}[type]||'•';}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
