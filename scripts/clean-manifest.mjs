import { readFileSync, writeFileSync } from 'fs';

const manifestPath = 'dist/manifest.webmanifest';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
delete manifest.theme_color;
delete manifest.background_color;
writeFileSync(manifestPath, JSON.stringify(manifest));
console.log('  ✅ cleaned theme_color & background_color from manifest');
