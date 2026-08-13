const FALLBACK_BEHAVIOR={
  version:1,
  genders:['weiblich','männlich'],
  initialNeeds:{hunger:64,happiness:76,energy:82,bond:18},
  phaseSchedule:{morning:{from:6,to:10,label:'Morgen'},day:{from:10,to:19,label:'Tag'},evening:{from:19,to:22,label:'Abend'},night:{from:22,to:6,label:'Nacht'}},
  decayPerHour:{hunger:3.2,happiness:.8,energyDay:2.2,energyEvening:4.2,energySleepRecovery:9},
  interactions:{pet:{happiness:4,bond:1.5},play:{minimumEnergy:12,happiness:7,bond:2,energy:-8}},
  sleep:{blocksPet:true,blocksPlay:true,blocksFood:true},animationMs:{pet:520,play:760,feed:900,celebrate:1300,effect:1800,zzz:3300},decayTickMs:60000,
  visualThresholds:{hungryAtOrBelow:24,happyHappinessAtOrAbove:88,happyEnergyAtOrAbove:38,sleepyEnergyAtOrBelow:34},
  room:{backgroundImage:'',backgroundPosition:'center',backgroundSize:'cover'},
  maxJournalEntries:80
};
const FALLBACK_ECONOMY={version:1,coinsPerEuro:1,minimumTopUpCents:100,coinImage:'./assets/ui/coins.png',currency:'EUR',vorratCategory:'Capy Vorrat'};
const FALLBACK_ITEMS={version:1,items:[]};

async function readJson(path,fallback){
  try{
    const response=await fetch(path,{cache:'no-store'});
    if(!response.ok)throw new Error(String(response.status));
    return await response.json();
  }catch(error){
    console.warn(`Capy-Einstellung ${path} konnte nicht geladen werden; Fallback wird verwendet.`,error);
    return globalThis.structuredClone ? globalThis.structuredClone(fallback) : JSON.parse(JSON.stringify(fallback));
  }
}

export async function loadCapyConfig(){
  const [behavior,economy,itemConfig]=await Promise.all([
    readJson('./settings/behavior.json',FALLBACK_BEHAVIOR),
    readJson('./settings/economy.json',FALLBACK_ECONOMY),
    readJson('./settings/items.json',FALLBACK_ITEMS)
  ]);
  return {behavior:{...FALLBACK_BEHAVIOR,...behavior,initialNeeds:{...FALLBACK_BEHAVIOR.initialNeeds,...(behavior.initialNeeds||{})},phaseSchedule:{...FALLBACK_BEHAVIOR.phaseSchedule,...(behavior.phaseSchedule||{})},decayPerHour:{...FALLBACK_BEHAVIOR.decayPerHour,...(behavior.decayPerHour||{})},interactions:{...FALLBACK_BEHAVIOR.interactions,...(behavior.interactions||{}),pet:{...FALLBACK_BEHAVIOR.interactions.pet,...(behavior.interactions?.pet||{})},play:{...FALLBACK_BEHAVIOR.interactions.play,...(behavior.interactions?.play||{})}},sleep:{...FALLBACK_BEHAVIOR.sleep,...(behavior.sleep||{})},animationMs:{...FALLBACK_BEHAVIOR.animationMs,...(behavior.animationMs||{})},visualThresholds:{...FALLBACK_BEHAVIOR.visualThresholds,...(behavior.visualThresholds||{})},room:{...FALLBACK_BEHAVIOR.room,...(behavior.room||{})}},economy:{...FALLBACK_ECONOMY,...economy},items:(itemConfig.items||[]).filter(item=>item?.enabled!==false)};
}
