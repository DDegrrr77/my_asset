import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';

function makeRGBA(r: number, g: number, b: number, a: number): number {
  return (((r & 0xFF) << 24) | ((g & 0xFF) << 16) | ((b & 0xFF) << 8) | (a & 0xFF)) >>> 0;
}

// Generates a beautiful procedurally rendered 3D snowball compound icon
async function generateBeautifulFallbackIcon(): Promise<any> {
  console.log('Generating beautiful custom compound snowball icon procedurally...');
  const size = 512;
  const image = new Jimp({ width: size, height: size, color: 0x111827ff }); // Deep Navy background

  // 1. Draw Background Ambient Glow
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - 256;
      const dy = y - 256;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 256) {
        const t = dist / 256;
        const r = Math.round(17 * t + (1 - t) * 30);
        const g = Math.round(24 * t + (1 - t) * 41);
        const b = Math.round(39 * t + (1 - t) * 59);
        const color = makeRGBA(r, g, b, 0xFF);
        image.setPixelColor(color, x, y);
      }
    }
  }

  // Helper to draw a 3D Shaded Sphere (Snowball)
  function drawSphere(cx: number, cy: number, radius: number, lightX: number, lightY: number, baseR: number, baseG: number, baseB: number) {
    for (let y = Math.max(0, cy - radius); y < Math.min(size, cy + radius); y++) {
      for (let x = Math.max(0, cx - radius); x < Math.min(size, cx + radius); x++) {
        const dx = x - cx;
        const dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
          const nx = dx / radius;
          const ny = dy / radius;
          const nz = Math.sqrt(1 - nx*nx - ny*ny);

          const ldx = lightX - cx;
          const ldy = lightY - cy;
          const ldlen = Math.sqrt(ldx*ldx + ldy*ldy + radius*radius);
          const lx = ldx / ldlen;
          const ly = ldy / ldlen;
          const lz = radius / ldlen;

          const dot = Math.max(0, nx*lx + ny*ly + nz*lz);
          const rx = 2 * dot * nx - lx;
          const ry = 2 * dot * ny - ly;
          const rz = 2 * dot * nz - lz;
          const spec = Math.pow(Math.max(0, rz), 20);

          const ambient = 0.25;
          const shade = ambient + 0.75 * dot;
          
          let rComp = Math.round(baseR * shade + spec * 255);
          let gComp = Math.round(baseG * shade + spec * 255);
          let bComp = Math.round(baseB * shade + spec * 255);

          rComp = Math.min(255, Math.max(0, rComp));
          gComp = Math.min(255, Math.max(0, gComp));
          bComp = Math.min(255, Math.max(0, bComp));

          const alphaDist = radius - dist;
          let alpha = 255;
          if (alphaDist < 1.5) {
            alpha = Math.round(255 * (alphaDist / 1.5));
          }

          if (alpha > 0) {
            const currentColor = image.getPixelColor(x, y);
            const currR = (currentColor >> 24) & 0xFF;
            const currG = (currentColor >> 16) & 0xFF;
            const currB = (currentColor >> 8) & 0xFF;
            
            const f = alpha / 255;
            const finalR = Math.round(rComp * f + currR * (1 - f));
            const finalG = Math.round(gComp * f + currG * (1 - f));
            const finalB = Math.round(bComp * f + currB * (1 - f));
            
            const color = makeRGBA(finalR, finalG, finalB, 0xFF);
            image.setPixelColor(color, x, y);
          }
        }
      }
    }
  }

  // 2. Draw our main compound snowballs
  drawSphere(256, 260, 120, 200, 200, 219, 234, 254);
  drawSphere(350, 180, 55, 320, 150, 191, 219, 254);
  drawSphere(160, 330, 40, 140, 310, 191, 219, 254);

  // 3. Draw golden compounding growth path
  for (let t = 0; t <= 1.0; t += 0.001) {
    const p0 = { x: 100, y: 390 };
    const p1 = { x: 260, y: 340 };
    const p2 = { x: 400, y: 120 };

    const x = Math.round((1-t)*(1-t)*p0.x + 2*(1-t)*t*p1.x + t*t*p2.x);
    const y = Math.round((1-t)*(1-t)*p0.y + 2*(1-t)*t*p1.y + t*t*p2.y);

    const thickness = 5;
    for (let dy = -thickness; dy <= thickness; dy++) {
      for (let dx = -thickness; dx <= thickness; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        const dScore = Math.sqrt(dx*dx + dy*dy);
        if (dScore <= thickness && nx >= 0 && nx < size && ny >= 0 && ny < size) {
          const glow = 1.0 - (dScore / thickness);
          const rG = Math.round(251 * glow + 245 * (1 - glow));
          const gG = Math.round(191 * glow + 158 * (1 - glow));
          const bG = Math.round(36 * glow + 11 * (1 - glow));

          const currentColor = image.getPixelColor(nx, ny);
          const currR = (currentColor >> 24) & 0xFF;
          const currG = (currentColor >> 16) & 0xFF;
          const currB = (currentColor >> 8) & 0xFF;

          const f = glow * 0.8;
          const finalR = Math.round(rG * f + currR * (1 - f));
          const finalG = Math.round(gG * f + currG * (1 - f));
          const finalB = Math.round(bG * f + currB * (1 - f));

          const color = makeRGBA(finalR, finalG, finalB, 0xFF);
          image.setPixelColor(color, nx, ny);
        }
      }
    }
  }

  return image;
}

