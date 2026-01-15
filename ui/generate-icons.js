import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sizes = [16, 32, 48, 64, 128, 180, 192, 512];
const sourceImage = join(__dirname, 'icon-source.png');
const publicDir = join(__dirname, 'public');

// Create public directory if it doesn't exist
mkdirSync(publicDir, { recursive: true });

async function generateIcons() {
  console.log('Generating icons from:', sourceImage);

  // Generate PNG icons in various sizes
  for (const size of sizes) {
    const outputPath = join(publicDir, `icon-${size}.png`);
    await sharp(sourceImage)
      .resize(size, size, {
        kernel: sharp.kernel.lanczos3,
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(outputPath);
    console.log(`✓ Generated ${size}x${size} PNG`);
  }

  // Generate favicon.ico (multi-size ICO with 16, 32, 48 sizes)
  const icoPath = join(publicDir, 'favicon.ico');
  
  // For ICO, we need to use a library or manual approach
  // Sharp doesn't support ICO directly, so we'll generate the main sizes as PNG
  // and note that a proper ICO conversion would need an additional tool
  
  console.log('\nℹ Note: For a proper .ico file, you may need to use an online converter');
  console.log('  or a tool like "png-to-ico". Using 32x32 PNG as fallback.');
  
  await sharp(sourceImage)
    .resize(32, 32, {
      kernel: sharp.kernel.lanczos3,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(join(publicDir, 'favicon-32x32.png'));

  await sharp(sourceImage)
    .resize(16, 16, {
      kernel: sharp.kernel.lanczos3,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(join(publicDir, 'favicon-16x16.png'));

  // Generate Apple Touch Icon (180x180)
  await sharp(sourceImage)
    .resize(180, 180, {
      kernel: sharp.kernel.lanczos3,
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toFile(join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ Generated apple-touch-icon.png');

  console.log('\n✓ Icon generation complete!');
  console.log('\nGenerated files:');
  console.log('  - favicon-16x16.png, favicon-32x32.png');
  console.log('  - apple-touch-icon.png (180x180)');
  console.log('  - icon-*.png (various sizes for manifest)');
}

generateIcons().catch(console.error);
