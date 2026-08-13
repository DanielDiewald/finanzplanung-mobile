# FP1 Synchronisationsprotokoll

Status: Implementiert in `js/services/sync.js` und `desktop-integration/mobile-sync-addon.js`.

## 1. Ziele

FP1 transportiert Finanzplan-Monatsdaten und mobile Ist-Buchungen ohne Server.

- `FP1-P`: PLAN-CODE, Desktop -> Mobile
- `FP1-T`: TRANSAKTIONS-CODE, Mobile -> Desktop

FP1 ist **keine Verschluesselung**. Die Daten sind nur strukturiert, optional komprimiert, mit einer Pruefsumme versehen und URL-sicher kodiert.

## 2. Textformat

```text
FP1-<TYPE>-<ENCODING>-<CRC32>-<BASE64URL_PAYLOAD>
```

### TYPE

- `P` = PLAN
- `T` = TRANSACTION

### ENCODING

- `C` = **Compact**: fachliches FP1-Objekt wird in ein kurzes, positionsbasiertes Transport-Schema ueberfuehrt und danach mit DEFLATE komprimiert. Dies ist die bevorzugte Kodierung fuer QR-Codes.
- `Z` = Legacy-kompatibel: normales FP1-JSON wird direkt mit DEFLATE komprimiert.
- `N` = unkomprimierte UTF-8-JSON-Bytes.

Die Implementierung bevorzugt `C`, falls `CompressionStream('deflate')` verfuegbar ist. `Z` und `N` werden weiterhin gelesen, damit bereits erzeugte FP1-Codes kompatibel bleiben. Beim mitgelieferten Beispielplan sinkt der PLAN-Code von etwa 1.140 Zeichen (`Z`) auf etwa 770 Zeichen (`C`).

### CRC32

- 8 hexadezimale Zeichen, Gross-/Kleinschreibung beim Einlesen egal
- CRC32 wird ueber die **transportierten Bytes** berechnet, also bei `C` und `Z` ueber die komprimierten Bytes
- Polynom: Standard CRC-32/ISO-HDLC (`0xEDB88320` in reflektierter Darstellung)

### Base64URL

RFC-4648-artiges URL-safe Base64:

- `+` -> `-`
- `/` -> `_`
- Padding `=` wird entfernt

### Compact-Transport `C`

`C` veraendert **nicht** das fachliche FP1-Datenmodell. Vor der Komprimierung werden lediglich lange JSON-Feldnamen und wiederholte Objektstrukturen durch ein internes kompaktes Schema ersetzt. Listen wie Budgets, Sparziele, Donut-Segmente und Transaktionen werden positionsbasiert transportiert. Nach dem Dekomprimieren stellt der Decoder wieder das vollstaendige fachliche FP1-P- beziehungsweise FP1-T-Objekt her und fuehrt erst danach die normale Validierung aus.

Damit bleiben die dokumentierten Felder in den folgenden Tabellen die verbindliche API. Das Compact-Schema ist nur eine Transportoptimierung. Ein `C`-Decoder muss die `C`-Struktur expandieren; ein alter Decoder, der `C` nicht kennt, soll den Code als unbekannte Kodierung ablehnen statt ihn falsch zu interpretieren.

## 3. JSON-Grundregeln

- UTF-8
- Objekte werden beim Erzeugen kanonisch nach Schluesseln sortiert, damit identische Nutzdaten reproduzierbar serialisiert werden koennen.
- unbekannte JSON-Felder duerfen ignoriert werden und sollen, soweit praktisch, beim Normalisieren nicht absichtlich zerstoert werden.
- Geldbetraege sind **ganze Cent als sichere Integer**.
- Monatswert: `YYYY-MM`
- Datum: `YYYY-MM-DD`
- Zeitpunkte: ISO 8601, bevorzugt UTC mit `Z`
- IDs sind opake Strings. UUIDs werden empfohlen.

## 4. Gemeinsame Felder

| Feld | Typ | Pflicht | Bedeutung | Beispiel |
|---|---|---:|---|---|
| `protocolVersion` | Integer | ja | interne Protokollversion | `1` |
| `type` | String | ja | `P` oder `T` | `"P"` |

Eine externe Version `FP2` darf inkompatible Transport-/Payload-Aenderungen einfuehren. Ein FP1-Decoder lehnt andere Prefix-Versionen ab.

# FP1-P: PLAN-CODE

## 5. PLAN Top-Level

