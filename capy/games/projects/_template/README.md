# Capyt Minigame Template

Diese Vorlage wird **nicht** automatisch im Game-Hub angezeigt. Kopiere den Ordner, benenne ihn nach einer stabilen Game-ID um und registriere das neue Game in `../../games.json`.

## Wichtige Regeln

- Keine direkten Importe aus `capy/js/` oder der Finanz-App.
- Kein direkter Zugriff auf Capy-State, FP1, Finanzdaten oder Coins.
- Keine Verwendung von `localStorage` fuer persistente Game-Daten.
- Persistente Daten nur ueber `CapytGame.storage` bzw. `getGameData`/`setGameData`.
- Score und Abschluss ueber `submitScore()` bzw. `finish()` an den Host senden.
- Coin-Belohnungen werden ausschliesslich vom Host anhand von `games.json` berechnet.

Siehe `../../docs/NEW_GAME_GUIDE.md` fuer die vollstaendige API- und PWA-Dokumentation.
