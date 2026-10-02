// Photo helpers (docs/phase-5-spec.md Block D item 1), app layer: browser APIs only, no Dexie.
// `encodePhotoFile` re-encodes a camera/gallery picture on the phone BEFORE it is stored —
// longest edge ≤ 1024 px, WebP q0.8 with a JPEG q0.85 fallback (Safari silently returns PNG for
// an unsupported toBlob type, which the `blob.type` check catches). EXIF rotation is honoured
// where the platform supports it: createImageBitmap with { imageOrientation: 'from-image' },
// falling back to a plain createImageBitmap and finally to an <img> decode (modern engines apply
// EXIF orientation there by default). `usePhotoUrl` turns a stored Photo into an object URL and
// revokes it on unmount/switch, so the gallery never leaks blob URLs.
import { useEffect, useState } from 'preact/hooks';
import type { Photo } from '@/db/model';

/** Longest edge of a stored photo, in pixels. */
export const PHOTO_MAX_EDGE = 1024;

type Drawable = { source: CanvasImageSource; width: number; height: number; close?: () => void };

/** Decodes the file into something drawable, preferring createImageBitmap (EXIF-aware). */
async function loadDrawable(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === 'function') {
    try {
      // 'from-image' applies the EXIF rotation; an engine that rejects the option gets the plain call.
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      try {
        const bmp = await createImageBitmap(file);
        return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
      } catch {
        /* fall through to the <img> decode */
      }
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    // decode() resolved (or threw): the bitmap is in memory, the URL may go.
    URL.revokeObjectURL(url);
  }
}

/** Promise wrapper around canvas.toBlob (null when the engine refuses the type). */
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), type, quality);
    } catch {
      resolve(null);
    }
  });
}

/**
 * File (camera or gallery) -> a small Blob ready for `addPhoto`: longest edge ≤ 1024 px,
 * image/webp q0.8, or image/jpeg q0.85 when the browser cannot encode WebP. Throws
 * Error('photo-decode') for a file that is not a decodable image and Error('photo-encode')
 * when the canvas cannot produce a blob at all.
 */
export async function encodePhotoFile(file: File): Promise<Blob> {
  let drawable: Drawable;
  try {
    drawable = await loadDrawable(file);
  } catch {
    throw new Error('photo-decode');
  }
  const { source, width, height, close } = drawable;
  if (!(width > 0) || !(height > 0)) {
    close?.();
    throw new Error('photo-decode');
  }
  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    close?.();
    throw new Error('photo-encode');
  }
  ctx.drawImage(source, 0, 0, w, h);
  close?.();
  const webp = await canvasToBlob(canvas, 'image/webp', 0.8);
  // Safari ignores an unsupported type and hands back PNG: only a REAL WebP counts.
  if (webp && webp.type === 'image/webp') return webp;
  const jpeg = await canvasToBlob(canvas, 'image/jpeg', 0.85);
  if (jpeg && jpeg.type === 'image/jpeg') return jpeg;
  throw new Error('photo-encode');
}

/**
 * Object URL of a stored photo's blob, revoked on unmount and when the photo changes.
 * Null while there is no photo (or during the first render).
 */
export function usePhotoUrl(photo: Photo | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  // The row id (or the recipeId+at pair) identifies the blob; the object identity may change per query.
  const key = photo ? `${photo.id ?? ''}|${photo.recipeId}|${photo.at}` : '';
  useEffect(() => {
    if (!photo) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(photo.blob);
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return url;
}
