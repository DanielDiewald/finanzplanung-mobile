let scannerStream=null, scannerTimer=0, detector=null, decoderLoadPromise=null;

const JSQR_CDN='https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
const SCAN_INTERVAL_MS=120;
const MAX_SCAN_DIMENSION=960;
const MAX_IMAGE_DIMENSION=1600;

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

function drawVideoFrame(video,canvas,maxDimension=MAX_SCAN_DIMENSION){
  const sourceWidth=video.videoWidth||0, sourceHeight=video.videoHeight||0;
  if(!sourceWidth||!sourceHeight) return null;
  const scale=Math.min(1,maxDimension/Math.max(sourceWidth,sourceHeight));
  const width=Math.max(1,Math.round(sourceWidth*scale)),height=Math.max(1,Math.round(sourceHeight*scale));
  if(canvas.width!==width) canvas.width=width; if(canvas.height!==height) canvas.height=height;
  const context=canvas.getContext('2d',{willReadFrequently:true}); if(!context) return null;
  context.drawImage(video,0,0,width,height);
  return {context,width,height,imageData:context.getImageData(0,0,width,height)};
}

function finishScan(video,onResult,value){
  if(!value) return false;
  stopQrScanner(video); onResult(value); return true;
}

export async function startQrScanner({video,canvas,onResult,onStatus}) {
  if(!canUseCamera()) throw new Error('Kamerazugriff ist in diesem Browser nicht verfügbar. GitHub Pages muss über HTTPS geöffnet werden.');
  if(!canvas) throw new Error('Scanner-Canvas fehlt.');
  stopQrScanner(video); onStatus?.('Kamerazugriff wird angefordert …');
  scannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:1280}},audio:false});
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
  let frameCount=0;
  const tick=()=>{
    if(!scannerStream) return;
    try {
      if(video.readyState>=2){
        const frame=drawVideoFrame(video,canvas); frameCount+=1;
        if(frame){
          let value=decodeImageDataWithJsQr(frame.imageData.data,frame.width,frame.height,{inversionAttempts:'dontInvert'});
          if(!value && frameCount%8===0) value=decodeImageDataWithJsQr(frame.imageData.data,frame.width,frame.height,{inversionAttempts:'attemptBoth'});
          if(finishScan(video,onResult,value)) return;
        }
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
  if(!file) throw new Error('Bitte ein QR-Code-Bild auswählen.'); if(!canvas) throw new Error('Scanner-Canvas fehlt.');
  await ensureJsQr(onStatus); onStatus?.('QR-Code im Bild wird gelesen …');
  const {image,url}=await loadImage(file);
  try {
    const sourceWidth=image.naturalWidth||image.width,sourceHeight=image.naturalHeight||image.height;
    const scale=Math.min(1,MAX_IMAGE_DIMENSION/Math.max(sourceWidth,sourceHeight)); const width=Math.max(1,Math.round(sourceWidth*scale)),height=Math.max(1,Math.round(sourceHeight*scale));
    canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('Bild-Canvas konnte nicht initialisiert werden.');
    context.drawImage(image,0,0,width,height);const data=context.getImageData(0,0,width,height);
    const value=decodeImageDataWithJsQr(data.data,width,height,{inversionAttempts:'attemptBoth'}); if(!value)throw new Error('Auf dem Bild wurde kein lesbarer QR-Code gefunden.'); return value;
  } finally { URL.revokeObjectURL(url); }
}

export function stopQrScanner(video) {
  if(scannerTimer) clearTimeout(scannerTimer); scannerTimer=0;
  if(scannerStream){ for(const track of scannerStream.getTracks()) track.stop(); scannerStream=null; }
  if(video){ video.pause?.(); video.srcObject=null; }
  detector=null;
}
