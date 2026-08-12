import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const css = fs.readFileSync(path.join(root, 'css/desktop.css'), 'utf8');

function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `CSS-Regel fehlt: ${selector}`);
  return match[1];
}

test('Monats-Donut ist kein seitenuebergreifendes Sticky-Element', () => {
  const allocationRule = rule('.month-allocation-panel');
  assert.match(allocationRule, /position\s*:\s*static\s*;/);
  assert.doesNotMatch(allocationRule, /position\s*:\s*sticky\s*;/);
});

test('Donut-Layout bricht anhand der verfuegbaren Containerbreite um', () => {
  const donutRule = rule('.donut-layout');
  assert.match(donutRule, /repeat\s*\(\s*auto-fit\s*,\s*minmax\s*\(\s*min\s*\(\s*260px\s*,\s*100%\s*\)\s*,\s*1fr\s*\)\s*\)/);
  assert.doesNotMatch(donutRule, /grid-template-columns\s*:\s*minmax\s*\(\s*260px[^;]*minmax\s*\(\s*260px/);
});

test('Donut-Kinder duerfen innerhalb der Grid-Spalte schrumpfen', () => {
  assert.match(rule('.donut-layout > *'), /min-width\s*:\s*0\s*;/);
});
