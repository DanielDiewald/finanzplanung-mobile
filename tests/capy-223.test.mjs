import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createPetSession, movePetSession, petRewardForSession, consumePetRewardProgress, pointInExpandedRect } from '../capy/js/interactions.js';

const html=fs.readFileSync(new URL('../capy/index.html',import.meta.url),'utf8');
const css=fs.readFileSync(new URL('../capy/css/capy.css',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../capy/js/app.js',import.meta.url),'utf8');
const txView=fs.readFileSync(new URL('../js/views/transactions.js',import.meta.url),'utf8');
const monthView=fs.readFileSync(new URL('../js/views/month.js',import.meta.url),'utf8');
const appCss=fs.readFileSync(new URL('../css/app.css',import.meta.url),'utf8');
const behavior=JSON.parse(fs.readFileSync(new URL('../capy/settings/behavior.json',import.meta.url),'utf8'));

function rub(session,points){for(const [x,y] of points)movePetSession(session,x,y,{inside:true,movementThreshold:behavior.petting.movementThreshold});}

test('2.2.3a Rubbeln braucht echte Bewegung und mindestens einen Richtungswechsel',()=>{
  const s=createPetSession(1,0,0,{rubMode:true});
  movePetSession(s,3,0,{inside:true,movementThreshold:8});
  movePetSession(s,6,0,{inside:true,movementThreshold:8});
  assert.equal(s.distance,0,'Jitter unter dem Threshold zählt nicht');
  rub(s,[[45,0],[5,0],[48,0]]);
  assert.ok(s.directionChanges>=1);
  assert.ok(s.distance>=behavior.petting.rewardDistance);
  assert.equal(petRewardForSession(s,behavior.petting,50,0,1000),1);
  consumePetRewardProgress(s,behavior.petting);
  assert.ok(s.distance<behavior.petting.rewardDistance);
});

test('Gerader Swipe ist im Rubbelmodus kein Reward und außerhalb der Hitbox wird nicht weitergezählt',()=>{
  const s=createPetSession(2,10,10,{rubMode:true});
  rub(s,[[120,10],[220,10]]);
  assert.equal(s.directionChanges,0);
  assert.equal(petRewardForSession(s,behavior.petting,40,0,5000),0);
  const before=s.distance;
  movePetSession(s,500,500,{inside:false,movementThreshold:8});
  assert.equal(s.distance,before);
  assert.equal(pointInExpandedRect(105,50,{left:10,right:100,top:10,bottom:100},8),true);
  assert.equal(pointInExpandedRect(120,50,{left:10,right:100,top:10,bottom:100},8),false);
});

test('Rubbel-Reward hat kurzen Cooldown und ein Session-Limit',()=>{
  const cfg=behavior.petting,s=createPetSession(3,0,0,{rubMode:true});
  rub(s,[[50,0],[0,0],[50,0]]);
  assert.equal(petRewardForSession(s,cfg,50,0,1000),1);
  s.awarded=1;consumePetRewardProgress(s,cfg);
  rub(s,[[0,0],[50,0]]);
  assert.equal(petRewardForSession(s,cfg,51,900,1100),0,'Cooldown verhindert Event-Spam');
  s.awarded=cfg.maxSessionGain;
  assert.equal(petRewardForSession(s,cfg,50,0,5000),0,'Session-Limit wird respektiert');
});

test('Streichel-UI nutzt stabile Pointer-Hitbox und delegiert das sichtbare Reward-Feedback',()=>{
  assert.match(html,/id="capyHitbox"/);
  assert.match(app,/createPetSession\([^)]*\{rubMode:true\}\)/);
  assert.match(app,/pointInExpandedRect/);
  assert.match(app,/function awardPetAffection\(reward\)/);
  assert.doesNotMatch(app,/awardPet[\s\S]*?spawnEffect\('heart'/);
  assert.match(app,/setPointerCapture/);
  assert.match(app,/releasePointerCapture/);
});

test('Food-Auswahl schließt das Inventar und erscheint als greifbarer Bottom-Slot',()=>{
  for(const id of ['selectedFeedBar','selectedFeedItem','selectedFeedImage','selectedFeedName','selectedFeedCount'])assert.match(html,new RegExp(`id="${id}"`));
  assert.match(app,/function selectFeedItem\(item\)[\s\S]*selectedFeedItemId=item\.id[\s\S]*inventorySheet[\s\S]*\.close\(\)[\s\S]*renderSelectedFeedItem/);
  assert.match(app,/!current\.active&&current\.sourceKind==='inventory'&&current\.item\.type==='food'/);
  assert.match(app,/startItemPointer\(event,selectedFeedItemId,'feed-slot'\)/);
  assert.match(css,/\.selected-feed-item\{[^}]*touch-action:none/);
});

test('Drag startet über Bewegung ODER Hold-Delay und verbraucht nur bei gültigem Drop',()=>{
  assert.match(app,/setTimeout\(\(\)=>activateDrag/);
  assert.match(app,/if\(!drag\.active&&moved>=threshold\)activateDrag/);
  assert.doesNotMatch(app,/moved>=threshold&&Date\.now\(\)-drag\.startedAt>=/);
  assert.match(app,/current\.active&&updateDropTarget\(event\.clientX,event\.clientY\)&&!current\.used/);
  assert.match(app,/current\.used=true/);
  assert.match(app,/cancelItemPointer/);
  assert.match(css,/\.drag-ghost\{position:fixed[^}]*pointer-events:none/);
  assert.match(css,/\.drag-ghost\.is-returning/);
  assert.match(css,/\.drag-ghost\.is-consuming/);
});

test('Capy-Game verhindert Textauswahl, Long-Press und nativen Bild-Drag ohne Inputs zu blockieren',()=>{
  assert.match(css,/\.capy-game,\.capy-game \*[^}]*-webkit-user-select:none;user-select:none;-webkit-touch-callout:none/);
  assert.match(css,/\.setup-modal input[^}]*-webkit-user-select:text;user-select:text/);
  assert.match(css,/\.inventory-item img\{[^}]*pointer-events:none/);
  assert.match(css,/\.capy\{[^}]*-webkit-user-drag:none[^}]*pointer-events:none/);
  assert.match(app,/addEventListener\('dragstart'/);
  assert.match(app,/addEventListener\('selectstart'/);
  assert.match(app,/addEventListener\('contextmenu'/);
});

test('Capy besitzt mehrere zufällige Idle- und Zustandsbewegungen',()=>{
  for(const cls of ['capy--idle-look-left','capy--idle-look-right','capy--idle-bob','capy--idle-blink','capy--idle-happy','capy--idle-hungry','capy--idle-drowsy'])assert.match(css,new RegExp(`\\.${cls}`));
  assert.match(app,/idleMinDelayMs/);
  assert.match(app,/idleMaxDelayMs/);
  assert.match(app,/Math\.random\(\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('Pending Capy-Buchungen haben kein Schloss und nutzen normale Zeilen mit reduzierter Deckkraft',()=>{
  assert.doesNotMatch(txView,/🔒/);
  assert.doesNotMatch(monthView,/🔒/);
  assert.match(txView,/transaction-row capy-transaction-row/);
  assert.match(txView,/is-pending/);
  assert.match(txView,/Wartet auf PC/);
  assert.match(monthView,/transaction-row capy-transaction-row/);
  assert.match(appCss,/\.capy-transaction-row\.is-pending\{opacity:\.55\}/);
  assert.match(css,/\.capy-tx\.pending\{opacity:\.55\}/);
});
