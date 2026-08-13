import { getCurrentPlan, listTransactions, saveTransaction } from '../../js/services/storage.js';
import { todayLocal, uuid } from '../../js/utils.js';

export async function loadFinanceContext(){
  const plan=await getCurrentPlan();
  const transactions=plan?await listTransactions({planId:plan.planId}):[];
  return {plan,transactions};
}

export function capyBudget(plan){
  if(!plan?.capy?.enabled)return null;
  const id=String(plan.capy.budgetId||'');
  return (plan.budgets||[]).find(b=>String(b.id)===id)||null;
}

export function stashBalanceCents(plan,transactions=[]){
  const budget=capyBudget(plan);
  if(!budget)return 0;
  const pending=(transactions||[]).filter(t=>!t.deleted&&t.status!=='confirmed'&&t.planId===plan.planId&&t.kind==='capy_stash_deposit'&&t.budgetId===budget.id).reduce((sum,t)=>sum+(Number(t.amountCents)||0),0);
  return Math.max(0,(Number(budget.availableCents)||0)+pending);
}

export async function createStashDeposit({plan,amountCents,name}){
  if(!plan?.capy?.enabled)throw new Error('Capy ist in diesem Plan nicht aktiviert.');
  const budget=capyBudget(plan);
  if(!budget)throw new Error('Das Capy-Vorratsbudget fehlt im synchronisierten Plan.');
  const today=todayLocal();
  const date=today.startsWith(`${plan.month}-`)?today:`${plan.month}-01`;
  const now=new Date().toISOString();
  const tx={
    id:uuid(),recordRevision:1,planId:plan.planId,basePlanRevision:plan.revision,createdAt:now,updatedAt:now,date,month:date.slice(0,7),
    kind:'capy_stash_deposit',amountCents:Number(amountCents),budgetId:budget.id,category:'Capy Vorrat',description:`${name||'Capy'} Vorrat aufgeladen`,note:'Coins durch Vorrat-Aufladung',
    status:'local',preparedExportIds:[],everPrepared:false,confirmedAt:null,deleted:false
  };
  await saveTransaction(tx);
  return tx;
}
