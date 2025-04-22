// app/api/extract-pdf/fileUtils.ts
/**
 * Utilities for handling file types related to the extraction API.
 */

export type SupportedFileType = 'pdf' | 'image';

export const SUPPORTED_EXTENSIONS: Record<string, SupportedFileType> = {
  'jpg': 'image',
  'jpeg': 'image',
  'png': 'image',
  'gif': 'image', // Note: Animated GIFs might not extract well
  'bmp': 'image',
  'webp': 'image',
  'pdf': 'pdf',
};

/**
 * Determines the supported file type based on the filename extension.
 * @param filename The full filename (e.g., 'document.pdf', 'photo.jpg').
 * @returns The supported file type ('pdf' or 'image') or null if unsupported.
 */
export function getSupportedFileType(filename: string): SupportedFileType | null {
  if (!filename) {
      return null;
  }
  const extension = filename.split('.').pop()?.toLowerCase() || '';
  return SUPPORTED_EXTENSIONS[extension] || null;
}

/**
 * Maps file extensions to their common MIME types.
 * Used for providing hints to APIs.
 * @param filename The full filename.
 * @returns The common MIME type string or a default if unknown.
 */
export function getMimeTypeFromFilename(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    switch (extension) {
        case 'pdf': return 'application/pdf';
        case 'jpg':
        case 'jpeg': return 'image/jpeg';
        case 'png': return 'image/png';
        case 'gif': return 'image/gif';
        case 'bmp': return 'image/bmp';
        case 'webp': return 'image/webp';
        default: return 'application/octet-stream'; // Default binary type
    }
}