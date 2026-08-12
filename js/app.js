import { APP_VERSION, EXPENSE_CATEGORIES, INCOME_CATEGORIES, centsToInput, debounce, downloadText, escapeHtml, formatCents, parseEuroToCents, setHidden, todayLocal, uuid } from './utils.js';
import { createRouter } from './router.js';
import { addSyncHistory, deleteTransaction, exportAllData, getCurrentPlan, getSettings, getTransaction, listTransactions, markAcknowledged, putManyTransactions, resetAllData, savePlan, saveSettings, saveTransaction } from './services/storage.js';
import { buildTransactionPayload, decodeFP1, encodeFP1 } from './services/sync.js';
import { buildDisplayState, pendingSummary } from './services/finance.js';
import { decodeQrImageFile, qrScannerCapability, renderQr, startQrScanner, stopQrScanner } from './services/qr.js';
import { renderMonth } from './views/month.js';
import { renderTransactions } from './views/transactions.js';
import { renderSync } from './views/sync-view.js';
import { applyTheme, renderSettings } from './views/settings.js';

const state={ plan:null,transactions:[],settings:null,display:null,pendingPlan:null,monthVisualMode:'buffer',donutMode:'planned',selectedSegment:'',transactionFilter:'all',transactionBudgetFilter:'',lastTransactionCode:'',deferredInstall:null };
let router;
const $=id=>document.getElementById(id);

function toast(message,{error=false,duration=3300}={}){ const el=document.createElement('div');el.className=`toast${error?' error':''}`;el.textContent=message;$('toastRegion').append(el);setTimeout(()=>el.remove(),duration); }
function monthBounds(ym){ const [y,m]=ym.split('-').map(Number);const last=new Date(y,m,0).getDate();return {min:`${ym}-01`,max:`${ym}-${String(last).padStart(2,'0')}`}; }
function activePlanRows(){ return state.plan?state.transactions.filter(t=>t.planId===state.plan.planId):[]; }
function visibleRows(){ return activePlanRows().filter(t=>!t.deleted); }

async function loadState(){ state.settings=await getSettings(); state.monthVisualMode=state.settings.selectedMonthVisualMode||'buffer'; state.donutMode=state.settings.selectedDonutMode||'planned'; state.plan=await getCurrentPlan(); state.transactions=await listTransactions(); state.display=buildDisplayState(state.plan,state.transactions); }
async function refresh(){ state.plan=await getCurrentPlan(); state.transactions=await listTransactions(); state.display=buildDisplayState(state.plan,state.transactions); renderAll(); }
function renderAll(){
  const rows=visibleRows();
  renderMonth({display:state.display,visualMode:state.monthVisualMode,donutMode:state.donutMode,selectedSegment:state.selectedSegment,recentTransactions:rows,onSegment:key=>{state.selectedSegment=state.selectedSegment===key?'':key;renderAll();},onBudget:id=>openTransaction({kind:'budget_expense',budgetId:id}),onTransaction:id=>openTransaction({id})});
  renderTransactions({plan:state.plan,transactions:rows,filter:state.transactionFilter,budgetFilter:state.transactionBudgetFilter,onEdit:id=>openTransaction({id})});
  renderSync({plan:state.plan,transactions:state.transactions,pendingPlan:state.pendingPlan,onAcceptPlan:acceptPendingPlan});
  renderSettings(state.settings);
  const pending=state.plan?pendingSummary(state.transactions,state.plan):{count:0};
  const badge=$('syncNavBadge');badge.textContent=String(pending.count);setHidden(badge,!pending.count);
  updateHeaderSyncStatus(pending.count);
  $('shareTransactionCode').classList.toggle('hidden',!navigator.share);
}

