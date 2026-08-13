# Capyt

**Capyt** verbindet die professionelle Desktop-Finanzplanung (**Capyt · Planung**) mit einer mobilen, offline-faehigen Begleit-PWA (**Capyt · Mobile**).

## Version 2.2.7a · Capy · Alpha

**2.2.7a:** Der bisherige Spielen-Button öffnet jetzt einen registry-basierten Minigame-Hub. Games laufen als isolierte lokale Projekte über **Capyt Game API 1**; Capy-Daten, Game-Storage, Scores und Coin-Rewards werden über eine capability-geprüfte Message-Bridge vermittelt. Coin-Rewards sind zentral limitiert und dedupliziert und erzeugen keine Finanzbuchungen.

Neu unter `capy/games/` sind `games.json`, Game Hub/Loader/Bridge/Reward/Storage/SDK, ein kopierbares `_template`, das kleine Referenzspiel `carrot-catch`, ein deaktiviertes `bridge-demo` sowie die Entwickleranleitung in Markdown und PDF. Der Service Worker cached das Game-Framework und zieht die Offline-Dateien aktivierter Games aus der Registry. Die vorhandene Finanzplanung, FP1-/QR-Synchronisation, Capy-Care-Logik, Vorrat/Sperren, PWA-Updatefunktion und bestehenden Bottom-Sheet-Gesten bleiben erhalten.

Der optionale **Capy-Begleiter** bleibt im **Alpha-Status**. Der persistente Capy-State wurde rückwärtskompatibel um einen namespaceten `games`-Bereich erweitert; laufende Minigame-Sessions werden nicht über FP1 synchronisiert. Details stehen in `capy/README.md` und `capy/games/docs/NEW_GAME_GUIDE.md`.

## Grundprinzip

- **Desktop = Planung und zentrale Berechnung**
- **Mobile = aktuellen Monatsstand anzeigen und tatsaechliche Vorgaenge erfassen**
- Planwerte werden am Smartphone nicht veraendert.
- Geldbetraege werden in der mobilen App intern als ganze Cent (`amountCents`) gespeichert.
- Der Desktop liefert berechnete Monatswerte und Donut-Segmente per `FP1-P`.
- Die mobile App legt noch nicht bestaetigte Ist-Buchungen nur als lokales Overlay auf diesen Desktop-Stand.
- Mobile Buchungen gehen per `FP1-T` zurueck an den Desktop und werden anhand stabiler IDs/Revisionen dedupliziert.

## Designsystem und Farben

Mobile und Desktop verwenden dasselbe Capyt-Designsystem. **Alle UI-, Marken-, Status- und Diagrammfarben werden zentral in `css/capyt-tokens.css` gepflegt.** Fuer Farb-Anpassungen muss deshalb nicht in `app.css`, `desktop.css` oder den Views gesucht werden.

Die beiden Layout-Dateien bleiben bewusst getrennt und uebersichtlich:

```text
css/
  capyt-tokens.css   # zentrale Farben, Abstaende, Radien, Schatten, Typografie
  app.css            # Mobile-Layout und Mobile-Komponenten
  desktop.css        # Desktop-Shell, Dashboard, Tabellen und Desktop-Komponenten
```

Capyt unterstuetzt **Hell**, **Dunkel** und **System**. Die Auswahl wird unter `capyt-theme` separat von den Finanzdaten gespeichert und bereits vor dem ersten sichtbaren Rendern angewendet.

## Enthalten

- Mobile Monatsansicht mit **Frei verfuegbar**, Vermoegenskennzahlen, visuellem Tresor-Pufferstatus, Donut, Budgets und letzten Buchungen
- Desktop-Dashboard mit KPIs, Planungs-Workspace, Tabellen, Statistik und Backups
- Kontostand, Budgetvermoegen, Sparvermoegen und Gesamtvermoegen
- Donut **Geplant**, **Tatsaechlich** und mobile Zusatzansicht **Verfuegbar**
- Schnellerfassung von Budgetausgaben, sonstigen Ausgaben und zusaetzlichen Einnahmen
- Transaktionsliste mit Filtern und Synchronisationsstatus
- IndexedDB-Persistenz auf Mobile und bestehende Desktop-Lokalspeicherung
- FP1 Plan-/Transaktionscodes mit CRC32 und Base64URL; `C` nutzt ein kompaktes Transport-Schema plus DEFLATE
- lokales QR-Code-Rendering ohne Online-API
- Kamera-QR-Scan mit nativem `BarcodeDetector` oder Safari-kompatiblem `jsQR`-Fallback
- QR-Foto-Import und manueller Code-Import
- Service Worker / Offline Cache mit **Update-Hinweis und In-App-Aktualisierung** statt Neuinstallation der PWA
- PWA Manifest und Capyt-App-Icons
- Tests und FP1-Protokolldokumentation

## Projektstruktur

```text
finanzplanung-mobile/
  index.html
  manifest.webmanifest
  sw.js
  offline.html
  css/
    capyt-tokens.css
    app.css
    desktop.css
  js/
    theme.js
    app.js
    router.js
    utils.js
    services/
      buffer-status.js
    views/
  assets/
    branding/
    vault/
    vendor/
  desktop-integration/
    Finanzplanung_v10_mobile-sync.html
    mobile-sync-addon.js
    qrcode.min.js
  capy/
    games/
      games.json
      css/
      js/
      projects/
      docs/
  docs/
  fixtures/
  tests/
```

## Lokal starten

```bash
python3 -m http.server 8080
```

Danach Mobile unter `http://localhost:8080/` und Desktop unter `http://localhost:8080/desktop-integration/Finanzplanung_v10_mobile-sync.html` oeffnen.

Fuer Service Worker, Installation und Kamera auf einem Smartphone sollte die App ueber **HTTPS** bereitgestellt werden.

## Tests

```bash
npm test
npm run check
```

Die Tests benoetigen keine npm-Abhaengigkeiten.

## Safari / iOS

Wenn `BarcodeDetector` nicht verfuegbar ist, verwendet Capyt einen `getUserMedia()`-Kamerastream plus **jsQR 1.4.0**. Alternativ kann ein QR-Foto ausgewaehlt oder der FP1-Textcode eingefuegt werden. Der lokale Decoder wird fuer Offline-Nutzung mit ausgeliefert; der bestehende gepinnte Fallback bleibt fuer kompatible Deployments erhalten.

## Datenschutz

Capyt enthaelt keine Analytics-, Tracking-, Werbe-, Cloud- oder Bank-API. Mobile Plan- und Transaktionsdaten werden lokal in IndexedDB gespeichert. Ein FP1-Code ist **kodiert/komprimiert, aber nicht verschluesselt**.