| Feld | Typ | Pflicht | Bedeutung | Beispiel |
|---|---|---:|---|---|
| `planId` | String | ja | dauerhaft stabile Plan-ID | `"6d..."` |
| `planName` | String | optional | Anzeigename | `"Finanzplanung"` |
| `revision` | Integer >= 0 | ja | Desktop-Sync-Revision | `16` |
| `month` | `YYYY-MM` | ja | uebertragener Monat | `"2026-08"` |
| `createdAt` | ISO-Zeitpunkt | ja | Erstellungszeitpunkt des Codes | `"2026-08-11T16:42:00.000Z"` |
| `source` | Objekt | optional | Quellen-/Versionsmetadaten | `{ "app":"Capyt · Planung" }` |
| `accountBalanceCents` | Integer/null | optional | physischer Ist-Kontostand, sofern bekannt | `450000` |
| `normalBalanceCents` | Integer | ja | effektives normales Guthaben | `220000` |
| `freeAvailableCents` | Integer | ja | vom Desktop berechnetes frei verfuegbares Guthaben | `170000` |
| `minimumCashBufferCents` | Integer >= 0 | ja | Mindestpuffer | `50000` |
| `budgetAssetsCents` | Integer | ja | Summe Budgetvermoegen | `100000` |
| `savingsAssetsCents` | Integer >= 0 | ja | Sparvermoegen | `120000` |
| `totalAssetsCents` | Integer | ja | Gesamtvermoegen | `440000` |
| `budgets` | Array | ja | mobile relevante Budgets | siehe unten |
| `savingsGoals` | Array | optional | relevante Zielanzeigen | siehe unten |
| `donuts.planned` | Objekt | ja | Desktop-Donut Geldverwendung | siehe unten |
| `donuts.actual` | Objekt | ja | Desktop-Donut tatsaechliche Ausgaben | siehe unten |
| `acknowledgedTransactions` | Array | optional | exakt vom Desktop verarbeitete Mobile-Revisionen | siehe unten |
| `acknowledgedTransactionIds` | Array<String> | optional | Legacy-/vereinfachte Bestaetigung | `[]` |
| `acknowledgedExportIds` | Array<String> | optional | vollstaendig verarbeitete T-Exports | `[]` |
| `lastSync` | Objekt/null | optional | Info zum letzten Desktop-Import | `null` |
| `capy` | Objekt/null | optional | Capy-Alpha-Status inkl. Aktivierung, Vorrat, Sperrstatus, Coins und Pflege | siehe 5.5 |

### 5.1 Budget

| Feld | Typ | Pflicht | Bedeutung | Beispiel |
|---|---|---:|---|---|
| `id` | String | ja | stabile Desktop-Budget-ID | `"budget-a1"` |
| `name` | String | ja | sichtbarer Name | `"Lebensmittel"` |
| `category` | String | ja | Desktop-Kategorie | `"Lebensmittel"` |
| `plannedCents` | Integer >= 0 | ja | Plan-/Zyklusbetrag | `35000` |
| `reserveCents` | Integer >= 0 | ja | im Monat reservierter Betrag | `35000` |
| `spentCents` | Integer >= 0 | ja | bisher verbraucht | `12840` |
| `availableCents` | Integer | ja | verbleibender Budgetbestand | `22160` |
| `color` | `#RRGGBB` | optional | Anzeigehilfe | `"#2457a7"` |

Ein Budget darf umbenannt werden, ohne mobile Buchungen falsch zuzuordnen, da immer `id` massgeblich ist.

### 5.2 Sparziel

V1 zeigt Sparziele nur lesend. Relevante Felder koennen sein:

| Feld | Typ | Pflicht | Bedeutung |
|---|---|---:|---|
| `id` | String | ja | stabile Ziel-ID |
| `name` | String | ja | Anzeigename |
| `targetCents` | Integer >= 0 | ja | Zielbetrag |
| `balanceCents` | Integer >= 0 | ja | aktueller Stand |
| `remainingCents` | Integer >= 0 | optional | Restbetrag |

### 5.3 Donut

```json
{
  "mode": "planned",
  "title": "Geplante Geldverwendung",
  "centerLabel": "Geplant",
  "centerSubtext": "...",
  "totalCents": 123456,
  "segments": []
}
```

Segment:

| Feld | Typ | Pflicht | Bedeutung |
|---|---|---:|---|
| `key` | String | ja | fachlicher Segment-Key |
| `label` | String | ja | Desktop-Anzeige |
| `amountCents` | Integer >= 0 | ja | Segmentbetrag |
| `group` | String | optional | `cost`, `reserve`, `saving`, `available` |
| `color` | `#RRGGBB` | optional | Desktop-nahe Farbe |
| `details` | Array | optional | Drilldown-Positionen |

Detail:

```json
{ "label": "Lebensmittel", "amountCents": 35000 }
```

Der PLAN-Code uebertraegt fuer `planned` und `actual` die vom Desktop berechneten Segmente. Die Mobile-App rekonstruiert diese Planwerte nicht aus langfristigen Stammdaten.

### 5.4 Bestaetigungen

Bevorzugt:

```json
{
  "acknowledgedTransactions": [
    { "id": "mobile-tx-uuid", "recordRevision": 2 }
  ]
}
```

