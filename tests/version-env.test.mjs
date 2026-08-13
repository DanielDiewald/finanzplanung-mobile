import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const env = fs.readFileSync(new URL('.env', root), 'utf8');
const version = env.match(/^\s*APP_VERSION\s*=\s*([^\s#]+)/m)?.[1]?.replace(/^['"]|['"]$/g, '');
assert.ok(version, 'APP_VERSION fehlt in .env');
const esc = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

test('APP_VERSION aus .env ist mit allen Runtime-Versionsstellen synchron', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('package.json', root), 'utf8'));
  const versionJson = JSON.parse(fs.readFileSync(new URL('version.json', root), 'utf8'));
  const utils = fs.readFileSync(new URL('js/utils.js', root), 'utf8');
  const sw = fs.readFileSync(new URL('sw.js', root), 'utf8');
  const html = fs.readFileSync(new URL('index.html', root), 'utf8');
  assert.equal(pkg.version, version);
  assert.equal(versionJson.version, version);
  assert.match(utils, new RegExp(`APP_VERSION = '${esc(version)}'`));
  assert.match(sw, new RegExp(`const VERSION='${esc(version)}'`));
  assert.match(html, new RegExp(`content="${esc(version)}"`));
  assert.match(html, new RegExp(`pwa-update\\.js\\?v=${esc(version)}-pwa1`));
});

test('GitHub Pages synchronisiert die Version vor Tests und Deployment', () => {
  const workflow = fs.readFileSync(new URL('.github/workflows/pages.yml', root), 'utf8');
  assert.match(workflow, /npm run version:sync/);
});
