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
  for (const required of ["updateViaCache: 'none'", 'updatefound', 'controllerchange', 'registration.update()', "postMessage({ type: 'SKIP_WAITING' })", 'updateAccepted = true']) {
    assert.ok(updater.includes(required), `Updater fehlt ${required}`);
  }
});

test('Update-Popup und manuelle Update-Pruefung sind in der mobilen UI vorhanden', () => {
  for (const required of ['id="updateDialog"', 'id="updateNowButton"', 'id="updateLaterButton"', 'id="checkForUpdates"', 'js/pwa-update.js?v=2.1.0']) {
    assert.ok(html.includes(required), `index.html fehlt ${required}`);
  }
});


test('Erstinstallation loest keinen unnoetigen Reload aus', () => {
  assert.match(updater, /if \(\(!hadControllerAtLoad && !updateAccepted\) \|\| reloading\) return;/);
});
