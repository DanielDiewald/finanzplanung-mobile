import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const updater = fs.readFileSync(path.join(root, 'js/pwa-update.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('Service Worker wartet auf Zustimmung statt Updates still zu aktivieren', () => {
  assert.match(sw, /addEventListener\('install',event=>event\.waitUntil\(precacheCore\(\)\)\)/);
  assert.match(sw, /SKIP_WAITING/);
  assert.match(sw, /self\.skipWaiting\(\)/);
  assert.doesNotMatch(sw, /precacheCore\(\)\)\.then\(\(\)=>self\.skipWaiting/);
});

test('PWA-Updater erkennt wartende und neu installierte Versionen', () => {
  for (const required of ["updateViaCache: 'none'", 'updatefound', 'controllerchange', 'registration.update()', "postMessage({ type: 'SKIP_WAITING' })", 'updateAccepted = true', 'VERSION_PATTERN.test(version)']) {
    assert.ok(updater.includes(required), `Updater fehlt ${required}`);
  }
});

test('Update-Popup und manuelle Update-Pruefung sind in der mobilen UI vorhanden', () => {
  for (const required of ['id="updateDialog"', 'id="updateNowButton"', 'id="updateLaterButton"', 'id="checkForUpdates"']) {
    assert.ok(html.includes(required), `index.html fehlt ${required}`);
  }
  assert.match(html, /js\/pwa-update\.js\?v=2\.2\.6a(?:-[0-9A-Za-z.-]+)?/);
});

test('Capyt-Alpha-Versionen werden fuer die Online-Update-Pruefung akzeptiert', () => {
  const match = updater.match(/const VERSION_PATTERN = (\/[^\n]+\/);/);
  assert.ok(match, 'VERSION_PATTERN fehlt');
  const pattern = Function(`return ${match[1]}`)();
  for (const version of ['2.2.3a', '2.2.4a', '2.2.5a', '2.2.6a', '2.2.6', '2.2.6-alpha.1']) {
    assert.equal(pattern.test(version), true, `${version} muss akzeptiert werden`);
  }
  for (const version of ['', '2.2', 'v2.2.4a', '2.2.x']) {
    assert.equal(pattern.test(version), false, `${version} muss abgelehnt werden`);
  }
  assert.ok(updater.includes('VERSION_PATTERN.test(version)'), 'Versionsdatei muss mit dem Capyt-Pattern validiert werden');
});

test('Erstinstallation loest keinen unnoetigen Reload aus', () => {
  assert.match(updater, /if \(\(!hadControllerAtLoad && !updateAccepted\) \|\| reloading\) return;/);
});
