let scannerStream=null, scannerTimer=0, detector=null, decoderLoadPromise=null;

const JSQR_CDN='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
const SCAN_INTERVAL_MS=120;
const MAX_SCAN_DIMENSION=1600;
const SCAN_CROP_DIMENSION=1200;
const IMAGE_SCAN_DIMENSIONS=[1200,1800,2400,3200];

export function qrGeneratorAvailable() { return typeof globalThis.QRCode === 'function'; }
export function renderQr(target,text,{size=280}={}) {
  target.innerHTML=''; if(!qrGeneratorAvailable()) throw new Error('Lokale QR-Code-Bibliothek wurde nicht geladen.');
  try { new QRCode(target,{text,width:size,height:size,correctLevel:QRCode.CorrectLevel.L}); return true; }
  catch(err){ target.innerHTML=''; throw new Error(`QR-Code ist für diese Datenmenge zu groß: ${err.message||err}`); }
}

export function canUseCamera() { return Boolean(navigator.mediaDevices?.getUserMedia); }
export function canNativeScan() { return 'BarcodeDetector' in globalThis && canUseCamera(); }
export async function nativeQrSupported() {
  if(!canNativeScan()) return false;
  try { const formats=await BarcodeDetector.getSupportedFormats(); return formats.includes('qr_code'); }
  catch { return false; }
}
export function jsQrAvailable() { return typeof globalThis.jsQR === 'function'; }

function loadScript(src){
  return new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src===src);
    if(existing){
      if(jsQrAvailable()) return resolve();
      existing.addEventListener('load',()=>resolve(),{once:true});
      existing.addEventListener('error',()=>reject(new Error('QR-Decoder konnte nicht geladen werden.')),{once:true});
      return;
    }
    const script=document.createElement('script'); script.src=src; script.async=true; script.crossOrigin='anonymous';
    script.addEventListener('load',()=>resolve(),{once:true});
    script.addEventListener('error',()=>reject(new Error('QR-Decoder konnte nicht geladen werden.')),{once:true});
    document.head.append(script);
  });
}

export async function ensureJsQr(onStatus){
  if(jsQrAvailable()) return true;
  if(!decoderLoadPromise){
    decoderLoadPromise=(async()=>{
      onStatus?.('Safari-QR-Decoder wird vorbereitet …');
      await loadScript(JSQR_CDN);
      if(!jsQrAvailable()) throw new Error('Der QR-Decoder wurde nicht korrekt geladen.');
      return true;
    })().catch(err=>{decoderLoadPromise=null;throw err;});
  }
  return decoderLoadPromise;
}

export async function qrScannerCapability(){
  if(!canUseCamera()) return {camera:false,native:false,javascript:jsQrAvailable()};
  const native=await nativeQrSupported();
  return {camera:true,native,javascript:jsQrAvailable()};
}

export function decodeImageDataWithJsQr(imageData,width,height,{inversionAttempts='dontInvert'}={}){
  if(!jsQrAvailable()) return '';
  const result=globalThis.jsQR(imageData,width,height,{inversionAttempts});
  return String(result?.data||'');
}

function drawVideoFrame(video,canvas,maxDimension=MAX_SCAN_DIMENSION,crop=null){
  const sourceWidth=video.videoWidth||0, sourceHeight=video.videoHeight||0;
  if(!sourceWidth||!sourceHeight) return null;
  let sx=0,sy=0,sw=sourceWidth,sh=sourceHeight;
  if(crop){
    sw=Math.max(1,Math.round(sourceWidth*crop.w)); sh=Math.max(1,Math.round(sourceHeight*crop.h));
    sx=Math.max(0,Math.round((sourceWidth-sw)*crop.x)); sy=Math.max(0,Math.round((sourceHeight-sh)*crop.y));
  }
  const scale=Math.min(1,maxDimension/Math.max(sw,sh));
  const width=Math.max(1,Math.round(sw*scale)),height=Math.max(1,Math.round(sh*scale));
  if(canvas.width!==width) canvas.width=width; if(canvas.height!==height) canvas.height=height;
  const context=canvas.getContext('2d',{willReadFrequently:true}); if(!context) return null;
  context.drawImage(video,sx,sy,sw,sh,0,0,width,height);
  return {context,width,height,imageData:context.getImageData(0,0,width,height)};
}

function decodeFrameCandidates(video,canvas,frameCount){
  const candidates=[
    drawVideoFrame(video,canvas,MAX_SCAN_DIMENSION),
    drawVideoFrame(video,canvas,SCAN_CROP_DIMENSION,{x:.5,y:.5,w:.72,h:.72})
  ].filter(Boolean);
  for(const frame of candidates){
    let value=decodeImageDataWithJsQr(frame.imageData.data,frame.width,frame.height,{inversionAttempts:'dontInvert'});
    if(!value && frameCount%4===0) value=decodeImageDataWithJsQr(frame.imageData.data,frame.width,frame.height,{inversionAttempts:'attemptBoth'});
    if(value) return value;
  }
  return '';
}

async function improveCameraForQr(stream){
  const track=stream?.getVideoTracks?.()[0]; if(!track?.applyConstraints) return;
  try {
    const caps=track.getCapabilities?.()||{}; const advanced=[];
    if(Array.isArray(caps.focusMode)&&caps.focusMode.includes('continuous')) advanced.push({focusMode:'continuous'});
    if(caps.zoom&&Number.isFinite(caps.zoom.min)&&Number.isFinite(caps.zoom.max)){
      const z=Math.min(caps.zoom.max,Math.max(caps.zoom.min,1)); if(z>1) advanced.push({zoom:z});
    }
    if(advanced.length) await track.applyConstraints({advanced});
  } catch {}
}


