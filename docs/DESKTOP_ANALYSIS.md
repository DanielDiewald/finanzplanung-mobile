# Analyse der Desktop-Anwendung `Finanzplanung_v10.html`

Diese Datei dokumentiert die fuer die mobile Begleit-App relevanten Strukturen der vorhandenen Desktop-Anwendung. Die Desktop-Anwendung bleibt fachliche Referenz und Berechnungsinstanz.

## 1. Datenmodell

Der persistierte Desktop-State besitzt unter anderem:

- `meta`: Planungsstart, Horizont, Statistikende, Waehrung, Startmodus
- `settings`: Grundgehalt, Urlaubsgeld, Weihnachtsgeld, Startguthaben, Mindestpuffer
- `salaryRaises`
- `specialPayRaises`
- `recurringCosts`
- `loans`
- `recurringSavings`
- `savingsGoals`
- `variableBudgets`
- `months`

Die Objekte besitzen bereits stabile IDs. Diese IDs werden im FP1-Protokoll verwendet; sichtbare Namen dienen niemals als primaerer Schluessel.

## 2. Monatsdaten

Jeder Monat kann enthalten:

- `incomes`: zusaetzliche Einnahmen
- `expenses`: zusaetzliche Ausgaben ausserhalb von Budgets
- `budgetUsage`: tatsaechlicher Verbrauch pro Budget-ID
- `budgetTransactions`: Ein-/Auszahlungen und Budget-zu-Budget-Umbuchungen
- `goalExtraContributions`
- `goalActualSpending`
- `actualBankBalance`
- `locked` + `snapshot`

Ein gesperrter Monat ist ein Snapshot. Die mobile Integration importiert keine Buchung still in einen bereits gesperrten Monat.

## 3. Kategorien

### Zusaetzliche Einnahmen

- Bonus
- Praemie / Prämie
- Provision
- Rueckerstattung / Rückerstattung
- Nebenverdienst
- Geldgeschenk
- Sonstiges

Bonus, Praemie und Provision werden in der Statistik gesondert gruppiert, erhoehen aber wie alle manuellen Einnahmen die tatsaechlichen Einnahmen.

### Zusaetzliche Ausgaben

Desktop-Datalist:

- Unerwartet
- Freizeit
- Einkauf
- Reparatur
- Sonstiges

### Budgetkategorien

Desktop-Datalist:

- Freizeit
- Gewand
- Haushalt
- Lebensmittel
- Mobilitaet / Mobilität
- Gesundheit
- Sonstiges

Die Mobile-App zeigt den vom Desktop uebertragenen Budgetnamen und die Budgetkategorie. Neue Planbudgets werden mobil nicht angelegt.

## 4. Trennung der Geldarten

Die Desktop-Berechnung trennt bewusst:

1. **Normales Guthaben**
2. **Budgetvermoegen**
3. **Sparvermoegen**
4. **Tatsaechliche Ausgaben**
5. **Interne Vermoegensverschiebungen**

Budgetruecklagen verschieben Geld vom normalen Guthaben in Budgetvermoegen. Regelmaessiges Sparen und Sparziel-Einzahlungen verschieben Geld in Sparvermoegen. Diese Bewegungen sind keine tatsaechlichen Ausgaben.

Budgetverbrauch dagegen ist eine tatsaechliche Ausgabe. Soweit Budgetvermoegen vorhanden ist, sinkt der Budgettopf. Eine Ueberziehung wird sofort aus dem normalen Guthaben gedeckt.

## 5. Relevante Monatsberechnung

Die Kernfunktion `calculateAll()` erzeugt pro Monat unter anderem:

- `salary`
- `specialPay`
- `totalManualIncome`
- `totalIncome`
- `fixedCosts`
- `quarterlyCosts`
- `annualCosts`
- `loanRates`
- `variableCosts`
- `directCashExpenses`
- `budgetReserve`
- `budgetSpent`
- `budgetOverspendCash`
- `budgetClosingTotal`
- `budgetDetails`
- `regularSavings`
- `regularSavingBalanceTotal`
- `goalSavings`
- `goalSpendingTotal`
- `actualExpenses`
- `savingsTransfers`
- `reservationTransfers`
- `endingBalance`
- `effectiveEndingBalance`
- `freeAvailable`
- `savingsAssetsTotal`
- `totalAssets`

### Budgetdetail

Pro Budget werden insbesondere berechnet:

