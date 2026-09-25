/** Longest side sent to the server; it stores at most 2000 px anyway. */
const MAX_SIDE = 2000;
/** Files already this small are sent as they are. */
const SMALL_FILE_BYTES = 1.5 * 1024 * 1024;

/**
 * Shrinks large phone photos in the browser before upload (saves mobile data and time).
 * createImageBitmap applies the EXIF rotation, so the result is upright. PNGs keep
 * transparency (party symbols); everything else becomes JPEG. Falls back to the original
 * file if the browser can't decode it (the server then decides).
 */
export async function prepareImage(file: File): Promise<Blob> {
  if (file.size <= SMALL_FILE_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
