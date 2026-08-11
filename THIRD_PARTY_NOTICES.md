# Third-party notices

## qrcode.js / qrcodejs

This project includes a local minified copy of qrcode.js for offline QR-code generation.

Project: `davidshimjs/qrcodejs`
License: MIT

The library is used only for local rendering; no QR-code data is sent to an external service.


## jsQR

Safari/iOS QR-Erkennung verwendet jsQR 1.4.0 als lokal gebundenen Fallback, wenn `BarcodeDetector` nicht verfuegbar ist.

Project: `cozmo/jsQR`
Version: 1.4.0
License: Apache-2.0

Beim GitHub-Pages-Build wird die Datei aus dem offiziellen npm-Paket bezogen und ihre npm-SHA-512-Integritaet geprueft. Die QR-Daten bleiben lokal im Browser; es wird keine QR-Scan-API aufgerufen.