function setExpenseKind(kind){ $('transactionKind').value=kind; document.querySelectorAll('[data-expense-kind]').forEach(b=>b.classList.toggle('active',b.dataset.expenseKind===kind)); setHidden($('budgetField'),kind!=='budget_expense'); setHidden($('categoryField'),kind==='budget_expense'); }
function fillTransactionSelectors(){
  $('transactionBudget').innerHTML=(state.plan?.budgets||[]).map(b=>`<option value="${escapeHtml(b.id)}">${escapeHtml(b.name)} · ${escapeHtml(b.category)}</option>`).join('');
  const kind=$('transactionKind').value; const categories=kind==='income'?INCOME_CATEGORIES:EXPENSE_CATEGORIES; $('transactionCategory').innerHTML=categories.map(c=>`<option>${escapeHtml(c)}</option>`).join('');
}
async function openTransaction({kind='budget_expense',budgetId='',id=''}={}){
  if(!state.plan){ toast('Bitte zuerst einen Plan vom PC importieren.',{error:true});router.go('sync');return; }
  const existing=id?await getTransaction(id):null; if(existing?.deleted)return;
  const txKind=existing?.kind||kind; $('transactionId').value=existing?.id||''; $('transactionKind').value=txKind; fillTransactionSelectors();
  const isIncome=txKind==='income'; $('transactionDialogEyebrow').textContent=existing?'Buchung':'Neue Buchung'; $('transactionDialogTitle').textContent=isIncome?'Einnahme erfassen':'Ausgabe erfassen'; setHidden($('expenseKindSelector'),isIncome); setExpenseKind(txKind); if(isIncome){setHidden($('budgetField'),true);setHidden($('categoryField'),false); fillTransactionSelectors();}
  const defaultDate=todayLocal().startsWith(`${state.plan.month}-`)?todayLocal():`${state.plan.month}-01`; const bounds=monthBounds(state.plan.month); $('transactionDate').min=bounds.min;$('transactionDate').max=bounds.max;
  $('transactionAmount').value=existing?centsToInput(existing.amountCents):''; $('transactionDate').value=existing?.date||defaultDate; $('transactionDescription').value=existing?.description||'';$('transactionNote').value=existing?.note||'';
  if(txKind==='budget_expense'){ $('transactionBudget').value=existing?.budgetId||budgetId||(state.plan.budgets[0]?.id||''); }
  else { $('transactionCategory').value=existing?.category||(isIncome?'Sonstiges':'Sonstiges'); }
  const locked=existing?.status==='confirmed'; setHidden($('transactionLockNotice'),!locked); setHidden($('deleteTransactionButton'),!existing||locked); $('saveTransactionButton').disabled=locked;
  for(const el of $('transactionForm').querySelectorAll('input,select,textarea,button[data-expense-kind]')){ if(el.id==='transactionId'||el.id==='transactionKind')continue; el.disabled=locked; }
  $('transactionDialog').showModal(); setTimeout(()=>$('transactionAmount').focus(),80);
}

async function saveTransactionFromForm(){
  const existingId=$('transactionId').value,existing=existingId?await getTransaction(existingId):null; if(existing?.status==='confirmed')throw new Error('Bestätigte Buchungen können nicht geändert werden.');
  const amountCents=parseEuroToCents($('transactionAmount').value); if(!Number.isSafeInteger(amountCents)||amountCents<=0)throw new Error('Bitte einen gültigen Betrag größer als 0 eingeben.');
  const date=$('transactionDate').value;if(!date||date.slice(0,7)!==state.plan.month)throw new Error(`Das Datum muss im synchronisierten Monat ${state.plan.month} liegen.`);
  const kind=$('transactionKind').value; let budgetId='',category='Sonstiges';
  if(kind==='budget_expense'){budgetId=$('transactionBudget').value;const b=state.plan.budgets.find(x=>x.id===budgetId);if(!b)throw new Error('Das ausgewählte Budget existiert im Plan nicht mehr.');category=b.category||b.name;}
  else category=$('transactionCategory').value||'Sonstiges';
  const now=new Date().toISOString(); const row={id:existing?.id||uuid(),recordRevision:(existing?.recordRevision||0)+1,planId:state.plan.planId,basePlanRevision:state.plan.revision,createdAt:existing?.createdAt||now,updatedAt:now,date,month:date.slice(0,7),kind,amountCents,budgetId,category,description:$('transactionDescription').value.trim(),note:$('transactionNote').value.trim(),status:'local',preparedExportIds:[],everPrepared:Boolean(existing?.everPrepared || (existing?.preparedExportIds||[]).length),confirmedAt:null,deleted:false};
  await saveTransaction(row); $('transactionDialog').close(); await refresh(); toast(existing?'Buchung aktualisiert.':'Buchung gespeichert.');
}
async function deleteCurrentTransaction(){
  const id=$('transactionId').value;if(!id)return;const existing=await getTransaction(id);if(!existing||existing.status==='confirmed')return;
  if(!confirm('Diese Buchung löschen?'))return;
  if(existing.status==='local'&&!existing.everPrepared&&!(existing.preparedExportIds||[]).length){await deleteTransaction(id);} else { existing.deleted=true;existing.recordRevision=(existing.recordRevision||1)+1;existing.updatedAt=new Date().toISOString();existing.status='local';existing.preparedExportIds=[];await saveTransaction(existing); }
  $('transactionDialog').close();await refresh();toast('Buchung gelöscht.');
}

