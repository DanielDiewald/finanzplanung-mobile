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
- Der Service Worker wird versionsbezogen registriert, z. B. sw.js v=2.1.5.
- version.json wird vom Service Worker niemals aus dem App-Cache geliefert.
- Check beim Start, pageshow, Fokus, Online-Wechsel und Rueckkehr in die App.

Wichtig fuer eine bereits festhaengende iOS-PWA:
Nach dem Deployment die Home-Screen-App EINMAL im App-Umschalter vollstaendig beenden
und neu oeffnen. Nicht loeschen und nicht neu zum Home-Screen hinzufuegen.
Ab 2.1.3 sollen weitere Releases ueber das Update-Popup funktionieren.


Capyt 2.2.4a PWA-Hotfix (2026-08-13)
---------------------------------------
Ursache der fehlgeschlagenen Update-Pruefung:
Die Versionsvalidierung akzeptierte 2.2.4, aber nicht das von Capyt verwendete
Alpha-Schema 2.2.4a. Dadurch wurde version.json als ungueltig verworfen und
die iOS-/PWA-spezifische versionsbezogene Service-Worker-Registrierung nicht
verwendet.

Fix:
- Versionsparser akzeptiert jetzt Capyt-Versionen wie 2.2.3a / 2.2.4a.
- Der Fallback ruft registration.update() weiterhin explizit auf.
- pwa-update.js bekommt fuer diesen Hotfix einen einmaligen URL-Revisionstoken
  (2.2.4a-pwa1), damit bereits installierte PWAs die korrigierte Datei nicht
  aus einem alten HTTP-/Web-App-Cache wiederverwenden.

Nach Deployment bei einer bereits festhaengenden Handy-PWA:
App einmal vollstaendig aus dem App-Umschalter schliessen und neu oeffnen.
Danach sollte die manuelle Update-Pruefung wieder die Online-Version lesen.
