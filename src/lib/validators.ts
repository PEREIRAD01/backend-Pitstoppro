export function hasExactlyOne(...values: unknown[]): boolean {
  let count = 0;
  for (const v of values) {
    if (Boolean(v)) count++;
    if (count > 1) return false;
  }
  return count === 1;
}

export function isImageMimeType(mime?: string | null): boolean {
  return typeof mime === 'string' && mime.startsWith('image/');
}