Damit wird genau eine bestimmte Revision bestaetigt. Hat das Smartphone nach dem Export dieselbe ID bereits als Revision 3 geaendert, darf die Bestaetigung von Revision 2 die neue Revision nicht als erledigt markieren.

`acknowledgedExportIds` ist zusaetzlich moeglich, wenn ein kompletter Export ohne Fehler verarbeitet wurde.

Zusätzlich kann der Desktop einzelne fehlgeschlagene Mobile-Buchungen im PLAN-Code zurückmelden:

```json
{
  "transactionResults": [
    {
      "id": "capy_tx_...",
      "recordRevision": 1,
      "status": "rejected",
      "reason": "Monat ist gesperrt",
      "updatedAt": "2026-08-13T12:00:00.000Z"
    }
  ]
}
```

`rejected` markiert die Buchung auf Mobile als **Nicht übernommen**. Sie bleibt für einen späteren Sync erhalten; eine daran gebundene positive Coin-Operation darf währenddessen nicht als verfügbar gelten. Erfolgreich übernommene Buchungen werden weiterhin über `acknowledgedTransactions` beziehungsweise einen vollständig bestätigten Export auf `confirmed` gesetzt.

### 5.5 Capy Alpha (optional)

Das optionale `capy`-Objekt uebertraegt den Desktop-Stand an Mobile. Die Capy-Funktion befindet sich in Version 2.2.8b im Alpha-Status.

| Feld | Typ | Pflicht | Bedeutung |
|---|---|---:|---|
| `enabled` | Boolean | ja | Capy-Funktion aktiv/inaktiv; wird beim PLAN-Import auf Mobile uebernommen |
| `budgetId` | String | optional | ID des verwalteten Capy-Vorrat-Budgets |
| `budgetName` | String | optional | sichtbarer Budgetname, z. B. `Momo's Vorrat` |
| `stashBalanceCents` | Integer | ja | gesamter aktueller Vorrat |
| `withdrawableStashCents` | Integer >= 0 | ja | bereits freigegebener, auszahlbarer Anteil |
| `lockedStashCents` | Integer >= 0 | ja | noch gesperrter Anteil |
| `nextUnlockDate` | `YYYY-MM-DD`/leer | optional | naechstes Freigabedatum einer gesperrten Einzahlung |
| `stashLockMonths` | Integer >= 0 | ja | Sperrdauer neuer Einzahlungen in Kalendermonaten; Standard `1` |
| `coins` | Integer >= 0 | ja | Desktop-Coin-Stand |
| `acknowledgedCoinOpIds` | Array<String> | optional | bereits vom Desktop verarbeitete Coin-Operationen |
| `care` | Objekt/null | optional | synchronisierter Pflege-/Inventarzustand |

Die Sperre gilt **pro Einzahlung**. Bei `stashLockMonths = 1` wird beispielsweise eine Einzahlung vom `2026-08-13` am `2026-09-13` freigegeben. Eine Auszahlung wird als interne `budget_to_cash`-Umbuchung am Desktop erfasst und veraendert das Gesamtvermoegen nicht.

# FP1-T: TRANSAKTIONS-CODE

## 6. TRANSACTION Top-Level

| Feld | Typ | Pflicht | Bedeutung | Beispiel |
|---|---|---:|---|---|
| `planId` | String | ja | Ziel-Plan-ID | `"6d..."` |
| `basePlanRevision` | Integer >= 0 | ja | PLAN-Revision, auf der die Mobile-App arbeitet | `14` |
| `month` | `YYYY-MM` | ja | aktueller PLAN-Monat beim Export; Einzelbuchungen duerfen eigene Monate tragen | `"2026-08"` |
| `exportId` | String | ja | eindeutige Export-ID | UUID |
| `generatedAt` | ISO-Zeitpunkt | ja | Erzeugung des T-Codes | ISO |
| `deviceId` | String | ja | lokale stabile Geraete-ID | UUID |
| `deviceName` | String | optional | nutzerfreundlicher Name | `"iPhone"` |
| `transactions` | Array | ja | Buchungen/Korrekturen/Loeschungen | siehe unten |
| `capy` | Objekt/null | optional | Mobile Capy-Alpha-Aenderungen (Coins/Pflege/Aktivierungsbezug) | siehe 7.1 |

Ein alter `basePlanRevision` ist eine Warnung, kein automatischer Datenverlust. Der T-Code uebertraegt keine Planwerte. Der Desktop prueft stattdessen Plan-ID, Budget-ID, Monat, Sperrstatus und Buchungsrevisionen.

## 7. Mobile Transaktion

