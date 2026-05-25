/**
 * build-www.js — Copia los archivos web al directorio www/ para Capacitor.
 * Ejecutar antes de `npx cap sync`: node scripts/build-www.js
 */
const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT  = path.join(ROOT, 'www');

function copy(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const file of fs.readdirSync(srcDir)) {
    const s = path.join(srcDir, file);
    const d = path.join(destDir, file);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else copy(s, d);
  }
}

// Archivos raíz
for (const f of ['index.html', 'manifest.json', 'sw.js']) {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) { copy(src, path.join(OUT, f)); console.log('✓', f); }
}

// Directorios
for (const dir of ['css', 'js']) {
  const src = path.join(ROOT, dir);
  if (fs.existsSync(src)) { copyDir(src, path.join(OUT, dir)); console.log('✓', dir + '/'); }
}

console.log('\nwww/ actualizado ✓');
