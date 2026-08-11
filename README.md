# Benedikt – dein Finanzplaner

Responsive, offline-faehige Finanzplanung fuer Smartphone und Desktop. Die bestehende Finanz- und FP1-Logik bleibt kompatibel; die Oberflaeche ist als **Benedikt – dein Finanzplaner** gebrandet.

## Grundprinzip

- **Desktop = Planung und zentrale Berechnung**
- **Mobile = aktuellen Monatsstand anzeigen und tatsaechliche Vorgaenge erfassen**
- Planwerte werden am Smartphone nicht veraendert.
- Geldbetraege werden in der mobilen App intern ausschliesslich als ganze Cent (`amountCents`) gespeichert.
- Der Desktop liefert die berechneten Monatswerte und die fachlichen Donut-Segmente per `FP1-P`.
- Die mobile App legt noch nicht bestaetigte Ist-Buchungen nur als lokales Overlay auf diesen Desktop-Stand.
- Mobile Buchungen gehen per `FP1-T` zurueck an den Desktop und werden anhand stabiler IDs/Revisionen dedupliziert.

## Enthalten

- Mobile-first Monatsansicht mit prominentem **Frei verfuegbar**
- Kontostand, Budgetvermoegen, Sparvermoegen, Gesamtvermoegen
- Donut **Geplant**, **Tatsaechlich** und mobile Zusatzansicht **Verfuegbar**
- Budgetkarten mit Verbrauch und Restbetrag
- Schnellerfassung von Budgetausgaben, sonstigen Ausgaben und zusaetzlichen Einnahmen
- Transaktionsliste mit Filtern und Synchronisationsstatus
- IndexedDB-Persistenz
- FP1 Plan-/Transaktionscodes mit CRC32 und Base64URL; `C` nutzt ein kompaktes Transport-Schema plus DEFLATE für deutlich kleinere QR-Codes
- lokales QR-Code-Rendering ohne Online-API
- Kamera-QR-Scan mit nativem `BarcodeDetector` oder Safari-kompatiblem `jsQR`-Fallback
- QR-Foto-Import als zusaetzlicher Safari/iOS-Fallback
- manueller Code-Import als universeller Fallback
- Service Worker / Offline Cache
- PWA Manifest und App-Icons
- Desktop-Integrations-Addon fuer `Finanzplanung_v10.html`
- Tests und FP1-Protokolldokumentation

## Projektstruktur

```text
finanzplanung-mobile/
  index.html
  manifest.webmanifest
  sw.js
  offline.html
  css/
    app.css
  js/
    app.js
    router.js
    utils.js
    services/
      finance.js
      qr.js
      storage.js
      sync.js
    views/
      month.js
      transactions.js
      sync-view.js
      settings.js
  assets/
    icons/
    vendor/qrcode.min.js
    vendor/jsQR.js
  desktop-integration/
    Finanzplanung_v10_mobile-sync.html
    mobile-sync-addon.js
    qrcode.min.js
  docs/
    ARCHITECTURE.md
    DESKTOP_ANALYSIS.md
    DESKTOP_INTEGRATION.md
    FP1_PROTOCOL.md
    INSTALLATION.md
    TESTING.md
    KNOWN_LIMITATIONS.md
  fixtures/
    sample-plan.json
    sample-plan-code.txt
  tests/
```

## Lokal unter Windows starten

Python ist die einfachste statische Testumgebung:

```powershell
cd C:\Pfad\zu\finanzplanung-mobile
py -m http.server 8080
```

Dann im Browser oeffnen:

```text
http://localhost:8080/
```

Fuer Service Worker, Installation und Kamera auf einem Smartphone sollte die App ueber **HTTPS** bereitgestellt werden. Ein Backend ist nicht erforderlich; es genuegt statisches Hosting.

## Tests

```bash
npm test
npm run check
```

Die Tests benoetigen keine npm-Abhaengigkeiten.

## Desktop-Integration

Eine bereits vorbereitete Desktop-Datei liegt unter:

```text
desktop-integration/Finanzplanung_v10_mobile-sync.html
```

Sie verwendet die danebenliegenden Dateien:

```text
desktop-integration/mobile-sync-addon.js
desktop-integration/qrcode.min.js
```

Details: `docs/DESKTOP_INTEGRATION.md`.

## Wichtiger Safari/iOS-Hinweis

Safari/iOS stellt `BarcodeDetector` weiterhin nicht verlaesslich standardmaessig bereit. Die App faellt deshalb automatisch auf einen `getUserMedia()`-Kamerastream plus den reinen JavaScript-Decoder **jsQR 1.4.0** zurueck. Alternativ kann ein QR-Foto ausgewaehlt oder der FP1-Textcode eingefuegt werden.

Bei der mitgelieferten GitHub-Pages-Action wird jsQR waehrend des Builds fest in `assets/vendor/jsQR.js` kopiert. Dadurch arbeitet der Scanner auf der veroeffentlichten PWA auch offline ohne externe QR-API. Bei direktem Branch-Hosting ohne Action bleibt ein gepinnter jsDelivr-Fallback fuer den ersten Decoder-Ladevorgang vorhanden.

Bekannte Grenzen: `docs/KNOWN_LIMITATIONS.md`.

## Datenschutz

Die App enthaelt keine Analytics-, Tracking-, Werbe-, Cloud- oder Bank-API. Plan und Transaktionen werden lokal in IndexedDB gespeichert. Ein FP1-Code ist **kodiert/komprimiert, aber nicht verschluesselt**.


## GitHub Pages mit Safari-QR-Scan

Fuer GitHub Pages **Settings -> Pages -> Source: GitHub Actions** auswaehlen. Die Datei `.github/workflows/pages.yml` testet die App, laedt die fest gepinnte jsQR-Version 1.4.0 aus dem offiziellen npm-Paket, prueft deren SHA-512-Integritaet und veroeffentlicht danach die vollstaendige PWA.
