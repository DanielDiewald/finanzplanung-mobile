import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeGameRegistry, visibleGames, canLaunchGame } from '../capy/games/js/game-hub.js';
import { validateGameEntry, createGameLoader } from '../capy/games/js/game-loader.js';
import { createGameBridge } from '../capy/games/js/game-bridge.js';
import { calculateCoinReward, processFinishedRun } from '../capy/games/js/game-rewards.js';
import { createGameStorage, normalizeGamesState } from '../capy/games/js/game-storage.js';
import { normalizeCapyState, CAPY_STATE_VERSION } from '../capy/js/shared-state.js';

const root=path.resolve(new URL('..',import.meta.url).pathname);
const rawRegistry=JSON.parse(fs.readFileSync(path.join(root,'capy/games/games.json'),'utf8'));
const registry=normalizeGameRegistry(rawRegistry);
const carrot=registry.games.find(game=>game.id==='carrot-catch');
const clone=value=>structuredClone(value);

test('games.json lädt, sortiert und blendet disabled Games aus',()=>{
  assert.equal(registry.schemaVersion,1);
  assert.equal(registry.apiVersion,1);
  const games=visibleGames(registry);
  assert.deepEqual(games.map(game=>game.id),['carrot-catch','capy-pong','river-ride','snack-toss']);
  assert.equal(games.some(game=>game.id==='bridge-demo'),false);
});

test('nur available/experimental Games mit lokalem Entry sind startbar',()=>{
  assert.equal(canLaunchGame(carrot),true);
  assert.equal(canLaunchGame(registry.games.find(game=>game.id==='river-ride')),false);
  assert.equal(validateGameEntry('./projects/carrot-catch/index.html'),true);
  for(const entry of ['https://example.com/game','../evil/index.html','./projects/../evil/index.html','/capy/games/projects/carrot-catch/index.html']) assert.equal(validateGameEntry(entry),false,entry);
});

test('Registry lehnt doppelte IDs, unbekannte Statuswerte und unbekannte Capabilities ab',()=>{
  const duplicate=clone(rawRegistry);duplicate.games.push(clone(duplicate.games[0]));assert.throws(()=>normalizeGameRegistry(duplicate),/Doppelte Game-ID/);
  const status=clone(rawRegistry);status.games[0].status='mystery';assert.throws(()=>normalizeGameRegistry(status),/Unbekannter Game-Status/);
  const cap=clone(rawRegistry);cap.games[0].capabilities.push('finance.*');assert.throws(()=>normalizeGameRegistry(cap),/Unbekannte Capability/);
});

test('Reward wird aus Score berechnet, pro Run begrenzt und ignoriert manipulierte Coin-Werte',()=>{
  assert.equal(calculateCoinReward(carrot,4),2);
  assert.equal(calculateCoinReward(carrot,1000),15);
  const state={games:{}},coins=[];
  const result=processFinishedRun({state,game:carrot,result:{score:4,durationMs:2000,coins:999999},runId:'game_run_reward001',now:new Date('2026-08-13T10:00:00Z'),allowCoins:true,queueCoins:amount=>coins.push(amount)});
  assert.equal(result.coinsAwarded,2);assert.deepEqual(coins,[2]);assert.equal(state.games['carrot-catch'].totalCoinsEarned,2);
  assert.equal('transactions' in result,false);
});

test('doppelte Run-ID vergibt weder Coins noch Plays doppelt',()=>{
  const state={games:{}},coins=[];
  const args={state,game:carrot,result:{score:12,durationMs:3000},runId:'game_run_dedupe001',now:new Date('2026-08-13T10:00:00Z'),allowCoins:true,queueCoins:amount=>coins.push(amount)};
  const first=processFinishedRun(args),second=processFinishedRun(args);
  assert.equal(first.duplicate,false);assert.equal(second.duplicate,true);assert.equal(state.games['carrot-catch'].plays,1);assert.deepEqual(coins,[6]);
});

