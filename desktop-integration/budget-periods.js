(() => {
  'use strict';

  const MONTH_PATTERN = /^\d{4}-\d{2}$/;

  function monthParts(ym) {
    if (!MONTH_PATTERN.test(String(ym || ''))) return null;
    const [year, month] = String(ym).split('-').map(Number);
    if (!Number.isInteger(year) || month < 1 || month > 12) return null;
    return { year, month };
  }

  function daysInMonth(ym) {
    const parts = monthParts(ym);
    return parts ? new Date(parts.year, parts.month, 0).getDate() : 0;
  }

  function weeksStartingInMonth(ym) {
    const parts = monthParts(ym);
    if (!parts) return 0;
    const days = new Date(parts.year, parts.month, 0).getDate();
    let count = 0;
    for (let day = 1; day <= days; day++) {
      if (new Date(parts.year, parts.month - 1, day).getDay() === 1) count++;
    }
    return count;
  }

  function monthlyAmount(amount, interval, ym) {
    const value = Math.max(0, Number(amount) || 0);
    if (interval === 'daily') return value * daysInMonth(ym);
    if (interval === 'weekly') return value * weeksStartingInMonth(ym);
    return value;
  }

  globalThis.CapytBudgetPeriods = Object.freeze({ daysInMonth, weeksStartingInMonth, monthlyAmount });
})();
