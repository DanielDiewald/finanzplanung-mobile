import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const month = fs.readFileSync(path.join(root, 'js/views/month.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js/app.js'), 'utf8');
const storage = fs.readFileSync(path.join(root, 'js/services/storage.js'), 'utf8');
const buffer = fs.readFileSync(path.join(root, 'js/services/buffer-status.js'), 'utf8');

const assets = ['vault-0.webp','vault-almost-empty.webp','vault-10.webp','vault-25.webp','vault-50.webp','vault-75.webp','vault-100.webp'];

test('Mobile bietet Finanzlage und Geldverwendung als getrennte Monatsansichten', () => {
  for (const required of ['data-month-visual="buffer"', 'data-month-visual="donut"', 'id="bufferVisualView"', 'id="donutVisualView"', 'id="vaultImage"']) {
    assert.ok(html.includes(required), `Mobile UI fehlt ${required}`);
  }
  assert.ok(month.includes("visualMode = 'buffer'"));
  assert.ok(month.includes("if (activeVisualMode === 'donut')"));
});

test('Mobile-Tresor verwendet alle sieben optimierten Bildstufen', () => {
  for (const asset of assets) {
    assert.ok(buffer.includes(asset), `Tresorlogik fehlt ${asset}`);
    assert.ok(fs.existsSync(path.join(root, 'assets/vault', asset)), `Asset fehlt ${asset}`);
  }
});

test('Gewaehlte Monatsvisualisierung wird in den mobilen Einstellungen gespeichert', () => {
  assert.ok(storage.includes("selectedMonthVisualMode:'buffer'"));
  assert.ok(storage.includes("['buffer','donut'].includes(settings.selectedMonthVisualMode)"));
  assert.ok(app.includes("saveSettings({selectedMonthVisualMode:state.monthVisualMode})"));
});