async function previewPlanCode(code){
  try { const plan=await decodeFP1(code,{expectedType:'P'}); state.pendingPlan=plan; $('codeDialogError').textContent='';setHidden($('codeDialogError'),true);$('codeDialog').open&&$('codeDialog').close(); stopScanner();router.go('sync');renderAll();toast('Plan-Code geprüft. Bitte Vorschau übernehmen.'); }
  catch(err){ $('codeDialogError').textContent=err.message;setHidden($('codeDialogError'),false);throw err; }
}
async function acceptPendingPlan(){
  const plan=state.pendingPlan;if(!plan)return;
  if(state.plan&&plan.planId===state.plan.planId&&plan.revision<state.plan.revision&&!confirm(`Planrevision ${plan.revision} ist älter als die gespeicherte Revision ${state.plan.revision}. Trotzdem übernehmen?`))return;
  await savePlan(plan);const confirmed=await markAcknowledged(plan);await addSyncHistory({planId:plan.planId,type:'plan-import',revision:plan.revision,createdAt:new Date().toISOString(),confirmedTransactions:confirmed});state.pendingPlan=null;await refresh();toast(`Plan übernommen${confirmed?` · ${confirmed} Buchung${confirmed===1?'':'en'} bestätigt`:''}.`);
}

async function generateTransactionCode(){
  if(!state.plan)return; const rows=state.transactions.filter(t=>t.planId===state.plan.planId&&t.status!=='confirmed'); if(!rows.length){toast('Keine nicht bestätigten Buchungen vorhanden.');return;}
  try {
    const payload=buildTransactionPayload({plan:state.plan,transactions:rows,settings:state.settings}); const code=await encodeFP1('T',payload); state.lastTransactionCode=code; $('transactionCodeText').value=code;setHidden($('transactionExport'),false);setHidden($('qrTooLarge'),true);
    for(const row of rows){row.status='prepared';row.everPrepared=true;row.preparedExportIds=[...new Set([...(row.preparedExportIds||[]),payload.exportId])];} await putManyTransactions(rows);await addSyncHistory({planId:state.plan.planId,type:'transaction-export',exportId:payload.exportId,transactionIds:rows.map(x=>x.id),createdAt:payload.generatedAt});
    try { renderQr($('qrOutput'),code,{size:285}); } catch(err){ $('qrTooLarge').textContent=`${err.message} Der Textcode bleibt vollständig nutzbar.`;setHidden($('qrTooLarge'),false); }
    await refresh();toast(`${rows.length} Änderung${rows.length===1?'':'en'} für Export vorbereitet.`);
  } catch(err){toast(err.message,{error:true,duration:5200});}
}

