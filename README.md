# Finanzplanung Mobile

Mobile, offline-faehige Begleit-PWA fuer `Finanzplanung_v10.html`.

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
- FP1 Plan-/Transaktionscodes mit CRC32 und Base64URL, optional DEFLATE
- lokales QR-Code-Rendering ohne Online-API
- Kamera-QR-Scan, wenn `BarcodeDetector` vom Browser bereitgestellt wird
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

Die App fordert Kamerazugriff nur beim aktiven QR-Scan an. Wenn der Browser keine native `BarcodeDetector`-QR-Erkennung anbietet, bleibt der Textcode-Import voll funktionsfaehig. Damit ist der Datenaustausch nicht von Kamera-Support abhaengig.

Bekannte Grenzen: `docs/KNOWN_LIMITATIONS.md`.

## Datenschutz

Die App enthaelt keine Analytics-, Tracking-, Werbe-, Cloud- oder Bank-API. Plan und Transaktionen werden lokal in IndexedDB gespeichert. Ein FP1-Code ist **kodiert/komprimiert, aber nicht verschluesselt**.
