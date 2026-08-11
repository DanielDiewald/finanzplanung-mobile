/* Finanzplanung v10 -> Mobile FP1 integration addon.
   Load AFTER the original v10 script. Requires local qrcode.min.js before this file for QR output. */
(() => {
  'use strict';
  const FP1_PROTOCOL_VERSION = 1;
  const te = new TextEncoder(), td = new TextDecoder();
  const fp1EuroToCents = value => Math.round((Number(value) || 0) * 100);
  const fp1CentsToEuro = cents => (Number(cents) || 0) / 100;
  const fp1Uuid = () => globalThis.crypto?.randomUUID ? crypto.randomUUID() : `fp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const fp1Escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  function fp1Meta() {
    if (!isPlainObject(state.meta.mobileSync)) state.meta.mobileSync = {};
    const m = state.meta.mobileSync;
    if (!m.planId) m.planId = fp1Uuid();
    if (!Number.isInteger(m.revision) || m.revision < 0) m.revision = 0;
    if (!isPlainObject(m.importedTransactions)) m.importedTransactions = {};
    if (!Array.isArray(m.acknowledgedExportIds)) m.acknowledgedExportIds = [];
    if (!m.lastTransactionImportAt) m.lastTransactionImportAt = null;
    return m;
  }

  function fp1Crc32(bytes) {
    let crc = 0xffffffff;
    for (let i=0;i<bytes.length;i++) { crc ^= bytes[i]; for(let j=0;j<8;j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
    return (crc ^ 0xffffffff) >>> 0;
  }
  function fp1CrcHex(bytes) { return fp1Crc32(bytes).toString(16).toUpperCase().padStart(8,'0'); }
  function fp1B64Url(bytes) { let b='',c=0x8000; for(let i=0;i<bytes.length;i+=c)b+=String.fromCharCode(...bytes.subarray(i,i+c)); return btoa(b).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
  function fp1FromB64Url(text) { const base64=String(text).replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-String(text).length%4)%4); const b=atob(base64),out=new Uint8Array(b.length);for(let i=0;i<b.length;i++)out[i]=b.charCodeAt(i);return out; }
  function fp1Canonical(value) { if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(fp1Canonical).join(',')}]`;return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${fp1Canonical(value[k])}`).join(',')}}`; }
  function fp1CompactDonut(d={}) { return [String(d.title||''),String(d.centerLabel||''),String(d.centerSubtext||''),Number(d.totalCents)||0,(Array.isArray(d.segments)?d.segments:[]).map(s=>[String(s.key||''),String(s.label||''),Number(s.amountCents)||0,String(s.group||'cost'),String(s.color||''),(Array.isArray(s.details)?s.details:[]).map(x=>[String(x.label||''),Number(x.amountCents)||0])])]; }
  function fp1ExpandDonut(a=[],mode='planned') { return {mode,title:a[0]||'',centerLabel:a[1]||'',centerSubtext:a[2]||'',totalCents:a[3]||0,segments:(Array.isArray(a[4])?a[4]:[]).map(s=>({key:s[0]||'',label:s[1]||'',amountCents:s[2]||0,group:s[3]||'cost',color:s[4]||'',details:(Array.isArray(s[5])?s[5]:[]).map(d=>({label:d[0]||'',amountCents:d[1]||0}))}))}; }
  function fp1CompactPayload(type,payload){
    if(type==='P')return {v:1,t:'P',p:payload.planId,n:payload.planName||'',r:payload.revision,m:payload.month,c:payload.createdAt,s:[payload.source?.app||'',payload.source?.dataVersion??null],a:payload.accountBalanceCents,q:payload.normalBalanceCents,f:payload.freeAvailableCents,x:payload.minimumCashBufferCents,b:payload.budgetAssetsCents,y:payload.savingsAssetsCents,z:payload.totalAssetsCents,B:(payload.budgets||[]).map(b=>[b.id,b.name,b.category,b.interval||'',b.plannedCents,b.reserveCents,b.spentCents,b.availableCents,b.color||'']),G:(payload.savingsGoals||[]).map(g=>[g.id,g.name,g.balanceCents,g.targetCents]),D:[fp1CompactDonut(payload.donuts?.planned),fp1CompactDonut(payload.donuts?.actual)],A:(payload.acknowledgedTransactions||[]).map(a=>[a.id,a.recordRevision]),I:payload.acknowledgedTransactionIds||[],E:payload.acknowledgedExportIds||[],L:payload.lastSync??null};
    return {v:1,t:'T',p:payload.planId,b:payload.basePlanRevision,m:payload.month,e:payload.exportId,g:payload.generatedAt,d:payload.deviceId,n:payload.deviceName||'',T:(payload.transactions||[]).map(x=>[x.id,x.recordRevision,x.op,x.createdAt,x.updatedAt,x.date,x.month,x.kind,x.amountCents,x.budgetId||'',x.category,x.description||'',x.note||''])};
  }
  function fp1ExpandCompact(type,x){
    if(!x||typeof x!=='object'||Array.isArray(x))throw new Error('Kompakte FP1-Nutzdaten sind ungültig.');
    if(type==='P')return {protocolVersion:x.v,type:'P',planId:x.p,planName:x.n||'',revision:x.r,month:x.m,createdAt:x.c,source:{app:x.s?.[0]||'',dataVersion:x.s?.[1]??null},accountBalanceCents:x.a,normalBalanceCents:x.q,freeAvailableCents:x.f,minimumCashBufferCents:x.x,budgetAssetsCents:x.b,savingsAssetsCents:x.y,totalAssetsCents:x.z,budgets:(Array.isArray(x.B)?x.B:[]).map(b=>({id:b[0],name:b[1],category:b[2],interval:b[3]||'monthly',plannedCents:b[4],reserveCents:b[5],spentCents:b[6],availableCents:b[7],color:b[8]||''})),savingsGoals:(Array.isArray(x.G)?x.G:[]).map(g=>({id:g[0],name:g[1],balanceCents:g[2],targetCents:g[3]})),donuts:{planned:fp1ExpandDonut(x.D?.[0]||[],'planned'),actual:fp1ExpandDonut(x.D?.[1]||[],'actual')},acknowledgedTransactions:(Array.isArray(x.A)?x.A:[]).map(a=>({id:a[0],recordRevision:a[1]})),acknowledgedTransactionIds:Array.isArray(x.I)?x.I:[],acknowledgedExportIds:Array.isArray(x.E)?x.E:[],lastSync:x.L??null};
    return {protocolVersion:x.v,type:'T',planId:x.p,basePlanRevision:x.b,month:x.m,exportId:x.e,generatedAt:x.g,deviceId:x.d,deviceName:x.n||'',transactions:(Array.isArray(x.T)?x.T:[]).map(t=>({id:t[0],recordRevision:t[1],op:t[2],createdAt:t[3],updatedAt:t[4],date:t[5],month:t[6],kind:t[7],amountCents:t[8],budgetId:t[9]||'',category:t[10],description:t[11]||'',note:t[12]||''}))};
  }
  async function fp1Transform(bytes, compression, decompress=false) { const Ctor=decompress?globalThis.DecompressionStream:globalThis.CompressionStream;if(!Ctor)throw new Error('CompressionStream/DecompressionStream wird nicht unterstützt.');return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new Ctor(compression))).arrayBuffer()); }
  async function fp1Encode(type,payload) {
    const normalized={...payload,protocolVersion:1,type}; let enc='N',transport=normalized;
    if(globalThis.CompressionStream){enc='C';transport=fp1CompactPayload(type,normalized);}
    const raw=te.encode(fp1Canonical(transport)),body=enc==='C'?await fp1Transform(raw,'deflate'):raw;
    return `FP1-${type}-${enc}-${fp1CrcHex(body)}-${fp1B64Url(body)}`;
  }
  async function fp1Decode(code,expected='T') {
    const parts=String(code||'').trim().replace(/\s+/g,'').split('-'); if(parts.length<5)throw new Error('Unvollständiger FP1-Code.');
    const [prefix,type,enc,checksum,...rest]=parts;if(prefix!=='FP1')throw new Error('Nicht unterstützte FP-Version.');if(type!==expected)throw new Error(`Falscher Code-Typ: FP1-${type}.`);if(!['C','Z','N'].includes(enc))throw new Error('Unbekannte FP1-Kodierung.');
    const body=fp1FromB64Url(rest.join('-'));if(fp1CrcHex(body)!==String(checksum).toUpperCase())throw new Error('Prüfsummenfehler: Code beschädigt.');
    const raw=(enc==='C'||enc==='Z')?await fp1Transform(body,'deflate',true):body;let payload=JSON.parse(td.decode(raw));if(enc==='C')payload=fp1ExpandCompact(type,payload);if(payload.protocolVersion!==1||payload.type!==type)throw new Error('FP1-Nutzdaten sind inkompatibel.');return payload;
  }

  function fp1ConvertDonut(data, mode) {
    return { mode, title:String(data.title||''),centerLabel:String(data.centerLabel||''),centerSubtext:String(data.centerSubtext||''),totalCents:fp1EuroToCents(data.total),segments:(data.segments||[]).map(s=>({key:String(s.key),label:String(s.label),amountCents:fp1EuroToCents(s.amount),group:String(s.group||'cost'),color:String(s.color||'#6079b8'),details:(s.details||[]).map(d=>({label:String(d.label||s.label),amountCents:fp1EuroToCents(d.amount)}))})) };
  }

  function fp1PlanPayload(ym) {
    const meta=fp1Meta(); const result=currentResults()[ym]; if(!result)throw new Error('Für den gewählten Monat liegen keine Berechnungswerte vor.');
    const budgets=allBudgetItems().map(item=>{const d=result.budgetDetails?.[item.id]||{};return {id:String(item.id),name:String(item.description||item.name||item.category||'Budget'),category:String(item.category||'Sonstiges'),interval:String(item.interval||'monthly'),plannedCents:fp1EuroToCents(item.amount),reserveCents:fp1EuroToCents(d.reserve),spentCents:fp1EuroToCents(d.spent),availableCents:fp1EuroToCents(d.closingBalance)};});
    const goals=(state.savingsGoals||[]).filter(g=>!g.closedMonth||compareMonths(g.closedMonth,ym)>=0).map(g=>({id:String(g.id),name:String(g.name||'Sparziel'),balanceCents:fp1EuroToCents(result.goalBalancesAfter?.[g.id]),targetCents:fp1EuroToCents(g.target)}));
    const ackTx=Object.entries(meta.importedTransactions).map(([id,r])=>({id,recordRevision:Number(r.recordRevision)||1})).slice(-5000);
    return { protocolVersion:1,type:'P',planId:meta.planId,planName:'Finanzplanung',revision:meta.revision,month:ym,createdAt:new Date().toISOString(),source:{app:'Finanzplanung v10',dataVersion:CURRENT_DATA_VERSION},accountBalanceCents:result.actualBankBalance==null?null:fp1EuroToCents(result.actualBankBalance),normalBalanceCents:fp1EuroToCents(result.effectiveEndingBalance),freeAvailableCents:fp1EuroToCents(result.freeAvailable),minimumCashBufferCents:fp1EuroToCents(result.minimumCashBuffer),budgetAssetsCents:fp1EuroToCents(result.budgetClosingTotal),savingsAssetsCents:fp1EuroToCents(result.savingsAssetsTotal),totalAssetsCents:fp1EuroToCents(result.totalAssets),budgets,savingsGoals:goals,donuts:{planned:fp1ConvertDonut(buildMonthAllocationData(ym,result),'planned'),actual:fp1ConvertDonut(buildMonthExpenseData(ym,result),'actual')},acknowledgedTransactions:ackTx,acknowledgedTransactionIds:[],acknowledgedExportIds:meta.acknowledgedExportIds.slice(-500),lastSync:{transactionImportAt:meta.lastTransactionImportAt}};
  }

  async function fp1GeneratePlanCode() {
    const ym=document.getElementById('fp1DesktopMonth')?.value||selectedMonth; if(!isValidMonth(ym))throw new Error('Bitte einen gültigen Monat wählen.');
    ensurePlanningThrough(ym); const meta=fp1Meta(); meta.revision += 1; saveState('Mobile Planrevision gespeichert'); const payload=fp1PlanPayload(ym); payload.revision=meta.revision; const code=await fp1Encode('P',payload);
    document.getElementById('fp1PlanCode').value=code; const qr=document.getElementById('fp1PlanQr'); qr.innerHTML='';
    if(typeof QRCode==='function'){try{new QRCode(qr,{text:code,width:640,height:640,correctLevel:QRCode.CorrectLevel.L});document.getElementById('fp1PlanQrError').textContent='';}catch(err){document.getElementById('fp1PlanQrError').textContent='QR zu groß; Textcode verwenden.';}}
    document.getElementById('fp1PlanSummary').textContent=`FP1-P-C · ${monthName(ym)} · Revision ${meta.revision} · ${payload.budgets.length} Budgets · ${code.length} Zeichen`;
  }

  function fp1ValidateTx(t) {
    if(!t||typeof t!=='object')throw new Error('Ungültige Buchung.');const id=String(t.id||'');if(!id)throw new Error('Transaktions-ID fehlt.');const rev=Number(t.recordRevision||1);if(!Number.isInteger(rev)||rev<1)throw new Error(`${id}: ungültige Buchungsrevision.`);const kind=String(t.kind||'');if(!['budget_expense','expense','income'].includes(kind))throw new Error(`${id}: unbekannte Buchungsart.`);const cents=Number(t.amountCents);if(!Number.isSafeInteger(cents)||cents<=0)throw new Error(`${id}: ungültiger Betrag.`);const date=String(t.date||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error(`${id}: ungültiges Datum.`);return {...t,id,recordRevision:rev,op:t.op==='delete'?'delete':'upsert',kind,amountCents:cents,date,month:String(t.month||date.slice(0,7)),budgetId:String(t.budgetId||''),category:String(t.category||'Sonstiges'),description:String(t.description||''),note:String(t.note||'')};
  }
  function fp1FindBudget(id){return allBudgetItems().find(x=>String(x.id)===String(id));}
  function fp1Classification(payload) {
    const meta=fp1Meta(); if(String(payload.planId)!==String(meta.planId))throw new Error('Plan-ID stimmt nicht mit dieser Finanzplanung überein.'); if(!Array.isArray(payload.transactions))throw new Error('Transaktionsliste fehlt.');
    return payload.transactions.map(raw=>{
      try{
        const tx=fp1ValidateTx(raw),existing=meta.importedTransactions[tx.id]; const monthData=state.months[tx.month];
        if(!monthData)return {tx,status:'error',message:'Monat nicht im Planungszeitraum.'}; if(monthData.locked)return {tx,status:'error',message:'Monat ist bereits gesperrt.'};
        if(existing&&Number(existing.recordRevision)>tx.recordRevision)return {tx,status:'duplicate',message:'Ältere Revision bereits überholt.'};
        if(existing&&Number(existing.recordRevision)===tx.recordRevision)return {tx,status:'duplicate',message:'Bereits importiert.'};
        if(tx.op==='delete'&&!existing)return {tx,status:'duplicate',message:'Löschung ohne vorherigen Import – nichts zu tun.'};
        if(tx.op!=='delete'&&tx.kind==='budget_expense'&&!fp1FindBudget(tx.budgetId))return {tx,status:'error',message:'Budget-ID ist am Desktop nicht vorhanden.'};
        return {tx,status:existing?'update':'new',message:existing?'Neuere Buchungsrevision.':'Neue Buchung.'};
      }catch(error){return {tx:{id:String(raw?.id||'–'),description:String(raw?.description||'')},status:'error',message:error.message};}
    });
  }
  function fp1ReverseImported(record){ if(!record||record.deleted)return;const tx=record.data,monthData=state.months[tx.month];if(!monthData)return;if(tx.kind==='budget_expense'){monthData.budgetUsage[tx.budgetId]=roundMoney(Math.max(0,asNumber(monthData.budgetUsage[tx.budgetId])-fp1CentsToEuro(tx.amountCents)));}
    else {const key=tx.kind==='income'?'incomes':'expenses';monthData[key]=(monthData[key]||[]).filter(x=>String(x.mobileTransactionId||'')!==String(tx.id));}}
  function fp1ApplyOne(tx){const meta=fp1Meta(),previous=meta.importedTransactions[tx.id];if(previous)fp1ReverseImported(previous);const monthData=state.months[tx.month];
    if(tx.op!=='delete'){
      if(tx.kind==='budget_expense'){monthData.budgetUsage[tx.budgetId]=roundMoney(asNumber(monthData.budgetUsage[tx.budgetId])+fp1CentsToEuro(tx.amountCents));monthData.budgetUsageConfirmed=true;}
      else {const key=tx.kind==='income'?'incomes':'expenses';monthData[key]=monthData[key]||[];monthData[key].push({id:`mobile-${tx.id}`,mobileTransactionId:tx.id,mobileRecordRevision:tx.recordRevision,date:tx.date,description:tx.description||tx.category,category:tx.category,amount:fp1CentsToEuro(tx.amountCents),type:tx.kind==='income'?'income':'expense',note:tx.note||''});}
    }
    meta.importedTransactions[tx.id]={recordRevision:tx.recordRevision,deleted:tx.op==='delete',importedAt:new Date().toISOString(),data:deepClone(tx)};
  }

  let fp1PendingImport=null;
  async function fp1PreviewTransactionCode(){
    const code=document.getElementById('fp1TransactionCode').value;const payload=await fp1Decode(code,'T');const meta=fp1Meta();const rows=fp1Classification(payload);fp1PendingImport={payload,rows};
    const stale=Number(payload.basePlanRevision)<Number(meta.revision);const counts={new:0,update:0,duplicate:0,error:0};rows.forEach(r=>counts[r.status]++);
    document.getElementById('fp1ImportSummary').innerHTML=`<div class="notice ${counts.error?'warn':''}"><strong>${rows.length} Änderungen gefunden</strong><br>${counts.new} neu · ${counts.update} geändert · ${counts.duplicate} bereits vorhanden · ${counts.error} Fehler${stale?'<br>Hinweis: Der Mobile-Code basiert auf einem älteren Planstand. Tatsächliche Buchungen bleiben trotzdem importierbar.':''}</div><div class="table-wrap"><table><thead><tr><th>Status</th><th>Buchung</th><th>Betrag</th><th>Hinweis</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${fp1Escape(r.status)}</td><td>${fp1Escape(r.tx.description||r.tx.category||r.tx.id)}</td><td class="num">${r.tx.amountCents?money(fp1CentsToEuro(r.tx.amountCents)):'–'}</td><td>${fp1Escape(r.message)}</td></tr>`).join('')}</tbody></table></div><button id="fp1ApplyImport" type="button" class="primary" ${counts.error?'':' '} style="margin-top:.7rem">Gültige Änderungen übernehmen</button>`;
    document.getElementById('fp1ApplyImport').addEventListener('click',fp1ApplyImport);
  }
  function fp1ApplyImport(){if(!fp1PendingImport)return;const {payload,rows}=fp1PendingImport;let applied=0;for(const row of rows){if(row.status==='new'||row.status==='update'){fp1ApplyOne(row.tx);applied++;}}
    const meta=fp1Meta();const errors=rows.filter(r=>r.status==='error').length;if(!errors&&payload.exportId){meta.acknowledgedExportIds=[...new Set([...meta.acknowledgedExportIds,String(payload.exportId)])].slice(-500);}meta.lastTransactionImportAt=new Date().toISOString();saveState(`Mobile Sync: ${applied} Änderung(en) übernommen`);renderAll();document.getElementById('fp1ImportSummary').insertAdjacentHTML('afterbegin',`<div class="notice">Import abgeschlossen: ${applied} Änderung(en) übernommen. ${rows.filter(r=>r.status==='duplicate').length} Duplikat(e) ignoriert.${errors?` ${errors} Fehler nicht übernommen.`:''}</div>`);fp1PendingImport=null;}

  function fp1InjectUi(){
    const target=document.getElementById('view-backup');if(!target||document.getElementById('fp1DesktopSyncPanel'))return;const months=planningMonths();
    const panel=document.createElement('div');panel.className='panel';panel.id='fp1DesktopSyncPanel';panel.innerHTML=`<h2>Mobile Begleit-App · FP1</h2><p class="help">Desktop bleibt die Planungsinstanz. PLAN-CODE sendet berechnete Monatswerte an das Smartphone; TRANSAKTIONS-CODE übernimmt tatsächliche mobile Buchungen per ID und Buchungsrevision.</p><div class="grid"><div><h3>PLAN-CODE · PC → Smartphone</h3><div class="field"><label for="fp1DesktopMonth">Monat</label><select id="fp1DesktopMonth">${months.map(ym=>`<option value="${ym}" ${ym===selectedMonth?'selected':''}>${fp1Escape(monthName(ym))}</option>`).join('')}</select></div><button id="fp1GeneratePlan" type="button" class="primary" style="margin-top:.6rem">Code für mobile App erzeugen</button><p id="fp1PlanSummary" class="help"></p><div id="fp1PlanQr" style="display:grid;place-items:center;background:#fff;padding:28px;width:max-content;max-width:100%;overflow:auto"></div><p id="fp1PlanQrError" class="help"></p><textarea id="fp1PlanCode" rows="6" readonly style="width:100%;margin-top:.6rem"></textarea><button id="fp1CopyPlan" type="button" style="margin-top:.4rem">Plan-Code kopieren</button></div><div><h3>TRANSAKTIONS-CODE · Smartphone → PC</h3><textarea id="fp1TransactionCode" rows="7" placeholder="FP1-T-C-…" style="width:100%"></textarea><button id="fp1PreviewImport" type="button" class="primary" style="margin-top:.6rem">Code prüfen</button><div id="fp1ImportSummary"></div></div></div>`;target.prepend(panel);
    document.getElementById('fp1GeneratePlan').addEventListener('click',()=>fp1GeneratePlanCode().catch(e=>alert(e.message)));document.getElementById('fp1PreviewImport').addEventListener('click',()=>fp1PreviewTransactionCode().catch(e=>alert(e.message)));document.getElementById('fp1CopyPlan').addEventListener('click',async()=>{const c=document.getElementById('fp1PlanCode').value;if(c)await navigator.clipboard.writeText(c);});
  }
  if (globalThis.__FP1_ENABLE_TEST_HOOKS__) {
    globalThis.__FP1_DESKTOP_TEST_API__ = { fp1Meta, fp1Encode, fp1Decode, fp1PlanPayload, fp1ValidateTx, fp1Classification, fp1ReverseImported, fp1ApplyOne };
  }
  fp1Meta(); fp1InjectUi(); saveState('FP1 Mobile-Sync initialisiert');
})();
