# Desktop-Integration fuer `Finanzplanung_v10.html`

## 1. Fertige Variante

Im Ordner `desktop-integration/` liegen:

```text
Finanzplanung_v10_mobile-sync.html
mobile-sync-addon.js
qrcode.min.js
```

Alle drei Dateien im selben Verzeichnis belassen und die HTML-Datei normal oeffnen.

Das Addon fuegt im bestehenden Bereich **Backup & Hilfe** einen Abschnitt fuer Mobile-Synchronisation hinzu.

## 2. Manuelle Integration in eine spaetere Desktop-Version

Am Ende der Desktop-Datei, **nach dem bestehenden Hauptscript**, aber vor `</body>` einbinden:

```html
<script src="./qrcode.min.js"></script>
<script src="./mobile-sync-addon.js"></script>
```

Das Addon erwartet die vorhandenen v10-Funktionen/Datenstrukturen. Wenn deren Namen in einer spaeteren Version geaendert werden, muss die Adapterstelle angepasst werden.

## 3. PLAN-CODE erzeugen

Das Addon:

1. verwendet den aktuell ausgewaehlten Monat;
2. ruft die bestehende Desktop-Monatsberechnung auf;
3. liest die vorhandenen Budget-IDs und Budgetdetails;
4. ruft die vorhandenen Builder fuer **Geplante Geldverwendung** und **Nur tatsaechliche Ausgaben** auf;
5. wandelt Geldwerte kontrolliert in Cent um;
6. erzeugt `FP1-P`;
7. zeigt Textcode und lokalen QR-Code.

Damit stammen die fachlichen PLAN-/Donut-Werte direkt aus der Desktop-Berechnung.

## 4. TRANSAKTIONS-CODE importieren

Beim Einfuegen eines `FP1-T` wird zuerst eine Vorschau erstellt.

Pro Transaktion wird geprueft:

- Plan-ID
- Monat
- Sperrstatus
- ID und `recordRevision`
- Betrag
- Buchungsart
- bei Budgetausgabe: vorhandene Budget-ID

Der alte `basePlanRevision` wird als Konflikthinweis angezeigt, aber ein veralteter Planstand vernichtet keine Ist-Buchung automatisch.

## 5. Zuordnung auf Desktop-Monatsdaten

### `budget_expense`

Wird auf `monthData.budgetUsage[budgetId]` angewendet und setzt die Budgetverbrauch-Bestaetigung. Die eigentliche Auswirkung auf Budgetvermoegen/Ueberziehung wird anschliessend wieder durch die bestehende Desktop-Berechnung ermittelt.

### `expense`

Wird als zusaetzliche Ausgabe in `monthData.expenses` eingefuegt.

### `income`

Wird als zusaetzliche Einnahme in `monthData.incomes` eingefuegt.

Importierte Eintraege tragen Metadaten wie Mobile-Transaktions-ID und -Revision, damit Korrekturen rueckgaengig gemacht werden koennen.

## 6. Duplikate/Korrekturen

Das Addon speichert unter `state.meta.mobileSync`:

- stabile `planId`
- aktuelle Sync-Revision
- importierte Mobile-IDs und ihre letzte `recordRevision`
- bestaetigte Export-IDs
- Zeitpunkt des letzten Imports

Gleiche oder aeltere Revisionen werden nicht erneut gebucht.

Bei einer hoeheren Revision wird die vorher importierte Wirkung entfernt und die neue Wirkung angewendet.

Bei `op=delete` wird die vorherige Wirkung entfernt und nur der Loeschzustand protokolliert.

## 7. Bestaetigung zurueck ans Smartphone

Der naechste `FP1-P` enthaelt `acknowledgedTransactions` mit `id + recordRevision` der auf dem Desktop verarbeiteten mobilen Buchungen.

Dadurch kann das Smartphone exakt erkennen, welche lokale Revision im Desktop-Stand enthalten ist.

## 8. Monatsabschluss

Ein gesperrter Desktop-Monat wird vom Import nicht still veraendert. Solche Buchungen werden in der Vorschau als Fehler markiert und muessen bewusst anders behandelt werden.

## 9. Was am Desktop bewusst nicht geaendert wird

- keine neue Finanzberechnung
- keine neue Budgetlogik
- keine neue Sparlogik
- keine zweite Statistiklogik
- keine Cloud-/Server-Abhaengigkeit

Das Addon ist nur ein Adapter zwischen bestehendem v10-State und FP1.
