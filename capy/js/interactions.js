export function distance(a,b){return Math.hypot(Number(b.x)-Number(a.x),Number(b.y)-Number(a.y));}

export function createPetSession(pointerId,x,y,options={}){
  const point={x:Number(x)||0,y:Number(y)||0};
  return {
    pointerId,
    start:{...point},
    last:{...point},
    sample:{...point},
    distance:0,
    totalDistance:0,
    awarded:0,
    bondAwarded:0,
    happinessAwarded:0,
    affectionAwards:0,
    directionChanges:0,
    affectionDirectionChanges:0,
    lastDirection:null,
    heartDistance:0,
    affectionDistance:0,
    heartBursts:0,
    lastHeartAt:0,
    lastAffectionAt:0,
    startedAt:Number(options.now)||Date.now(),
    affectionStartedAt:Number(options.now)||Date.now(),
    lastDelta:null,
    active:true,
    rubMode:Boolean(options.rubMode)
  };
}

export function movePetSession(session,x,y,options={}){
  if(!session?.active)return session;
  const next={x:Number(x)||0,y:Number(y)||0};
  session.lastDelta=null;
  if(options.inside===false){
    session.last=next;
    session.sample=next;
    session.lastDirection=null;
    return session;
  }

  if(!session.rubMode){
    const segment=distance(session.last,next);
    session.distance+=segment;
    session.totalDistance+=segment;
    session.last=next;
    return session;
  }

  const threshold=Math.max(1,Number(options.movementThreshold)||1);
  const segment=distance(session.sample,next);
  session.last=next;
  if(segment<threshold)return session;

  const dx=next.x-session.sample.x,dy=next.y-session.sample.y;
  const length=Math.max(.001,Math.hypot(dx,dy));
  const direction={x:dx/length,y:dy/length};
  if(session.lastDirection){
    const dot=session.lastDirection.x*direction.x+session.lastDirection.y*direction.y;
    if(dot<-.18){session.directionChanges+=1;session.affectionDirectionChanges+=1;}
  }
  session.lastDirection=direction;
  session.sample=next;
  session.distance+=segment;
  session.totalDistance+=segment;
  session.heartDistance+=segment;
  session.affectionDistance+=segment;
  session.lastDelta={x:dx,y:dy};
  return session;
}


export function petHeartBurstForSession(session,config,now=Date.now()){
  if(!session?.active||!session.rubMode||config?.enabled===false)return 0;
  const pulseDistance=Math.max(1,Number(config?.visualHeartDistance)||55);
  const cooldown=Math.max(0,Number(config?.heartCooldownMs)||170);
  if(Number(session.heartDistance||0)<pulseDistance||Number(session.directionChanges||0)<1||now-Number(session.lastHeartAt||0)<cooldown)return 0;
  const maxHearts=Math.max(1,Math.floor(Number(config?.maxHeartBurst)||5));
  const distanceStep=Math.max(pulseDistance,Number(config?.heartEscalationDistance)||145);
  const timeStep=Math.max(100,Number(config?.heartEscalationMs)||650);
  const distanceStage=Math.floor(Math.max(0,Number(session.totalDistance||0)-pulseDistance)/distanceStep);
  const timeStage=Math.floor(Math.max(0,now-Number(session.startedAt||now))/timeStep);
  return Math.max(1,Math.min(maxHearts,1+Math.max(distanceStage,timeStage)));
}

export function consumePetHeartProgress(session,config,now=Date.now()){
  if(!session)return session;
  const pulseDistance=Math.max(1,Number(config?.visualHeartDistance)||55);
  session.heartDistance=Math.max(0,Number(session.heartDistance||0)-pulseDistance);
  session.heartBursts=Math.max(0,Number(session.heartBursts||0))+1;
  session.lastHeartAt=now;
  return session;
}

