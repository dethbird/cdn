import pngToIco from 'png-to-ico';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const publicDir = join(__dirname, 'public');

async function generateIco() {
  console.log('Generating favicon.ico...');
  
  const buf = await pngToIco([
    join(publicDir, 'icon-16.png'),
    join(publicDir, 'icon-32.png'),
    join(publicDir, 'icon-48.png')
  ]);
  
  writeFileSync(join(publicDir, 'favicon.ico'), buf);
  console.log('✓ Generated favicon.ico');
}

generateIco().catch(console.error);
