// Google Drive URL detection and conversion utilities.
// Drive share links return HTML viewer pages — not usable by Metricool or social platforms.
// These functions convert them to direct download URLs that serve the raw file.
//
// REQUIREMENTS:
// - The Drive file must be shared as "Anyone with the link can view"
// - Works reliably for images under 25 MB
// - Videos are not reliably streamable from Drive — use Cloudinary instead

export function isGoogleDriveUrl(url: string): boolean {
  return /drive\.google\.com/i.test(url)
}

export function getGoogleDriveFileId(url: string): string | null {
  // https://drive.google.com/file/d/{FILE_ID}/view?usp=sharing
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (fileMatch) return fileMatch[1]

  // https://drive.google.com/open?id={FILE_ID}
  // https://drive.google.com/uc?id={FILE_ID}
  const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (idMatch) return idMatch[1]

  return null
}

export function convertGoogleDriveUrl(url: string): { url: string; wasDrive: boolean; fileId: string | null } {
  if (!isGoogleDriveUrl(url)) return { url, wasDrive: false, fileId: null }

  const fileId = getGoogleDriveFileId(url)
  if (!fileId) return { url, wasDrive: false, fileId: null }

  // Route through our server-side proxy instead of Drive's direct download URL.
  // The proxy adds &confirm=t (skips the virus-scan interstitial for files >25 MB),
  // sets correct Content-Type headers, and gives Metricool a stable public URL.
  // Returns a relative URL — callers must prepend window.location.origin when
  // an absolute URL is needed (e.g. when passing to Metricool via the API).
  return {
    url: `/api/proxy/drive?id=${fileId}`,
    wasDrive: true,
    fileId,
  }
}