test('Daily Reward Limit und deaktivierte Rewards werden respektiert',()=>{
  const limited=clone(carrot);limited.rewards.dailyRewardLimit=5;limited.rewards.maxCoinsPerRun=4;limited.rewards.strategy={type:'score',scorePerCoin:1};
  const state={games:{}},coins=[];
  const r1=processFinishedRun({state,game:limited,result:{score:10,durationMs:2000},runId:'game_run_limit001',now:new Date('2026-08-13T10:00:00Z'),allowCoins:true,queueCoins:a=>coins.push(a)});
  const r2=processFinishedRun({state,game:limited,result:{score:10,durationMs:2000},runId:'game_run_limit002',now:new Date('2026-08-13T11:00:00Z'),allowCoins:true,queueCoins:a=>coins.push(a)});
  assert.equal(r1.coinsAwarded,4);assert.equal(r2.coinsAwarded,1);assert.deepEqual(coins,[4,1]);
  const disabled=clone(limited);disabled.rewards.enabled=false;
  const r3=processFinishedRun({state:{games:{}},game:disabled,result:{score:10,durationMs:2000},runId:'game_run_disabled01',allowCoins:true,queueCoins:()=>assert.fail('no reward')});
  assert.equal(r3.coinsAwarded,0);
});

test('Game Storage ist pro gameId namespaced und bleibt normalisierbar',async()=>{
  const state={games:{}};let saves=0;const storage=createGameStorage({getState:()=>state,saveState:async()=>{saves++;}});
  await storage.set('game-a','highscore',12);await storage.set('game-b','highscore',99);
  assert.equal(await storage.get('game-a','highscore'),12);assert.equal(await storage.get('game-b','highscore'),99);assert.equal(saves,2);
  const normalized=normalizeGamesState(state.games);assert.equal(normalized['game-a'].data.highscore,12);assert.equal(normalized['game-b'].data.highscore,99);
});

test('Capy-State migriert auf Version 3 und erhält bestehenden Care-State',()=>{
  const state=normalizeCapyState({version:2,enabled:true,care:{initialized:true,name:'Momo',gender:'weiblich',hunger:70,happiness:80,energy:60,bond:30,inventory:{carrot:2}}});
  assert.equal(CAPY_STATE_VERSION,3);assert.equal(state.version,3);assert.equal(state.care.name,'Momo');assert.deepEqual(state.games,{});
});

test('Game Hub, Sandbox und zentrale Bridge sind in der Capy-UI verdrahtet',()=>{
  const html=fs.readFileSync(path.join(root,'capy/index.html'),'utf8');
  const app=fs.readFileSync(path.join(root,'capy/js/app.js'),'utf8');
  const bridge=fs.readFileSync(path.join(root,'capy/games/js/game-bridge.js'),'utf8');
  const sdk=fs.readFileSync(path.join(root,'capy/games/js/game-sdk.js'),'utf8');
  assert.match(html,/id="gameHubSheet"[^>]*data-sheet/);assert.match(html,/id="gameHubSheet"[\s\S]*?class="sheet-handle"/);
  assert.match(html,/sandbox="allow-scripts"/);assert.doesNotMatch(html,/sandbox="[^"]*allow-same-origin/);
  assert.match(app,/playButton\.addEventListener\('click',\(\)=>void openGameHub\(\)\)/);
  for(const type of ['capyt.game.ready','capyt.game.getCapy','capyt.game.submitScore','capyt.game.finish']) assert.ok(bridge.includes(type),type);
  for(const api of ['ready','getCapy','getAppInfo','submitScore','finish','getGameData','setGameData','storage']) assert.ok(sdk.includes(api),api);
});

