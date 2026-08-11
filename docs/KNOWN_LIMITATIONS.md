# Bekannte Grenzen von Version 1

## 1. iOS/Safari Kamera-QR-Erkennung

Safari/iOS stellt die native Shape-Detection-/`BarcodeDetector`-API weiterhin nicht verlaesslich standardmaessig bereit. Version 1.1 verwendet deshalb automatisch einen Fallback aus `getUserMedia()` + Canvas + **jsQR 1.4.0**.

Beim empfohlenen GitHub-Pages-Deployment ueber `.github/workflows/pages.yml` wird jsQR fest in die veroeffentlichte App eingebunden und vom Service Worker gecacht. Der Live-Scan und der QR-Foto-Import funktionieren dadurch ohne `BarcodeDetector`. Der manuelle FP1-Textcode bleibt als letzter, browserunabhaengiger Fallback bestehen.

Wird die App dagegen direkt aus einem Git-Branch veroeffentlicht, enthaelt das Repository nur einen kleinen jsQR-Platzhalter; beim ersten Safari-Scan wird dann die fest gepinnte jsDelivr-Version nachgeladen und anschliessend im Vendor-Cache gespeichert. Fuer strikten Offline-Betrieb von Anfang an daher GitHub Actions verwenden oder `assets/vendor/jsQR.js` lokal durch jsQR 1.4.0 ersetzen.

## 2. Automatisierter Browser-E2E-Test

Die Build-Umgebung blockierte lokale Browsernavigation fuer den gestarteten Headless-Chromium-Prozess (`ERR_BLOCKED_BY_ADMINISTRATOR`). Daher wurden keine iOS-/Android- oder Chromium-End-to-End-Tests als automatisiert bestanden ausgegeben.

Die Domain-, Sync-, Desktop-Import- und PWA-Strukturtests laufen automatisiert; reale Browser-/Installationspruefungen bleiben Teil der manuellen Abnahmematrix in `TESTING.md`.

## 3. Sehr grosse QR-Codes

Das FP1-Textformat kann wesentlich mehr Transaktionen transportieren als ein einzelner QR-Code sinnvoll aufnehmen kann. Ist der Code zu gross, zeigt die App eine klare Meldung und behaelt den vollstaendigen Textcode zum Kopieren/Teilen.

## 4. Bereits bestaetigte mobile Buchungen

Bestaetigte Buchungen sind in Version 1 mobil schreibgeschuetzt. Korrekturen erfolgen bewusst ueber den Desktop bzw. vor der Bestaetigung per erhoehter `recordRevision`.
