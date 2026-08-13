import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../capy/index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../capy/css/capy.css',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../capy/js/app.js',import.meta.url),'utf8');
const theme=fs.readFileSync(new URL('../js/theme.js',import.meta.url),'utf8');

test('Capy übernimmt die zentrale Capyt-Mobile-Themequelle',()=>{
  const themeScript=html.indexOf('<script src="../js/theme.js"></script>');
  const tokenCss=html.indexOf('<link rel="stylesheet" href="../css/capyt-tokens.css">');
  const capyCss=html.indexOf('<link rel="stylesheet" href="./css/capy.css">');
  assert.ok(themeScript>=0&&tokenCss>themeScript&&capyCss>tokenCss);
  assert.match(css,/--capy-bg:var\(--color-bg\)/);
  assert.match(css,/--capy-panel:var\(--color-surface\)/);
  assert.match(css,/:root\[data-theme="dark"\]/);
  assert.doesNotMatch(css,/:root\{[^}]*color-scheme:dark/);
  assert.match(theme,/event\.key === STORAGE_KEY/);
});

test('Capy hat einen runden Bodenschatten, der mit Bewegung und Streicheln skaliert',()=>{
  assert.match(html,/id="capyGroundShadow" class="capy-ground-shadow shadow--idle"/);
  assert.match(css,/\.capy-ground-shadow\{[^}]*border-radius:50%/);
  assert.match(css,/\.shadow--happy-bounce\{animation:capy-shadow-happy-bounce/);
  assert.match(css,/@keyframes capy-shadow-celebrate/);
  assert.match(app,/capyGroundShadow:\$\('capyGroundShadow'\)/);
  assert.match(app,/shadow--\$\{String\(motion\)\.replace/);
  assert.match(app,/--shadow-pet-scale-x/);
});
