import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createPetSession, movePetSession, petAffectionRewardForSession, petHeartBurstForSession, consumePetHeartProgress, consumePetAffectionProgress } from '../capy/js/interactions.js';
import { applyPet } from '../capy/js/engine.js';

const behavior=JSON.parse(fs.readFileSync(new URL('../capy/settings/behavior.json',import.meta.url),'utf8'));
const app=fs.readFileSync(new URL('../capy/js/app.js',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../capy/css/capy.css',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

function rub(session,points){for(const [x,y] of points)movePetSession(session,x,y,{inside:true,movementThreshold:behavior.petting.movementThreshold});}

test('längeres Rubbeln steigert die kurze Herzmenge ohne Zahlen',()=>{
  const start=1000,s=createPetSession(1,0,0,{rubMode:true,now:start});
  rub(s,[[60,0],[0,0]]);
  const early=petHeartBurstForSession(s,behavior.petting,start+200);
  assert.equal(early,1);
  consumePetHeartProgress(s,behavior.petting,start+200);
  rub(s,[[170,0],[0,0],[170,0],[0,0]]);
  const late=petHeartBurstForSession(s,behavior.petting,start+1700);
  assert.ok(late>=3,'bei längerem Rubbeln müssen mehrere Herzen erscheinen');
  assert.match(app,/heart\.textContent='❤️'/);
  assert.doesNotMatch(app,/showFloating\(`\+\$\{[^}]+\} ❤️`/);
  assert.match(css,/\.pet-heart\{/);
});

test('Zuneigung steigt erst nach ausreichend langem echten Rubbeln',()=>{
  const start=5000,s=createPetSession(2,0,0,{rubMode:true,now:start});
  rub(s,[[80,0],[0,0],[80,0]]);
  assert.deepEqual(petAffectionRewardForSession(s,behavior.petting,20,70,start+500),{bond:0,happiness:0});
  rub(s,[[0,0],[100,0],[0,0],[100,0],[0,0]]);
  const reward=petAffectionRewardForSession(s,behavior.petting,20,70,start+1600);
  assert.equal(reward.bond,1);
  assert.equal(reward.happiness,2);
  consumePetAffectionProgress(s,behavior.petting,start+1600);
  const care={happiness:70,bond:20};applyPet(care,behavior,reward.happiness,reward.bond);
  assert.equal(care.bond,21);
  assert.equal(care.happiness,72);
});

test('Haptik wird bei gültiger Rubbelbewegung versucht und hat stärkeren Zuneigungsimpuls',()=>{
  assert.match(app,/if\(inside&&petSession\.lastDelta\)\{updatePetReaction\(petSession\.lastDelta\);triggerPetHaptic\('rub'\);\}/);
  assert.match(app,/triggerPetHaptic\('affection'\)/);
  assert.match(app,/navigatorRef\.vibrate\(pattern\)/);
  assert.deepEqual(behavior.petting.hapticRewardPattern,[24,32,34]);
  assert.equal(behavior.petting.hapticCooldownMs,90);
});

test('Service Worker bindet den aktuellen PWA-Cache an die zentrale App-Version',()=>{
  const env=fs.readFileSync(new URL('../.env',import.meta.url),'utf8');
  const version=env.match(/^\s*APP_VERSION\s*=\s*([^\s#]+)/m)?.[1];
  assert.ok(version);
  assert.ok(sw.includes(`const VERSION='${version}';`));
  assert.match(sw,/const CACHE=`capyt-v\$\{VERSION\}-\$\{BUILD\}`;/);
});
