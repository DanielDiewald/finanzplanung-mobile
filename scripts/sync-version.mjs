import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const envPath = path.join(root, '.env');
const envText = fs.readFileSync(envPath, 'utf8');
const match = envText.match(/^\s*APP_VERSION\s*=\s*["']?([^\s"'#]+)["']?\s*(?:#.*)?$/m);
if (!match) throw new Error('APP_VERSION fehlt in .env.');
const version = match[1].trim();
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[a-z]|-[0-9A-Za-z][0-9A-Za-z.-]*)?$/;
if (!VERSION_PATTERN.test(version)) throw new Error(`Ungültige APP_VERSION in .env: ${version}`);

function updateText(rel, transform) {
  const file = path.join(root, rel);
  const before = fs.readFileSync(file, 'utf8');
  const after = transform(before);
  if (after === before) return false;
  if (checkOnly) throw new Error(`${rel} ist nicht mit APP_VERSION=${version} synchron. Führe npm run version:sync aus.`);
  fs.writeFileSync(file, after);
  return true;
}

function replaceRequired(text, regex, replacement, label) {
  if (!regex.test(text)) throw new Error(`Versionsstelle nicht gefunden: ${label}`);
  regex.lastIndex = 0;
  return text.replace(regex, replacement);
}

const changed = [];
if (updateText('js/utils.js', text => replaceRequired(text, /export const APP_VERSION = '[^']+';/, `export const APP_VERSION = '${version}';`, 'js/utils.js'))) changed.push('js/utils.js');
if (updateText('sw.js', text => replaceRequired(text, /const VERSION='[^']+';/, `const VERSION='${version}';`, 'sw.js'))) changed.push('sw.js');
if (updateText('index.html', text => {
  let out = replaceRequired(text, /(name="capyt-version"\s*\n?\s*content=")[^"]+("\s*\/?>)/, `$1${version}$2`, 'index meta');
  out = replaceRequired(out, /(\.\/js\/pwa-update\.js\?v=)[^"&]+/, `$1${version}-pwa1`, 'index pwa updater');
  return out;
})) changed.push('index.html');

const versionJson = `${JSON.stringify({ version }, null, 2)}\n`;
const versionJsonPath = path.join(root, 'version.json');
const currentVersionJson = fs.readFileSync(versionJsonPath, 'utf8');
if (currentVersionJson !== versionJson) {
  if (checkOnly) throw new Error(`version.json ist nicht mit APP_VERSION=${version} synchron. Führe npm run version:sync aus.`);
  fs.writeFileSync(versionJsonPath, versionJson);
  changed.push('version.json');
}

const packagePath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
if (pkg.version !== version) {
  if (checkOnly) throw new Error(`package.json ist nicht mit APP_VERSION=${version} synchron. Führe npm run version:sync aus.`);
  pkg.version = version;
  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  changed.push('package.json');
}

if (!checkOnly) console.log(changed.length ? `Version ${version} synchronisiert: ${changed.join(', ')}` : `Version ${version} ist bereits synchron.`);