function finishScan(video,onResult,value){
  if(!value) return false;
  stopQrScanner(video); onResult(value); return true;
}

export async function startQrScanner({video,canvas,onResult,onStatus}) {
  if(!canUseCamera()) throw new Error('Kamerazugriff ist in diesem Browser nicht verfügbar. GitHub Pages muss über HTTPS geöffnet werden.');
  if(!canvas) throw new Error('Scanner-Canvas fehlt.');
  stopQrScanner(video); onStatus?.('Kamerazugriff wird angefordert …');
  scannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1440}},audio:false});
  await improveCameraForQr(scannerStream);
  video.setAttribute('playsinline',''); video.muted=true; video.srcObject=scannerStream; await video.play();

  const useNative=await nativeQrSupported();
  if(useNative){
    detector=new BarcodeDetector({formats:['qr_code']}); onStatus?.('QR-Code in den Rahmen halten. Nativer Scanner aktiv.');
    const tick=async()=>{
      if(!scannerStream) return;
      try { const codes=await detector.detect(video); const value=codes.find(x=>x.rawValue)?.rawValue; if(finishScan(video,onResult,value)) return; }
      catch(err){ onStatus?.(`Scannerfehler: ${err.message}`); }
      scannerTimer=setTimeout(tick,SCAN_INTERVAL_MS);
    };
    scannerTimer=setTimeout(tick,80); return;
  }

  await ensureJsQr(onStatus);
  onStatus?.('QR-Code in den Rahmen halten. Safari-kompatibler JS-Scanner aktiv.');
  let frameCount=0, lastHint=0;
  const tick=()=>{
    if(!scannerStream) return;
    try {
      if(video.readyState>=2){
        frameCount+=1;
        const value=decodeFrameCandidates(video,canvas,frameCount);
        if(finishScan(video,onResult,value)) return;
        const now=Date.now();
        if(now-lastHint>3500){ onStatus?.('QR-Code vollständig sichtbar halten, etwa 15–25 cm Abstand. Bildschirmhelligkeit am PC erhöhen und Spiegelungen vermeiden.'); lastHint=now; }
      }
    } catch(err){ onStatus?.(`Scannerfehler: ${err.message}`); }
    scannerTimer=setTimeout(tick,SCAN_INTERVAL_MS);
  };
  scannerTimer=setTimeout(tick,100);
}

function loadImage(file){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file),image=new Image();
    image.onload=()=>resolve({image,url}); image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Das ausgewählte Bild konnte nicht gelesen werden.'));}; image.src=url;
  });
}

export async function decodeQrImageFile(file,{canvas,onStatus}={}){
  if(!file) throw new Error('Bitte ein QR-Code-Bild aufnehmen oder auswählen.'); if(!canvas) throw new Error('Scanner-Canvas fehlt.');
  await ensureJsQr(onStatus); onStatus?.('QR-Code im Foto wird analysiert …');
  const {image,url}=await loadImage(file);
  try {
    const sourceWidth=image.naturalWidth||image.width, sourceHeight=image.naturalHeight||image.height;
    if(!sourceWidth||!sourceHeight) throw new Error('Das Foto hat keine lesbare Bildgröße.');
    const context=canvas.getContext('2d',{willReadFrequently:true}); if(!context) throw new Error('Bild-Canvas konnte nicht initialisiert werden.');
    const crops=[
      {x:0,y:0,w:1,h:1,label:'gesamtes Foto'},
      {x:.04,y:.04,w:.92,h:.92,label:'großer Mittelausschnitt'},
      {x:.12,y:.12,w:.76,h:.76,label:'Mittelausschnitt'}
    ];
    let attempt=0;
    for(const crop of crops){
      const sx=Math.round(sourceWidth*crop.x), sy=Math.round(sourceHeight*crop.y);
      const sw=Math.max(1,Math.round(sourceWidth*crop.w)), sh=Math.max(1,Math.round(sourceHeight*crop.h));
      for(const maxDimension of IMAGE_SCAN_DIMENSIONS){
        attempt+=1;
        const scale=Math.min(1,maxDimension/Math.max(sw,sh));
        const width=Math.max(1,Math.round(sw*scale)), height=Math.max(1,Math.round(sh*scale));
        canvas.width=width; canvas.height=height;
        context.imageSmoothingEnabled=true; context.imageSmoothingQuality='high';
        context.clearRect(0,0,width,height); context.drawImage(image,sx,sy,sw,sh,0,0,width,height);
        const data=context.getImageData(0,0,width,height);
        let value=decodeImageDataWithJsQr(data.data,width,height,{inversionAttempts:'dontInvert'});
        if(!value) value=decodeImageDataWithJsQr(data.data,width,height,{inversionAttempts:'attemptBoth'});
        if(value) return value;
        onStatus?.(`Foto wird analysiert … Versuch ${attempt}`);
        if(scale===1) break;
        await new Promise(resolve=>setTimeout(resolve,0));
      }
    }
    throw new Error('QR-Code im Foto nicht erkannt. Bitte QR möglichst groß, gerade, scharf und vollständig fotografieren; Bildschirmhelligkeit erhöhen und Spiegelungen vermeiden.');
  } finally { URL.revokeObjectURL(url); }
}

export function stopQrScanner(video) {
  if(scannerTimer) clearTimeout(scannerTimer); scannerTimer=0;
  if(scannerStream){ for(const track of scannerStream.getTracks()) track.stop(); scannerStream=null; }
  if(video){ video.pause?.(); video.srcObject=null; }
  detector=null;
}
