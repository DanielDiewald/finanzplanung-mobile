export const APP_VERSION = '2.2.8b';
export const DB_NAME = 'finanzplanung-mobile';
export const DB_VERSION = 1;
export const INCOME_CATEGORIES = ['Bonus','Prämie','Provision','Rückerstattung','Nebenverdienst','Geldgeschenk','Sonstiges'];
export const EXPENSE_CATEGORIES = ['Unerwartet','Freizeit','Einkauf','Reparatur','Sonstiges'];
export const DONUT_COLORS = {
  fixed:'var(--chart-fixed)', periodic:'var(--chart-periodic)', loans:'var(--chart-loans)', extra:'var(--chart-extra)', overspend:'var(--chart-overspend)',
  reserves:'var(--chart-reserves)', savings:'var(--chart-savings)', goals:'var(--chart-goals)', budgetSpent:'var(--chart-budget-spent)', goalSpent:'var(--chart-goal-spent)',
  available1:'var(--chart-available-1)', available2:'var(--chart-available-2)', available3:'var(--chart-available-3)', available4:'var(--chart-available-4)', available5:'var(--chart-available-5)', available6:'var(--chart-available-6)'
};

const eur = new Intl.NumberFormat('de-AT', { style:'currency', currency:'EUR' });
const dateFmt = new Intl.DateTimeFormat('de-AT');
const dateTimeFmt = new Intl.DateTimeFormat('de-AT', { dateStyle:'short', timeStyle:'short' });
const monthFmt = new Intl.DateTimeFormat('de-AT', { month:'long', year:'numeric' });

export function formatCents(cents) { return eur.format((Number(cents) || 0) / 100); }
export function formatSignedCents(cents) { const n = Number(cents) || 0; return `${n > 0 ? '+' : ''}${formatCents(n)}`; }
export function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '–';
  const [y,m,d] = String(value).split('-').map(Number); return dateFmt.format(new Date(y,m-1,d));
}
export function formatDateTime(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? '–' : dateTimeFmt.format(d); }
export function formatMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(String(value || ''))) return '–';
  const [y,m] = String(value).split('-').map(Number); return monthFmt.format(new Date(y,m-1,1));
}
export function todayLocal(date = new Date()) {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0'), d = String(date.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}
export function monthOfDate(dateString) { return /^\d{4}-\d{2}-\d{2}$/.test(String(dateString || '')) ? String(dateString).slice(0,7) : ''; }

export function parseEuroToCents(value) {
  const raw = String(value ?? '').trim().replace(/\s/g,'');
  if (!raw) return null;
  let normalized = raw;
  if (raw.includes(',') && raw.includes('.')) normalized = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g,'').replace(',','.') : raw.replace(/,/g,'');
  else if (raw.includes(',')) normalized = raw.replace(',','.');
  if (!/^[-+]?\d+(?:\.\d{0,2})?$/.test(normalized)) return null;
  const sign = normalized.startsWith('-') ? -1 : 1;
  const unsigned = normalized.replace(/^[-+]/,'');
  const [whole, frac=''] = unsigned.split('.');
  const cents = Number(whole) * 100 + Number((frac + '00').slice(0,2));
  return Number.isSafeInteger(cents) ? sign * cents : null;
}
export function centsToInput(cents) { return ((Number(cents) || 0) / 100).toFixed(2).replace('.', ','); }
export function clampInt(value, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
  const n = Number(value); if (!Number.isSafeInteger(n)) return null; return Math.min(max, Math.max(min, n));
}
export function safeCents(value, { allowNegative = true } = {}) {
  const n = Number(value); if (!Number.isSafeInteger(n)) throw new Error('Ungültiger Geldbetrag.');
  if (!allowNegative && n < 0) throw new Error('Geldbetrag darf nicht negativ sein.'); return n;
}
export function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const a = new Uint8Array(16); globalThis.crypto?.getRandomValues?.(a);
  a[6] = (a[6] & 0x0f) | 0x40; a[8] = (a[8] & 0x3f) | 0x80;
  return [...a].map((b,i)=>([4,6,8,10].includes(i)?'-':'')+b.toString(16).padStart(2,'0')).join('');
}
export function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch])); }
export function sum(values) { return values.reduce((s,v)=>s+(Number(v)||0),0); }
export function percent(part,total) { return total > 0 ? (part/total)*100 : 0; }
export function deepClone(value) { return globalThis.structuredClone ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
export function downloadText(filename, text, type='application/json') {
  const blob = new Blob([text], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function setHidden(el, hidden) { if (el) el.classList.toggle('hidden', Boolean(hidden)); }
export function debounce(fn, delay=180) { let t; return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args),delay); }; }
export function localMonth() { return todayLocal().slice(0,7); }
export function stableColor(index) { const colors = [DONUT_COLORS.available1,DONUT_COLORS.available2,DONUT_COLORS.available3,DONUT_COLORS.available4,DONUT_COLORS.available5,DONUT_COLORS.available6]; return colors[index % colors.length]; }
export function cssEscape(value) { return globalThis.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g,'\\$&'); }
