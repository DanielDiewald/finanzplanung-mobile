let scannerStream=null, scannerTimer=0, detector=null;

export function qrGeneratorAvailable() { return typeof globalThis.QRCode === 'function'; }
export function renderQr(target,text,{size=280}={}) {
  target.innerHTML=''; if(!qrGeneratorAvailable()) throw new Error('Lokale QR-Code-Bibliothek wurde nicht geladen.');
  try { new QRCode(target,{text,width:size,height:size,correctLevel:QRCode.CorrectLevel.L}); return true; }
  catch(err){ target.innerHTML=''; throw new Error(`QR-Code ist für diese Datenmenge zu groß: ${err.message||err}`); }
}
export function canNativeScan() { return 'BarcodeDetector' in globalThis && navigator.mediaDevices?.getUserMedia; }
export async function nativeQrSupported() {
  if(!canNativeScan()) return false; try { const formats=await BarcodeDetector.getSupportedFormats(); return formats.includes('qr_code'); } catch { return false; }
}

export async function startQrScanner({video,onResult,onStatus}) {
  if(!await nativeQrSupported()) throw new Error('Dieser Browser stellt keinen nativen QR-Scanner bereit. Bitte den Code einfügen.');
  stopQrScanner(video); onStatus?.('Kamerazugriff wird angefordert …');
  scannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:1280}},audio:false});
  video.srcObject=scannerStream; await video.play(); detector=new BarcodeDetector({formats:['qr_code']}); onStatus?.('QR-Code in den Rahmen halten.');
  const tick=async()=>{
    if(!scannerStream) return;
    try { const codes=await detector.detect(video); const value=codes.find(x=>x.rawValue)?.rawValue; if(value){ stopQrScanner(video); onResult(value); return; } }
    catch(err){ onStatus?.(`Scannerfehler: ${err.message}`); }
    scannerTimer=requestAnimationFrame(tick);
  }; scannerTimer=requestAnimationFrame(tick);
}
export function stopQrScanner(video) { if(scannerTimer) cancelAnimationFrame(scannerTimer); scannerTimer=0; if(scannerStream){ for(const track of scannerStream.getTracks()) track.stop(); scannerStream=null; } if(video){ video.pause?.(); video.srcObject=null; } detector=null; }
