import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyElapsedDecay, chooseVisual, isCapySleeping, updateAutoSleepState } from '../capy/js/engine.js';
import { buildCapySyncPayload, normalizeCapyState } from '../capy/js/shared-state.js';

const html=fs.readFileSync(new URL('../capy/index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../capy/css/capy.css',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../capy/js/app.js',import.meta.url),'utf8');
const behavior=JSON.parse(fs.readFileSync(new URL('../capy/settings/behavior.json',import.meta.url),'utf8'));

function care(energy,autoSleeping=false){return {hunger:60,happiness:70,energy,bond:20,autoSleeping,lastUpdate:Date.now()};}

test('2.2.4a Streichelfeedback zeigt nur ein Herz ohne Zahl und nutzt Vibrationsfeedback',()=>{
  assert.match(app,/showFloating\('❤️'/);
  assert.doesNotMatch(app,/showFloating\(`\+\$\{reward\} ❤️`/);
  assert.match(app,/function triggerPetHaptic\(\)/);
  assert.match(app,/navigator\.vibrate\(ms\)/);
  assert.equal(behavior.petting.hapticMs,12);
});

test('Auto-Schlaf startet erst unter 10 Prozent und wacht ab 25 Prozent auf',()=>{
  const atTen=care(10);assert.equal(updateAutoSleepState(atTen,behavior),false);
  const low=care(9.9);assert.equal(updateAutoSleepState(low,behavior),true);assert.equal(low.autoSleeping,true);
  low.energy=24.9;assert.equal(updateAutoSleepState(low,behavior),true);
  low.energy=25;assert.equal(updateAutoSleepState(low,behavior),false);assert.equal(low.autoSleeping,false);
});

test('Auto-Schlaf regeneriert Energie und erzwingt Sleeping-Visual sowie Interaktionsblock',()=>{
  const c=care(9,true);c.lastUpdate=Date.now()-60*60*1000;
  applyElapsedDecay(c,behavior,Date.now());
  assert.ok(c.energy>9,'Schlaf muss Energie regenerieren');
  const low=care(8,true),phase={key:'day',label:'Tag'};
  assert.equal(isCapySleeping(low,behavior,phase),true);
  assert.equal(chooseVisual(low,phase,behavior),'sleeping');
  assert.match(app,/function petBlocked\(\)\{return isCapySleeping/);
  assert.match(app,/function itemUseAllowed\(item\)\{const sleeping=isCapySleeping/);
});

test('Drag-and-Drop-Erklärung erscheint nur einmal und zentriert im Screen',()=>{
  assert.match(html,/id="feedDragTutorial" class="feed-drag-tutorial hidden"/);
  assert.match(html,/Zieh das ausgewählte Essen unten mit dem Finger auf dein Capy\./);
  assert.match(css,/\.feed-drag-tutorial\{position:fixed;[^}]*left:50%;top:50%;transform:translate\(-50%,-50%\)/);
  assert.match(app,/FEED_DRAG_TUTORIAL_KEY='capyt\.capy\.feedDragTutorialSeen\.v1'/);
  assert.match(app,/localStorage\.getItem\(FEED_DRAG_TUTORIAL_KEY\)==='1'/);
  assert.match(app,/localStorage\.setItem\(FEED_DRAG_TUTORIAL_KEY,'1'\)/);
  assert.match(app,/function selectFeedItem\(item\)[\s\S]*showFeedDragTutorialOnce\(\)/);
  assert.doesNotMatch(html,/AUSWÄHLEN ODER ZIEHEN/);
  assert.doesNotMatch(html,/Alternativ kannst du Items direkt auf Capy ziehen/);
  assert.doesNotMatch(app,/hungry:\{label:'Hungrig',hint:`Wähle Food/);
});


test('Auto-Schlafzustand bleibt im Capy-State und FP1-Care-Payload erhalten',()=>{
  const state=normalizeCapyState({enabled:true,care:{initialized:true,name:'Momo',gender:'weiblich',energy:8,autoSleeping:true}});
  assert.equal(state.care.autoSleeping,true);
  const payload=buildCapySyncPayload(state);
  assert.equal(payload.care.autoSleeping,true);
});