async function resize() {
  try {
    const publicDir = 'public';
    const files = fs.readdirSync(publicDir);
    
    // Find any custom uploaded .png files (excluding icon, icon-192, icon-512)
    const candidates = files.filter(f => {
      const lower = f.toLowerCase();
      return lower.endsWith('.png') && 
             f !== 'icon.png' && 
             f !== 'icon-192.png' && 
             f !== 'icon-512.png';
    });

    let original: any = null;

    if (candidates.length > 0) {
      // Pick the first / latest custom PNG
      const targetFile = candidates[0];
      const srcPath = path.join(publicDir, targetFile);
      console.log(`Auto-detected custom uploaded PNG file for app icon: ${srcPath}`);
      
      try {
        let imageBuffer = fs.readFileSync(srcPath);
        
        // Clean trailing garbage (PNG chunk padding added by some messengers or converters)
        const iendSignature = Buffer.from([0x49, 0x45, 0x4e, 0x44]); // 'IEND' in hex
        const iendIndex = imageBuffer.indexOf(iendSignature);
        
        if (iendIndex !== -1) {
          const expectedEnd = iendIndex + 8; // 'IEND' + 4-byte CRC
          if (imageBuffer.length > expectedEnd) {
            console.log(`Trimming ${imageBuffer.length - expectedEnd} trailing bytes to repair PNG.`);
            imageBuffer = imageBuffer.subarray(0, expectedEnd);
          }
        }

        original = await Jimp.read(imageBuffer);
        console.log(`Successfully loaded and verified uploaded image. Size: ${original.width}x${original.height}`);
      } catch (err: any) {
        console.warn(`Could not load uploaded image '${srcPath}' due to parsing error. falling back to smart dynamic snowball icon. Error:`, err.message);
      }
    } else {
      console.log('No custom uploaded PNG files found in /public. Customizing with perfect fallback vector snowball design.');
    }

    if (!original) {
      original = await generateBeautifulFallbackIcon();
    }

    // Delete existing generated icons to prevent carrying over dead weight
    const filesToDelete = ['public/icon.png', 'public/icon-192.png', 'public/icon-512.png'];
    for (const f of filesToDelete) {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
          console.log(`Deleted deprecated PNG file: ${f}`);
        } catch (e: any) {
          console.warn(`Could not delete ${f}:`, e.message);
        }
      }
    }

    console.log('Generating optimized 512x512px PNG buffer in-memory for SVG embedding...');
    const iconResized = original.clone().resize({ w: 512, h: 512 });
    const pngBuffer = await iconResized.getBuffer('image/png');
    
    console.log('Writing public/icon.svg (Pure Vector wrapper around optimized custom PNG visual)...');
    try {
      const base64Png = pngBuffer.toString('base64');
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <image href="data:image/png;base64,${base64Png}" width="512" height="512" x="0" y="0"/>
</svg>`;
      fs.writeFileSync('public/icon.svg', svgContent);
      console.log('Created public/icon.svg successfully');
    } catch (svgErr: any) {
      console.error('Failed to write public/icon.svg:', svgErr.message);
    }
    
    console.log('Successfully completed icon set synchronization!');
  } catch (error: any) {
    console.error('Fatal error in icon generation script:', error.message);
  }
}

resize();