function openCodeDialog(){ $('planCodeInput').value='';$('codeDialogError').textContent='';setHidden($('codeDialogError'),true);$('codeDialog').showModal();setTimeout(()=>$('planCodeInput').focus(),80); }
async function copyTransactionCode(){ const code=$('transactionCodeText').value;if(!code)return;try{await navigator.clipboard.writeText(code);toast('Code kopiert.');}catch{ $('transactionCodeText').select();document.execCommand('copy');toast('Code kopiert.');} }
async function shareTransactionCode(){ const code=$('transactionCodeText').value;if(!code||!navigator.share)return;try{await navigator.share({title:'Capyt · Mobile · FP1-T',text:code});}catch(err){if(err.name!=='AbortError')toast('Teilen fehlgeschlagen.',{error:true});} }

async function openScanner(){ $('scannerStatus').textContent='Kamera wird erst nach deiner Freigabe verwendet.';$('scannerDialog').showModal(); }
function stopScanner(){stopQrScanner($('scannerVideo'));if($('scannerDialog').open)$('scannerDialog').close();}
async function startScannerAction(){ try{await startQrScanner({video:$('scannerVideo'),canvas:$('scannerCanvas'),onStatus:s=>$('scannerStatus').textContent=s,onResult:async code=>{try{await previewPlanCode(code);}catch(err){toast(err.message,{error:true});}}});}catch(err){$('scannerStatus').textContent=`${err.message} Du kannst alternativ ein QR-Foto auswählen oder den Code manuell einfügen.`;toast('Kamera-QR-Scan konnte nicht gestartet werden.',{error:true});} }
async function scanQrPhoto(file){ if(!file)return; try{const code=await decodeQrImageFile(file,{canvas:$('scannerCanvas'),onStatus:s=>$('scannerStatus').textContent=s});await previewPlanCode(code);}catch(err){$('scannerStatus').textContent=err.message;toast(err.message,{error:true});}finally{$('scannerPhotoInput').value='';} }

async function exportLocalBackup(){const data=await exportAllData();downloadText(`capyt-mobile-backup-${todayLocal()}.json`,JSON.stringify(data,null,2));toast('Lokales Backup erstellt.');}
async function resetData(){if(!confirm('Alle lokalen Pläne, Buchungen und Sync-Stände auf diesem Gerät löschen?'))return;await resetAllData();state.pendingPlan=null;state.lastTransactionCode='';await loadState();renderAll();toast('Lokale Daten gelöscht.');}

