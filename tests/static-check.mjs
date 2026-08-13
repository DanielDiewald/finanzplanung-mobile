import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const matches = [...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]).filter(x => x && !x.endsWith('/'));
for (const rel of matches) assert.ok(fs.existsSync(path.join(root, rel)), `Service-Worker-Asset fehlt: ${rel}`);

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const required of ['apple-mobile-web-app-capable','viewport-fit=cover','assets/vendor/qrcode.min.js','assets/vendor/jsQR.js','js/app.js']) {
  assert.ok(html.includes(required), `index.html fehlt ${required}`);
}
const manifestHref = html.match(/<link[^>]+rel=["']manifest["'][^>]+href=["']([^"']+)["']/i)?.[1]
  || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']manifest["']/i)?.[1];
assert.ok(manifestHref, 'index.html hat kein verlinktes Web-App-Manifest');
const manifestRel = manifestHref.replace(/^\.\//, '');
const manifestPath = path.join(root, manifestRel);
assert.ok(fs.existsSync(manifestPath), `Verlinktes Manifest fehlt: ${manifestHref}`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const manifestDir = path.dirname(manifestPath);
for (const icon of manifest.icons || []) {
  assert.ok(!String(icon.src).startsWith('/'), `Manifest-Icon muss fuer GitHub Pages relativ sein: ${icon.src}`);
  const iconPath = path.resolve(manifestDir, icon.src);
  assert.ok(fs.existsSync(iconPath), `Manifest-Icon fehlt: ${icon.src}`);
  const relToRoot = path.relative(root, iconPath).replaceAll(path.sep, '/');
  assert.ok(sw.includes(`'./${relToRoot}'`), `Manifest-Icon ist nicht im Service-Worker-Cache: ${relToRoot}`);
}
assert.ok(fs.existsSync(path.join(root,'.github/workflows/pages.yml')), 'GitHub-Pages-Workflow fehlt');
const qrService = fs.readFileSync(path.join(root,'js/services/qr.js'),'utf8');
for (const required of ['getUserMedia','jsQR','decodeQrImageFile']) assert.ok(qrService.includes(required), `QR-Service fehlt ${required}`);
console.log(`Static check OK: ${matches.length} precached assets, ${(manifest.icons || []).length} linked manifest icons, Safari QR fallback present.`);
