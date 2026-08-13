import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const mainApp=fs.readFileSync(new URL('../js/app.js',import.meta.url),'utf8');
const settings=fs.readFileSync(new URL('../js/views/settings.js',import.meta.url),'utf8');
const capyApp=fs.readFileSync(new URL('../capy/js/app.js',import.meta.url),'utf8');

test('aktiver Capy-Launcher bleibt auch vor der ersten Character-Erstellung sichtbar',()=>{
  assert.match(mainApp,/setHidden\(capyLauncher,!capyEnabled\)/);
  assert.doesNotMatch(mainApp,/setHidden\(\$\('capyLauncher'\),!capyEnabled\|\|!capyInitialized\)/);
  assert.match(mainApp,/capyInitialized\?'Capy · Alpha öffnen':'Capy · Alpha einrichten'/);
});

test('neue Aktivierung öffnet über den sichtbaren Launcher den Character Creator',()=>{
  assert.match(capyApp,/if\(capy\.enabled&&!capy\.care\.initialized\)openCreator\(\)/);
  assert.match(settings,/capyEnabled\?'Capy auf diesem Gerät einrichten':'Am PC unter Grundlagen aktivieren'/);
});
