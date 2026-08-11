# Architektur

## 1. Komponenten

### UI

- `index.html`: App-Shell, Views, Dialoge
- `css/app.css`: mobile-first Layout, Safe Areas, Dark Mode, Touch-Ziele
- `js/router.js`: Bottom-Navigation
- `js/views/month.js`: Monatsbild, Donuts, Budgetdetails
- `js/views/transactions.js`: Buchungsliste und Filter
- `js/views/sync-view.js`: Planimport und T-Code-Export
- `js/views/settings.js`: lokale Einstellungen/Backup

### Domain/Services

- `js/services/finance.js`: ausschliesslich Mobile-Overlay auf Desktop-Baseline
- `js/services/sync.js`: FP1 Transport/Validierung
- `js/services/storage.js`: IndexedDB
- `js/services/qr.js`: lokales QR-Rendering + native Kameraerkennung, falls vorhanden
- `js/utils.js`: Cent-/Datums-/Format-Helfer, IDs, Farben

### Offline

- `manifest.webmanifest`
- `sw.js`
- `offline.html`

## 2. Datenhaltung

IndexedDB trennt:

- `plans`: importierte Desktop-PLAN-Staende
- `transactions`: mobile Ist-Buchungen inklusive Status und Revision
- `syncHistory`: bekannte Im-/Exporte
- `meta`: Geraete-ID, Einstellungen, letzter aktiver Plan

LocalStorage ist fuer die Finanzdaten nicht erforderlich.

## 3. Autoritaetsgrenzen

### Desktop autoritativ

- Planungsstammdaten
- Budgets und deren IDs
- Sparziele
- Gehalt / Sonderzahlungen
- laufende Kosten
- Kredite
- langfristige Berechnung
- Monatsabschluss/Snapshot
- Plan-/Ist-Donuts nach zentraler Berechnung

### Mobile autoritativ bis bestaetigt

- lokal erfasste tatsaechliche Vorgaenge
- deren stabile ID
- deren `recordRevision`
- lokaler Bearbeitungs-/Exportstatus

Nach Desktop-Bestaetigung ist wieder der neu synchronisierte Desktop-Stand die Baseline.

## 4. Warum das Mobile-Overlay bewusst klein ist

Die App soll nicht versuchen, `calculateAll()` des Desktops zu duplizieren. Dadurch werden Drift und Rundungsabweichungen vermieden.

Das Overlay kennt nur Auswirkungen von drei Ereignisarten:

1. Budgetausgabe
2. sonstige tatsaechliche Ausgabe
3. zusaetzliche Einnahme

Die langfristige Budgetruecklagen-, Sparziel-, Kredit- und Gehaltslogik bleibt ausschliesslich auf dem Desktop.

## 5. Geldwerte

Alle mobilen Geldwerte sind Integer-Cent. Texteingaben werden kontrolliert in Cent geparst. `29,90` wird zu `2990`.

Dadurch werden unkontrollierte IEEE-754-Float-Rundungsfehler in persistenten Buchungen vermieden.

## 6. PWA Update

Der Service Worker verwendet einen versionsgebundenen Cache. Bei `activate` werden alte App-Caches entfernt. Navigationsanfragen fallen bei Netzfehler auf den App-Shell/Offline-Fallback zurueck.

Bei einer neuen App-Version sollte `CACHE_NAME` in `sw.js` erhoeht werden.