test('PWA cached Game Framework und aktiviert Game-Assets dynamisch aus games.json',()=>{
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  for(const file of ['capy/games/games.json','capy/games/css/games.css','capy/games/js/game-hub.js','capy/games/js/game-loader.js','capy/games/js/game-bridge.js','capy/games/js/game-rewards.js','capy/games/js/game-storage.js','capy/games/js/game-sdk.js']) assert.ok(sw.includes(`./${file}`),file);
  assert.match(sw,/precacheEnabledGames/);assert.match(sw,/game\.offlineAssets/);
  for(const game of registry.games.filter(canLaunchGame)){
    const entry=path.join(root,'capy/games',game.entry.replace(/^\.\//,''));assert.ok(fs.existsSync(entry),entry);
    for(const asset of game.offlineAssets){const file=path.join(root,'capy/games',asset.replace(/^\.\//,''));assert.ok(fs.existsSync(file),file);}
  }
});


test('Game Bridge Handshake validiert Session und liefert nur erlaubte Initialdaten',async()=>{
  const oldWindow=globalThis.window,listeners=new Map(),source={};
  globalThis.window={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:(type)=>listeners.delete(type)};
  try{
    const game=clone(carrot),session={gameId:game.id,game,sessionId:'game_session_bridge001',runId:'game_run_bridge001',status:'loading'};const posts=[];
    const loader={session:()=>session,isSource:value=>value===source,post:message=>posts.push(message),setStatus:status=>{session.status=status;},finish:result=>{session.status='finished';session.finishedResult=result;}};
    const bridge=createGameBridge({loader,getCapySnapshot:()=>({name:'Momo',energy:80}),getAppInfo:()=>({version:'2.2.8b'}),getTheme:()=> 'dark',storage:{get:async()=>null,set:async()=>null,remove:async()=>true},getState:()=>({games:{}}),saveState:async()=>{},queueCoins:()=>{}});
    await bridge.handle({source,data:{type:'capyt.game.ready',requestId:'req_ready',gameId:game.id,sessionId:session.sessionId}});
    assert.equal(session.status,'ready');assert.equal(posts.at(-1).type,'capyt.game.init');assert.equal(posts.at(-1).data.apiVersion,1);assert.equal(posts.at(-1).data.gameId,game.id);assert.equal(posts.at(-1).data.capy.name,'Momo');assert.equal(posts.at(-1).data.app.version,'2.2.8b');
    bridge.destroy();assert.equal(listeners.has('message'),false);
  }finally{globalThis.window=oldWindow;}
});

test('Game Bridge lehnt falsche Game-ID, unbekannte Messages und fehlende Capability ab',async()=>{
  const oldWindow=globalThis.window,source={};globalThis.window={addEventListener:()=>{},removeEventListener:()=>{}};
  try{
    const game=clone(carrot);game.capabilities=game.capabilities.filter(cap=>cap!=='capy.read');const session={gameId:game.id,game,sessionId:'game_session_bridge002',runId:'game_run_bridge002',status:'ready'};const posts=[];
    const loader={session:()=>session,isSource:value=>value===source,post:message=>posts.push(message),setStatus:status=>{session.status=status;},finish:()=>{}};
    const bridge=createGameBridge({loader,getCapySnapshot:()=>({name:'hidden'}),getAppInfo:()=>({}),getTheme:()=> 'light',storage:{get:async()=>null,set:async()=>null,remove:async()=>true},getState:()=>({games:{}}),saveState:async()=>{},queueCoins:()=>{}});
    await bridge.handle({source,data:{type:'capyt.game.getCapy',requestId:'req_badid',gameId:'other-game',sessionId:session.sessionId}});assert.equal(posts.at(-1).ok,false);assert.match(posts.at(-1).error,/Game-ID/);
    await bridge.handle({source,data:{type:'capyt.game.unknown',requestId:'req_unknown',gameId:game.id,sessionId:session.sessionId}});assert.equal(posts.at(-1).ok,false);assert.match(posts.at(-1).error,/Unbekannte/);
    await bridge.handle({source,data:{type:'capyt.game.getCapy',requestId:'req_cap',gameId:game.id,sessionId:session.sessionId}});assert.equal(posts.at(-1).ok,false);assert.match(posts.at(-1).error,/Capability/);
    const before=posts.length;await bridge.handle({source:{},data:{type:'capyt.game.getTheme',requestId:'req_source',gameId:game.id,sessionId:session.sessionId}});assert.equal(posts.length,before);
    bridge.destroy();
  }finally{globalThis.window=oldWindow;}
});

test('Game Bridge vermittelt Theme, Storage, Score und Finish mit Host-Reward',async()=>{
  const oldWindow=globalThis.window,source={};globalThis.window={addEventListener:()=>{},removeEventListener:()=>{}};
  try{
    const game=clone(carrot),state={games:{}},posts=[],coins=[],saved=[],values=new Map();const session={gameId:game.id,game,sessionId:'game_session_bridge003',runId:'game_run_bridge003',status:'ready'};
    const loader={session:()=>session,isSource:value=>value===source,post:message=>posts.push(message),setStatus:status=>{session.status=status;},finish:result=>{session.status='finished';session.finishedResult=result;}};
    const storage={get:async(id,key)=>values.get(`${id}:${key}`)??null,set:async(id,key,value)=>{values.set(`${id}:${key}`,value);return value;},remove:async(id,key)=>values.delete(`${id}:${key}`)};
    const bridge=createGameBridge({loader,getCapySnapshot:()=>({name:'Momo'}),getAppInfo:()=>({version:'2.2.8b'}),getTheme:()=> 'light',storage,getState:()=>state,saveState:async()=>{saved.push(true);},queueCoins:amount=>coins.push(amount)});
    const send=async(type,requestId,extra={})=>{await bridge.handle({source,data:{type,requestId,gameId:game.id,sessionId:session.sessionId,...extra}});return posts.at(-1);};
    let response=await send('capyt.game.getTheme','req_theme');assert.equal(response.data.theme,'light');
    response=await send('capyt.game.storage.set','req_set',{key:'difficulty',value:'normal'});assert.equal(response.data.value,'normal');response=await send('capyt.game.storage.get','req_get',{key:'difficulty'});assert.equal(response.data.value,'normal');
    response=await send('capyt.game.submitScore','req_score',{result:{score:8}});assert.equal(response.data.bestScore,8);
    response=await send('capyt.game.finish','req_finish',{result:{score:8,durationMs:2000,coins:999999}});assert.equal(response.data.coinsAwarded,4);assert.deepEqual(coins,[4]);assert.equal(session.status,'finished');assert.equal(state.games[game.id].plays,1);assert.ok(saved.length>=2);
    bridge.destroy();
  }finally{globalThis.window=oldWindow;}
});

test('Game Loader erzeugt Session/Run IDs, sendet Lifecycle und schliesst sauber',()=>{
  const posted=[],listeners={};const frame={contentWindow:{postMessage:message=>posted.push(message)},addEventListener:(type,fn)=>{listeners[type]=fn;},removeAttribute:()=>{},src:''};
  const statuses=[];const loader=createGameLoader({frame,onStatusChange:status=>statuses.push(status)});const session=loader.open(carrot);
  assert.match(session.sessionId,/^game_session_/);assert.match(session.runId,/^game_run_/);assert.match(frame.src,/capytGameId=carrot-catch/);assert.equal(session.status,'loading');
  loader.setStatus('ready');loader.setStatus('playing');assert.equal(loader.pause(),true);assert.equal(posted.at(-1).state,'paused');assert.equal(loader.resume(),true);assert.equal(posted.at(-1).state,'playing');
  const previous=loader.close();assert.equal(previous.gameId,'carrot-catch');assert.equal(loader.session(),null);assert.equal(frame.src,'about:blank');assert.equal(statuses.at(-1),'closed');
});

test('Game SDK akzeptiert Host-Nachrichten nur vom Parent und gleicht Sessiondaten ab',()=>{
  const sdk=fs.readFileSync(path.join(root,'capy/games/js/game-sdk.js'),'utf8');
  assert.match(sdk,/event\.source!==parent/);assert.match(sdk,/data\?\.gameId!==gameId/);assert.match(sdk,/message\.sessionId!==sessionId/);
});
