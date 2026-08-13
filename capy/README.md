# Capyt · Capy · Alpha

> **Status: Alpha.** Die Capy-Funktionen befinden sich in Version **2.2.2a** in einer Testphase. Die Finanzplanung und die bestehende FP1-/QR-Synchronisation bleiben die Grundlage.

Der Capy-Begleiter ist weitgehend im Unterordner `capy/` gekapselt. Die Mobile-Ansicht ist als kleines Pet-Game ausgelegt; Desktop bleibt auf Finanz-, Vorrat- und Sync-Aufgaben fokussiert.

## Aktivierung, Pause und Migration

Capy wird in der Desktop-Planung unter **Grundlagen → Capy-Begleiter** aktiviert. Das verwaltete Variable-Budget verwendet weiterhin die feste ID `capy-vorrat`. Sein sichtbarer Name wird zentral als **`{CapyName}'s Vorrat`** gebildet. Bestehende 2.2.1a-Budgets mit derselben ID und dem alten sichtbaren Schema `{CapyName} Vorrat` werden beim Laden umbenannt; die Budget-ID sowie vorhandene Buchungs- und Sperrbezüge bleiben dadurch erhalten.

Deaktivieren bedeutet **Pause**, nicht Löschen: Name, Geschlecht, Coins, Inventar, Bedürfnisse, Fortschritt, Vorrat, Sperren und Pending-Buchungen bleiben bestehen. Während der Pause verfällt der Game-State nicht. Die Aktivierung/Pause wird weiter über FP1 synchronisiert.

## Mobile Game-UI

Die normale Spielansicht verwendet `100dvh`, Safe-Areas und keinen Body-Scroll. Sie besteht aus:

- kompaktem HUD mit Name, Coins, Hunger, Stimmung und Energie
- zentraler Raum-/Capy-Szene
- fester Game-Bottom-Bar für Shop, Inventar, Spielen, Vorrat und Mehr
- Bottom-Sheets für Shop, Inventar, Vorrat und weitere Aktionen

Der Capy wird direkt mit Pointer Events gestreichelt. Eine Session benötigt echte Bewegungsdistanz, berücksichtigt Cooldown und Session-Limit und zeigt Floating-Feedback ohne Layoutverschiebung.

Inventar-Items werden per Pointer-Drag auf den Capy gezogen. Dabei wird ein `position: fixed` Drag-Ghost verwendet; ein Drop außerhalb beziehungsweise `pointercancel` verbraucht kein Item. Der Shop kauft ausschließlich Items und enthält keine direkte Füttern-Aktion.

## Character Creator

Der Creator bietet nur `männlich` und `weiblich`. Die Auswahl bleibt bis zum Klick auf **Capy erstellen** temporär und kann davor beliebig oft gewechselt werden. Erst beim Erstellen werden Name und Geschlecht in den Capy-State übernommen.

## Konfiguration

- `settings/behavior.json`
  - erlaubte Geschlechter (`weiblich`, `männlich`)
  - Startwerte und Tagesphasen
  - Bedürfnis-Verfall / nächtliche Energie-Regeneration
  - `petting` mit Mindestdistanz, Cooldown, Happiness- und Session-Limit
  - `inventoryDrag` mit Hold-Delay, Bewegungsschwelle und Return-Animation
  - Spielen, Schlafen, Animationen und UI-Feedback
  - `roomBackground` / Raum-Hintergrund
- `settings/items.json`
  - Item-ID, Name, Typ (`food`, `toy`, `care`), Preis und Bildpfad
  - Stack-Regeln
  - Effekte auf Hunger, Happiness, Energie und Bindung
  - Interaktionsziel und Animation
- `settings/economy.json`
  - Coins pro Euro Vorrat-Aufladung
  - Mindestaufladung
  - Coin-Bildpfad und Fallback-Icon
  - Kategorie des Vorrat-Budgets
  - `stashLockMonths`: Sperrdauer jeder neuen Vorrat-Einzahlung in Kalendermonaten

## Assets

Der Coin-Pfad ist absichtlich auf `./assets/ui/coins.png` vorbereitet. Fehlt die Datei, zeigt die UI ein Fallback-Icon. Der Raum-Hintergrund darf leer bleiben und später durch eine hochformatige Raum-Textur ersetzt werden.

## Geldlogik

Eine Vorrat-Aufladung ist **keine Ausgabe**, sondern eine interne Umbuchung vom normalen Guthaben in das Capy-Vorratsbudget. Das Gesamtvermögen bleibt unverändert. Items kosten ausschließlich Coins; Streicheln, Spielen und Item-Nutzung erzeugen keine Finanzbuchungen.

Jede neue Einzahlung ist standardmäßig **einen Kalendermonat ab ihrem eigenen Einzahlungsdatum gesperrt**. Mehrere Einzahlungen können daher unterschiedliche Freigabedaten besitzen.

Eine Mobile-Aufladung wird sofort in **Buchungen** als Pending-Eintrag sichtbar. Bis der PC verarbeitet hat, gilt sie nicht als endgültig gebucht. FP1 liefert anschließend `confirmed` oder `rejected` zurück. Bei einer Ablehnung wird die zugehörige Coin-Gutschrift nicht als verfügbar gezählt und die Transaktion bleibt für einen späteren Sync erhalten.

## Sync

Die bestehende FP1-Kommunikation wird erweitert statt ersetzt:

- **PC → Mobile (`FP1-P`)**: Aktivierung, Budget-ID/-Name, Vorrat, Sperrstatus/Freigabedatum, Coins, bestätigte Coin-Operationen, Care-/Inventar-State und Transaktionsergebnisse.
- **Mobile → PC (`FP1-T`)**: Aktivierungsänderung, normale Buchungen, Vorrat-Aufladungen, deduplizierbare Coin-Operationen sowie Care-/Inventar-State.
- Capy-Finanztransaktionen verwenden stabile eindeutige IDs; wiederholte Scans dürfen weder Buchungen noch Coins oder Items duplizieren.
- Temporärer UI-State wie Pointer, Drag-Ghost, offene Bottom-Sheets oder Partikel wird nicht synchronisiert.

Die Pflege bleibt Mobile-first. Am PC zeigt Capy hauptsächlich Vorrat, Sperrstatus, Auszahlung, Coins, Sparbuch-/Sync-Informationen und den Aktivierungsstatus.
