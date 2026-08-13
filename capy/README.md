# Capyt · Capy · Alpha

> **Status: Alpha.** Die Capy-Funktionen befinden sich in Version **2.2.1a** noch in einer frühen Testphase. Verhalten, Sync und Geldlogik können vor einer stabilen Freigabe noch angepasst werden.

Der Capy-Begleiter ist bewusst vollständig im Unterordner `capy/` gekapselt.

## Aktivierung

Capy wird in der Desktop-Planung unter **Grundlagen → Capy-Begleiter** aktiviert. Erst dann wird das verwaltete Variable-Budget mit der festen ID `capy-vorrat` erzeugt. Sein sichtbarer Name ist automatisch **`{Name des Capybaras} Vorrat`**. Bis das Capy am Smartphone benannt wurde, heißt es **Capy Vorrat**.

Nach der Aktivierung einen neuen FP1-P-Plan zum Smartphone übertragen. Dort erscheint unten links in Capyt das Capy-Logo.

## Konfiguration

- `settings/behavior.json`
  - erlaubte Geschlechter (`weiblich`, `männlich`)
  - Startwerte der Bedürfnisse
  - Tagesphasen und Uhrzeiten
  - Bedürfnis-Verfall / nächtliche Energie-Regeneration
  - Streicheln / Spielen
  - Schlaf-Sperren
  - Zustands-Schwellen
  - Animationszeiten
  - Raum-Hintergrund
- `settings/items.json`
  - Food-ID, Name, Preis in Coins
  - Bildpfad
  - Wirkung auf Sättigung, Glück, Energie und Bindung
  - Aktiv/Inaktiv
- `settings/economy.json`
  - Coins pro Euro Vorrat-Aufladung
  - Mindestaufladung
  - Coin-Bildpfad
  - Kategorie des Vorrat-Budgets
  - `stashLockMonths`: Sperrdauer jeder neuen Vorrat-Einzahlung in Kalendermonaten (Standard: `1`)

## Platzhalter für Bilder

Der Coin-Pfad ist absichtlich auf `./assets/ui/coins.png` gesetzt. Diese Datei ist **nicht enthalten**; du kannst dein Coin-Bild später genau dort ablegen oder den Pfad in `settings/economy.json` ändern. Bis dahin zeigt die UI ein Symbol als Fallback.

`behavior.json` enthält aktuell für `room.backgroundImage` einen leeren String. Die Mobile-Szene ist bereits im Hochformat ausgelegt. Später kann dort z. B. `./assets/room/room.png` eingetragen werden.

## Geldlogik

Eine Vorrat-Aufladung ist **keine Ausgabe**, sondern eine interne Umbuchung vom normalen Guthaben in das Variable-Budget des Capys. Das Gesamtvermögen ändert sich dadurch nicht. Für die Aufladung werden Coins gutgeschrieben. Foods kosten ausschließlich Coins und erzeugen keine zusätzliche Finanzbuchung.

Jede neue Einzahlung in den Capy-Vorrat ist standardmäßig **einen Kalendermonat ab ihrem Einzahlungsdatum gesperrt**. Erst ab ihrem individuellen Freigabedatum kann dieser Anteil am PC wieder auf das normale Guthaben ausgezahlt werden. Mehrere Einzahlungen können deshalb gleichzeitig unterschiedliche Freigabedaten haben. Die Sperrdauer wird über `settings/economy.json` mit `stashLockMonths` gesteuert.

## Sync

Die bestehende FP1-Kommunikation wird erweitert statt ersetzt:

- **PC → Mobile (`FP1-P`)**: Aktivierung, Budget-ID/-Name, Vorrat-Stand, davon gesperrter/auszahlbarer Betrag, nächstes Freigabedatum, Sperrdauer, Coin-Stand, bestätigte Coin-Operationen und Pflegestand.
- **Mobile → PC (`FP1-T`)**: normale Buchungen, Vorrat-Aufladungen, Coin-Operationen und Pflegestand.
- Coin-Operationen besitzen IDs und werden am Desktop dedupliziert, damit ein erneut gescannter Code Coins nicht doppelt verändert.

Die Pflege ist Mobile-only. Am PC zeigt der Capy-Menüpunkt Vorrat, Sperrstatus, Auszahlung, Coins und Sparbuch-Verlauf.
