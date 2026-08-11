import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeImageDataWithJsQr, jsQrAvailable } from '../js/services/qr.js';

test('jsQR-Fallback gibt decodierten QR-Text zurück',()=>{
  const original=globalThis.jsQR;
  try {
    globalThis.jsQR=(data,width,height,options)=>{
      assert.ok(data instanceof Uint8ClampedArray);assert.equal(width,2);assert.equal(height,2);assert.equal(options.inversionAttempts,'dontInvert');
      return {data:'FP1-P-N-12345678-TEST'};
    };
    assert.equal(jsQrAvailable(),true);
    const value=decodeImageDataWithJsQr(new Uint8ClampedArray(16),2,2);
    assert.equal(value,'FP1-P-N-12345678-TEST');
  } finally {
    if(original===undefined) delete globalThis.jsQR; else globalThis.jsQR=original;
  }
});

test('jsQR-Fallback bleibt ohne Decoder fehlerfrei leer',()=>{
  const original=globalThis.jsQR;
  try {
    delete globalThis.jsQR;
    assert.equal(jsQrAvailable(),false);
    assert.equal(decodeImageDataWithJsQr(new Uint8ClampedArray(16),2,2),'');
  } finally {
    if(original!==undefined) globalThis.jsQR=original;
  }
});
