import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const html = fs.readFileSync(path.join(root, 'desktop-integration/Finanzplanung_v10_mobile-sync.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/desktop.css'), 'utf8');

test('Desktop bietet Finanzlage und Geldverwendung als getrennte Ansichten', () => {
  assert.ok(html.includes('data-month-visual-mode="buffer"'));
  assert.ok(html.includes('data-month-visual-mode="donut"'));
  assert.ok(html.includes('id="monthVaultView"'));
  assert.ok(html.includes('id="monthDonutView"'));
  assert.ok(html.includes('const MONTH_VISUAL_MODES = new Set(["buffer", "donut"])'));
  assert.ok(html.includes('monthVisualMode: "donut"'));
});

test('Desktop-Tresor verwendet alle sieben Fuellstufen', () => {
  for (const asset of ['vault-0.webp','vault-almost-empty.webp','vault-10.webp','vault-25.webp','vault-50.webp','vault-75.webp','vault-100.webp']) {
    assert.ok(html.includes(asset), `Desktop-Logik fehlt ${asset}`);
    assert.ok(fs.existsSync(path.join(root, 'assets/vault', asset)), `Asset fehlt ${asset}`);
  }
  assert.ok(css.includes('.month-vault-view'));
  assert.ok(css.includes('.month-vault-image'));
});