| Feld | Typ | Pflicht | Bedeutung |
|---|---|---:|---|
| `id` | String | ja | dauerhaft eindeutige Transaktions-ID |
| `recordRevision` | Integer >= 1 | ja | Revision derselben Transaktions-ID |
| `op` | String | ja | `upsert` oder `delete` |
| `createdAt` | ISO-Zeitpunkt | ja | erstmalige Erfassung |
| `updatedAt` | ISO-Zeitpunkt | ja | letzte Aenderung |
| `date` | `YYYY-MM-DD` | ja | Buchungsdatum |
| `month` | `YYYY-MM` | ja | muss zu `date` passen |
| `kind` | String | ja | `budget_expense`, `expense`, `income`, `capy_stash_deposit` |
| `amountCents` | Integer > 0 | ja | positiver Absolutbetrag |
| `budgetId` | String | bei Budgetausgabe | stabile Desktop-Budget-ID |
| `category` | String | ja | Kategorie zum Zeitpunkt der Erfassung |
| `description` | String | optional | Kurzbeschreibung |
| `note` | String | optional | Notiz |

Vorzeichen werden nicht im Betrag kodiert. Die Richtung folgt aus `kind`.

### 7.1 Capy Alpha im TRANSAKTIONS-CODE

Das optionale `capy`-Objekt enthaelt `enabled`, `budgetId`, deduplizierbare `coinOps` sowie optional `care`. `enabled` ist synchronisierbarer Capy-State; ein Wechsel auf `false` pausiert den Begleiter und löscht weder Game- noch Finanzdaten. Mobile Vorrat-Aufladungen werden als Transaktion mit `kind = "capy_stash_deposit"` uebertragen. Der Desktop versieht die uebernommene Einzahlung mit ihrem individuellen Freigabedatum gemaess `stashLockMonths`.

Coin-Operationen koennen ueber `relatedTransactionId` an eine Vorrat-Aufladung gebunden sein. Wird die zugehoerige Finanzbuchung beim Import abgelehnt, darf auch die dazugehoerige Coin-Gutschrift nicht angewendet werden.

## 8. Duplikatschutz und Korrekturen

Desktop speichert pro importierter Mobile-ID mindestens:

```text
transaction id -> hoechste verarbeitete recordRevision + Importreferenz
```

Regeln:

1. ID unbekannt -> neue Buchung anwenden.
2. gleiche ID, gleiche/kleinere Revision -> Duplikat/alt, nicht erneut buchen.
3. gleiche ID, hoehere Revision -> vorherige importierte Wirkung rueckgaengig machen, neue Revision anwenden.
4. `op=delete` mit hoeherer Revision -> vorherige Wirkung rueckgaengig machen und Transaktion als geloescht markieren.
5. erneutes Einlesen desselben T-Codes erzeugt keine Doppelbuchung.

Die Mobile-App loescht eine bereits fuer Export vorbereitete Buchung deshalb nicht einfach lokal, sondern erzeugt eine Tombstone-Revision.

## 9. Synchronisationsstatus auf Mobile

### `local`

Noch nie in einem T-Code vorbereitet oder nach einer Aenderung wieder offen.

### `prepared`

In mindestens einem T-Code enthalten. Das bedeutet **nicht**, dass der Desktop den Code gelesen hat.

### `confirmed`

Ein spaeterer PLAN-Code bestaetigt die aktuelle `id + recordRevision` oder einen fuer diese Revision bekannten Export.

## 10. Fehlerfaelle

Decoder lehnt unter anderem ab:

- unvollstaendiges Praefix
- nicht unterstuetztes `FP2`, `FP3`, ...
- unbekannten Code-Typ
- unbekannte Transportkodierung
- ungueltige CRC32
- ungueltiges Base64URL
- Dekomprimierungsfehler
- ungueltiges JSON
- ungueltige interne Protokollversion
- Typ-Mismatch Header/Payload
- ungueltige oder fehlende IDs
- unsichere/nicht-ganzzahlige Centwerte
- negative bzw. 0-Betraege bei Transaktionen
- Datum/Monat-Mismatch
- doppelte Transaktions-ID innerhalb eines T-Codes

Desktop-seitig koennen zusaetzlich einzelne Transaktionen abgewiesen werden, zum Beispiel bei:

- falscher Plan-ID
- gesperrtem Zielmonat
- unbekannter Budget-ID
- ungueltigem Zielmonat

Fehlerhafte Einzeltransaktionen duerfen einen korrekten, bereits bekannten Import nicht doppelt anwenden.

## 11. Datenschutz / Sicherheit

CRC32 ist nur eine Transport-Pruefsumme und keine kryptografische Authentisierung. Base64URL und DEFLATE sind keine Verschluesselung. Wer den Code sieht, kann Finanzdaten daraus lesen.

Bei spaeterem automatischem Server-Sync sollte ein neues Protokoll mit echter Authentisierung und Transportverschluesselung definiert werden, statt FP1 als Sicherheitsprotokoll umzudeuten.
