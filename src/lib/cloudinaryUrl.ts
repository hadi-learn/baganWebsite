/**
 * Cloudinary URL Optimization Utilities
 * 
 * Applies automatic format (f_auto: WebP/AVIF) and quality (q_auto)
 * transformations to reduce bandwidth usage significantly.
 * 
 * Typical savings: 40-70% bandwidth reduction vs raw originals.
 */

/**
 * Apply Cloudinary transformations to an image URL.
 * Inserts transformation params between /upload/ and the public ID.
 * 
 * @param url - Original Cloudinary URL
 * @param options - Transformation options
 * @returns Optimized URL
 */
export function cloudinaryOptimize(
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: 'auto' | 'auto:low' | 'auto:eco' | 'auto:good' | 'auto:best' | number;
    crop?: 'fill' | 'fit' | 'limit' | 'thumb' | 'scale';
  } = {}
): string {
  if (!url || !url.includes('/upload/')) return url;

  const transforms: string[] = ['f_auto']; // Always use auto format (WebP/AVIF)
  
  transforms.push(`q_${options.quality || 'auto'}`);
  
  if (options.width) transforms.push(`w_${options.width}`);
  if (options.height) transforms.push(`h_${options.height}`);
  if (options.crop) transforms.push(`c_${options.crop}`);
  else if (options.width || options.height) transforms.push('c_limit'); // Default: don't upscale

  const transformStr = transforms.join(',');
  return url.replace('/upload/', `/upload/${transformStr}/`);
}

/** Tiny thumbnails for lightbox strip, admin summary cards (80-100px display) */
export function cldThumb(url: string): string {
  return cloudinaryOptimize(url, { width: 150, quality: 'auto:eco', crop: 'fill' });
}

/** Small thumbnails for admin gallery grid (150-180px display) */
export function cldSmall(url: string): string {
  return cloudinaryOptimize(url, { width: 320, quality: 'auto' });
}

/** Medium images for public gallery grid cards (400px display) */
export function cldMedium(url: string): string {
  return cloudinaryOptimize(url, { width: 500, quality: 'auto' });
}

/** Large images for lightbox main view */
export function cldLarge(url: string): string {
  return cloudinaryOptimize(url, { width: 1200, quality: 'auto:good' });
}
