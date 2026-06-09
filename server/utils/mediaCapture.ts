import { Request, Response, NextFunction } from 'express';

/**
 * mediaCapture — non-AI "when was this taken?" extraction.
 *
 * Reads the capture timestamp straight out of an uploaded file's own metadata:
 *   • JPEG  → EXIF DateTimeOriginal / DateTimeDigitized / DateTime
 *   • MP4/MOV → the moov→mvhd box creation_time
 *
 * Challenge evidence uses this to flag stale or back-dated media (e.g. a gym
 * photo from last month submitted as today's proof). No machine learning — just
 * parsing the bytes the camera already wrote.
 */

function parseExifDate(s: string): Date | null {
  // EXIF datetime format: "YYYY:MM:DD HH:MM:SS"
  const m = s.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
  return isNaN(+d) ? null : d;
}

function parseTiffForDate(buf: Buffer, tiff: number): Date | null {
  if (tiff + 8 > buf.length) return null;
  const bo = buf.toString('ascii', tiff, tiff + 2);
  const le = bo === 'II';
  if (!le && bo !== 'MM') return null;
  const u16 = (o: number) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o: number) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const targets = [0x9003, 0x9011, 0x0132]; // DateTimeOriginal, DateTimeDigitized, DateTime

  const readIfd = (ifdOff: number, depth: number): Date | null => {
    if (depth > 3 || ifdOff + 2 > buf.length) return null;
    const count = u16(ifdOff);
    let exifPtr = 0;
    for (let i = 0; i < count; i++) {
      const e = ifdOff + 2 + i * 12;
      if (e + 12 > buf.length) break;
      const tag = u16(e);
      const type = u16(e + 2);
      const cnt = u32(e + 4);
      if (targets.includes(tag) && type === 2) {
        const valOff = cnt <= 4 ? e + 8 : tiff + u32(e + 8);
        if (valOff + cnt <= buf.length) {
          const d = parseExifDate(buf.toString('ascii', valOff, valOff + Math.min(cnt, 20)));
          if (d) return d;
        }
      }
      if (tag === 0x8769) exifPtr = tiff + u32(e + 8); // Exif sub-IFD pointer
    }
    if (exifPtr) return readIfd(exifPtr, depth + 1);
    return null;
  };

  try { return readIfd(tiff + u32(tiff + 4), 0); } catch { return null; }
}

export function extractImageCaptureTime(buf: Buffer): Date | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null; // JPEG SOI
  let offset = 2;
  while (offset + 4 < buf.length) {
    if (buf[offset] !== 0xff) break;
    const marker = buf[offset + 1];
    if (marker === 0xda) break; // start of scan — metadata done
    const size = buf.readUInt16BE(offset + 2);
    if (size < 2) break;
    if (marker === 0xe1) { // APP1 → EXIF
      const segStart = offset + 4;
      if (buf.toString('ascii', segStart, segStart + 4) === 'Exif') {
        const d = parseTiffForDate(buf, segStart + 6);
        if (d) return d;
      }
    }
    offset += 2 + size;
  }
  return null;
}

export function extractVideoCaptureTime(buf: Buffer): Date | null {
  const EPOCH_1904 = 2082844800; // seconds between 1904-01-01 and 1970-01-01
  const findBox = (start: number, end: number, type: string): { start: number; end: number } | null => {
    let o = start;
    while (o + 8 <= end) {
      let size = buf.readUInt32BE(o);
      const t = buf.toString('ascii', o + 4, o + 8);
      let header = 8;
      if (size === 1) { if (o + 16 > end) break; size = Number(buf.readBigUInt64BE(o + 8)); header = 16; }
      else if (size === 0) size = end - o;
      if (size < header) break;
      if (t === type) return { start: o + header, end: o + size };
      o += size;
    }
    return null;
  };
  try {
    const moov = findBox(0, buf.length, 'moov');
    if (!moov) return null;
    const mvhd = findBox(moov.start, moov.end, 'mvhd');
    if (!mvhd) return null;
    const o = mvhd.start;
    const version = buf[o];
    const secs = version === 1
      ? (o + 12 <= buf.length ? Number(buf.readBigUInt64BE(o + 4)) : 0)
      : (o + 8 <= buf.length ? buf.readUInt32BE(o + 4) : 0);
    if (!secs) return null;
    const d = new Date((secs - EPOCH_1904) * 1000);
    if (+d < Date.UTC(2000, 0, 1) || +d > Date.now() + 86400000) return null; // sanity
    return isNaN(+d) ? null : d;
  } catch { return null; }
}

export function extractCaptureTime(buf: Buffer, mime: string): Date | null {
  try {
    if (mime.startsWith('image/')) return extractImageCaptureTime(buf);
    if (mime.startsWith('video/')) return extractVideoCaptureTime(buf);
  } catch { /* never let metadata parsing break an upload */ }
  return null;
}

/**
 * Express middleware: stamp each uploaded file with `capturedAt` BEFORE
 * optimizeImage re-encodes images (which strips EXIF). Must run after multer
 * and before optimizeImage.
 */
export function stampMediaCapture(req: Request, _res: Response, next: NextFunction) {
  try {
    const files: any[] = [];
    if ((req as any).file) files.push((req as any).file);
    if ((req as any).files) {
      if (Array.isArray((req as any).files)) files.push(...(req as any).files);
      else for (const ff of Object.values((req as any).files as Record<string, any[]>)) files.push(...ff);
    }
    for (const f of files) {
      if (f?.buffer?.length) {
        const d = extractCaptureTime(f.buffer, String(f.mimetype || ''));
        if (d) (f as any).capturedAt = d;
      }
    }
  } catch { /* ignore */ }
  next();
}