export function petAffectionRewardForSession(session,config,currentBond,currentHappiness,now=Date.now()){
  if(!session?.active||!session.rubMode||config?.enabled===false)return {bond:0,happiness:0};
  const requiredDistance=Math.max(1,Number(config?.affectionRequiredDistance)||360);
  const requiredChanges=Math.max(1,Math.floor(Number(config?.affectionRequiredDirectionChanges)||4));
  const minimumMs=Math.max(0,Number(config?.affectionMinimumMs)||1300);
  if(Number(session.affectionDistance||0)<requiredDistance||Number(session.affectionDirectionChanges||0)<requiredChanges||now-Number(session.affectionStartedAt||session.startedAt||now)<minimumMs)return {bond:0,happiness:0};
  const bondGain=Math.max(0,Number(config?.bondGain)||0);
  const happinessGain=Math.max(0,Number(config?.affectionHappinessGain)||0);
  const maxSessionBond=Math.max(bondGain,Number(config?.maxSessionBondGain)||bondGain);
  const remainingBond=Math.max(0,maxSessionBond-Number(session.bondAwarded||0));
  return {
    bond:Math.max(0,Math.min(bondGain,Math.max(0,100-Number(currentBond||0)),remainingBond)),
    happiness:Math.max(0,Math.min(happinessGain,Math.max(0,100-Number(currentHappiness||0))))
  };
}

export function consumePetAffectionProgress(session,config,now=Date.now()){
  if(!session)return session;
  const requiredDistance=Math.max(1,Number(config?.affectionRequiredDistance)||360);
  const requiredChanges=Math.max(1,Math.floor(Number(config?.affectionRequiredDirectionChanges)||4));
  session.affectionDistance=Math.max(0,Number(session.affectionDistance||0)-requiredDistance);
  session.affectionDirectionChanges=Math.max(0,Number(session.affectionDirectionChanges||0)-requiredChanges);
  session.affectionStartedAt=now;
  session.lastAffectionAt=now;
  session.affectionAwards=Math.max(0,Number(session.affectionAwards||0))+1;
  return session;
}

export function petRewardForSession(session,config,currentHappiness,lastRewardAt,now=Date.now()){
  if(!session?.active||config?.enabled===false)return 0;

  if(session.rubMode){
    const required=Math.max(1,Number(config?.rewardDistance)||80);
    const minimumDirectionChanges=Math.max(1,Math.floor(Number(config?.minimumDirectionChanges)||1));
    const cooldown=Math.max(0,Number(config?.rewardCooldownMs)||500);
    const gain=Math.max(0,Number(config?.rubHappinessGain??config?.happinessGain)||0);
    const maxSession=Math.max(gain,Number(config?.maxSessionGain)||gain);
    if(session.distance<required||session.directionChanges<minimumDirectionChanges||now-Number(lastRewardAt||0)<cooldown)return 0;
    const room=Math.max(0,100-Number(currentHappiness||0));
    const remaining=Math.max(0,maxSession-Number(session.awarded||0));
    return Math.max(0,Math.min(gain,room,remaining));
  }

  // Backward-compatible distance mode for existing 2.2.2a callers/tests.
  const required=Math.max(1,Number(config?.requiredDistance)||120);
  const cooldown=Math.max(0,Number(config?.cooldownMs)||0);
  const gain=Math.max(0,Number(config?.happinessGain)||0);
  const maxSession=Math.max(gain,Number(config?.maxSessionGain)||gain);
  if(session.distance<required||now-Number(lastRewardAt||0)<cooldown)return 0;
  const room=Math.max(0,100-Number(currentHappiness||0));
  const remaining=Math.max(0,maxSession-Number(session.awarded||0));
  return Math.max(0,Math.min(gain,room,remaining));
}

export function consumePetRewardProgress(session,config){
  if(!session)return session;
  const required=session.rubMode?Math.max(1,Number(config?.rewardDistance)||80):Math.max(1,Number(config?.requiredDistance)||120);
  session.distance=Math.max(0,Number(session.distance||0)-required);
  if(session.rubMode){
    const changes=Math.max(1,Math.floor(Number(config?.minimumDirectionChanges)||1));
    session.directionChanges=Math.max(0,Number(session.directionChanges||0)-changes);
  }
  return session;
}

export function pointInRect(x,y,rect){return x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;}
export function pointInExpandedRect(x,y,rect,padding=0){
  const p=Math.max(0,Number(padding)||0);
  return pointInRect(x,y,{left:rect.left-p,right:rect.right+p,top:rect.top-p,bottom:rect.bottom+p});
}

export function itemEffectLabel(item){
  const e=item?.effects||{},parts=[];
  if(Number(e.hunger))parts.push(`Hunger ${signed(e.hunger)}`);
  if(Number(e.happiness))parts.push(`Glück ${signed(e.happiness)}`);
  if(Number(e.energy))parts.push(`Energie ${signed(e.energy)}`);
  if(Number(e.bond))parts.push(`Bindung ${signed(e.bond)}`);
  return parts.join(' · ')||'Interaktion';
}
function signed(v){const n=Number(v)||0;return `${n>0?'+':''}${n}`;}
