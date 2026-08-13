(() => {
  'use strict';
  const $=id=>document.getElementById(id);let score=0,startedAt=0;
  async function initialize(){
    const init=await CapytGame.ready();
    const capy=init.capy||await CapytGame.getCapy();
    $('capyName').textContent=`Hallo ${capy?.name||'Capy'}!`;
    const previous=await CapytGame.storage.get('highscore');
    $('status').textContent=previous==null?'Noch kein gespeicherter Template-Highscore.':`Gespeicherter Template-Highscore: ${previous}`;
  }
  $('startButton').addEventListener('click',async()=>{await CapytGame.start();score=0;startedAt=performance.now();$('score').textContent='0';$('pointButton').disabled=false;$('finishButton').disabled=false;$('startButton').disabled=true;});
  $('pointButton').addEventListener('click',()=>{score+=1;$('score').textContent=String(score);});
  $('finishButton').addEventListener('click',async()=>{const durationMs=Math.max(0,Math.round(performance.now()-startedAt));await CapytGame.submitScore({score});const old=Number(await CapytGame.getGameData('highscore'))||0;if(score>old)await CapytGame.setGameData('highscore',score);const result=await CapytGame.finish({score,durationMs});$('status').textContent=`Run ${result.runId}: ${result.score} Punkte, ${result.coinsAwarded} Coins.`;});
  CapytGame.onThemeChange(theme=>{$('status').dataset.theme=theme;});
  initialize().catch(error=>{$('status').textContent=error.message||'Bridge-Fehler';});
})();
