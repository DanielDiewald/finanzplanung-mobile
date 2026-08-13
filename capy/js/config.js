const FALLBACK_BEHAVIOR={
  version:3,
  genders:['weiblich','männlich'],
  initialNeeds:{hunger:64,happiness:76,energy:82,bond:18},
  phaseSchedule:{morning:{from:6,to:10,label:'Morgen'},day:{from:10,to:19,label:'Tag'},evening:{from:19,to:22,label:'Abend'},night:{from:22,to:6,label:'Nacht'}},
  decayPerHour:{hunger:3.2,happiness:.8,energyDay:2.2,energyEvening:4.2,energySleepRecovery:9},
  interactions:{play:{minimumEnergy:12,happiness:7,bond:2,energy:-8}},
  petting:{
    enabled:true,movementThreshold:8,rewardDistance:80,rewardCooldownMs:500,minimumDirectionChanges:1,rubHappinessGain:1,hitPaddingPx:24,maxSessionGain:12,bondGain:1,
    visualHeartDistance:55,heartCooldownMs:170,heartEscalationDistance:145,heartEscalationMs:650,maxHeartBurst:5,
    affectionRequiredDistance:360,affectionRequiredDirectionChanges:4,affectionMinimumMs:1300,affectionHappinessGain:2,maxSessionBondGain:3,
    hapticMs:18,hapticCooldownMs:90,hapticRewardPattern:[24,32,34],requiredDistance:120,cooldownMs:2500,happinessGain:4
  },
  inventoryDrag:{holdDelayMs:80,movementThreshold:5,returnAnimationMs:180,consumeAnimationMs:140},
  sleep:{blocksPet:true,blocksPlay:true,blocksFood:true,autoSleepBelowPercent:10,autoWakeAtPercent:25,autoEnergyRecoveryPerHour:9},
  animations:{idleMinDelayMs:1500,idleMaxDelayMs:4500,idleMotionMs:700},
  animationMs:{pet:520,play:760,feed:900,celebrate:1300,effect:1800,zzz:3300},
  decayTickMs:60000,
  visualThresholds:{hungryAtOrBelow:24,happyHappinessAtOrAbove:88,happyEnergyAtOrAbove:38,sleepyEnergyAtOrBelow:34},
  roomBackground:'',room:{backgroundImage:'',backgroundPosition:'center',backgroundSize:'cover'},maxJournalEntries:80
};
const FALLBACK_ECONOMY={version:2,coinsPerEuro:1,minimumTopUpCents:100,coinImage:'./assets/ui/coins.png',currency:'EUR',vorratCategory:'Capy Vorrat',stashLockMonths:1};
const FALLBACK_ITEMS={version:2,items:[]};

async function readJson(path,fallback){
  try{
    const response=await fetch(path,{cache:'no-store'});
    if(!response.ok)throw new Error(String(response.status));
    return await response.json();
  }catch(error){
    console.warn(`Capy-Einstellung ${path} konnte nicht geladen werden; Fallback wird verwendet.`,error);
    return globalThis.structuredClone?globalThis.structuredClone(fallback):JSON.parse(JSON.stringify(fallback));
  }
}

function normalizeItem(item){
  const effects=item.effects||{hunger:item.hunger,happiness:item.happiness,energy:item.energy,bond:item.bond};
  return {
    ...item,
    type:['food','toy','care'].includes(item.type)?item.type:'food',
    priceCoins:Math.max(0,Math.floor(Number(item.price??item.priceCoins)||0)),
    asset:String(item.image||item.asset||''),
    stackable:item.stackable!==false,
    maxStack:Math.max(1,Math.floor(Number(item.maxStack)||99)),
    effects:{hunger:Number(effects.hunger)||0,happiness:Number(effects.happiness)||0,energy:Number(effects.energy)||0,bond:Number(effects.bond)||0},
    interaction:{target:'capy',animation:item.interaction?.animation||(item.type==='toy'?'play':item.type==='care'?'care':'eat'),...(item.interaction||{})}
  };
}

export async function loadCapyConfig(){
  const [behavior,economy,itemConfig]=await Promise.all([
    readJson('./settings/behavior.json',FALLBACK_BEHAVIOR),
    readJson('./settings/economy.json',FALLBACK_ECONOMY),
    readJson('./settings/items.json',FALLBACK_ITEMS)
  ]);
  const roomBackground=String(behavior.roomBackground??behavior.room?.backgroundImage??'');
  return {
    behavior:{
      ...FALLBACK_BEHAVIOR,...behavior,
      initialNeeds:{...FALLBACK_BEHAVIOR.initialNeeds,...(behavior.initialNeeds||{})},
      phaseSchedule:{...FALLBACK_BEHAVIOR.phaseSchedule,...(behavior.phaseSchedule||{})},
      decayPerHour:{...FALLBACK_BEHAVIOR.decayPerHour,...(behavior.decayPerHour||{})},
      interactions:{...FALLBACK_BEHAVIOR.interactions,...(behavior.interactions||{}),play:{...FALLBACK_BEHAVIOR.interactions.play,...(behavior.interactions?.play||behavior.playing||{})}},
      petting:{...FALLBACK_BEHAVIOR.petting,...(behavior.petting||{})},
      inventoryDrag:{...FALLBACK_BEHAVIOR.inventoryDrag,...(behavior.inventoryDrag||{})},
      sleep:{...FALLBACK_BEHAVIOR.sleep,...(behavior.sleep||{})},
      animations:{...FALLBACK_BEHAVIOR.animations,...(behavior.animations||{})},
      animationMs:{...FALLBACK_BEHAVIOR.animationMs,...(behavior.animationMs||{})},
      visualThresholds:{...FALLBACK_BEHAVIOR.visualThresholds,...(behavior.visualThresholds||{})},
      roomBackground,
      room:{...FALLBACK_BEHAVIOR.room,...(behavior.room||{}),backgroundImage:roomBackground}
    },
    economy:{...FALLBACK_ECONOMY,...economy},
    items:(itemConfig.items||[]).filter(item=>item?.enabled!==false).map(normalizeItem)
  };
}
