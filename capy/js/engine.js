import { clamp } from './shared-state.js';

export function currentPhase(behavior,debugPhase='auto',date=new Date()){
  const schedule=behavior.phaseSchedule||{};
  if(debugPhase&&debugPhase!=='auto')return {key:debugPhase,label:schedule?.[debugPhase]?.label||debugPhase};
  const hour=date.getHours()+date.getMinutes()/60;
  const order=['morning','day','evening','night'];
  for(const key of order){
    const phase=schedule[key]||{};const from=Number(phase.from),to=Number(phase.to);
    if(!Number.isFinite(from)||!Number.isFinite(to))continue;
    const inside=from===to?true:(from<to?hour>=from&&hour<to:hour>=from||hour<to);
    if(inside)return {key,label:String(phase.label||key)};
  }
  return {key:'day',label:String(schedule.day?.label||'Tag')};
}

export function applyElapsedDecay(care,behavior,date=Date.now()){
  const now=Number(date)||Date.now();
  const last=Number(care.lastUpdate)||now;
  const hours=Math.max(0,Math.min(72,(now-last)/3600000));
  if(hours>.002){
    const phase=currentPhase(behavior,'auto',new Date(now));
    const decay=behavior.decayPerHour||{};
    care.hunger=clamp(care.hunger-(Number(decay.hunger)||0)*hours);
    care.happiness=clamp(care.happiness-(Number(decay.happiness)||0)*hours);
    if(phase.key==='night')care.energy=clamp(care.energy+(Number(decay.energySleepRecovery)||0)*hours);
    else care.energy=clamp(care.energy-(phase.key==='evening'?(Number(decay.energyEvening)||0):(Number(decay.energyDay)||0))*hours);
  }
  care.lastUpdate=now;
  return care;
}

export function chooseVisual(care,phase,behavior){
  const t=behavior.visualThresholds||{};
  if(phase.key==='night')return 'sleeping';
  if(care.hunger<=Number(t.hungryAtOrBelow??24))return 'hungry';
  if(care.happiness>=Number(t.happyHappinessAtOrAbove??88)&&care.energy>=Number(t.happyEnergyAtOrAbove??38))return 'happy';
  if(care.energy<=Number(t.sleepyEnergyAtOrBelow??34)||phase.key==='evening')return 'sleepy';
  return 'neutral';
}

export function applyPet(care,behavior){
  const x=behavior.interactions?.pet||{};
  care.happiness=clamp(care.happiness+(Number(x.happiness)||0));
  care.bond=clamp(care.bond+(Number(x.bond)||0));
}

export function canPlay(care,behavior){return care.energy>=Number(behavior.interactions?.play?.minimumEnergy??12);}
export function applyPlay(care,behavior){
  const x=behavior.interactions?.play||{};
  care.happiness=clamp(care.happiness+(Number(x.happiness)||0));
  care.bond=clamp(care.bond+(Number(x.bond)||0));
  care.energy=clamp(care.energy+(Number(x.energy)||0));
}

export function applyFood(care,item){
  care.hunger=clamp(care.hunger+(Number(item.hunger)||0));
  care.happiness=clamp(care.happiness+(Number(item.happiness)||0));
  care.energy=clamp(care.energy+(Number(item.energy)||0));
  care.bond=clamp(care.bond+(Number(item.bond)||0));
}

export function genderCopy(gender){
  if(gender==='weiblich')return {label:'Weiblich',mark:'♀'};
  return {label:'Männlich',mark:'♂'};
}
