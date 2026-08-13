import { ensureGameRecord } from './game-storage.js';

function integer(value,label,{min=0,max=Number.MAX_SAFE_INTEGER}={}){
  const n=Number(value);if(!Number.isFinite(n)||!Number.isInteger(n)||n<min||n>max)throw new Error(`${label} ist ungültig.`);return n;
}

export function validateGameResult(game,result,{requireDuration=true}={}){
  if(!result||typeof result!=='object'||Array.isArray(result))throw new Error('Game-Resultat fehlt.');
  const rules=game?.resultValidation||{};
  const score=integer(result.score,'Score',{min:Number(rules.minScore??0),max:Number(rules.maxScore??100000000)});
  let durationMs=0;
  if(requireDuration||result.durationMs!=null)durationMs=integer(result.durationMs??0,'Spieldauer',{min:Number(rules.minDurationMs??0),max:Number(rules.maxDurationMs??86400000)});
  return {score,durationMs};
}

export function calculateCoinReward(game,score){
  const rewards=game?.rewards||{};if(!rewards.enabled||rewards.currency!=='coins')return 0;
  const strategy=rewards.strategy||{};let amount=0;
  if(strategy.type==='score')amount=Math.floor(Math.max(0,score)/Math.max(1,Number(strategy.scorePerCoin)||1));
  else amount=score>0?1:0;
  return Math.max(0,Math.min(Math.trunc(Number(rewards.maxCoinsPerRun)||0),amount));
}

export function recordSubmittedScore(state,game,result){
  const validated=validateGameResult(game,result,{requireDuration:false});
  const record=ensureGameRecord(state,game.id);record.lastScore=validated.score;
  if(record.bestScore==null||validated.score>record.bestScore)record.bestScore=validated.score;
  return {score:validated.score,bestScore:record.bestScore};
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
    const requested=calculateCoinReward(game,validated.score);
    const remaining=dailyLimit>0?Math.max(0,dailyLimit-dailyUsed):requested;
    coinsAwarded=cooldownReady?Math.min(requested,remaining):0;
    if(coinsAwarded>0){
      queueCoins(coinsAwarded,`Minigame ${game.id} · ${id}`);
      record.totalCoinsEarned+=coinsAwarded;record.lastRewardAt=now.toISOString();record.rewardDays={...(record.rewardDays||{}),[day]:dailyUsed+coinsAwarded};
    }
  }
  return {duplicate:false,runId:id,score:validated.score,bestScore:record.bestScore,newHighScore,coinsAwarded,totalCoinsEarned:record.totalCoinsEarned,plays:record.plays,durationMs:validated.durationMs};
}