- vorheriger Bestand
- Ruecklage des Monats
- manuelle Cash-Einzahlung/-Auszahlung
- interne Transfers
- vor Verbrauch verfuegbarer Betrag
- tatsaechlicher Verbrauch
- aus Budget gedeckter Teil
- Ueberziehung aus normalem Guthaben
- Schlussbestand

Der mobile Plan-Code uebertraegt fuer das aktuelle Monatsbild die fuer die Alltagssicht relevanten, **bereits berechneten** Werte.

## 6. Frei verfuegbar

Desktop-seitig gilt sinngemaess:

```text
frei verfuegbar = effektives normales Guthaben - Mindestpuffer
```

Budget- und Sparvermoegen werden bewusst nicht als frei verfuegbares normales Guthaben behandelt.

## 7. Donut-Logik

Die Desktop-Monatsansicht besitzt zwei Modi.

### Geplante Geldverwendung

Die Desktop-Funktion gruppiert folgende Segmente:

| Key | Anzeige | Bedeutung |
|---|---|---|
| `fixed` | Laufende Kosten | monatliche fixe Kosten |
| `periodic` | Quartals-/Jahreskosten | periodische reale Kosten |
| `loans` | Kredite / Raten | Kreditraten |
| `extra` | Zusaetzliche Ausgaben | direkte manuelle Ausgaben |
| `overspend` | Budgetueberziehung | Budgetverbrauch, der nicht durch Budgetvermoegen gedeckt ist |
| `goalShortfall` | Sparprojekt-Mehrkosten | Mehrkosten beim tatsaechlichen Abschluss eines Sparziels |
| `reserves` | Budgetruecklagen | Reservierungstransfers und Cash-Einzahlungen in Budgets |
| `savings` | Regelmaessiges Sparen | interne Verschiebung in Sparvermoegen |
| `goals` | Sparprojekte | Sparziel-Einzahlungen |

### Nur tatsaechliche Ausgaben

| Key | Anzeige |
|---|---|
| `fixed` | Laufende Kosten |
| `periodic` | Quartals-/Jahreskosten |
| `loans` | Kredite / Raten |
| `extra` | Zusaetzliche Ausgaben |
| `budgetSpent` | Budgetverbrauch |
| `goalSpent` | Tatsaechliche Sparziel-Ausgaben |

### Desktop-Farben

```text
fixed       #2457a7
periodic    #6079b8
loans       #a34a3a
extra       #b76a4d
overspend   #a22b2b
reserves    #8a5a00
savings     #397a50
goals       #5f8b68
budgetSpent #b7791f
goalSpent   #6750a4
```

Die Mobile-App erfindet fuer diese beiden Modi keine eigene Planrechnung. Das Desktop-Addon ruft die bestehenden Desktop-Donut-Builder auf und uebertraegt deren Resultat im `FP1-P`.

## 8. Mobile Overlay-Regeln

Nach einem PLAN-Sync gilt der Desktop-Stand als Baseline.

### Neue mobile Budgetausgabe

- `budget.spentCents` steigt um den vollen Betrag.
- `budget.availableCents` sinkt maximal bis 0.
- `budgetAssetsCents` sinkt um den aus dem Budget gedeckten Teil.
- nur eine Ueberziehung reduziert zusaetzlich `normalBalanceCents` und `freeAvailableCents`.
- `totalAssetsCents` sinkt um den vollen Betrag.
- im Ist-Donut steigt `budgetSpent` um den vollen Betrag.
- im Plan-Donut wird nur eine neu entstandene Ueberziehung als `overspend` ergaenzt; der gedeckte Budgetverbrauch wird nicht doppelt belastet.

### Neue sonstige Ausgabe

- normales Guthaben, frei verfuegbar und Gesamtvermoegen sinken.
- `extra` wird in Plan- und Ist-Donut ergaenzt.

### Neue Einnahme

- normales Guthaben, frei verfuegbar und Gesamtvermoegen steigen.
- die bestehenden Desktop-Donuts fuer Geldverwendung/Ausgaben werden dadurch nicht kuenstlich veraendert.

### Bestaetigte mobile Buchung

Sobald der Desktop dieselbe `id + recordRevision` per neuem PLAN-Code bestaetigt, wird die Buchung mobil nicht mehr als Overlay gerechnet. Der neu importierte Desktop-Stand enthaelt sie bereits.

## 9. Mobile Zusatzdonut `Verfuegbar`

Dieser Donut ist bewusst eine mobile Zusatzansicht. Seine Segmente werden nicht als neue Desktop-Finanzlogik interpretiert, sondern direkt aus den aktuell verbleibenden positiven `availableCents` der uebertragenen Budgets gebildet.
