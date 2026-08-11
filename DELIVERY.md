# Lieferumfang

## Mobile PWA

- [x] Mobile-first UI ab 320 px
- [x] Bottom Navigation: Monat / Buchungen / Sync / Einstellungen
- [x] iOS Safe Areas und PWA Meta-Tags
- [x] Dark Mode
- [x] Offline App-Shell + Service Worker
- [x] Manifest + Icons
- [x] IndexedDB fuer Plan, Transaktionen, Sync-Historie, Einstellungen
- [x] prominentes `Frei verfuegbar`
- [x] Kontostand / Budgetvermoegen / Sparvermoegen / Gesamtvermoegen
- [x] Desktop-Donut `Geplant`
- [x] Desktop-Donut `Tatsaechlich`
- [x] Mobile-Donut `Verfuegbar`
- [x] Donut-Details inklusive mobiler Budgetbuchungen
- [x] Budgetkarten
- [x] Budgetausgabe erfassen
- [x] sonstige Ausgabe erfassen
- [x] zusaetzliche Einnahme erfassen
- [x] Bearbeiten/Loeschen vor Bestaetigung
- [x] lokale/prepared/confirmed Sync-Zustaende
- [x] Transaktionsliste und Filter

## FP1

- [x] `FP1-P` Desktop -> Mobile
- [x] `FP1-T` Mobile -> Desktop
- [x] versionierter Prefix
- [x] UTF-8 JSON
- [x] kanonische Serialisierung
- [x] kompaktes `C`-Transportformat + DEFLATE wenn verfuegbar; `Z`/`N` bleiben rueckwaertskompatibel
- [x] CRC32
- [x] Base64URL
- [x] Textcode
- [x] lokale QR-Erzeugung
- [x] manuelles Einfuegen
- [x] native Kameraerkennung, wenn Browser sie anbietet
- [x] Safari/iOS Kamera-Fallback ueber getUserMedia + jsQR
- [x] QR-Foto-Import als weiterer Fallback
- [x] GitHub-Pages-Build bindet jsQR lokal/offline ein
- [x] stabile Transaktions-ID
- [x] `recordRevision`
- [x] Duplikatschutz
- [x] Korrektur und Tombstone-Loeschung
- [x] Plan-ID
- [x] Sync-Revision
- [x] Bestaetigung im naechsten PLAN-Code
- [x] alte offene Buchungen bleiben auch nach Monatswechsel exportierbar

## Desktop

- [x] fertige `Finanzplanung_v10_mobile-sync.html`
- [x] bestehende v10-Berechnung bleibt unveraendert
- [x] bestehende Budget-IDs werden uebernommen
- [x] bestehende Donut-Builder werden fuer PLAN-Code verwendet
- [x] T-Code Vorschau
- [x] Import Budgetverbrauch
- [x] Import sonstige Ausgabe
- [x] Import Einnahme
- [x] Duplikat-/Revisionslogik
- [x] gesperrte Monate werden abgewiesen
- [x] unbekannte Budgets werden abgewiesen

## Dokumentation

- [x] Desktop-Analyse
- [x] FP1-Spezifikation
- [x] Architektur
- [x] iPhone-Installation
- [x] Android-Installation
- [x] Windows-Start
- [x] Desktop-Integrationsanleitung
- [x] Testdokumentation
- [x] bekannte Grenzen

## Tests

- [x] 32 automatisierte Tests gruen
- [x] statische PWA-/Manifest-/Service-Worker-Pruefung gruen
- [x] JavaScript-Syntaxpruefung gruen
- [x] Cross-Kompatibilitaet Desktop `FP1-P` -> Mobile
- [x] Cross-Kompatibilitaet Mobile `FP1-T` -> Desktop

Siehe `docs/KNOWN_LIMITATIONS.md` fuer Browser-/Deployment-Hinweise und den in dieser Umgebung nicht ausfuehrbaren Browser-E2E-Test.
