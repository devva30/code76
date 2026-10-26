/**
 * Shrinks and converts a photo in the browser before upload: at most 2400 px on the longest side,
 * saved as WebP (much smaller than JPEG/PNG at the same quality). A 6 MB phone photo usually
 * becomes ~300 KB, so pages load fast without the admin having to resize anything by hand.
 * If the browser can't make WebP, the original file is uploaded unchanged.
 */
const MAX_SIDE = 2400;
const QUALITY = 0.86;

export async function prepareImage(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file; // the server explains what's accepted
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.type === 'image/webp' && file.size < 1_500_000) {
    bitmap.close();
    return file; // already small and already WebP
  }
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', QUALITY));
  if (!blob || blob.type !== 'image/webp') return file;
  if (scale === 1 && blob.size >= file.size) return file; // conversion didn't help
  const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
  return new File([blob], name, { type: 'image/webp', lastModified: Date.now() });
}
