const TITLES={month:'Monat',transactions:'Buchungen',sync:'Synchronisieren',settings:'Einstellungen'};
export function createRouter({onChange}={}) {
  let current='month';
  const scrollPositions=new Map();
  function go(view,{replace=false,fromHash=false}={}){
    if(!TITLES[view]) view='month';
    if(current&&current!==view) scrollPositions.set(current,window.scrollY);
    current=view;
    document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
    document.querySelectorAll('[data-nav]').forEach(el=>{
      const active=el.dataset.nav===view;
      el.classList.toggle('active',active);
      if(active) el.setAttribute('aria-current','page'); else el.removeAttribute('aria-current');
    });
    const title=document.getElementById('headerTitle'); if(title) title.textContent=TITLES[view];
    document.title=`${TITLES[view]} · Benedikt`;
    const hash=`#/${view}`; if(location.hash!==hash&&!fromHash) history[replace?'replaceState':'pushState'](null,'',hash);
    onChange?.(view);
    document.getElementById('appMain')?.focus({preventScroll:true});
    requestAnimationFrame(()=>window.scrollTo({top:scrollPositions.get(view)||0,behavior:'instant'}));
  }
  function fromHash(){ const view=location.hash.replace(/^#\//,''); go(TITLES[view]?view:'month',{replace:true,fromHash:true}); }
  addEventListener('hashchange',fromHash); fromHash(); return {go,get current(){return current;}};
}
