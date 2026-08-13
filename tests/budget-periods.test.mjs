import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('../desktop-integration/budget-periods.js', import.meta.url), 'utf8');
const ctx = { Date, Math, Number, Object };
ctx.globalThis = ctx;
vm.runInNewContext(source, ctx, { filename: 'budget-periods.js' });
const periods = ctx.CapytBudgetPeriods;

test('Tagesbudgets verwenden die echte Anzahl Kalendertage des Monats', () => {
  assert.equal(periods.daysInMonth('2026-08'), 31);
  assert.equal(periods.daysInMonth('2026-09'), 30);
  assert.equal(periods.daysInMonth('2028-02'), 29);
  assert.equal(periods.monthlyAmount(10, 'daily', '2026-08'), 310);
});

test('Wochenbudgets zählen Wochen, die im Monat beginnen (Montag)', () => {
  assert.equal(periods.weeksStartingInMonth('2026-08'), 5);
  assert.equal(periods.weeksStartingInMonth('2026-09'), 4);
  assert.equal(periods.monthlyAmount(50, 'weekly', '2026-08'), 250);
  assert.equal(periods.monthlyAmount(50, 'weekly', '2026-09'), 200);
});

test('Ungültige Monate erzeugen keinen Budgetbetrag', () => {
  assert.equal(periods.daysInMonth('2026-13'), 0);
  assert.equal(periods.weeksStartingInMonth('foo'), 0);
  assert.equal(periods.monthlyAmount(20, 'daily', 'foo'), 0);
});
