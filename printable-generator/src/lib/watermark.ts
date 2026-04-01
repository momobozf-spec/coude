// Watermark utility for marketplace preview PDFs
// In production, use a PDF manipulation library (pdf-lib or pdfkit)
// For MVP, we store a "preview" flag and handle it at download time

export function getWatermarkText(): string {
  return "PREVIEW — NoorPrintables.com";
}

// Generate a signed download URL with expiry
// In production, use cloud storage (Supabase/S3) signed URLs
export function generateSignedUrl(fileUrl: string, expiresInSeconds = 3600): string {
  // For local dev, just return the URL as-is
  if (fileUrl.startsWith("/") || fileUrl.startsWith("http://localhost")) {
    return fileUrl;
  }

  // For production with Supabase/S3, generate a signed URL here
  // Example with Supabase:
  // const { data } = await supabase.storage.from('marketplace').createSignedUrl(path, expiresInSeconds);
  // return data.signedUrl;

  return fileUrl;
}

export const MAX_PREVIEW_PAGES = 2;
export const MAX_DOWNLOADS = 5;
