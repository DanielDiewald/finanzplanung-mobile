# Capyt 2.2.5a – Capy Alpha Update

Version **2.2.5a** baut auf dem vollstaendigen 2.2.4a-PWA-/Capy-Launcher-Hotfix auf. Funktional bleiben die zuletzt gelieferten Capy- und PWA-Fixes erhalten; dieser Stand hebt die App-Version und den Service-Worker-Cache sauber auf 2.2.5a an.

Die enthaltenen Mobile-Capy-Interaktionen aus 2.2.4a bleiben erhalten:

- Streichel-Feedback zeigt nur noch ein Herz ohne Zahl; echte Rubbel-Richtungswechsel koennen ueber die Vibration API einen kurzen Haptikimpuls ausloesen.
- Unter 10 % Energie schlaeft Capy automatisch und regeneriert Energie; ab 25 % wacht er automatisch wieder auf. Der Zustand bleibt Teil des Capy-/FP1-State.
- Die Food-Drag-and-Drop-Erklaerung erscheint pro Geraet nur einmal, zentriert im Screen. Danach bleibt der normale Food-Bottom-Slot ohne wiederholte Tutorial-Meldung erhalten.
- Finanzlogik, FP1/QR, Vorrat, Sperrfristen, Deduplizierung, PWA-Struktur und bestehende Capy-Daten bleiben erhalten.

Siehe `TEST_RESULTS.txt` fuer den aktuellen Teststatus.

---

# Capyt 2.0 – Abschlussbericht

## 1. Neues Capyt-Design

Mobile und Desktop verwenden jetzt eine gemeinsame Fintech-Markenidentitaet mit dem gelieferten Capyt-Icon, violett-blauen Akzenten, stark gerundeten Karten, kompakten Statusdarstellungen und einer gemeinsamen Diagramm-Palette. Mobile bleibt auf Monatskontrolle und schnelle Buchungen optimiert; Desktop wurde als dichtere Dashboard-/Planungsoberflaeche mit fester bzw. adaptiver Navigation, Topbar, KPIs, Tabellen und Analysebereichen umgesetzt.

Die zentrale Stelle fuer Farben und Design-Tokens ist:

- `css/capyt-tokens.css`

`css/app.css` und `css/desktop.css` enthalten keine eigenen Hex-/RGB-Farbwerte. Dadurch lassen sich Marken-, Oberflaechen-, Status- und Diagrammfarben zentral aendern.

## 2. Geaenderte Dateien

### Neu
- `css/capyt-tokens.css`
- `css/desktop.css`
- `js/theme.js`
- `assets/branding/capyt-logo-master.png`
- `assets/branding/capyt-32.png`
- `assets/branding/capyt-48.png`
- `assets/branding/capyt-180.png`
- `assets/branding/capyt-192.png`
- `assets/branding/capyt-512.png`

### Ueberarbeitet
- `index.html`
- `css/app.css`
- `js/app.js`
- `js/utils.js`
- `js/services/sync.js`
- `js/views/month.js`
- `js/views/settings.js`
- `js/views/sync-view.js`
- `manifest.webmanifest`
- `offline.html`
- `sw.js`
- `desktop-integration/Finanzplanung_v10_mobile-sync.html`
- `desktop-integration/mobile-sync-addon.js`
- `README.md`
- `package.json`
- `docs/ARCHITECTURE.md`
- `docs/DESKTOP_ANALYSIS.md`
- `docs/DESKTOP_INTEGRATION.md`
- `docs/FP1_PROTOCOL.md`
- `docs/INSTALLATION.md`
- `docs/KNOWN_LIMITATIONS.md`
- `docs/TESTING.md`
- `TEST_RESULTS.txt`
- `DELIVERY.md`

## 3. Branding-Assets

Als einzige Markenquelle wurde das bereitgestellte 1024x1024-PNG verwendet. Daraus wurden technisch notwendige, seitenverhaeltnistreue und transparente Groessenvarianten fuer Header, Favicon, Apple Touch Icon und PWA-Installation erzeugt. Das Icon bleibt auf Mobile und Desktop dauerhaft oben links sichtbar.

Ein `maskable`-Manifest-Icon wurde bewusst nicht deklariert: Das bereitgestellte Motiv nutzt einen grossen Teil der quadratischen Flaeche und es wurde kein offizieller Marken-Hintergrund bzw. keine maskable Variante geliefert. Eine kuenstlich veraenderte Schutzzone oder ein neuer Hintergrund waere eine eigenstaendige Markenveraenderung gewesen.

## 4. UX-Verbesserungen

### Mobile
- kompakter Capyt-Header mit dauerhaftem Logo und Sync-Status
- klarer 3-Schritt-First-Run-Prozess
- Hero-Karte fuer „Frei verfuegbar“
- Vermoegenskennzahlen, gemeinsame Donut-Farben, Budgetkarten und letzte Buchungen
- direkte Hauptaktion „Buchung erfassen“
- konsistente SVG-Funktionsicons statt uneinheitlicher Unicode-Symbole
- bessere Sync-, Fehler-, Empty- und Statusdarstellungen
- Safe-Area-, Touch- und Bildschirmtastatur-taugliche Abstaende

