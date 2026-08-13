import { clamp } from './shared-state.js';

export function currentPhase(behavior,debugPhase='auto',date=new Date()){
  const schedule=behavior.phaseSchedule||{};if(debugPhase&&debugPhase!=='auto')return {key:debugPhase,label:schedule?.[debugPhase]?.label||debugPhase};
  const hour=date.getHours()+date.getMinutes()/60;for(const key of ['morning','day','evening','night']){const phase=schedule[key]||{},from=Number(phase.from),to=Number(phase.to);if(!Number.isFinite(from)||!Number.isFinite(to))continue;const inside=from===to||(from<to?hour>=from&&hour<to:hour>=from||hour<to);if(inside)return {key,label:String(phase.label||key)};}return {key:'day',label:String(schedule.day?.label||'Tag')};
}

export function autoSleepThresholds(behavior){
  const sleep=behavior?.sleep||{};
  const below=Math.max(0,Math.min(100,Number(sleep.autoSleepBelowPercent??10)));
  const wakeAt=Math.max(below,Math.min(100,Number(sleep.autoWakeAtPercent??25)));
  return {below,wakeAt};
}

export function updateAutoSleepState(care,behavior){
  if(!care)return false;
  const {below,wakeAt}=autoSleepThresholds(behavior);
  const energy=clamp(care.energy);
  if(care.autoSleeping){if(energy>=wakeAt)care.autoSleeping=false;}
  else if(energy<below)care.autoSleeping=true;
  return Boolean(care.autoSleeping);
}

export function isCapySleeping(care,behavior,phase=currentPhase(behavior)){
  updateAutoSleepState(care,behavior);
  return Boolean(care?.autoSleeping||phase?.key==='night');
}

export function applyElapsedDecay(care,behavior,date=Date.now()){
  const now=Number(date)||Date.now(),last=Number(care.lastUpdate)||now,hours=Math.max(0,Math.min(72,(now-last)/3600000));
  const phase=currentPhase(behavior,'auto',new Date(now)),d=behavior.decayPerHour||{},sleepCfg=behavior.sleep||{},recovery=Math.max(0,Number(sleepCfg.autoEnergyRecoveryPerHour??d.energySleepRecovery)||0);
  updateAutoSleepState(care,behavior);
  if(hours>.002){
    care.hunger=clamp(care.hunger-(Number(d.hunger)||0)*hours);
    care.happiness=clamp(care.happiness-(Number(d.happiness)||0)*hours);
    if(care.autoSleeping){
      const {wakeAt}=autoSleepThresholds(behavior),need=Math.max(0,wakeAt-Number(care.energy||0)),sleepHours=recovery>0?Math.min(hours,need/recovery):hours;
      care.energy=clamp(care.energy+recovery*sleepHours);
      if(care.energy>=wakeAt)care.autoSleeping=false;
      const remaining=Math.max(0,hours-sleepHours);
      if(remaining>0){const awakeRate=phase.key==='evening'?Number(d.energyEvening)||0:Number(d.energyDay)||0;care.energy=clamp(care.energy+(phase.key==='night'?recovery:-awakeRate)*remaining);updateAutoSleepState(care,behavior);}
    }else{
      const awakeRate=phase.key==='evening'?Number(d.energyEvening)||0:Number(d.energyDay)||0;
      care.energy=clamp(care.energy+(phase.key==='night'?recovery:-awakeRate)*hours);
      updateAutoSleepState(care,behavior);
    }
  }
  care.lastUpdate=now;return care;
}

export function chooseVisual(care,phase,behavior){const t=behavior.visualThresholds||{};if(isCapySleeping(care,behavior,phase))return 'sleeping';if(care.hunger<=Number(t.hungryAtOrBelow??24))return 'hungry';if(care.happiness>=Number(t.happyHappinessAtOrAbove??88)&&care.energy>=Number(t.happyEnergyAtOrAbove??38))return 'happy';if(care.energy<=Number(t.sleepyEnergyAtOrBelow??34)||phase.key==='evening')return 'sleepy';return 'neutral';}
export function applyPet(care,behavior,overrideGain=null){const cfg=behavior.petting||behavior.interactions?.pet||{},gain=overrideGain==null?Number(cfg.happinessGain??cfg.happiness)||0:Number(overrideGain)||0;care.happiness=clamp(care.happiness+gain);care.bond=clamp(care.bond+(Number(cfg.bondGain??cfg.bond)||0));return {happiness:gain};}
export function canPlay(care,behavior){return !care?.autoSleeping&&care.energy>=Number(behavior.interactions?.play?.minimumEnergy??behavior.playing?.minimumEnergy??12);}
export function applyPlay(care,behavior){const x=behavior.interactions?.play||behavior.playing||{};care.happiness=clamp(care.happiness+(Number(x.happiness)||0));care.bond=clamp(care.bond+(Number(x.bond)||0));care.energy=clamp(care.energy+(Number(x.energy)||0));updateAutoSleepState(care,behavior);return x;}
export function applyItem(care,item){const e=item?.effects||{};const delta={hunger:Number(e.hunger)||0,happiness:Number(e.happiness)||0,energy:Number(e.energy)||0,bond:Number(e.bond)||0};care.hunger=clamp(care.hunger+delta.hunger);care.happiness=clamp(care.happiness+delta.happiness);care.energy=clamp(care.energy+delta.energy);care.bond=clamp(care.bond+delta.bond);return delta;}
export const applyFood=applyItem;
export function genderCopy(gender){return gender==='weiblich'?{label:'Weiblich',mark:'♀'}:{label:'Männlich',mark:'♂'};}
