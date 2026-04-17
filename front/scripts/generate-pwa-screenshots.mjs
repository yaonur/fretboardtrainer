/**
 * Solid-color PNGs for PWA manifest: screenshots + mask-safe icons (no extra deps).
 * Run: node scripts/generate-pwa-screenshots.mjs   (or pnpm run pwa:screenshots)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const shotDir = join(__dirname, '../static/pwa-screenshots');
const iconDir = join(__dirname, '../static/pwa-icons');
mkdirSync(shotDir, { recursive: true });
mkdirSync(iconDir, { recursive: true });

function crc32(buf) {
	let c = ~0 >>> 0;
	for (let i = 0; i < buf.length; i++) {
		c ^= buf[i];
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
		}
	}
	return (c ^ ~0) >>> 0;
}

function chunk(type, data) {
	const typeBuf = Buffer.from(type, 'ascii');
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length, 0);
	const crcBuf = Buffer.alloc(4);
	const crc = crc32(Buffer.concat([typeBuf, data]));
	crcBuf.writeUInt32BE(crc, 0);
	return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function solidPng(width, height, r, g, b) {
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(width, 0);
	ihdr.writeUInt32BE(height, 4);
	ihdr[8] = 8; // bit depth
	ihdr[9] = 6; // RGBA
	ihdr[10] = 0;
	ihdr[11] = 0;
	ihdr[12] = 0;

	const rowSize = 1 + width * 4;
	const raw = Buffer.alloc(rowSize * height);
	const px = Buffer.from([r, g, b, 255]);
	for (let y = 0; y < height; y++) {
		const off = y * rowSize;
		raw[off] = 0; // None filter
		for (let x = 0; x < width; x++) {
			px.copy(raw, off + 1 + x * 4);
		}
	}
	const idat = deflateSync(raw, { level: 9 });
	return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// Slate-900-ish brand fill (#0f172a)
const bg = { r: 15, g: 23, b: 42 };

writeFileSync(join(shotDir, 'wide.png'), solidPng(1280, 720, bg.r, bg.g, bg.b));
writeFileSync(join(shotDir, 'narrow.png'), solidPng(750, 1334, bg.r, bg.g, bg.b));

// Manifest icons: real pixel dimensions must match `sizes` (favicon.png is 128×128 only).
writeFileSync(join(iconDir, 'icon-192.png'), solidPng(192, 192, bg.r, bg.g, bg.b));
writeFileSync(join(iconDir, 'icon-512.png'), solidPng(512, 512, bg.r, bg.g, bg.b));

console.log('Wrote screenshots under', shotDir);
console.log('Wrote icons under', iconDir);
