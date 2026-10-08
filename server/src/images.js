// Event images: every upload is cropped to 16:10 and saved as two JPEGs (1600×1000 and 800×500).
// Re-encoding through sharp also strips camera metadata (GPS etc.) and anything that is not image data.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const config = require('./config');

const W = 1600, H = 1000;          // 16:10, same shape as the event cards
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 20 * 1024 * 1024;

async function saveEventImage(buffer, crop) {
  let img = sharp(buffer, { failOn: 'error' }).rotate();          // apply phone camera orientation
  const meta = await img.metadata();
  const w = meta.autoOrient ? meta.autoOrient.width : meta.width;
  const h = meta.autoOrient ? meta.autoOrient.height : meta.height;
  if (!w || !h) throw new Error('That file is not a readable image.');
  if (w < 400 || h < 250) throw new Error('That image is too small. Use a photo at least 800 pixels wide.');

  // Crop box from the admin cropper, in original-image pixels. Clamp it to the image.
  if (crop && [crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) && crop.width > 0 && crop.height > 0) {
    const left = Math.max(0, Math.round(crop.x)), top = Math.max(0, Math.round(crop.y));
    const width = Math.min(w - left, Math.round(crop.width)), height = Math.min(h - top, Math.round(crop.height));
    if (width >= 50 && height >= 30) img = sharp(await img.toBuffer()).extract({ left, top, width, height });
  }

  const big = await img.resize(W, H, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  const small = await sharp(big).resize(W / 2, H / 2).jpeg({ quality: 80, mozjpeg: true }).toBuffer();

  const month = new Date().toISOString().slice(0, 7);
  const id = crypto.randomBytes(8).toString('hex');
  const dir = path.join(config.uploadsDir, 'events', month);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, id + '.jpg'), big);
  fs.writeFileSync(path.join(dir, id + '-800.jpg'), small);
  return {
    image: `uploads/events/${month}/${id}.jpg`,
    image_small: `uploads/events/${month}/${id}-800.jpg`,
    kb: Math.round(big.length / 1024)
  };
}

// Deletes an uploaded image pair (never touches the site's own images/ folder)
function deleteUploaded(relPath) {
  if (!relPath || !relPath.startsWith('uploads/') || relPath.includes('..')) return;
  const full = path.join(config.uploadsDir, relPath.slice('uploads/'.length));
  if (!full.startsWith(config.uploadsDir)) return;
  fs.rm(full, { force: true }, () => {});
}

module.exports = { saveEventImage, deleteUploaded, ALLOWED, MAX_BYTES };
