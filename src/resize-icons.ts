import { Jimp } from 'jimp';
import fs from 'fs';

async function resize() {
  try {
    const srcPath = 'public/KakaoTalk_20260528_220542424.png';
    console.log(`Loading uploaded icon from: ${srcPath}...`);
    
    // Read raw buffer from disk to detect and clean trailing garbage
    let imageBuffer = fs.readFileSync(srcPath);
    const iendSignature = Buffer.from([0x49, 0x45, 0x4e, 0x44]); // 'IEND' in hex
    const iendIndex = imageBuffer.indexOf(iendSignature);
    
    if (iendIndex !== -1) {
      const expectedEnd = iendIndex + 8; // 'IEND' (4 bytes) + CRC (4 bytes)
      if (imageBuffer.length > expectedEnd) {
        console.log(`Detected trailing garbage byte(s) of size ${imageBuffer.length - expectedEnd}. Truncating the image to be fully compliant.`);
        imageBuffer = imageBuffer.subarray(0, expectedEnd);
      }
    }

    // Read the image using Jimp from clean buffer
    const original = await Jimp.read(imageBuffer);
    console.log(`Loaded original image. Size: ${original.width}x${original.height}`);

    console.log('Saving original of resized size 512x512 as public/icon.png...');
    const iconBase = original.clone().resize({ w: 512, h: 512 });
    await iconBase.write('public/icon.png');
    console.log('Created public/icon.png');
    
    console.log('Scaling to 192x192px...');
    const resized1 = original.clone().resize({ w: 192, h: 192 });
    await resized1.write('public/icon-192.png');
    console.log('Created public/icon-192.png');
    
    console.log('Scaling to 512x512px...');
    const resized2 = original.clone().resize({ w: 512, h: 512 });
    await resized2.write('public/icon-512.png');
    console.log('Created public/icon-512.png');
    
    console.log('Successfully generated public/icon.png, public/icon-192.png and public/icon-512.png!');
  } catch (error) {
    console.error('Error resizing icons:', error);
  }
}

resize();


