import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../capy/js/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../capy/css/capy.css',import.meta.url),'utf8');
const html=fs.readFileSync(new URL('../capy/index.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const rootHtml=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('Shop Inventar Vorrat und Mehr besitzen einen Pull-down-Griff',()=>{
  for(const id of ['shopSheet','inventorySheet','stashSheet','moreSheet']){
    const start=html.indexOf(`id="${id}"`);
    assert.ok(start>=0,`${id} fehlt`);
    assert.ok(html.slice(start,start+260).includes('class="sheet-handle"'),`${id} hat keinen Handle`);
  }
});

test('Capy Bottom-Sheets folgen dem Pointer und schließen per Distanz oder Geschwindigkeit',()=>{
  assert.match(app,/function setupSheetGestures\(\)/);
  assert.match(app,/querySelector\('\.sheet-card'\)/);
  assert.match(app,/querySelector\('\.sheet-handle'\)/);
  assert.match(app,/setPointerCapture\?\.\(pointerId\)/);
  assert.match(app,/dragY=Math\.max\(0,event\.clientY-startY\)/);
  assert.match(app,/dragY>=threshold\|\|\(dragY>=42&&velocity>\.55\)/);
  assert.match(app,/pointercancel/);
});

test('Capy Sheet transformiert weich und der Griff hat ein großes Touch-Ziel',()=>{
  assert.match(css,/\.sheet-card\{--sheet-drag-y:0px;transform:translate3d\(0,var\(--sheet-drag-y\),0\)/);
  assert.match(css,/\.sheet-card\.is-dragging\{transition:none\}/);
  assert.match(css,/\.sheet-handle\{[^}]*width:88px;[^}]*height:24px;[^}]*touch-action:none/);
  assert.match(css,/\.sheet-handle::after\{[^}]*width:46px;[^}]*height:5px/);
});

test('Sheet-Gesten bleiben mit der zentralen App-/PWA-Version gekoppelt',()=>{
  const env=fs.readFileSync(new URL('../.env',import.meta.url),'utf8');
  const version=env.match(/^\s*APP_VERSION\s*=\s*([^\s#]+)/m)?.[1];
  assert.ok(version);
  assert.ok(sw.includes(`const VERSION='${version}';`));
  assert.ok(rootHtml.includes(`content="${version}"`));
  assert.ok(rootHtml.includes(`pwa-update.js?v=${version}-pwa1`));
});
