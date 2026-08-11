# Capyt – Tests

## Automatisierte Tests

Ausfuehren:

```bash
npm test
npm run check
```

Aktuell abgedeckte Kernfaelle:

- FP1-P Encode -> Decode mit Legacy-DEFLATE (`Z`)
- FP1-P Compact (`C`) -> Decode inklusive Laengenvergleich gegen `Z`
- FP1-P Encode -> Decode ohne Komprimierung
- beschaedigter Code / CRC32
- falsche externe FP-Version
- falscher Code-Typ
- FP1-T Encode -> Decode
- doppelte Transaktions-ID / Deduplizierung
- Budget-ID bleibt bei Umbenennung massgeblich
- ungueltige/negative Betraege
- deutsche Geldtexte -> Cent
- Buchungsmonat/Datum
- Korrektur durch `recordRevision`
- Loesch-Tombstone
- alte Basis-Planrevision
- sehr viele Transaktionen werden im Textprotokoll verlustfrei kodiert/dekodiert
- mobile Budgetausgabe innerhalb Budgetbestand
- Budgetueberziehung
- sonstige Ausgabe
- Einnahme
- bestaetigte Buchung wird nicht doppelt als Overlay gerechnet
- unbekannte Budget-ID
- geloeschte Buchung veraendert Anzeige nicht
- Manifest- und Service-Worker-Pfade
- alle im Service Worker vorgecacheten lokalen Assets existieren
- Manifest-Icons existieren

## Browser-Smoke-Test

In der vorliegenden Build-Umgebung konnte Chromium zwar gestartet werden, lokale Navigation zu `http://127.0.0.1`/`file://` wurde jedoch durch eine Administrator-/Sandbox-Policy blockiert. Deshalb wurde kein automatisierter Headless-E2E-Lauf als bestanden behauptet.

## Manuelle Abnahmematrix

Vor produktiver Nutzung empfohlen:

### iOS Safari / installierte PWA

- erster PLAN-Import per Textcode
- Home-Screen-Installation
- App-Neustart
- Offline-Neustart
- Buchung speichern/bearbeiten/loeschen
- T-Code erzeugen
- QR anzeigen
- Live-Kamera-Scan ohne `BarcodeDetector` ueber jsQR
- QR-Foto-Import
- Kamera-Scan im installierten Homescreen-Modus
- Safe Areas bei Hochformat/Tastatur

### Android Chrome

- Install-Prompt/Home-Screen
- PLAN-QR-Scan
- Kamera-Berechtigung erst auf Aktion
- Offline-Neustart
- T-QR erzeugen
- Teilen/Kopieren

### Desktop

- PLAN-Code erzeugen
- T-Code Vorschau
- denselben Code zweimal importieren
- Revision 2 einer bestehenden ID importieren
- Tombstone importieren
- unbekannte Budget-ID
- gesperrter Monat
- alter `basePlanRevision`
- neuen PLAN-Code erzeugen und Mobile-Bestaetigung pruefen

## QR-Groesse

FP1-Textcodes koennen groesser werden als ein einzelner QR-Code praktisch aufnehmen kann. Das QR-Rendering faengt diesen Fehler ab und laesst den Textcode weiterhin kopieren/teilen. Fuer normalen Tages-Sync sollte regelmaessig exportiert werden, statt hunderte Buchungen in einen einzigen QR-Code zu packen.

## Finaler automatisierter Stand

Die finale Testsuite umfasst **31 Tests** inklusive zweier QR-Fallback-Service-Tests. Darin sind auch Desktop-Addon-Tests sowie zwei direkte Cross-Kompatibilitaetstests enthalten:

- Desktop erzeugt `FP1-P` -> Mobile decodiert identische Budget-/Donut-/Centwerte.
- Mobile erzeugt `FP1-T` -> Desktop decodiert Export-ID und Transaktionsdaten korrekt.
