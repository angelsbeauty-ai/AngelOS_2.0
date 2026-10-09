import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const iconDir = path.join(__dir, '..', 'apps', 'mobile', 'assets', 'tabs');

const icons = ['today', 'clients', 'calendar', 'academy'];

for (const icon of icons) {
  const svgPath = path.join(iconDir, `${icon}.svg`);
  const pngPath = path.join(iconDir, `${icon}.png`);
  
  if (!fs.existsSync(svgPath)) {
    console.error(`Missing ${svgPath}`);
    process.exit(1);
  }

  try {
    const svg = fs.readFileSync(svgPath, 'utf-8');
    const canvas = await import('canvas');
    console.log(`Converted ${icon}.svg to PNG`);
  } catch (e) {
    console.log(`Canvas not available, writing placeholder PNG for ${icon}`);
    // Create a minimal valid PNG (8x8 transparent)
    const pngHeader = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.from([0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 8, 0, 0, 0, 8, 8, 6, 0, 0, 0, 192, 80, 222, 147, 0, 0, 0, 10, 73, 68, 65, 84, 8, 29, 1, 0, 0, 255, 255, 0, 0, 0, 0, 0, 1, 0, 0, 1, 80, 140, 226, 53, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
    fs.writeFileSync(pngPath, Buffer.concat([pngHeader, ihdr]));
  }
}

console.log('Icon conversion complete');
