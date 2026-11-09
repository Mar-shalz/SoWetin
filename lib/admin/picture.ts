// What an uploaded picture really is, from its first bytes, not from the name or the browser's claim (trust boundary).
// SVG and anything else are refused: a picture must be a plain raster image.
export type PictureType = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/avif';
export const PICTURE_EXT: Record<PictureType, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif' };

export function pictureType(b: Uint8Array): PictureType | null {
  const s = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0x89 && s(1, 4) === 'PNG') return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (s(0, 4) === 'RIFF' && s(8, 12) === 'WEBP') return 'image/webp';
  if (s(4, 8) === 'ftyp' && ['avif', 'avis'].includes(s(8, 12))) return 'image/avif';
  return null;
}
