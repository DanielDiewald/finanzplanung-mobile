(() => {
  'use strict';
  function cleanName(value){return String(value||'').trim().slice(0,20)||'Capy';}
  function budgetName(value){return `${cleanName(value)}'s Vorrat`;}
  function legacyBudgetName(value){return `${cleanName(value)} Vorrat`;}
  globalThis.CapytCapyNaming=Object.freeze({cleanName,budgetName,legacyBudgetName});
})();
