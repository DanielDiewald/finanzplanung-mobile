const TITLES={month:'Monat',transactions:'Buchungen',sync:'Synchronisieren',settings:'Einstellungen'};
export function createRouter({onChange}={}) {
  let current='month';
  function go(view,{replace=false}={}){
    if(!TITLES[view]) view='month'; current=view;
    document.querySelectorAll('.view').forEach(el=>el.classList.toggle('active',el.dataset.view===view));
    document.querySelectorAll('[data-nav]').forEach(el=>el.classList.toggle('active',el.dataset.nav===view));
    const title=document.getElementById('headerTitle'); if(title) title.textContent=TITLES[view];
    const hash=`#/${view}`; if(location.hash!==hash) history[replace?'replaceState':'pushState'](null,'',hash);
    onChange?.(view); document.getElementById('appMain')?.focus({preventScroll:true}); window.scrollTo({top:0,behavior:'instant'});
  }
  function fromHash(){ const view=location.hash.replace(/^#\//,''); go(TITLES[view]?view:'month',{replace:true}); }
  addEventListener('hashchange',fromHash); fromHash(); return {go,get current(){return current;}};
}
