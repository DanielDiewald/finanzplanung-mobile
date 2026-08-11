# Bekannte Grenzen von Version 1

## 1. iOS/Safari Kamera-QR-Erkennung

Die App implementiert direkten Kamera-Scan ueber die native Web-API `BarcodeDetector`, falls der Browser `qr_code` tatsaechlich meldet.

Safari/iOS stellt diese API derzeit nicht standardmaessig bereit. Deshalb ist dort der **manuelle FP1-Code-Import** der zuverlaessige Offline-Fallback. Der Desktop zeigt unter jedem QR immer denselben vollstaendigen Textcode, damit kein Datenweg von Kamera-Support abhaengt.

Damit ist der Datenaustausch auf iOS funktionsfaehig, aber der in der Aufgabenbeschreibung gewuenschte vollstaendig integrierte Kamera-QR-Scan mit lokal gebundeltem Decoder ist in dieser Version nicht enthalten.

Fuer eine spaetere Version kann `js/services/qr.js` um einen lokal mitgelieferten reinen JavaScript-/WASM-QR-Decoder erweitert werden, ohne FP1 oder die Datenmodelle zu aendern.

## 2. Automatisierter Browser-E2E-Test

Die Build-Umgebung blockierte lokale Browsernavigation fuer den gestarteten Headless-Chromium-Prozess (`ERR_BLOCKED_BY_ADMINISTRATOR`). Daher wurden keine iOS-/Android- oder Chromium-End-to-End-Tests als automatisiert bestanden ausgegeben.

Die Domain-, Sync-, Desktop-Import- und PWA-Strukturtests laufen automatisiert; reale Browser-/Installationspruefungen bleiben Teil der manuellen Abnahmematrix in `TESTING.md`.

## 3. Sehr grosse QR-Codes

Das FP1-Textformat kann wesentlich mehr Transaktionen transportieren als ein einzelner QR-Code sinnvoll aufnehmen kann. Ist der Code zu gross, zeigt die App eine klare Meldung und behaelt den vollstaendigen Textcode zum Kopieren/Teilen.

## 4. Bereits bestaetigte mobile Buchungen

Bestaetigte Buchungen sind in Version 1 mobil schreibgeschuetzt. Korrekturen erfolgen bewusst ueber den Desktop bzw. vor der Bestaetigung per erhoehter `recordRevision`.
