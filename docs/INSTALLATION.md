# Installation und Start

## 1. Voraussetzungen

Die App ist statisch. Es werden kein Backend, kein Benutzerkonto und keine Datenbank auf einem Server benoetigt.

Fuer eine installierbare PWA und Kameraberechtigungen sollte die App ueber HTTPS ausgeliefert werden. `localhost` gilt auf dem jeweiligen Rechner als sicherer Entwicklungsursprung.

## 2. Windows - lokaler Test

Im Projektordner:

```powershell
py -m http.server 8080
```

Danach:

```text
http://localhost:8080/
```

Das ist geeignet fuer Funktionspruefung auf demselben PC. Fuer ein Smartphone ist ein HTTPS-Ursprung empfehlenswert.

## 3. iPhone / iOS

1. Den HTTPS-Link zur statisch bereitgestellten App in **Safari** oeffnen.
2. Einmal vollstaendig laden lassen, damit der Service Worker die App-Dateien cachen kann.
3. Safari-Teilen-Menue oeffnen.
4. **Zum Home-Bildschirm** waehlen.
5. Namen bestaetigen.
6. App ueber das neue Homescreen-Icon starten.
7. PLAN-Code vom PC uebernehmen.

Die App nutzt `viewport-fit=cover` und Safe-Area Insets fuer Homescreen-/Notch-Layouts.

### QR-Import auf iOS

Kamerazugriff wird nur beim Tippen auf QR-Scan angefordert. Fehlt Safaris native `BarcodeDetector`-API, verwendet die App automatisch den Safari-kompatiblen `jsQR`-Fallback auf dem Kamerastream. Zusaetzlich stehen **QR-Foto auswaehlen** und **Code eingeben** zur Verfuegung.

## 4. Android / Chrome

1. HTTPS-Link in Chrome oeffnen.
2. Browser-Menue -> **App installieren** bzw. **Zum Startbildschirm hinzufuegen**.
3. Installation bestaetigen.
4. App ueber das Icon starten.
5. PLAN-Code scannen oder einfuegen.

Unterstuetzt der Browser die native Barcode Detection API, wird sie verwendet. Andernfalls kann die App denselben PLAN-QR ueber den JavaScript-Fallback lesen.

## 5. Offline-Verhalten

Nach erfolgreichem ersten Laden ueber den Service Worker funktionieren ohne Internet:

- Monatsansicht
- Donuts
- Budgets
- Erfassung von Ausgaben/Einnahmen
- Transaktionsliste
- lokaler T-Code-Export
- QR-Erzeugung
- Kamera-QR-Scan mit lokal gebundeltem jsQR-Decoder (bei GitHub-Actions-Deployment)
- QR-Foto-Import
- manueller PLAN-Code-Import
- IndexedDB

Kamera-Scanning benoetigt keinen Server, aber der Browser kann die Kamera-API an einen sicheren Ursprung/HTTPS binden.

## 6. Daten bleiben pro Origin getrennt

IndexedDB ist an den Ursprung gebunden. Ein Wechsel von beispielsweise

```text
https://example-a.test/app/
```

zu

```text
https://example-b.test/app/
```

ist fuer den Browser eine andere Installation mit anderer lokaler Datenbank.

Vor einem Hostingwechsel daher offene Transaktionen zum Desktop synchronisieren oder das lokale JSON-Backup aus den Einstellungen verwenden.


## 7. GitHub Pages

Empfohlen ist die mitgelieferte GitHub-Action:

1. Projekt in ein GitHub-Repository pushen.
2. Unter **Settings -> Pages** als Quelle **GitHub Actions** waehlen.
3. Auf `main` pushen oder den Workflow **Deploy GitHub Pages** manuell starten.
4. Die Action bindet jsQR 1.4.0 lokal in das Pages-Artefakt ein und fuehrt vor dem Deployment die Tests aus.

Damit benoetigt Safari zur Laufzeit weder `BarcodeDetector` noch einen externen QR-Dienst.
