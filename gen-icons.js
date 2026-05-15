const zlib = require('zlib');
const fs = require('fs');

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  return Buffer.concat([len, t, data, crc]);
}

function makePNG(size, pixels) {
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // RGBA
  const raw = [];
  for (let y = 0; y < size; y++) {
    raw.push(0);
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      raw.push(pixels[i], pixels[i+1], pixels[i+2], pixels[i+3]);
    }
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.from(raw))), chunk('IEND', Buffer.alloc(0))]);
}

function inPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (((yi > py) !== (yj > py)) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function drawIcon(size) {
  const px = new Uint8Array(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const circleR = size * 0.42;
  // Background #0d0d0f
  for (let i = 0; i < px.length; i += 4) { px[i]=13; px[i+1]=13; px[i+2]=15; px[i+3]=255; }
  // Purple circle #7c3aed
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (Math.hypot(x - cx, y - cy) <= circleR) {
      const i = (y * size + x) * 4;
      px[i]=124; px[i+1]=58; px[i+2]=237; px[i+3]=255;
    }
  }
  // 4-pointed star — outer radius R, inner radius r
  const R = size * 0.27, r = size * 0.065;
  const star = [];
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4 - Math.PI / 2;
    const rad = k % 2 === 0 ? R : r;
    star.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]);
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (inPolygon(x + 0.5, y + 0.5, star)) {
      const i = (y * size + x) * 4;
      px[i]=255; px[i+1]=255; px[i+2]=255; px[i+3]=255;
    }
  }
  return px;
}

[192, 512].forEach(size => {
  fs.writeFileSync(`icon-${size}.png`, makePNG(size, drawIcon(size)));
  console.log(`icon-${size}.png created`);
});
