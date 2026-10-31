// Copies the web app into www/ (Capacitor web dir). sw.js is skipped: the APK already bundles the assets.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = path.join(root, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'icons'), { recursive: true });
['index.html', 'style.css', 'engine.js', 'app.js', 'manifest.webmanifest'].forEach((f) => fs.copyFileSync(path.join(root, f), path.join(out, f)));
fs.readdirSync(path.join(root, 'icons')).forEach((f) => fs.copyFileSync(path.join(root, 'icons', f), path.join(out, 'icons', f)));
console.log('www ready');
