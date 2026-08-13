import { ensureGameRecord } from './game-storage.js';

function integer(value,label,{min=0,max=Number.MAX_SAFE_INTEGER}={}){
  const n=Number(value);if(!Number.isFinite(n)||!Number.isInteger(n)||n<min||n>max)throw new Error(`${label} ist ungültig.`);return n;
}
function text(value,max=80){return String(value??'').trim().slice(0,max);}

function validateDifficultyWin(game,result,score){
  const strategy=game?.rewards?.strategy||{};
  if(strategy.type!=='difficulty_win')return null;
  const targetScore=integer(strategy.targetScore??5,'Zielpunktzahl',{min:1,max:100});
  const details=result?.details;
  if(!details||typeof details!=='object'||Array.isArray(details))throw new Error('Match-Punktestand fehlt.');
  const playerPoints=integer(details.playerPoints,'Spieler-Punkte',{min:0,max:targetScore});
  const rivalPoints=integer(details.rivalPoints,'Rivalen-Punkte',{min:0,max:targetScore});
  if(playerPoints!==score)throw new Error('Score stimmt nicht mit dem Punktestand überein.');
  if(playerPoints<targetScore&&rivalPoints<targetScore)throw new Error('Das Match ist noch nicht beendet.');
  if(playerPoints>=targetScore&&rivalPoints>=targetScore)throw new Error('Der Match-Punktestand ist ungültig.');
  const difficulty=text(details.difficulty,32);
  const tier=strategy.difficulties?.[difficulty];
  if(!tier||typeof tier!=='object'||Array.isArray(tier))throw new Error('Unbekannte Schwierigkeitsstufe.');
  const difficultyLabel=text(tier.label,40)||difficulty;
  return {type:'versus',playerPoints,rivalPoints,won:playerPoints>=targetScore&&playerPoints>rivalPoints,difficulty,difficultyLabel,targetScore};
}

export function validateGameResult(game,result,{requireDuration=true}={}){
  if(!result||typeof result!=='object'||Array.isArray(result))throw new Error('Game-Resultat fehlt.');
  const rules=game?.resultValidation||{};
  const score=integer(result.score,'Score',{min:Number(rules.minScore??0),max:Number(rules.maxScore??100000000)});
  let durationMs=0;
  if(requireDuration||result.durationMs!=null)durationMs=integer(result.durationMs??0,'Spieldauer',{min:Number(rules.minDurationMs??0),max:Number(rules.maxDurationMs??86400000)});
  const display=validateDifficultyWin(game,result,score);
  return {score,durationMs,...(display?{display}:{})};
}

export function calculateCoinReward(game,score,validatedResult=null){
  const rewards=game?.rewards||{};if(!rewards.enabled||rewards.currency!=='coins')return 0;
  const strategy=rewards.strategy||{};let amount=0;
  if(strategy.type==='score')amount=Math.floor(Math.max(0,score)/Math.max(1,Number(strategy.scorePerCoin)||1));
  else if(strategy.type==='difficulty_win'){
    const display=validatedResult?.display;
    if(display?.type==='versus'&&display.won){
      const tier=strategy.difficulties?.[display.difficulty];
      amount=Math.max(0,Math.trunc(Number(tier?.coins)||0));
    }
  }else amount=score>0?1:0;
  return Math.max(0,Math.min(Math.trunc(Number(rewards.maxCoinsPerRun)||0),amount));
}

export function recordSubmittedScore(state,game,result){
  const validated=validateGameResult(game,result,{requireDuration:false});
  const record=ensureGameRecord(state,game.id);record.lastScore=validated.score;
  if(record.bestScore==null||validated.score>record.bestScore)record.bestScore=validated.score;
  return {score:validated.score,bestScore:record.bestScore,...(validated.display?{display:validated.display}:{})};
}

export function processFinishedRun({state,game,result,runId,now=new Date(),allowCoins=false,queueCoins=()=>{}}){
  const id=String(runId||'');if(!/^game_run_[A-Za-z0-9_-]{6,}$/.test(id))throw new Error('Ungültige Run-ID.');
  const validated=validateGameResult(game,result);
  const record=ensureGameRecord(state,game.id);
  if(record.processedRunIds.includes(id))return {duplicate:true,runId:id,score:record.lastScore,bestScore:record.bestScore,coinsAwarded:0,totalCoinsEarned:record.totalCoinsEarned};

  record.processedRunIds=[...record.processedRunIds,id].slice(-500);
  record.lastScore=validated.score;record.plays+=1;record.lastPlayedAt=now.toISOString();
  const newHighScore=record.bestScore==null||validated.score>record.bestScore;if(newHighScore)record.bestScore=validated.score;

  let coinsAwarded=0;
  if(allowCoins&&game?.rewards?.enabled){
    const day=now.toISOString().slice(0,10),dailyUsed=Math.max(0,Math.trunc(Number(record.rewardDays?.[day])||0));
    const dailyLimit=Math.max(0,Math.trunc(Number(game.rewards.dailyRewardLimit)||0));
    const cooldown=Math.max(0,Math.trunc(Number(game.rewards.cooldownMs)||0));
    const lastRewardMs=Date.parse(record.lastRewardAt||'')||0;
    const cooldownReady=!cooldown||!lastRewardMs||(now.getTime()-lastRewardMs)>=cooldown;
    const requested=calculateCoinReward(game,validated.score,validated);
    const remaining=dailyLimit>0?Math.max(0,dailyLimit-dailyUsed):requested;
    coinsAwarded=cooldownReady?Math.min(requested,remaining):0;
    if(coinsAwarded>0){
      queueCoins(coinsAwarded,`Minigame ${game.id} · ${id}`);
      record.totalCoinsEarned+=coinsAwarded;record.lastRewardAt=now.toISOString();record.rewardDays={...(record.rewardDays||{}),[day]:dailyUsed+coinsAwarded};
    }
  }
  return {duplicate:false,runId:id,score:validated.score,bestScore:record.bestScore,newHighScore,coinsAwarded,totalCoinsEarned:record.totalCoinsEarned,plays:record.plays,durationMs:validated.durationMs,...(validated.display?{display:validated.display}:{})};
}
