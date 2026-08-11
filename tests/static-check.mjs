import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const root=path.resolve(new URL('..',import.meta.url).pathname);const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');const matches=[...sw.matchAll(/'\.\/([^']+)'/g)].map(m=>m[1]).filter(x=>x&&!x.endsWith('/'));
for(const rel of matches)assert.ok(fs.existsSync(path.join(root,rel)),`Service-Worker-Asset fehlt: ${rel}`);
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));for(const icon of manifest.icons)assert.ok(fs.existsSync(path.join(root,icon.src.replace(/^\.\//,''))),`Manifest-Icon fehlt: ${icon.src}`);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');for(const required of ['manifest.webmanifest','apple-mobile-web-app-capable','viewport-fit=cover','assets/vendor/qrcode.min.js','assets/vendor/jsQR.js','js/app.js'])assert.ok(html.includes(required),`index.html fehlt ${required}`);
assert.ok(fs.existsSync(path.join(root,'.github/workflows/pages.yml')),'GitHub-Pages-Workflow fehlt');
const qrService=fs.readFileSync(path.join(root,'js/services/qr.js'),'utf8');for(const required of ['getUserMedia','jsQR','decodeQrImageFile'])assert.ok(qrService.includes(required),`QR-Service fehlt ${required}`);
console.log(`Static check OK: ${matches.length} precached assets, ${manifest.icons.length} manifest icons, Safari QR fallback present.`);
