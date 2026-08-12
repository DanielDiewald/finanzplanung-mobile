Capyt 2.1.3 - Safari / iOS Home-Screen-PWA Update-Fix

Diese Dateien im Repository mit derselben Ordnerstruktur ersetzen:
- index.html
- sw.js
- version.json                  (NEU)
- package.json
- js/pwa-update.js
- js/utils.js

Was sich aendert:
- Update-Erkennung verlaesst sich nicht mehr nur auf registration.update().
- version.json wird mit einem einmaligen Cache-Buster und cache:no-store geladen.
- Der Service Worker wird versionsbezogen registriert, z. B. sw.js?v=2.1.3.
- version.json wird vom Service Worker niemals aus dem App-Cache geliefert.
- Check beim Start, pageshow, Fokus, Online-Wechsel und Rueckkehr in die App.

Wichtig fuer eine bereits festhaengende iOS-PWA:
Nach dem Deployment die Home-Screen-App EINMAL im App-Umschalter vollstaendig beenden
und neu oeffnen. Nicht loeschen und nicht neu zum Home-Screen hinzufuegen.
Ab 2.1.3 sollen weitere Releases ueber das Update-Popup funktionieren.
