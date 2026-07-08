const { Jimp } = require('jimp');

async function analyze(filePath) {
  const image = await Jimp.read(filePath);
  const width = image.bitmap.width;
  const height = image.bitmap.height;

  const colorMap = new Map();
  const step = Math.max(1, Math.floor((width * height) / 5000));

  for (let i = 0; i < width * height; i += step) {
    const x = i % width;
    const y = Math.floor(i / width);
    const color = Jimp.intToRGBA(image.getPixelColor(x, y));
    const r = Math.round(color.r / 20) * 20;
    const g = Math.round(color.g / 20) * 20;
    const b = Math.round(color.b / 20) * 20;
    const key = r + ',' + g + ',' + b;
    colorMap.set(key, (colorMap.get(key) || 0) + 1);
  }

  const sorted = [...colorMap.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 15);

  const parts = filePath.replace(/\\/g, '/').split('/');
  const fname = parts[parts.length - 1];
  console.log('=== ' + fname + ' ===');
  top.forEach(([key, count]) => {
    const [r, g, b] = key.split(',').map(Number);
    const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    console.log('  ' + hex + ' (' + r + ',' + g + ',' + b + ') - ' + count);
  });
  console.log('');
}

async function main() {
  const dir = 'c:/Users/lingy/Desktop/夏以昼/字卡APP素材';
  const files = [
    dir + '/0e95b5ae970c3912f9dd0cc0c44e207d.jpg',
    dir + '/23d5d575780c0d471a99746a2fd366b1.jpg',
    dir + '/ede2f363718b86b4c20689b18368e7b6.jpg'
  ];
  for (const f of files) {
    await analyze(f);
  }
}

main().catch(e => console.error(e));