function setupEvents(){
  document.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>router.go(b.dataset.nav))); document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>{router.go(b.dataset.go);if(b.dataset.syncAction==='scan')openScanner();if(b.dataset.syncAction==='paste')openCodeDialog();}));
  document.querySelectorAll('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>$(b.dataset.closeDialog)?.close()));
  document.querySelectorAll('[data-month-visual]').forEach(b=>b.addEventListener('click',async()=>{state.monthVisualMode=b.dataset.monthVisual==='donut'?'donut':'buffer';state.selectedSegment='';state.settings=await saveSettings({selectedMonthVisualMode:state.monthVisualMode});renderAll();}));
  document.querySelectorAll('[data-donut-mode]').forEach(b=>b.addEventListener('click',async()=>{state.donutMode=b.dataset.donutMode;state.selectedSegment='';state.settings=await saveSettings({selectedDonutMode:state.donutMode});renderAll();}));
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{state.transactionFilter=b.dataset.filter;renderAll();})); $('transactionBudgetFilter').addEventListener('change',e=>{state.transactionBudgetFilter=e.target.value;renderAll();});
  $('fabExpense').addEventListener('click',()=>openTransaction({kind:'budget_expense'}));$('monthAddTransactionButton').addEventListener('click',()=>openTransaction({kind:'budget_expense'}));$('addIncomeButton').addEventListener('click',()=>openTransaction({kind:'income'})); document.querySelectorAll('[data-expense-kind]').forEach(b=>b.addEventListener('click',()=>{setExpenseKind(b.dataset.expenseKind);fillTransactionSelectors();setExpenseKind(b.dataset.expenseKind);}));
  $('transactionForm').addEventListener('submit',e=>{e.preventDefault();saveTransactionFromForm().catch(err=>toast(err.message,{error:true}));}); $('deleteTransactionButton').addEventListener('click',deleteCurrentTransaction);
  $('scanPlanButton').addEventListener('click',openScanner);$('pastePlanButton').addEventListener('click',openCodeDialog);$('scannerPasteFallback').addEventListener('click',()=>{stopScanner();openCodeDialog();});$('closeScanner').addEventListener('click',stopScanner);$('startScanner').addEventListener('click',startScannerAction);$('scannerPhotoButton').addEventListener('click',()=>{stopQrScanner($('scannerVideo'));$('scannerStatus').textContent='Kamera-Foto aufnehmen. QR-Code möglichst groß, scharf und vollständig fotografieren.';$('scannerPhotoInput').click();});$('scannerPhotoInput').addEventListener('change',e=>scanQrPhoto(e.target.files?.[0]));
  $('codeForm').addEventListener('submit',e=>{e.preventDefault();previewPlanCode($('planCodeInput').value).catch(err=>toast(err.message,{error:true}));});$('generateTransactionCode').addEventListener('click',generateTransactionCode);$('copyTransactionCode').addEventListener('click',copyTransactionCode);$('shareTransactionCode').addEventListener('click',shareTransactionCode);
  $('deviceName').addEventListener('change',async e=>{state.settings=await saveSettings({deviceName:e.target.value.trim()});toast('Gerätename gespeichert.');});$('themeSetting').addEventListener('change',async e=>{state.settings=await saveSettings({theme:e.target.value});applyTheme(e.target.value);});$('exportLocalData').addEventListener('click',exportLocalBackup);$('resetLocalData').addEventListener('click',resetData);
  window.addEventListener('online',updateNetworkState);window.addEventListener('offline',updateNetworkState);window.addEventListener('resize',debounce(()=>renderAll(),180));window.addEventListener('capyt-themechange',()=>renderAll());document.addEventListener('visibilitychange',()=>{if(document.hidden)stopQrScanner($('scannerVideo'));});
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();state.deferredInstall=e;setHidden($('installButton'),false);});$('installButton').addEventListener('click',async()=>{if(!state.deferredInstall)return;state.deferredInstall.prompt();await state.deferredInstall.userChoice;state.deferredInstall=null;setHidden($('installButton'),true);});
}
function updateHeaderSyncStatus(pendingCount=state.plan?pendingSummary(state.transactions,state.plan).count:0){const el=$('headerSyncStatus');if(!el)return;const offline=!navigator.onLine;el.classList.toggle('offline',offline);el.classList.toggle('pending',!offline&&pendingCount>0);const text=el.querySelector('.status-text');if(text)text.textContent=offline?'Offline':!state.plan?'Plan fehlt':pendingCount?`${pendingCount} offen`:'Synchron';}
function updateNetworkState(){setHidden($('offlineBadge'),navigator.onLine);updateHeaderSyncStatus();}
async function updateScannerHint(){const capability=await qrScannerCapability();$('cameraSupportHint').textContent=capability.native?'Kamera-QR-Scan wird von diesem Browser nativ unterstützt.':capability.camera?(capability.javascript?'Kamera-QR-Scan nutzt hier den lokalen Safari-kompatiblen JS-Decoder.':'Kamera ist verfügbar; auf Safari wird der JS-QR-Decoder beim Scan geladen.'):'Kamerazugriff ist hier nicht verfügbar. QR-Foto und Textcode bleiben als Importwege verfügbar.';}
async function boot(){
  $('appVersion').textContent=APP_VERSION;await loadState();applyTheme(state.settings.theme);router=createRouter({onChange:view=>setHidden($('fabExpense'),view!=='month'||!state.plan)});setupEvents();updateNetworkState();updateScannerHint();renderAll();
}
boot().catch(err=>{console.error(err);document.body.insertAdjacentHTML('afterbegin',`<div class="fatal">App konnte nicht gestartet werden: ${escapeHtml(err.message)}</div>`);});
