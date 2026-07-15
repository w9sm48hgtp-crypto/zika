import sharp from 'sharp';
import { readdir, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const SRC = '../字卡app素材';
const OUT = 'public/decorations';

async function main() {
  const files = (await readdir(SRC)).filter(f => f.endsWith('.png')).sort();
  await mkdir(OUT, { recursive: true });

  for (const file of files) {
    const srcPath = join(SRC, file);
    const outPath = join(OUT, file);

    const input = await sharp(srcPath);
    await input
      .resize({ width: 400, withoutEnlargement: true })
      .png({ compressionLevel: 9, quality: 85, palette: true })
      .toFile(outPath);

    const meta = await sharp(srcPath).metadata();
    const { size: outSize } = await sharp(outPath).metadata();
    const pct = outSize ? ((1 - outSize / meta.size) * 100).toFixed(0) : '?';
    console.log(`${file}: ${(meta.size/1024).toFixed(0)}KB → ${(outSize/1024).toFixed(0)}KB (${pct}% smaller)`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