### Desktop
- Application Shell mit dauerhaftem Capyt-Logo, Sidebar/Navigation und kompakter Topbar
- Dashboard-KPIs auf Basis vorhandener Berechnungsergebnisse
- detaillierte Monatsuebersichtstabelle bleibt erhalten
- Monatsansicht als zweispaltiger Planungs-Workspace auf grossen Displays
- dichtere Tabellen mit Sticky Header/erster Spalte und lokalen Scrollcontainern
- Statistik-/Diagrammfarben aus dem gemeinsamen Token-System
- Theme-Auswahl direkt in der Topbar
- FP1-Synchronisationsbereich sichtbar zu Capyt umbenannt, Protokollbezeichner bleiben kompatibel

## 5. Responsive-Verbesserungen

Gepruefte Breiten fuer Mobile und Desktop: 320, 360, 390, 430, 768, 1024, 1280 und 1440 px.

Bei allen geprueften Breiten betrug der globale horizontale Overflow 0 px. Tabellen und KPI-Reihen scrollen bei Bedarf nur innerhalb ihres lokalen Containers. Die Mobile-Bottom-Navigation wird ab groesseren Breiten auf den App-Container begrenzt (bei 1024 px und groesser 720 px breit). Die Desktop-Sidebar wird bei mittleren Breiten kompakt und unter 900 px zu einer horizontalen App-Navigation.

## 6. Light, Dark und System

- gemeinsames `js/theme.js` fuer Mobile und Desktop
- Modi: `system`, `light`, `dark`
- Speicherung unter separatem LocalStorage-Key `capyt-theme`
- Theme-Bootstrap synchron im `<head>` vor den Styles, um einen Theme-Blitz zu vermeiden
- `prefers-color-scheme` fuer Systemmodus
- `color-scheme` und `theme-color` werden passend gesetzt
- Diagramme werden bei Theme-Wechsel neu gezeichnet
- Finanzdaten, Storage Keys und FP1-Daten werden vom Theme nicht veraendert

Gepruefte Token-Aufloesung: System-Dark und Dark verwenden `#05060B`, Light verwendet `#F4F5FA` als Hintergrundtoken.

## 7. Tests

- `npm test`: **32/32 Tests erfolgreich**
- `npm run check`: **erfolgreich** – 31 Precache-Assets, 2 Manifest-Icons, Safari-QR-Fallback vorhanden
- zusaetzliche Syntaxpruefung aller geaenderten JavaScript-Dateien: **erfolgreich**
- Desktop-UI im Browser mit eingebetteten lokalen Assets: **keine Page-JavaScript-Fehler**
- Responsive-DOM-Test Mobile/Desktop 320–1440 px: **kein globaler horizontaler Overflow**

## 8. Bekannte Einschraenkungen

- Kein `maskable`-Icon ohne offiziell geeignete Asset-Variante (siehe oben).
- Safari/iOS kann weiterhin den bestehenden jsQR-Fallback benoetigen, wenn `BarcodeDetector` fehlt.
- FP1 bleibt absichtlich `FP1`; bestehende IDs, Revisionen, Storage Keys und Protokollfelder wurden fuer Rueckwaertskompatibilitaet nicht umbenannt.


## 2.2.4a PWA-Hotfix

- Update-Pruefung akzeptiert Capyt-Alpha-Versionen wie `2.2.4a`.
- `pwa-update.js` wird einmalig mit `2.2.4a-pwa1` cache-gebustet.
- Das aktive Web-App-Manifest verwendet relative Icon-Pfade fuer GitHub Pages.
- GitHub-Pages-Deployment ist wieder freigegeben: `npm test` und `npm run check` sind gruen.
- Bereits festhaengende Handy-PWA nach Deployment einmal vollstaendig schliessen und neu oeffnen.

## 2.2.4a Capy-Launcher-Hotfix

- Der mobile Capy-Launcher unten wird jetzt bei jedem aktiven Capy angezeigt, auch wenn der Character Creator auf diesem Gerät noch nicht abgeschlossen wurde.
- Bei einer frischen Aktivierung öffnet der sichtbare Launcher die Capy-App und dort automatisch den Character Creator.
- Die Mobile-Einstellung zeigt in diesem Zustand `Capy auf diesem Gerät einrichten` statt irreführend erneut auf die PC-Aktivierung zu verweisen.
- Der Service-Worker verwendet fuer diesen Hotfix einen neuen internen Cache-Build, damit installierte PWAs die geaenderten App-Dateien sicher neu precachen.


## 2.2.5a Versionsupdate

- Vollstaendiger 2.2.4a-PWA-/Capy-Launcher-Hotfix als Basis beibehalten.
- Sichtbare App-Version, `package.json`, `version.json`, `APP_VERSION` und Service-Worker-Version auf `2.2.5a` gesetzt.
- Neuer Service-Worker-Cache durch Versionswechsel; `pwa-update.js` wird mit `2.2.5a-pwa1` geladen.
- PWA-Regressionstest auf den neuen Versions-/Cache-Buster aktualisiert.
- `npm test`: 88/88 erfolgreich.
- `npm run check`: erfolgreich.
