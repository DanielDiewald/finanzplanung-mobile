import { getCurrentPlan, listTransactions, saveTransaction } from '../../js/services/storage.js';
import { todayLocal, uuid } from '../../js/utils.js';

export async function loadFinanceContext(){const plan=await getCurrentPlan();const transactions=plan?await listTransactions({planId:plan.planId}):[];return {plan,transactions};}
export function capyBudget(plan){if(!plan?.capy)return null;const id=String(plan.capy.budgetId||'');return (plan.budgets||[]).find(b=>String(b.id)===id)||null;}
export function stashBalanceCents(plan,transactions=[]){const budget=capyBudget(plan);if(!budget)return 0;const pending=(transactions||[]).filter(t=>!t.deleted&&t.status!=='confirmed'&&t.status!=='rejected'&&t.planId===plan.planId&&t.kind==='capy_stash_deposit'&&t.budgetId===budget.id).reduce((sum,t)=>sum+(Number(t.amountCents)||0),0);return Math.max(0,(Number(budget.availableCents)||0)+pending);}
export async function createStashDeposit({plan,amountCents,name,coinReward=0}){
  if(!plan?.capy?.budgetId)throw new Error('Das Capy-Vorratsbudget fehlt im synchronisierten Plan.');
  const budget=capyBudget(plan);if(!budget)throw new Error('Das Capy-Vorratsbudget fehlt im synchronisierten Plan.');
  const today=todayLocal(),date=today.startsWith(`${plan.month}-`)?today:`${plan.month}-01`,now=new Date().toISOString();
  const label=globalThis.CapytCapyNaming?.budgetName(name);if(!label)throw new Error('Capy-Namenslogik konnte nicht geladen werden.');
  const tx={id:`capy_tx_${uuid()}`,recordRevision:1,planId:plan.planId,basePlanRevision:plan.revision,createdAt:now,updatedAt:now,date,month:date.slice(0,7),kind:'capy_stash_deposit',amountCents:Number(amountCents),budgetId:budget.id,category:'Capy Vorrat',description:`${label} aufgeladen`,note:'Coins durch Vorrat-Aufladung',capyCoinReward:Math.max(0,Math.floor(Number(coinReward)||0)),status:'local',preparedExportIds:[],everPrepared:false,confirmedAt:null,rejectionReason:'',deleted:false};
  await saveTransaction(tx);return tx;
}
