export function distance(a,b){return Math.hypot(Number(b.x)-Number(a.x),Number(b.y)-Number(a.y));}
export function createPetSession(pointerId,x,y){return {pointerId,start:{x,y},last:{x,y},distance:0,awarded:0,active:true};}
export function movePetSession(session,x,y){if(!session?.active)return session;const next={x,y};session.distance+=distance(session.last,next);session.last=next;return session;}
export function petRewardForSession(session,config,currentHappiness,lastRewardAt,now=Date.now()){
  if(!session?.active||config?.enabled===false)return 0;const required=Math.max(1,Number(config?.requiredDistance)||120),cooldown=Math.max(0,Number(config?.cooldownMs)||0),gain=Math.max(0,Number(config?.happinessGain)||0),maxSession=Math.max(gain,Number(config?.maxSessionGain)||gain);
  if(session.distance<required||now-Number(lastRewardAt||0)<cooldown)return 0;const room=Math.max(0,100-Number(currentHappiness||0)),remaining=Math.max(0,maxSession-Number(session.awarded||0));return Math.max(0,Math.min(gain,room,remaining));
}
export function pointInRect(x,y,rect){return x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;}
export function itemEffectLabel(item){const e=item?.effects||{};const parts=[];if(Number(e.hunger))parts.push(`Hunger ${signed(e.hunger)}`);if(Number(e.happiness))parts.push(`Glück ${signed(e.happiness)}`);if(Number(e.energy))parts.push(`Energie ${signed(e.energy)}`);if(Number(e.bond))parts.push(`Bindung ${signed(e.bond)}`);return parts.join(' · ')||'Interaktion';}
function signed(v){const n=Number(v)||0;return `${n>0?'+':''}${n}`;}
