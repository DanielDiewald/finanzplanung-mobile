Capyt 2.1.1 - Tresor-Groesse + Donut-Standard

Dateien mit gleicher Ordnerstruktur in das bestehende GitHub-Pages-Projekt kopieren und ersetzen.

Aenderungen:
- Desktop-Tresor: max. 180 px, kompakter Bildbereich und besseres 2-Spalten-Layout.
- Mobile/Tablet-Tresor: max. 180 px.
- Geldverwendung/Donut ist auf Desktop und Mobile die Standardansicht.
- Bestehende 2.1.0-Installationen werden einmalig auf Donut als neuen Standard migriert.
  Danach bleibt eine manuell gewaehlte Ansicht wieder gespeichert.
- Version auf 2.1.1 angehoben, damit das vorhandene PWA-Update-Popup die neue Version erkennt.

Validierung: npm test = 48/48 bestanden; npm run check = OK.
